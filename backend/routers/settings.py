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
from fastapi import APIRouter, Depends, HTTPException, status, Header
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

def get_company(session: Session, company_id: str = "") -> Company | None:
    """Return the company row for the active tenant when available."""
    if not company_id:
        return None

    return session.exec(
        select(Company).where(Company.company_id == company_id)
    ).first()


def sync_settings_from_company(settings: AppSettings, company: Company | None) -> bool:
    """Copy canonical company metadata into settings when settings are still blank."""
    if not company:
        return False

    changed = False
    if not (settings.company_name or "").strip() and (company.name or "").strip():
        settings.company_name = company.name.strip()
        changed = True

    return changed


def upsert_company_from_settings(session: Session, company_id: str, settings: AppSettings) -> None:
    """Keep the company registry aligned with the settings company name."""
    if not company_id:
        return

    company_name = (settings.company_name or "").strip()
    if not company_name:
        return

    company = get_company(session, company_id)
    if company:
        if (company.name or "").strip() != company_name:
            company.name = company_name
            company.updated_at = datetime.utcnow()
        return

    session.add(
        Company(
            company_id=company_id,
            name=company_name,
            is_active=True,
        )
    )

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

    return settings


# ─── 2 SCHEDULE SETTINGS ROUTES ────────────────────────────────────────────────

@router.get("/schedule", response_model=AppSettingsRead)
def get_schedule_settings(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get schedule settings (auto-creates defaults if none exist)."""
    settings = get_or_create_settings(session, current_user.company_id or "")
    return AppSettingsRead.model_validate(settings)


@router.put("/schedule", response_model=AppSettingsRead)
def update_schedule_settings(
    settings_data: AppSettingsUpdate,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update schedule settings."""
    settings = get_or_create_settings(session, current_user.company_id or "")

    # Update fields if provided
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
    upsert_company_from_settings(session, current_user.company_id or "", settings)
    try:
        session.commit()
        session.refresh(settings)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return AppSettingsRead.model_validate(settings)


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
except ImportError:
    from models import (
        ScheduleSettings, ScheduleSettingsRead,
        PendingOrder, PendingOrderRead,
        User
    )


@router.get("/api/v1/schedule-settings/{user_id}", response_model=AppSettingsRead)
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


@router.put("/api/v1/schedule-settings/{user_id}", response_model=AppSettingsRead)
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

@router.get("/api/v1/pending-orders")
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


@router.get("/api/v1/pending-orders/count")
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


@router.get("/api/v1/pending-orders/summary")
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
