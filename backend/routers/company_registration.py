"""
Company Registration Router
=============================
Public-facing company registration + admin approval endpoints.

Endpoints:
  POST /company-registration/register                       — Submit registration (pending)
  GET  /company-registration/status                         — Database health check
  GET  /company-registration/companies                      — List all companies
  PATCH /company-registration/companies/{company_id}/status — Approve or deny a company
"""

import os
import secrets
import logging
import smtplib
import ssl
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlmodel import Session, select, text
from pydantic import BaseModel
from typing import List, Optional
import bcrypt

try:
    from backend.database import get_session
    from backend.models import Company, User, UserRole
except ModuleNotFoundError:
    from database import get_session
    from models import Company, User, UserRole

router = APIRouter(prefix="/company-registration", tags=["company-registration"])
basic_auth = HTTPBasic()
logger = logging.getLogger(__name__)


class CompanyRegistrationRequest(BaseModel):
    company_id: str
    company_name: str
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    admin_username: str
    admin_password: str
    admin_first_name: str = "Admin"
    admin_last_name: str = "User"
    admin_email: Optional[str] = None


class CompanyRegistrationResponse(BaseModel):
    ok: bool
    company_id: str
    company_name: str
    admin_username: str
    message: Optional[str] = None


class DatabaseStatus(BaseModel):
    ok: bool
    connected: bool
    message: str


class CompanyInfo(BaseModel):
    company_id: str
    name: str
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    is_active: bool
    registration_status: Optional[str] = "approved"
    registration_notes: Optional[str] = None
    employee_count: Optional[int] = None


class CompanyStatusUpdate(BaseModel):
    status: str           # "approved" | "denied"
    notes: Optional[str] = None


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def send_pending_registration_email(
    company_name: str,
    company_id: str,
    recipients: List[str],
) -> bool:
    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    if not smtp_host or not recipients:
        return False

    sender = (
        (os.getenv("SMTP_FROM_EMAIL") or "").strip()
        or (os.getenv("SMTP_USERNAME") or "").strip()
        or "no-reply@vadpivi.com"
    )
    smtp_port = int((os.getenv("SMTP_PORT") or "587").strip())
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD") or ""
    use_ssl = (os.getenv("SMTP_USE_SSL") or "").strip().lower() in {"1", "true", "yes", "on"}
    use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in {"1", "true", "yes", "on"}

    msg = EmailMessage()
    msg["Subject"] = f"{company_name} registration is pending approval"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(
        "\n".join(
            [
                f"Hello,",
                "",
                f"Your company registration for {company_name} ({company_id}) has been received.",
                "",
                "Status: Pending approval",
                "",
                "We will notify you once the registration has been reviewed and approved.",
                "",
                "BusinessManager",
            ]
        )
    )

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send company registration pending email")
        return False


def require_company_creation_auth(
    credentials: HTTPBasicCredentials = Depends(basic_auth),
):
    expected_username = os.getenv("COMPANY_CREATION_ADMIN_USERNAME", "admin")
    expected_password = os.getenv("COMPANY_CREATION_ADMIN_PASSWORD", "admin123")

    username_ok = secrets.compare_digest(credentials.username, expected_username)
    password_ok = secrets.compare_digest(credentials.password, expected_password)

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=401,
            detail="Invalid company creation credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    return credentials.username


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=CompanyRegistrationResponse)
def register_company(
    req: CompanyRegistrationRequest,
    session: Session = Depends(get_session)
):
    """
    Submit a new company registration.
    Company is created with is_active=False and registration_status='pending'.
    An admin user is created but cannot log in until the company is approved.
    """
    try:
        cid = req.company_id.strip().upper()
        if not cid:
            raise HTTPException(status_code=400, detail="Company ID is required")
        if not req.company_name.strip():
            raise HTTPException(status_code=400, detail="Company name is required")
        if len(req.admin_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        existing = session.exec(select(Company).where(Company.company_id == cid)).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Company '{cid}' already exists")

        # Create company — inactive and pending review
        company = Company(
            company_id=cid,
            name=req.company_name.strip(),
            company_email=req.company_email.strip() if req.company_email else None,
            company_phone=req.company_phone.strip() if req.company_phone else None,
            company_address=req.company_address.strip() if req.company_address else None,
            is_active=False,
            registration_status="pending",
        )
        session.add(company)
        session.flush()

        # Create admin user (locked out until company is approved)
        admin_user = User(
            company_id=cid,
            username=req.admin_username.strip(),
            password_hash=hash_password(req.admin_password),
            first_name=req.admin_first_name.strip() or "Admin",
            last_name=req.admin_last_name.strip() or "User",
            email=req.admin_email.strip() if req.admin_email else None,
            role=UserRole.ADMIN,
        )
        session.add(admin_user)
        session.commit()

        recipients = []
        for address in [req.company_email, req.admin_email]:
            cleaned = (address or "").strip()
            if cleaned and cleaned not in recipients:
                recipients.append(cleaned)

        email_sent = send_pending_registration_email(
            company_name=req.company_name.strip(),
            company_id=cid,
            recipients=recipients,
        )

        return CompanyRegistrationResponse(
            ok=True,
            company_id=cid,
            company_name=req.company_name.strip(),
            admin_username=req.admin_username.strip(),
            message=(
                "Registration submitted. Your company is pending review. A confirmation email has been sent."
                if email_sent
                else "Registration submitted. Your company is pending review."
            ),
        )

    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.get("/status", response_model=DatabaseStatus)
def get_database_status(session: Session = Depends(get_session)):
    try:
        session.exec(select(Company).limit(1)).first()
        return DatabaseStatus(ok=True, connected=True, message="Database connected")
    except Exception as e:
        return DatabaseStatus(ok=False, connected=False, message=f"Database error: {str(e)}")


@router.get("/companies", response_model=List[CompanyInfo])
def list_companies(
    _: str = Depends(require_company_creation_auth),
    session: Session = Depends(get_session),
):
    """List all companies with registration status (for the management UI)."""
    try:
        companies = session.exec(select(Company).order_by(Company.created_at)).all()
        result = []
        for company in companies:
            users = session.exec(
                select(User).where(User.company_id == company.company_id)
            ).all()
            result.append(CompanyInfo(
                company_id=company.company_id,
                name=company.name,
                company_email=company.company_email,
                company_phone=company.company_phone,
                company_address=company.company_address,
                is_active=company.is_active,
                registration_status=getattr(company, "registration_status", "approved"),
                registration_notes=getattr(company, "registration_notes", None),
                employee_count=len(users),
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/companies/{company_id}/status")
def update_company_status(
    company_id: str,
    body: CompanyStatusUpdate,
    _: str = Depends(require_company_creation_auth),
    session: Session = Depends(get_session),
):
    """
    Approve or deny a pending company registration.
    Approving sets is_active=True so the admin can log in.
    """
    if body.status not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'denied'")

    company = session.exec(
        select(Company).where(Company.company_id == company_id.upper())
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{company_id}' not found")

    company.registration_status = body.status
    company.is_active = body.status == "approved"
    if body.notes is not None:
        company.registration_notes = body.notes

    session.add(company)
    session.commit()
    session.refresh(company)

    return {
        "ok": True,
        "company_id": company.company_id,
        "registration_status": company.registration_status,
        "is_active": company.is_active,
        "message": f"Company '{company.company_id}' has been {body.status}.",
    }

