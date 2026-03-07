"""
sweep_now.py — Standalone script to immediately clean all [REGTEST] data
               from the database via the backend sweep endpoint.

Usage:
    cd regressiontest
    python tools/sweep_now.py

Reads credentials from regressiontest/.env (same as the test suite).
"""
import sys
import os
from pathlib import Path

# Add regressiontest/ to path so we can import config and helpers
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, REQUEST_TIMEOUT
from helpers.api_client import login
from helpers.cleanup import sweep_regtest_data


def main() -> None:
    print(f"\n{'='*60}")
    print(f"  [REGTEST] Database Sweep")
    print(f"  API  : {BASE_URL}")
    print(f"  User : {ADMIN_USERNAME}")
    print(f"{'='*60}\n")

    if not ADMIN_PASSWORD:
        print("ERROR: ADMIN_PASSWORD is not set in regressiontest/.env")
        sys.exit(1)

    print("Logging in as admin...")
    try:
        token = login(ADMIN_USERNAME, ADMIN_PASSWORD)
    except RuntimeError as e:
        print(f"ERROR: Login failed — {e}")
        sys.exit(1)
    print("  Login OK\n")

    print("Calling DELETE /api/v1/regtest/sweep ...")
    try:
        result = sweep_regtest_data(token)
    except RuntimeError as e:
        print(f"ERROR: Sweep failed — {e}")
        sys.exit(1)

    total = result.get("total", 0)
    deleted = result.get("deleted", {})
    errors = result.get("errors", [])

    if total == 0:
        print("  Database is clean — no [REGTEST] records found.\n")
    else:
        print(f"  Deleted {total} record(s) across {len(deleted)} table(s):\n")
        for table, count in sorted(deleted.items()):
            print(f"    {table}: {count}")

    if errors:
        print(f"\n  Warnings ({len(errors)}):")
        for e in errors:
            print(f"    {e}")

    print(f"\n{'='*60}")
    print("  Sweep complete.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
