"""One-time migration: sync inventory.quantity to match actual asset_unit count for all ASSET items."""
import psycopg2
import os

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

cur.execute(
    """
    UPDATE inventory
    SET quantity = (
        SELECT COUNT(*) FROM asset_unit au WHERE au.inventory_id = inventory.id
    )
    WHERE LOWER(type) = 'asset'
    """
)
updated = cur.rowcount
conn.commit()
print(f"Updated {updated} asset inventory items.")

# Verify
cur.execute(
    "SELECT i.name, i.quantity, (SELECT COUNT(*) FROM asset_unit au WHERE au.inventory_id = i.id) "
    "FROM inventory i WHERE LOWER(i.type)='asset' ORDER BY i.name",
)
rows = cur.fetchall()
mismatches = sum(1 for r in rows if r[1] != r[2])
print(f"Remaining mismatches: {mismatches}")
for r in rows:
    if r[1] != r[2]:
        print(f"  STILL MISMATCH: {r[0]} qty={r[1]} units={r[2]}")
conn.close()
