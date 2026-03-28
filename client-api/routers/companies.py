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


class PortalBranding(SQLModel):
    company_id: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    has_logo_data: bool = False
    # Hero
    portal_hero_title: Optional[str] = None
    portal_hero_subtitle: Optional[str] = None
    portal_hero_tagline: Optional[str] = None
    portal_hero_bg_color: Optional[str] = None
    portal_hero_text_color: Optional[str] = None
    portal_hero_image_url: Optional[str] = None
    has_hero_image_data: bool = False
    portal_show_hero: bool = True
    # Banner
    portal_banner_text: Optional[str] = None
    portal_banner_color: Optional[str] = None
    portal_show_banner: bool = False
    # Footer / general
    portal_footer_text: Optional[str] = None
    portal_primary_color: Optional[str] = None
    portal_secondary_color: Optional[str] = None


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


@router.get("/{company_id}/branding", response_model=PortalBranding)
@limiter.limit("120/minute")
def get_branding(
    request: Request,
    company_id: str,
    session: Session = Depends(get_session),
):
    """Return portal branding settings for a company (public)."""
    company = session.exec(
        select(Company).where(Company.company_id == company_id)
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()

    if not settings:
        return PortalBranding(company_id=company_id, company_name=company.name)

    return PortalBranding(
        company_id=company_id,
        company_name=settings.company_name or company.name,
        logo_url=settings.logo_url,
        has_logo_data=bool(settings.logo_data),
        portal_hero_title=settings.portal_hero_title,
        portal_hero_subtitle=settings.portal_hero_subtitle,
        portal_hero_tagline=settings.portal_hero_tagline,
        portal_hero_bg_color=settings.portal_hero_bg_color,
        portal_hero_text_color=settings.portal_hero_text_color,
        portal_hero_image_url=settings.portal_hero_image_url,
        has_hero_image_data=bool(settings.portal_hero_image_data),
        portal_show_hero=settings.portal_show_hero if settings.portal_show_hero is not None else True,
        portal_banner_text=settings.portal_banner_text,
        portal_banner_color=settings.portal_banner_color,
        portal_show_banner=settings.portal_show_banner if settings.portal_show_banner is not None else False,
        portal_footer_text=settings.portal_footer_text,
        portal_primary_color=settings.portal_primary_color,
        portal_secondary_color=settings.portal_secondary_color,
    )


@router.get("/{company_id}/hero-image")
@limiter.limit("120/minute")
def get_hero_image(
    request: Request,
    company_id: str,
    session: Session = Depends(get_session),
):
    """Serve the binary hero image stored in app_settings.portal_hero_image_data."""
    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()

    if not settings:
        raise HTTPException(status_code=404, detail="Company not found.")

    if settings.portal_hero_image_data:
        data = settings.portal_hero_image_data
        if data[:4] == b'\x89PNG':
            media_type = "image/png"
        elif data[:2] == b'\xff\xd8':
            media_type = "image/jpeg"
        elif data[:4] == b'GIF8':
            media_type = "image/gif"
        else:
            media_type = "image/png"
        return Response(content=data, media_type=media_type)

    if settings.portal_hero_image_url:
        return RedirectResponse(url=settings.portal_hero_image_url)

    raise HTTPException(status_code=404, detail="No hero image configured.")


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
