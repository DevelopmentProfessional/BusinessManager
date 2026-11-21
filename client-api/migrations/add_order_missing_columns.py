"""
ADD MISSING ORDER COLUMNS MIGRATION
=====================================
The client_order table was created without employee_id, paid_at,
fulfilled_at, and inventory_deducted_at columns. SQLAlchemy includes
all mapped columns in INSERT statements, causing "Failed to create order."

Run:
    python migrations/add_order_missing_columns.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import DATABASE_URL
import psycopg

_url = DATABASE_URL
if _url.startswith("postgresql+psycopg://"):
    _url = _url.replace("postgresql+psycopg://", "postgresql://", 1)


def run():
    print("Connecting to database …")
    with psycopg.connect(_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            print("  Adding missing columns to client_order …")
            cur.execute("""
                ALTER TABLE client_order
                ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES "user"(id);
            """)
            cur.execute("""
                ALTER TABLE client_order
                ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
            """)
            cur.execute("""
                ALTER TABLE client_order
                ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP;
            """)
            cur.execute("""
                ALTER TABLE client_order
                ADD COLUMN IF NOT EXISTS inventory_deducted_at TIMESTAMP;
            """)
            conn.commit()
            print("Done.")


if __name__ == "__main__":
    run()
