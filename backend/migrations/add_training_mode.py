"""
Migration script to add training_mode column to user table.
Run this against the production database to fix the missing column.
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

    print("Adding training_mode column to user table...")

    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE "user"
                ADD COLUMN IF NOT EXISTS training_mode BOOLEAN DEFAULT FALSE
            """))
            conn.commit()
            print("✓ Added column: training_mode")
        except Exception as e:
            print(f"Error: {e}")

    print("✓ Migration completed!")


if __name__ == "__main__":
    run_migration()
