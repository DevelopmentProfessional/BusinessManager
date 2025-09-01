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
from models import SQLModel, User

def init_database():
    """Initialize the database with required tables and initial data."""
    print("🔄 Initializing database...")
    
    # Create all tables (this is safe to run multiple times)
    create_db_and_tables()
    print("✅ Database tables created/verified")
    
    # Get a session
    session = next(get_session())
    
    try:
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
