#!/usr/bin/env python3
"""
Seed future schedule data for a specific company.

Creates a realistic forward-looking schedule window with service bookings,
recurring series, meetings, and operational tasks. Intended for reseeding the
calendar horizon for a company that already has users, clients, and services.

Usage:
    python backend/seed_future_schedule.py --company-id 03897 --replace-existing-future
"""

import argparse
import os
import random
import sys
from calendar import monthrange
from datetime import date, datetime, time, timedelta

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.dirname(_HERE))

from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import Client, Schedule, ScheduleAttendee, Service, User
except ImportError:
    from database import get_session
    from models import Client, Schedule, ScheduleAttendee, Service, User


BOOKING_SLOTS = [
    (9, 0),
    (10, 0),
    (11, 0),
    (12, 0),
    (13, 30),
    (14, 30),
    (15, 30),
    (16, 30),
    (17, 30),
]

BOOKING_NOTES = [
    "Online booking confirmation",
    "Phone booking",
    "Membership follow-up visit",
    "Requested preferred therapist",
    "Loyalty client rebooking",
    "Client requested product recommendations",
    "New client consultation",
    "Returning client with treatment notes on file",
    None,
    None,
]

SERIES_NOTES = [
    "Weekly wellness maintenance session",
    "Biweekly recovery treatment block",
    "Standing premium member appointment",
]

TASK_NOTES = [
    "Retail floor inventory audit and restock check",
    "Treatment room deep clean and consumables reset",
    "Weekly rota build and staffing review",
    "Supplier reorder review and stock variance follow-up",
    "Promotions setup and front-desk prep",
    "Equipment maintenance check and room readiness review",
]

MEETING_NOTES = [
    "Weekly all-hands schedule review and client updates",
    "Leadership operations review",
    "Monthly service quality and revenue review",
]


def add_months(source_date: date, months: int) -> date:
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def combine_date_time(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour=hour, minute=minute))


def next_weekday(start_day: date, weekday: int) -> date:
    delta = (weekday - start_day.weekday()) % 7
    return start_day + timedelta(days=delta)


def iterate_occurrences(start_day: date, end_day: date, step_days: int):
    current = start_day
    while current <= end_day:
        yield current
        current += timedelta(days=step_days)


def add_attendees(session: Session, schedule_id, company_id: str, user_id=None, client_id=None, accepted: bool = True):
    if user_id:
        session.add(
            ScheduleAttendee(
                schedule_id=schedule_id,
                user_id=user_id,
                attendance_status="accepted" if accepted else "declined",
                company_id=company_id,
            )
        )
    if client_id:
        session.add(
            ScheduleAttendee(
                schedule_id=schedule_id,
                client_id=client_id,
                attendance_status="accepted" if accepted else "declined",
                company_id=company_id,
            )
        )


def clear_future_window(session: Session, company_id: str, window_start: datetime, window_end: datetime) -> int:
    schedules = session.exec(
        select(Schedule).where(
            Schedule.company_id == company_id,
            Schedule.appointment_date >= window_start,
            Schedule.appointment_date <= window_end,
        )
    ).all()

    removed = 0
    for schedule in schedules:
        attendees = session.exec(
            select(ScheduleAttendee).where(ScheduleAttendee.schedule_id == schedule.id)
        ).all()
        for attendee in attendees:
            session.delete(attendee)
        session.delete(schedule)
        removed += 1

    if removed:
        session.commit()
    return removed


def seed_one_time_bookings(session: Session, company_id: str, start_day: date, end_day: date, users, clients, services, rng: random.Random) -> int:
    count = 0
    active_users = [user for user in users if user.is_active]
    if not active_users or not clients or not services:
        return 0

    current = start_day
    while current <= end_day:
        if current.weekday() == 6:
            current += timedelta(days=1)
            continue

        daily_count = rng.randint(3, 6) if current.weekday() < 5 else rng.randint(2, 4)
        chosen_slots = sorted(rng.sample(BOOKING_SLOTS, min(daily_count, len(BOOKING_SLOTS))))

        for hour, minute in chosen_slots:
            employee = rng.choice(active_users)
            client = rng.choice(clients)
            service = rng.choice(services)
            appointment = Schedule(
                client_id=client.id,
                service_id=service.id,
                employee_id=employee.id,
                appointment_date=combine_date_time(current, hour, minute),
                status="scheduled",
                notes=rng.choice(BOOKING_NOTES),
                appointment_type="one_time",
                duration_minutes=service.duration_minutes,
                is_recurring_master=False,
                task_type="service",
                company_id=company_id,
            )
            session.add(appointment)
            session.flush()
            add_attendees(session, appointment.id, company_id, user_id=employee.id, client_id=client.id)
            count += 1

        current += timedelta(days=1)

    return count


def seed_recurring_series(session: Session, company_id: str, start_day: date, end_day: date, users, clients, services) -> int:
    employee_pool = [user for user in users if user.is_active]
    if len(employee_pool) < 3 or len(clients) < 3 or len(services) < 3:
        return 0

    specs = [
        (clients[0], services[0], employee_pool[0], 0, 10, 0, 7, SERIES_NOTES[0]),
        (clients[1], services[1], employee_pool[1], 2, 14, 0, 14, SERIES_NOTES[1]),
        (clients[2], services[2], employee_pool[2], 4, 11, 0, 7, SERIES_NOTES[2]),
    ]

    count = 0
    for client, service, employee, weekday, hour, minute, step_days, note in specs:
        first_day = next_weekday(start_day, weekday)
        master = Schedule(
            client_id=client.id,
            service_id=service.id,
            employee_id=employee.id,
            appointment_date=combine_date_time(first_day, hour, minute),
            status="scheduled",
            notes=note,
            appointment_type="series",
            duration_minutes=service.duration_minutes,
            recurrence_frequency="weekly" if step_days == 7 else "biweekly",
            recurrence_end_date=combine_date_time(end_day, 23, 59),
            is_recurring_master=True,
            task_type="service",
            company_id=company_id,
        )
        session.add(master)
        session.flush()
        add_attendees(session, master.id, company_id, user_id=employee.id, client_id=client.id)
        count += 1

        for occurrence_day in list(iterate_occurrences(first_day, end_day, step_days))[1:]:
            child = Schedule(
                client_id=client.id,
                service_id=service.id,
                employee_id=employee.id,
                appointment_date=combine_date_time(occurrence_day, hour, minute),
                status="scheduled",
                notes=note,
                appointment_type="series",
                duration_minutes=service.duration_minutes,
                parent_schedule_id=master.id,
                is_recurring_master=False,
                task_type="service",
                company_id=company_id,
            )
            session.add(child)
            session.flush()
            add_attendees(session, child.id, company_id, user_id=employee.id, client_id=client.id)
            count += 1

    return count


def seed_meetings(session: Session, company_id: str, start_day: date, end_day: date, users) -> int:
    active_users = [user for user in users if user.is_active]
    if not active_users:
        return 0

    host = active_users[0]
    count = 0

    first_monday = next_weekday(start_day, 0)
    for meeting_day in iterate_occurrences(first_monday, end_day, 7):
        meeting = Schedule(
            employee_id=host.id,
            appointment_date=combine_date_time(meeting_day, 8, 30),
            status="scheduled",
            notes=MEETING_NOTES[0],
            appointment_type="meeting",
            duration_minutes=45,
            is_recurring_master=False,
            task_type="service",
            company_id=company_id,
        )
        session.add(meeting)
        session.flush()
        for user in active_users:
            add_attendees(session, meeting.id, company_id, user_id=user.id)
        count += 1

    cursor = date(start_day.year, start_day.month, 1)
    while cursor <= end_day:
        review_day = next_weekday(cursor, 2)
        if start_day <= review_day <= end_day:
            meeting = Schedule(
                employee_id=host.id,
                appointment_date=combine_date_time(review_day, 15, 0),
                status="scheduled",
                notes=MEETING_NOTES[2],
                appointment_type="meeting",
                duration_minutes=60,
                is_recurring_master=False,
                task_type="service",
                company_id=company_id,
            )
            session.add(meeting)
            session.flush()
            for user in active_users[: min(6, len(active_users))]:
                add_attendees(session, meeting.id, company_id, user_id=user.id)
            count += 1

        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)

    return count


def seed_operational_tasks(session: Session, company_id: str, start_day: date, end_day: date, users, rng: random.Random) -> int:
    active_users = [user for user in users if user.is_active]
    if not active_users:
        return 0

    count = 0
    current = start_day
    while current <= end_day:
        if current.weekday() in {1, 4}:
            assignee = active_users[(count + current.day) % len(active_users)]
            note = TASK_NOTES[count % len(TASK_NOTES)]
            task = Schedule(
                employee_id=assignee.id,
                appointment_date=combine_date_time(current, 8, 0),
                status="scheduled",
                notes=note,
                appointment_type="task",
                duration_minutes=90 if current.weekday() == 1 else 60,
                is_recurring_master=False,
                task_type="production" if rng.random() < 0.35 else "service",
                production_quantity=2 if rng.random() < 0.35 else 1,
                company_id=company_id,
            )
            session.add(task)
            session.flush()
            add_attendees(session, task.id, company_id, user_id=assignee.id)
            count += 1
        current += timedelta(days=1)

    return count


def seed_future_schedule(session: Session, company_id: str, months: int, replace_existing_future: bool) -> dict:
    users = session.exec(select(User).where(User.company_id == company_id)).all()
    clients = session.exec(select(Client).where(Client.company_id == company_id)).all()
    services = session.exec(select(Service).where(Service.company_id == company_id)).all()

    if not users:
        raise ValueError(f"No users found for company {company_id}")
    if not clients:
        raise ValueError(f"No clients found for company {company_id}")
    if not services:
        raise ValueError(f"No services found for company {company_id}")

    start_day = datetime.now().date()
    end_day = add_months(start_day, months)
    window_start = combine_date_time(start_day, 0, 0)
    window_end = combine_date_time(end_day, 23, 59)

    removed = 0
    if replace_existing_future:
        removed = clear_future_window(session, company_id, window_start, window_end)

    rng = random.Random(f"future-schedule:{company_id}:{start_day.isoformat()}:{months}")
    counts = {
        "removed": removed,
        "one_time": seed_one_time_bookings(session, company_id, start_day, end_day, users, clients, services, rng),
        "series": seed_recurring_series(session, company_id, start_day, end_day, users, clients, services),
        "meetings": seed_meetings(session, company_id, start_day, end_day, users),
        "tasks": seed_operational_tasks(session, company_id, start_day, end_day, users, rng),
    }
    session.commit()
    counts["total_created"] = counts["one_time"] + counts["series"] + counts["meetings"] + counts["tasks"]
    counts["window_start"] = window_start.isoformat()
    counts["window_end"] = window_end.isoformat()
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed future schedule data for a company")
    parser.add_argument("--company-id", required=True, help="Target company_id, for example 03897")
    parser.add_argument("--months", type=int, default=4, help="How many months ahead to seed")
    parser.add_argument(
        "--replace-existing-future",
        action="store_true",
        help="Delete existing future schedules in the same window before reseeding",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    session = next(get_session())
    try:
        result = seed_future_schedule(
            session=session,
            company_id=args.company_id,
            months=args.months,
            replace_existing_future=args.replace_existing_future,
        )
        print(f"Seeded future schedule data for company {args.company_id}")
        print(result)
    except Exception as exc:
        session.rollback()
        print(f"Failed to seed future schedule data: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()