"""Check inventory table schema"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.db_config import get_database_url

e = create_engine(get_database_url())
with e.connect() as c:
    print("=== INVENTORY TABLE COLUMNS ===")
    r = c.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory' ORDER BY ordinal_position"))
    for row in r:
        print(f"  {row[0]}: {row[1]}")
    
    print("\n=== ITEM TABLE COLUMNS ===")
    r = c.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'item' ORDER BY ordinal_position"))
    for row in r:
        print(f"  {row[0]}: {row[1]}")
    
    print("\n=== SAMPLE INVENTORY WITH ITEM JOIN ===")
    r = c.execute(text("""
        SELECT i.id, i.quantity, i.min_stock_level, i.location, 
               it.name, it.sku, it.price, it.type, it.description
        FROM inventory i
        JOIN item it ON i.item_id = it.id
        LIMIT 5
    """))
    for row in r:
        print(f"  {row.name} | SKU: {row.sku} | Qty: {row.quantity} | Price: ${row.price}")
