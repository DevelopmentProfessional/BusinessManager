"""
Migration script to add date_of_purchase and date_of_sale columns to inventory table.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine


def run_migration():
    database_url = get_database_url()
    engine = create_engine(database_url, echo=True)

    print("Adding date_of_purchase and date_of_sale columns to inventory table...")

    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE inventory
                ADD COLUMN IF NOT EXISTS date_of_purchase TIMESTAMP,
                ADD COLUMN IF NOT EXISTS date_of_sale TIMESTAMP
            """))
            conn.commit()
            print("✓ Added columns: date_of_purchase, date_of_sale")
        except Exception as e:
            print(f"Error adding columns: {e}")
            raise

    print("✓ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
