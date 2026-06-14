#!/usr/bin/env python
"""Inspect schema migration status and schedule table columns.

Usage:
  python backend/scripts/schema_status.py
  python backend/scripts/schema_status.py --migrate
"""

import argparse
import os
import sys
from typing import List

from sqlalchemy import text

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

try:
    from backend.database import engine, create_db_and_tables, CURRENT_SCHEMA_VERSION
except ModuleNotFoundError:
    from database import engine, create_db_and_tables, CURRENT_SCHEMA_VERSION  # type: ignore


SCHEDULE_REQUIRED_COLUMNS: List[str] = [
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
]

SALE_TRANSACTION_REQUIRED_COLUMNS: List[str] = [
    "subtotal",
    "discount_amount",
    "tax_amount",
    "total",
    "payment_method",
    "schedule_id",
]


def get_schema_versions() -> List[str]:
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migration (version TEXT PRIMARY KEY)"))
        rows = conn.execute(text("SELECT version FROM schema_migration ORDER BY version DESC")).fetchall()
    return [row[0] for row in rows]


def get_table_columns(table_name: str) -> List[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name=:table "
                "ORDER BY ordinal_position"
            ),
            {"table": table_name},
        ).fetchall()
    return [row[0] for row in rows]


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect schema migration status")
    parser.add_argument("--migrate", action="store_true", help="Run create_db_and_tables before reporting")
    args = parser.parse_args()

    if args.migrate:
        print("Running create_db_and_tables()...")
        create_db_and_tables()
        print("Migration run complete.\n")

    versions = get_schema_versions()
    schedule_columns = get_table_columns("schedule")
    schedule_colset = set(schedule_columns)
    missing_schedule = [c for c in SCHEDULE_REQUIRED_COLUMNS if c not in schedule_colset]

    sale_transaction_columns = get_table_columns("sale_transaction")
    sale_transaction_colset = set(sale_transaction_columns)
    missing_sale_transaction = [c for c in SALE_TRANSACTION_REQUIRED_COLUMNS if c not in sale_transaction_colset]

    print(f"CURRENT_SCHEMA_VERSION (code): {CURRENT_SCHEMA_VERSION}")
    print(f"Latest schema_migration version (db): {versions[0] if versions else 'NONE'}")
    print(f"Total schema_migration entries: {len(versions)}")

    print("\nSchedule columns present:")
    for col in schedule_columns:
        print(f"  - {col}")

    print("\nSale transaction columns present:")
    for col in sale_transaction_columns:
        print(f"  - {col}")

    if missing_schedule or missing_sale_transaction:
        if missing_schedule:
            print("\nMissing schedule columns:")
            for col in missing_schedule:
                print(f"  - {col}")
        if missing_sale_transaction:
            print("\nMissing sale_transaction columns:")
            for col in missing_sale_transaction:
                print(f"  - {col}")
        return 2

    print("\nSchedule + sale_transaction schema looks up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
