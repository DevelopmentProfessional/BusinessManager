#!/usr/bin/env python3
"""
Production Setup Script for Business Manager
This script helps set up initial data for production deployment.
"""

import os
import sys
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import User, Employee
import bcrypt

def create_admin_user():
    """Create a default admin user if none exists."""
    with Session(engine) as session:
        # Check if admin user exists
        admin_user = session.exec(select(User).where(User.username == "admin")).first()
        
        if not admin_user:
            print("Creating default admin user...")
            
            # Hash password
            password = "admin123"  # Change this in production!
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            # Create admin user
            admin_user = User(
                username="admin",
                email="admin@businessmanager.com",
                hashed_password=hashed_password.decode('utf-8'),
                role="admin",
                is_active=True
            )
            
            session.add(admin_user)
            session.commit()
            
            print("✅ Admin user created successfully!")
            print("Username: admin")
            print("Password: admin123")
            print("⚠️  IMPORTANT: Change this password immediately after first login!")
        else:
            print("✅ Admin user already exists")

def create_sample_employee():
    """Create a sample employee for testing."""
    with Session(engine) as session:
        # Check if sample employee exists
        sample_employee = session.exec(select(Employee).where(Employee.email == "employee@businessmanager.com")).first()
        
        if not sample_employee:
            print("Creating sample employee...")
            
            sample_employee = Employee(
                first_name="Sample",
                last_name="Employee",
                email="employee@businessmanager.com",
                phone="555-0123",
                role="Stylist",
                hire_date="2024-01-01",
                is_active=True,
                # Grant basic permissions
                clients_read=True,
                clients_write=True,
                inventory_read=True,
                services_read=True,
                schedule_read=True,
                schedule_write=True,
                attendance_read=True,
                attendance_write=True
            )
            
            session.add(sample_employee)
            session.commit()
            
            print("✅ Sample employee created successfully!")
            print("Email: employee@businessmanager.com")
        else:
            print("✅ Sample employee already exists")

def main():
    """Main setup function."""
    print("🚀 Business Manager Production Setup")
    print("=" * 40)
    
    # Create database tables
    print("Creating database tables...")
    create_db_and_tables()
    print("✅ Database tables created")
    
    # Create admin user
    create_admin_user()
    
    # Create sample employee
    create_sample_employee()
    
    print("\n🎉 Setup complete!")
    print("\nNext steps:")
    print("1. Access your application")
    print("2. Login with admin/admin123")
    print("3. Change the admin password")
    print("4. Create your first real employee")
    print("5. Start using the system!")

if __name__ == "__main__":
    main()
