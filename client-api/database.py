"""
DATABASE ENGINE & SESSION
Connects to the shared PostgreSQL database. Uses the same connection URL
as the internal API but is a completely independent process.

Connection pooling is intentionally conservative (pool_size=3, max_overflow=5)
to avoid exhausting Postgres connections shared with the internal API.
"""
import os
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy import text
from db_config import DATABASE_URL

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


def _ensure_client_order_workflow_columns():
    """Patch existing client_order tables with workflow columns used by the portal."""
    try:
        with engine.begin() as conn:
            for col, definition in [
                ("employee_id", "UUID"),
                ("paid_at", "TIMESTAMP"),
                ("fulfilled_at", "TIMESTAMP"),
                ("inventory_deducted_at", "TIMESTAMP"),
            ]:
                exists = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='client_order' AND column_name=:c"
                ), {"c": col}).fetchone()
                if not exists:
                    conn.execute(text(f"ALTER TABLE client_order ADD COLUMN {col} {definition}"))

            options_exists = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='client_order_item' AND column_name='options_json'"
            )).fetchone()
            if not options_exists:
                conn.execute(text("ALTER TABLE client_order_item ADD COLUMN options_json TEXT"))

            conn.execute(text(
                "UPDATE client_order SET status = 'payment_pending' WHERE status = 'pending'"
            ))
            conn.execute(text(
                "UPDATE client_order SET status = 'ordered', paid_at = COALESCE(paid_at, updated_at, created_at) WHERE status = 'paid'"
            ))
    except Exception:
        # Best-effort only; internal API also runs migrations against the same DB.
        pass
