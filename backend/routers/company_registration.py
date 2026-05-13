"""
Company Registration Router
=============================
Public-facing company creation and registration endpoints.
Used by CompanyCreation web UI to provision new companies.

Endpoints:
  POST /company-registration/register  — Create company + admin user
  GET /company-registration/status     — Get database status
  GET /company-registration/companies  — List all companies (admin only)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, text
from pydantic import BaseModel
from typing import List, Optional
import bcrypt

from database import get_session
from models import Company, User, UserRole

router = APIRouter(prefix="/company-registration", tags=["company-registration"])


class CompanyRegistrationRequest(BaseModel):
    company_id: str
    company_name: str
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
    is_active: bool
    employee_count: Optional[int] = None


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=CompanyRegistrationResponse)
def register_company(
    req: CompanyRegistrationRequest,
    session: Session = Depends(get_session)
):
    """
    Register a new company and create the admin user.
    """
    try:
        # Validate inputs
        cid = req.company_id.strip().upper()
        if not cid:
            raise HTTPException(status_code=400, detail="Company ID is required")
        
        if not req.company_name.strip():
            raise HTTPException(status_code=400, detail="Company name is required")
        
        if len(req.admin_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Check if company already exists
        existing_company = session.exec(
            select(Company).where(Company.company_id == cid)
        ).first()
        
        if existing_company:
            raise HTTPException(status_code=409, detail=f"Company {cid} already exists")
        
        # Create company
        company = Company(
            company_id=cid,
            name=req.company_name.strip(),
            is_active=True
        )
        session.add(company)
        session.flush()
        
        # Create admin user
        admin_user = User(
            company_id=cid,
            username=req.admin_username.strip(),
            password_hash=hash_password(req.admin_password),
            first_name=req.admin_first_name.strip() or "Admin",
            last_name=req.admin_last_name.strip() or "User",
            email=req.admin_email.strip() if req.admin_email else None,
            role=UserRole.ADMIN
        )
        session.add(admin_user)
        session.commit()
        
        return CompanyRegistrationResponse(
            ok=True,
            company_id=cid,
            company_name=req.company_name.strip(),
            admin_username=req.admin_username.strip(),
            message=f"Company {cid} registered successfully"
        )
    
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.get("/status", response_model=DatabaseStatus)
def get_database_status(session: Session = Depends(get_session)):
    """
    Check if database connection is working.
    """
    try:
        # Try a simple query
        result = session.exec(select(Company).limit(1)).first()
        return DatabaseStatus(
            ok=True,
            connected=True,
            message="Database connected"
        )
    except Exception as e:
        return DatabaseStatus(
            ok=False,
            connected=False,
            message=f"Database error: {str(e)}"
        )


@router.get("/companies", response_model=List[CompanyInfo])
def list_companies(session: Session = Depends(get_session)):
    """
    List all companies (for admin/management view).
    """
    try:
        companies = session.exec(select(Company).order_by(Company.created_at)).all()
        
        result = []
        for company in companies:
            # Count employees in this company
            employee_count = session.exec(
                select(User).where(User.company_id == company.company_id)
            ).all()
            
            result.append(CompanyInfo(
                company_id=company.company_id,
                name=company.name,
                is_active=company.is_active,
                employee_count=len(employee_count) if employee_count else 0
            ))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
