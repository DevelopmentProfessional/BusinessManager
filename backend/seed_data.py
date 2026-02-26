#!/usr/bin/env python3
"""
seed_data.py — Seed BusinessManager with realistic demo data.

Seeded entities
───────────────
  • AppSettings     – "Serenity Wellness & Spa" company info
  • 3  InsurancePlans
  • 8  Employees    – full payroll details (salary / hourly, weekly / biweekly)
  • 15 Clients      – mixed membership tiers
  • 6  Services     – spa & wellness menu
  • ~120 Appointments – 4 months back, incl. overlaps & cancellations
  • ~30 SaleTransactions with line items
  • ~130 PaySlips   – covering every past pay period up to the current week

Idempotent: aborts silently if ≥ 10 clients are already present.

Standalone usage:
    python backend/seed_data.py          # from project root
    python seed_data.py                  # from backend/ directory
"""

import os
import sys
import random
from datetime import datetime, timedelta, date
from uuid import UUID, uuid4

# ── path resolution so the script works run from any cwd ─────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.dirname(_HERE))

import bcrypt
from sqlmodel import Session, select

try:
    from backend.database import create_db_and_tables, get_session
    from backend.models import (
        User, Client, InsurancePlan, Service,
        Schedule, ScheduleAttendee,
        SaleTransaction, SaleTransactionItem,
        PaySlip, AppSettings,
        UserRole, MembershipTier,
    )
except ModuleNotFoundError:
    from database import create_db_and_tables, get_session
    from models import (
        User, Client, InsurancePlan, Service,
        Schedule, ScheduleAttendee,
        SaleTransaction, SaleTransactionItem,
        PaySlip, AppSettings,
        UserRole, MembershipTier,
    )

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
random.seed(42)

TODAY        = datetime(2026, 2, 25, 12, 0, 0)
TODAY_DATE   = TODAY.date()
START_DATE   = (TODAY - timedelta(days=122)).date()   # ≈ Oct 25 2025

SETTINGS_ID  = UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_PW   = "Pass1234!"

_pw_hash_cache: str | None = None


def _hash(pw: str = DEFAULT_PW) -> str:
    global _pw_hash_cache
    if _pw_hash_cache is None:
        _pw_hash_cache = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    return _pw_hash_cache


def _dt(d: date, h: int = 9, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m)


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


# ─────────────────────────────────────────────────────────────────────────────
# Seed data definitions
# ─────────────────────────────────────────────────────────────────────────────

_INSURANCE_PLANS = [
    dict(name="Basic Health",   description="Basic medical & dental coverage",       monthly_deduction=150.00, is_active=True),
    dict(name="Premium Health", description="Full medical, dental & vision coverage", monthly_deduction=280.00, is_active=True),
    dict(name="No Insurance",   description="Employee opted out of group plan",       monthly_deduction=0.00,  is_active=True),
]

_EMPLOYEES = [
    dict(username="jwilson",   first_name="James",   last_name="Wilson",    email="james.wilson@serenity.com",   role=UserRole.ADMIN,    employment_type="salary",  salary=95000.0, hourly_rate=None, pay_frequency="weekly",   insurance_plan="Premium Health", color="#E74C3C", hire_date=datetime(2021, 3, 15), vacation_days=20, sick_days=10),
    dict(username="schen",     first_name="Sarah",   last_name="Chen",      email="sarah.chen@serenity.com",     role=UserRole.MANAGER,  employment_type="salary",  salary=72000.0, hourly_rate=None, pay_frequency="biweekly", insurance_plan="Premium Health", color="#9B59B6", hire_date=datetime(2022, 1, 10), vacation_days=15, sick_days=8),
    dict(username="mthompson", first_name="Marcus",  last_name="Thompson",  email="marcus.t@serenity.com",       role=UserRole.MANAGER,  employment_type="salary",  salary=68000.0, hourly_rate=None, pay_frequency="biweekly", insurance_plan="Basic Health",   color="#2980B9", hire_date=datetime(2021, 7, 22), vacation_days=15, sick_days=8),
    dict(username="erodriguez",first_name="Emily",   last_name="Rodriguez", email="emily.r@serenity.com",        role=UserRole.EMPLOYEE, employment_type="salary",  salary=52000.0, hourly_rate=None, pay_frequency="weekly",   insurance_plan="Basic Health",   color="#27AE60", hire_date=datetime(2022, 9, 5),  vacation_days=12, sick_days=6),
    dict(username="dpark",     first_name="David",   last_name="Park",      email="david.park@serenity.com",     role=UserRole.EMPLOYEE, employment_type="hourly",  salary=None,    hourly_rate=22.0, pay_frequency="weekly",   insurance_plan="Basic Health",   color="#F39C12", hire_date=datetime(2023, 2, 14), vacation_days=10, sick_days=5),
    dict(username="ajohnson",  first_name="Aisha",   last_name="Johnson",   email="aisha.j@serenity.com",        role=UserRole.EMPLOYEE, employment_type="salary",  salary=48000.0, hourly_rate=None, pay_frequency="weekly",   insurance_plan="Premium Health", color="#1ABC9C", hire_date=datetime(2023, 5, 20), vacation_days=10, sick_days=5),
    dict(username="tbrooks",   first_name="Tyler",   last_name="Brooks",    email="tyler.b@serenity.com",        role=UserRole.EMPLOYEE, employment_type="hourly",  salary=None,    hourly_rate=19.0, pay_frequency="weekly",   insurance_plan="No Insurance",   color="#E67E22", hire_date=datetime(2024, 1, 8),  vacation_days=8,  sick_days=4),
    dict(username="nfoster",   first_name="Natalie", last_name="Foster",    email="natalie.f@serenity.com",      role=UserRole.EMPLOYEE, employment_type="salary",  salary=55000.0, hourly_rate=None, pay_frequency="biweekly", insurance_plan="Basic Health",   color="#8E44AD", hire_date=datetime(2023, 8, 3),  vacation_days=12, sick_days=6),
]

_CLIENTS = [
    dict(name="Olivia Hartmann",   email="olivia.h@mail.com",    phone="555-0101", membership_tier=MembershipTier.GOLD,     membership_points=1420, address="14 Elm Street, Springfield"),
    dict(name="Caleb Morrison",    email="caleb.m@mail.com",     phone="555-0102", membership_tier=MembershipTier.SILVER,   membership_points=680,  address="28 Oak Avenue, Riverside"),
    dict(name="Priya Kapoor",      email="priya.k@mail.com",     phone="555-0103", membership_tier=MembershipTier.PLATINUM, membership_points=3100, address="5 Maple Drive, Lakewood"),
    dict(name="Jordan Walsh",      email="jordan.w@mail.com",    phone="555-0104", membership_tier=MembershipTier.BRONZE,   membership_points=240,  address="77 Pine Road, Westfield"),
    dict(name="Mei-Ling Zhao",     email="meiling.z@mail.com",   phone="555-0105", membership_tier=MembershipTier.GOLD,     membership_points=1870, address="3 Cherry Blvd, Northgate"),
    dict(name="Damian Fletcher",   email="damian.f@mail.com",    phone="555-0106", membership_tier=MembershipTier.SILVER,   membership_points=510,  address="91 Walnut Lane, Eastview"),
    dict(name="Samira Okafor",     email="samira.o@mail.com",    phone="555-0107", membership_tier=MembershipTier.NONE,     membership_points=0,    address="22 Birch Court, Southside"),
    dict(name="Lucas Beaumont",    email="lucas.b@mail.com",     phone="555-0108", membership_tier=MembershipTier.GOLD,     membership_points=1200, address="8 Spruce Way, Hillcrest"),
    dict(name="Ingrid Svensson",   email="ingrid.s@mail.com",    phone="555-0109", membership_tier=MembershipTier.BRONZE,   membership_points=320,  address="44 Cedar Street, Bayview"),
    dict(name="Rafael Santos",     email="rafael.s@mail.com",    phone="555-0110", membership_tier=MembershipTier.SILVER,   membership_points=760,  address="16 Ash Place, Greenville"),
    dict(name="Amara Diallo",      email="amara.d@mail.com",     phone="555-0111", membership_tier=MembershipTier.PLATINUM, membership_points=2850, address="33 Willow Close, Fairview"),
    dict(name="Ethan Kowalski",    email="ethan.k@mail.com",     phone="555-0112", membership_tier=MembershipTier.NONE,     membership_points=80,   address="61 Poplar Terrace, Midtown"),
    dict(name="Yasmin Al-Rashid",  email="yasmin.a@mail.com",    phone="555-0113", membership_tier=MembershipTier.GOLD,     membership_points=1650, address="9 Magnolia Street, Oldtown"),
    dict(name="Connor Fitzgerald", email="connor.f@mail.com",    phone="555-0114", membership_tier=MembershipTier.SILVER,   membership_points=440,  address="53 Hazel Drive, Uptown"),
    dict(name="Nneka Obiora",      email="nneka.o@mail.com",     phone="555-0115", membership_tier=MembershipTier.BRONZE,   membership_points=190,  address="72 Linden Way, Crossroads"),
]

_SERVICES = [
    dict(name="Haircut & Style",      description="Precision cut and blow-dry finish",        price=45.0,  duration_minutes=45,  category="Hair",    is_active=True),
    dict(name="Deep Tissue Massage",  description="60-minute therapeutic massage",            price=95.0,  duration_minutes=60,  category="Wellness",is_active=True),
    dict(name="Facial Treatment",     description="Customised skin-care facial",               price=75.0,  duration_minutes=50,  category="Skin",    is_active=True),
    dict(name="Nail Care Package",    description="Manicure, pedicure & gel top coat",        price=55.0,  duration_minutes=60,  category="Nails",   is_active=True),
    dict(name="Consultation Session", description="One-on-one wellness consultation",         price=30.0,  duration_minutes=30,  category="General", is_active=True),
    dict(name="Premium Package",      description="Full-day pampering experience",            price=180.0, duration_minutes=120, category="Package", is_active=True),
]

_APPT_NOTES = [
    "Client requested extra care",
    "First visit — full consultation needed",
    "Prefers extra massage pressure",
    "Allergy note: no nut-based oils",
    "Running 10 min late — client confirmed",
    "Loyalty discount applied",
    None, None, None, None,
]

_CANCEL_REASONS = [
    "Client cancelled via phone",
    "No show",
    "Employee called in sick",
    "Rescheduled for next week",
    "Client emergency",
]

_SALE_PRODUCTS = [
    dict(item_name="Argan Oil Shampoo",     unit_price=28.0),
    dict(item_name="Vitamin C Serum",       unit_price=42.0),
    dict(item_name="Exfoliating Scrub",     unit_price=18.0),
    dict(item_name="Coconut Body Lotion",   unit_price=22.0),
    dict(item_name="Bamboo Towel Set",      unit_price=35.0),
    dict(item_name="Essential Oil Blend",   unit_price=24.0),
    dict(item_name="Gel Polish Kit",        unit_price=32.0),
    dict(item_name="Collagen Face Mask",    unit_price=15.0),
    dict(item_name="Scalp Treatment Spray", unit_price=19.0),
    dict(item_name="Jade Roller",           unit_price=27.0),
]


# ─────────────────────────────────────────────────────────────────────────────
# Pay-period generators
# ─────────────────────────────────────────────────────────────────────────────

def _weekly_periods(start: date, end: date):
    """Yield complete Mon–Sun pay periods between start and end."""
    week = _monday(start)
    while week + timedelta(days=6) <= end:
        yield week, week + timedelta(days=6)
        week += timedelta(days=7)


def _biweekly_periods(start: date, end: date):
    """Yield complete 2-week Mon periods between start and end."""
    week = _monday(start)
    while week + timedelta(days=13) <= end:
        yield week, week + timedelta(days=13)
        week += timedelta(days=14)


# ─────────────────────────────────────────────────────────────────────────────
# Main seed function
# ─────────────────────────────────────────────────────────────────────────────

def seed_demo_data(session: Session) -> None:
    # ── Guard: skip if already seeded ────────────────────────────────────────
    existing_clients = session.exec(select(Client)).all()
    if len(existing_clients) >= 10:
        print("  seed_demo_data: 10+ clients found — already seeded, skipping.")
        return

    print("  seed_demo_data: starting…")

    # ── 1. AppSettings (update / create the singleton) ────────────────────────
    settings = session.get(AppSettings, SETTINGS_ID)
    if settings is None:
        settings = AppSettings(
            id=SETTINGS_ID,
            start_of_day="09:00", end_of_day="19:00",
            attendance_check_in_required=True,
            monday_enabled=True, tuesday_enabled=True, wednesday_enabled=True,
            thursday_enabled=True, friday_enabled=True, saturday_enabled=True,
            sunday_enabled=False,
            company_name="Serenity Wellness & Spa",
            company_email="hello@serenityspa.com",
            company_phone="555-800-0100",
            company_address="120 Tranquil Boulevard, Suite 4, Lakewood, CA 90712",
        )
        session.add(settings)
    else:
        settings.company_name    = "Serenity Wellness & Spa"
        settings.company_email   = "hello@serenityspa.com"
        settings.company_phone   = "555-800-0100"
        settings.company_address = "120 Tranquil Boulevard, Suite 4, Lakewood, CA 90712"
        settings.start_of_day    = "09:00"
        settings.end_of_day      = "19:00"
        settings.saturday_enabled = True
    try:
        session.commit()
        print("  ✓ AppSettings updated")
    except Exception:
        session.rollback()
        raise

    # ── 2. Insurance plans ───────────────────────────────────────────────────
    insurance_by_name: dict[str, InsurancePlan] = {}
    for p in _INSURANCE_PLANS:
        existing = session.exec(select(InsurancePlan).where(InsurancePlan.name == p["name"])).first()
        if existing:
            insurance_by_name[p["name"]] = existing
            continue
        plan = InsurancePlan(**p)
        session.add(plan)
        insurance_by_name[p["name"]] = plan
    try:
        session.commit()
        print(f"  ✓ {len(insurance_by_name)} insurance plans")
    except Exception:
        session.rollback()
        raise

    # ── 3. Employees ─────────────────────────────────────────────────────────
    pw = _hash()
    employee_objs: list[User] = []
    for e in _EMPLOYEES:
        existing = session.exec(select(User).where(User.username == e["username"])).first()
        if existing:
            # Update payroll fields on existing employee
            existing.employment_type = e["employment_type"]
            existing.salary          = e.get("salary")
            existing.hourly_rate     = e.get("hourly_rate")
            existing.pay_frequency   = e["pay_frequency"]
            existing.insurance_plan  = e["insurance_plan"]
            existing.vacation_days   = e.get("vacation_days", 10)
            existing.sick_days       = e.get("sick_days", 5)
            employee_objs.append(existing)
            continue
        emp = User(
            username        = e["username"],
            email           = e["email"],
            password_hash   = pw,
            first_name      = e["first_name"],
            last_name       = e["last_name"],
            role            = e["role"],
            color           = e["color"],
            hire_date       = e["hire_date"],
            is_active       = True,
            is_locked       = False,
            force_password_reset = False,
            failed_login_attempts = 0,
            dark_mode       = False,
            db_environment  = "production",
            employment_type = e["employment_type"],
            salary          = e.get("salary"),
            hourly_rate     = e.get("hourly_rate"),
            pay_frequency   = e["pay_frequency"],
            insurance_plan  = e["insurance_plan"],
            vacation_days   = e.get("vacation_days", 10),
            sick_days       = e.get("sick_days", 5),
            vacation_days_used = 0,
            sick_days_used     = 0,
        )
        session.add(emp)
        employee_objs.append(emp)
    try:
        session.commit()
        for emp in employee_objs:
            session.refresh(emp)
        print(f"  ✓ {len(employee_objs)} employees")
    except Exception:
        session.rollback()
        raise

    # ── 4. Clients ───────────────────────────────────────────────────────────
    client_objs: list[Client] = []
    for c in _CLIENTS:
        existing = session.exec(select(Client).where(Client.email == c["email"])).first()
        if existing:
            client_objs.append(existing)
            continue
        cl = Client(
            name              = c["name"],
            email             = c["email"],
            phone             = c["phone"],
            address           = c["address"],
            membership_tier   = c["membership_tier"],
            membership_points = c["membership_points"],
            membership_since  = TODAY - timedelta(days=random.randint(60, 900)),
        )
        session.add(cl)
        client_objs.append(cl)
    try:
        session.commit()
        for cl in client_objs:
            session.refresh(cl)
        print(f"  ✓ {len(client_objs)} clients")
    except Exception:
        session.rollback()
        raise

    # ── 5. Services ──────────────────────────────────────────────────────────
    service_objs: list[Service] = []
    for s in _SERVICES:
        existing = session.exec(select(Service).where(Service.name == s["name"])).first()
        if existing:
            service_objs.append(existing)
            continue
        svc = Service(**s)
        session.add(svc)
        service_objs.append(svc)
    try:
        session.commit()
        for svc in service_objs:
            session.refresh(svc)
        print(f"  ✓ {len(service_objs)} services")
    except Exception:
        session.rollback()
        raise

    # ── 6. Appointments ──────────────────────────────────────────────────────
    # Time slots: (hour, minute)
    TIME_SLOTS = [
        (9, 0), (10, 0), (11, 0), (12, 0),
        (13, 30), (14, 30), (15, 30), (16, 30), (17, 30),
    ]

    appt_count = 0
    # Iterate over days in the 4-month window
    current = START_DATE
    rng = random.Random(42)

    while current <= TODAY_DATE + timedelta(days=14):  # include 2 weeks ahead
        # Skip Sundays
        if current.weekday() == 6:
            current += timedelta(days=1)
            continue

        # Number of appointments for this day (2-5, with some variability)
        n_appts = rng.randint(2, 5)

        # Pick a random subset of time slots
        day_slots = rng.sample(TIME_SLOTS, min(n_appts, len(TIME_SLOTS)))

        for (h, m) in day_slots:
            emp  = rng.choice(employee_objs)
            cl   = rng.choice(client_objs)
            svc  = rng.choice(service_objs)
            note = rng.choice(_APPT_NOTES)

            appt_dt = _dt(current, h, m)

            # Determine status
            if current > TODAY_DATE:
                status = "scheduled"
            elif current == TODAY_DATE:
                status = rng.choice(["scheduled", "in_progress", "completed"])
            else:
                # Past: weighted distribution
                r = rng.random()
                if r < 0.55:
                    status = "completed"
                elif r < 0.70:
                    status = "cancelled"
                else:
                    status = "scheduled"  # some future-booked kept as scheduled

            if status == "cancelled":
                note = rng.choice(_CANCEL_REASONS)

            appt = Schedule(
                client_id         = cl.id,
                service_id        = svc.id,
                employee_id       = emp.id,
                appointment_date  = appt_dt,
                status            = status,
                notes             = note,
                appointment_type  = "one_time",
                duration_minutes  = svc.duration_minutes,
                is_recurring_master = False,
            )
            session.add(appt)

            # Attendee record for the employee
            attendee_emp = ScheduleAttendee(
                schedule_id       = appt.id,
                user_id           = emp.id,
                attendance_status = "accepted" if status != "cancelled" else "declined",
            )
            session.add(attendee_emp)

            # Attendee record for the client
            attendee_cl = ScheduleAttendee(
                schedule_id       = appt.id,
                client_id         = cl.id,
                attendance_status = "accepted" if status != "cancelled" else "declined",
            )
            session.add(attendee_cl)
            appt_count += 1

        current += timedelta(days=1)

    # ── Intentional overlapping appointments (4 cases) ──────────────────────
    # These demonstrate an employee double-booked at the same time slot
    _overlap_date = TODAY_DATE - timedelta(days=40)
    for emp_idx, cl_a_idx, cl_b_idx, hour in [
        (3, 0,  2,  10),
        (4, 5,  7,  14),
        (5, 9,  11, 11),
        (6, 13, 1,  15),
    ]:
        for cl_idx, offset_min in [(cl_a_idx, 0), (cl_b_idx, 20)]:  # 20-min overlap
            ov_svc  = service_objs[0]
            ov_dt   = _dt(_overlap_date, hour, offset_min)
            ov_appt = Schedule(
                client_id         = client_objs[cl_idx].id,
                service_id        = ov_svc.id,
                employee_id       = employee_objs[emp_idx].id,
                appointment_date  = ov_dt,
                status            = "scheduled",
                notes             = "⚠ Overlapping booking — review required",
                appointment_type  = "one_time",
                duration_minutes  = ov_svc.duration_minutes,
                is_recurring_master = False,
            )
            session.add(ov_appt)
        _overlap_date -= timedelta(days=7)

    try:
        session.commit()
        print(f"  ✓ ~{appt_count + 8} appointments (incl. 4 intentional overlaps)")
    except Exception:
        session.rollback()
        raise

    # ── 7. Sales transactions ────────────────────────────────────────────────
    TAX_RATE = 0.08
    PAYMENT_METHODS = ["card", "card", "card", "cash", "cash"]  # 60% card

    sale_count = 0
    for i in range(32):
        days_back = rng.randint(0, 120)
        sale_date = TODAY - timedelta(days=days_back)
        cl        = rng.choice(client_objs)
        emp       = rng.choice(employee_objs)
        method    = rng.choice(PAYMENT_METHODS)

        # 1–3 line items: mix of services sold as retail + retail products
        n_items   = rng.randint(1, 3)
        items     = []

        # Optionally include a service as a sold item
        if rng.random() < 0.6:
            svc = rng.choice(service_objs)
            qty = 1
            items.append(dict(
                item_type  = "service",
                item_name  = svc.name,
                unit_price = svc.price,
                quantity   = qty,
                line_total = svc.price * qty,
            ))

        # Fill the rest with retail products
        products_needed = n_items - len(items)
        for prod_data in rng.sample(_SALE_PRODUCTS, min(products_needed, len(_SALE_PRODUCTS))):
            qty = rng.randint(1, 3)
            items.append(dict(
                item_type  = "product",
                item_name  = prod_data["item_name"],
                unit_price = prod_data["unit_price"],
                quantity   = qty,
                line_total = prod_data["unit_price"] * qty,
            ))

        subtotal = sum(it["line_total"] for it in items)
        tax      = round(subtotal * TAX_RATE, 2)
        total    = round(subtotal + tax, 2)

        tx = SaleTransaction(
            client_id      = cl.id,
            employee_id    = emp.id,
            subtotal       = round(subtotal, 2),
            tax_amount     = tax,
            total          = total,
            payment_method = method,
            created_at     = sale_date,
        )
        session.add(tx)

        for it in items:
            session.add(SaleTransactionItem(
                sale_transaction_id = tx.id,
                item_type           = it["item_type"],
                item_name           = it["item_name"],
                unit_price          = it["unit_price"],
                quantity            = it["quantity"],
                line_total          = it["line_total"],
            ))
        sale_count += 1

    try:
        session.commit()
        print(f"  ✓ {sale_count} sales transactions")
    except Exception:
        session.rollback()
        raise

    # ── 8. Payslips ──────────────────────────────────────────────────────────
    # Only cover complete past periods (leave the current week unpaid).
    PAY_PERIOD_CUTOFF = TODAY_DATE - timedelta(days=1)

    # Insurance deductions indexed by plan name
    INS_DEDUCT = {p["name"]: p["monthly_deduction"] for p in _INSURANCE_PLANS}

    slip_count = 0
    for emp in employee_objs:
        if not emp.pay_frequency:
            continue

        # Skip if employee has no compensation set
        if not emp.salary and not emp.hourly_rate:
            continue

        ins_ded = INS_DEDUCT.get(emp.insurance_plan or "", 0.0)

        if emp.pay_frequency == "weekly":
            periods = list(_weekly_periods(START_DATE, PAY_PERIOD_CUTOFF))
        elif emp.pay_frequency == "biweekly":
            periods = list(_biweekly_periods(START_DATE, PAY_PERIOD_CUTOFF))
        else:
            continue

        for (ps, pe) in periods:
            # Check duplicate
            ps_dt = _dt(ps, 0, 0)
            existing_slip = session.exec(
                select(PaySlip).where(
                    PaySlip.employee_id     == emp.id,
                    PaySlip.pay_period_start == ps_dt,
                    PaySlip.status          == "paid",
                )
            ).first()
            if existing_slip:
                continue

            # Gross calculation
            if emp.employment_type == "hourly":
                hours = 40.0
                gross = round((emp.hourly_rate or 0) * hours, 2)
            else:
                if emp.pay_frequency == "weekly":
                    gross = round((emp.salary or 0) / 52, 2)
                else:
                    gross = round((emp.salary or 0) / 26, 2)

            # Small random other-deductions (401k-style) for salaried employees
            other_ded = round(gross * rng.uniform(0.02, 0.04), 2) if emp.employment_type == "salary" else 0.0

            net = round(gross - ins_ded - other_ded, 2)

            slip = PaySlip(
                employee_id         = emp.id,
                pay_period_start    = ps_dt,
                pay_period_end      = _dt(pe, 23, 59),
                gross_amount        = gross,
                insurance_deduction = ins_ded,
                other_deductions    = other_ded,
                net_amount          = net,
                employment_type     = emp.employment_type or "salary",
                hours_worked        = 40.0 if emp.employment_type == "hourly" else None,
                hourly_rate_snapshot = emp.hourly_rate if emp.employment_type == "hourly" else None,
                salary_snapshot     = emp.salary,
                pay_frequency       = emp.pay_frequency,
                status              = "paid",
                insurance_plan_name = emp.insurance_plan,
                created_at          = _dt(pe + timedelta(days=1), 9, 0),
            )
            session.add(slip)
            slip_count += 1

    try:
        session.commit()
        print(f"  ✓ {slip_count} payslips")
    except Exception:
        session.rollback()
        raise

    print("  seed_demo_data: complete ✓")


# ─────────────────────────────────────────────────────────────────────────────
# Standalone entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Creating / verifying database tables…")
    create_db_and_tables()
    print("Running seed…")
    session = next(get_session())
    try:
        seed_demo_data(session)
    finally:
        session.close()
    print("Done.")
