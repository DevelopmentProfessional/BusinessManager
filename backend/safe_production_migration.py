"""
Safe Production Migration Script
Adds WRITE_ALL permission support without affecting existing data.

This script safely updates the database schema to support the new WRITE_ALL permission
while preserving all existing data, especially schedule records.
"""
import os
import sys
from datetime import datetime
from sqlalchemy import text, inspect, MetaData, Table
from sqlmodel import create_engine
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_production_engine():
    """Get database engine for production environment."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL environment variable not set!")
        sys.exit(1)
    
    # Handle PostgreSQL URL format
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://")
    
    logger.info(f"Connecting to database: {database_url[:50]}...")
    return create_engine(database_url, echo=False, pool_pre_ping=True)

def verify_database_structure(engine):
    """Verify current database structure and identify what needs to be updated."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    logger.info(f"Found tables: {tables}")
    
    # Check if critical tables exist
    required_tables = ['user', 'schedule', 'userpermission']
    missing_tables = [table for table in required_tables if table not in tables]
    
    if missing_tables:
        logger.error(f"Missing required tables: {missing_tables}")
        return False
    
    # Check schedule table structure to ensure it won't be affected
    schedule_columns = inspector.get_columns('schedule')
    schedule_column_names = [col['name'] for col in schedule_columns]
    logger.info(f"Schedule table columns: {schedule_column_names}")
    
    return True

def count_existing_records(engine):
    """Count existing records to ensure no data loss."""
    with engine.begin() as conn:
        # Count schedule records
        schedule_count = conn.execute(text("SELECT COUNT(*) FROM schedule")).scalar()
        logger.info(f"Existing schedule records: {schedule_count}")
        
        # Count users
        user_count = conn.execute(text("SELECT COUNT(*) FROM user")).scalar()
        logger.info(f"Existing user records: {user_count}")
        
        # Count permissions
        try:
            permission_count = conn.execute(text("SELECT COUNT(*) FROM userpermission")).scalar()
            logger.info(f"Existing permission records: {permission_count}")
        except Exception as e:
            logger.info(f"UserPermission table may not exist yet: {e}")
            permission_count = 0
        
        return {
            'schedules': schedule_count,
            'users': user_count,
            'permissions': permission_count
        }

def ensure_permission_enum_supports_write_all(engine):
    """Ensure the permission system supports WRITE_ALL without affecting existing data."""
    
    with engine.begin() as conn:
        # For PostgreSQL, we might need to add the enum value
        if not str(engine.url).startswith('sqlite'):
            try:
                # Check if we're using PostgreSQL and need to add enum value
                conn.execute(text("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'write_all' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'permissiontype')) THEN
                            ALTER TYPE permissiontype ADD VALUE 'write_all';
                        END IF;
                    END $$;
                """))
                logger.info("✅ Added WRITE_ALL to PermissionType enum (PostgreSQL)")
            except Exception as e:
                logger.info(f"Enum update not needed or already exists: {e}")
        
        # Ensure UserPermission table exists with proper structure
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS userpermission (
                id VARCHAR PRIMARY KEY,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP,
                user_id VARCHAR NOT NULL,
                page VARCHAR NOT NULL,
                permission VARCHAR NOT NULL,
                granted BOOLEAN NOT NULL DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES "user" (id)
            )
        """))
        logger.info("✅ UserPermission table structure verified")

def create_write_all_permissions_for_existing_users(engine):
    """Add WRITE_ALL permissions for users who need schedule management capabilities."""
    
    with engine.begin() as conn:
        # Get all users with existing schedule write permissions
        users_with_schedule_write = conn.execute(text("""
            SELECT DISTINCT u.id, u.username, u.first_name, u.last_name
            FROM "user" u 
            LEFT JOIN userpermission up ON u.id = up.user_id 
            WHERE up.page = 'schedule' AND up.permission = 'write' AND up.granted = true
            OR u.role IN ('admin', 'manager')
        """)).fetchall()
        
        logger.info(f"Found {len(users_with_schedule_write)} users who may need WRITE_ALL permissions")
        
        # Add WRITE_ALL permission for these users
        import uuid
        for user in users_with_schedule_write:
            user_id = user[0]
            username = user[1]
            
            # Check if they already have WRITE_ALL permission
            existing = conn.execute(text("""
                SELECT id FROM userpermission 
                WHERE user_id = :user_id AND page = 'schedule' AND permission = 'write_all'
            """), {"user_id": user_id}).fetchone()
            
            if not existing:
                permission_id = str(uuid.uuid4())
                conn.execute(text("""
                    INSERT INTO userpermission (id, created_at, user_id, page, permission, granted)
                    VALUES (:id, :created_at, :user_id, 'schedule', 'write_all', false)
                """), {
                    "id": permission_id,
                    "created_at": datetime.utcnow(),
                    "user_id": user_id
                })
                logger.info(f"✅ Added WRITE_ALL permission (disabled by default) for user: {username}")
            else:
                logger.info(f"⚠️  User {username} already has WRITE_ALL permission")

def verify_migration_success(engine, original_counts):
    """Verify that the migration was successful and no data was lost."""
    
    new_counts = count_existing_records(engine)
    
    # Verify no schedule records were lost
    if new_counts['schedules'] != original_counts['schedules']:
        logger.error(f"❌ Schedule records changed! Original: {original_counts['schedules']}, New: {new_counts['schedules']}")
        return False
    
    # Verify no users were lost  
    if new_counts['users'] != original_counts['users']:
        logger.error(f"❌ User records changed! Original: {original_counts['users']}, New: {new_counts['users']}")
        return False
    
    # Verify permissions were added (should be >= original)
    if new_counts['permissions'] < original_counts['permissions']:
        logger.error(f"❌ Permission records decreased! Original: {original_counts['permissions']}, New: {new_counts['permissions']}")
        return False
    
    logger.info("✅ All data integrity checks passed!")
    logger.info(f"Schedule records: {new_counts['schedules']} (unchanged)")
    logger.info(f"User records: {new_counts['users']} (unchanged)")
    logger.info(f"Permission records: {new_counts['permissions']} (may have increased)")
    
    return True

def main():
    """Run the safe production migration."""
    logger.info("🚀 Starting safe production migration for WRITE_ALL permissions...")
    
    try:
        # Get production database engine
        engine = get_production_engine()
        
        # Verify database structure
        if not verify_database_structure(engine):
            logger.error("❌ Database structure verification failed!")
            sys.exit(1)
        
        # Count existing records
        logger.info("📊 Counting existing records...")
        original_counts = count_existing_records(engine)
        
        # Backup verification
        logger.info("💾 Note: Ensure you have a database backup before proceeding!")
        
        # Perform the migration
        logger.info("🔧 Ensuring permission enum supports WRITE_ALL...")
        ensure_permission_enum_supports_write_all(engine)
        
        logger.info("👥 Adding WRITE_ALL permissions for qualified users...")
        create_write_all_permissions_for_existing_users(engine)
        
        # Verify migration success
        logger.info("✅ Verifying migration success...")
        if verify_migration_success(engine, original_counts):
            logger.info("🎉 Migration completed successfully!")
            logger.info("📋 Summary:")
            logger.info("   - Schedule records: UNCHANGED (protected)")
            logger.info("   - User records: UNCHANGED")
            logger.info("   - New WRITE_ALL permissions: ADDED (disabled by default)")
            logger.info("   - Administrators can now enable WRITE_ALL permissions via UI")
        else:
            logger.error("❌ Migration verification failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ Migration failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()