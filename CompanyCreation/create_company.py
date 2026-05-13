#!/usr/bin/env python3
"""
CompanyCreation Tool
====================
Standalone script for creating new companies in the BusinessManager database.
Run directly (not through the API) to provision a new company with its admin user.

Usage:
    python create_company.py

Requirements:
    pip install sqlmodel psycopg2-binary bcrypt python-dotenv

This script reads DATABASE_URL from environment (or .env file in parent directory).
PostgreSQL is required.
"""

import os
import sys
import uuid
import bcrypt
from datetime import datetime

# Try to load .env from parent directory
try:
    from dotenv import load_dotenv
    parent_env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(parent_env):
        # Force root .env to win over stale shell exports (e.g., old Render DATABASE_URL).
        load_dotenv(parent_env, override=True)
        print(f"Loaded environment from {parent_env}")
except ImportError:
    pass

# Get database URL (PostgreSQL only)
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL is required and must point to PostgreSQL.")
    sys.exit(1)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL.startswith("sqlite"):
    print("ERROR: SQLite is not allowed. Configure a PostgreSQL DATABASE_URL.")
    sys.exit(1)
if not DATABASE_URL.startswith("postgresql://"):
    print("ERROR: Only PostgreSQL URLs are supported.")
    sys.exit(1)

print(f"Using database: {DATABASE_URL[:50]}...")

try:
    from sqlmodel import create_engine, Session, text
except ImportError:
    print("ERROR: sqlmodel not installed. Run: pip install sqlmodel")
    sys.exit(1)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_company():
    print("\n" + "="*60)
    print("BusinessManager — Company Creation Tool")
    print("="*60)

    # Get company details
    print("\nEnter Company Details:")
    company_id = input("  Company ID (short code, e.g. ACME): ").strip().upper()
    if not company_id:
        print("ERROR: Company ID is required.")
        sys.exit(1)

    company_name = input("  Company Name (full name): ").strip()
    if not company_name:
        print("ERROR: Company Name is required.")
        sys.exit(1)

    print("\nEnter Admin User Details:")
    admin_username = input("  Admin Username: ").strip()
    if not admin_username:
        print("ERROR: Admin username is required.")
        sys.exit(1)

    admin_password = input("  Admin Password: ").strip()
    if len(admin_password) < 6:
        print("ERROR: Password must be at least 6 characters.")
        sys.exit(1)

    admin_first = input("  Admin First Name: ").strip() or "Admin"
    admin_last = input("  Admin Last Name: ").strip() or "User"
    admin_email = input("  Admin Email (optional): ").strip() or None

    print("\n" + "-"*60)
    print(f"Creating company: {company_name} (ID: {company_id})")
    print(f"Admin user: {admin_username}")
    print("-"*60)

    # Connect to database
    db_url = DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(db_url)

    with Session(engine) as session:
        # Check if company already exists
        existing = None

        try:
            existing = session.execute(text(
                "SELECT id FROM company WHERE company_id = :cid"
            ), {"cid": company_id}).fetchone()
        except Exception as e:
            print(f"ERROR: Cannot query company table: {e}")
            print("Make sure the application has been started at least once to create tables.")
            sys.exit(1)

        if existing:
            print(f"ERROR: Company with ID '{company_id}' already exists.")
            sys.exit(1)

        # Check if username already exists
        try:
            existing_user = session.execute(text(
                "SELECT id FROM \"user\" WHERE username = :uname"
            ), {"uname": admin_username}).fetchone()
        except Exception:
            existing_user = session.execute(text(
                "SELECT id FROM user WHERE username = :uname"
            ), {"uname": admin_username}).fetchone()

        if existing_user:
            print(f"ERROR: Username '{admin_username}' already exists.")
            sys.exit(1)

        # Create company record
        company_uuid = str(uuid.uuid4())
        now = datetime.utcnow()

        session.execute(text("""
            INSERT INTO company (id, created_at, company_id, name, is_active)
            VALUES (:id, :created_at, :company_id, :name, :is_active)
        """), {
            "id": company_uuid,
            "created_at": now,
            "company_id": company_id,
            "name": company_name,
            "is_active": True,
        })

        # Create admin user
        user_uuid = str(uuid.uuid4())
        password_hash = hash_password(admin_password)

        session.execute(text("""
            INSERT INTO "user" (id, created_at, username, email, password_hash, first_name, last_name,
                                role, is_active, is_locked, force_password_reset, failed_login_attempts,
                                dark_mode, training_mode, db_environment, hire_date, company_id)
            VALUES (:id, :created_at, :username, :email, :password_hash, :first_name, :last_name,
                    'admin', TRUE, FALSE, FALSE, 0, FALSE, FALSE, 'production', :hire_date, :company_id)
        """), {
            "id": user_uuid,
            "created_at": now,
            "username": admin_username,
            "email": admin_email,
            "password_hash": password_hash,
            "first_name": admin_first,
            "last_name": admin_last,
            "hire_date": now,
            "company_id": company_id,
        })

        # Create default app_settings for this company
        settings_uuid = str(uuid.uuid4())
        session.execute(text("""
            INSERT INTO app_settings (id, created_at, start_of_day, end_of_day, attendance_check_in_required,
                                      monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled,
                                      friday_enabled, saturday_enabled, sunday_enabled, company_name, company_id)
            VALUES (:id, :created_at, '06:00', '21:00', 1, 1, 1, 1, 1, 1, 1, 1, :company_name, :company_id)
        """), {
            "id": settings_uuid,
            "created_at": now,
            "company_name": company_name,
            "company_id": company_id,
        })

        session.commit()

        print("\n" + "="*60)
        print("SUCCESS! Company created.")
        print(f"  Company ID:   {company_id}")
        print(f"  Company Name: {company_name}")
        print(f"  Admin User:   {admin_username}")
        print(f"  Password:     [as entered]")
        print("\nThe admin can now log in at the application login page")
        print(f"using Company ID: {company_id}")
        print("="*60 + "\n")


if __name__ == "__main__":
    create_company()
