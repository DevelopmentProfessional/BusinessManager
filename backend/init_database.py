"""
init_database.py
================
Pre-start script run by Render via:
    preStartCommand: python backend/init_database.py

Responsibilities (in order):
  1. Run all SQLModel table creation / schema migrations (create_db_and_tables)
  2. Cascade-delete any [REGTEST] users and all their FK-linked child rows

This runs as a standalone process before uvicorn starts, so it is guaranteed
to clean up leftover regression-test data on every deploy regardless of
whether the FastAPI startup event fires successfully.
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── Allow both  `python backend/init_database.py`  and
#               `python -m backend.init_database`  invocations ──────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main() -> None:
    # ── 1. Create / migrate tables ─────────────────────────────────────────
    log.info("Running create_db_and_tables …")
    try:
        try:
            from backend.database import create_db_and_tables, get_session
        except ModuleNotFoundError:
            from database import create_db_and_tables, get_session  # type: ignore
        create_db_and_tables()
        log.info("Schema up to date.")
    except Exception as exc:
        log.error(f"create_db_and_tables failed: {exc}")
        sys.exit(1)

    # ── 2. Cascade-delete [REGTEST] users ──────────────────────────────────
    log.info("Sweeping [REGTEST] users …")
    try:
        try:
            from backend.routers.regtest import cascade_delete_regtest_users
        except ModuleNotFoundError:
            from routers.regtest import cascade_delete_regtest_users  # type: ignore

        session = next(get_session())
        try:
            result = cascade_delete_regtest_users(session)
        finally:
            session.close()

        removed = result.get("users_removed", 0)
        total_deleted = sum(result.get("deleted", {}).values())
        errors = result.get("errors", [])

        if removed:
            log.info(
                f"[REGTEST] sweep: removed {removed} test user(s), "
                f"{total_deleted} linked row(s) deleted."
            )
            log.info(f"  deleted breakdown: {result.get('deleted')}")
            log.info(f"  nulled  breakdown: {result.get('nulled')}")
        else:
            log.info("[REGTEST] sweep: no test users found — database is clean.")

        if errors:
            log.warning(f"[REGTEST] sweep errors: {errors}")

    except Exception as exc:
        # Non-fatal: log but don't block the app from starting
        log.warning(f"[REGTEST] sweep failed (non-fatal): {exc}")

    log.info("init_database.py complete.")


if __name__ == "__main__":
    main()
