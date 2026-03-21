"""
COMPANIES ROUTER  --  /api/client/companies
============================================
PUBLIC endpoints -- no authentication required.

GET /companies              -- List all active companies
GET /companies/{id}/logo    -- Serve binary logo image

Queries the Company table (authoritative) and joins AppSettings
for logo and extra info. Works even if AppSettings has no entry yet.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, RedirectResponse
from sqlmodel import Session, select, SQLModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_session
from models import AppSettings, Company

router = APIRouter(prefix="/companies", tags=["companies"])
limiter = Limiter(key_func=get_remote_address)


class CompanyListItem(SQLModel):
    company_id: str
    name: str
    logo_url: Optional[str] = None
    has_logo_data: bool = False


@router.get("", response_model=List[CompanyListItem])
@limiter.limit("60/minute")
def list_companies(
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Returns all active companies for the company selection screen.
    Pulls name from the Company table and logo from AppSettings (if set).
    """
    companies = session.exec(
        select(Company).where(Company.is_active == True)
    ).all()

    result = []
    for company in companies:
        # Try to find matching AppSettings for logo
        settings = session.exec(
            select(AppSettings).where(AppSettings.company_id == company.company_id)
        ).first()

        logo_url      = settings.logo_url  if settings and settings.logo_url  else None
        has_logo_data = bool(settings.logo_data) if settings else False

        result.append(CompanyListItem(
            company_id    = company.company_id,
            name          = company.name,
            logo_url      = logo_url,
            has_logo_data = has_logo_data,
        ))

    return result


@router.get("/{company_id}/logo")
@limiter.limit("120/minute")
def get_logo(
    request: Request,
    company_id: str,
    session: Session = Depends(get_session),
):
    """Serve the binary logo stored in app_settings.logo_data."""
    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()

    if not settings:
        raise HTTPException(status_code=404, detail="Company not found.")

    if settings.logo_data:
        data = settings.logo_data
        if data[:4] == b'\x89PNG':
            media_type = "image/png"
        elif data[:2] == b'\xff\xd8':
            media_type = "image/jpeg"
        elif data[:4] == b'GIF8':
            media_type = "image/gif"
        else:
            media_type = "image/png"
        return Response(content=data, media_type=media_type)

    if settings.logo_url:
        return RedirectResponse(url=settings.logo_url)

    raise HTTPException(status_code=404, detail="No logo configured for this company.")
