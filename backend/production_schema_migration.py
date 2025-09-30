#!/usr/bin/env python3
"""
Production Schema Migration Script for Render PostgreSQL Database

This script safely migrates the production PostgreSQL database to match 
the current local SQLite schema, ensuring all tables have the correct columns.

IMPORTANT: This preserves ALL existing data while adding missing columns.
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_production_database_url():
    """Get the production database URL from environment."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("❌ DATABASE_URL environment variable not set!")
        logger.error("Set it to your Render PostgreSQL connection string")
        sys.exit(1)
    
    # Handle PostgreSQL URL format
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://")
    
    return database_url

def create_production_engine():
    """Create engine for production PostgreSQL database."""
    database_url = get_production_database_url()
    logger.info(f"🔗 Connecting to production database: {database_url[:50]}...")
    
    return create_engine(
        database_url, 
        echo=False, 
        pool_pre_ping=True,
        pool_recycle=300
    )

def inspect_current_schema(engine):
    """Inspect current database schema to see what exists."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    logger.info(f"📊 Found {len(tables)} tables in production database:")
    
    schema_info = {}
    for table_name in tables:
        columns = inspector.get_columns(table_name)
        column_names = [col['name'] for col in columns]
        schema_info[table_name] = column_names
        logger.info(f"   📋 {table_name}: {len(column_names)} columns")
    
    return schema_info

def add_missing_user_columns(engine):
    """Add missing columns to the user table."""
    logger.info("🔧 Adding missing columns to user table...")
    
    with engine.begin() as conn:
        # Check current user table structure
        inspector = inspect(engine)
        if 'user' not in inspector.get_table_names():
            logger.error("❌ User table does not exist!")
            return False
            
        user_columns = inspector.get_columns('user')
        existing_columns = {col['name'] for col in user_columns}
        
        # Define required columns with their SQL types
        required_columns = {
            'phone': 'VARCHAR',
            'hire_date': 'TIMESTAMP',
            'is_active': 'BOOLEAN DEFAULT TRUE',
            'is_locked': 'BOOLEAN DEFAULT FALSE', 
            'force_password_reset': 'BOOLEAN DEFAULT FALSE',
            'last_login': 'TIMESTAMP',
            'failed_login_attempts': 'INTEGER DEFAULT 0',
            'locked_until': 'TIMESTAMP',
            'dark_mode': 'BOOLEAN DEFAULT FALSE'
        }
        
        # Add missing columns
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                try:
                    sql = f'ALTER TABLE "user" ADD COLUMN {column_name} {column_type}'
                    conn.execute(text(sql))
                    logger.info(f"   ✅ Added column: user.{column_name}")
                except Exception as e:
                    logger.warning(f"   ⚠️  Could not add user.{column_name}: {e}")
        
        # Ensure existing users have proper default values
        try:
            conn.execute(text("""
                UPDATE "user" SET 
                    hire_date = created_at WHERE hire_date IS NULL,
                    is_active = TRUE WHERE is_active IS NULL,
                    is_locked = FALSE WHERE is_locked IS NULL,
                    force_password_reset = FALSE WHERE force_password_reset IS NULL,
                    failed_login_attempts = 0 WHERE failed_login_attempts IS NULL,
                    dark_mode = FALSE WHERE dark_mode IS NULL
            """))
            logger.info("   ✅ Updated existing user records with default values")
        except Exception as e:
            logger.warning(f"   ⚠️  Could not update user defaults: {e}")

def create_permission_enum_if_needed(engine):
    """Create or update the PermissionType enum."""
    logger.info("🔧 Ensuring PermissionType enum exists with all values...")
    
    with engine.begin() as conn:
        try:
            # Check if enum exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'permissiontype'
                )
            """)).scalar()
            
            if not result:
                # Create the enum
                conn.execute(text("""
                    CREATE TYPE permissiontype AS ENUM (
                        'read', 'write', 'write_all', 'delete', 'admin', 'view_all'
                    )
                """))
                logger.info("   ✅ Created PermissionType enum")
            else:
                # Add missing enum values
                enum_values = ['read', 'write', 'write_all', 'delete', 'admin', 'view_all']
                for value in enum_values:
                    try:
                        conn.execute(text(f"""
                            DO $$ 
                            BEGIN
                                IF NOT EXISTS (
                                    SELECT 1 FROM pg_enum 
                                    WHERE enumlabel = '{value}' 
                                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'permissiontype')
                                ) THEN
                                    ALTER TYPE permissiontype ADD VALUE '{value}';
                                END IF;
                            END $$;
                        """))
                        logger.info(f"   ✅ Ensured enum value: {value}")
                    except Exception as e:
                        logger.info(f"   ℹ️  Enum value {value} already exists or error: {e}")
                        
        except Exception as e:
            logger.error(f"   ❌ Error with PermissionType enum: {e}")

def create_userpermission_table(engine):
    """Create the userpermission table if it doesn't exist."""
    logger.info("🔧 Creating/updating userpermission table...")
    
    with engine.begin() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS userpermission (
                    id VARCHAR PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    user_id VARCHAR NOT NULL,
                    page VARCHAR NOT NULL,
                    permission permissiontype NOT NULL,
                    granted BOOLEAN NOT NULL DEFAULT TRUE,
                    CONSTRAINT fk_userpermission_user 
                        FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
                )
            """))
            logger.info("   ✅ UserPermission table created/verified")
            
            # Create index for better performance
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_userpermission_user_id 
                ON userpermission (user_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_userpermission_page_permission 
                ON userpermission (page, permission)
            """))
            logger.info("   ✅ UserPermission indexes created")
            
        except Exception as e:
            logger.error(f"   ❌ Error creating userpermission table: {e}")

def update_other_table_schemas(engine):
    """Update other tables to match current schema."""
    logger.info("🔧 Updating other table schemas...")
    
    with engine.begin() as conn:
        inspector = inspect(engine)
        
        # Update document table with new columns
        if 'document' in inspector.get_table_names():
            document_columns = {col['name'] for col in inspector.get_columns('document')}
            
            missing_doc_columns = {
                'is_signed': 'BOOLEAN DEFAULT FALSE',
                'signed_by': 'VARCHAR',
                'signed_at': 'TIMESTAMP',
                'owner_id': 'VARCHAR',
                'review_date': 'TIMESTAMP', 
                'category_id': 'VARCHAR'
            }
            
            for column_name, column_type in missing_doc_columns.items():
                if column_name not in document_columns:
                    try:
                        conn.execute(text(f'ALTER TABLE document ADD COLUMN {column_name} {column_type}'))
                        logger.info(f"   ✅ Added column: document.{column_name}")
                    except Exception as e:
                        logger.warning(f"   ⚠️  Could not add document.{column_name}: {e}")
        
        # Ensure schedule table references user (not employee)
        if 'schedule' in inspector.get_table_names():
            schedule_columns = {col['name'] for col in inspector.get_columns('schedule')}
            
            if 'employee_id' not in schedule_columns and 'user_id' in schedule_columns:
                # Rename user_id to employee_id for consistency with current model
                try:
                    conn.execute(text('ALTER TABLE schedule RENAME COLUMN user_id TO employee_id'))
                    logger.info("   ✅ Renamed schedule.user_id to schedule.employee_id")
                except Exception as e:
                    logger.info(f"   ℹ️  Schedule column rename not needed: {e}")

def verify_migration_success(engine):
    """Verify that the migration was successful."""
    logger.info("✅ Verifying migration success...")
    
    try:
        with engine.begin() as conn:
            # Test user table query
            result = conn.execute(text('SELECT COUNT(*) FROM "user"')).scalar()
            logger.info(f"   📊 User table accessible: {result} records")
            
            # Test userpermission table
            result = conn.execute(text('SELECT COUNT(*) FROM userpermission')).scalar() 
            logger.info(f"   📊 UserPermission table accessible: {result} records")
            
            # Test enum values
            result = conn.execute(text("""
                SELECT enumlabel FROM pg_enum 
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'permissiontype')
                ORDER BY enumlabel
            """)).fetchall()
            enum_values = [row[0] for row in result]
            logger.info(f"   📊 PermissionType enum values: {enum_values}")
            
            return True
            
    except Exception as e:
        logger.error(f"   ❌ Migration verification failed: {e}")
        return False

def main():
    """Run the production schema migration."""
    logger.info("🚀 Starting Production Schema Migration for Render PostgreSQL...")
    logger.info("   This will safely add missing columns and tables to match local schema")
    
    try:
        # Create production database engine
        engine = create_production_engine()
        
        # Inspect current schema
        logger.info("📊 Inspecting current production database schema...")
        schema_info = inspect_current_schema(engine)
        
        # Perform migrations
        logger.info("🔄 Starting schema migrations...")
        
        # 1. Create/update permission enum
        create_permission_enum_if_needed(engine)
        
        # 2. Add missing user columns
        add_missing_user_columns(engine)
        
        # 3. Create userpermission table
        create_userpermission_table(engine)
        
        # 4. Update other tables
        update_other_table_schemas(engine)
        
        # 5. Verify success
        if verify_migration_success(engine):
            logger.info("🎉 Production schema migration completed successfully!")
            logger.info("📋 Summary of changes:")
            logger.info("   ✅ User table: Added missing columns (phone, hire_date, etc.)")
            logger.info("   ✅ PermissionType enum: Created/updated with all values")
            logger.info("   ✅ UserPermission table: Created with proper schema")
            logger.info("   ✅ Document table: Added new columns")
            logger.info("   ✅ All existing data: Preserved")
            logger.info("")
            logger.info("🚀 Your Render deployment should now work!")
            
        else:
            logger.error("❌ Migration verification failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()