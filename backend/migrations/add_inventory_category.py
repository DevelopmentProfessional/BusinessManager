"""
Migration script to add category field to inventory table.
Run this script once per environment after deploying the model change.
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine


def run_migration():
    """Add category column to inventory table."""
    database_url = get_database_url()
    engine = create_engine(database_url, echo=True)

    print("Adding category column to inventory table...")

    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE inventory
                ADD COLUMN IF NOT EXISTS category VARCHAR
            """))
            conn.commit()
            print("Added column: category")
        except Exception as e:
            print(f"Error adding category column: {e}")
            raise

    print("Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
