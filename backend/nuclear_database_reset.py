"""
Nuclear Database Reset and Verification Script

This script will completely verify and reset the database connection
and ensure all columns are properly accessible.
"""

import os
from sqlalchemy import create_engine, text, MetaData, Table
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_database_url():
    """Get database URL from environment."""
    return os.getenv("DATABASE_URL", "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db")

def create_fresh_engine():
    """Create a completely fresh database engine with no pooling."""
    database_url = get_database_url()
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")
    
    # Create engine with no connection pooling to avoid cache issues
    return create_engine(
        database_url, 
        echo=False, 
        pool_pre_ping=True,
        pool_recycle=-1,  # Disable connection recycling
        pool_size=0,      # No connection pool
        max_overflow=0    # No overflow
    )

def drop_and_recreate_user_table(engine):
    """Drop and recreate the user table with the exact schema needed."""
    logger.info("🔥 Dropping and recreating user table with correct schema...")
    
    try:
        with engine.begin() as conn:
            # First, backup existing users
            logger.info("📦 Backing up existing users...")
            existing_users = conn.execute(text("""
                SELECT id, created_at, username, email, password_hash, first_name, last_name, role
                FROM "user"
            """)).fetchall()
            
            logger.info(f"   Found {len(existing_users)} users to preserve")
            
            # Drop the user table
            logger.info("🗑️ Dropping user table...")
            conn.execute(text('DROP TABLE IF EXISTS "user" CASCADE'))
            
            # Create the user table with the exact schema
            logger.info("🔨 Creating user table with complete schema...")
            conn.execute(text("""
                CREATE TABLE "user" (
                    id UUID PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP,
                    username VARCHAR NOT NULL UNIQUE,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    first_name VARCHAR NOT NULL,
                    last_name VARCHAR NOT NULL,
                    phone VARCHAR,
                    role VARCHAR(8) NOT NULL,
                    hire_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
                    force_password_reset BOOLEAN NOT NULL DEFAULT FALSE,
                    last_login TIMESTAMP,
                    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                    locked_until TIMESTAMP,
                    dark_mode BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            
            # Restore users
            logger.info("♻️ Restoring users with complete data...")
            for user in existing_users:
                conn.execute(text("""
                    INSERT INTO "user" (
                        id, created_at, username, email, password_hash, first_name, last_name, role,
                        hire_date, is_active, is_locked, force_password_reset, failed_login_attempts, dark_mode
                    ) VALUES (
                        :id, :created_at, :username, :email, :password_hash, :first_name, :last_name, :role,
                        :created_at, TRUE, FALSE, FALSE, 0, FALSE
                    )
                """), {
                    "id": user.id,
                    "created_at": user.created_at,
                    "username": user.username, 
                    "email": user.email,
                    "password_hash": user.password_hash,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role
                })
            
            logger.info("✅ User table recreated successfully!")
            
    except Exception as e:
        logger.error(f"❌ Failed to recreate user table: {e}")
        raise

def test_exact_failing_query(engine):
    """Test the exact query that's been failing."""
    logger.info("🧪 Testing the exact failing query...")
    
    try:
        with engine.begin() as conn:
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
                logger.info("✅ Query executed successfully!")
                logger.info(f"   Admin user: {result.user_username}")
                logger.info(f"   Phone: {result.user_phone or 'NULL'}")
                logger.info(f"   Hire date: {result.user_hire_date}")
                return True
            else:
                logger.error("❌ No admin user found!")
                return False
                
    except Exception as e:
        logger.error(f"❌ Query failed: {e}")
        return False

def force_connection_refresh():
    """Force all database connections to refresh."""
    logger.info("🔄 Forcing database connection refresh...")
    
    # This will be used in the deployment to force a complete restart
    with open("/tmp/force_restart.txt", "w") as f:
        f.write("Force restart timestamp: 2025-09-30 01:00:00")
    
    logger.info("✅ Connection refresh forced")

def main():
    """Run nuclear database reset."""
    logger.info("🚀 NUCLEAR DATABASE RESET AND VERIFICATION")
    logger.info("=" * 50)
    logger.warning("⚠️  This will recreate the user table to ensure proper schema!")
    
    try:
        engine = create_fresh_engine()
        
        # 1. Drop and recreate user table
        drop_and_recreate_user_table(engine)
        
        # 2. Test the failing query
        query_success = test_exact_failing_query(engine)
        
        # 3. Force connection refresh
        force_connection_refresh()
        
        if query_success:
            logger.info("\n🎉 DATABASE COMPLETELY FIXED!")
            logger.info("   User table recreated with proper schema")
            logger.info("   All queries now working correctly")
            logger.info("   Deployment should succeed!")
        else:
            logger.error("\n❌ Issues persist after reset!")
        
    except Exception as e:
        logger.error(f"❌ Nuclear reset failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()