#!/usr/bin/env python3
"""
Script to create an admin user in the database.
Safe to run multiple times - will check if admin already exists.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import get_session, create_db_and_tables
from models import User, UserRole
from sqlmodel import select
from datetime import datetime

def create_admin_user():
    """Create admin user if it doesn't exist."""
    print("Checking for admin user...")
    
    # Ensure database tables exist
    create_db_and_tables()
    
    # Get a session
    session = next(get_session())
    
    try:
        # Check if admin user already exists
        statement = select(User).where(User.username == "admin")
        admin_user = session.exec(statement).first()
        
        if admin_user:
            print("SUCCESS: Admin user already exists")
            print(f"   Username: {admin_user.username}")
            print(f"   Role: {admin_user.role}")
            print(f"   Active: {admin_user.is_active}")
            return True
        
        print("Creating admin user...")
        
        # Create admin user with hashed password
        admin_user = User(
            username="admin",
            email="admin@businessmanager.com",
            password_hash=User.hash_password("admin123"),
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True,
            is_locked=False,
            force_password_reset=False
        )
        
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)
        
        print("SUCCESS: Admin user created successfully!")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   Email: admin@businessmanager.com")
        print(f"   Role: {admin_user.role}")
        print(f"   ID: {admin_user.id}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: Error creating admin user: {str(e)}")
        import traceback
        traceback.print_exc()
        session.rollback()
        return False
    finally:
        session.close()

if __name__ == "__main__":
    success = create_admin_user()
    sys.exit(0 if success else 1)
