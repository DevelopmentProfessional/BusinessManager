from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
import os
from typing import Generator

# Import database configuration
try:
    from backend.db_config import get_database_url
except ImportError:
    from db_config import get_database_url

# Database URL from db_config (supports environment switching)
DATABASE_URL = get_database_url()

# Create engine with appropriate settings
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
else:
    # PostgreSQL - normalize URL to use psycopg driver
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=300)

def _migrate_documents_table_if_needed():
    """Ensure SQLite 'document' table allows NULL for entity fields.
    If existing table has NOT NULL constraints on entity_type/entity_id, migrate schema preserving data.
    """
    # Only handle SQLite simple migration
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        # Check if table exists
        tbl_exists = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='document'"
        )).fetchone()
        if not tbl_exists:
            return
        # Inspect columns
        cols = conn.execute(text("PRAGMA table_info('document')")).fetchall()
        info = {row[1]: {"notnull": row[3]} for row in cols}

        # Detect presence of e-signature columns
        has_is_signed = "is_signed" in info
        has_signed_by = "signed_by" in info
        has_signed_at = "signed_at" in info

        # Determine if we must rebuild table due to nullability constraints
        needs_rebuild = False
        for col in ("entity_type", "entity_id"):
            if col in info and info[col]["notnull"] == 1:
                needs_rebuild = True

        # If we don't need a rebuild, but are missing e-sign columns, add them in-place
        if not needs_rebuild:
            if not has_is_signed:
                conn.execute(text("ALTER TABLE document ADD COLUMN is_signed BOOLEAN NOT NULL DEFAULT 0"))
                has_is_signed = True
            if not has_signed_by:
                conn.execute(text("ALTER TABLE document ADD COLUMN signed_by TEXT"))
                has_signed_by = True
            if not has_signed_at:
                conn.execute(text("ALTER TABLE document ADD COLUMN signed_at DATETIME"))
                has_signed_at = True
            # Nothing else to do
            return
        # Perform migration: create new table with correct nullability
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS document_new (
              id TEXT PRIMARY KEY,
              created_at DATETIME NOT NULL,
              updated_at DATETIME,
              filename TEXT NOT NULL,
              original_filename TEXT NOT NULL,
              file_path TEXT NOT NULL,
              file_size INTEGER NOT NULL,
              content_type TEXT NOT NULL,
              entity_type VARCHAR,
              entity_id TEXT,
              description TEXT,
              is_signed BOOLEAN NOT NULL DEFAULT 0,
              signed_by TEXT,
              signed_at DATETIME
            )
            """
        ))
        # Copy data
        # Build SELECT list using literals for any missing columns
        select_is_signed = "is_signed" if has_is_signed else "0 AS is_signed"
        select_signed_by = "signed_by" if has_signed_by else "NULL AS signed_by"
        select_signed_at = "signed_at" if has_signed_at else "NULL AS signed_at"

        insert_sql = f"""
            INSERT INTO document_new (
              id, created_at, updated_at, filename, original_filename, file_path, file_size, content_type,
              entity_type, entity_id, description, is_signed, signed_by, signed_at
            )
            SELECT 
              id, created_at, updated_at, filename, original_filename, file_path, file_size, content_type,
              entity_type, entity_id, description, {select_is_signed}, {select_signed_by}, {select_signed_at}
            FROM document
        """
        conn.execute(text(insert_sql))
        # Replace old table
        conn.execute(text("DROP TABLE document"))
        conn.execute(text("ALTER TABLE document_new RENAME TO document"))    
    
def _migrate_document_entity_type_enum_to_varchar():
    """Convert document.entity_type from PostgreSQL enum to VARCHAR.

    The Document model defines entity_type as Optional[str], but older
    database schemas created a PostgreSQL enum column. This causes insert
    failures: 'column entity_type is of type entitytype but expression is
    of type character varying'. This migration converts the column to
    VARCHAR and normalises existing values to lowercase.
    """
    if DATABASE_URL.startswith("sqlite"):
        return  # SQLite doesn't have enums
    with engine.begin() as conn:
        result = conn.execute(text(
            "SELECT udt_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='document' AND column_name='entity_type'"
        ))
        row = result.fetchone()
        if not row or row[0] in ("varchar", "text", "character varying"):
            return  # Already correct type or column missing
        # Convert enum to VARCHAR
        conn.execute(text(
            "ALTER TABLE document ALTER COLUMN entity_type TYPE VARCHAR USING entity_type::TEXT"
        ))
        # Normalise to lowercase
        conn.execute(text(
            "UPDATE document SET entity_type = LOWER(entity_type) WHERE entity_type IS NOT NULL"
        ))
        # Map legacy 'item' to 'inventory'
        conn.execute(text(
            "UPDATE document SET entity_type = 'inventory' WHERE entity_type = 'item'"
        ))
        # Drop orphaned enum type if unused
        remaining = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE udt_name = 'entitytype' AND table_schema = 'public'"
        )).scalar()
        if remaining == 0:
            conn.execute(text("DROP TYPE IF EXISTS entitytype"))
        print("✓ Migrated document.entity_type from enum to VARCHAR")


def create_db_and_tables():
    """Create database tables and run safe migrations."""
    # Pre-create migrations: move legacy product/assets to item schema and adjust inventory FK
    _migrate_products_and_inventory_to_items_if_needed()
    # Convert document.entity_type from PG enum to varchar BEFORE create_all
    _migrate_document_entity_type_enum_to_varchar()
    # Create all tables based on current models
    SQLModel.metadata.create_all(engine)
    # Post-create migrations
    _ensure_item_type_column_if_needed()
    _migrate_documents_table_if_needed()
    _ensure_document_extra_columns_if_needed()
    _ensure_employee_user_id_column_if_needed()
    _normalize_item_types_if_needed()
    _ensure_inventory_image_table_if_needed()
    _ensure_schedule_extra_columns_if_needed()
    _ensure_user_extra_columns_if_needed()
    _ensure_signature_columns_if_needed()

def get_session() -> Generator[Session, None, None]:
    """Get database session"""
    with Session(engine) as session:
        yield session

def _migrate_products_and_inventory_to_items_if_needed():
    """SQLite-safe migrations to remove legacy products/assets and move to items.

    Steps:
    - If both product and item tables exist, copy any missing rows from product -> item, then drop product.
    - If only product exists, rename it to item.
    - Update inventory table to use item_id instead of product_id (rebuild table if needed).
    - Drop legacy asset table if it exists.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        # Helpers
        def table_exists(name: str) -> bool:
            return conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
            ), {"name": name}).fetchone() is not None

        product_exists = table_exists("product")
        item_exists = table_exists("item")

        # Case 1: both product and item exist -> copy missing rows then drop product
        if product_exists and item_exists:
            # Inspect columns available on both; use intersection
            prod_cols = [row[1] for row in conn.execute(text("PRAGMA table_info('product')")).fetchall()]
            item_cols = [row[1] for row in conn.execute(text("PRAGMA table_info('item')")).fetchall()]
            common_cols = [c for c in prod_cols if c in item_cols]
            if common_cols:
                cols_csv = ", ".join(common_cols)
                insert_sql = f"INSERT OR IGNORE INTO item ({cols_csv}) SELECT {cols_csv} FROM product"
                conn.execute(text(insert_sql))
            # Drop product table after copy
            conn.execute(text("DROP TABLE product"))
            product_exists = False

        # Case 2: only product exists -> rename to item
        if product_exists and not item_exists:
            conn.execute(text("ALTER TABLE product RENAME TO item"))
            item_exists = True
            product_exists = False

        # Migrate inventory FK column from product_id -> item_id
        if table_exists("inventory"):
            cols = conn.execute(text("PRAGMA table_info('inventory')")).fetchall()
            col_names = {row[1] for row in cols}
            has_product_id = "product_id" in col_names
            has_item_id = "item_id" in col_names
            if has_product_id and not has_item_id:
                # Rebuild inventory table with correct schema
                conn.execute(text(
                    """
                    CREATE TABLE IF NOT EXISTS inventory_new (
                      id TEXT PRIMARY KEY,
                      created_at DATETIME NOT NULL,
                      updated_at DATETIME,
                      item_id TEXT NOT NULL,
                      supplier_id TEXT,
                      quantity INTEGER NOT NULL,
                      min_stock_level INTEGER NOT NULL DEFAULT 10,
                      location TEXT
                    )
                    """
                ))
                # Copy data mapping product_id -> item_id
                conn.execute(text(
                    """
                    INSERT INTO inventory_new (
                      id, created_at, updated_at, item_id, supplier_id, quantity, min_stock_level, location
                    )
                    SELECT 
                      id, created_at, updated_at, product_id AS item_id, supplier_id, quantity, min_stock_level, location
                    FROM inventory
                    """
                ))
                conn.execute(text("DROP TABLE inventory"))
                conn.execute(text("ALTER TABLE inventory_new RENAME TO inventory"))

        # Drop legacy asset table if present
        if table_exists("asset"):
            conn.execute(text("DROP TABLE asset"))

def _ensure_item_type_column_if_needed():
    """Ensure the 'item' table has a 'type' column; add it if missing (SQLite).

    If the column is added, initialize existing rows with 'item'.
    """
    if not DATABASE_URL.startswith("sqlite"):
        # For non-SQLite, assume external migrations handle schema.
        return
    with engine.begin() as conn:
        # Check item table exists
        tbl_exists = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='item'"
        )).fetchone()
        if not tbl_exists:
            return
        # Inspect columns
        cols = conn.execute(text("PRAGMA table_info('item')")).fetchall()
        col_names = {row[1] for row in cols}
        if "type" not in col_names:
            # Add column and backfill existing rows to 'item'
            conn.execute(text("ALTER TABLE item ADD COLUMN type VARCHAR DEFAULT 'item'"))
            # Ensure existing rows have a non-null value
            conn.execute(text("UPDATE item SET type = 'item' WHERE type IS NULL"))

def _normalize_item_types_if_needed():
    """Normalize legacy item.type values to 'item'.

    Converts any item records with type in ['product', 'asset'] (case-insensitive)
    to 'item'. This helps avoid enum parsing errors at the API layer.
    """
    with engine.begin() as conn:
        # Ensure item table exists and has a 'type' column
        tbl_exists = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='item'"
        )).fetchone() if DATABASE_URL.startswith("sqlite") else True
        if not tbl_exists:
            return
        # Attempt to perform normalization; works on SQLite and most SQL dialects
        try:
            conn.execute(text(
                "UPDATE item SET type = 'item' WHERE LOWER(type) IN ('product', 'asset')"
            ))
        except Exception:
            # Fallback for engines without LOWER or case-insensitive compare
            try:
                conn.execute(text("UPDATE item SET type = 'item' WHERE type IN ('product','asset','PRODUCT','ASSET')"))
            except Exception:
                pass

def _ensure_document_extra_columns_if_needed():
    """Ensure new columns exist on 'document' table: owner_id, review_date, category_id,
    is_signed, signed_by, signed_at.  Works on both SQLite and PostgreSQL.
    """
    # Column name -> (SQLite type, PostgreSQL type)
    extra_cols = {
        "owner_id": ("TEXT", "UUID"),
        "review_date": ("DATETIME", "TIMESTAMP WITH TIME ZONE"),
        "category_id": ("TEXT", "UUID"),
        "is_signed": ("BOOLEAN NOT NULL DEFAULT 0", "BOOLEAN NOT NULL DEFAULT FALSE"),
        "signed_by": ("TEXT", "TEXT"),
        "signed_at": ("DATETIME", "TIMESTAMP WITH TIME ZONE"),
    }

    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='document'"
            )).fetchone()
            if not tbl_exists:
                return
            cols = conn.execute(text("PRAGMA table_info('document')")).fetchall()
            col_names = {row[1] for row in cols}
            for col, (sqlite_type, _pg_type) in extra_cols.items():
                if col not in col_names:
                    conn.execute(text(f"ALTER TABLE document ADD COLUMN {col} {sqlite_type}"))
    else:
        # PostgreSQL
        with engine.begin() as conn:
            tbl_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='document')"
            )).scalar()
            if not tbl_exists:
                return
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='document'"
            )).fetchall()
            col_names = {row[0] for row in cols}
            for col, (_sqlite_type, pg_type) in extra_cols.items():
                if col not in col_names:
                    conn.execute(text(f'ALTER TABLE document ADD COLUMN {col} {pg_type}'))
                    print(f"  + Added column document.{col} ({pg_type})")

def _ensure_employee_user_id_column_if_needed():
    """Ensure the 'employee' table has a 'user_id' column; add it if missing (SQLite)."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        # Check employee table exists
        tbl_exists = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='employee'"
        )).fetchone()
        if not tbl_exists:
            return
        # Inspect columns
        cols = conn.execute(text("PRAGMA table_info('employee')")).fetchall()
        col_names = {row[1] for row in cols}
        if "user_id" not in col_names:
            # Add column
            conn.execute(text("ALTER TABLE employee ADD COLUMN user_id TEXT"))


def _ensure_inventory_image_table_if_needed():
    """Ensure InventoryImage table exists and has proper structure."""
    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            # Check if inventoryimage table exists
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='inventoryimage'"
            )).fetchone()
            if not tbl_exists:
                # Create the table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE inventoryimage (
                        id TEXT PRIMARY KEY,
                        inventory_id TEXT NOT NULL,
                        image_url TEXT,
                        file_path TEXT,
                        file_name TEXT,
                        is_primary BOOLEAN NOT NULL DEFAULT 0,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME,
                        updated_at DATETIME,
                        FOREIGN KEY(inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                        CONSTRAINT check_image_source CHECK (
                            (image_url IS NOT NULL AND file_path IS NULL) OR
                            (image_url IS NULL AND file_path IS NOT NULL) OR
                            (image_url IS NOT NULL AND file_path IS NOT NULL)
                        )
                    )
                """))
                print("✓ Created InventoryImage table for SQLite")
    else:
        # PostgreSQL version
        with engine.begin() as conn:
            # Check if inventoryimage table exists
            tbl_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventoryimage')"
            )).scalar()
            if not tbl_exists:
                # Create the table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE inventoryimage (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        inventory_id UUID NOT NULL,
                        image_url TEXT,
                        file_path TEXT,
                        file_name TEXT,
                        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_inventory_image_inventory 
                            FOREIGN KEY(inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                        CONSTRAINT check_image_source CHECK (
                            (image_url IS NOT NULL AND file_path IS NULL) OR
                            (image_url IS NULL AND file_path IS NOT NULL) OR
                            (image_url IS NOT NULL AND file_path IS NOT NULL)
                        )
                    )
                """))
                
                # Create indexes for better performance
                conn.execute(text(
                    "CREATE INDEX idx_inventoryimage_inventory_id ON inventoryimage(inventory_id)"
                ))
                conn.execute(text(
                    "CREATE INDEX idx_inventoryimage_is_primary ON inventoryimage(inventory_id, is_primary) WHERE is_primary = TRUE"
                ))
                conn.execute(text(
                    "CREATE INDEX idx_inventoryimage_sort_order ON inventoryimage(inventory_id, sort_order)"
                ))
                
                # Create trigger to update updated_at timestamp
                conn.execute(text("""
                    CREATE OR REPLACE FUNCTION update_inventoryimage_updated_at()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = CURRENT_TIMESTAMP;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                """))
                
                conn.execute(text("""
                    CREATE TRIGGER trigger_inventoryimage_updated_at
                        BEFORE UPDATE ON inventoryimage
                        FOR EACH ROW
                        EXECUTE FUNCTION update_inventoryimage_updated_at();
                """))
                
                print("✓ Created InventoryImage table for PostgreSQL with indexes and triggers")


def _ensure_schedule_extra_columns_if_needed():
    """Ensure schedule table has appointment_type and duration_minutes columns."""
    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='schedule'"
            )).fetchone()
            if not tbl_exists:
                return
            cols = conn.execute(text("PRAGMA table_info('schedule')")).fetchall()
            col_names = {row[1] for row in cols}
            if "appointment_type" not in col_names:
                conn.execute(text("ALTER TABLE schedule ADD COLUMN appointment_type VARCHAR DEFAULT 'one_time'"))
            if "duration_minutes" not in col_names:
                conn.execute(text("ALTER TABLE schedule ADD COLUMN duration_minutes INTEGER DEFAULT 60"))
    else:
        with engine.begin() as conn:
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='schedule'"
            )).fetchall()
            col_names = {row[0] for row in cols}
            if "appointment_type" not in col_names:
                conn.execute(text("ALTER TABLE schedule ADD COLUMN appointment_type VARCHAR DEFAULT 'one_time'"))
            if "duration_minutes" not in col_names:
                conn.execute(text("ALTER TABLE schedule ADD COLUMN duration_minutes INTEGER DEFAULT 60"))

def _ensure_user_extra_columns_if_needed():
    """Ensure user table has employee detail/benefit columns."""
    new_cols = {
        "iod_number": "VARCHAR",
        "location": "VARCHAR",
        "salary": "FLOAT",
        "pay_frequency": "VARCHAR",
        "insurance_plan": "VARCHAR",
        "vacation_days": "INTEGER",
        "vacation_days_used": "INTEGER DEFAULT 0",
        "sick_days": "INTEGER",
        "sick_days_used": "INTEGER DEFAULT 0",
    }
    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
            )).fetchone()
            if not tbl_exists:
                return
            cols = conn.execute(text("PRAGMA table_info('user')")).fetchall()
            col_names = {row[1] for row in cols}
            for col, col_type in new_cols.items():
                if col not in col_names:
                    conn.execute(text(f"ALTER TABLE user ADD COLUMN {col} {col_type}"))
    else:
        with engine.begin() as conn:
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='user'"
            )).fetchall()
            col_names = {row[0] for row in cols}
            for col, col_type in new_cols.items():
                if col not in col_names:
                    conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} {col_type}'))


def _ensure_signature_columns_if_needed():
    """Ensure signature-related columns exist on user and document tables.

    user.signature_data - base64 PNG signature data
    document.signature_image - base64 PNG of signer's signature
    document.signed_by_user_id - FK to user who signed
    """
    user_cols = {
        "signature_data": ("TEXT", "TEXT"),
    }
    doc_cols = {
        "signature_image": ("TEXT", "TEXT"),
        "signed_by_user_id": ("TEXT", "UUID"),
    }

    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            # User table
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
            )).fetchone()
            if tbl_exists:
                cols = conn.execute(text("PRAGMA table_info('user')")).fetchall()
                col_names = {row[1] for row in cols}
                for col, (sqlite_type, _) in user_cols.items():
                    if col not in col_names:
                        conn.execute(text(f"ALTER TABLE user ADD COLUMN {col} {sqlite_type}"))

            # Document table
            tbl_exists = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='document'"
            )).fetchone()
            if tbl_exists:
                cols = conn.execute(text("PRAGMA table_info('document')")).fetchall()
                col_names = {row[1] for row in cols}
                for col, (sqlite_type, _) in doc_cols.items():
                    if col not in col_names:
                        conn.execute(text(f"ALTER TABLE document ADD COLUMN {col} {sqlite_type}"))
    else:
        # PostgreSQL
        with engine.begin() as conn:
            # User table
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='user'"
            )).fetchall()
            col_names = {row[0] for row in cols}
            for col, (_, pg_type) in user_cols.items():
                if col not in col_names:
                    conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} {pg_type}'))
                    print(f"  + Added column user.{col} ({pg_type})")

            # Document table
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='document'"
            )).fetchall()
            col_names = {row[0] for row in cols}
            for col, (_, pg_type) in doc_cols.items():
                if col not in col_names:
                    conn.execute(text(f'ALTER TABLE document ADD COLUMN {col} {pg_type}'))
                    print(f"  + Added column document.{col} ({pg_type})")
