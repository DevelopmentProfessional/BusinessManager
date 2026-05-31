"""
Migration script to add description column to descriptive_feature table.
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

    print("Adding description column to descriptive_feature table...")

    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE descriptive_feature
                ADD COLUMN IF NOT EXISTS description TEXT
            """))
            conn.commit()
            print("✓ Added column: description")
        except Exception as e:
            print(f"Error adding column: {e}")
            raise

    print("✓ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
