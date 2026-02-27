#!/usr/bin/env python3
"""
seed_profiles.py — Complete every employee's profile with realistic data.

Fills in (idempotent — safe to re-run):
  • Missing User fields   – phone, iod_number, location, supervisor (text),
                            reports_to (FK), vacation_days_used, sick_days_used
  • LeaveRequest records  – approved / pending / denied per employee
  • Attendance records    – ~3 months of daily clock-in / clock-out
  • Task records          – assigned tasks per employee

Standalone usage:
    python backend/seed_profiles.py          # from project root
    python seed_profiles.py                  # from backend/ directory
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
    from backend.models import User, LeaveRequest, Attendance, Task
except ModuleNotFoundError:
    from database import create_db_and_tables, get_session
    from models import User, LeaveRequest, Attendance, Task

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

random.seed(7)
TODAY      = datetime(2026, 2, 25, 12, 0, 0)
TODAY_DATE = TODAY.date()
ATTEND_START = TODAY_DATE - timedelta(days=91)   # ~3 months back


# ─────────────────────────────────────────────────────────────────────────────
# Static profile data
# ─────────────────────────────────────────────────────────────────────────────

# username → extra fields to apply
# reports_to_username resolved at runtime
_PROFILE_EXTRAS = {
    "jwilson": dict(
        phone="555-801-0001", iod_number="EMP-001",
        location="Main Floor", supervisor=None, reports_to_un=None,
        vacation_days_used=5, sick_days_used=1,
    ),
    "schen": dict(
        phone="555-801-0002", iod_number="EMP-002",
        location="Admin Office", supervisor="James Wilson", reports_to_un="jwilson",
        vacation_days_used=3, sick_days_used=0,
    ),
    "mthompson": dict(
        phone="555-801-0003", iod_number="EMP-003",
        location="Main Floor", supervisor="James Wilson", reports_to_un="jwilson",
        vacation_days_used=4, sick_days_used=2,
    ),
    "erodriguez": dict(
        phone="555-801-0004", iod_number="EMP-004",
        location="Treatment Room 1", supervisor="Sarah Chen", reports_to_un="schen",
        vacation_days_used=2, sick_days_used=1,
    ),
    "dpark": dict(
        phone="555-801-0005", iod_number="EMP-005",
        location="Nail Studio", supervisor="Marcus Thompson", reports_to_un="mthompson",
        vacation_days_used=1, sick_days_used=0,
    ),
    "ajohnson": dict(
        phone="555-801-0006", iod_number="EMP-006",
        location="Treatment Room 2", supervisor="Sarah Chen", reports_to_un="schen",
        vacation_days_used=1, sick_days_used=1,
    ),
    "tbrooks": dict(
        phone="555-801-0007", iod_number="EMP-007",
        location="Front Desk", supervisor="Marcus Thompson", reports_to_un="mthompson",
        vacation_days_used=0, sick_days_used=1,
    ),
    "nfoster": dict(
        phone="555-801-0008", iod_number="EMP-008",
        location="Skin Studio", supervisor="Sarah Chen", reports_to_un="schen",
        vacation_days_used=2, sick_days_used=0,
    ),
}


# (username, leave_type, start_date, end_date, days_requested, status, notes, supervisor_un)
_LEAVE_REQUESTS = [
    # James Wilson
    ("jwilson",    "vacation", "2025-12-23", "2025-12-27", 5.0, "approved", "Christmas holiday",         None),
    ("jwilson",    "sick",     "2025-11-14", "2025-11-14", 1.0, "approved", "Doctor appointment",        None),
    # Sarah Chen
    ("schen",      "vacation", "2025-12-23", "2025-12-26", 4.0, "approved", "Holiday break",             "jwilson"),
    ("schen",      "vacation", "2026-03-10", "2026-03-14", 5.0, "pending",  "Spring trip",               "jwilson"),
    ("schen",      "sick",     "2025-10-30", "2025-10-30", 1.0, "approved", "Not feeling well",          "jwilson"),
    # Marcus Thompson
    ("mthompson",  "vacation", "2025-11-27", "2025-11-28", 2.0, "approved", "Thanksgiving extension",    "jwilson"),
    ("mthompson",  "vacation", "2026-03-17", "2026-03-21", 5.0, "pending",  "Family holiday",            "jwilson"),
    ("mthompson",  "sick",     "2025-12-02", "2025-12-03", 2.0, "approved", "Flu",                       "jwilson"),
    # Emily Rodriguez
    ("erodriguez", "vacation", "2025-12-24", "2025-12-26", 3.0, "approved", "Christmas",                 "schen"),
    ("erodriguez", "vacation", "2026-04-07", "2026-04-11", 5.0, "pending",  "Easter break",              "schen"),
    ("erodriguez", "sick",     "2025-11-05", "2025-11-05", 1.0, "approved", None,                        "schen"),
    # David Park
    ("dpark",      "vacation", "2026-02-28", "2026-02-28", 1.0, "approved", "Personal day",              "mthompson"),
    ("dpark",      "vacation", "2026-04-14", "2026-04-18", 5.0, "pending",  "Spring vacation",           "mthompson"),
    # Aisha Johnson
    ("ajohnson",   "vacation", "2025-12-31", "2026-01-01", 2.0, "approved", "New Year",                  "schen"),
    ("ajohnson",   "sick",     "2025-12-09", "2025-12-09", 1.0, "approved", "Migraine",                  "schen"),
    ("ajohnson",   "vacation", "2026-05-05", "2026-05-09", 5.0, "pending",  "Summer pre-break",          "schen"),
    # Tyler Brooks
    ("tbrooks",    "vacation", "2025-12-23", "2025-12-23", 1.0, "approved", "Christmas Eve",             "mthompson"),
    ("tbrooks",    "sick",     "2026-01-08", "2026-01-08", 1.0, "approved", "Cold",                      "mthompson"),
    ("tbrooks",    "vacation", "2026-03-24", "2026-03-25", 2.0, "denied",   "Short-staffed that week",   "mthompson"),
    # Natalie Foster
    ("nfoster",    "vacation", "2025-11-27", "2025-11-29", 3.0, "approved", "Thanksgiving",              "schen"),
    ("nfoster",    "vacation", "2026-04-01", "2026-04-04", 4.0, "pending",  "Spring break",              "schen"),
    ("nfoster",    "sick",     "2026-01-22", "2026-01-22", 1.0, "approved", None,                        "schen"),
]


# (title, description, assigned_to_un, status, priority, due_days_offset)
# Positive offset = future due date; negative = already past due
_TASKS = [
    ("Update client intake forms",
     "Review and refresh the standard new-client intake questionnaire for 2026.",
     "schen",      "completed",   "medium", -20),
    ("Restock treatment room 1 supplies",
     "Order and restock massage oils, towels, and disposable table covers.",
     "erodriguez",  "completed",   "high",   -10),
    ("Q1 performance review prep",
     "Prepare self-assessments and schedule one-on-one review meetings for all direct reports.",
     "jwilson",     "in_progress", "high",    14),
    ("Build March full-month schedule",
     "Create the complete therapist schedule for March and share with the team.",
     "mthompson",   "in_progress", "medium",   7),
    ("Retail shelf inventory audit",
     "Conduct a full count of all retail products on the display floor and update inventory records.",
     "tbrooks",     "pending",     "low",     10),
    ("Q1 client feedback survey rollout",
     "Email the Q1 satisfaction survey link to all clients seen in the last 60 days.",
     "schen",       "pending",     "medium",  21),
    ("First-aid kit restocking",
     "Check and restock first-aid supplies in the break room and all three treatment rooms.",
     "dpark",       "completed",   "high",    -5),
    ("Book continuing education course",
     "Research and register for one CE-credit massage course before end of Q2.",
     "ajohnson",    "pending",     "low",     45),
    ("Update nail studio price list",
     "Reflect the revised 2026 pricing on both the printed service menu and the website draft.",
     "nfoster",     "in_progress", "medium",   5),
    ("Review vendor contracts",
     "Audit all current supplier agreements and flag any contracts expiring within 90 days.",
     "jwilson",     "pending",     "high",    30),
    ("Coordinate end-of-March deep-clean",
     "Schedule and brief all staff on the full-facility deep clean during the last week of March.",
     "mthompson",   "pending",     "medium",  25),
    ("Configure second POS terminal",
     "Set up and test the additional point-of-sale terminal at the front desk.",
     "tbrooks",     "pending",     "medium",  14),
    ("Prepare onboarding packet for next hire",
     "Compile welcome materials, policy overview, and first-week schedule template.",
     "schen",       "pending",     "low",     60),
    ("Check HVAC filter replacement schedule",
     "Confirm that all HVAC filters were serviced per the quarterly schedule and log completion.",
     "dpark",       "completed",   "medium",  -3),
    ("Update emergency contact info",
     "Remind all staff to verify their emergency contact details are current in the system.",
     "jwilson",     "completed",   "low",     -7),
]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _dt(d: date, h: int = 9, m: int = 0, s: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, s)


def _is_workday(d: date) -> bool:
    """True for Mon–Sat; employees work 6-day weeks at this spa."""
    return d.weekday() != 6  # exclude Sunday only


def _rand_clock(rng: random.Random, base_in_h: int, base_out_h: int) -> tuple[int, int, int, int]:
    """Return (in_h, in_m, out_h, out_m) with small realistic variance."""
    in_m  = rng.choice([0, 0, 0, 5, 10, 15, -5])
    out_m = rng.choice([0, 0, 5, 10, 15, 30, -10])
    ci_h, ci_m = base_in_h,  max(0, min(59, in_m))
    co_h, co_m = base_out_h, max(0, min(59, out_m))
    if co_h < ci_h or (co_h == ci_h and co_m <= ci_m):
        co_h = ci_h + 8
    return ci_h, ci_m, co_h, co_m


# ─────────────────────────────────────────────────────────────────────────────
# Seed function
# ─────────────────────────────────────────────────────────────────────────────

def seed_employee_profiles(session: Session) -> None:
    print("  seed_employee_profiles: starting…")

    # Fetch all employees by username
    all_users = session.exec(select(User)).all()
    by_un: dict[str, User] = {u.username: u for u in all_users}

    if not by_un:
        print("  seed_employee_profiles: no users found — run seed_data.py first.")
        return

    # ── 1. Fill in missing User profile fields ────────────────────────────────
    updated = 0
    for un, extras in _PROFILE_EXTRAS.items():
        emp = by_un.get(un)
        if not emp:
            continue

        # Resolve supervisor FK
        sup_un = extras.get("reports_to_un")
        sup_user = by_un.get(sup_un) if sup_un else None

        changed = False
        if not emp.phone:
            emp.phone = extras["phone"];          changed = True
        if not emp.iod_number:
            emp.iod_number = extras["iod_number"]; changed = True
        if not emp.location:
            emp.location = extras["location"];    changed = True
        if not emp.supervisor and extras.get("supervisor"):
            emp.supervisor = extras["supervisor"]; changed = True
        if not emp.reports_to and sup_user:
            emp.reports_to = sup_user.id;         changed = True
        # Always sync used-days (seed may not have set them)
        if emp.vacation_days_used != extras["vacation_days_used"]:
            emp.vacation_days_used = extras["vacation_days_used"]; changed = True
        if emp.sick_days_used != extras["sick_days_used"]:
            emp.sick_days_used = extras["sick_days_used"];         changed = True

        if changed:
            session.add(emp)
            updated += 1

    try:
        session.commit()
        print(f"  ✓ {updated} employee records updated with profile fields")
    except Exception:
        session.rollback()
        raise

    # ── 2. Leave requests ─────────────────────────────────────────────────────
    existing_lr = session.exec(select(LeaveRequest).limit(1)).first()
    if not existing_lr:
        lr_count = 0
        for (un, ltype, s_str, e_str, days, status, notes, sup_un) in _LEAVE_REQUESTS:
            emp = by_un.get(un)
            if not emp:
                continue
            sup = by_un.get(sup_un) if sup_un else None
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
            lr_count += 1
        try:
            session.commit()
            print(f"  ✓ {lr_count} leave requests")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - leave requests already present, skipping")

    # ── 3. Attendance records ─────────────────────────────────────────────────
    existing_att = session.exec(select(Attendance).limit(1)).first()
    if not existing_att:
        rng = random.Random(99)
        # Clock schedule per employee: (base_in_h, base_out_h)
        clock_schedule = {
            "jwilson":    (8, 17),
            "schen":      (9, 18),
            "mthompson":  (9, 18),
            "erodriguez": (9, 17),
            "dpark":      (10, 18),
            "ajohnson":   (9, 17),
            "tbrooks":    (8, 16),
            "nfoster":    (10, 18),
        }
        att_count = 0
        d = ATTEND_START
        while d <= TODAY_DATE:
            if not _is_workday(d):
                d += timedelta(days=1)
                continue
            for un, emp in by_un.items():
                if un not in clock_schedule:
                    d += timedelta(days=1)
                    continue
                base_in, base_out = clock_schedule[un]
                # ~15% absent on any given day
                if rng.random() < 0.15:
                    d += timedelta(days=1)
                    continue
                ci_h, ci_m, co_h, co_m = _rand_clock(rng, base_in, base_out)
                clock_in  = _dt(d, ci_h, ci_m)
                clock_out = _dt(d, co_h, co_m)
                total_h   = round((clock_out - clock_in).seconds / 3600, 2)
                rec = Attendance(
                    user_id    = emp.id,
                    date       = _dt(d),
                    clock_in   = clock_in,
                    clock_out  = clock_out,
                    total_hours = total_h,
                )
                session.add(rec)
                att_count += 1
            d += timedelta(days=1)

        try:
            session.commit()
            print(f"  ✓ {att_count} attendance records (~3 months)")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - attendance records already present, skipping")

    # ── 4. Tasks ──────────────────────────────────────────────────────────────
    existing_task = session.exec(select(Task).limit(1)).first()
    if not existing_task:
        task_count = 0
        for (title, desc, un, status, priority, due_offset) in _TASKS:
            emp = by_un.get(un)
            if not emp:
                continue
            due = _dt(TODAY_DATE + timedelta(days=due_offset), 17, 0) if due_offset else None
            task = Task(
                title          = title,
                description    = desc,
                status         = status,
                priority       = priority,
                due_date       = due,
                assigned_to_id = emp.id,
            )
            session.add(task)
            task_count += 1
        try:
            session.commit()
            print(f"  ✓ {task_count} tasks")
        except Exception:
            session.rollback()
            raise
    else:
        print("  - tasks already present, skipping")

    print("  seed_employee_profiles: complete ✓")


# ─────────────────────────────────────────────────────────────────────────────
# Standalone entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Verifying database tables…")
    create_db_and_tables()
    print("Running profile seed…")
    session = next(get_session())
    try:
        seed_employee_profiles(session)
    finally:
        session.close()
    print("Done.")
