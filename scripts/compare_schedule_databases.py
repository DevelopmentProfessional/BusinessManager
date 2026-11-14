#!/usr/bin/env python3.11
"""
Compare schedule (appointment) structure between:
  - Render source DB (MIGRATION_OLD_DATABASE_URL)
  - EC2/local target DB (DATABASE_URL or MIGRATION_NEW_DATABASE_URL)

Also splits EC2 rows at a cutoff date (default 2026-05-22) to compare
legacy migrated Render-style rows vs rows created natively on EC2.

Usage on EC2:
  cd /opt/businessmanager
  set -a && source backend/.env && set +a
  export MIGRATION_OLD_DATABASE_URL='postgresql://...@....render.com/lavish_beauty_db?sslmode=require'
  python3.11 scripts/compare_schedule_databases.py

Optional:
  export MIGRATION_CUTOFF_DATE='2026-05-22'
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row

CUTOFF = os.getenv("MIGRATION_CUTOFF_DATE", "2026-05-22").strip()
OLD_DB = os.getenv("MIGRATION_OLD_DATABASE_URL", "").strip()
NEW_DB = (
    os.getenv("MIGRATION_NEW_DATABASE_URL", "").strip()
    or os.getenv("DATABASE_URL", "").strip()
).replace("postgres://", "postgresql://")

SCHEDULE_FIELDS_OF_INTEREST = [
    "id",
    "created_at",
    "updated_at",
    "client_id",
    "service_id",
    "employee_id",
    "appointment_date",
    "status",
    "notes",
    "appointment_type",
    "duration_minutes",
    "recurrence_frequency",
    "recurrence_end_date",
    "recurrence_count",
    "parent_schedule_id",
    "is_recurring_master",
    "is_paid",
    "send_reminder",
    "discount",
    "sale_transaction_id",
    "task_type",
    "production_item_id",
    "production_quantity",
    "company_id",
]


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("postgresql+psycopg://"):
        return "postgresql://" + url[len("postgresql+psycopg://") :]
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def redact_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or "(unknown)"
    db = (parsed.path or "").lstrip("/") or "(default)"
    user = parsed.username or "(unknown)"
    return f"{user}@{host}/{db}"


def get_columns(conn, table: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return [dict(row) for row in cur.fetchall()]


def column_names(cols: list[dict]) -> set[str]:
    return {c["column_name"] for c in cols}


def count_rows(conn, table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) AS n FROM "{table}"')
        return int(cur.fetchone()["n"])


def schedule_stats(conn, where_sql: str = "", params: tuple = ()) -> dict:
    sql_base = f"FROM schedule {where_sql}"
    stats: dict = {}

    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS n {sql_base}", params)
        stats["row_count"] = int(cur.fetchone()["n"])

        if stats["row_count"] == 0:
            return stats

        cur.execute(
            f"SELECT MIN(appointment_date) AS min_dt, MAX(appointment_date) AS max_dt {sql_base}",
            params,
        )
        row = cur.fetchone()
        stats["appointment_date_min"] = str(row["min_dt"])
        stats["appointment_date_max"] = str(row["max_dt"])

        for field in SCHEDULE_FIELDS_OF_INTEREST:
            if field in ("id", "created_at", "updated_at", "appointment_date"):
                continue
            try:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(*) FILTER (WHERE "{field}" IS NULL) AS nulls,
                        COUNT(*) FILTER (WHERE "{field}" IS NOT NULL) AS non_nulls
                    {sql_base}
                    """,
                    params,
                )
                r = cur.fetchone()
                stats[f"{field}__null"] = int(r["nulls"])
                stats[f"{field}__non_null"] = int(r["non_nulls"])
            except Exception as exc:
                stats[f"{field}__error"] = str(exc)

        for field in ("status", "appointment_type", "task_type", "company_id"):
            try:
                cur.execute(
                    f"""
                    SELECT COALESCE(CAST("{field}" AS TEXT), '(null)') AS val, COUNT(*) AS n
                    {sql_base}
                    GROUP BY 1
                    ORDER BY n DESC
                    LIMIT 12
                    """,
                    params,
                )
                stats[f"{field}__values"] = {row["val"]: int(row["n"]) for row in cur.fetchall()}
            except Exception as exc:
                stats[f"{field}__values_error"] = str(exc)

        cur.execute(
            f"""
            SELECT
                ROUND(AVG(duration_minutes)::numeric, 1) AS avg_duration,
                MIN(duration_minutes) AS min_duration,
                MAX(duration_minutes) AS max_duration
            {sql_base}
            """,
            params,
        )
        stats["duration_minutes__summary"] = dict(cur.fetchone())

    return stats


def sample_rows(conn, where_sql: str, params: tuple, limit: int = 3) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT *
            FROM schedule
            {where_sql}
            ORDER BY appointment_date DESC
            LIMIT %s
            """,
            (*params, limit),
        )
        rows = cur.fetchall()

    samples = []
    for row in rows:
        item = {}
        for key in SCHEDULE_FIELDS_OF_INTEREST:
            if key in row:
                val = row[key]
                item[key] = val.isoformat() if hasattr(val, "isoformat") else val
        samples.append(item)
    return samples


def print_section(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def compare_columns(old_cols: list[dict], new_cols: list[dict]) -> None:
    old_names = column_names(old_cols)
    new_names = column_names(new_cols)

    only_old = sorted(old_names - new_names)
    only_new = sorted(new_names - old_names)
    shared = sorted(old_names & new_names)

    print(f"Shared columns ({len(shared)}): {', '.join(shared)}")
    if only_old:
        print(f"\nOnly on Render ({len(only_old)}): {', '.join(only_old)}")
    if only_new:
        print(f"\nOnly on EC2 ({len(only_new)}): {', '.join(only_new)}")

    print("\nType/nullable differences on shared columns:")
    old_by_name = {c["column_name"]: c for c in old_cols}
    new_by_name = {c["column_name"]: c for c in new_cols}
    diffs = []
    for name in shared:
        o, n = old_by_name[name], new_by_name[name]
        if o["data_type"] != n["data_type"] or o["is_nullable"] != n["is_nullable"]:
            diffs.append(
                f"  {name}: render({o['data_type']}, nullable={o['is_nullable']}) "
                f"vs ec2({n['data_type']}, nullable={n['is_nullable']})"
            )
    if diffs:
        print("\n".join(diffs))
    else:
        print("  (none)")


def main() -> None:
    old_db = normalize_url(OLD_DB)
    new_db = normalize_url(NEW_DB)

    if not old_db:
        raise SystemExit("Set MIGRATION_OLD_DATABASE_URL to the Render external URL.")
    if not new_db:
        raise SystemExit("Set DATABASE_URL (or MIGRATION_NEW_DATABASE_URL) for EC2.")

    print("Schedule database comparison")
    print(f"Render : {redact_url(old_db)}")
    print(f"EC2    : {redact_url(new_db)}")
    print(f"Cutoff : {CUTOFF} (EC2 rows before = legacy Render migration style)")

    with psycopg.connect(old_db, row_factory=dict_row, connect_timeout=20) as old_conn, \
         psycopg.connect(new_db, row_factory=dict_row, connect_timeout=15) as new_conn:

        print_section("1) Column definitions")
        old_cols = get_columns(old_conn, "schedule")
        new_cols = get_columns(new_conn, "schedule")
        print(f"Render schedule columns: {len(old_cols)}")
        print(f"EC2 schedule columns   : {len(new_cols)}")
        compare_columns(old_cols, new_cols)

        print_section("2) Row counts")
        print(f"Render schedule rows: {count_rows(old_conn, 'schedule')}")
        print(f"EC2 schedule rows   : {count_rows(new_conn, 'schedule')}")

        print_section("3) Render schedule field usage")
        render_stats = schedule_stats(old_conn)
        print(json.dumps(render_stats, indent=2, default=str))

        print_section("4) EC2 — all rows")
        ec2_all = schedule_stats(new_conn)
        print(json.dumps(ec2_all, indent=2, default=str))

        print_section(f"5) EC2 — appointment_date < {CUTOFF} (legacy / from Render)")
        ec2_before = schedule_stats(new_conn, "WHERE appointment_date < %s", (CUTOFF,))
        print(json.dumps(ec2_before, indent=2, default=str))

        print_section(f"6) EC2 — appointment_date >= {CUTOFF} (native EC2 app)")
        ec2_after = schedule_stats(new_conn, "WHERE appointment_date >= %s", (CUTOFF,))
        print(json.dumps(ec2_after, indent=2, default=str))

        print_section("7) Sample rows")
        print("\nRender (latest 3):")
        print(json.dumps(sample_rows(old_conn, "", ()), indent=2, default=str))
        print(f"\nEC2 before {CUTOFF} (latest 3 by appointment_date):")
        print(json.dumps(sample_rows(new_conn, "WHERE appointment_date < %s", (CUTOFF,)), indent=2, default=str))
        print(f"\nEC2 on/after {CUTOFF} (latest 3 by appointment_date):")
        print(json.dumps(sample_rows(new_conn, "WHERE appointment_date >= %s", (CUTOFF,)), indent=2, default=str))

        print_section("8) FK readiness on EC2")
        with new_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS missing_clients
                FROM schedule s
                LEFT JOIN client c ON c.id = s.client_id
                WHERE s.client_id IS NOT NULL AND c.id IS NULL
                """
            )
            print(f"Schedules with missing client FK: {cur.fetchone()['missing_clients']}")
            cur.execute(
                """
                SELECT COUNT(*) AS missing_services
                FROM schedule s
                LEFT JOIN service sv ON sv.id = s.service_id
                WHERE s.service_id IS NOT NULL AND sv.id IS NULL
                """
            )
            print(f"Schedules with missing service FK: {cur.fetchone()['missing_services']}")
            cur.execute(
                """
                SELECT COUNT(*) AS missing_employees
                FROM schedule s
                LEFT JOIN "user" u ON u.id = s.employee_id
                WHERE s.employee_id IS NOT NULL AND u.id IS NULL
                """
            )
            print(f"Schedules with missing employee FK: {cur.fetchone()['missing_employees']}")

    print("\nDone. Paste this full output back for migration mapping.")


if __name__ == "__main__":
    main()
