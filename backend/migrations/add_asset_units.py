"""
Migration: Add asset_unit table and cost column to inventory.

  - inventory.cost (FLOAT, nullable) — purchase/acquisition cost per unit
  - asset_unit table — tracks individual physical units of ASSET inventory items
    with per-unit states: available | in_use | maintenance | arriving_soon
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text

try:
    from backend.database import engine
except ImportError:
    from database import engine  # type: ignore


def run_migration():
    with engine.connect() as conn:
        # 1) Add cost column to inventory
        try:
            conn.execute(text("""
                ALTER TABLE inventory
                ADD COLUMN IF NOT EXISTS cost FLOAT
            """))
            conn.commit()
            print("✓ Added column: inventory.cost")
        except Exception as e:
            print(f"  inventory.cost: {e}")

        # 2) Create asset_unit table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS asset_unit (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    inventory_id UUID NOT NULL REFERENCES inventory(id),
                    label VARCHAR,
                    state VARCHAR NOT NULL DEFAULT 'available',
                    schedule_id UUID,
                    notes TEXT,
                    company_id VARCHAR,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE
                )
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_asset_unit_inventory_id
                    ON asset_unit (inventory_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_asset_unit_state
                    ON asset_unit (state)
            """))
            conn.commit()
            print("✓ Created table: asset_unit")
        except Exception as e:
            print(f"  asset_unit: {e}")

    print("Migration completed.")


if __name__ == "__main__":
    run_migration()
