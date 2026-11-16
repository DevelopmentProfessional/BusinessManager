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
        ProductResource, ProductAsset, ProductLocation, User,
    )
    from backend.routers.auth import get_current_user
    from backend.inventory_costing import add_inventory_cost_layer, consume_inventory_fifo
except ModuleNotFoundError:
    from database import get_session           # type: ignore
    from models import (                       # type: ignore
        Schedule, Inventory,
        ProductResource, ProductAsset, ProductLocation, User,
    )
    from routers.auth import get_current_user  # type: ignore
    from inventory_costing import add_inventory_cost_layer, consume_inventory_fifo  # type: ignore

router = APIRouter()


def _inventory_by_id(session: Session, item_id: UUID):
    return session.get(Inventory, item_id)


# ─── Info endpoint ─────────────────────────────────────────────────────────────

@router.get("/production/tasks/{schedule_id}/info")
def get_production_info(schedule_id: UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
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
def complete_production_task(schedule_id: UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """
    Complete a production task:
      - Consume each linked resource proportional to batches produced
      - Increase product stock by batch_size × production_quantity
      - Mark schedule completed
    """
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.status == "completed":
        raise HTTPException(status_code=409, detail="This production task has already been completed")
    if getattr(schedule, "task_type", "service") != "production":
        raise HTTPException(status_code=400, detail="This schedule is not a production task")
    if not schedule.production_item_id:
        raise HTTPException(status_code=400, detail="No production item linked to this task")

    production_qty = max(1, int(schedule.production_quantity or 1))
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
    known_input_cost = 0.0
    all_input_cost_known = bool(resources)

    try:
        # 1. Consume resources
        for pr in resources:
            resource_item = _inventory_by_id(session, pr.resource_id)
            if resource_item:
                consumed = float(pr.quantity_per_batch) * production_qty
                if consumed > 0:
                    cost_result = consume_inventory_fifo(
                        session,
                        resource_item,
                        consumed,
                        reference_type="production_task",
                        reference_id=schedule.id,
                        company_id=current_user.company_id,
                    )
                    known_cost = cost_result["known_cost_amount"]
                    if known_cost is not None:
                        known_input_cost += float(known_cost)
                    if cost_result["unknown_quantity"] or cost_result["short_quantity"]:
                        all_input_cost_known = False
                else:
                    all_input_cost_known = False
                if (
                    resource_item.min_stock_level is not None
                    and resource_item.quantity <= resource_item.min_stock_level
                ):
                    low_stock_warnings.append({
                        "id": str(resource_item.id),
                        "name": resource_item.name,
                        "quantity": resource_item.quantity,
                        "min_stock_level": resource_item.min_stock_level,
                    })
            else:
                all_input_cost_known = False

        # 2. Determine units produced (use first asset's batch_size, default 1)
        batch_size = assets[0].batch_size if assets else 1
        units_produced = batch_size * production_qty
        product.quantity = (product.quantity or 0) + units_produced
        session.add(product)
        add_inventory_cost_layer(
            session,
            product,
            units_produced,
            known_input_cost / units_produced if all_input_cost_known and units_produced > 0 else None,
            source_type="production_output",
            source_reference_id=schedule.id,
            company_id=current_user.company_id,
        )

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
