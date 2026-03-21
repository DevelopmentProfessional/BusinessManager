"""
DATABASE ENGINE & SESSION
Connects to the shared PostgreSQL database. Uses the same connection URL
as the internal API but is a completely independent process.

Connection pooling is intentionally conservative (pool_size=3, max_overflow=5)
to avoid exhausting Postgres connections shared with the internal API.
"""
import os
from sqlmodel import Session, create_engine, SQLModel
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
