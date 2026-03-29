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

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
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
    ServiceResource,
    User,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

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
        .where(InventoryImage.inventory_id == inventory_id)
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
        func.lower(Inventory.type) == "product",
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
      2. Load employees linked to this service (ServiceEmployee) with their lunch blocks.
      3. Load assets required by this service (ServiceAsset → AssetUnit).
      4. Load consumable resources required by this service (ServiceResource → Inventory).
      5. For each day in the window, generate candidate slots (past slots are skipped).
      6. For each slot, check:
         a. At least one employee is free (no conflicting Schedule AND not during their lunch).
         b. At least one unit of each required asset is available.
         c. All required consumable resources have sufficient projected stock, OR a
            procurement order placed today would arrive before the slot time.
      7. Return slots where ALL constraints are satisfied.
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

    # ── Load qualified employees (with lunch info) ─────────────────────────────
    se_rows = session.exec(
        select(ServiceEmployee).where(
            ServiceEmployee.service_id == service_id,
            ServiceEmployee.company_id == company_id,
        )
    ).all()
    employee_ids = [str(row.user_id) for row in se_rows]

    # Build lunch blocks per employee: { emp_id: (lunch_h, lunch_m, duration_min) | None }
    employee_lunch: dict = {}
    for emp_id in employee_ids:
        try:
            user = session.exec(
                select(User).where(User.id == UUID(emp_id))
            ).first()
        except Exception:
            user = None
        if user and user.lunch_start:
            try:
                lh, lm = (int(x) for x in user.lunch_start.split(":"))
                ld = user.lunch_duration_minutes or 30
                employee_lunch[emp_id] = (lh, lm, ld)
            except Exception:
                employee_lunch[emp_id] = None
        else:
            employee_lunch[emp_id] = None

    # ── Load required asset types ──────────────────────────────────────────────
    sa_rows = session.exec(
        select(ServiceAsset).where(
            ServiceAsset.service_id == service_id,
            ServiceAsset.company_id == company_id,
        )
    ).all()
    required_asset_inventory_ids = [str(row.inventory_id) for row in sa_rows]

    # ── Load required consumable resources ────────────────────────────────────
    sr_rows = session.exec(
        select(ServiceResource).where(
            ServiceResource.service_id == service_id,
            ServiceResource.company_id == company_id,
        )
    ).all()
    # [ (inventory_id_str, qty_per_service) ]
    required_resources: list[tuple[str, float]] = [
        (str(r.inventory_id), r.quantity) for r in sr_rows
    ]

    # Pre-fetch inventory records for resource items (for stock levels + procurement)
    resource_inventory: dict[str, Inventory] = {}
    for inv_id, _ in required_resources:
        inv = session.exec(
            select(Inventory).where(Inventory.id == UUID(inv_id))
        ).first()
        if inv:
            resource_inventory[inv_id] = inv

    # ── Pre-fetch all hard-confirmed schedules in window ──────────────────────
    # "soft_hold" schedules are intentionally excluded: a slot held by a soft
    # booking is still bookable by a hard booker, so it shows as available here.
    existing_schedules = session.exec(
        select(Schedule).where(
            Schedule.company_id == company_id,
            Schedule.status.in_(["scheduled", "confirmed"]),
            Schedule.appointment_date >= window_start,
            Schedule.appointment_date <= window_end + timedelta(days=1),
        )
    ).all()

    # Count how many times each service has been scheduled (for resource consumption)
    # We need all schedules that consume resources for THIS service type, but since
    # Schedule only stores service_id we check schedules for the same service_id
    resource_consuming_schedules = [
        s for s in existing_schedules
        if str(s.service_id) == str(service_id)
    ]

    # ── Helper: employee available at slot (no schedule conflict, not lunch) ───
    def employee_is_free(emp_id: str, slot_start: datetime, slot_end: datetime) -> bool:
        # Check schedule conflicts
        for s in existing_schedules:
            if str(s.employee_id) != emp_id:
                continue
            s_end = s.appointment_date + timedelta(minutes=s.duration_minutes or 60)
            if slot_start < s_end and slot_end > s.appointment_date:
                return False
        # Check lunch block
        lunch = employee_lunch.get(emp_id)
        if lunch:
            lh, lm, ld = lunch
            lunch_start_dt = slot_start.replace(hour=lh, minute=lm, second=0, microsecond=0)
            lunch_end_dt = lunch_start_dt + timedelta(minutes=ld)
            if slot_start < lunch_end_dt and slot_end > lunch_start_dt:
                return False
        return True

    # ── Helper: asset units available at slot ─────────────────────────────────
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
            has_free = False
            for unit in units:
                if unit.state not in ("available", "arriving_soon"):
                    continue
                if unit.schedule_id is None:
                    has_free = True
                    break
                # Check if the linked schedule overlaps this slot
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

    # ── Helper: consumable resources available for this slot ──────────────────
    def resources_available(slot_start: datetime) -> bool:
        """
        For each required consumable resource:
          1. Count how many same-service bookings are scheduled BEFORE this slot
             (they have consumed stock already or will before this slot).
          2. projected_qty = current_qty - (prior_bookings * qty_per_service)
          3. If projected_qty >= required_qty → OK.
          4. Else check if procurement can arrive before slot:
             procurement_lead_days is the days from order to delivery.
             If (slot_start - now).days >= procurement_lead_days → restock arrives in time → OK.
          5. Otherwise → not available.
        """
        if not required_resources:
            return True

        for inv_id, qty_needed in required_resources:
            inv = resource_inventory.get(inv_id)
            if not inv:
                logger.warning("Availability check failed pessimistically because inventory resource %s is missing from resource_inventory.", inv_id)
                return False

            current_qty = inv.quantity

            # Count bookings of this service scheduled before this slot
            prior_bookings = sum(
                1 for s in resource_consuming_schedules
                if s.appointment_date < slot_start
            )
            projected_qty = current_qty - (prior_bookings * qty_needed)

            if projected_qty >= qty_needed:
                continue  # Enough stock

            # Not enough stock — can a procurement order arrive in time?
            lead_days = inv.procurement_lead_days
            if lead_days is not None and lead_days >= 0:
                days_until_slot = (slot_start - now).total_seconds() / 86400
                if days_until_slot >= lead_days:
                    continue  # Procurement arrives before slot; restock expected

            return False  # Insufficient stock and no procurement rescue

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

            # Never return past slots
            if slot_time < now:
                slot_time += slot_step
                continue

            # Check resource availability (same for all employees)
            if not resources_available(slot_time):
                slots.append(AvailabilitySlot(
                    start=slot_time,
                    end=slot_end,
                    employee_id="",
                    employee_name="",
                    available=False,
                ))
                slot_time += slot_step
                continue

            # Check each employee — first free one wins
            available_slot = None
            for emp_id in employee_ids:
                if employee_is_free(emp_id, slot_time, slot_end) and asset_units_available(slot_time, slot_end):
                    available_slot = AvailabilitySlot(
                        start=slot_time,
                        end=slot_end,
                        employee_id=emp_id,
                        employee_name="",   # Omitted for client privacy
                        available=True,
                    )
                    break   # Only one slot per time-block needed

            slots.append(
                available_slot
                or AvailabilitySlot(
                    start=slot_time,
                    end=slot_end,
                    employee_id="",
                    employee_name="",
                    available=False,
                )
            )

            slot_time += slot_step

        current_day += timedelta(days=1)

    return slots
