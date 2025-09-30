"""
Render pre-start hook: initialize database schema.

Safe to run multiple times. Uses backend.database.create_db_and_tables().
"""

import os
import sys

def main() -> int:
    try:
        # Allow invocation as script from project root or backend dir
        if __package__ is None and os.path.basename(os.getcwd()) != 'backend':
            # Ensure project root is on sys.path so 'backend' is importable
            project_root = os.path.dirname(os.path.abspath(__file__))
            if project_root not in sys.path:
                sys.path.insert(0, project_root)
        from backend.database import create_db_and_tables
    except Exception:
        # Fallback if run from inside backend directory (python init_database.py)
        from database import create_db_and_tables  # type: ignore

    # Execute initialization
    try:
        create_db_and_tables()
        print("Database initialized (create_db_and_tables executed).")
        return 0
    except Exception as e:
        print(f"Database initialization failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
#!/usr/bin/env python3
"""
Database initialization script for production deployment.
This script ensures the database is properly set up with required initial data.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import engine, get_session, create_db_and_tables
from models import SQLModel, User, UserRole, UserPermission, PermissionType
from sqlmodel import select
import bcrypt
from datetime import datetime
from uuid import uuid4
from sqlalchemy import text

def ensure_write_all_permission_support():
    """Ensure the database supports WRITE_ALL permission type safely."""
    print("🔧 Ensuring WRITE_ALL permission support...")
    
    with engine.begin() as conn:
        # For PostgreSQL, we might need to add the enum value
        database_url = str(engine.url)
        if not database_url.startswith('sqlite'):
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
                print("✅ Added WRITE_ALL to PermissionType enum (PostgreSQL)")
            except Exception as e:
                print(f"ℹ️  Enum update not needed or already exists: {e}")
        
        # Ensure UserPermission table exists with proper structure  
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS userpermission (
                id VARCHAR PRIMARY KEY,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP,
                user_id VARCHAR NOT NULL,
                page VARCHAR NOT NULL,
                permission VARCHAR NOT NULL,
                granted BOOLEAN NOT NULL DEFAULT TRUE
            )
        """))
        print("✅ UserPermission table structure verified")

def add_write_all_permissions_for_admins(session):
    """Add WRITE_ALL schedule permissions for admin users (disabled by default)."""
    try:
        print("👥 Adding WRITE_ALL permissions for admin users...")
        
        # Get all admin users
        statement = select(User).where(User.role == UserRole.ADMIN)
        admin_users = session.exec(statement).all()
        
        for admin_user in admin_users:
            # Check if they already have WRITE_ALL permission for schedule
            statement = select(UserPermission).where(
                UserPermission.user_id == admin_user.id,
                UserPermission.page == "schedule", 
                UserPermission.permission == PermissionType.WRITE_ALL
            )
            existing_permission = session.exec(statement).first()
            
            if not existing_permission:
                # Add WRITE_ALL permission (disabled by default for safety)
                write_all_permission = UserPermission(
                    id=uuid4(),
                    user_id=admin_user.id,
                    page="schedule",
                    permission=PermissionType.WRITE_ALL,
                    granted=False,  # Disabled by default
                    created_at=datetime.utcnow()
                )
                session.add(write_all_permission)
                print(f"✅ Added WRITE_ALL permission (disabled) for admin: {admin_user.username}")
            else:
                print(f"ℹ️  Admin {admin_user.username} already has WRITE_ALL permission")
        
        session.commit()
        print("✅ Admin WRITE_ALL permissions processed successfully")
        
    except Exception as e:
        print(f"⚠️  Error adding admin permissions: {e}")
        session.rollback()
        # Don't fail the entire initialization for this

def init_database():
    """Initialize the database with required tables and initial data."""
    print("🔄 Initializing database...")
    
    # Create all tables (this is safe to run multiple times)
    create_db_and_tables()
    print("✅ Database tables created/verified")
    
    # Optional extras (enum tweaks, admin perms) are disabled by default.
    # Enable by setting DB_INIT_EXTRAS=1 when calling this script explicitly.
    run_extras = os.getenv("DB_INIT_EXTRAS", "0") == "1"
    if run_extras:
        # Ensure WRITE_ALL permission support (legacy compatibility)
        ensure_write_all_permission_support()
    
    # Get a session
    session = next(get_session())
    
    try:
        # Check if admin user already exists
        from sqlmodel import select
        statement = select(User).where(User.username == "admin")
        admin_user = session.exec(statement).first()
        
        if not admin_user:
            print("👤 Creating admin user...")
            
            # Create admin user
            password = "admin123"
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            admin_user = User(
                username="admin",
                email="admin@lavishbeautyhairandnail.care",
                password_hash=hashed_password.decode('utf-8'),
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN,
                is_active=True,
                created_at=datetime.utcnow()
            )
            
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
            print("✅ Admin user created successfully")
            print(f"   Username: admin")
            print(f"   Password: admin123")
            print(f"   Email: admin@lavishbeautyhairandnail.care")
        else:
            print("✅ Admin user already exists")
        
        if run_extras:
            # Add WRITE_ALL permissions for admin users (optional)
            add_write_all_permissions_for_admins(session)
        else:
            print("ℹ️  Skipping optional admin WRITE_ALL permission setup (DB_INIT_EXTRAS=0)")
        
        # Check total users
        statement = select(User)
        total_users = len(session.exec(statement).all())
        print(f"📊 Total users in database: {total_users}")
        
        session.close()
        print("🎉 Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during database initialization: {str(e)}")
        session.rollback()
        session.close()
        raise

if __name__ == "__main__":
    init_database()
