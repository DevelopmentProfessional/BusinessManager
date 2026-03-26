"""
Create or drop the workflow, audit, financial, procurement, and schedule tables.

This repo uses SQLModel metadata and a shared engine from backend.database.
The migration is intentionally lightweight so it can be executed directly from
the repository root with the project's virtual environment.
"""

import os
import sys

from sqlmodel import SQLModel
from sqlalchemy import text


_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

try:
    from backend.database import engine
    import backend.models  # noqa: F401
except ModuleNotFoundError:
    from database import engine  # type: ignore
    import models  # type: ignore  # noqa: F401


TABLES_TO_DROP = [
    "procurement_order_line",
    "procurement_order",
    "accounts_payable",
    "accounts_receivable",
    "general_ledger_entry",
    "general_ledger_account",
    "workflow_approval_step",
    "document_workflow_instance",
    "workflow_template",
    "pending_order",
    "inventory_cost",
    "schedule_settings",
    "audit_log",
]


def upgrade():
    """Create any missing tables from the loaded SQLModel metadata."""
    SQLModel.metadata.create_all(engine)
    print("Migration completed: tables created or already present")


def downgrade():
    """Drop only the tables introduced by this feature set."""
    with engine.begin() as conn:
        for table_name in TABLES_TO_DROP:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE'))
            print(f"Dropped {table_name}")

    print("Migration reversed: feature tables removed")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
