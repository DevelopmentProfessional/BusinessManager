"""
Database Diagnostic Tool - Check Current Render Database Schema

This script will inspect the current Render database schema and show
exactly what columns exist vs what our application expects.
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_database_url():
    """Get database URL from environment."""
    return os.getenv("DATABASE_URL", "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db")

def create_db_engine():
    """Create database engine."""
    database_url = get_database_url()
    
    # Use psycopg2 for compatibility
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")
    
    return create_engine(database_url, echo=False, pool_pre_ping=True)

def inspect_user_table(engine):
    """Inspect the user table structure in detail."""
    logger.info("🔍 Inspecting USER table structure...")
    
    inspector = inspect(engine)
    
    if 'user' not in inspector.get_table_names():
        logger.error("❌ USER table does not exist!")
        return False
    
    # Get detailed column information
    columns = inspector.get_columns('user')
    logger.info(f"📊 USER table has {len(columns)} columns:")
    
    expected_columns = [
        'id', 'created_at', 'updated_at', 'username', 'email', 'password_hash',
        'first_name', 'last_name', 'phone', 'role', 'hire_date', 'is_active',
        'is_locked', 'force_password_reset', 'last_login', 'failed_login_attempts',
        'locked_until', 'dark_mode'
    ]
    
    existing_columns = []
    for col in columns:
        col_info = f"   {col['name']} ({col['type']})"
        if col.get('nullable') is False:
            col_info += " NOT NULL"
        if col.get('default') is not None:
            col_info += f" DEFAULT {col['default']}"
        
        logger.info(col_info)
        existing_columns.append(col['name'])
    
    # Check for missing columns
    missing_columns = set(expected_columns) - set(existing_columns)
    extra_columns = set(existing_columns) - set(expected_columns)
    
    if missing_columns:
        logger.error(f"❌ Missing columns: {list(missing_columns)}")
    else:
        logger.info("✅ All expected columns are present")
    
    if extra_columns:
        logger.info(f"ℹ️  Extra columns: {list(extra_columns)}")
    
    return len(missing_columns) == 0

def test_user_query(engine):
    """Test the exact query that's failing."""
    logger.info("🧪 Testing problematic user query...")
    
    try:
        with engine.begin() as conn:
            # Try the exact query from the error
            result = conn.execute(text("""
                SELECT "user".id AS user_id, "user".created_at AS user_created_at, 
                       "user".updated_at AS user_updated_at, "user".username AS user_username, 
                       "user".email AS user_email, "user".password_hash AS user_password_hash, 
                       "user".first_name AS user_first_name, "user".last_name AS user_last_name, 
                       "user".phone AS user_phone, "user".role AS user_role, 
                       "user".hire_date AS user_hire_date, "user".is_active AS user_is_active, 
                       "user".is_locked AS user_is_locked, "user".force_password_reset AS user_force_password_reset, 
                       "user".last_login AS user_last_login, "user".failed_login_attempts AS user_failed_login_attempts, 
                       "user".locked_until AS user_locked_until, "user".dark_mode AS user_dark_mode 
                FROM "user" 
                WHERE "user".username = :username 
                LIMIT 1
            """), {"username": "admin"}).fetchone()
            
            if result:
                logger.info("✅ User query executed successfully!")
                logger.info(f"   Found user: {result.username}")
            else:
                logger.info("⚠️  Query executed but no admin user found")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ User query failed: {e}")
        return False

def add_missing_columns_again(engine):
    """Add any missing columns that weren't added properly."""
    logger.info("🔧 Adding any missing columns...")
    
    with engine.begin() as conn:
        # List of columns to ensure exist
        columns_to_add = {
            'phone': 'VARCHAR',
            'hire_date': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'is_active': 'BOOLEAN DEFAULT TRUE',
            'is_locked': 'BOOLEAN DEFAULT FALSE',
            'force_password_reset': 'BOOLEAN DEFAULT FALSE',
            'last_login': 'TIMESTAMP',
            'failed_login_attempts': 'INTEGER DEFAULT 0',
            'locked_until': 'TIMESTAMP',
            'dark_mode': 'BOOLEAN DEFAULT FALSE'
        }
        
        inspector = inspect(engine)
        existing_columns = {col['name'] for col in inspector.get_columns('user')}
        
        for column_name, column_type in columns_to_add.items():
            if column_name not in existing_columns:
                try:
                    sql = f'ALTER TABLE "user" ADD COLUMN {column_name} {column_type}'
                    conn.execute(text(sql))
                    logger.info(f"   ✅ Added missing column: {column_name}")
                except Exception as e:
                    logger.error(f"   ❌ Failed to add {column_name}: {e}")
            else:
                logger.info(f"   ✅ Column {column_name} already exists")

def main():
    """Run comprehensive database diagnostic."""
    logger.info("🔍 RENDER DATABASE DIAGNOSTIC TOOL")
    logger.info("=" * 50)
    
    try:
        engine = create_db_engine()
        logger.info("✅ Connected to Render database")
        
        # 1. Inspect user table structure
        user_table_ok = inspect_user_table(engine)
        
        # 2. If missing columns, add them
        if not user_table_ok:
            logger.info("\n🔧 Attempting to fix missing columns...")
            add_missing_columns_again(engine)
            
            # Re-inspect after fixing
            logger.info("\n🔍 Re-inspecting after fixes...")
            user_table_ok = inspect_user_table(engine)
        
        # 3. Test the problematic query
        logger.info("\n🧪 Testing user query...")
        query_ok = test_user_query(engine)
        
        # 4. Summary
        logger.info("\n📊 DIAGNOSTIC SUMMARY:")
        logger.info(f"   User table structure: {'✅ OK' if user_table_ok else '❌ Issues found'}")
        logger.info(f"   User query test: {'✅ OK' if query_ok else '❌ Failed'}")
        
        if user_table_ok and query_ok:
            logger.info("\n🎉 Database appears to be working correctly!")
            logger.info("   The deployment issue might be a cache or restart problem.")
            logger.info("   Try triggering a fresh deployment.")
        else:
            logger.info("\n⚠️  Issues found. Check the logs above for details.")
        
    except Exception as e:
        logger.error(f"❌ Diagnostic failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()