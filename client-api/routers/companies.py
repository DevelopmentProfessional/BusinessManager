"""
COMPANIES ROUTER  — /api/client/companies
==========================================
PUBLIC endpoint — no authentication required.
Returns all active companies so the client portal can show
the company selection screen on first visit.

GET /companies          — List all active companies (name + logo)
GET /companies/{id}/logo — Serve binary logo image
"""

import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import Response as FastAPIResponse
from sqlmodel import Session, select, SQLModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from uuid import UUID

from database import get_session
from models import AppSettings

router = APIRouter(prefix="/companies", tags=["companies"])
limiter = Limiter(key_func=get_remote_address)


class CompanyListItem(SQLModel):
    company_id: str
    name: str
    logo_url: Optional[str] = None
    has_logo_data: bool = False   # True = use /companies/{id}/logo for binary logo


@router.get("", response_model=List[CompanyListItem], summary="List all companies")
@limiter.limit("60/minute")
def list_companies(
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Returns all companies that have app settings configured.
    Used by the client portal company selection screen.

    Response:
    ```json
    [
      {
        "company_id": "acme-corp",
        "name": "Acme Corporation",
        "logo_url": "https://...",
        "has_logo_data": false
      }
    ]
    ```
    """
    rows = session.exec(
        select(AppSettings).where(AppSettings.company_name != None)
    ).all()

    result = []
    for row in rows:
        if not row.company_id or not row.company_name:
            continue
        result.append(CompanyListItem(
            company_id=row.company_id,
            name=row.company_name,
            logo_url=row.logo_url if row.logo_url else None,
            has_logo_data=bool(row.logo_data),
        ))
    return result


@router.get("/{company_id}/logo", summary="Serve company logo binary")
@limiter.limit("120/minute")
def get_logo(
    request: Request,
    company_id: str,
    session: Session = Depends(get_session),
):
    """
    Serves the binary logo stored in app_settings.logo_data.
    Returns the image directly for use in <img src="/api/client/companies/acme/logo">.
    """
    row = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Company not found.")

    if row.logo_data:
        # Detect image type from magic bytes
        data = row.logo_data
        if data[:4] == b'\x89PNG':
            media_type = "image/png"
        elif data[:2] == b'\xff\xd8':
            media_type = "image/jpeg"
        elif data[:4] == b'GIF8':
            media_type = "image/gif"
        elif data[:4] == b'RIFF':
            media_type = "image/webp"
        else:
            media_type = "image/png"
        return FastAPIResponse(content=data, media_type=media_type)

    if row.logo_url:
        # Redirect to external URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=row.logo_url)

    raise HTTPException(status_code=404, detail="No logo configured for this company.")
