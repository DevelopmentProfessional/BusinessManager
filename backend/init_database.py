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

from database import engine, get_session
from models import SQLModel, User, UserRole
import bcrypt
from datetime import datetime

def init_database():
    """Initialize the database with required tables and initial data."""
    print("🔄 Initializing database...")
    
    # Create all tables
    SQLModel.metadata.create_all(engine)
    print("✅ Database tables created")
    
    # Get a session
    session = next(get_session())
    
    try:
        # Check if admin user already exists
        admin_user = session.query(User).filter(User.username == "admin").first()
        
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
        
        # Check total users
        total_users = session.query(User).count()
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
