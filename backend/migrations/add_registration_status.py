"""
Migration: add registration_status and registration_notes to company table
Run once on the target database.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Add registration_status column (default 'approved' so existing companies stay active)
        conn.execute(text("""
            ALTER TABLE company
            ADD COLUMN IF NOT EXISTS registration_status VARCHAR DEFAULT 'approved';
        """))
        # Add registration_notes column
        conn.execute(text("""
            ALTER TABLE company
            ADD COLUMN IF NOT EXISTS registration_notes TEXT DEFAULT NULL;
        """))
        conn.commit()
        print("Migration complete: registration_status and registration_notes added to company table.")

if __name__ == "__main__":
    run()
