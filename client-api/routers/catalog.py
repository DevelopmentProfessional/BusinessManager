"""
CATALOG ROUTER  — /api/client/catalog
======================================
PUBLIC endpoints — no authentication required.
Returns the company's products and services for the client portal catalog.

GET /catalog/products                      — List purchasable products
GET /catalog/products/{id}                 — Single product detail
GET /catalog/services                      — List bookable services
GET /catalog/services/{id}                 — Single service detail
GET /catalog/services/{id}/availability    — Available time slots (next 30 days)

Rate limit: 60 requests / minute per IP
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_session
from models import (
    AppSettings,
    AssetUnit,
    AvailabilitySlot,
    CatalogProductRead,
    CatalogServiceRead,
    Inventory,
    InventoryImage,
    Schedule,
    Service,
    ServiceAsset,
    ServiceEmployee,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])
limiter = Limiter(key_func=get_remote_address)

# DAY_MAP: Python weekday() index → AppSettings field name
_DAY_MAP = {
    0: "monday_enabled",
    1: "tuesday_enabled",
    2: "wednesday_enabled",
    3: "thursday_enabled",
    4: "friday_enabled",
    5: "saturday_enabled",
    6: "sunday_enabled",
}


def _get_settings(company_id: str, session: Session) -> Optional[AppSettings]:
    return session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()


def _image_url_for(inventory_id: UUID, session: Session, company_id: str) -> Optional[str]:
    """Return the primary image URL (or first image) for an inventory item."""
    img = session.exec(
        select(InventoryImage)
        .where(
            InventoryImage.inventory_id == inventory_id,
            InventoryImage.company_id == company_id,
        )
        .order_by(InventoryImage.is_primary.desc(), InventoryImage.sort_order)
    ).first()
    if img:
        return img.image_url or f"/api/client/catalog/images/{img.id}"
    return None


# ── Products ────────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[CatalogProductRead], summary="List all products")
@limiter.limit("60/minute")
def list_products(
    request: Request,
    company_id: str = Query(..., description="Company ID"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    session: Session = Depends(get_session),
):
    """
    Returns all purchasable inventory items (type='product') for a company.

    Query params:
    - `company_id` (required)
    - `category`   — Filter by category
    - `search`     — Full-text search on name
    - `min_price` / `max_price`
    """
    stmt = select(Inventory).where(
        Inventory.company_id == company_id,
        Inventory.type == "product",
        Inventory.quantity > 0,   # Only in-stock items
    )
    if category:
        stmt = stmt.where(Inventory.category == category)
    if search:
        stmt = stmt.where(Inventory.name.ilike(f"%{search}%"))
    if min_price is not None:
        stmt = stmt.where(Inventory.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Inventory.price <= max_price)

    items = session.exec(stmt).all()
    result = []
    for item in items:
        result.append(CatalogProductRead(
            id=item.id,
            name=item.name,
            description=item.description,
            category=item.category,
            price=item.price,
            type=item.type,
            quantity=item.quantity,
            image_url=item.image_url or _image_url_for(item.id, session, company_id),
            company_id=item.company_id,
        ))
    return result


@router.get("/products/{product_id}", response_model=CatalogProductRead, summary="Product detail")
@limiter.limit("60/minute")
def get_product(
    request: Request,
    product_id: UUID,
    company_id: str = Query(...),
    session: Session = Depends(get_session),
):
    item = session.exec(
        select(Inventory).where(
            Inventory.id == product_id,
            Inventory.company_id == company_id,
            Inventory.type == "product",
        )
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Product not found.")
    return CatalogProductRead(
        id=item.id,
        name=item.name,
        description=item.description,
        category=item.category,
        price=item.price,
        type=item.type,
        quantity=item.quantity,
        image_url=item.image_url or _image_url_for(item.id, session, company_id),
        company_id=item.company_id,
    )


# ── Services ────────────────────────────────────────────────────────────────────

@router.get("/services", response_model=List[CatalogServiceRead], summary="List all bookable services")
@limiter.limit("60/minute")
def list_services(
    request: Request,
    company_id: str = Query(...),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Service).where(Service.company_id == company_id)
    if category:
        stmt = stmt.where(Service.category == category)
    if search:
        stmt = stmt.where(Service.name.ilike(f"%{search}%"))

    services = session.exec(stmt).all()
    return [
        CatalogServiceRead(
            id=s.id,
            name=s.name,
            description=s.description,
            category=s.category,
            price=s.price,
            duration_minutes=s.duration_minutes,
            image_url=s.image_url,
            company_id=s.company_id,
        )
        for s in services
    ]


@router.get("/services/{service_id}", response_model=CatalogServiceRead, summary="Service detail")
@limiter.limit("60/minute")
def get_service(
    request: Request,
    service_id: UUID,
    company_id: str = Query(...),
    session: Session = Depends(get_session),
):
    svc = session.exec(
        select(Service).where(
            Service.id == service_id,
            Service.company_id == company_id,
        )
    ).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found.")
    return CatalogServiceRead(
        id=svc.id,
        name=svc.name,
        description=svc.description,
        category=svc.category,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        image_url=svc.image_url,
        company_id=svc.company_id,
    )


# ── Availability ────────────────────────────────────────────────────────────────

@router.get(
    "/services/{service_id}/availability",
    response_model=List[AvailabilitySlot],
    summary="Get available time slots for a service",
)
@limiter.limit("30/minute")
def get_availability(
    request: Request,
    service_id: UUID,
    company_id: str = Query(...),
    date_from: Optional[datetime] = Query(None, description="Start of search window (ISO 8601)"),
    date_to: Optional[datetime] = Query(None, description="End of search window (ISO 8601)"),
    session: Session = Depends(get_session),
):
    """
    Returns available 30-minute slots over the next 30 days (default window).

    Algorithm:
      1. Load AppSettings for business hours and days of operation.
      2. Load employees linked to this service (ServiceEmployee).
      3. Load assets required by this service (ServiceAsset → AssetUnit).
      4. For each day in the window, generate candidate slots.
      5. For each slot, check:
         a. At least one employee has no conflicting Schedule.
         b. At least one unit of each required asset is available (state='available'
            AND no conflicting Schedule linking that unit's schedule_id).
      6. Return slots where ALL constraints are satisfied.

    Response:
    ```json
    [
      {
        "start": "2026-03-22T09:00:00",
        "end":   "2026-03-22T10:00:00",
        "employee_id": "...",
        "employee_name": "Alice",
        "available": true
      }
    ]
    ```
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_start = date_from or now
    window_end   = date_to   or (now + timedelta(days=30))

    # ── Load settings ──────────────────────────────────────────────────────────
    settings = _get_settings(company_id, session)
    if not settings:
        raise HTTPException(status_code=404, detail="Company settings not found.")

    svc = session.exec(
        select(Service).where(Service.id == service_id, Service.company_id == company_id)
    ).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found.")

    duration = timedelta(minutes=svc.duration_minutes or 60)

    start_h, start_m = (int(x) for x in settings.start_of_day.split(":"))
    end_h,   end_m   = (int(x) for x in settings.end_of_day.split(":"))

    # ── Load qualified employees ───────────────────────────────────────────────
    se_rows = session.exec(
        select(ServiceEmployee).where(
            ServiceEmployee.service_id == service_id,
            ServiceEmployee.company_id == company_id,
        )
    ).all()
    employee_ids = [str(row.user_id) for row in se_rows]

    if not employee_ids:
        return []   # No employees configured for this service

    # ── Load required asset types ──────────────────────────────────────────────
    sa_rows = session.exec(
        select(ServiceAsset).where(
            ServiceAsset.service_id == service_id,
            ServiceAsset.company_id == company_id,
        )
    ).all()
    required_asset_inventory_ids = [str(row.inventory_id) for row in sa_rows]

    # ── Pre-fetch all schedules in window (for conflict checking) ─────────────
    existing_schedules = session.exec(
        select(Schedule).where(
            Schedule.company_id == company_id,
            Schedule.status.in_(["scheduled", "confirmed"]),
            Schedule.appointment_date >= window_start,
            Schedule.appointment_date <= window_end + timedelta(days=1),
        )
    ).all()

    def employee_is_free(emp_id: str, slot_start: datetime, slot_end: datetime) -> bool:
        for s in existing_schedules:
            if str(s.employee_id) != emp_id:
                continue
            s_end = s.appointment_date + timedelta(minutes=s.duration_minutes or 60)
            if slot_start < s_end and slot_end > s.appointment_date:
                return False
        return True

    def asset_units_available(slot_start: datetime, slot_end: datetime) -> bool:
        if not required_asset_inventory_ids:
            return True
        for inv_id in required_asset_inventory_ids:
            units = session.exec(
                select(AssetUnit).where(
                    AssetUnit.inventory_id == UUID(inv_id),
                    AssetUnit.company_id == company_id,
                )
            ).all()
            # Check if any unit is free during this slot
            has_free = False
            for unit in units:
                if unit.state not in ("available", "arriving_soon"):
                    continue
                if unit.schedule_id is None:
                    has_free = True
                    break
                # Check if the linked schedule overlaps
                linked = next((s for s in existing_schedules if str(s.id) == str(unit.schedule_id)), None)
                if linked:
                    s_end = linked.appointment_date + timedelta(minutes=linked.duration_minutes or 60)
                    if not (slot_start < s_end and slot_end > linked.appointment_date):
                        has_free = True
                        break
                else:
                    has_free = True
                    break
            if not has_free:
                return False
        return True

    # ── Generate slots ─────────────────────────────────────────────────────────
    slots: List[AvailabilitySlot] = []
    slot_step = timedelta(minutes=30)   # Granularity: 30-minute grid

    current_day = window_start.replace(hour=0, minute=0, second=0, microsecond=0)
    while current_day <= window_end:
        day_name = _DAY_MAP[current_day.weekday()]
        if not getattr(settings, day_name, False):
            current_day += timedelta(days=1)
            continue

        slot_time = current_day.replace(hour=start_h, minute=start_m)
        day_end   = current_day.replace(hour=end_h,   minute=end_m)

        while slot_time + duration <= day_end:
            slot_end = slot_time + duration
            if slot_time < now:
                slot_time += slot_step
                continue

            # Check each employee
            for emp_id in employee_ids:
                if employee_is_free(emp_id, slot_time, slot_end) and asset_units_available(slot_time, slot_end):
                    slots.append(AvailabilitySlot(
                        start=slot_time,
                        end=slot_end,
                        employee_id=emp_id,
                        employee_name="",   # Populated below if needed; omitted for privacy
                        available=True,
                    ))
                    break   # Only one slot per time-block needed

            slot_time += slot_step

        current_day += timedelta(days=1)

    return slots
