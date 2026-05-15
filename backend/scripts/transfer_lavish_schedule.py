from __future__ import annotations

import argparse
import getpass
import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

import bcrypt
import psycopg


SOURCE_DSN = (
    "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3"
    "@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db"
    "?sslmode=require"
)
DEFAULT_DEST_HOST = "database-1-instance-1.ckz8auiccetx.us-east-1.rds.amazonaws.com"
DEFAULT_DEST_DB = "postgres"
DEFAULT_DEST_USER = "postgres"
DEFAULT_COMPANY_ID = "03200"
DEFAULT_COMPANY_NAME = "Lavish Beauty"


@dataclass
class LegacyEmployee:
    id: str
    created_at: datetime
    updated_at: datetime | None
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    role: str | None
    hire_date: datetime | None
    is_active: bool
    linked_username: str | None
    linked_password_hash: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transfer Lavish Beauty schedule data into the target database.")
    parser.add_argument("--dest-host", default=DEFAULT_DEST_HOST)
    parser.add_argument("--dest-db", default=DEFAULT_DEST_DB)
    parser.add_argument("--dest-user", default=DEFAULT_DEST_USER)
    parser.add_argument("--dest-password-env", default="TARGET_RDS_PASSWORD")
    parser.add_argument("--dest-sslrootcert", default="global-bundle.pem")
    parser.add_argument("--company-id", default=DEFAULT_COMPANY_ID)
    parser.add_argument("--company-name", default=DEFAULT_COMPANY_NAME)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def build_dest_dsn(args: argparse.Namespace) -> str:
    password = os.environ.get(args.dest_password_env)
    if not password:
        password = getpass.getpass(f"Destination password for {args.dest_user}@{args.dest_host}: ")

    return (
        f"host={args.dest_host} port=5432 dbname={args.dest_db} user={args.dest_user} "
        f"password={password} sslmode=verify-full sslrootcert={args.dest_sslrootcert}"
    )


def slugify_username(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", value.lower())
    return slug or "employee"


def map_role(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized == "admin":
        return "ADMIN"
    if normalized in {"manager", "supervisor"}:
        return "MANAGER"
    return "EMPLOYEE"


def hash_placeholder_password() -> str:
    raw = secrets.token_urlsafe(24).encode("utf-8")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def fetch_source_rows(src: psycopg.Connection) -> tuple[list[LegacyEmployee], list[tuple], list[tuple], list[tuple]]:
    with src.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT employee_id::text FROM public.schedule WHERE employee_id IS NOT NULL ORDER BY employee_id::text"
        )
        employee_ids = [row[0] for row in cur.fetchall()]

        cur.execute(
            "SELECT DISTINCT client_id::text FROM public.schedule WHERE client_id IS NOT NULL ORDER BY client_id::text"
        )
        client_ids = [row[0] for row in cur.fetchall()]

        cur.execute(
            "SELECT DISTINCT service_id::text FROM public.schedule WHERE service_id IS NOT NULL ORDER BY service_id::text"
        )
        service_ids = [row[0] for row in cur.fetchall()]

        cur.execute(
            """
            SELECT
                e.id::text,
                e.created_at,
                e.updated_at,
                e.first_name,
                e.last_name,
                e.email,
                e.phone,
                e.role,
                e.hire_date,
                e.is_active,
                u.username,
                u.password_hash
            FROM public.employee e
            LEFT JOIN public."user" u ON u.id = e.user_id
            WHERE e.id::text = ANY(%s)
            ORDER BY e.created_at, e.id
            """,
            (employee_ids,),
        )
        employees = [LegacyEmployee(*row) for row in cur.fetchall()]

        cur.execute(
            """
            SELECT id, created_at, updated_at, name, email, phone, address, notes
            FROM public.client
            WHERE id::text = ANY(%s)
            ORDER BY created_at, id
            """,
            (client_ids,),
        )
        clients = cur.fetchall()

        cur.execute(
            """
            SELECT id, created_at, updated_at, name, description, category, price, duration_minutes
            FROM public.service
            WHERE id::text = ANY(%s)
            ORDER BY created_at, id
            """,
            (service_ids,),
        )
        services = cur.fetchall()

        cur.execute(
            """
            SELECT
                id,
                created_at,
                updated_at,
                client_id,
                service_id,
                employee_id,
                appointment_date,
                status,
                notes
            FROM public.schedule
            ORDER BY created_at, id
            """
        )
        schedules = cur.fetchall()

    if len(employees) != len(employee_ids):
        found = {employee.id for employee in employees}
        missing = sorted(set(employee_ids) - found)
        raise RuntimeError(f"Missing source employee rows for schedule references: {missing}")
    if len(clients) != len(client_ids):
        found = {str(row[0]) for row in clients}
        missing = sorted(set(client_ids) - found)
        raise RuntimeError(f"Missing source client rows for schedule references: {missing[:10]}")
    if len(services) != len(service_ids):
        found = {str(row[0]) for row in services}
        missing = sorted(set(service_ids) - found)
        raise RuntimeError(f"Missing source service rows for schedule references: {missing[:10]}")

    return employees, clients, services, schedules


def get_existing_company(dst: psycopg.Connection, company_id: str) -> tuple[str, str] | None:
    with dst.cursor() as cur:
        cur.execute(
            "SELECT company_id, name FROM public.company WHERE company_id = %s",
            (company_id,),
        )
        return cur.fetchone()


def get_taken_usernames(dst: psycopg.Connection, company_id: str) -> set[str]:
    with dst.cursor() as cur:
        cur.execute('SELECT username FROM public."user" WHERE company_id = %s', (company_id,))
        return {row[0] for row in cur.fetchall() if row[0]}


def get_taken_emails(dst: psycopg.Connection) -> set[str]:
    with dst.cursor() as cur:
        cur.execute('SELECT email FROM public."user" WHERE email IS NOT NULL')
        return {row[0].strip().lower() for row in cur.fetchall() if row[0]}


def unique_username(base: str, taken: set[str]) -> str:
    candidate = base
    counter = 2
    while candidate in taken:
        candidate = f"{base}{counter}"
        counter += 1
    taken.add(candidate)
    return candidate


def ensure_company(dst: psycopg.Connection, company_id: str, company_name: str) -> None:
    with dst.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.company (company_id, name, is_active)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (company_id)
            DO UPDATE SET name = EXCLUDED.name, is_active = TRUE
            """,
            (company_id, company_name),
        )


def upsert_users(dst: psycopg.Connection, company_id: str, employees: Iterable[LegacyEmployee]) -> int:
    taken_usernames = get_taken_usernames(dst, company_id)
    taken_emails = get_taken_emails(dst)
    rows = []
    for employee in employees:
        username_seed = employee.linked_username or f"{employee.first_name}.{employee.last_name}"
        username = unique_username(slugify_username(username_seed), taken_usernames)

        email = (employee.email or "").strip().lower() or None
        if email and email in taken_emails:
            email = None
        if email:
            taken_emails.add(email)

        password_hash = employee.linked_password_hash or hash_placeholder_password()
        rows.append(
            (
                employee.id,
                employee.created_at,
                employee.updated_at,
                username,
                email,
                password_hash,
                employee.first_name,
                employee.last_name,
                employee.phone,
                map_role(employee.role),
                employee.hire_date or employee.created_at,
                employee.is_active,
                company_id,
            )
        )

    with dst.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public."user" (
                id, created_at, updated_at, username, email, password_hash,
                first_name, last_name, phone, role, hire_date, is_active,
                is_locked, force_password_reset, failed_login_attempts,
                dark_mode, company_id
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                FALSE, TRUE, 0,
                FALSE, %s
            )
            ON CONFLICT (id)
            DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                phone = EXCLUDED.phone,
                is_active = EXCLUDED.is_active,
                company_id = EXCLUDED.company_id
            """,
            rows,
        )
    return len(rows)


def upsert_clients(dst: psycopg.Connection, company_id: str, clients: Iterable[tuple]) -> int:
    rows = [(*row, company_id) for row in clients]
    with dst.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.client (
                id, created_at, updated_at, name, email, phone, address, notes,
                membership_tier, membership_points, company_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'none', 0, %s)
            ON CONFLICT (id)
            DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                notes = EXCLUDED.notes,
                company_id = EXCLUDED.company_id
            """,
            rows,
        )
    return len(rows)


def upsert_services(dst: psycopg.Connection, company_id: str, services: Iterable[tuple]) -> int:
    rows = [(*row, company_id) for row in services]
    with dst.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.service (
                id, created_at, updated_at, name, description, category, price,
                duration_minutes, company_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id)
            DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                price = EXCLUDED.price,
                duration_minutes = EXCLUDED.duration_minutes,
                company_id = EXCLUDED.company_id
            """,
            rows,
        )
    return len(rows)


def upsert_schedules(dst: psycopg.Connection, company_id: str, schedules: Iterable[tuple]) -> int:
    rows = [(*row, company_id) for row in schedules]
    with dst.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.schedule (
                id, created_at, updated_at, client_id, service_id, employee_id,
                appointment_date, status, notes,
                appointment_type, duration_minutes,
                recurrence_frequency, recurrence_end_date, recurrence_count,
                parent_schedule_id, is_recurring_master,
                is_paid, discount, sale_transaction_id,
                task_type, production_item_id, production_quantity,
                company_id
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                'one_time', 60,
                NULL, NULL, NULL,
                NULL, FALSE,
                FALSE, 0, NULL,
                'service', NULL, 1,
                %s
            )
            ON CONFLICT (id)
            DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                client_id = EXCLUDED.client_id,
                service_id = EXCLUDED.service_id,
                employee_id = EXCLUDED.employee_id,
                appointment_date = EXCLUDED.appointment_date,
                status = EXCLUDED.status,
                notes = EXCLUDED.notes,
                company_id = EXCLUDED.company_id
            """,
            rows,
        )
    return len(rows)


def main() -> None:
    args = parse_args()
    dest_dsn = build_dest_dsn(args)

    with psycopg.connect(SOURCE_DSN) as src, psycopg.connect(dest_dsn) as dst:
        employees, clients, services, schedules = fetch_source_rows(src)

        ensure_company(dst, args.company_id, args.company_name)
        company = get_existing_company(dst, args.company_id)
        if not company:
            raise RuntimeError(f"Destination company {args.company_id} was not created or found")

        user_count = upsert_users(dst, args.company_id, employees)
        client_count = upsert_clients(dst, args.company_id, clients)
        service_count = upsert_services(dst, args.company_id, services)
        schedule_count = upsert_schedules(dst, args.company_id, schedules)

        if args.dry_run:
            dst.rollback()
            print("Dry run complete. Rolled back destination transaction.")
        else:
            dst.commit()
            print("Transfer committed.")

    print(f"Employees upserted: {user_count}")
    print(f"Clients upserted: {client_count}")
    print(f"Services upserted: {service_count}")
    print(f"Schedules upserted: {schedule_count}")


if __name__ == "__main__":
    main()