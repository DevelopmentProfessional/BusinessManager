"""
Migration script to add days of operation fields to app_settings table
Run this script to add the new columns for controlling which days show in the schedule
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine

def run_migration():
    """Add days of operation columns to app_settings table"""
    database_url = get_database_url()
    engine = create_engine(database_url, echo=True)
    
    print("Adding days of operation columns to app_settings table...")
    
    with engine.connect() as conn:
        # Add the new columns with default value True
        columns_to_add = [
            "monday_enabled",
            "tuesday_enabled",
            "wednesday_enabled",
            "thursday_enabled",
            "friday_enabled",
            "saturday_enabled",
            "sunday_enabled"
        ]
        
        for column in columns_to_add:
            try:
                conn.execute(text(f"""
                    ALTER TABLE app_settings 
                    ADD COLUMN IF NOT EXISTS {column} BOOLEAN DEFAULT TRUE
                """))
                print(f"✓ Added column: {column}")
            except Exception as e:
                print(f"Column {column} might already exist: {e}")
        
        conn.commit()
    
    print("✓ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
