# ============================================================
# FILE: regtest.py
#
# PURPOSE:
#   Admin-only endpoint that sweeps the entire database for any
#   records tagged with [REGTEST] and deletes them.  Used by the
#   regression test suite to clean up data from interrupted runs
#   before starting a fresh test session.
#
#   The table list is discovered dynamically via SQLAlchemy metadata
#   introspection, so new tables are covered automatically without
#   any changes to this file.
#
# ENDPOINT:
#   DELETE /api/v1/regtest/sweep
#       - Admin role required
#       - Returns: {"deleted": {table: count, ...}, "total": N, "errors": [...]}
#
# DELETION ORDER:
#   Tables are sorted so that child/dependent tables (those with FK
#   columns pointing to other tables) are deleted first, then parent
#   tables.  A two-pass retry handles any remaining FK conflicts.
#
# CHANGE LOG:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-02 | Claude  | Initial implementation
# ============================================================

import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect as sa_inspect, text
from sqlalchemy.orm import Session

try:
    from ..database import get_session
    from ..routers.auth import get_current_user
    from ..models import User
except ImportError:
    from database import get_session  # type: ignore
    from routers.auth import get_current_user  # type: ignore
    from models import User  # type: ignore

log = logging.getLogger(__name__)

router = APIRouter()

REGTEST_TAG = "[REGTEST]"

# String-like SQLAlchemy type names (lower-case substrings to match against)
_TEXT_TYPE_HINTS = ("varchar", "text", "char", "string", "nvarchar", "clob")


def _is_text_column(col_type) -> bool:
    """Return True if the column type is a text/string type."""
    type_str = str(col_type).lower()
    return any(hint in type_str for hint in _TEXT_TYPE_HINTS)


def _topological_table_order(inspector, all_tables: list[str]) -> list[str]:
    """
    Return tables sorted so that dependent (child) tables come before the
    tables they reference (parent tables).  This lets us delete children
    first, avoiding FK constraint violations.

    Uses a simple iterative approach: tables with no un-processed dependents
    are appended first (leaves of the FK graph go first).
    """
    # Build adjacency: fk_deps[A] = set of tables A has FKs pointing to
    fk_deps: dict[str, set[str]] = {t: set() for t in all_tables}
    for table in all_tables:
        try:
            for fk in inspector.get_foreign_keys(table):
                referred = fk.get("referred_table")
                if referred and referred in fk_deps and referred != table:
                    fk_deps[table].add(referred)
        except Exception:
            pass  # skip tables we can't introspect

    # Kahn's algorithm for topological sort
    # In deletion order we want: if A → B (A has FK to B), delete A before B
    in_degree: dict[str, int] = defaultdict(int)
    dependents: dict[str, list[str]] = defaultdict(list)

    for table, deps in fk_deps.items():
        for dep in deps:
            # A depends on dep → dep must come AFTER A in deletion order
            # dep has one more "thing" that must be deleted before it
            in_degree[dep] += 1
            dependents[table].append(dep)

    # Start with tables that have in_degree == 0 (no one depends on them,
    # or equivalently: no other table requires them to be deleted first)
    queue = [t for t in all_tables if in_degree.get(t, 0) == 0]
    ordered: list[str] = []

    while queue:
        table = queue.pop(0)
        ordered.append(table)
        for dep in dependents.get(table, []):
            in_degree[dep] -= 1
            if in_degree[dep] == 0:
                queue.append(dep)

    # Append any tables that were not reached (cycles or introspection errors)
    remaining = [t for t in all_tables if t not in ordered]
    ordered.extend(remaining)

    return ordered


@router.delete("/sweep")
def sweep_regtest_data(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Admin-only: find and delete every record that contains the [REGTEST]
    tag in any text column, across every table in the database.

    The table list is discovered dynamically via SQLAlchemy introspection —
    no hardcoded table names.  Deletion order respects FK dependencies so
    children are deleted before parents.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        inspector = sa_inspect(session.bind)
        all_tables = inspector.get_table_names()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not inspect database: {exc}")

    # Sort: dependent tables first so FK constraints are not violated
    ordered_tables = _topological_table_order(inspector, all_tables)

    deleted: dict[str, int] = {}
    errors: list[str] = []

    def _sweep_table(table_name: str) -> int:
        """Delete all [REGTEST] records from one table. Returns count deleted."""
        try:
            columns = inspector.get_columns(table_name)
        except Exception:
            return 0

        text_cols = [c["name"] for c in columns if _is_text_column(c["type"])]
        if not text_cols:
            return 0

        # Check that the table has an 'id' column for targeted deletion
        col_names = {c["name"] for c in columns}
        if "id" not in col_names:
            return 0

        # Build: SELECT id FROM <table> WHERE col1 LIKE '%[REGTEST]%' OR col2 LIKE ...
        # Quote identifiers to handle reserved words and mixed case
        conditions = " OR ".join(f'"{col}" LIKE :tag' for col in text_cols)
        find_sql = text(f'SELECT id FROM "{table_name}" WHERE {conditions}')

        try:
            result = session.execute(find_sql, {"tag": f"%{REGTEST_TAG}%"})
            ids = [str(row[0]) for row in result]
        except Exception as exc:
            log.warning(f"Sweep: could not query {table_name!r}: {exc}")
            return 0

        if not ids:
            return 0

        count = 0
        for record_id in ids:
            try:
                del_sql = text(f'DELETE FROM "{table_name}" WHERE id = :id')
                session.execute(del_sql, {"id": record_id})
                count += 1
            except Exception as exc:
                log.warning(f"Sweep: could not delete {table_name!r} id={record_id}: {exc}")
                session.rollback()

        if count:
            try:
                session.commit()
            except Exception as exc:
                log.warning(f"Sweep: commit failed for {table_name!r}: {exc}")
                session.rollback()
                return 0

        return count

    # Pass 1: delete in dependency order
    retry_tables: list[str] = []
    for table in ordered_tables:
        try:
            n = _sweep_table(table)
            if n:
                deleted[table] = n
        except Exception as exc:
            errors.append(f"{table}: {exc}")
            retry_tables.append(table)

    # Pass 2: retry tables that failed (their dependents are likely gone now)
    if retry_tables:
        log.info(f"Sweep pass-2: retrying {len(retry_tables)} table(s)")
        for table in retry_tables:
            try:
                n = _sweep_table(table)
                if n:
                    deleted[table] = deleted.get(table, 0) + n
                    errors = [e for e in errors if not e.startswith(f"{table}:")]
            except Exception as exc:
                log.warning(f"Sweep pass-2: {table}: {exc}")

    total = sum(deleted.values())
    log.info(f"Sweep complete: {total} record(s) deleted from {len(deleted)} table(s)")
    return {"deleted": deleted, "total": total, "errors": errors}
