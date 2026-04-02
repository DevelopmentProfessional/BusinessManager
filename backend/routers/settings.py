# ============================================================
# FILE: settings.py
#
# PURPOSE:
#   Manages application-wide settings (schedule hours, attendance rules, company
#   info) stored as a singleton AppSettings record, and provides an admin-gated
#   endpoint to trigger demo data seeding without direct shell access.
#
# FUNCTIONAL PARTS:
#   [1] Settings Singleton Helper — get or auto-create the single AppSettings row
#   [2] Schedule Settings Routes — GET and PUT for schedule/company configuration
#   [3] Admin Seed Endpoint — POST to trigger demo data seeding (admin + secret key required)
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

import os
from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File
from sqlmodel import Session, select
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

try:
    from backend.database import get_session
    from backend.models import (
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead, Company, UserRole
    )
    from backend.routers.auth import get_current_user
    from backend.seed_data import seed_demo_data
except ModuleNotFoundError:
    from database import get_session
    from models import (
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead, Company, UserRole
    )
    from routers.auth import get_current_user
    from seed_data import seed_demo_data

router = APIRouter()


class SeedRequest(BaseModel):
    force: bool = True


# ─── 1 SETTINGS SINGLETON HELPER ───────────────────────────────────────────────

def resolve_company_id(session: Session, current_user) -> str:
    """Resolve active company id for legacy users missing company_id."""
    if current_user.company_id:
        return current_user.company_id

    companies = session.exec(select(Company).where(Company.is_active == True)).all()
    if len(companies) == 1:
        return companies[0].company_id

    raise HTTPException(
        status_code=400,
        detail="No company is assigned to this user. Please set your company before uploading a logo.",
    )


def get_company(session: Session, company_id: str = "") -> Company | None:
    """Return the company row for the active tenant when available."""
    if not company_id:
        return None

    return session.exec(
        select(Company).where(Company.company_id == company_id)
    ).first()


def sync_settings_from_company(settings: AppSettings, company: Company | None) -> bool:
    """Mirror canonical company metadata into app_settings for backward compatibility."""
    if not company:
        return False

    changed = False
    company_name = (company.name or "").strip()
    if settings.company_name != company_name:
        settings.company_name = company_name
        changed = True
    if settings.company_email != company.company_email:
        settings.company_email = company.company_email
        changed = True
    if settings.company_phone != company.company_phone:
        settings.company_phone = company.company_phone
        changed = True
    if settings.company_address != company.company_address:
        settings.company_address = company.company_address
        changed = True
    if (settings.tax_rate or 0.0) != (company.tax_rate or 0.0):
        settings.tax_rate = company.tax_rate or 0.0
        changed = True

    return changed


def upsert_company_from_settings(session: Session, company_id: str, settings: AppSettings) -> None:
    """Keep the company registry aligned with company-level general settings."""
    if not company_id:
        return

    company_name = (settings.company_name or "").strip()
    company_email = (settings.company_email or "").strip() or None
    company_phone = (settings.company_phone or "").strip() or None
    company_address = (settings.company_address or "").strip() or None
    tax_rate = settings.tax_rate if settings.tax_rate is not None else 0.0

    company = get_company(session, company_id)
    if company:
        if (company.name or "").strip() != company_name:
            company.name = company_name
            company.updated_at = datetime.utcnow()
        if company.company_email != company_email:
            company.company_email = company_email
            company.updated_at = datetime.utcnow()
        if company.company_phone != company_phone:
            company.company_phone = company_phone
            company.updated_at = datetime.utcnow()
        if company.company_address != company_address:
            company.company_address = company_address
            company.updated_at = datetime.utcnow()
        if (company.tax_rate or 0.0) != (tax_rate or 0.0):
            company.tax_rate = tax_rate or 0.0
            company.updated_at = datetime.utcnow()
        return

    session.add(
        Company(
            company_id=company_id,
            name=company_name or "Default Company",
            company_email=company_email,
            company_phone=company_phone,
            company_address=company_address,
            tax_rate=tax_rate or 0.0,
            is_active=True,
        )
    )


def _backfill_company_from_settings_if_needed(company: Company | None, settings: AppSettings) -> bool:
    """Fill newly added company columns from app_settings when company values are missing."""
    if not company:
        return False

    changed = False
    if not (company.name or "").strip() and (settings.company_name or "").strip():
        company.name = settings.company_name.strip()
        changed = True
    if company.company_email is None and settings.company_email is not None:
        company.company_email = settings.company_email
        changed = True
    if company.company_phone is None and settings.company_phone is not None:
        company.company_phone = settings.company_phone
        changed = True
    if company.company_address is None and settings.company_address is not None:
        company.company_address = settings.company_address
        changed = True
    if (company.tax_rate is None or company.tax_rate == 0.0) and (settings.tax_rate not in (None, 0.0)):
        company.tax_rate = settings.tax_rate
        changed = True

    if changed:
        company.updated_at = datetime.utcnow()
    return changed


def _to_settings_response(settings: AppSettings, company: Company | None) -> AppSettingsRead:
    """Build settings response with company-level fields sourced from Company."""
    response = AppSettingsRead.model_validate(settings)
    if company:
        response.company_name = (company.name or "").strip() or response.company_name
        response.company_email = company.company_email if company.company_email is not None else response.company_email
        response.company_phone = company.company_phone if company.company_phone is not None else response.company_phone
        response.company_address = company.company_address if company.company_address is not None else response.company_address
        response.tax_rate = company.tax_rate if company.tax_rate is not None else (response.tax_rate or 0.0)
    return response

def get_or_create_settings(session: Session, company_id: str = "") -> AppSettings:
    """Get existing settings for the company, or create defaults if none exist."""
    # Look up settings by company_id
    stmt = select(AppSettings)
    if company_id:
        stmt = stmt.where(AppSettings.company_id == company_id)
    settings = session.exec(stmt).first()
    company = get_company(session, company_id)

    if not settings:
        settings = AppSettings(
            start_of_day="06:00",
            end_of_day="21:00",
            attendance_check_in_required=True,
            company_name=(company.name.strip() if company and (company.name or "").strip() else None),
            company_email=(company.company_email if company else None),
            company_phone=(company.company_phone if company else None),
            company_address=(company.company_address if company else None),
            tax_rate=(company.tax_rate if company and company.tax_rate is not None else 0.0),
            company_id=company_id or None,
        )
        session.add(settings)
        try:
            session.commit()
            session.refresh(settings)
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create default settings: {str(e)}")
    elif sync_settings_from_company(settings, company):
        settings.updated_at = datetime.utcnow()
        try:
            session.commit()
            session.refresh(settings)
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to sync company settings: {str(e)}")

    if _backfill_company_from_settings_if_needed(company, settings):
        try:
            session.commit()
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to backfill company settings: {str(e)}")

    return settings


# ─── 2 SCHEDULE SETTINGS ROUTES ────────────────────────────────────────────────

@router.get("/schedule", response_model=AppSettingsRead)
def get_schedule_settings(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get schedule settings (auto-creates defaults if none exist)."""
    company_id = resolve_company_id(session, current_user)
    settings = get_or_create_settings(session, company_id)
    company = get_company(session, company_id)
    return _to_settings_response(settings, company)


@router.put("/schedule", response_model=AppSettingsRead)
def update_schedule_settings(
    settings_data: AppSettingsUpdate,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update schedule settings."""
    company_id = resolve_company_id(session, current_user)
    settings = get_or_create_settings(session, company_id)

    # Update fields if provided
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
    upsert_company_from_settings(session, company_id, settings)
    try:
        session.commit()
        session.refresh(settings)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    company = get_company(session, company_id)
    return _to_settings_response(settings, company)


# ─── 2B COMPANY LOGO UPLOAD ────────────────────────────────────────────────────

ALLOWED_LOGO_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_LOGO_SIZE = 5 * 1024 * 1024  # 5MB


@router.put("/logo", response_model=AppSettingsRead)
def upload_company_logo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Upload company logo as binary data (stored canonically on company)."""
    if file.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: JPEG, PNG, GIF, WebP"
        )

    content = file.file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    company_id = resolve_company_id(session, current_user)
    settings = get_or_create_settings(session, company_id)

    company = get_company(session, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    # Canonical company profile storage: keep logo on company table.
    company.logo_data = content
    company.updated_at = datetime.utcnow()
    settings.updated_at = datetime.utcnow()

    try:
        session.commit()
        session.refresh(settings)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return _to_settings_response(settings, company)


# ─── 3 ADMIN SEED ENDPOINT ─────────────────────────────────────────────────────

@router.post("/admin/seed")
def trigger_seed_data(
    payload: SeedRequest,
    x_seed_key: str | None = Header(default=None, alias="X-Seed-Key"),
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Admin-only endpoint to trigger demo data seeding without shell access."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    required_key = os.getenv("SEED_ADMIN_KEY", "ONE_TIME_SEED").strip()
    if required_key and x_seed_key != required_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid seed key")

    try:
        seed_demo_data(session, force=payload.force)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Seeding failed: {exc}")

    return {
        "status": "ok",
        "message": "Seed completed successfully",
        "force": payload.force,
    }


# ─── 4 USER SCHEDULE SETTINGS ──────────────────────────────────────────────────

from sqlmodel import func
from datetime import timedelta

try:
    from backend.models import (
        ScheduleSettings, ScheduleSettingsRead,
        PendingOrder, PendingOrderRead,
        User
    )
except ModuleNotFoundError:
    from models import (
        ScheduleSettings, ScheduleSettingsRead,
        PendingOrder, PendingOrderRead,
        User
    )


@router.get("/schedule-settings/{user_id}", response_model=ScheduleSettingsRead)
def get_user_schedule_settings(
    user_id: UUID,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get schedule settings for a user."""
    # Users can only view their own settings unless they're admin
    if user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    stmt = select(ScheduleSettings).where(
        ScheduleSettings.user_id == user_id,
        ScheduleSettings.company_id == current_user.company_id
    )
    settings = session.exec(stmt).first()

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    return ScheduleSettingsRead.model_validate(settings)


@router.put("/schedule-settings/{user_id}", response_model=ScheduleSettingsRead)
def update_user_schedule_settings(
    user_id: UUID,
    payload: dict,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update schedule settings for a user."""
    # Users can only update their own settings unless they're admin
    if user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    stmt = select(ScheduleSettings).where(
        ScheduleSettings.user_id == user_id,
        ScheduleSettings.company_id == current_user.company_id
    )
    settings = session.exec(stmt).first()

    if not settings:
        # Create if doesn't exist
        settings = ScheduleSettings(
            user_id=user_id,
            company_id=current_user.company_id,
            auto_accept_client_bookings=payload.get("auto_accept_client_bookings", False),
            auto_accept_pending_hours=payload.get("auto_accept_pending_hours")
        )
    else:
        # Update existing
        if "auto_accept_client_bookings" in payload:
            settings.auto_accept_client_bookings = payload["auto_accept_client_bookings"]
        if "auto_accept_pending_hours" in payload:
            settings.auto_accept_pending_hours = payload["auto_accept_pending_hours"]

    settings.updated_at = datetime.utcnow()
    session.add(settings)
    session.commit()
    session.refresh(settings)

    return ScheduleSettingsRead.model_validate(settings)


# ─── 5 PENDING ORDERS ENDPOINTS ────────────────────────────────────────────────

@router.get("/pending-orders")
def list_pending_orders(
    client_id: UUID = None,
    order_type: str = None,
    status: str = None,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List pending review orders."""
    stmt = select(PendingOrder).where(
        PendingOrder.company_id == current_user.company_id
    )

    if client_id:
        stmt = stmt.where(PendingOrder.client_id == client_id)
    if order_type:
        stmt = stmt.where(PendingOrder.order_type == order_type)
    if status:
        stmt = stmt.where(PendingOrder.status == status)

    stmt = stmt.order_by(PendingOrder.created_at.desc())
    orders = session.exec(stmt).all()

    return [PendingOrderRead.model_validate(o) for o in orders]


@router.get("/pending-orders/count")
def get_pending_orders_count(
    client_id: UUID = None,
    order_type: str = None,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get count of pending review orders."""
    stmt = select(func.count(PendingOrder.id)).where(
        PendingOrder.company_id == current_user.company_id,
        PendingOrder.status.in_(["pending", "pending_revision"])
    )

    if client_id:
        stmt = stmt.where(PendingOrder.client_id == client_id)
    if order_type:
        stmt = stmt.where(PendingOrder.order_type == order_type)

    count = session.exec(stmt).first() or 0

    return {
        "pending_count": count,
        "has_pending": count > 0,
        "client_id": str(client_id) if client_id else None,
        "order_type": order_type
    }


@router.get("/pending-orders/summary")
def get_pending_orders_summary(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get summary of pending orders by type and age."""
    now = datetime.utcnow()

    # Count by type
    stmt = select(
        PendingOrder.order_type,
        func.count(PendingOrder.id)
    ).where(
        PendingOrder.company_id == current_user.company_id,
        PendingOrder.status == "pending"
    ).group_by(PendingOrder.order_type)

    type_counts = session.exec(stmt).all()

    # Count by age (how long pending)
    one_day_ago = now - timedelta(days=1)
    three_days_ago = now - timedelta(days=3)

    stmt_fresh = select(func.count(PendingOrder.id)).where(
        PendingOrder.company_id == current_user.company_id,
        PendingOrder.status == "pending",
        PendingOrder.created_at > one_day_ago
    )
    fresh_count = session.exec(stmt_fresh).first() or 0

    stmt_aged = select(func.count(PendingOrder.id)).where(
        PendingOrder.company_id == current_user.company_id,
        PendingOrder.status == "pending",
        PendingOrder.created_at <= one_day_ago,
        PendingOrder.created_at > three_days_ago
    )
    aged_count = session.exec(stmt_aged).first() or 0

    stmt_very_old = select(func.count(PendingOrder.id)).where(
        PendingOrder.company_id == current_user.company_id,
        PendingOrder.status == "pending",
        PendingOrder.created_at <= three_days_ago
    )
    very_old_count = session.exec(stmt_very_old).first() or 0

    return {
        "by_type": {order_type: count for order_type, count in type_counts},
        "by_age": {
            "less_than_1_day": fresh_count,
            "1_to_3_days": aged_count,
            "over_3_days": very_old_count
        },
        "total_pending": sum([count for _, count in type_counts])
    }
