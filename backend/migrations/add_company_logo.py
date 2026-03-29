"""
ADD COMPANY LOGO MIGRATION
===========================
Adds logo_url and logo_data columns to app_settings so each company
can display its logo on the client portal company selection screen.

Run:
    python -m backend.migrations.add_company_logo

logo_url  — External URL or base64 data URI (set from internal app settings)
logo_data — Binary blob fallback (same pattern as DocumentBlob / InventoryImage)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine


def run_migration():
    database_url = get_database_url()
    engine = create_engine(database_url, echo=False)

    columns = [
        ("logo_url", "VARCHAR"),
        ("logo_data", "BYTEA"),
    ]

    with engine.connect() as conn:
        for col_name, col_type in columns:
            try:
                conn.execute(text(
                    f"ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                print(f"  + {col_name}")
            except Exception as e:
                print(f"  ! {col_name}: {e}")
        conn.commit()

    print("Company logo migration complete.")


if __name__ == "__main__":
    run_migration()
