"""Seed display data for active non-admin employees in company 75597.

The script is additive and idempotent. It fills missing leave/insurance values,
adds denied read-permission examples without granting access, and creates a
sample schedule or attendance row only when an employee has no records of
that kind. It defaults to a dry run; pass --apply to commit changes.
"""

from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta
from pathlib import Path
import sys

from sqlalchemy import text
from sqlmodel import Session, select

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from backend.models import (  # noqa: E402
    Attendance,
    InsurancePlan,
    PermissionType,
    Schedule,
    User,
    UserPermission,
    UserRole,
)

DEFAULT_COMPANY_ID = "75597"
SEED_TAG = "employee-display-data-v1"
PERMISSION_EXAMPLES = (("schedule", PermissionType.READ), ("documents", PermissionType.READ))


def seed_employee_display_data(session: Session, company_id: str) -> dict[str, int]:
    """Fill missing employee display data and return per-category insert counts."""
    users = session.exec(
        select(User)
        .where(
            User.company_id == company_id,
            User.is_active.is_(True),
            User.role != UserRole.ADMIN,
        )
        .order_by(User.username)
    ).all()
    if not users:
        raise RuntimeError(f"No active non-admin employees found for company {company_id}.")

    plans = session.exec(
        select(InsurancePlan)
        .where(InsurancePlan.company_id == company_id, InsurancePlan.is_active.is_(True))
        .order_by(InsurancePlan.name)
    ).all()

    counts = {
        "employees": len(users),
        "benefits_updated": 0,
        "insurance_plans_added": 0,
        "permissions_added": 0,
        "schedules_added": 0,
        "attendance_added": 0,
    }
    if not plans:
        sample_plan = InsurancePlan(
            name="Employee Display Test Plan",
            description="Sample plan for employee benefits display testing.",
            is_active=True,
            monthly_deduction=0.0,
            company_id=company_id,
        )
        session.add(sample_plan)
        plans = [sample_plan]
        counts["insurance_plans_added"] = 1

    for index, user in enumerate(users):
        changed = False
        if user.vacation_days is None:
            user.vacation_days = 12 + index % 9
            if not user.vacation_days_used:
                user.vacation_days_used = 1 + index % 5
            changed = True
        elif user.vacation_days_used is None:
            user.vacation_days_used = 0
            changed = True

        if user.sick_days is None:
            user.sick_days = 8 + index % 5
            if not user.sick_days_used:
                user.sick_days_used = index % 3
            changed = True
        elif user.sick_days_used is None:
            user.sick_days_used = 0
            changed = True

        if not user.insurance_plan and plans:
            user.insurance_plan = plans[index % len(plans)].name
            changed = True

        if changed:
            session.add(user)
            counts["benefits_updated"] += 1

    permission_table = UserPermission.__table__.name
    existing_permission_rows = session.execute(
        text(
            f'SELECT user_id::text, page, lower(permission::text) '
            f'FROM "{permission_table}" WHERE company_id = :company_id'
        ),
        {"company_id": company_id},
    ).all()
    existing_permissions = {
        (str(user_id), page, str(permission).lower())
        for user_id, page, permission in existing_permission_rows
    }
    for user in users:
        for page, permission in PERMISSION_EXAMPLES:
            key = (str(user.id), page, permission.value)
            if key in existing_permissions:
                continue
            session.add(
                UserPermission(
                    user_id=user.id,
                    page=page,
                    permission=permission,
                    granted=False,
                    company_id=company_id,
                )
            )
            existing_permissions.add(key)
            counts["permissions_added"] += 1

    now = datetime.utcnow().replace(microsecond=0)
    schedule_user_ids = set(
        session.exec(
            select(Schedule.employee_id).where(Schedule.company_id == company_id)
        ).all()
    )
    attendance_user_ids = set(
        session.exec(
            select(Attendance.user_id).where(Attendance.company_id == company_id)
        ).all()
    )

    for index, user in enumerate(users):
        sample_day = now.date() - timedelta(days=7 + index % 14)
        sample_start = datetime.combine(sample_day, time(hour=9))

        if user.id not in schedule_user_ids:
            session.add(
                Schedule(
                    company_id=company_id,
                    employee_id=user.id,
                    appointment_date=sample_start,
                    status="completed",
                    appointment_type="one_time",
                    duration_minutes=60,
                    notes=f"{SEED_TAG}: sample completed appointment",
                )
            )
            counts["schedules_added"] += 1

        if user.id not in attendance_user_ids:
            clock_out = sample_start + timedelta(hours=8)
            session.add(
                Attendance(
                    company_id=company_id,
                    user_id=user.id,
                    date=sample_start,
                    clock_in=sample_start,
                    clock_out=clock_out,
                    total_hours=8.0,
                    notes=f"{SEED_TAG}: sample work shift",
                )
            )
            counts["attendance_added"] += 1

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--company-id", default=DEFAULT_COMPANY_ID)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the seed data. Without this flag, the script only reports a dry run.",
    )
    args = parser.parse_args()

    from backend.database import engine

    with Session(engine) as session:
        counts = seed_employee_display_data(session, str(args.company_id))
        if args.apply:
            session.commit()
        else:
            session.rollback()

    print(f"Company {args.company_id}: {counts['employees']} active non-admin employees checked.")
    for key in (
        "benefits_updated",
        "insurance_plans_added",
        "permissions_added",
        "schedules_added",
        "attendance_added",
    ):
        print(f"{key.replace('_', ' ').capitalize()}: {counts[key]}")
    print("Changes committed." if args.apply else "Dry run only; no changes committed. Use --apply to save.")


if __name__ == "__main__":
    main()
