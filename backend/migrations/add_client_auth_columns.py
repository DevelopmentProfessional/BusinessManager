"""
Migration: add client auth columns (email_verified, password_hash, reset_token, last_login)
Run once on the target database:

    python -m backend.migrations.add_client_auth_columns
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, _ensure_client_auth_columns_if_needed


def run():
    _ensure_client_auth_columns_if_needed()
    print("Migration complete: client auth columns added if missing.")


if __name__ == "__main__":
    run()
