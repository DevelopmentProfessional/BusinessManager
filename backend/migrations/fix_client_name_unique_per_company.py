"""
Migration: Replace global ix_client_name unique index with a per-company
           unique constraint on (company_id, name).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from backend.database import engine
except ImportError:
    from database import engine  # type: ignore

from sqlalchemy import text

with engine.begin() as conn:
    # Drop the old global unique index
    conn.execute(text("DROP INDEX IF EXISTS ix_client_name;"))
    print("Dropped ix_client_name")

    # Drop if the new constraint already exists (idempotent)
    conn.execute(text("""
        ALTER TABLE client
        DROP CONSTRAINT IF EXISTS uq_client_company_name;
    """))

    # Add the correct per-company unique constraint
    conn.execute(text("""
        ALTER TABLE client
        ADD CONSTRAINT uq_client_company_name UNIQUE (company_id, name);
    """))
    print("Added uq_client_company_name (company_id, name)")

    # Recreate a plain (non-unique) index on name for query performance
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_client_name ON client (name);
    """))
    print("Recreated non-unique ix_client_name index")

print("Migration complete.")
