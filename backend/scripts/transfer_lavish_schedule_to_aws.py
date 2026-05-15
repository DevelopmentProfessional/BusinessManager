from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path

import psycopg


SOURCE_DSN = (
    "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3"
    "@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db"
    "?sslmode=require"
)
DEFAULT_DEST_HOST = "database-1-instance-1.ckz8auiccetx.us-east-1.rds.amazonaws.com"
DEFAULT_DEST_DB = "postgres"
DEFAULT_DEST_USER = "postgres"
DEFAULT_SSLROOTCERT = "global-bundle.pem"
DEFAULT_COMPANY_ID = "03200"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transfer Lavish schedule rows to AWS RDS, schedule table only.")
    parser.add_argument("--dest-host", default=DEFAULT_DEST_HOST)
    parser.add_argument("--dest-db", default=DEFAULT_DEST_DB)
    parser.add_argument("--dest-user", default=DEFAULT_DEST_USER)
    parser.add_argument("--dest-password-env", default="TARGET_RDS_PASSWORD")
    parser.add_argument("--dest-sslrootcert", default=DEFAULT_SSLROOTCERT)
    parser.add_argument("--company-id", default=DEFAULT_COMPANY_ID)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def build_dest_conninfo(args: argparse.Namespace) -> str:
    password = os.environ.get(args.dest_password_env)
    if not password:
        password = getpass.getpass(f"AWS RDS password for {args.dest_user}@{args.dest_host}: ")
    return (
        f"host={args.dest_host} port=5432 dbname={args.dest_db} user={args.dest_user} "
        f"password={password} sslmode=verify-full sslrootcert={args.dest_sslrootcert}"
    )


def fetch_source_schedule_payload(src_conn: psycopg.Connection):
    with src_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, created_at, updated_at, client_id, service_id, employee_id,
                   appointment_date, status, notes
            FROM public.schedule
            ORDER BY created_at, id
            """
        )
        schedules = cur.fetchall()
    return schedules


def fetch_distinct_fk_ids(schedules: list[tuple]) -> tuple[list[str], list[str], list[str]]:
    client_ids = sorted({str(row[3]) for row in schedules if row[3] is not None})
    service_ids = sorted({str(row[4]) for row in schedules if row[4] is not None})
    employee_ids = sorted({str(row[5]) for row in schedules if row[5] is not None})
    return client_ids, service_ids, employee_ids


def assert_fk_ids_exist(dst_conn: psycopg.Connection, table_name: str, ids: list[str]) -> None:
    if not ids:
        return
    with dst_conn.cursor() as cur:
        cur.execute(f'SELECT id::text FROM public."{table_name}" WHERE id::text = ANY(%s)', (ids,))
        found_ids = {row[0] for row in cur.fetchall()}
    missing = [value for value in ids if value not in found_ids]
    if missing:
        raise RuntimeError(
            f"AWS target is missing {len(missing)} referenced {table_name} ids. "
            f"Example missing ids: {missing[:10]}"
        )


def upsert_schedule_rows(dst_conn: psycopg.Connection, company_id: str, schedules: list[tuple]) -> int:
    rows = [(*row, company_id) for row in schedules]
    with dst_conn.cursor() as cur:
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


def get_schedule_count(dst_conn: psycopg.Connection, company_id: str) -> int:
    with dst_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM public.schedule WHERE company_id = %s", (company_id,))
        return int(cur.fetchone()[0])


def main() -> None:
    args = parse_args()
    dest_conninfo = build_dest_conninfo(args)

    with psycopg.connect(SOURCE_DSN) as src_conn, psycopg.connect(dest_conninfo) as dst_conn:
        schedules = fetch_source_schedule_payload(src_conn)
        client_ids, service_ids, employee_ids = fetch_distinct_fk_ids(schedules)

        assert_fk_ids_exist(dst_conn, "client", client_ids)
        assert_fk_ids_exist(dst_conn, "service", service_ids)
        assert_fk_ids_exist(dst_conn, "user", employee_ids)

        before_count = get_schedule_count(dst_conn, args.company_id)
        affected = upsert_schedule_rows(dst_conn, args.company_id, schedules)
        after_count = get_schedule_count(dst_conn, args.company_id)

        if args.dry_run:
            dst_conn.rollback()
            print("Dry run complete. Rolled back AWS transaction.")
        else:
            dst_conn.commit()
            print("AWS schedule transfer committed.")

    print(f"company_id={args.company_id}")
    print(f"schedule_rows_processed={affected}")
    print(f"schedule_count_before={before_count}")
    print(f"schedule_count_after={after_count}")


if __name__ == "__main__":
    main()