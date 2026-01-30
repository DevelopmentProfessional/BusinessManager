"""
Database test script - Check clients table
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.db_config import get_database_url, get_current_environment

# Get database URL from db_config
DATABASE_URL = get_database_url()
ENV = get_current_environment()

if not DATABASE_URL:
    print(f"ERROR: No database URL configured for environment: {ENV}")
    sys.exit(1)

print(f"Environment: {ENV}")

print(f"Connecting to database...")
print(f"URL prefix: {DATABASE_URL[:30]}...")

try:
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check clients table
        print("\n=== CLIENTS TABLE ===")
        result = conn.execute(text("SELECT COUNT(*) FROM client"))
        count = result.scalar()
        print(f"Total clients: {count}")
        
        if count > 0:
            print("\nFirst 10 clients:")
            result = conn.execute(text("SELECT id, name, email, phone FROM client LIMIT 10"))
            for row in result:
                print(f"  - {row.name} | {row.email} | {row.phone}")
        
        # Check other tables
        print("\n=== TABLE COUNTS ===")
        tables = ['client', 'service', 'item', 'inventory', 'schedule', 'user']
        for table in tables:
            try:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  {table}: {count} records")
            except Exception as e:
                print(f"  {table}: ERROR - {e}")
                
except Exception as e:
    print(f"Database connection error: {e}")
    import traceback
    traceback.print_exc()
