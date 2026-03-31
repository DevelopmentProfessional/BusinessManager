# ============================================================
# FILE: database.py
#
# PURPOSE:
#   Creates the SQLAlchemy engine, provides the FastAPI session dependency,
#   and runs all incremental schema migrations that bring an existing database
#   up to the current schema version on every server startup.
#
# FUNCTIONAL PARTS:
#   [1] Imports                              — SQLModel, SQLAlchemy, stdlib
#   [2] Engine Setup                         — PostgreSQL runtime URL resolution
#                                              and engine creation
#   [3] Schema Version Tracking             — CURRENT_SCHEMA_VERSION constant,
#                                              _schema_is_current(), _mark_schema_current()
#   [4] Migration: Documents Table           — nullability fix, entity_type enum -> VARCHAR
#   [5] Migration: Items / Inventory         — product -> item rename, FK column rename
#   [6] Migration: Document Extra Columns    — owner_id, review_date, category_id,
#                                              e-sign columns
#   [7] Migration: Employee Columns          — user_id, supervisor columns on legacy table
#   [8] Migration: InventoryImage Table      — table creation with indexes and triggers
#   [9] Migration: Service Columns           — duration_minutes
#   [10] Migration: Schedule Columns         — appointment_type, duration_minutes,
#                                              recurrence columns
#   [11] Migration: User Columns             — payroll, benefit, signature, profile picture
#   [12] Migration: Leave Request            — supervisor_id column
#   [13] Migration: AppSettings Columns      — company info columns
#   [14] Migration: Chat Message Table       — table creation for older databases
#   [15] Seed Functions                      — user colors, insurance plans
#   [15b] Migration: Schedule Payment        — is_paid, discount, sale_transaction_id on schedule;
#                                              schedule_id on sale_transaction;
#                                              consumption_rate_pct on service_resource
#   [16] create_db_and_tables()              — orchestrates create_all + all migrations
#   [17] get_session()                       — FastAPI dependency that yields a DB session
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-29 | GitHub Copilot | Removed stale SQLite migration paths and aligned runtime helpers with PostgreSQL-only deployment
# ============================================================

# ─── 1 IMPORTS ─────────────────────────────────────────────────────────────────
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from typing import Generator

# ─── 2 ENGINE SETUP ────────────────────────────────────────────────────────────
# Import PostgreSQL runtime database configuration
try:
    from backend.db_config import get_database_url
except ImportError:
    from db_config import get_database_url

# Database URL from db_config (PostgreSQL runtime only)
DATABASE_URL = get_database_url()

# PostgreSQL-only runtime: reject SQLite URLs up front.
if DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("SQLite is not supported in this deployment. Configure PostgreSQL DATABASE_URL.")

# PostgreSQL - normalize URL to use psycopg driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=300)

# ─── 3 SCHEMA VERSION TRACKING ─────────────────────────────────────────────────
# Bump this string whenever you add a new migration function
CURRENT_SCHEMA_VERSION = "2026.03.29.3"


def _required_schema_artifacts_present() -> bool:
    """Return True when late-added schema artifacts required by current code exist."""
    try:
        with engine.connect() as conn:
            department_column = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='user' AND column_name='department_id'"
            )).fetchone()
            company_email_column = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='company' AND column_name='company_email'"
            )).fetchone()
            return department_column is not None and company_email_column is not None
    except Exception:
        return False

def _schema_is_current() -> bool:
    """Returns True if schema is already at CURRENT_SCHEMA_VERSION."""
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migration (version TEXT PRIMARY KEY)"))
            result = conn.execute(
                text("SELECT 1 FROM schema_migration WHERE version = :v"),
                {"v": CURRENT_SCHEMA_VERSION}
            ).fetchone()
            return result is not None
    except Exception:
        return False

def _mark_schema_current():
    """Record that the schema is now at CURRENT_SCHEMA_VERSION."""
    try:
        with engine.begin() as conn:
            # Ensure table exists first with explicit DDL
            try:
                conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migration (version TEXT PRIMARY KEY)"))
            except Exception:
                # Table might already exist or permission denied, proceed
                pass

            conn.execute(
                text("INSERT INTO schema_migration (version) VALUES (:v) ON CONFLICT (version) DO NOTHING"),
                {"v": CURRENT_SCHEMA_VERSION}
            )
    except Exception as e:
        print(f"Warning: Could not mark schema version: {e}")

# ─── 4 MIGRATION: DOCUMENT ENTITY_TYPE ENUM -> VARCHAR ─────────────────────────
def _migrate_document_entity_type_enum_to_varchar():
    """Convert document.entity_type from PostgreSQL enum to VARCHAR.

    The Document model defines entity_type as Optional[str], but older
    database schemas created a PostgreSQL enum column. This causes insert
    failures: 'column entity_type is of type entitytype but expression is
    of type character varying'. This migration converts the column to
    VARCHAR and normalises existing values to lowercase.
    """
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


# ─── 15b MIGRATION: SCHEDULE PAYMENT + SERVICE RESOURCE RATE ───────────────────
def _ensure_schedule_payment_columns_if_needed():
    """Add is_paid, discount, sale_transaction_id to schedule;
    schedule_id to sale_transaction; consumption_rate_pct to service_resource."""
    tables = {
        "schedule": {
            "is_paid": "BOOLEAN NOT NULL DEFAULT FALSE",
            "discount": "DOUBLE PRECISION NOT NULL DEFAULT 0.0",
            "sale_transaction_id": "UUID",
        },
        "sale_transaction": {
            "schedule_id": "UUID",
        },
        "service_resource": {
            "consumption_rate_pct": "DOUBLE PRECISION",
        },
    }

    with engine.begin() as conn:
        for table, cols in tables.items():
            tbl_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                f"WHERE table_schema='public' AND table_name='{table}')"
            )).scalar()
            if not tbl_exists:
                continue
            existing = {row[0] for row in conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_schema='public' AND table_name='{table}'"
            )).fetchall()}
            for col, pg_type in cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {pg_type}"))
                    print(f"  + Added column {table}.{col} ({pg_type})")


# ─── MIGRATION: MULTI-TENANCY COMPANY_ID COLUMNS ────────────────────────────────
def _ensure_company_multitenancy_if_needed():
    """Add company_id column to all tenant-scoped tables, create default company,
    and migrate existing data to the default company."""

    # Tables that need company_id (excludes: company, document_blob, database_connection, schema_migration)
    tenant_tables = [
        "user", "user_permission", "role", "role_permission",
        # SQLModel auto-names InventoryImage table as 'inventoryimage' (no underscore).
        # Keep 'inventory_image' as a legacy fallback for older/manual schemas.
        "client", "inventory", "inventoryimage", "inventory_image", "supplier",
        "descriptive_feature", "feature_option", "inventory_feature", "inventory_feature_option_data",
        "service", "service_resource", "service_asset", "service_employee",
        "service_location", "service_recipe",
        "schedule", "schedule_attendee", "schedule_document",
        "attendance", "app_settings", "document", "document_category", "document_assignment",
        "task", "task_link", "leave_request", "onboarding_request", "offboarding_request",
        "insurance_plan", "pay_slip", "sale_transaction", "sale_transaction_item",
        "chat_message", "document_template",
        "product_resource", "product_asset", "product_location", "client_cart_item",
    ]

    DEFAULT_COMPANY_ID = "DEFAULT"
    DEFAULT_COMPANY_NAME = "Default Company"

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS company (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP,
                company_id VARCHAR UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                company_email VARCHAR,
                company_phone VARCHAR,
                company_address TEXT,
                tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
        """))

        company_cols = {row[0] for row in conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='company'"
        )).fetchall()}
        if "company_email" not in company_cols:
            conn.execute(text("ALTER TABLE company ADD COLUMN company_email VARCHAR"))
            print("  + Added company.company_email")
        if "company_phone" not in company_cols:
            conn.execute(text("ALTER TABLE company ADD COLUMN company_phone VARCHAR"))
            print("  + Added company.company_phone")
        if "company_address" not in company_cols:
            conn.execute(text("ALTER TABLE company ADD COLUMN company_address TEXT"))
            print("  + Added company.company_address")
        if "logo_data" not in company_cols:
            conn.execute(text("ALTER TABLE company ADD COLUMN logo_data BYTEA"))
            print("  + Added company.logo_data")
        if "tax_rate" not in company_cols:
            conn.execute(text("ALTER TABLE company ADD COLUMN tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0"))
            print("  + Added company.tax_rate")

        existing = conn.execute(text("SELECT id FROM company LIMIT 1")).fetchone()
        if not existing:
            import uuid as _uuid
            from datetime import datetime as _dt
            default_id = str(_uuid.uuid4())
            conn.execute(text(
                "INSERT INTO company (id, created_at, company_id, name, is_active) "
                "VALUES (:id, :created_at, :company_id, :name, TRUE)"
            ), {"id": default_id, "created_at": _dt.utcnow(), "company_id": DEFAULT_COMPANY_ID, "name": DEFAULT_COMPANY_NAME})
            print(f"  + Created default company '{DEFAULT_COMPANY_ID}'")

        default_row = conn.execute(text("SELECT company_id FROM company LIMIT 1")).fetchone()
        default_cid = default_row[0] if default_row else DEFAULT_COMPANY_ID

        for table in tenant_tables:
            tbl_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                f"WHERE table_schema='public' AND table_name='{table}')"
            )).scalar()
            if not tbl_exists:
                continue
            existing_cols = {row[0] for row in conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_schema='public' AND table_name='{table}'"
            )).fetchall()}
            if "company_id" not in existing_cols:
                quoted = f'"{table}"'
                conn.execute(text(f"ALTER TABLE {quoted} ADD COLUMN company_id VARCHAR"))
                conn.execute(text(f"UPDATE {quoted} SET company_id = :cid WHERE company_id IS NULL"), {"cid": default_cid})
                print(f"  + Added company_id to {table}, set existing rows to '{default_cid}'")

        for table, col in [
            ("client", "name"), ("service", "name"), ("role", "name"),
            ("insurance_plan", "name"), ("inventory", "sku"), ("descriptive_feature", "name"),
        ]:
            try:
                result = conn.execute(text(f"""
                    SELECT tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_schema = 'public'
                      AND tc.table_name = '{table}'
                      AND kcu.column_name = '{col}'
                      AND tc.constraint_type = 'UNIQUE'
                """)).fetchone()
                if result:
                    constraint_name = result[0]
                    conn.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint_name}"))
                    print(f"  + Dropped unique constraint {constraint_name} on {table}.{col}")
            except Exception as e:
                print(f"  Warning: Could not drop unique constraint on {table}.{col}: {e}")


# ─── MIGRATION: ENSURE userrole ENUM HAS ALL EXPECTED VALUES ────────────────────
def _ensure_userrole_enum_values_if_needed():
    """Add any missing values to the userrole PostgreSQL enum (idempotent)."""
    required_values = ["admin", "manager", "employee", "viewer"]
    try:
        with engine.begin() as conn:
            for val in required_values:
                conn.execute(text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{val}'"))
    except Exception as e:
        print(f"  Warning: Could not patch userrole enum: {e}")


# ─── MIGRATION: COMPOSITE UNIQUE CONSTRAINT ON (company_id, username) ───────────
def _ensure_user_username_composite_unique_if_needed():
    """
    Drop the old single-column unique constraint on user.username (and user.email)
    and replace with a composite unique constraint on (company_id, username) so
    the same username can exist across different companies.
    """
    try:
        with engine.begin() as conn:
            # Drop old single-column unique constraint on username if it exists
            for col in ("username", "email"):
                result = conn.execute(text(f"""
                    SELECT tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                       AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = 'public'
                      AND tc.table_name = 'user'
                      AND kcu.column_name = '{col}'
                      AND tc.constraint_type = 'UNIQUE'
                      AND (SELECT COUNT(*) FROM information_schema.key_column_usage k2
                           WHERE k2.constraint_name = tc.constraint_name) = 1
                """)).fetchone()
                if result:
                    conn.execute(text(f'ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "{result[0]}"'))
                    print(f"  + Dropped single-column unique constraint on user.{col}: {result[0]}")

            # Also drop SQLAlchemy-created unique indexes (ix_user_username, ix_user_email)
            for idx in ("ix_user_username", "ix_user_email"):
                idx_exists = conn.execute(text("""
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = 'user' AND indexname = :idx
                """), {"idx": idx}).fetchone()
                if idx_exists:
                    conn.execute(text(f'DROP INDEX IF EXISTS "{idx}"'))
                    print(f"  + Dropped unique index {idx} on user")

            # Add composite unique constraint on (company_id, username) if not already present
            exists = conn.execute(text("""
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'user'
                  AND constraint_name = 'uq_user_company_username'
            """)).fetchone()
            if not exists:
                conn.execute(text(
                    'ALTER TABLE "user" ADD CONSTRAINT uq_user_company_username '
                    'UNIQUE (company_id, username)'
                ))
                print("  + Added composite unique constraint uq_user_company_username on (company_id, username)")
    except Exception as e:
        print(f"  Warning: Could not migrate user username uniqueness: {e}")


# ─── MIGRATION: BUNDLE COMPONENT TABLE ──────────────────────────────────────────
def _ensure_bundle_component_table_if_needed():
    """Create the bundle_component table for bundle item type support."""
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT to_regclass('bundle_component')")).scalar()
        if not exists:
            conn.execute(text("""
                CREATE TABLE bundle_component (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP,
                    bundle_id UUID NOT NULL,
                    component_id UUID NOT NULL,
                    quantity REAL NOT NULL DEFAULT 1.0,
                    notes TEXT,
                    company_id VARCHAR
                )
            """))
            print("  + Created table bundle_component")


# ─── MIGRATION: MIX TABLES ───────────────────────────────────────────────────────
def _ensure_mix_tables_if_needed():
    """Create mix_config and mix_component tables for the mix item type."""
    with engine.begin() as conn:
        def tbl_exists(name):
            return conn.execute(text("SELECT to_regclass(:n)"), {"n": name}).scalar() is not None

        if not tbl_exists("mix_config"):
            conn.execute(text("""
                CREATE TABLE mix_config (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP,
                    inventory_id UUID NOT NULL, total_quantity INTEGER NOT NULL DEFAULT 1,
                    has_max_per_product BOOLEAN NOT NULL DEFAULT FALSE,
                    max_per_product INTEGER, company_id VARCHAR
                )
            """))
            print("  + Created table mix_config")

        if not tbl_exists("mix_component"):
            conn.execute(text("""
                CREATE TABLE mix_component (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP,
                    mix_id UUID NOT NULL, component_id UUID NOT NULL,
                    max_quantity INTEGER, company_id VARCHAR
                )
            """))
            print("  + Created table mix_component")


def _ensure_inventory_price_columns_if_needed():
    """Add price_type and price_percentage columns to inventory for bundle/mix pricing."""
    try:
        with engine.begin() as conn:
            for col, coltype, default in [
                ("price_type", "VARCHAR", "'fixed'"),
                ("price_percentage", "DOUBLE PRECISION", "NULL"),
            ]:
                exists = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='inventory' AND column_name=:c"
                ), {"c": col}).fetchone()
                if not exists:
                    conn.execute(text(f"ALTER TABLE inventory ADD COLUMN {col} {coltype} DEFAULT {default}"))
                    print(f"  + Added inventory.{col}")
    except Exception as e:
        print(f"  Warning: Could not add inventory price columns: {e}")


def _ensure_sale_transaction_item_mix_selections_if_needed():
    """Add mix_selections TEXT column to sale_transaction_item for storing mix pick data."""
    try:
        with engine.begin() as conn:
            exists = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='sale_transaction_item' AND column_name='mix_selections'"
            )).fetchone()
            if not exists:
                conn.execute(text("ALTER TABLE sale_transaction_item ADD COLUMN mix_selections TEXT"))
                print("  + Added sale_transaction_item.mix_selections")
    except Exception as e:
        print(f"  Warning: Could not add mix_selections column: {e}")


def _ensure_sale_transaction_item_options_json_if_needed():
    """Add options_json TEXT column to sale_transaction_item for descriptive feature picks."""
    try:
        with engine.begin() as conn:
            exists = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='sale_transaction_item' AND column_name='options_json'"
            )).fetchone()
            if not exists:
                conn.execute(text("ALTER TABLE sale_transaction_item ADD COLUMN options_json TEXT"))
                print("  + Added sale_transaction_item.options_json")
    except Exception as e:
        print(f"  Warning: Could not add options_json column: {e}")


def _ensure_inventory_feature_combination_table_if_needed():
    """Create inventory_feature_combination for full variant stock tracking."""
    try:
        with engine.begin() as conn:
            exists = conn.execute(text("SELECT to_regclass('inventory_feature_combination')")).scalar()
            if not exists:
                conn.execute(text("""
                    CREATE TABLE inventory_feature_combination (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        created_at TIMESTAMP NOT NULL DEFAULT now(),
                        updated_at TIMESTAMP,
                        inventory_id UUID NOT NULL REFERENCES inventory(id),
                        combination_key VARCHAR NOT NULL,
                        option_ids_json TEXT NOT NULL,
                        quantity INTEGER NOT NULL DEFAULT 0,
                        company_id VARCHAR
                    )
                """))
                conn.execute(text("CREATE INDEX ix_inventory_feature_combination_inventory_id ON inventory_feature_combination (inventory_id)"))
                conn.execute(text("CREATE INDEX ix_inventory_feature_combination_combination_key ON inventory_feature_combination (combination_key)"))
                print("  + Created inventory_feature_combination")
    except Exception as e:
        print(f"  Warning: Could not ensure inventory_feature_combination: {e}")


def _ensure_client_order_workflow_columns_if_needed():
    """Add workflow-tracking columns to client_order and options_json to client_order_item."""
    try:
        with engine.begin() as conn:
            for col, definition in [
                ("employee_id", "UUID"),
                ("paid_at", "TIMESTAMP"),
                ("fulfilled_at", "TIMESTAMP"),
                ("inventory_deducted_at", "TIMESTAMP"),
            ]:
                exists = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='client_order' AND column_name=:c"
                ), {"c": col}).fetchone()
                if not exists:
                    conn.execute(text(f"ALTER TABLE client_order ADD COLUMN {col} {definition}"))
                    print(f"  + Added client_order.{col}")

            status_exists = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='client_order' AND column_name='status'"
            )).fetchone()
            if status_exists:
                conn.execute(text(
                    "UPDATE client_order SET status = 'payment_pending' WHERE status = 'pending'"
                ))
                conn.execute(text(
                    "UPDATE client_order SET status = 'ordered', paid_at = COALESCE(paid_at, updated_at, created_at) WHERE status = 'paid'"
                ))

            options_exists = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='client_order_item' AND column_name='options_json'"
            )).fetchone()
            if not options_exists:
                conn.execute(text("ALTER TABLE client_order_item ADD COLUMN options_json TEXT"))
                print("  + Added client_order_item.options_json")
    except Exception as e:
        print(f"  Warning: Could not ensure client order workflow columns: {e}")


# ─── MIGRATION: DISCOUNT RULE TABLE ─────────────────────────────────────────────
def _ensure_discount_rule_table_if_needed():
    """Create the discount_rule table for scheduled inventory discounts."""
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT to_regclass('discount_rule')")).scalar()
        if not exists:
            conn.execute(text("""
                CREATE TABLE discount_rule (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP,
                    name VARCHAR NOT NULL, applies_to VARCHAR NOT NULL DEFAULT 'all',
                    item_ids TEXT, discount_type VARCHAR NOT NULL DEFAULT 'percentage',
                    discount_value DOUBLE PRECISION NOT NULL DEFAULT 0,
                    start_date TIMESTAMP, end_date TIMESTAMP,
                    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
                    recur_frequency VARCHAR, recur_days TEXT, recur_count INTEGER,
                    times_per_day INTEGER, day_start_time VARCHAR, day_end_time VARCHAR,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE, company_id VARCHAR
                )
            """))
            print("  + Created table discount_rule")


# ─── MIGRATION: MAKE inventory.sku NULLABLE ─────────────────────────────────────
def _ensure_inventory_sku_nullable_if_needed():
    """Drop NOT NULL constraint on inventory.sku so handmade products don't need a SKU."""
    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'sku'
            """)).fetchone()
            if result and result[0] == 'NO':
                conn.execute(text('ALTER TABLE inventory ALTER COLUMN sku DROP NOT NULL'))
                print("  + Made inventory.sku nullable")
    except Exception as e:
        print(f"  Warning: Could not make inventory.sku nullable: {e}")


def _ensure_inventory_category_column_if_needed():
    """Ensure inventory.category exists for environments that predate this column."""
    try:
        with engine.begin() as conn:
            exists = conn.execute(text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'inventory'
                  AND column_name = 'category'
                """
            )).fetchone()
            if not exists:
                conn.execute(text("ALTER TABLE inventory ADD COLUMN category VARCHAR"))
                print("  + Added inventory.category")
    except Exception as e:
        print(f"  Warning: Could not ensure inventory.category: {e}")


def _ensure_inventory_image_db_storage_if_needed():
    """Add image_data (bytea) and mime_type columns to inventoryimage.

    SQLModel auto-names the table 'inventoryimage' (no underscore) from the class name.
    Before this migration images were written to the local filesystem (uploads/)
    which is ephemeral on cloud deployments. Now bytes are stored in the database
    so they survive redeployments indefinitely.
    
    Updates CHECK constraint check_image_source to allow image_data as an alternative
    storage method to image_url or file_path. The revised constraint requires at least
    one of image_url, file_path, or image_data to be non-null.
    """
    try:
        with engine.begin() as conn:
            exists_data = conn.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='inventoryimage' AND column_name='image_data'
            """)).fetchone()
            if not exists_data:
                # Drop the existing check constraint before adding the new column
                conn.execute(text("""
                    ALTER TABLE inventoryimage DROP CONSTRAINT check_image_source
                """))
                print("  - Dropped inventoryimage.check_image_source constraint")
                
                # Add the new storage columns
                conn.execute(text("ALTER TABLE inventoryimage ADD COLUMN image_data BYTEA"))
                print("  + Added inventoryimage.image_data (BYTEA)")

                exists_mime = conn.execute(text("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='inventoryimage' AND column_name='mime_type'
                """)).fetchone()
                if not exists_mime:
                    conn.execute(text("ALTER TABLE inventoryimage ADD COLUMN mime_type VARCHAR"))
                    print("  + Added inventoryimage.mime_type")
                
                # Add revised constraint: at least one storage method must be non-null
                conn.execute(text("""
                    ALTER TABLE inventoryimage ADD CONSTRAINT check_image_source CHECK (
                        (image_url IS NOT NULL) OR
                        (file_path IS NOT NULL) OR
                        (image_data IS NOT NULL)
                    )
                """))
                print("  + Added revised inventoryimage.check_image_source constraint (includes image_data)")
            else:
                # image_data already exists, ensure mime_type is present
                exists_mime = conn.execute(text("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='inventoryimage' AND column_name='mime_type'
                """)).fetchone()
                if not exists_mime:
                    conn.execute(text("ALTER TABLE inventoryimage ADD COLUMN mime_type VARCHAR"))
                    print("  + Added inventoryimage.mime_type")
    except Exception as e:
        print(f"  Warning: Could not add inventoryimage storage columns: {e}")


def _drop_descriptive_feature_name_unique_index_if_needed():
    """Drop the old single-column unique index on descriptive_feature.name.

    Before multi-tenancy, this index was UNIQUE which prevents two companies from
    having a feature with the same name (e.g. both having 'Size'). The composite
    unique constraint uq_descriptive_feature_company_name(company_id, name) is the
    correct constraint now.
    """
    try:
        with engine.begin() as conn:
            exists = conn.execute(text("""
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'descriptive_feature'
                  AND indexname = 'ix_descriptive_feature_name'
            """)).fetchone()
            if exists:
                conn.execute(text("DROP INDEX IF EXISTS ix_descriptive_feature_name"))
                print("  + Dropped legacy unique index ix_descriptive_feature_name")
    except Exception as e:
        print(f"  Warning: Could not drop ix_descriptive_feature_name: {e}")


def _ensure_inventory_category_table_if_needed():
    """Create inventory_category table for item-type-scoped category lookup."""
    try:
        with engine.begin() as conn:
            exists = conn.execute(text(
                "SELECT to_regclass('inventory_category')"
            )).scalar()
            if not exists:
                conn.execute(text("""
                    CREATE TABLE inventory_category (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        item_type VARCHAR NOT NULL,
                        name VARCHAR NOT NULL,
                        company_id VARCHAR,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_inventory_category_item_type ON inventory_category(item_type)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_inventory_category_company_id ON inventory_category(company_id)"))
                print("  + Created inventory_category table")
    except Exception as e:
        print(f"  Warning: Could not create inventory_category table: {e}")


def _ensure_department_table_if_needed():
    """Create department table and add department_id FK column to user table."""
    try:
        with engine.begin() as conn:
            dept_exists = conn.execute(text("SELECT to_regclass('department')")).scalar()
            if not dept_exists:
                conn.execute(text("""
                    CREATE TABLE department (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        name VARCHAR NOT NULL,
                        description VARCHAR,
                        company_id VARCHAR,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_department_name ON department(name)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_department_company_id ON department(company_id)"))
                print("  + Created department table")

            col_exists = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'user' AND column_name = 'department_id'
            """)).fetchone()
            if not col_exists:
                conn.execute(text(
                    'ALTER TABLE "user" ADD COLUMN department_id UUID REFERENCES department(id) ON DELETE SET NULL'
                ))
                print("  + Added department_id to user table")
    except Exception as e:
        print(f"  Warning: Could not set up department table: {e}")


def _ensure_document_tag_tables_if_needed():
    """Create document_tag and document_tag_link tables for document tagging."""
    try:
        with engine.begin() as conn:
            tag_exists = conn.execute(text("SELECT to_regclass('document_tag')")).scalar()
            if not tag_exists:
                conn.execute(text("""
                    CREATE TABLE document_tag (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        name VARCHAR NOT NULL,
                        company_id VARCHAR,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_tag_name ON document_tag(name)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_tag_company_id ON document_tag(company_id)"))
                print("  + Created document_tag table")
            link_exists = conn.execute(text("SELECT to_regclass('document_tag_link')")).scalar()
            if not link_exists:
                conn.execute(text("""
                    CREATE TABLE document_tag_link (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
                        tag_id UUID NOT NULL REFERENCES document_tag(id) ON DELETE CASCADE,
                        company_id VARCHAR,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(document_id, tag_id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_tag_link_document_id ON document_tag_link(document_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_tag_link_tag_id ON document_tag_link(tag_id)"))
                print("  + Created document_tag_link table")
    except Exception as e:
        print(f"  Warning: Could not create document tag tables: {e}")


def _seed_inventory_categories_for_03897():
    """Seed default item categories for company 03897."""
    COMPANY_ID = "03897"
    SEED_CATEGORIES = {
        "product":  ["Clothing", "Accessories", "Electronics", "Footwear", "Home Goods", "Food & Beverage", "Books & Media", "Toys & Games", "Sports & Outdoors"],
        "resource": ["Raw Materials", "Packaging", "Fabric", "Chemicals", "Printing Supplies", "Cleaning Supplies"],
        "asset":    ["Machinery", "Furniture", "Vehicles", "Technology", "Display Equipment", "Tools"],
        "location": ["Storage", "Storefront", "Warehouse", "Office", "Back Room", "Display Floor", "Fitting Room"],
        "item":     ["Miscellaneous", "Sample", "Promotional", "Display Only"],
        "bundle":   ["Starter Pack", "Gift Set", "Seasonal Bundle", "Value Pack"],
        "mix":      ["Custom Mix", "Client Choice", "Variety Pack"],
    }
    try:
        with engine.begin() as conn:
            for item_type, names in SEED_CATEGORIES.items():
                for name in names:
                    existing = conn.execute(text(
                        "SELECT 1 FROM inventory_category WHERE company_id = :c AND item_type = :t AND name = :n"
                    ), {"c": COMPANY_ID, "t": item_type, "n": name}).fetchone()
                    if not existing:
                        conn.execute(text(
                            "INSERT INTO inventory_category (item_type, name, company_id) VALUES (:t, :n, :c)"
                        ), {"t": item_type, "n": name, "c": COMPANY_ID})
        print("  + Seeded inventory categories for company 03897")
    except Exception as e:
        print(f"  Warning: Could not seed inventory categories: {e}")


# ─── MIGRATION: EMPLOYEE LUNCH TIME + INVENTORY PROCUREMENT LEAD ───────────────
def _ensure_employee_lunch_and_procurement_if_needed():
    """Add lunch_start / lunch_duration_minutes to user;
    procurement_lead_days to inventory."""
    tables = {
        "user": {
            "lunch_start": "VARCHAR",
            "lunch_duration_minutes": "INTEGER",
        },
        "inventory": {
            "procurement_lead_days": "INTEGER",
        },
    }
    with engine.begin() as conn:
        for table, cols in tables.items():
            tbl_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                f"WHERE table_schema='public' AND table_name='{table}')"
            )).scalar()
            if not tbl_exists:
                continue
            existing = {row[0] for row in conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_schema='public' AND table_name='{table}'"
            )).fetchall()}
            for col, pg_type in cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE \"{table}\" ADD COLUMN {col} {pg_type}"))
                    print(f"  + Added column {table}.{col} ({pg_type})")


# ─── 16 CREATE DB AND TABLES (ORCHESTRATOR) ────────────────────────────────────
def create_db_and_tables():
    """Run safe migrations to bring schema to current version."""
    try:
        import backend.models  # noqa: F401
    except ModuleNotFoundError:
        import models  # type: ignore  # noqa: F401

    SQLModel.metadata.create_all(engine)

    # Skip migrations only when the version marker and required artifacts match reality.
    if _schema_is_current() and _required_schema_artifacts_present():
        print(f"Schema already at {CURRENT_SCHEMA_VERSION}, skipping migrations.")
        return

    print(f"Running migrations to schema version {CURRENT_SCHEMA_VERSION}...")
    _migrate_document_entity_type_enum_to_varchar()
    _ensure_document_extra_columns_if_needed()
    _ensure_employee_supervisor_column_if_needed()
    _ensure_employee_color_column_if_needed()
    _normalize_item_types_if_needed()
    _ensure_inventory_image_table_if_needed()
    _ensure_service_duration_column_if_needed()
    _ensure_schedule_extra_columns_if_needed()
    _ensure_user_extra_columns_if_needed()
    _ensure_signature_columns_if_needed()
    _ensure_user_profile_picture_if_needed()
    _seed_user_colors_if_needed()
    _seed_insurance_plans_if_needed()
    _ensure_leave_request_supervisor_id_if_needed()
    _ensure_user_payroll_columns_if_needed()
    _ensure_insurance_plan_monthly_deduction_if_needed()
    _ensure_schedule_recurrence_columns_if_needed()
    _ensure_chat_message_table_if_needed()
    _ensure_app_settings_company_columns_if_needed()
    _ensure_app_settings_logo_columns_if_needed()
    _ensure_user_training_mode_if_needed()
    _ensure_schedule_payment_columns_if_needed()
    _ensure_service_recipe_if_needed()
    _ensure_production_tables_if_needed()
    _ensure_bundle_component_table_if_needed()
    _ensure_mix_tables_if_needed()
    _ensure_inventory_price_columns_if_needed()
    _ensure_sale_transaction_item_mix_selections_if_needed()
    _ensure_sale_transaction_item_options_json_if_needed()
    _ensure_inventory_feature_combination_table_if_needed()
    _ensure_client_order_workflow_columns_if_needed()
    _ensure_discount_rule_table_if_needed()
    _ensure_schedule_client_nullable_if_needed()
    _ensure_document_template_name_unique_if_needed()
    _ensure_company_multitenancy_if_needed()
    _backfill_company_logo_from_settings_if_needed()
    _ensure_user_username_composite_unique_if_needed()
    _ensure_userrole_enum_values_if_needed()
    _ensure_inventory_sku_nullable_if_needed()
    _ensure_inventory_category_column_if_needed()
    _ensure_inventory_image_db_storage_if_needed()
    _drop_descriptive_feature_name_unique_index_if_needed()
    _ensure_inventory_category_table_if_needed()
    _seed_inventory_categories_for_03897()
    _ensure_document_tag_tables_if_needed()
    _ensure_department_table_if_needed()
    _ensure_employee_lunch_and_procurement_if_needed()
    _mark_schema_current()
    print("Migrations complete.")

# ─── 18 MIGRATION: PRODUCTION TABLES & SCHEDULE PRODUCTION COLUMNS ─────────────
def _ensure_production_tables_if_needed():
    """Create product_resource, product_asset, product_location tables and
    add production columns to the schedule table for existing databases."""

    with engine.begin() as conn:

        def table_exists(name: str) -> bool:
            return conn.execute(text(
                "SELECT to_regclass(:n)"
            ), {"n": name}).scalar() is not None

        def col_exists(tbl: str, col: str) -> bool:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=:t AND column_name=:c"
            ), {"t": tbl, "c": col}).fetchone()
            return result is not None

        if not table_exists("product_resource"):
            conn.execute(text("""
                CREATE TABLE product_resource (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP,
                    inventory_id UUID NOT NULL,
                    resource_id  UUID NOT NULL,
                    quantity_per_batch REAL NOT NULL DEFAULT 1.0,
                    notes TEXT
                )
            """))
            print("  + Created table product_resource")

        if not table_exists("product_asset"):
            conn.execute(text("""
                CREATE TABLE product_asset (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP,
                    inventory_id UUID NOT NULL,
                    asset_id     UUID NOT NULL,
                    batch_size   INTEGER NOT NULL DEFAULT 1,
                    duration_minutes REAL,
                    notes TEXT
                )
            """))
            print("  + Created table product_asset")

        if not table_exists("product_location"):
            conn.execute(text("""
                CREATE TABLE product_location (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP,
                    inventory_id UUID NOT NULL,
                    location_id  UUID NOT NULL,
                    notes TEXT
                )
            """))
            print("  + Created table product_location")

        if table_exists("schedule"):
            pg_types = {
                "task_type": "VARCHAR DEFAULT 'service'",
                "production_item_id": "UUID",
                "production_quantity": "INTEGER DEFAULT 1",
            }
            for col, pg_type in pg_types.items():
                if not col_exists("schedule", col):
                    conn.execute(text(f"ALTER TABLE schedule ADD COLUMN {col} {pg_type}"))
                    print(f"  + Added column schedule.{col}")


# ─── 19 MIGRATION: SCHEDULE CLIENT_ID NULLABLE ──────────────────────────────────
def _ensure_schedule_client_nullable_if_needed():
    """Make schedule.client_id and service_id nullable so meetings and tasks can exist without a client/service."""
    try:
        with engine.begin() as conn:
            for col in ("client_id", "service_id"):
                row = conn.execute(text(
                    "SELECT is_nullable FROM information_schema.columns "
                    f"WHERE table_name='schedule' AND column_name='{col}'"
                )).fetchone()
                if row and row[0] == "NO":
                    conn.execute(text(f"ALTER TABLE schedule ALTER COLUMN {col} DROP NOT NULL"))
                    print(f"  + Dropped NOT NULL constraint on schedule.{col}")
    except Exception as e:
        print(f"  [WARN] Could not make schedule columns nullable: {e}")


# ─── 20 MIGRATION: DOCUMENT TEMPLATE NAME UNIQUE CONSTRAINT ─────────────────────
def _ensure_document_template_name_unique_if_needed():
    """Ensure document_template name uniqueness is scoped per company.

    The old migration created a single-column unique index on (name) alone, which
    prevents two companies from having templates with the same name (e.g. both
    wanting an "Invoice" template). This migration drops that index and replaces it
    with a composite index on (company_id, name).
    """
    try:
        with engine.begin() as conn:
            # Drop the old single-column unique index if it exists
            old_exists = conn.execute(text(
                "SELECT 1 FROM pg_indexes WHERE tablename='document_template' AND indexname='uq_document_template_name'"
            )).fetchone()
            if old_exists:
                conn.execute(text("DROP INDEX IF EXISTS uq_document_template_name"))
                print("  + Dropped legacy single-column unique index uq_document_template_name")

            # Create composite unique index on (company_id, name) if not already present
            new_exists = conn.execute(text(
                "SELECT 1 FROM pg_indexes WHERE tablename='document_template' AND indexname='uq_document_template_company_name'"
            )).fetchone()
            if not new_exists:
                conn.execute(text(
                    "CREATE UNIQUE INDEX uq_document_template_company_name ON document_template (company_id, name)"
                ))
                print("  + Added composite unique index on document_template (company_id, name)")
    except Exception as e:
        print(f"  [WARN] Could not update unique index on document_template: {e}")


# ─── 17 SESSION DEPENDENCY ─────────────────────────────────────────────────────
def get_session() -> Generator[Session, None, None]:
    """Get database session"""
    with Session(engine) as session:
        yield session

# ─── 5 MIGRATION: ITEM TYPES ──────────────────────────────────────────────────
def _normalize_item_types_if_needed():
    """Normalize legacy item.type values to 'item'.

    Converts any item records with type in ['product', 'asset'] (case-insensitive)
    to 'item'. This helps avoid enum parsing errors at the API layer.
    """
    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='item')"
        )).scalar()
        if not tbl_exists:
            return
        try:
            conn.execute(text(
                "UPDATE item SET type = 'item' WHERE LOWER(type) IN ('product', 'asset')"
            ))
        except Exception:
            try:
                conn.execute(text("UPDATE item SET type = 'item' WHERE type IN ('product','asset','PRODUCT','ASSET')"))
            except Exception:
                pass

# ─── 6 MIGRATION: DOCUMENT EXTRA COLUMNS ───────────────────────────────────────
def _ensure_document_extra_columns_if_needed():
    """Ensure new columns exist on 'document' table: owner_id, review_date, category_id,
    is_signed, signed_by, signed_at.
    """
    extra_cols = {
        "owner_id": "UUID",
        "review_date": "TIMESTAMP WITH TIME ZONE",
        "category_id": "UUID",
        "is_signed": "BOOLEAN NOT NULL DEFAULT FALSE",
        "signed_by": "TEXT",
        "signed_at": "TIMESTAMP WITH TIME ZONE",
    }

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
        for col, pg_type in extra_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE document ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column document.{col} ({pg_type})")

# ─── 7 MIGRATION: EMPLOYEE COLUMNS ─────────────────────────────────────────────


def _ensure_employee_supervisor_column_if_needed():
    """Ensure the 'employee' table has a 'supervisor' column."""
    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='employee')"
        )).scalar()
        if not tbl_exists:
            return
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='employee'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "supervisor" not in col_names:
            conn.execute(text("ALTER TABLE employee ADD COLUMN supervisor VARCHAR"))


def _ensure_employee_color_column_if_needed():
    """Ensure the legacy 'employee' table has a 'color' column.

    Profile color is stored on `user.color` in current schema, but some older
    deployments still depend on data mirrored in `employee.color`.
    """
    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='employee')"
        )).scalar()
        if not tbl_exists:
            return
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='employee'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "color" not in col_names:
            conn.execute(text("ALTER TABLE employee ADD COLUMN color VARCHAR"))


# ─── 8 MIGRATION: INVENTORYIMAGE TABLE ─────────────────────────────────────────
def _ensure_inventory_image_table_if_needed():
    """Ensure InventoryImage table exists and has proper structure."""
    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventoryimage')"
        )).scalar()
        if not tbl_exists:
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

            conn.execute(text(
                "CREATE INDEX idx_inventoryimage_inventory_id ON inventoryimage(inventory_id)"
            ))
            conn.execute(text(
                "CREATE INDEX idx_inventoryimage_is_primary ON inventoryimage(inventory_id, is_primary) WHERE is_primary = TRUE"
            ))
            conn.execute(text(
                "CREATE INDEX idx_inventoryimage_sort_order ON inventoryimage(inventory_id, sort_order)"
            ))

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


# ─── 9 MIGRATION: SERVICE COLUMNS ──────────────────────────────────────────────
def _ensure_service_duration_column_if_needed():
    """Ensure service table has duration_minutes column."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='service'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "duration_minutes" not in col_names:
            conn.execute(text("ALTER TABLE service ADD COLUMN duration_minutes INTEGER DEFAULT 60"))


# ─── 10 MIGRATION: SCHEDULE COLUMNS ────────────────────────────────────────────
def _ensure_schedule_extra_columns_if_needed():
    """Ensure schedule table has appointment_type and duration_minutes columns."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='schedule'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "appointment_type" not in col_names:
            conn.execute(text("ALTER TABLE schedule ADD COLUMN appointment_type VARCHAR DEFAULT 'one_time'"))
        if "duration_minutes" not in col_names:
            conn.execute(text("ALTER TABLE schedule ADD COLUMN duration_minutes INTEGER DEFAULT 60"))

# ─── 11 MIGRATION: USER COLUMNS ────────────────────────────────────────────────
def _ensure_user_extra_columns_if_needed():
    """Ensure user table has employee detail/benefit columns."""
    new_cols = {
        "color": "VARCHAR",
        "iod_number": "VARCHAR",
        "supervisor": "VARCHAR",
        "location": "VARCHAR",
        "salary": "FLOAT",
        "pay_frequency": "VARCHAR",
        "insurance_plan": "VARCHAR",
        "vacation_days": "INTEGER",
        "vacation_days_used": "INTEGER DEFAULT 0",
        "sick_days": "INTEGER",
        "sick_days_used": "INTEGER DEFAULT 0",
    }
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='user'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, col_type in new_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} {col_type}'))


# ─── 11b MIGRATION: USER PROFILE PICTURE ───────────────────────────────────────
def _ensure_user_profile_picture_if_needed():
    """Ensure user table has profile_picture column."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='user'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "profile_picture" not in col_names:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN profile_picture VARCHAR'))


# ─── 15 SEED: USER COLORS ──────────────────────────────────────────────────────
def _seed_user_colors_if_needed():
    """Assign unique colors to users that do not have one."""
    def _hsl_to_hex(h: float, s: float, l: float) -> str:
        c = (1 - abs(2 * l - 1)) * s
        x = c * (1 - abs((h / 60) % 2 - 1))
        m = l - c / 2
        if 0 <= h < 60:
            r, g, b = c, x, 0
        elif 60 <= h < 120:
            r, g, b = x, c, 0
        elif 120 <= h < 180:
            r, g, b = 0, c, x
        elif 180 <= h < 240:
            r, g, b = 0, x, c
        elif 240 <= h < 300:
            r, g, b = x, 0, c
        else:
            r, g, b = c, 0, x
        to_hex = lambda v: f"{int((v + m) * 255):02x}"
        return f"#{to_hex(r)}{to_hex(g)}{to_hex(b)}"

    palette = [
        "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488",
        "#ea580c", "#0891b2", "#b91c1c", "#4f46e5", "#65a30d", "#d97706",
        "#0f766e", "#be123c", "#9333ea", "#15803d", "#c2410c", "#0e7490",
    ]

    user_table = '"user"'
    id_col = "id"
    color_col = "color"

    with engine.begin() as conn:
        # Ensure column exists before seeding
        try:
            existing = conn.execute(text(f"SELECT {id_col}, {color_col} FROM {user_table}"))
        except Exception:
            return

        rows = existing.fetchall()
        if not rows:
            return

        used_colors = set()
        available = [c for c in palette]

        updates = []
        color_index = 0
        hue = 0.0
        hue_step = 37.0

        for user_id, color in rows:
            normalized = color.lower() if color else None
            if normalized and normalized not in used_colors:
                used_colors.add(normalized)
                continue

            if color_index < len(available):
                while color_index < len(available) and available[color_index].lower() in used_colors:
                    color_index += 1
                if color_index < len(available):
                    chosen = available[color_index]
                    color_index += 1
                else:
                    chosen = None
            else:
                chosen = None

            if chosen is None:
                # Generate additional distinct colors if palette is exhausted
                while True:
                    generated = _hsl_to_hex(hue % 360, 0.72, 0.5)
                    hue += hue_step
                    if generated.lower() not in used_colors:
                        chosen = generated
                        break

            used_colors.add(chosen.lower())
            updates.append((str(user_id), chosen))

        if updates:
            for user_id, color in updates:
                conn.execute(
                    text(f"UPDATE {user_table} SET {color_col} = :color WHERE {id_col} = :id"),
                    {"color": color, "id": user_id}
                )


# ─── 11c MIGRATION: SIGNATURE COLUMNS ──────────────────────────────────────────
def _ensure_signature_columns_if_needed():
    """Ensure signature-related columns exist on user and document tables.

    user.signature_data - base64 PNG signature data
    document.signature_image - base64 PNG of signer's signature
    document.signed_by_user_id - FK to user who signed
    """
    user_cols = {
        "signature_data": "TEXT",
    }
    doc_cols = {
        "signature_image": "TEXT",
        "signed_by_user_id": "UUID",
    }

    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='user'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, pg_type in user_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column user.{col} ({pg_type})")

        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='document'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, pg_type in doc_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE document ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column document.{col} ({pg_type})")


# ─── 15b SEED: INSURANCE PLANS ─────────────────────────────────────────────────
def _seed_insurance_plans_if_needed():
    """Seed the insurance_plan table with default plans if it is empty."""
    default_plans = [
        ("Basic Health Plan", "Entry-level coverage for individuals"),
        ("Standard Health Plan", "Comprehensive coverage for employees and dependents"),
        ("Premium Health Plan", "Full-coverage plan with low deductibles"),
        ("Dental & Vision Basic", "Basic dental and vision coverage"),
        ("Dental & Vision Plus", "Enhanced dental and vision with orthodontics"),
        ("Life Insurance - Basic", "Basic term life insurance"),
        ("Life Insurance - Enhanced", "Enhanced life insurance with supplemental benefits"),
        ("Short-Term Disability", "Income protection for short-term disability"),
        ("Long-Term Disability", "Income protection for long-term disability"),
        ("No Coverage", "Employee opted out of insurance coverage"),
    ]

    table = "insurance_plan"

    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:tbl)"
        ), {"tbl": table}).scalar()
        if not tbl_exists:
            return

        count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        if count and count > 0:
            return

        import uuid as _uuid
        from datetime import datetime as _dt
        now = _dt.utcnow().isoformat()
        for name, description in default_plans:
            conn.execute(text(
                f"INSERT INTO {table} (id, name, description, is_active, created_at) "
                "VALUES (:id, :name, :description, :is_active, :created_at)"
            ), {
                "id": str(_uuid.uuid4()),
                "name": name,
                "description": description,
                "is_active": True,
                "created_at": now,
            })
        print(f"✓ Seeded {len(default_plans)} insurance plans")


# ─── 11d MIGRATION: USER PAYROLL COLUMNS ───────────────────────────────────────
def _ensure_user_payroll_columns_if_needed():
    """Ensure user table has hourly_rate and employment_type columns for payroll support."""
    new_cols = {
        "hourly_rate": "FLOAT",
        "employment_type": "VARCHAR",
    }
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='user'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, pg_type in new_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column user.{col} ({pg_type})")


# ─── 11e MIGRATION: INSURANCE PLAN MONTHLY DEDUCTION ───────────────────────────
def _ensure_insurance_plan_monthly_deduction_if_needed():
    """Ensure insurance_plan table has monthly_deduction column."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='insurance_plan'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "monthly_deduction" not in col_names:
            conn.execute(text("ALTER TABLE insurance_plan ADD COLUMN monthly_deduction FLOAT DEFAULT 0"))
            print("  + Added column insurance_plan.monthly_deduction")


# ─── 10b MIGRATION: SCHEDULE RECURRENCE COLUMNS ────────────────────────────────
def _ensure_schedule_recurrence_columns_if_needed():
    """Ensure schedule table has recurrence-related columns."""
    new_cols = {
        "recurrence_frequency": "VARCHAR",
        "recurrence_end_date": "TIMESTAMP WITH TIME ZONE",
        "recurrence_count": "INTEGER",
        "parent_schedule_id": "UUID",
        "is_recurring_master": "BOOLEAN DEFAULT FALSE",
    }
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='schedule'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, col_type in new_cols.items():
            if col not in col_names:
                conn.execute(text(f"ALTER TABLE schedule ADD COLUMN {col} {col_type}"))
                print(f"  + Added column schedule.{col} ({col_type})")


# ─── 14 MIGRATION: CHAT MESSAGE TABLE ──────────────────────────────────────────
def _ensure_chat_message_table_if_needed():
    """Ensure the chat_message table exists with all required columns.

    SQLModel.metadata.create_all creates the table on fresh installs, but
    existing databases that were set up before chat was added need an explicit
    migration to create the table.
    """
    with engine.begin() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='chat_message')"
        )).scalar()
        if not tbl_exists:
            conn.execute(text("""
                CREATE TABLE chat_message (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    sender_id UUID NOT NULL REFERENCES "user"(id),
                    receiver_id UUID NOT NULL REFERENCES "user"(id),
                    content TEXT,
                    message_type VARCHAR NOT NULL DEFAULT 'text',
                    document_id UUID REFERENCES document(id),
                    is_read BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_message_sender_id ON chat_message(sender_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_message_receiver_id ON chat_message(receiver_id)"))
            print("✓ Created chat_message table (PostgreSQL)")


# ─── 12 MIGRATION: LEAVE REQUEST SUPERVISOR ID ─────────────────────────────────
def _ensure_leave_request_supervisor_id_if_needed():
    """Ensure leave_request table has a supervisor_id column."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='leave_request'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "supervisor_id" not in col_names:
            conn.execute(text("ALTER TABLE leave_request ADD COLUMN supervisor_id UUID"))
            print("✓ Added leave_request.supervisor_id (PostgreSQL)")


# ─── 13 MIGRATION: APP SETTINGS COMPANY COLUMNS ────────────────────────────────
def _ensure_app_settings_company_columns_if_needed():
    """Ensure app_settings table has company name, email, phone, and address columns."""
    new_cols = {
        "company_name": "VARCHAR",
        "company_email": "VARCHAR",
        "company_phone": "VARCHAR",
        "company_address": "TEXT",
    }
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='app_settings'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, pg_type in new_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE app_settings ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column app_settings.{col} ({pg_type})")

# ─── MIGRATION: APP SETTINGS LOGO COLUMNS ─────────────────────────────────────
def _ensure_app_settings_logo_columns_if_needed():
    """Ensure app_settings table has logo_data column for company branding."""
    new_cols = {
        "logo_data": "BYTEA",
    }
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='app_settings'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        for col, pg_type in new_cols.items():
            if col not in col_names:
                conn.execute(text(f'ALTER TABLE app_settings ADD COLUMN {col} {pg_type}'))
                print(f"  + Added column app_settings.{col} ({pg_type})")


def _backfill_company_logo_from_settings_if_needed():
    """Move existing logo bytes from app_settings into company when missing."""
    try:
        with engine.begin() as conn:
            company_logo_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='company' AND column_name='logo_data'"
            )).fetchone()
            if not company_logo_exists:
                return

            settings_logo_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='app_settings' AND column_name='logo_data'"
            )).fetchone()
            if not settings_logo_exists:
                return

            conn.execute(text(
                """
                UPDATE company c
                SET logo_data = s.logo_data
                FROM app_settings s
                WHERE s.company_id = c.company_id
                  AND c.logo_data IS NULL
                  AND s.logo_data IS NOT NULL
                """
            ))
    except Exception as e:
        print(f"  Warning: Could not backfill company.logo_data from app_settings: {e}")

# ─── MIGRATION: USER TRAINING MODE ─────────────────────────────────────────────
def _ensure_user_training_mode_if_needed():
    """Ensure user table has training_mode column."""
    with engine.begin() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='user'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "training_mode" not in col_names:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN training_mode BOOLEAN DEFAULT FALSE'))
            print("  + Added column user.training_mode (BOOLEAN)")


# ─── 16 MIGRATION: SERVICE RECIPE TABLE + ASSET DURATION ───────────────────────
def _ensure_service_recipe_if_needed():
    """Create service_recipe table and add asset_duration_minutes to service_asset."""
    with engine.begin() as conn:
        tables = {row[0] for row in conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
        )).fetchall()}
        if "service_recipe" not in tables:
            conn.execute(text("""
                CREATE TABLE service_recipe (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    service_id UUID NOT NULL UNIQUE REFERENCES service(id),
                    is_produced BOOLEAN NOT NULL DEFAULT FALSE,
                    batch_size INTEGER NOT NULL DEFAULT 1,
                    batch_duration_minutes DOUBLE PRECISION,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            print("  + Created service_recipe table (PostgreSQL)")
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='service_asset'"
        )).fetchall()
        col_names = {row[0] for row in cols}
        if "asset_duration_minutes" not in col_names:
            conn.execute(text("ALTER TABLE service_asset ADD COLUMN asset_duration_minutes DOUBLE PRECISION"))
            print("  + Added column service_asset.asset_duration_minutes (DOUBLE PRECISION)")
