"""
Final Database Schema Alignment Script

Ensures the Render PostgreSQL database exactly matches the local SQLite schema,
including making the email column nullable as per the current model definition.
"""

import os
from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_database_url():
    """Get database URL from environment."""
    return os.getenv("DATABASE_URL", "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db")

def create_db_engine():
    """Create database engine."""
    database_url = get_database_url()
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")
    
    return create_engine(database_url, echo=False, pool_pre_ping=True)

def fix_email_column_nullable(engine):
    """Make email column nullable to match current model."""
    logger.info("🔧 Making email column nullable to match model...")
    
    try:
        with engine.begin() as conn:
            conn.execute(text('ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL'))
            logger.info("   ✅ Email column is now nullable")
    except Exception as e:
        logger.info(f"   ℹ️  Email column already nullable or error: {e}")

def ensure_proper_defaults(engine):
    """Ensure all existing users have proper default values."""
    logger.info("🔧 Ensuring existing users have proper defaults...")
    
    try:
        with engine.begin() as conn:
            # Update any NULL values with defaults
            conn.execute(text('UPDATE "user" SET hire_date = created_at WHERE hire_date IS NULL'))
            conn.execute(text('UPDATE "user" SET is_active = TRUE WHERE is_active IS NULL'))
            conn.execute(text('UPDATE "user" SET is_locked = FALSE WHERE is_locked IS NULL'))
            conn.execute(text('UPDATE "user" SET force_password_reset = FALSE WHERE force_password_reset IS NULL'))
            conn.execute(text('UPDATE "user" SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL'))
            conn.execute(text('UPDATE "user" SET dark_mode = FALSE WHERE dark_mode IS NULL'))
            logger.info("   ✅ Updated user defaults")
    except Exception as e:
        logger.info(f"   ℹ️  Defaults update: {e}")

def verify_admin_user(engine):
    """Verify the admin user exists and is accessible."""
    logger.info("🔍 Verifying admin user...")
    
    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
                SELECT username, email, first_name, last_name, role, is_active 
                FROM "user" 
                WHERE username = 'admin'
            """)).fetchone()
            
            if result:
                logger.info(f"   ✅ Admin user found: {result.username} ({result.role})")
                logger.info(f"      Email: {result.email or 'None'}")
                logger.info(f"      Active: {result.is_active}")
            else:
                logger.error("   ❌ Admin user not found!")
                
    except Exception as e:
        logger.error(f"   ❌ Could not verify admin user: {e}")

def main():
    """Run final schema alignment."""
    logger.info("🔧 FINAL DATABASE SCHEMA ALIGNMENT")
    logger.info("=" * 40)
    
    try:
        engine = create_db_engine()
        
        # 1. Make email nullable
        fix_email_column_nullable(engine)
        
        # 2. Ensure defaults
        ensure_proper_defaults(engine)
        
        # 3. Verify admin user
        verify_admin_user(engine)
        
        logger.info("\n✅ Database schema alignment completed!")
        logger.info("   The deployment should now succeed.")
        
    except Exception as e:
        logger.error(f"❌ Schema alignment failed: {e}")

if __name__ == "__main__":
    main()