"""
Migration script to add missing columns to PostgreSQL database.
Run this once to update the Render database schema.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Add missing columns to user table
        migrations = [
            'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS reports_to UUID',
            'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_id UUID',
            # Add missing type column to item table
            "ALTER TABLE item ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'PRODUCT'",
            # Fix lowercase enum values to uppercase
            "UPDATE item SET type = 'PRODUCT' WHERE type = 'product'",
            "UPDATE item SET type = 'RESOURCE' WHERE type = 'resource'",
            "UPDATE item SET type = 'ASSET' WHERE type = 'asset'",
            "UPDATE item SET type = 'PRODUCT' WHERE type IS NULL",
        ]
        
        for sql in migrations:
            try:
                conn.execute(text(sql))
                print(f"Executed: {sql[:50]}...")
            except Exception as e:
                print(f"Error (may be OK if column exists): {e}")
        
        conn.commit()
        print("Migration complete!")

        # Verify columns exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user'
        """))
        columns = [row[0] for row in result.fetchall()]
        print(f"User table columns: {columns}")

if __name__ == "__main__":
    migrate()
