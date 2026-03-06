# ============================================================
# FILE: features.py
#
# PURPOSE:
#   Manages descriptive features and their options for inventory items.
#   Features are global reusable templates (e.g. "Size", "Color") with
#   options (e.g. "Small", "Red"). Each inventory item can have multiple
#   features attached, with per-option quantity and price data. Only one
#   feature per item may "affect price" (used for price range display).
#
# ENDPOINTS:
#   Global features:
#     GET    /features                                    — list all features + options
#     POST   /features                                    — create new global feature
#     PATCH  /features/{feature_id}                       — rename a feature
#     DELETE /features/{feature_id}                       — delete (blocked if in use)
#     POST   /features/{feature_id}/options               — add option (auto-seeds all items)
#     PATCH  /features/{feature_id}/options/{option_id}   — rename an option
#     DELETE /features/{feature_id}/options/{option_id}   — delete (blocked if qty > 0)
#
#   Aggregate:
#     GET    /features/inventory-summary                               — all items' feature names + price range (for list views)
#     POST   /features/deduct-stock                                    — decrement option quantities after a sale
#
#   Per-inventory-item:
#     GET    /inventory/{inventory_id}/features                        — get item features + option data
#     POST   /inventory/{inventory_id}/features/{feature_id}           — add feature to item
#     DELETE /inventory/{inventory_id}/features/{feature_id}           — remove (blocked if qty > 0)
#     PATCH  /inventory/{inventory_id}/features/affects-price          — set which feature affects price
#     PUT    /inventory/{inventory_id}/features/{feature_id}/options   — bulk-save option data
#
# CHANGE LOG:
#   2026-03-05 | Claude | Initial implementation
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel as PydanticModel

try:
    from backend.database import get_session
    from backend.models import (
        DescriptiveFeature, FeatureOption,
        InventoryFeature, InventoryFeatureOptionData,
        Inventory,
        DescriptiveFeatureRead, FeatureOptionRead,
        InventoryFeatureRead, InventoryFeatureOptionDataRead,
    )
except ModuleNotFoundError:
    from database import get_session
    from models import (
        DescriptiveFeature, FeatureOption,
        InventoryFeature, InventoryFeatureOptionData,
        Inventory,
        DescriptiveFeatureRead, FeatureOptionRead,
        InventoryFeatureRead, InventoryFeatureOptionDataRead,
    )

router = APIRouter()


# ─── REQUEST BODIES ─────────────────────────────────────────────────────────────

class FeatureNameBody(PydanticModel):
    name: str

class AffectsPriceBody(PydanticModel):
    feature_id: Optional[UUID] = None

class OptionDataRow(PydanticModel):
    option_id: UUID
    is_enabled: bool
    quantity: int
    price: Optional[float] = None

class DeductStockItem(PydanticModel):
    inventory_id: UUID
    feature_id: UUID
    option_id: UUID
    quantity: int


# ─── HELPERS ────────────────────────────────────────────────────────────────────

def _recalculate_inventory_stock(session: Session, inventory_id: UUID) -> None:
    """Recompute total stock from all enabled feature option rows and cache on inventory."""
    rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.is_enabled == True,
        )
    ).all()
    total = sum(r.quantity for r in rows)
    item = session.get(Inventory, inventory_id)
    if item:
        item.quantity = total
        session.add(item)
        session.commit()


def _build_feature_read(session: Session, inventory_id: UUID) -> List[InventoryFeatureRead]:
    """Build InventoryFeatureRead list for one inventory item."""
    inv_features = session.exec(
        select(InventoryFeature).where(InventoryFeature.inventory_id == inventory_id)
    ).all()

    result = []
    for inv_feat in inv_features:
        feat = session.get(DescriptiveFeature, inv_feat.feature_id)
        if not feat:
            continue
        options = session.exec(
            select(FeatureOption).where(FeatureOption.feature_id == feat.id)
        ).all()

        option_reads = []
        for opt in options:
            data_row = session.exec(
                select(InventoryFeatureOptionData).where(
                    InventoryFeatureOptionData.inventory_id == inventory_id,
                    InventoryFeatureOptionData.feature_id == feat.id,
                    InventoryFeatureOptionData.option_id == opt.id,
                )
            ).first()
            option_reads.append(InventoryFeatureOptionDataRead(
                option_id=opt.id,
                option_name=opt.name,
                is_enabled=data_row.is_enabled if data_row else False,
                quantity=data_row.quantity if data_row else 0,
                price=data_row.price if data_row else None,
            ))

        result.append(InventoryFeatureRead(
            feature_id=feat.id,
            feature_name=feat.name,
            affects_price=inv_feat.affects_price,
            options=option_reads,
        ))
    return result


# ─── GLOBAL FEATURE ROUTES ──────────────────────────────────────────────────────

@router.get("/features", response_model=List[DescriptiveFeatureRead])
async def list_features(session: Session = Depends(get_session)):
    """List all global descriptive features with their options."""
    features = session.exec(select(DescriptiveFeature)).all()
    result = []
    for feat in features:
        options = session.exec(
            select(FeatureOption).where(FeatureOption.feature_id == feat.id)
        ).all()
        result.append(DescriptiveFeatureRead(
            id=feat.id,
            name=feat.name,
            options=[FeatureOptionRead(id=o.id, feature_id=o.feature_id, name=o.name) for o in options],
        ))
    return result


@router.post("/features", response_model=DescriptiveFeatureRead)
async def create_feature(body: FeatureNameBody, session: Session = Depends(get_session)):
    """Create a new global descriptive feature."""
    existing = session.exec(
        select(DescriptiveFeature).where(DescriptiveFeature.name == body.name.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Feature '{body.name}' already exists.")
    feat = DescriptiveFeature(name=body.name.strip())
    session.add(feat)
    session.commit()
    session.refresh(feat)
    return DescriptiveFeatureRead(id=feat.id, name=feat.name, options=[])


@router.patch("/features/{feature_id}", response_model=DescriptiveFeatureRead)
async def rename_feature(
    feature_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
):
    """Rename a global descriptive feature (propagates instantly via FK join)."""
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat:
        raise HTTPException(status_code=404, detail="Feature not found.")
    conflict = session.exec(
        select(DescriptiveFeature).where(
            DescriptiveFeature.name == body.name.strip(),
            DescriptiveFeature.id != feature_id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f"Feature '{body.name}' already exists.")
    feat.name = body.name.strip()
    session.add(feat)
    session.commit()
    session.refresh(feat)
    options = session.exec(select(FeatureOption).where(FeatureOption.feature_id == feat.id)).all()
    return DescriptiveFeatureRead(
        id=feat.id, name=feat.name,
        options=[FeatureOptionRead(id=o.id, feature_id=o.feature_id, name=o.name) for o in options],
    )


@router.delete("/features/{feature_id}")
async def delete_feature(feature_id: UUID, session: Session = Depends(get_session)):
    """Delete a global feature. Blocked if any inventory item has it added."""
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat:
        raise HTTPException(status_code=404, detail="Feature not found.")
    usages = session.exec(
        select(InventoryFeature).where(InventoryFeature.feature_id == feature_id)
    ).all()
    if usages:
        items = []
        for u in usages:
            inv = session.get(Inventory, u.inventory_id)
            if inv:
                items.append({"id": str(inv.id), "name": inv.name})
        raise HTTPException(
            status_code=409,
            detail={"message": "Feature is in use by inventory items.", "blocking_items": items},
        )
    # Delete options first
    options = session.exec(select(FeatureOption).where(FeatureOption.feature_id == feature_id)).all()
    for opt in options:
        session.delete(opt)
    session.delete(feat)
    session.commit()
    return {"deleted": True}


# ─── AGGREGATE SUMMARY ROUTE ────────────────────────────────────────────────────

@router.get("/features/inventory-summary")
async def get_inventory_summary(session: Session = Depends(get_session)):
    """
    Returns a dict keyed by inventory_id with feature names and price range.
    Used by inventory list and sales page to avoid N+1 per-row fetches.
    Response: { "<inventory_id>": { feature_names: [], price_min: float|null, price_max: float|null } }
    """
    inv_features = session.exec(select(InventoryFeature)).all()

    summary = {}
    for inv_feat in inv_features:
        inv_id = str(inv_feat.inventory_id)
        feat = session.get(DescriptiveFeature, inv_feat.feature_id)
        if not feat:
            continue

        if inv_id not in summary:
            summary[inv_id] = {"feature_names": [], "price_min": None, "price_max": None}

        summary[inv_id]["feature_names"].append(feat.name)

        if inv_feat.affects_price:
            data_rows = session.exec(
                select(InventoryFeatureOptionData).where(
                    InventoryFeatureOptionData.inventory_id == inv_feat.inventory_id,
                    InventoryFeatureOptionData.feature_id == inv_feat.feature_id,
                    InventoryFeatureOptionData.is_enabled == True,
                )
            ).all()
            prices = [r.price for r in data_rows if r.price is not None]
            if prices:
                summary[inv_id]["price_min"] = min(prices)
                summary[inv_id]["price_max"] = max(prices)

    return summary


# ─── DEDUCT STOCK ROUTE ─────────────────────────────────────────────────────────

@router.post("/features/deduct-stock")
async def deduct_feature_stock(
    items: List[DeductStockItem],
    session: Session = Depends(get_session),
):
    """
    Decrement feature option quantities after a sale.
    Floors each quantity at 0 and recalculates total inventory stock per affected item.
    """
    affected_inventory_ids = set()
    for item in items:
        row = session.exec(
            select(InventoryFeatureOptionData).where(
                InventoryFeatureOptionData.inventory_id == item.inventory_id,
                InventoryFeatureOptionData.feature_id == item.feature_id,
                InventoryFeatureOptionData.option_id == item.option_id,
            )
        ).first()
        if row:
            row.quantity = max(0, row.quantity - item.quantity)
            session.add(row)
            affected_inventory_ids.add(item.inventory_id)
    session.commit()
    for inv_id in affected_inventory_ids:
        _recalculate_inventory_stock(session, inv_id)
    return {"deducted": len(affected_inventory_ids)}


# ─── FEATURE OPTION ROUTES ──────────────────────────────────────────────────────

@router.post("/features/{feature_id}/options", response_model=FeatureOptionRead)
async def add_option(
    feature_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
):
    """Add a new option to a global feature. Auto-seeds qty=0 rows for all items using this feature."""
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat:
        raise HTTPException(status_code=404, detail="Feature not found.")
    conflict = session.exec(
        select(FeatureOption).where(
            FeatureOption.feature_id == feature_id,
            FeatureOption.name == body.name.strip(),
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f"Option '{body.name}' already exists on this feature.")

    opt = FeatureOption(feature_id=feature_id, name=body.name.strip())
    session.add(opt)
    session.commit()
    session.refresh(opt)

    # Auto-seed data rows for all inventory items that already have this feature
    usages = session.exec(
        select(InventoryFeature).where(InventoryFeature.feature_id == feature_id)
    ).all()
    for usage in usages:
        existing = session.exec(
            select(InventoryFeatureOptionData).where(
                InventoryFeatureOptionData.inventory_id == usage.inventory_id,
                InventoryFeatureOptionData.feature_id == feature_id,
                InventoryFeatureOptionData.option_id == opt.id,
            )
        ).first()
        if not existing:
            session.add(InventoryFeatureOptionData(
                inventory_id=usage.inventory_id,
                feature_id=feature_id,
                option_id=opt.id,
                is_enabled=False,
                quantity=0,
                price=None,
            ))
    session.commit()

    return FeatureOptionRead(id=opt.id, feature_id=opt.feature_id, name=opt.name)


@router.patch("/features/{feature_id}/options/{option_id}", response_model=FeatureOptionRead)
async def rename_option(
    feature_id: UUID,
    option_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
):
    """Rename a feature option (propagates instantly via FK)."""
    opt = session.get(FeatureOption, option_id)
    if not opt or opt.feature_id != feature_id:
        raise HTTPException(status_code=404, detail="Option not found.")
    conflict = session.exec(
        select(FeatureOption).where(
            FeatureOption.feature_id == feature_id,
            FeatureOption.name == body.name.strip(),
            FeatureOption.id != option_id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f"Option '{body.name}' already exists.")
    opt.name = body.name.strip()
    session.add(opt)
    session.commit()
    session.refresh(opt)
    return FeatureOptionRead(id=opt.id, feature_id=opt.feature_id, name=opt.name)


@router.delete("/features/{feature_id}/options/{option_id}")
async def delete_option(
    feature_id: UUID,
    option_id: UUID,
    session: Session = Depends(get_session),
):
    """Delete a feature option. Blocked if any inventory item has quantity > 0 for this option."""
    opt = session.get(FeatureOption, option_id)
    if not opt or opt.feature_id != feature_id:
        raise HTTPException(status_code=404, detail="Option not found.")

    blocking_rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.option_id == option_id,
            InventoryFeatureOptionData.quantity > 0,
        )
    ).all()
    if blocking_rows:
        items = []
        for row in blocking_rows:
            inv = session.get(Inventory, row.inventory_id)
            if inv:
                items.append({"id": str(inv.id), "name": inv.name, "quantity": row.quantity})
        raise HTTPException(
            status_code=409,
            detail={"message": "Option has stock in inventory items.", "blocking_items": items},
        )

    # Delete all data rows for this option across all inventory items
    all_data_rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.option_id == option_id
        )
    ).all()
    for row in all_data_rows:
        session.delete(row)
    session.delete(opt)
    session.commit()
    return {"deleted": True}


# ─── PER-INVENTORY FEATURE ROUTES ───────────────────────────────────────────────

@router.get("/inventory/{inventory_id}/features", response_model=List[InventoryFeatureRead])
async def get_inventory_features(
    inventory_id: UUID,
    session: Session = Depends(get_session),
):
    """Get all features (with option data) for a specific inventory item."""
    inv = session.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    return _build_feature_read(session, inventory_id)


@router.post("/inventory/{inventory_id}/features/{feature_id}")
async def add_feature_to_inventory(
    inventory_id: UUID,
    feature_id: UUID,
    session: Session = Depends(get_session),
):
    """Add a global feature to an inventory item and seed option data rows."""
    inv = session.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat:
        raise HTTPException(status_code=404, detail="Feature not found.")

    existing = session.exec(
        select(InventoryFeature).where(
            InventoryFeature.inventory_id == inventory_id,
            InventoryFeature.feature_id == feature_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Feature already added to this item.")

    inv_feat = InventoryFeature(
        inventory_id=inventory_id,
        feature_id=feature_id,
        affects_price=False,
    )
    session.add(inv_feat)

    # Seed option data rows
    options = session.exec(select(FeatureOption).where(FeatureOption.feature_id == feature_id)).all()
    for opt in options:
        existing_data = session.exec(
            select(InventoryFeatureOptionData).where(
                InventoryFeatureOptionData.inventory_id == inventory_id,
                InventoryFeatureOptionData.feature_id == feature_id,
                InventoryFeatureOptionData.option_id == opt.id,
            )
        ).first()
        if not existing_data:
            session.add(InventoryFeatureOptionData(
                inventory_id=inventory_id,
                feature_id=feature_id,
                option_id=opt.id,
                is_enabled=False,
                quantity=0,
                price=None,
            ))
    session.commit()
    return {"added": True}


@router.delete("/inventory/{inventory_id}/features/{feature_id}")
async def remove_feature_from_inventory(
    inventory_id: UUID,
    feature_id: UUID,
    session: Session = Depends(get_session),
):
    """Remove a feature from an inventory item. Blocked if any option has quantity > 0."""
    inv_feat = session.exec(
        select(InventoryFeature).where(
            InventoryFeature.inventory_id == inventory_id,
            InventoryFeature.feature_id == feature_id,
        )
    ).first()
    if not inv_feat:
        raise HTTPException(status_code=404, detail="Feature not on this item.")

    # Block if any option has stock
    blocking = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.feature_id == feature_id,
            InventoryFeatureOptionData.quantity > 0,
        )
    ).all()
    if blocking:
        feat = session.get(DescriptiveFeature, feature_id)
        raise HTTPException(
            status_code=409,
            detail=f"Cannot remove '{feat.name if feat else 'feature'}': it still has stock. Set all quantities to 0 first.",
        )

    # Delete option data rows and the link
    data_rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.feature_id == feature_id,
        )
    ).all()
    for row in data_rows:
        session.delete(row)
    session.delete(inv_feat)
    session.commit()
    _recalculate_inventory_stock(session, inventory_id)
    return {"removed": True}


@router.patch("/inventory/{inventory_id}/features/affects-price")
async def set_affects_price(
    inventory_id: UUID,
    body: AffectsPriceBody,
    session: Session = Depends(get_session),
):
    """Set which feature (or none) affects price for an inventory item. Clears all others."""
    all_links = session.exec(
        select(InventoryFeature).where(InventoryFeature.inventory_id == inventory_id)
    ).all()
    for link in all_links:
        link.affects_price = (body.feature_id is not None and link.feature_id == body.feature_id)
        session.add(link)
    session.commit()
    return {"affects_price_feature_id": str(body.feature_id) if body.feature_id else None}


@router.put("/inventory/{inventory_id}/features/{feature_id}/options")
async def save_option_data(
    inventory_id: UUID,
    feature_id: UUID,
    rows: List[OptionDataRow],
    session: Session = Depends(get_session),
):
    """Bulk-save option data (is_enabled, quantity, price) for one feature on one item."""
    for row in rows:
        existing = session.exec(
            select(InventoryFeatureOptionData).where(
                InventoryFeatureOptionData.inventory_id == inventory_id,
                InventoryFeatureOptionData.feature_id == feature_id,
                InventoryFeatureOptionData.option_id == row.option_id,
            )
        ).first()
        if existing:
            existing.is_enabled = row.is_enabled
            existing.quantity = max(0, row.quantity)
            existing.price = row.price
            session.add(existing)
        else:
            session.add(InventoryFeatureOptionData(
                inventory_id=inventory_id,
                feature_id=feature_id,
                option_id=row.option_id,
                is_enabled=row.is_enabled,
                quantity=max(0, row.quantity),
                price=row.price,
            ))
    session.commit()
    _recalculate_inventory_stock(session, inventory_id)
    return {"saved": True}
