"""
CLIENT AUTH UTILITIES
=====================
JWT creation/validation and password hashing.

Tokens carry role="client" in the payload. Any token without this claim
(e.g. internal staff tokens) is REJECTED by get_current_client().
"""

import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from database import get_session
from models import Client

# ── Config ─────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("CLIENT_JWT_SECRET", "change-me-in-production")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 h

bearer_scheme = HTTPBearer()


# ── Password helpers ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── Token helpers ───────────────────────────────────────────────────────────────

def create_access_token(client_id: str, email: str, company_id: str) -> str:
    """Create a JWT that is ONLY valid for the client portal (role='client')."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub":        str(client_id),
        "email":      email,
        "company_id": company_id,
        "role":       "client",          # CRITICAL — internal staff have different roles
        "exp":        expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on any failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    if payload.get("role") != "client":
        # Reject internal staff tokens — they must NOT access client portal endpoints
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is restricted to client accounts only.",
        )
    return payload


# ── FastAPI dependency ──────────────────────────────────────────────────────────

def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> Client:
    """
    FastAPI dependency. Validates Bearer token, enforces role='client',
    then returns the live Client ORM object from the database.

    Use this in every authenticated endpoint:
        client = Depends(get_current_client)
    """
    payload = decode_token(credentials.credentials)
    client_id = payload.get("sub")

    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Client not found.")

    return client
