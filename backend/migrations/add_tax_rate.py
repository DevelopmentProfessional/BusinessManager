"""
Migration script to add tax_rate field to app_settings table
Run this script to add the tax_rate column for payroll calculations
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine

def run_migration():
    """Add tax_rate column to app_settings table"""
    database_url = get_database_url()
    engine = create_engine(database_url, echo=True)
    
    print("Adding tax_rate column to app_settings table...")
    
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE app_settings 
                ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION DEFAULT 0.0
            """))
            conn.commit()
            print("✓ Added column: tax_rate")
        except Exception as e:
            print(f"Error adding tax_rate column: {e}")
            raise
    
    print("✓ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
