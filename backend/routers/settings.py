from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from datetime import datetime
from uuid import UUID

try:
    from backend.database import get_session
    from backend.models import (
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead
    )
except ModuleNotFoundError:
    from database import get_session
    from models import (
        AppSettings, AppSettingsCreate, AppSettingsUpdate, AppSettingsRead
    )

router = APIRouter()

# Singleton UUID for app settings - always use this ID
SETTINGS_SINGLETON_ID = UUID("00000000-0000-0000-0000-000000000001")


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
