"""
COMPANIES ROUTER  --  /api/client/companies
============================================
PUBLIC endpoints -- no authentication required.

GET /companies              -- List all active companies
GET /companies/{id}/logo    -- Serve binary logo image

Queries the Company table (authoritative) and joins AppSettings
for logo and extra info. Works even if AppSettings has no entry yet.
"""

from pathlib import Path
from typing import List, Optional
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response, RedirectResponse
from sqlmodel import Session, select, SQLModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_session
from models import AppSettings, Company

router = APIRouter(prefix="/companies", tags=["companies"])
limiter = Limiter(key_func=get_remote_address)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_UPLOADS_DIR = _REPO_ROOT / "backend" / "uploads"


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


def _company_logo_endpoint(request: Request, company_id: str) -> str:
    """Return an absolute public URL that serves the company logo."""
    return str(request.url_for("get_logo", company_id=company_id))


def _resolve_local_logo_path(stored_value: str) -> Optional[Path]:
    """Resolve legacy on-disk logo paths to a local file when possible."""
    def is_within_uploads(path: Path) -> bool:
        try:
            resolved = path.resolve(strict=True)
        except (FileNotFoundError, OSError, RuntimeError):
            return False

        try:
            return resolved.is_relative_to(_BACKEND_UPLOADS_DIR.resolve())
        except AttributeError:
            uploads_root = str(_BACKEND_UPLOADS_DIR.resolve())
            return str(resolved).startswith(f"{uploads_root}{Path.sep}") or str(resolved) == uploads_root

    candidate = Path(stored_value)
    if candidate.exists() and candidate.is_file() and is_within_uploads(candidate):
        return candidate.resolve(strict=True)

    # Common legacy case: only the filename was stored.
    fallback = _BACKEND_UPLOADS_DIR / candidate.name
    if fallback.exists() and fallback.is_file() and is_within_uploads(fallback):
        return fallback.resolve(strict=True)

    return None


def _to_absolute_url(request: Request, raw_url: str) -> str:
    """Convert a stored relative URL/path into an absolute URL for redirects."""
    value = raw_url.strip()
    if value.startswith(("http://", "https://", "data:", "blob:")):
        return value

    if value.startswith("//"):
        return f"https:{value}"

    base = str(request.base_url).rstrip("/")
    if value.startswith("/"):
        return f"{base}{value}"

    return f"{base}/{value}"


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

        has_logo_data = bool(settings.logo_data) if settings else False
        has_logo_url = bool(settings.logo_url) if settings else False
        logo_url = _company_logo_endpoint(request, company.company_id) if (has_logo_data or has_logo_url) else None

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
        logo_url=_company_logo_endpoint(request, company_id) if (settings.logo_data or settings.logo_url) else None,
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
        local_path = _resolve_local_logo_path(settings.logo_url)
        if local_path:
            media_type, _ = mimetypes.guess_type(str(local_path))
            return FileResponse(path=str(local_path), media_type=media_type or "application/octet-stream")

        return RedirectResponse(url=_to_absolute_url(request, settings.logo_url))

    raise HTTPException(status_code=404, detail="No logo configured for this company.")
