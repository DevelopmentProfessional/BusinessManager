"""
ADD AVAILABILITY COLUMNS MIGRATION
====================================
Adds the columns needed for the enhanced availability algorithm:

  user table:
    lunch_start             VARCHAR   — employee lunch start time "HH:MM"
    lunch_duration_minutes  INTEGER   — duration in minutes (default 30)

  inventory table:
    min_stock_level         INTEGER   — already exists in most schemas; added if missing
    procurement_lead_days   INTEGER   — days from order to delivery for restock

Run:
    python migrations/add_availability_columns.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import DATABASE_URL
import psycopg

_url = DATABASE_URL
if _url.startswith("postgresql+psycopg://"):
    _url = _url.replace("postgresql+psycopg://", "postgresql://", 1)

COLUMNS = {
    '"user"': {
        "lunch_start":            "VARCHAR",
        "lunch_duration_minutes": "INTEGER DEFAULT 30",
    },
    "inventory": {
        "min_stock_level":        "INTEGER NOT NULL DEFAULT 10",
        "procurement_lead_days":  "INTEGER",
    },
}


def run():
    print("Connecting to database …")
    with psycopg.connect(_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            for table, cols in COLUMNS.items():
                for col, pg_type in cols.items():
                    print(f"  Adding {table}.{col} if missing …")
                    cur.execute(f"""
                        ALTER TABLE {table}
                        ADD COLUMN IF NOT EXISTS {col} {pg_type};
                    """)
            conn.commit()
    print("Done.")


if __name__ == "__main__":
    run()
