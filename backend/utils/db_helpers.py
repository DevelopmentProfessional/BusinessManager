# FILE: backend/utils/db_helpers.py
# Shared database utility helpers used across routers.

from fastapi import HTTPException
from sqlmodel import Session


def safe_commit(session: Session, action: str = "save") -> None:
    """Commit the session; rollback and raise 500 on failure."""
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to {action}")


def safe_commit_refresh(session: Session, obj, action: str = "save"):
    """Commit, refresh obj, and return it; rollback and raise 500 on failure."""
    try:
        session.commit()
        session.refresh(obj)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to {action}")
    return obj
