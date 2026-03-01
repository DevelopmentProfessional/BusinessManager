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
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead, UserRole
    )
    from backend.routers.auth import get_current_user
    from backend.seed_data import seed_demo_data
except ModuleNotFoundError:
    from database import get_session
    from models import (
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead, UserRole
    )
    from routers.auth import get_current_user
    from seed_data import seed_demo_data

router = APIRouter()

# Singleton UUID for app settings - always use this ID
SETTINGS_SINGLETON_ID = UUID("00000000-0000-0000-0000-000000000001")


class SeedRequest(BaseModel):
    force: bool = True


# ─── 1 SETTINGS SINGLETON HELPER ───────────────────────────────────────────────

def get_or_create_settings(session: Session) -> AppSettings:
    """Get existing settings or create defaults if none exist."""
    settings = session.get(AppSettings, SETTINGS_SINGLETON_ID)
    if not settings:
        settings = AppSettings(
            id=SETTINGS_SINGLETON_ID,
            start_of_day="06:00",
            end_of_day="21:00",
            attendance_check_in_required=True
        )
        session.add(settings)
        try:
            session.commit()
            session.refresh(settings)
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create default settings: {str(e)}")
    return settings


# ─── 2 SCHEDULE SETTINGS ROUTES ────────────────────────────────────────────────

@router.get("/schedule", response_model=AppSettingsRead)
def get_schedule_settings(session: Session = Depends(get_session)):
    """Get schedule settings (auto-creates defaults if none exist)."""
    settings = get_or_create_settings(session)
    return AppSettingsRead.model_validate(settings)


@router.put("/schedule", response_model=AppSettingsRead)
def update_schedule_settings(
    settings_data: AppSettingsUpdate,
    session: Session = Depends(get_session)
):
    """Update schedule settings."""
    settings = get_or_create_settings(session)

    # Update fields if provided
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
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
