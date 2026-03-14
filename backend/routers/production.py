"""
Production Router
=================
Handles the production task completion workflow.

POST /production/tasks/{schedule_id}/complete
  Atomically:
    1. Consumes resources — decrements each linked resource's inventory.quantity
       by (quantity_per_batch × production_quantity batches)
    2. Increases the product's inventory.quantity by (batch_size × production_quantity)
    3. Sets asset status note (asset is freed — no dedicated status column needed)
    4. Marks the schedule as 'completed'
    5. Returns a summary including any resources now below min_stock_level

GET /production/tasks/{schedule_id}/info
  Returns the full production summary (product, resources, assets, locations)
  so the frontend can display it without hitting multiple ISUD endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime

try:
    from backend.database import get_session
    from backend.models import (
        Schedule, Inventory,
        ProductResource, ProductAsset, ProductLocation,
    )
except ModuleNotFoundError:
    from database import get_session           # type: ignore
    from models import (                       # type: ignore
        Schedule, Inventory,
        ProductResource, ProductAsset, ProductLocation,
    )

router = APIRouter()


def _inventory_by_id(session: Session, item_id: UUID):
    return session.get(Inventory, item_id)


# ─── Info endpoint ─────────────────────────────────────────────────────────────

@router.get("/production/tasks/{schedule_id}/info")
def get_production_info(schedule_id: UUID, session: Session = Depends(get_session)):
    """Return full production info for a scheduled production task."""
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if not schedule.production_item_id:
        return {"product": None, "resources": [], "assets": [], "locations": []}

    product = _inventory_by_id(session, schedule.production_item_id)

    resources_raw = session.exec(
        select(ProductResource).where(ProductResource.inventory_id == schedule.production_item_id)
    ).all()
    assets_raw = session.exec(
        select(ProductAsset).where(ProductAsset.inventory_id == schedule.production_item_id)
    ).all()
    locations_raw = session.exec(
        select(ProductLocation).where(ProductLocation.inventory_id == schedule.production_item_id)
    ).all()

    def inv_name(iid):
        item = _inventory_by_id(session, iid) if iid else None
        return {"id": str(iid), "name": item.name if item else str(iid), "quantity": item.quantity if item else None, "min_stock_level": item.min_stock_level if item else None}

    resources = [
        {
            "id": str(r.id),
            "resource_id": str(r.resource_id),
            "quantity_per_batch": r.quantity_per_batch,
            "notes": r.notes,
            **{k: v for k, v in inv_name(r.resource_id).items() if k != "id"},
        }
        for r in resources_raw
    ]
    assets = [
        {
            "id": str(a.id),
            "asset_id": str(a.asset_id),
            "batch_size": a.batch_size,
            "duration_minutes": a.duration_minutes,
            "notes": a.notes,
            **{k: v for k, v in inv_name(a.asset_id).items() if k != "id"},
        }
        for a in assets_raw
    ]
    locations = [
        {
            "id": str(l.id),
            "location_id": str(l.location_id),
            "notes": l.notes,
            **{k: v for k, v in inv_name(l.location_id).items() if k != "id"},
        }
        for l in locations_raw
    ]

    return {
        "product": {
            "id": str(product.id),
            "name": product.name,
            "quantity": product.quantity,
            "sku": product.sku,
        } if product else None,
        "production_quantity": schedule.production_quantity or 1,
        "resources": resources,
        "assets": assets,
        "locations": locations,
    }


# ─── Complete endpoint ─────────────────────────────────────────────────────────

@router.post("/production/tasks/{schedule_id}/complete")
def complete_production_task(schedule_id: UUID, session: Session = Depends(get_session)):
    """
    Complete a production task:
      - Consume each linked resource proportional to batches produced
      - Increase product stock by batch_size × production_quantity
      - Mark schedule completed
    """
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if getattr(schedule, "task_type", "service") != "production":
        raise HTTPException(status_code=400, detail="This schedule is not a production task")
    if not schedule.production_item_id:
        raise HTTPException(status_code=400, detail="No production item linked to this task")

    production_qty = schedule.production_quantity or 1
    product_id = schedule.production_item_id

    product = _inventory_by_id(session, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Production item not found in inventory")

    resources = session.exec(
        select(ProductResource).where(ProductResource.inventory_id == product_id)
    ).all()
    assets = session.exec(
        select(ProductAsset).where(ProductAsset.inventory_id == product_id)
    ).all()

    low_stock_warnings = []

    try:
        # 1. Consume resources
        for pr in resources:
            resource_item = _inventory_by_id(session, pr.resource_id)
            if resource_item:
                consumed = pr.quantity_per_batch * production_qty
                resource_item.quantity = max(0, (resource_item.quantity or 0) - int(consumed))
                session.add(resource_item)
                if resource_item.quantity <= (resource_item.min_stock_level or 0):
                    low_stock_warnings.append({
                        "id": str(resource_item.id),
                        "name": resource_item.name,
                        "quantity": resource_item.quantity,
                        "min_stock_level": resource_item.min_stock_level,
                    })

        # 2. Determine units produced (use first asset's batch_size, default 1)
        batch_size = assets[0].batch_size if assets else 1
        units_produced = batch_size * production_qty
        product.quantity = (product.quantity or 0) + units_produced
        session.add(product)

        # 3. Mark task completed
        schedule.status = "completed"
        session.add(schedule)

        session.commit()

    except Exception:
        session.rollback()
        raise

    return {
        "ok": True,
        "product_name": product.name,
        "units_produced": units_produced,
        "new_product_quantity": product.quantity,
        "production_quantity": production_qty,
        "low_stock_warnings": low_stock_warnings,
    }
