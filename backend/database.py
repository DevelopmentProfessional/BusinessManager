from sqlmodel import SQLModel, create_engine, Session
import os
from typing import Generator

# Database URL from environment variable - defaults to SQLite for easy local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./business_manager.db")

# Create engine with SQLite-specific settings for local development
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    """Create database tables"""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """Get database session"""
    with Session(engine) as session:
        yield session
