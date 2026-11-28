"""Run the one-time SQL backfill for company 03200's historical appointment sales."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, text


MIGRATION_KEY = "2026-11-26_03200_past_appointments_paid"


def run_migration(database_engine: Engine) -> dict[str, Any]:
    """Execute the packaged SQL migration and return its recorded summary."""
    sql_path = Path(__file__).with_name("backfill_03200_appointment_sales.sql")
    migration_sql = sql_path.read_text(encoding="utf-8").strip()
    if not migration_sql:
        raise RuntimeError(f"Appointment sales migration SQL is empty: {sql_path}")

    with database_engine.begin() as conn:
        conn.exec_driver_sql(migration_sql)
        details = conn.execute(
            text("""
                SELECT details
                FROM public.businessmanager_data_migration
                WHERE migration_key = :migration_key
            """),
            {"migration_key": MIGRATION_KEY},
        ).scalar_one()

    return {"status": "completed", "details": details}


def main() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repository_root))

    from backend.database import engine

    print(f"Company 03200 appointment sales backfill: {run_migration(engine)}")


if __name__ == "__main__":
    main()
