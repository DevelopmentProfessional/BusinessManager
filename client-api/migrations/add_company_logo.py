"""
ADD COMPANY LOGO MIGRATION
===========================
Adds logo_url and logo_data columns to app_settings so each company
can display its logo on the client portal company selection screen.

Run:
    python migrations/add_company_logo.py

logo_url  — External URL or base64 data URI (set from internal app settings)
logo_data — Binary blob fallback (same pattern as DocumentBlob / InventoryImage)
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
            print("  Adding logo_url and logo_data to app_settings …")
            cur.execute("""
                ALTER TABLE app_settings
                ADD COLUMN IF NOT EXISTS logo_url VARCHAR;
            """)
            cur.execute("""
                ALTER TABLE app_settings
                ADD COLUMN IF NOT EXISTS logo_data BYTEA;
            """)
            conn.commit()
            print("Done.")


if __name__ == "__main__":
    run()
