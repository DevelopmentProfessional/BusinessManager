#!/usr/bin/env python3
"""
seed_extended.py — Extend the BusinessManager demo database with richer data.

Adds (all idempotent — safe to re-run):
  • Recurring series appointments    – 3 platinum/gold clients on weekly/biweekly schedules
  • Meeting events                   – weekly staff meetings + monthly dept meetings + 1-on-1 reviews
  • General task events              – inventory audits, deep cleans, training sessions
  • Production task events           – batch production runs (skipped if no PRODUCT inventory found)
  • Additional leave requests        – sick calls and personal days spread across 4 months
  • Payslip top-up                   – fills any pay periods not already covered by seed_data.py
  • Employee profile patch           – phone / iod_number / location / supervisor for any empty slots

4-month window: 2025-11-01 → 2026-03-13 (with 2 weeks forward for scheduled items)

Usage:
    python backend/seed_extended.py          # from project root
    python seed_extended.py                  # from backend/ directory
"""

import os
import sys
import random
from datetime import datetime, timedelta, date

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.dirname(_HERE))

from sqlmodel import Session, select

try:
    from backend.database import create_db_and_tables, get_session
    from backend.models import (
        User, Client, Service, Inventory,
        Schedule, ScheduleAttendee, PaySlip, LeaveRequest, UserRole,
    )
except ModuleNotFoundError:
    from database import create_db_and_tables, get_session        # type: ignore
    from models import (                                           # type: ignore
        User, Client, Service, Inventory,
        Schedule, ScheduleAttendee, PaySlip, LeaveRequest, UserRole,
    )

# ─────────────────────────────────────────────────────────────────────────────
# Window & helpers
# ─────────────────────────────────────────────────────────────────────────────

random.seed(2026)
rng = random.Random(2026)

TODAY      = datetime(2026, 3, 13, 12, 0, 0)
TODAY_DATE = TODAY.date()
WIN_START  = date(2025, 11, 1)   # 4-month window start
WIN_END    = TODAY_DATE + timedelta(days=14)  # 2 weeks ahead for scheduled items
PAY_END    = TODAY_DATE - timedelta(days=1)   # payslips only for complete past periods


def _dt(d: date, h: int = 9, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m)


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _weekly_periods(start: date, end: date):
    week = _monday(start)
    while week + timedelta(days=6) <= end:
        yield week, week + timedelta(days=6)
        week += timedelta(days=7)


def _biweekly_periods(start: date, end: date):
    week = _monday(start)
    while week + timedelta(days=13) <= end:
        yield week, week + timedelta(days=13)
        week += timedelta(days=14)


def _next_weekday(from_date: date, weekday: int) -> date:
    """Return the first occurrence of `weekday` (0=Mon … 6=Sun) on or after from_date."""
    days_ahead = weekday - from_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return from_date + timedelta(days=days_ahead)


def _occurrences(first: date, last: date, step_days: int):
    """Yield dates starting at first, every step_days days, up to last (inclusive)."""
    cur = first
    while cur <= last:
        yield cur
        cur += timedelta(days=step_days)


# ─────────────────────────────────────────────────────────────────────────────
# Status helpers
# ─────────────────────────────────────────────────────────────────────────────

def _appt_status(d: date) -> str:
    if d > TODAY_DATE:
        return "scheduled"
    r = rng.random()
    if r < 0.75:
        return "completed"
    elif r < 0.88:
        return "cancelled"
    return "scheduled"


def _task_status(d: date) -> str:
    if d > TODAY_DATE:
        return "scheduled"
    return rng.choice(["completed", "completed", "completed", "cancelled"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Recurring series appointments
# ─────────────────────────────────────────────────────────────────────────────

_SERIES_SPECS = [
    # (client_email, service_name, employee_username, weekday(0=Mon), hour, step_days, notes)
    (
        "priya.k@mail.com",
        "Deep Tissue Massage",
        "ajohnson",
        2,   # Wednesday
        10,
        7,   # weekly
        "Platinum member — weekly therapeutic session",
    ),
    (
        "olivia.h@mail.com",
        "Facial Treatment",
        "nfoster",
        4,   # Friday
        11,
        14,  # biweekly
        "Gold member — biweekly collagen facial",
    ),
    (
        "amara.d@mail.com",
        "Nail Care Package",
        "dpark",
        3,   # Thursday
        14,
        7,   # weekly
        "Platinum member — weekly nail care",
    ),
]


def seed_recurring_series(session: Session, emp_by_un: dict, cl_by_email: dict, svc_by_name: dict) -> int:
    existing = session.exec(
        select(Schedule).where(Schedule.is_recurring_master == True)  # noqa: E712
    ).first()
    if existing:
        print("  - recurring series already present, skipping")
        return 0

    count = 0
    for (cl_email, svc_name, emp_un, weekday, hour, step_days, notes) in _SERIES_SPECS:
        cl  = cl_by_email.get(cl_email)
        svc = svc_by_name.get(svc_name)
        emp = emp_by_un.get(emp_un)
        if not (cl and svc and emp):
            continue

        first_occ = _next_weekday(WIN_START, weekday)
        end_date  = WIN_END

        # Master record
        master = Schedule(
            client_id            = cl.id,
            service_id           = svc.id,
            employee_id          = emp.id,
            appointment_date     = _dt(first_occ, hour),
            status               = _appt_status(first_occ),
            notes                = notes,
            appointment_type     = "series",
            duration_minutes     = svc.duration_minutes,
            is_recurring_master  = True,
            recurrence_frequency = "weekly" if step_days == 7 else "biweekly",
            recurrence_end_date  = _dt(end_date, 23, 59),
        )
        session.add(master)
        session.flush()  # get master.id

        # Attendee for master
        session.add(ScheduleAttendee(schedule_id=master.id, user_id=emp.id, attendance_status="accepted"))
        session.add(ScheduleAttendee(schedule_id=master.id, client_id=cl.id, attendance_status="accepted"))
        count += 1

        # Child occurrences (skip the first one — that IS the master)
        for occ_date in list(_occurrences(first_occ, end_date, step_days))[1:]:
            status = _appt_status(occ_date)
            child = Schedule(
                client_id           = cl.id,
                service_id          = svc.id,
                employee_id         = emp.id,
                appointment_date    = _dt(occ_date, hour),
                status              = status,
                notes               = notes,
                appointment_type    = "series",
                duration_minutes    = svc.duration_minutes,
                is_recurring_master = False,
                parent_schedule_id  = master.id,
            )
            session.add(child)
            session.flush()
            session.add(ScheduleAttendee(schedule_id=child.id, user_id=emp.id, attendance_status="accepted" if status != "cancelled" else "declined"))
            session.add(ScheduleAttendee(schedule_id=child.id, client_id=cl.id, attendance_status="accepted" if status != "cancelled" else "declined"))
            count += 1

    try:
        session.commit()
        print(f"  [OK] {count} recurring series schedule entries")
    except Exception:
        session.rollback()
        raise
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 2. Meeting events
# ─────────────────────────────────────────────────────────────────────────────

def seed_meetings(session: Session, emp_by_un: dict) -> int:
    existing = session.exec(
        select(Schedule).where(Schedule.appointment_type == "meeting")
    ).first()
    if existing:
        print("  - meeting events already present, skipping")
        return 0

    count = 0
    employees = list(emp_by_un.values())
    jwilson   = emp_by_un.get("jwilson")
    schen     = emp_by_un.get("schen")
    mthompson = emp_by_un.get("mthompson")

    # ── A. Weekly Monday all-hands staff meeting (hosted by jwilson) ────────────
    first_monday = _next_weekday(WIN_START, 0)  # Monday
    for mon in _occurrences(first_monday, WIN_END, 7):
        status = _appt_status(mon)
        host   = jwilson or employees[0]
        mtg = Schedule(
            employee_id      = host.id,
            appointment_date = _dt(mon, 8, 30),
            status           = status,
            notes            = "Weekly all-hands — schedule review, client updates, open floor",
            appointment_type = "meeting",
            duration_minutes = 45,
            is_recurring_master = False,
        )
        session.add(mtg)
        session.flush()
        for emp in employees:
            att_status = "accepted" if status != "cancelled" else "declined"
            session.add(ScheduleAttendee(schedule_id=mtg.id, user_id=emp.id, attendance_status=att_status))
        count += 1

    # ── B. Bi-monthly department meetings (1st and 3rd Wednesday each month) ───
    dept_meetings = [
        # (host_un, title, attendee_uns, hour)
        ("schen",    "Client Services Team Meeting",     ["schen", "erodriguez", "ajohnson", "nfoster"], 14),
        ("mthompson","Operations & Inventory Review",    ["mthompson", "dpark", "tbrooks"],              15),
    ]
    cur = WIN_START
    while cur <= WIN_END:
        # Find the 1st Wednesday of the month
        first_wed = _next_weekday(date(cur.year, cur.month, 1), 2)
        third_wed = first_wed + timedelta(days=14)
        for idx, meeting_date in enumerate([first_wed, third_wed]):
            if not (WIN_START <= meeting_date <= WIN_END):
                continue
            spec   = dept_meetings[idx % 2]
            host   = emp_by_un.get(spec[0])
            if not host:
                continue
            status = _appt_status(meeting_date)
            mtg = Schedule(
                employee_id      = host.id,
                appointment_date = _dt(meeting_date, spec[3]),
                status           = status,
                notes            = spec[1],
                appointment_type = "meeting",
                duration_minutes = 60,
                is_recurring_master = False,
            )
            session.add(mtg)
            session.flush()
            for un in spec[2]:
                emp = emp_by_un.get(un)
                if emp:
                    att = "accepted" if status != "cancelled" else "declined"
                    session.add(ScheduleAttendee(schedule_id=mtg.id, user_id=emp.id, attendance_status=att))
            count += 1
        # Advance to next month
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)

    # ── C. One-on-one performance review meetings ────────────────────────────
    review_pairings = [
        ("jwilson",   "schen",      "2025-11-12", 10),
        ("jwilson",   "mthompson",  "2025-11-13", 14),
        ("schen",     "erodriguez", "2025-11-18", 9),
        ("schen",     "ajohnson",   "2025-11-18", 11),
        ("schen",     "nfoster",    "2025-11-19", 14),
        ("mthompson", "dpark",      "2025-11-19", 9),
        ("mthompson", "tbrooks",    "2025-11-20", 11),
        # Q1 review round
        ("jwilson",   "schen",      "2026-02-11", 10),
        ("jwilson",   "mthompson",  "2026-02-12", 14),
        ("schen",     "erodriguez", "2026-02-17", 9),
        ("schen",     "ajohnson",   "2026-02-17", 11),
        ("schen",     "nfoster",    "2026-02-18", 14),
        ("mthompson", "dpark",      "2026-02-18", 9),
        ("mthompson", "tbrooks",    "2026-02-19", 11),
    ]
    for (host_un, reviewee_un, date_str, hour) in review_pairings:
        host     = emp_by_un.get(host_un)
        reviewee = emp_by_un.get(reviewee_un)
        if not (host and reviewee):
            continue
        rev_date = date.fromisoformat(date_str)
        if not (WIN_START <= rev_date <= WIN_END):
            continue
        status = _appt_status(rev_date)
        mtg = Schedule(
            employee_id      = host.id,
            appointment_date = _dt(rev_date, hour),
            status           = status,
            notes            = f"Performance review — {host.first_name} with {reviewee.first_name} {reviewee.last_name}",
            appointment_type = "meeting",
            duration_minutes = 30,
            is_recurring_master = False,
        )
        session.add(mtg)
        session.flush()
        for emp in [host, reviewee]:
            att = "accepted" if status != "cancelled" else "declined"
            session.add(ScheduleAttendee(schedule_id=mtg.id, user_id=emp.id, attendance_status=att))
        count += 1

    try:
        session.commit()
        print(f"  [OK] {count} meeting events")
    except Exception:
        session.rollback()
        raise
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 3. General task events
# ─────────────────────────────────────────────────────────────────────────────

_GENERAL_TASKS = [
    # (assigned_un, date_str, hour, notes, duration_min)
    ("tbrooks",    "2025-11-04", 8,  "Retail floor inventory audit — count all display products and log discrepancies", 90),
    ("dpark",      "2025-11-06", 9,  "Treatment room 1 & 2 deep clean — scrub surfaces, restock disposables, check HVAC filters", 120),
    ("nfoster",    "2025-11-11", 10, "Skin studio supply restock — place orders for collagen masks, serums, exfoliants", 45),
    ("erodriguez", "2025-11-13", 9,  "New client intake process review — update forms and checklist for 2026 standards", 60),
    ("tbrooks",    "2025-11-17", 8,  "POS system end-of-week reconciliation — match daily receipts with system totals", 45),
    ("mthompson",  "2025-11-21", 13, "Vendor contract audit — review supplier agreements expiring within 90 days", 90),
    ("dpark",      "2025-12-01", 9,  "Full facility monthly deep clean — all rooms, reception, break room", 180),
    ("tbrooks",    "2025-12-03", 8,  "Staff scheduling for December holiday period — draft and share with team", 60),
    ("nfoster",    "2025-12-08", 10, "Collagen treatment prep — batch-prepare facial solutions for the week", 60),
    ("erodriguez", "2025-12-10", 9,  "Holiday promotion setup — prepare gift card display and seasonal service menu", 45),
    ("ajohnson",   "2025-12-15", 14, "Year-end client feedback review — compile satisfaction scores and flag follow-ups", 90),
    ("mthompson",  "2025-12-17", 9,  "Inventory pre-Christmas stock check — verify retail shelves are fully stocked", 60),
    ("schen",      "2026-01-05", 9,  "New year systems check — verify all staff credentials, update client records", 60),
    ("tbrooks",    "2026-01-07", 8,  "January inventory audit — full count of all back-room and display stock", 90),
    ("dpark",      "2026-01-12", 9,  "Nail studio equipment maintenance — inspect lamps, tools, sterilize trays", 60),
    ("erodriguez", "2026-01-14", 10, "Treatment room refresh — replace table covers, restock oils, update music playlist", 45),
    ("ajohnson",   "2026-01-19", 14, "Continuing education session — online massage therapy CE credits (self-study)", 120),
    ("nfoster",    "2026-01-21", 10, "Skin care product rotation — rotate seasonal stock, remove expired items", 45),
    ("mthompson",  "2026-01-26", 13, "Q1 schedule build — draft full February therapist rota and share with team", 60),
    ("tbrooks",    "2026-02-02", 8,  "Valentine's promotion setup — window display, gift card basket, promotional signage", 60),
    ("dpark",      "2026-02-04", 9,  "Monthly facility deep clean — all treatment rooms, reception, break room", 180),
    ("schen",      "2026-02-09", 9,  "Client loyalty program review — update tier points, flag upcoming renewals", 60),
    ("erodriguez", "2026-02-11", 10, "Aromatherapy oil inventory check — log quantities, flag low-stock items for reorder", 45),
    ("ajohnson",   "2026-02-16", 14, "Client portfolio review — check booking history for top 20 clients, prep personalised notes", 60),
    ("tbrooks",    "2026-02-18", 8,  "End-of-month cash reconciliation — count float, balance tills, prepare bank deposit", 45),
    ("mthompson",  "2026-02-23", 13, "March schedule build — create full March booking grid and distribute to staff", 60),
    ("dpark",      "2026-03-02", 9,  "Spring product line setup — unbox new arrivals, tag items, update display", 60),
    ("nfoster",    "2026-03-04", 10, "Monthly facial supply audit — count masks, serums, towels; submit restock order", 45),
    ("tbrooks",    "2026-03-09", 8,  "Full facility deep clean — pre-spring refresh of all rooms and common areas", 180),
    ("schen",      "2026-03-11", 9,  "Q1 performance data compile — gather service counts, revenue by therapist for review", 90),
]


def seed_general_tasks(session: Session, emp_by_un: dict) -> int:
    existing = session.exec(
        select(Schedule).where(
            Schedule.appointment_type == "task",
            Schedule.task_type == "service",
        )
    ).first()
    if existing:
        print("  - general task events already present, skipping")
        return 0

    count = 0
    for (un, date_str, hour, notes, duration) in _GENERAL_TASKS:
        emp = emp_by_un.get(un)
        if not emp:
            continue
        task_date = date.fromisoformat(date_str)
        if not (WIN_START <= task_date <= WIN_END):
            continue
        status = _task_status(task_date)
        task = Schedule(
            employee_id      = emp.id,
            appointment_date = _dt(task_date, hour),
            status           = status,
            notes            = notes,
            appointment_type = "task",
            task_type        = "service",
            duration_minutes = duration,
            is_recurring_master = False,
        )
        session.add(task)
        session.flush()
        session.add(ScheduleAttendee(schedule_id=task.id, user_id=emp.id, attendance_status="accepted" if status != "cancelled" else "declined"))
        count += 1

    try:
        session.commit()
        print(f"  [OK] {count} general task events")
    except Exception:
        session.rollback()
        raise
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 4. Production task events
# ─────────────────────────────────────────────────────────────────────────────

_PRODUCTION_TASKS = [
    # (employee_un, date_str, hour, batches, notes)
    ("nfoster",    "2025-11-05", 8,  2, "Batch production run — collagen facial solution"),
    ("erodriguez", "2025-11-12", 8,  3, "Batch production run — aromatherapy massage oil blend"),
    ("dpark",      "2025-11-19", 8,  2, "Batch production run — nail care gel top coat"),
    ("nfoster",    "2025-12-03", 8,  4, "Batch production run — holiday special facial serum"),
    ("erodriguez", "2025-12-10", 8,  3, "Batch production run — deep tissue massage oil"),
    ("dpark",      "2025-12-17", 8,  2, "Batch production run — gel polish clear base"),
    ("nfoster",    "2026-01-07", 8,  3, "Batch production run — new year collagen mask batch"),
    ("erodriguez", "2026-01-14", 8,  2, "Batch production run — eucalyptus relaxation oil"),
    ("dpark",      "2026-01-21", 8,  3, "Batch production run — nail strengthening treatment"),
    ("nfoster",    "2026-02-04", 8,  4, "Batch production run — Valentine's rose petal serum"),
    ("erodriguez", "2026-02-11", 8,  3, "Batch production run — hot stone massage oil"),
    ("dpark",      "2026-02-18", 8,  2, "Batch production run — gel nail gloss coat"),
    ("nfoster",    "2026-03-04", 8,  3, "Batch production run — spring renewal facial blend"),
    ("erodriguez", "2026-03-11", 8,  4, "Batch production run — lavender therapeutic oil"),
]


def seed_production_tasks(session: Session, emp_by_un: dict, product_items: list) -> int:
    if not product_items:
        print("  - no PRODUCT inventory items found — skipping production task events")
        print("    (add products via the Inventory page, then re-run this script)")
        return 0

    existing = session.exec(
        select(Schedule).where(Schedule.task_type == "production")
    ).first()
    if existing:
        print("  - production task events already present, skipping")
        return 0

    count = 0
    for idx, (un, date_str, hour, batches, notes) in enumerate(_PRODUCTION_TASKS):
        emp = emp_by_un.get(un)
        if not emp:
            continue
        task_date = date.fromisoformat(date_str)
        if not (WIN_START <= task_date <= WIN_END):
            continue

        # Round-robin through available PRODUCT items
        product = product_items[idx % len(product_items)]
        status  = _task_status(task_date)

        task = Schedule(
            employee_id         = emp.id,
            appointment_date    = _dt(task_date, hour),
            status              = status,
            notes               = notes,
            appointment_type    = "task",
            task_type           = "production",
            duration_minutes    = 120,
            production_item_id  = product.id,
            production_quantity = batches,
            is_recurring_master = False,
        )
        session.add(task)
        session.flush()
        session.add(ScheduleAttendee(schedule_id=task.id, user_id=emp.id, attendance_status="accepted" if status != "cancelled" else "declined"))
        count += 1

    try:
        session.commit()
        print(f"  [OK] {count} production task events (using {len(product_items)} product(s))")
    except Exception:
        session.rollback()
        raise
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 5. Additional leave requests
# ─────────────────────────────────────────────────────────────────────────────

_EXTRA_LEAVE = [
    # (emp_un, leave_type, start_str, end_str, days, status, notes, sup_un)
    # November sick days
    ("erodriguez", "sick",     "2025-11-05", "2025-11-05", 1.0, "approved", "Fever — called in sick",                       "schen"),
    ("tbrooks",    "sick",     "2025-11-10", "2025-11-10", 1.0, "approved", "Stomach bug",                                  "mthompson"),
    ("dpark",      "sick",     "2025-11-17", "2025-11-17", 1.0, "approved", "Dental appointment (emergency)",                "mthompson"),
    # Thanksgiving (late November)
    ("nfoster",    "vacation", "2025-11-27", "2025-11-29", 3.0, "approved", "Thanksgiving with family",                     "schen"),
    ("mthompson",  "vacation", "2025-11-27", "2025-11-28", 2.0, "approved", "Thanksgiving extension",                       "jwilson"),
    ("ajohnson",   "vacation", "2025-11-28", "2025-11-28", 1.0, "approved", "Thanksgiving Friday",                          "schen"),
    # December sick / holiday
    ("mthompson",  "sick",     "2025-12-02", "2025-12-03", 2.0, "approved", "Flu — unable to work",                         "jwilson"),
    ("ajohnson",   "sick",     "2025-12-09", "2025-12-09", 1.0, "approved", "Migraine",                                     "schen"),
    ("dpark",      "sick",     "2025-12-15", "2025-12-15", 1.0, "approved", "Food poisoning",                               "mthompson"),
    # Christmas / New Year
    ("jwilson",    "vacation", "2025-12-23", "2025-12-27", 5.0, "approved", "Christmas holiday",                            None),
    ("schen",      "vacation", "2025-12-23", "2025-12-26", 4.0, "approved", "Holiday break",                                "jwilson"),
    ("erodriguez", "vacation", "2025-12-24", "2025-12-26", 3.0, "approved", "Christmas",                                    "schen"),
    ("tbrooks",    "vacation", "2025-12-23", "2025-12-23", 1.0, "approved", "Christmas Eve",                                "mthompson"),
    ("ajohnson",   "vacation", "2025-12-31", "2026-01-01", 2.0, "approved", "New Year",                                     "schen"),
    # January
    ("tbrooks",    "sick",     "2026-01-08", "2026-01-08", 1.0, "approved", "Cold",                                         "mthompson"),
    ("nfoster",    "sick",     "2026-01-22", "2026-01-22", 1.0, "approved", "Sinus infection",                              "schen"),
    ("erodriguez", "sick",     "2026-01-27", "2026-01-27", 1.0, "approved", "Doctor appointment — follow-up",               "schen"),
    # February
    ("dpark",      "vacation", "2026-02-28", "2026-02-28", 1.0, "approved", "Personal day",                                 "mthompson"),
    ("schen",      "sick",     "2026-02-10", "2026-02-10", 1.0, "approved", "Migraine",                                     "jwilson"),
    ("ajohnson",   "sick",     "2026-02-17", "2026-02-17", 1.0, "approved", "Eye infection",                                "schen"),
    # March (upcoming / pending)
    ("schen",      "vacation", "2026-03-10", "2026-03-14", 5.0, "pending",  "Spring trip",                                  "jwilson"),
    ("mthompson",  "vacation", "2026-03-17", "2026-03-21", 5.0, "pending",  "Family holiday",                               "jwilson"),
    ("tbrooks",    "vacation", "2026-03-24", "2026-03-25", 2.0, "denied",   "Short-staffed that week — request denied",     "mthompson"),
    ("erodriguez", "vacation", "2026-04-07", "2026-04-11", 5.0, "pending",  "Easter break",                                 "schen"),
    ("dpark",      "vacation", "2026-04-14", "2026-04-18", 5.0, "pending",  "Spring vacation",                              "mthompson"),
    ("ajohnson",   "vacation", "2026-05-05", "2026-05-09", 5.0, "pending",  "Summer pre-break",                             "schen"),
    ("nfoster",    "vacation", "2026-04-01", "2026-04-04", 4.0, "pending",  "Spring break",                                 "schen"),
]


def seed_extra_leave(session: Session, emp_by_un: dict) -> int:
    count = 0
    for (un, ltype, s_str, e_str, days, status, notes, sup_un) in _EXTRA_LEAVE:
        emp = emp_by_un.get(un)
        if not emp:
            continue
        # Idempotency check
        exists = session.exec(
            select(LeaveRequest).where(
                LeaveRequest.user_id   == emp.id,
                LeaveRequest.leave_type == ltype,
                LeaveRequest.start_date == s_str,
                LeaveRequest.end_date   == e_str,
            )
        ).first()
        if exists:
            continue
        sup = emp_by_un.get(sup_un) if sup_un else None
        lr = LeaveRequest(
            user_id        = emp.id,
            supervisor_id  = sup.id if sup else None,
            leave_type     = ltype,
            start_date     = s_str,
            end_date       = e_str,
            days_requested = days,
            status         = status,
            notes          = notes,
        )
        session.add(lr)
        count += 1

    if count:
        try:
            session.commit()
            print(f"  [OK] {count} additional leave requests")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - leave requests already complete, no additions needed")
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 6. Payslip top-up
# ─────────────────────────────────────────────────────────────────────────────

_INSURANCE_DEDUCT = {
    "Basic Health":   150.00,
    "Premium Health": 280.00,
    "No Insurance":     0.00,
}


def seed_payslips(session: Session, employees: list) -> int:
    """Generate payslips for any pay periods in the 4-month window not already covered."""
    slip_rng = random.Random(555)
    count = 0

    for emp in employees:
        if not emp.pay_frequency:
            continue
        if not emp.salary and not emp.hourly_rate:
            continue

        ins_ded = _INSURANCE_DEDUCT.get(emp.insurance_plan or "", 0.0)

        if emp.pay_frequency == "weekly":
            periods = list(_weekly_periods(WIN_START, PAY_END))
        elif emp.pay_frequency == "biweekly":
            periods = list(_biweekly_periods(WIN_START, PAY_END))
        else:
            continue

        for (ps, pe) in periods:
            # Idempotency: skip if payslip for this period already exists
            ps_dt = _dt(ps, 0, 0)
            pe_dt = _dt(pe, 23, 59)
            exists = session.exec(
                select(PaySlip).where(
                    PaySlip.employee_id      == emp.id,
                    PaySlip.pay_period_start == ps_dt,
                )
            ).first()
            if exists:
                continue

            if emp.employment_type == "hourly":
                hours = 40.0
                gross = round((emp.hourly_rate or 0) * hours, 2)
                other_ded = 0.0
            else:
                if emp.pay_frequency == "weekly":
                    gross = round((emp.salary or 0) / 52, 2)
                else:
                    gross = round((emp.salary or 0) / 26, 2)
                other_ded = round(gross * slip_rng.uniform(0.02, 0.04), 2)

            net = round(gross - ins_ded - other_ded, 2)

            slip = PaySlip(
                employee_id          = emp.id,
                pay_period_start     = ps_dt,
                pay_period_end       = pe_dt,
                gross_amount         = gross,
                insurance_deduction  = ins_ded,
                other_deductions     = other_ded,
                net_amount           = net,
                employment_type      = emp.employment_type or "salary",
                hours_worked         = 40.0 if emp.employment_type == "hourly" else None,
                hourly_rate_snapshot = emp.hourly_rate if emp.employment_type == "hourly" else None,
                salary_snapshot      = emp.salary,
                pay_frequency        = emp.pay_frequency,
                status               = "paid",
                insurance_plan_name  = emp.insurance_plan,
                created_at           = _dt(pe + timedelta(days=1), 9, 0),
            )
            session.add(slip)
            count += 1

    if count:
        try:
            session.commit()
            print(f"  [OK] {count} payslips added (filling gaps in 4-month window)")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - payslips already complete for 4-month window, no additions needed")
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 7. Employee profile patch
# ─────────────────────────────────────────────────────────────────────────────

_PROFILE_PATCHES = {
    "jwilson":    dict(phone="555-801-0001", iod_number="EMP-001", location="Main Floor",        supervisor=None,           reports_to_un=None,         hire_date=datetime(2021, 3, 15)),
    "schen":      dict(phone="555-801-0002", iod_number="EMP-002", location="Admin Office",      supervisor="James Wilson",  reports_to_un="jwilson",    hire_date=datetime(2022, 1, 10)),
    "mthompson":  dict(phone="555-801-0003", iod_number="EMP-003", location="Main Floor",        supervisor="James Wilson",  reports_to_un="jwilson",    hire_date=datetime(2021, 7, 22)),
    "erodriguez": dict(phone="555-801-0004", iod_number="EMP-004", location="Treatment Room 1",  supervisor="Sarah Chen",    reports_to_un="schen",      hire_date=datetime(2022, 9, 5)),
    "dpark":      dict(phone="555-801-0005", iod_number="EMP-005", location="Nail Studio",       supervisor="Marcus Thompson", reports_to_un="mthompson", hire_date=datetime(2023, 2, 14)),
    "ajohnson":   dict(phone="555-801-0006", iod_number="EMP-006", location="Treatment Room 2",  supervisor="Sarah Chen",    reports_to_un="schen",      hire_date=datetime(2023, 5, 20)),
    "tbrooks":    dict(phone="555-801-0007", iod_number="EMP-007", location="Front Desk",        supervisor="Marcus Thompson", reports_to_un="mthompson", hire_date=datetime(2024, 1, 8)),
    "nfoster":    dict(phone="555-801-0008", iod_number="EMP-008", location="Skin Studio",       supervisor="Sarah Chen",    reports_to_un="schen",      hire_date=datetime(2023, 8, 3)),
}

_BENEFITS_DEFAULTS = {
    UserRole.ADMIN:    dict(employment_type="salary", pay_frequency="weekly",   salary=95000.0, hourly_rate=None, insurance_plan="Premium Health", vacation_days=20, sick_days=10),
    UserRole.MANAGER:  dict(employment_type="salary", pay_frequency="biweekly", salary=70000.0, hourly_rate=None, insurance_plan="Basic Health",   vacation_days=15, sick_days=8),
    UserRole.EMPLOYEE: dict(employment_type="salary", pay_frequency="weekly",   salary=52000.0, hourly_rate=None, insurance_plan="Basic Health",   vacation_days=12, sick_days=6),
    UserRole.VIEWER:   dict(employment_type="salary", pay_frequency="monthly",  salary=42000.0, hourly_rate=None, insurance_plan="No Insurance",   vacation_days=10, sick_days=5),
}


def seed_employee_profiles(session: Session, employees: list, emp_by_un: dict) -> int:
    updated = 0
    for emp in employees:
        patch = _PROFILE_PATCHES.get(emp.username, {})
        sup_user = emp_by_un.get(patch.get("reports_to_un")) if patch else None
        defaults = _BENEFITS_DEFAULTS.get(emp.role, _BENEFITS_DEFAULTS[UserRole.EMPLOYEE])
        changed  = False

        # Profile fields
        if patch:
            if not emp.phone       and patch.get("phone"):       emp.phone       = patch["phone"];       changed = True
            if not emp.iod_number  and patch.get("iod_number"):  emp.iod_number  = patch["iod_number"];  changed = True
            if not emp.location    and patch.get("location"):    emp.location    = patch["location"];    changed = True
            if not emp.supervisor  and patch.get("supervisor"):  emp.supervisor  = patch["supervisor"];  changed = True
            if not emp.reports_to  and sup_user:                 emp.reports_to  = sup_user.id;          changed = True
            if not emp.hire_date   and patch.get("hire_date"):   emp.hire_date   = patch["hire_date"];   changed = True

        # Compensation / insurance fallbacks
        if not emp.employment_type: emp.employment_type = defaults["employment_type"]; changed = True
        if not emp.pay_frequency:   emp.pay_frequency   = defaults["pay_frequency"];   changed = True
        if not emp.insurance_plan:  emp.insurance_plan  = defaults["insurance_plan"];  changed = True
        if emp.vacation_days is None: emp.vacation_days = defaults["vacation_days"];   changed = True
        if emp.sick_days is None:     emp.sick_days     = defaults["sick_days"];       changed = True
        if emp.vacation_days_used is None: emp.vacation_days_used = 0; changed = True
        if emp.sick_days_used is None:     emp.sick_days_used     = 0; changed = True

        if emp.employment_type == "hourly":
            if emp.hourly_rate is None: emp.hourly_rate = 20.0; changed = True
        else:
            if emp.salary is None: emp.salary = defaults["salary"]; changed = True

        if changed:
            session.add(emp)
            updated += 1

    if updated:
        try:
            session.commit()
            print(f"  [OK] {updated} employee profile records patched")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - employee profiles already complete, no changes needed")
    return updated


# ─────────────────────────────────────────────────────────────────────────────
# Main orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def seed_extended(session: Session) -> None:
    print("  seed_extended: starting…")

    # Load reference data
    all_users    = session.exec(select(User)).all()
    emp_by_un    = {u.username: u for u in all_users}
    all_clients  = session.exec(select(Client)).all()
    cl_by_email  = {c.email: c for c in all_clients if c.email}
    all_svcs     = session.exec(select(Service)).all()
    svc_by_name  = {s.name: s for s in all_svcs}
    product_items = session.exec(
        select(Inventory).where(Inventory.type == "product")
    ).all()

    if not emp_by_un:
        print("  seed_extended: no users found — run seed_data.py first.")
        return
    if not cl_by_email:
        print("  seed_extended: no clients found — run seed_data.py first.")
        return
    if not svc_by_name:
        print("  seed_extended: no services found — run seed_data.py first.")
        return

    employees = [u for u in all_users if u.role != UserRole.VIEWER]

    # ── Step 1: Employee profiles ─────────────────────────────────────────────
    seed_employee_profiles(session, employees, emp_by_un)

    # ── Step 2: Recurring series ──────────────────────────────────────────────
    seed_recurring_series(session, emp_by_un, cl_by_email, svc_by_name)

    # ── Step 3: Meeting events ────────────────────────────────────────────────
    seed_meetings(session, emp_by_un)

    # ── Step 4: General tasks ─────────────────────────────────────────────────
    seed_general_tasks(session, emp_by_un)

    # ── Step 5: Production tasks ──────────────────────────────────────────────
    seed_production_tasks(session, emp_by_un, product_items)

    # ── Step 6: Leave requests ────────────────────────────────────────────────
    seed_extra_leave(session, emp_by_un)

    # ── Step 7: Payslip top-up ────────────────────────────────────────────────
    seed_payslips(session, employees)

    print("  seed_extended: complete [OK]")


# ─────────────────────────────────────────────────────────────────────────────
# Standalone entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Verifying database tables…")
    create_db_and_tables()
    print("Running extended seed…")
    session = next(get_session())
    try:
        seed_extended(session)
    finally:
        session.close()
    print("Done.")
