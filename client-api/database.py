"""
DATABASE ENGINE & SESSION
Connects to the shared PostgreSQL database. Uses the same connection URL
as the internal API but is a completely independent process.

Connection pooling is intentionally conservative (pool_size=3, max_overflow=5)
to avoid exhausting Postgres connections shared with the internal API.
"""
import os
import logging
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy import text
from db_config import DATABASE_URL

logger = logging.getLogger(__name__)

# Normalise postgres:// → postgresql+psycopg:// for psycopg v3
_url = DATABASE_URL
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql+psycopg://", 1)
elif _url.startswith("postgresql://") and "+psycopg" not in _url:
    _url = _url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    _url,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=3,       # conservative — shares DB with internal API
    max_overflow=5,
    echo=False,
)


def get_session():
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session


def create_client_tables():
    """Create any tables defined in models.py that don't exist yet."""
    import models  # noqa — triggers SQLModel metadata registration
    SQLModel.metadata.create_all(engine)
    _ensure_client_order_workflow_columns()


def _ensure_columns(conn, table: str, columns: list[tuple[str, str]]):
    """Add each (column, definition) to table if not already present."""
    existing = {
        row[0] for row in conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:t"
        ), {"t": table}).fetchall()
    }
    for col, definition in columns:
        if col not in existing:
            # Quote table name to handle reserved words like "user"
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {col} {definition}'))


def _ensure_client_order_workflow_columns():
    """Patch existing tables with all columns needed by the client portal."""
    try:
        with engine.begin() as conn:
            # ── client_order ──────────────────────────────────────────────────
            _ensure_columns(conn, "client_order", [
                ("employee_id",           "UUID"),
                ("paid_at",               "TIMESTAMP"),
                ("fulfilled_at",          "TIMESTAMP"),
                ("inventory_deducted_at", "TIMESTAMP"),
            ])

            # ── client_order_item ─────────────────────────────────────────────
            _ensure_columns(conn, "client_order_item", [
                ("options_json", "TEXT"),
            ])

            # ── user (lunch scheduling) ───────────────────────────────────────
            _ensure_columns(conn, "user", [
                ("lunch_start",            "VARCHAR"),
                ("lunch_duration_minutes", "INTEGER"),
            ])

            # ── inventory (procurement lead time) ─────────────────────────────
            _ensure_columns(conn, "inventory", [
                ("min_stock_level",       "INTEGER NOT NULL DEFAULT 10"),
                ("procurement_lead_days", "INTEGER"),
            ])

            # Status normalisation
            conn.execute(text(
                "UPDATE client_order SET status = 'payment_pending' WHERE status = 'pending'"
            ))
            conn.execute(text(
                "UPDATE client_order SET status = 'ordered',"
                " paid_at = COALESCE(paid_at, updated_at, created_at)"
                " WHERE status = 'paid'"
            ))
    except Exception as exc:
        logger.exception("Best-effort client-api migration attempt failed while patching shared DB schema: %s", exc)
