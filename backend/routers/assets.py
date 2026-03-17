# ============================================================
# FILE: assets.py
#
# PURPOSE:
#   Manages individual physical units of ASSET-type inventory items.
#   Each AssetUnit tracks one real-world unit with a state:
#     available | in_use | maintenance | arriving_soon
#   Includes a conflict-check endpoint for scheduling.
#
# ENDPOINTS:
#   GET    /inventory/{id}/asset-units              — list all units for an asset
#   POST   /inventory/{id}/asset-units              — add a unit (increments quantity)
#   PUT    /inventory/{id}/asset-units/{unit_id}    — update state / label / notes
#   DELETE /inventory/{id}/asset-units/{unit_id}    — remove unit (decrements quantity)
#   GET    /inventory/{id}/asset-units/availability — availability summary + conflict warning
#
# CHANGE LOG:
#   2026-03-17 | Claude | Initial implementation
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

try:
    from backend.database import get_session
    from backend.models import (
        AssetUnit, AssetUnitRead, AssetUnitCreate, AssetUnitUpdate,
        Inventory, Schedule, User, ASSET_UNIT_STATES,
    )
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import (
        AssetUnit, AssetUnitRead, AssetUnitCreate, AssetUnitUpdate,
        Inventory, Schedule, User, ASSET_UNIT_STATES,
    )
    from routers.auth import get_current_user

router = APIRouter()


def _get_asset(session: Session, inventory_id: UUID, company_id: str) -> Inventory:
    item = session.get(Inventory, inventory_id)
    if not item or item.company_id != company_id:
        raise HTTPException(status_code=404, detail="Asset not found")
    if item.type.upper() != "ASSET":
        raise HTTPException(status_code=400, detail="Item is not an ASSET type")
    return item


def _sync_quantity(session: Session, inventory_id: UUID):
    """Keep inventory.quantity equal to the total number of asset_unit rows."""
    count = session.exec(
        select(AssetUnit).where(AssetUnit.inventory_id == inventory_id)
    ).all()
    item = session.get(Inventory, inventory_id)
    if item:
        item.quantity = len(count)
        session.add(item)
        session.commit()


# ─── LIST ────────────────────────────────────────────────────────────────────

@router.get("/inventory/{inventory_id}/asset-units")
async def list_asset_units(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _get_asset(session, inventory_id, current_user.company_id)
    units = session.exec(
        select(AssetUnit)
        .where(AssetUnit.inventory_id == inventory_id)
        .order_by(AssetUnit.created_at)
    ).all()
    return [AssetUnitRead.model_validate(u) for u in units]


# ─── CREATE ──────────────────────────────────────────────────────────────────

@router.post("/inventory/{inventory_id}/asset-units", status_code=201)
async def add_asset_unit(
    inventory_id: UUID,
    body: AssetUnitCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _get_asset(session, inventory_id, current_user.company_id)
    if body.state not in ASSET_UNIT_STATES:
        raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of: {sorted(ASSET_UNIT_STATES)}")
    unit = AssetUnit(
        inventory_id=inventory_id,
        label=body.label,
        state=body.state,
        notes=body.notes,
        company_id=current_user.company_id,
    )
    session.add(unit)
    session.commit()
    session.refresh(unit)
    _sync_quantity(session, inventory_id)
    return AssetUnitRead.model_validate(unit)


# ─── UPDATE ──────────────────────────────────────────────────────────────────

@router.put("/inventory/{inventory_id}/asset-units/{unit_id}")
async def update_asset_unit(
    inventory_id: UUID,
    unit_id: UUID,
    body: AssetUnitUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _get_asset(session, inventory_id, current_user.company_id)
    unit = session.get(AssetUnit, unit_id)
    if not unit or unit.inventory_id != inventory_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    if body.state is not None and body.state not in ASSET_UNIT_STATES:
        raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of: {sorted(ASSET_UNIT_STATES)}")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(unit, field, value)
    unit.updated_at = datetime.utcnow()
    session.add(unit)
    session.commit()
    session.refresh(unit)
    return AssetUnitRead.model_validate(unit)


# ─── DELETE ──────────────────────────────────────────────────────────────────

@router.delete("/inventory/{inventory_id}/asset-units/{unit_id}")
async def delete_asset_unit(
    inventory_id: UUID,
    unit_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _get_asset(session, inventory_id, current_user.company_id)
    unit = session.get(AssetUnit, unit_id)
    if not unit or unit.inventory_id != inventory_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    session.delete(unit)
    session.commit()
    _sync_quantity(session, inventory_id)
    return {"deleted": True}


# ─── AVAILABILITY CHECK ───────────────────────────────────────────────────────

@router.get("/inventory/{inventory_id}/asset-units/availability")
async def check_availability(
    inventory_id: UUID,
    appointment_date: Optional[str] = None,   # ISO datetime string
    duration_minutes: Optional[int] = 60,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a state summary and, if appointment_date is provided,
    whether enough units are available for a new appointment at that time.

    Conflict logic: a unit is considered 'conflict' if its state is 'in_use'
    AND it is linked to a schedule that overlaps with the requested window.
    Units in 'maintenance' or 'arriving_soon' are also not available.
    """
    _get_asset(session, inventory_id, current_user.company_id)
    units = session.exec(
        select(AssetUnit).where(AssetUnit.inventory_id == inventory_id)
    ).all()

    state_counts = {"available": 0, "in_use": 0, "maintenance": 0, "arriving_soon": 0}
    for u in units:
        state_counts[u.state] = state_counts.get(u.state, 0) + 1

    conflict_info = None
    if appointment_date:
        try:
            appt_start = datetime.fromisoformat(appointment_date.replace("Z", "+00:00"))
            appt_end = appt_start + timedelta(minutes=duration_minutes or 60)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid appointment_date format. Use ISO 8601.")

        # Find all units in_use with a schedule_id
        in_use_with_schedule = [u for u in units if u.state == "in_use" and u.schedule_id]
        conflicting_unit_ids = []
        for u in in_use_with_schedule:
            schedule = session.get(Schedule, u.schedule_id)
            if schedule:
                s_start = schedule.appointment_date
                s_end = s_start + timedelta(minutes=schedule.duration_minutes or 60)
                # Overlap: starts before other ends AND ends after other starts
                if s_start < appt_end and s_end > appt_start:
                    conflicting_unit_ids.append(str(u.id))

        # Units blocked for this slot: in_use+conflict + maintenance + arriving_soon
        units_blocked = (
            len(conflicting_unit_ids)
            + state_counts.get("maintenance", 0)
            + state_counts.get("arriving_soon", 0)
        )
        units_free = len(units) - units_blocked
        conflict_info = {
            "available_for_slot": max(0, units_free),
            "blocked_count": units_blocked,
            "conflicting_unit_ids": conflicting_unit_ids,
            "has_conflict": units_free < 1,
        }

    return {
        "total": len(units),
        "state_counts": state_counts,
        "conflict_check": conflict_info,
    }
