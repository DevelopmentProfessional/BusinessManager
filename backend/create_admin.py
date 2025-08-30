#!/usr/bin/env python3
"""
Script to create an admin user in the database.
Run this script to create the initial admin user for the Business Manager application.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from database import engine
from models import User, UserRole

def create_admin_user():
    """Create an admin user if it doesn't exist"""
    with Session(engine) as session:
        # Check if admin user already exists
        admin_user = session.exec(
            select(User).where(User.username == "admin")
        ).first()
        
        if admin_user:
            print("Admin user already exists!")
            return
        
        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@businessmanager.com",
            password_hash=User.hash_password("admin123"),
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True
        )
        
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)
        
        print("Admin user created successfully!")
        print(f"Username: admin")
        print(f"Password: admin123")
        print(f"Email: admin@businessmanager.com")

if __name__ == "__main__":
    create_admin_user()
