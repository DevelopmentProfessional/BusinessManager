from sqlmodel import SQLModel, create_engine, Session
import os
from typing import Generator

# SQLite database for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./business_manager.db")

# Create engine
engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})

def create_db_and_tables():
    """Create database tables"""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """Get database session"""
    with Session(engine) as session:
        yield session
