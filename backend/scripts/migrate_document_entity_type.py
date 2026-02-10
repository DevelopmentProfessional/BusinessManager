"""
Migration: Convert document.entity_type from PostgreSQL enum to VARCHAR.

The Document model defines entity_type as Optional[str], but the database
has it as a PostgreSQL enum type (entitytype). This mismatch causes inserts
to fail with: "column entity_type is of type entitytype but expression is
of type character varying".

This script:
1. Converts entity_type from enum to VARCHAR (preserving existing data)
2. Normalizes existing enum values to lowercase (CLIENT -> client)
3. Drops the orphaned enum type if no other columns use it
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text

DB_URL = "postgresql+psycopg://db_reference_user:AGONHh5kBrXztl8hwYUEIGpCZncxK06j@dpg-d5scoucoud1c73b1s5tg-a.oregon-postgres.render.com/db_reference_name"

engine = create_engine(DB_URL, pool_pre_ping=True)

with engine.begin() as conn:
    # Step 1: Check current column type
    result = conn.execute(text("""
        SELECT udt_name FROM information_schema.columns
        WHERE table_name = 'document' AND column_name = 'entity_type'
    """))
    row = result.fetchone()
    if not row:
        print("ERROR: document.entity_type column not found!")
        sys.exit(1)

    udt_name = row[0]
    print(f"Current entity_type udt_name: {udt_name}")

    if udt_name == "varchar" or udt_name == "text":
        print("entity_type is already VARCHAR/TEXT. No migration needed.")
        sys.exit(0)

    # Step 2: Convert entity_type from enum to VARCHAR
    print("Converting entity_type from enum to VARCHAR...")

    # ALTER COLUMN TYPE with USING to cast existing values
    conn.execute(text("""
        ALTER TABLE document
        ALTER COLUMN entity_type TYPE VARCHAR
        USING entity_type::TEXT
    """))
    print("  Column type changed to VARCHAR.")

    # Step 3: Normalize existing values to lowercase
    conn.execute(text("""
        UPDATE document SET entity_type = LOWER(entity_type)
        WHERE entity_type IS NOT NULL
    """))
    # Also normalize ITEM -> inventory (the enum had ITEM but the Python enum uses INVENTORY)
    conn.execute(text("""
        UPDATE document SET entity_type = 'inventory'
        WHERE entity_type = 'item'
    """))
    print("  Existing values normalized to lowercase.")

    # Step 4: Check if entitytype enum is still used by any other column
    result = conn.execute(text("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE udt_name = 'entitytype' AND table_schema = 'public'
    """))
    remaining_uses = result.scalar()

    if remaining_uses == 0:
        print("  No other columns use the entitytype enum. Dropping it...")
        conn.execute(text("DROP TYPE IF EXISTS entitytype"))
        print("  Enum type entitytype dropped.")
    else:
        print(f"  entitytype enum still used by {remaining_uses} other column(s). Keeping it.")

    print("\nMigration complete!")

    # Verify
    result = conn.execute(text("""
        SELECT udt_name FROM information_schema.columns
        WHERE table_name = 'document' AND column_name = 'entity_type'
    """))
    new_type = result.fetchone()[0]
    print(f"entity_type is now: {new_type}")
