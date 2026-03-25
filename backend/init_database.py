"""
init_database.py
================
Pre-start script run by Render via:
    preStartCommand: python backend/init_database.py

Responsibilities (in order):
  1. Run all SQLModel table creation / schema migrations (create_db_and_tables)

This runs as a standalone process before uvicorn starts, so it is guaranteed
to finish schema setup before API startup.
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

    log.info("init_database.py complete.")


if __name__ == "__main__":
    main()
