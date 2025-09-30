"""
Production permissions table fixer.

Goals:
- Back up existing permissions data (from likely legacy tables: userpermission, permission, permissions, user_permissions)
- Create a normalized 'userpermission' table compatible with dev (no DB enum types; 'permission' stored as TEXT)
- Migrate existing rows with normalization of page and permission values
- Idempotent and safe to run multiple times
- DO NOT TOUCH appointments or schedule tables

Usage:
  - Render: run this script once against the production DB. It uses DATABASE_URL from env and psycopg driver via backend.database.
  - Local: can be run safely (will operate on your local DB if DATABASE_URL points to it).
"""

from __future__ import annotations

import os
import sys
import json
from datetime import datetime
from uuid import uuid4
from typing import Optional, List, Tuple

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

try:
    # Ensure project root on path
    _this = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.dirname(_this)
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from backend.database import engine
except Exception:
    # Fallback if executed within backend dir
    from database import engine  # type: ignore


LEGACY_TABLE_CANDIDATES = [
    "userpermission",  # desired
    "permission",
    "permissions",
    "user_permissions",
]

TARGET_TABLE = "userpermission"

VALID_PAGES = {
    "clients",
    "inventory",
    "services",
    "employees",
    "schedule",
    "attendance",
    "documents",
    "admin",
}

VALID_PERMISSIONS = {
    "read",
    "read_all",
    "write",
    "write_all",
    "delete",
    "admin",
    "view_all",
}


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def normalize_page(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip().lower().replace(" ", "_").replace("-", "_")
    # common aliases
    aliases = {
        "employee": "employees",
        "service": "services",
        "client": "clients",
        "inventory_items": "inventory",
        "document": "documents",
    }
    v = aliases.get(v, v)
    return v


def normalize_permission(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip().lower().replace(" ", "_").replace("-", "_")
    # common aliases
    alias = {
        "view": "read",
        "view_all": "view_all",
        "readall": "read_all",
        "writeall": "write_all",
        "administrator": "admin",
        "manage": "admin",
    }
    v = alias.get(v, v)
    return v


def table_exists(conn, name: str) -> bool:
    res = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = :name
            LIMIT 1
            """
        ),
        {"name": name},
    ).fetchone()
    return bool(res)


def backup_table(conn, name: str) -> None:
    suffix = _now_iso()
    backup_table_name = f"{name}_backup_{suffix}"
    # Create a simple backup via CREATE TABLE AS SELECT
    conn.execute(text(f"CREATE TABLE {backup_table_name} AS SELECT * FROM \"{name}\""))
    print(f"[permissions-fix] Backed up table '{name}' to '{backup_table_name}'")


def create_target_schema(conn) -> None:
    # Avoid DB enums by using TEXT for permission
    # Note: quoted "user" table
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS userpermission (
              id UUID PRIMARY KEY,
              created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
              updated_at TIMESTAMP WITHOUT TIME ZONE,
              user_id UUID NOT NULL REFERENCES "user"(id),
              page VARCHAR NOT NULL,
              permission VARCHAR NOT NULL,
              granted BOOLEAN NOT NULL DEFAULT TRUE
            )
            """
        )
    )
    # Helpful indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_userpermission_user ON userpermission(user_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_userpermission_page ON userpermission(page)"))


def discover_legacy_source(conn) -> Optional[str]:
    for name in LEGACY_TABLE_CANDIDATES:
        try:
            if table_exists(conn, name):
                return name
        except ProgrammingError:
            continue
    return None


def migrate_data(conn, source: str) -> Tuple[int, int]:
    """Migrate rows from source table to userpermission.
    Returns (migrated_count, skipped_count).
    """
    migrated = 0
    skipped = 0

    # Load all rows from source
    rows = conn.execute(text(f"SELECT * FROM \"{source}\""))
    cols = [c for c in rows.keys()]

    def col(name: str):
        return name if name in cols else None

    id_col = col("id")
    created_col = col("created_at") or col("created") or col("createdon")
    updated_col = col("updated_at") or col("updated") or col("updatedon")
    user_col = col("user_id") or col("userid")
    page_col = col("page") or col("module")
    perm_col = col("permission") or col("perm") or col("type")
    granted_col = col("granted") or col("enabled") or col("is_granted")

    for r in rows.fetchall():
        try:
            # Extract + normalize
            _id = getattr(r, id_col) if id_col else None
            _id = str(_id) if _id else str(uuid4())

            _created = getattr(r, created_col) if created_col else datetime.utcnow()
            _updated = getattr(r, updated_col) if updated_col else None

            _user = getattr(r, user_col) if user_col else None
            if not _user:
                skipped += 1
                continue

            _page = normalize_page(getattr(r, page_col) if page_col else None)
            _perm = normalize_permission(getattr(r, perm_col) if perm_col else None)
            _granted_raw = getattr(r, granted_col) if granted_col else True
            _granted = bool(_granted_raw) if _granted_raw is not None else True

            if not _page or not _perm:
                skipped += 1
                continue

            # Enforce allowed sets but don't crash; skip unknowns
            if _page not in VALID_PAGES:
                # Map some additional likely modules
                extra = {
                    "users": "employees",
                    "staff": "employees",
                    "items": "inventory",
                }
                _page = extra.get(_page, _page)
            if _page not in VALID_PAGES:
                skipped += 1
                continue

            if _perm not in VALID_PERMISSIONS:
                # Attempt to convert older forms
                alt = {
                    "view_all": "view_all",
                    "view": "read",
                    "owner_write": "write",
                }
                _perm = alt.get(_perm, _perm)
            if _perm not in VALID_PERMISSIONS:
                skipped += 1
                continue

            # Ensure user exists
            exists_user = conn.execute(
                text('SELECT 1 FROM "user" WHERE id = :uid LIMIT 1'),
                {"uid": str(_user)},
            ).fetchone()
            if not exists_user:
                skipped += 1
                continue

            # Upsert logic (idempotent): if row with same id exists, update; else insert
            conn.execute(
                text(
                    """
                    INSERT INTO userpermission (id, created_at, updated_at, user_id, page, permission, granted)
                    VALUES (:id, :created, :updated, :user_id, :page, :perm, :granted)
                    ON CONFLICT (id) DO UPDATE SET
                      updated_at = EXCLUDED.updated_at,
                      user_id = EXCLUDED.user_id,
                      page = EXCLUDED.page,
                      permission = EXCLUDED.permission,
                      granted = EXCLUDED.granted
                    """
                ),
                {
                    "id": _id,
                    "created": _created,
                    "updated": _updated,
                    "user_id": str(_user),
                    "page": _page,
                    "perm": _perm,
                    "granted": _granted,
                },
            )
            migrated += 1
        except Exception as ex:
            print(f"[permissions-fix] Skip row due to error: {ex}")
            skipped += 1

    return migrated, skipped


def main() -> int:
    print("[permissions-fix] Starting permissions table fix...")
    with engine.begin() as conn:
        # Identify a source table. Prefer TARGET_TABLE if already present
        source = discover_legacy_source(conn)
        if not source:
            print("[permissions-fix] No permissions-related table found; creating target schema only.")
            create_target_schema(conn)
            print("[permissions-fix] Done (no data to migrate).")
            return 0

        # Backup source table
        try:
            backup_table(conn, source)
        except Exception as e:
            print(f"[permissions-fix] WARNING: backup failed for '{source}': {e}")

        # If source is not the target name or target likely has incorrect schema, ensure target schema exists
        create_target_schema(conn)

        # If source is the same as target, we still migrate row-by-row via upsert (normalizing values)
        migrated, skipped = migrate_data(conn, source)
        print(f"[permissions-fix] Migrated: {migrated}, Skipped: {skipped}")

    print("[permissions-fix] Completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
