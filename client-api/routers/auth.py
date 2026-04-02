"""
AUTH ROUTER  — /api/client/auth
================================
POST   /auth/register  — Create a new client account
POST   /auth/login     — Authenticate, receive JWT
GET    /auth/me        — Return current client profile
PATCH  /auth/me        — Update name / phone / address

Rate limits:
  register: 5 / minute per IP
  login:   10 / minute per IP
  me:      60 / minute per IP
"""

from datetime import datetime, timezone, timedelta
import secrets
import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address

import auth as auth_utils
from database import get_session
from models import (
    Client,
    ClientLogin,
    ClientPublicRead,
    ClientRegister,
    ClientTokenResponse,
    ClientUpdate,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    PasswordResetConfirm,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)
RESET_TOKEN_EXPIRY_MINUTES = int(os.getenv("CLIENT_RESET_TOKEN_EXPIRY_MINUTES", "30"))
EXPOSE_RESET_TOKEN = os.getenv("CLIENT_EXPOSE_RESET_TOKEN", "true").lower() == "true"


@router.post(
    "/register",
    response_model=ClientTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new client account",
)
@limiter.limit("5/minute")
def register(
    request: Request,
    body: ClientRegister,
    session: Session = Depends(get_session),
):
    """
    Create a new client account.

    Request:
    ```json
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "password": "SecurePass123!",
      "phone": "555-1234",
      "company_id": "acme-corp"
    }
    ```
    Response: JWT token + profile summary.
    Error 409 — email already registered for this company.
    """
    existing = session.exec(
        select(Client).where(
            Client.email == body.email,
            Client.company_id == body.company_id,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    client = Client(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=auth_utils.hash_password(body.password),
        email_verified=False,
        company_id=body.company_id,
    )
    session.add(client)
    try:
        session.commit()
        session.refresh(client)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create account.")

    token = auth_utils.create_access_token(
        client_id=str(client.id),
        email=client.email,
        company_id=client.company_id,
    )
    return ClientTokenResponse(
        access_token=token,
        client_id=str(client.id),
        name=client.name,
        email=client.email,
        membership_tier=client.membership_tier,
    )


@router.post("/login", response_model=ClientTokenResponse, summary="Authenticate client")
@limiter.limit("10/minute")
def login(
    request: Request,
    body: ClientLogin,
    session: Session = Depends(get_session),
):
    """
    Authenticate with email + password.

    Request:
    ```json
    { "email": "jane@example.com", "password": "SecurePass123!", "company_id": "acme-corp" }
    ```
    Response: JWT Bearer token (24-hour expiry).
    """
    client = session.exec(
        select(Client).where(
            Client.email == body.email,
            Client.company_id == body.company_id,
        )
    ).first()

    if not client or not client.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not auth_utils.verify_password(body.password, client.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    client.last_login = datetime.now(timezone.utc)
    try:
        session.commit()
    except Exception:
        session.rollback()

    token = auth_utils.create_access_token(
        client_id=str(client.id),
        email=client.email,
        company_id=client.company_id,
    )
    return ClientTokenResponse(
        access_token=token,
        client_id=str(client.id),
        name=client.name,
        email=client.email,
        membership_tier=client.membership_tier,
    )


@router.get("/me", response_model=ClientPublicRead, summary="Get my profile")
@limiter.limit("60/minute")
def me(
    request: Request,
    current_client: Client = Depends(auth_utils.get_current_client),
):
    return ClientPublicRead(
        id=current_client.id,
        name=current_client.name,
        email=current_client.email,
        phone=current_client.phone,
        address=current_client.address,
        membership_tier=current_client.membership_tier,
        membership_points=current_client.membership_points,
        membership_since=current_client.membership_since,
        membership_expires=current_client.membership_expires,
        company_id=current_client.company_id,
        created_at=current_client.created_at,
    )


@router.patch("/me", response_model=ClientPublicRead, summary="Update my profile")
@limiter.limit("20/minute")
def update_me(
    request: Request,
    body: ClientUpdate,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """
    Update name, phone, or address. Email and company_id are immutable.

    Request body (all optional):
    ```json
    { "name": "Jane Doe", "phone": "555-9999", "address": "123 Main St" }
    ```
    """
    client = session.get(Client, current_client.id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    if body.name is not None:
        client.name = body.name
    if body.phone is not None:
        client.phone = body.phone
    if body.address is not None:
        client.address = body.address

    try:
        session.commit()
        session.refresh(client)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Update failed.")

    return ClientPublicRead(
        id=client.id,
        name=client.name,
        email=client.email,
        phone=client.phone,
        address=client.address,
        membership_tier=client.membership_tier,
        membership_points=client.membership_points,
        membership_since=client.membership_since,
        membership_expires=client.membership_expires,
        company_id=client.company_id,
        created_at=client.created_at,
    )


@router.post(
    "/request-password-reset",
    response_model=PasswordResetRequestResponse,
    summary="Request a client password reset token",
)
@limiter.limit("5/minute")
def request_password_reset(
    request: Request,
    body: PasswordResetRequest,
    session: Session = Depends(get_session),
):
    client = session.exec(
        select(Client).where(
            Client.email == body.email,
            Client.company_id == body.company_id,
        )
    ).first()

    if not client:
        return PasswordResetRequestResponse(
            message="If this account exists, a reset token has been generated.",
        )

    token = secrets.token_urlsafe(24)
    client.reset_token = token
    client.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to prepare password reset.")

    # In production, wire this to email/SMS; token echo is enabled for now.
    return PasswordResetRequestResponse(
        message="Password reset token generated.",
        reset_token=token if EXPOSE_RESET_TOKEN else None,
        expires_in_minutes=RESET_TOKEN_EXPIRY_MINUTES,
    )


@router.post("/reset-password", summary="Reset client password with token")
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    body: PasswordResetConfirm,
    session: Session = Depends(get_session),
):
    client = session.exec(
        select(Client).where(
            Client.email == body.email,
            Client.company_id == body.company_id,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=400, detail="Invalid reset request.")

    if not client.reset_token or client.reset_token != body.reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    now = datetime.now(timezone.utc)
    expires_at = client.reset_token_expires
    if not expires_at or expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    client.password_hash = auth_utils.hash_password(body.new_password)
    client.reset_token = None
    client.reset_token_expires = None

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to reset password.")

    return {"message": "Password reset successful. You can now sign in."}
