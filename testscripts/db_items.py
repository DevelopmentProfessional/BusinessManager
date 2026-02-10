"""
Database test script - Check items table and their types
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

try:
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check items table with types
        print("\n=== ITEMS TABLE ===")
        result = conn.execute(text("SELECT COUNT(*) FROM item"))
        count = result.scalar()
        print(f"Total items: {count}")
        
        if count > 0:
            print("\nItems with their types:")
            result = conn.execute(text("SELECT id, name, sku, price, type FROM item LIMIT 15"))
            for row in result:
                print(f"  - {row.name} | SKU: {row.sku} | Price: ${row.price} | Type: {row.type}")
        
        # Count by type
        print("\n=== ITEMS BY TYPE ===")
        result = conn.execute(text("SELECT type, COUNT(*) as cnt FROM item GROUP BY type"))
        for row in result:
            print(f"  {row.type}: {row.cnt} items")
                
except Exception as e:
    print(f"Database connection error: {e}")
    import traceback
    traceback.print_exc()
