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
import json
from pydantic import BaseModel as PydanticModel

try:
    from backend.database import get_session
    from backend.models import (
        DescriptiveFeature, FeatureOption,
        InventoryFeature, InventoryFeatureOptionData, InventoryFeatureCombination,
        Inventory, User,
        DescriptiveFeatureRead, FeatureOptionRead,
        InventoryFeatureRead, InventoryFeatureOptionDataRead,
        InventoryFeatureCombinationRead, InventoryFeatureCombinationWrite,
    )
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import (
        DescriptiveFeature, FeatureOption,
        InventoryFeature, InventoryFeatureOptionData, InventoryFeatureCombination,
        Inventory, User,
        DescriptiveFeatureRead, FeatureOptionRead,
        InventoryFeatureRead, InventoryFeatureOptionDataRead,
        InventoryFeatureCombinationRead, InventoryFeatureCombinationWrite,
    )
    from routers.auth import get_current_user

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
    feature_id: Optional[UUID] = None
    option_id: Optional[UUID] = None
    option_ids: Optional[List[UUID]] = None
    quantity: int


# ─── HELPERS ────────────────────────────────────────────────────────────────────

def _build_combination_key(option_ids: List[UUID]) -> str:
    return "|".join(sorted(str(option_id) for option_id in option_ids))


def _get_inventory_features(session: Session, inventory_id: UUID) -> List[InventoryFeature]:
    return session.exec(
        select(InventoryFeature).where(InventoryFeature.inventory_id == inventory_id)
    ).all()


def _get_combination_rows(session: Session, inventory_id: UUID) -> List[InventoryFeatureCombination]:
    return session.exec(
        select(InventoryFeatureCombination).where(InventoryFeatureCombination.inventory_id == inventory_id)
    ).all()


def _get_enabled_feature_ids(session: Session, inventory_id: UUID) -> List[UUID]:
    rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.is_enabled == True,
        )
    ).all()
    ordered: List[UUID] = []
    seen = set()
    for row in rows:
        if row.feature_id not in seen:
            seen.add(row.feature_id)
            ordered.append(row.feature_id)
    return ordered


def _sync_option_quantities_from_combinations(session: Session, inventory_id: UUID) -> None:
    combos = _get_combination_rows(session, inventory_id)
    if not combos:
        return

    totals: dict[UUID, int] = {}
    for combo in combos:
        try:
            option_ids = [UUID(value) for value in json.loads(combo.option_ids_json or "[]")]
        except Exception:
            option_ids = []
        for option_id in option_ids:
            totals[option_id] = totals.get(option_id, 0) + combo.quantity

    data_rows = session.exec(
        select(InventoryFeatureOptionData).where(InventoryFeatureOptionData.inventory_id == inventory_id)
    ).all()
    for row in data_rows:
        row.quantity = totals.get(row.option_id, 0)
        session.add(row)
    session.commit()


def _remove_invalid_combinations(session: Session, inventory_id: UUID) -> None:
    combos = _get_combination_rows(session, inventory_id)
    if not combos:
        return

    valid_option_rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.is_enabled == True,
        )
    ).all()
    valid_option_ids = {str(row.option_id) for row in valid_option_rows}
    expected_feature_ids = set(str(feature_id) for feature_id in _get_enabled_feature_ids(session, inventory_id))

    changed = False
    for combo in combos:
        try:
            option_ids = [str(value) for value in json.loads(combo.option_ids_json or "[]")]
        except Exception:
            option_ids = []
        option_models = [session.get(FeatureOption, option_id) for option_id in option_ids]
        combo_feature_ids = {str(option.feature_id) for option in option_models if option}
        if any(option_id not in valid_option_ids for option_id in option_ids) or combo_feature_ids != expected_feature_ids:
            session.delete(combo)
            changed = True
    if changed:
        session.commit()


def _validate_combination_option_ids(session: Session, inventory_id: UUID, option_ids: List[UUID]) -> List[UUID]:
    if not option_ids:
        raise HTTPException(status_code=400, detail="Each combination requires at least one option.")

    enabled_feature_ids = _get_enabled_feature_ids(session, inventory_id)
    if not enabled_feature_ids:
        raise HTTPException(status_code=400, detail="Enable feature options before saving combination stock.")

    selected_feature_ids: List[UUID] = []
    validated_option_ids: List[UUID] = []
    seen_features = set()

    for option_id in option_ids:
        option = session.get(FeatureOption, option_id)
        if not option:
            raise HTTPException(status_code=404, detail="Feature option not found.")
        data_row = session.exec(
            select(InventoryFeatureOptionData).where(
                InventoryFeatureOptionData.inventory_id == inventory_id,
                InventoryFeatureOptionData.feature_id == option.feature_id,
                InventoryFeatureOptionData.option_id == option_id,
            )
        ).first()
        if not data_row or not data_row.is_enabled:
            raise HTTPException(status_code=400, detail=f"Option '{option.name}' is not enabled for this item.")
        if option.feature_id in seen_features:
            raise HTTPException(status_code=400, detail="Use only one option per feature in a combination.")
        seen_features.add(option.feature_id)
        selected_feature_ids.append(option.feature_id)
        validated_option_ids.append(option_id)

    if set(selected_feature_ids) != set(enabled_feature_ids):
        raise HTTPException(status_code=400, detail="Each combination must include one enabled option from every active feature.")

    return sorted(validated_option_ids, key=lambda option_id: str(option_id))


def _build_combination_reads(session: Session, inventory_id: UUID) -> List[InventoryFeatureCombinationRead]:
    rows = _get_combination_rows(session, inventory_id)
    result = []
    for row in rows:
        try:
            option_ids = [UUID(value) for value in json.loads(row.option_ids_json or "[]")]
        except Exception:
            option_ids = []
        result.append(InventoryFeatureCombinationRead(
            id=row.id,
            inventory_id=row.inventory_id,
            combination_key=row.combination_key,
            option_ids=option_ids,
            quantity=row.quantity,
        ))
    return result

def _recalculate_inventory_stock(session: Session, inventory_id: UUID) -> None:
    """Recompute total stock from enabled feature option rows and cache on inventory.

    When an item has multiple features (e.g. Size AND Color), each feature dimension
    tracks the same physical pool of stock from a different angle — e.g. Size: S=30,
    M=20 (total=50) and Color: Red=40, Blue=10 (total=50).  Summing across all
    features would inflate the count, so we group by feature and take the *minimum*
    total.  This is safe: if totals are equal the result is correct; if they diverge
    due to data entry errors the smaller number is the conservative choice.
    """
    combination_rows = _get_combination_rows(session, inventory_id)
    if combination_rows:
        total = sum(row.quantity for row in combination_rows)
    else:
        rows = session.exec(
        select(InventoryFeatureOptionData).where(
            InventoryFeatureOptionData.inventory_id == inventory_id,
            InventoryFeatureOptionData.is_enabled == True,
        )
        ).all()

        if not rows:
            total = 0
        else:
            feature_totals: dict = {}
            for r in rows:
                fid = str(r.feature_id)
                feature_totals[fid] = feature_totals.get(fid, 0) + r.quantity
            total = min(feature_totals.values())

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
async def list_features(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """List all global descriptive features with their options."""
    stmt = select(DescriptiveFeature).where(DescriptiveFeature.company_id == current_user.company_id)
    features = session.exec(stmt).all()
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
async def create_feature(body: FeatureNameBody, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Create a new global descriptive feature."""
    stmt = select(DescriptiveFeature).where(
        DescriptiveFeature.name == body.name.strip(),
        DescriptiveFeature.company_id == current_user.company_id,
    )
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Feature '{body.name}' already exists.")
    feat = DescriptiveFeature(name=body.name.strip(), company_id=current_user.company_id)
    session.add(feat)
    session.commit()
    session.refresh(feat)
    return DescriptiveFeatureRead(id=feat.id, name=feat.name, options=[])


@router.patch("/features/{feature_id}", response_model=DescriptiveFeatureRead)
async def rename_feature(
    feature_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Rename a global descriptive feature (propagates instantly via FK join)."""
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat:
        raise HTTPException(status_code=404, detail="Feature not found.")
    if current_user.company_id and feat.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Feature not found.")
    conflict_stmt = select(DescriptiveFeature).where(
        DescriptiveFeature.name == body.name.strip(),
        DescriptiveFeature.id != feature_id,
        DescriptiveFeature.company_id == current_user.company_id,
    )
    conflict = session.exec(conflict_stmt).first()
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
async def delete_feature(feature_id: UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
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
async def get_inventory_summary(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """
    Returns a dict keyed by inventory_id with feature names and price range.
    Used by inventory list and sales page to avoid N+1 per-row fetches.
    Response: { "<inventory_id>": { feature_names: [], price_min: float|null, price_max: float|null } }
    """
    # Filter by company via the InventoryFeature.company_id
    inv_features = session.exec(
        select(InventoryFeature).where(InventoryFeature.company_id == current_user.company_id)
    ).all()

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
    current_user: User = Depends(get_current_user),
):
    """
    Decrement feature option quantities after a sale.
    Floors each quantity at 0 and recalculates total inventory stock per affected item.
    """
    affected_inventory_ids = set()
    for item in items:
        combination_rows = _get_combination_rows(session, item.inventory_id)
        if combination_rows and item.option_ids:
            combination_key = _build_combination_key(item.option_ids)
            combo = session.exec(
                select(InventoryFeatureCombination).where(
                    InventoryFeatureCombination.inventory_id == item.inventory_id,
                    InventoryFeatureCombination.combination_key == combination_key,
                )
            ).first()
            if combo:
                combo.quantity = max(0, combo.quantity - item.quantity)
                session.add(combo)
                affected_inventory_ids.add(item.inventory_id)
            continue

        if item.feature_id is None or item.option_id is None:
            continue

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
        _sync_option_quantities_from_combinations(session, inv_id)
        _recalculate_inventory_stock(session, inv_id)
    return {"deducted": len(affected_inventory_ids)}


# ─── FEATURE OPTION ROUTES ──────────────────────────────────────────────────────

@router.post("/features/{feature_id}/options", response_model=FeatureOptionRead)
async def add_option(
    feature_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a new option to a global feature. Auto-seeds qty=0 rows for all items using this feature."""
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat or (current_user.company_id and feat.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Feature not found.")
    conflict = session.exec(
        select(FeatureOption).where(
            FeatureOption.feature_id == feature_id,
            FeatureOption.name == body.name.strip(),
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f"Option '{body.name}' already exists on this feature.")

    opt = FeatureOption(feature_id=feature_id, name=body.name.strip(), company_id=current_user.company_id)
    session.add(opt)
    session.commit()
    session.refresh(opt)

    # Auto-seed data rows for all inventory items (same company) that already have this feature
    usages = session.exec(
        select(InventoryFeature).where(
            InventoryFeature.feature_id == feature_id,
            InventoryFeature.company_id == current_user.company_id,
        )
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
                company_id=current_user.company_id,
            ))
    session.commit()

    return FeatureOptionRead(id=opt.id, feature_id=opt.feature_id, name=opt.name)


@router.patch("/features/{feature_id}/options/{option_id}", response_model=FeatureOptionRead)
async def rename_option(
    feature_id: UUID,
    option_id: UUID,
    body: FeatureNameBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    affected_inventory_ids = {row.inventory_id for row in all_data_rows}
    for row in all_data_rows:
        session.delete(row)
    session.delete(opt)
    session.commit()
    for inventory_id in affected_inventory_ids:
        _remove_invalid_combinations(session, inventory_id)
        _sync_option_quantities_from_combinations(session, inventory_id)
        _recalculate_inventory_stock(session, inventory_id)
    return {"deleted": True}


# ─── PER-INVENTORY FEATURE ROUTES ───────────────────────────────────────────────

@router.get("/inventory/{inventory_id}/features", response_model=List[InventoryFeatureRead])
async def get_inventory_features(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """Add a global feature to an inventory item and seed option data rows."""
    inv = session.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    feat = session.get(DescriptiveFeature, feature_id)
    if not feat or (current_user.company_id and feat.company_id != current_user.company_id):
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
        company_id=current_user.company_id,
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
                company_id=current_user.company_id,
            ))
    session.commit()
    for combo in _get_combination_rows(session, inventory_id):
        session.delete(combo)
    session.commit()
    _recalculate_inventory_stock(session, inventory_id)
    return {"added": True}


@router.delete("/inventory/{inventory_id}/features/{feature_id}")
async def remove_feature_from_inventory(
    inventory_id: UUID,
    feature_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    for combo in _get_combination_rows(session, inventory_id):
        session.delete(combo)
    session.delete(inv_feat)
    session.commit()
    _recalculate_inventory_stock(session, inventory_id)
    return {"removed": True}


@router.get("/inventory/{inventory_id}/feature-combinations", response_model=List[InventoryFeatureCombinationRead])
async def get_inventory_feature_combinations(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    inv = session.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    return _build_combination_reads(session, inventory_id)


@router.put("/inventory/{inventory_id}/feature-combinations")
async def save_inventory_feature_combinations(
    inventory_id: UUID,
    rows: List[InventoryFeatureCombinationWrite],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    inv = session.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found.")

    seen_keys = set()
    normalized_rows = []
    for row in rows:
        normalized_option_ids = _validate_combination_option_ids(session, inventory_id, row.option_ids)
        combination_key = _build_combination_key(normalized_option_ids)
        if combination_key in seen_keys:
            raise HTTPException(status_code=409, detail="Duplicate feature combination in request.")
        seen_keys.add(combination_key)
        normalized_rows.append((normalized_option_ids, combination_key, max(0, row.quantity)))

    existing_rows = _get_combination_rows(session, inventory_id)
    for existing in existing_rows:
        session.delete(existing)
    session.commit()

    for option_ids, combination_key, quantity in normalized_rows:
        session.add(InventoryFeatureCombination(
            inventory_id=inventory_id,
            combination_key=combination_key,
            option_ids_json=json.dumps([str(option_id) for option_id in option_ids]),
            quantity=quantity,
            company_id=current_user.company_id,
        ))
    session.commit()

    _sync_option_quantities_from_combinations(session, inventory_id)
    _recalculate_inventory_stock(session, inventory_id)
    return {"saved": True}


@router.patch("/inventory/{inventory_id}/features/affects-price")
async def set_affects_price(
    inventory_id: UUID,
    body: AffectsPriceBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
                company_id=current_user.company_id,
                price=row.price,
            ))
    session.commit()
    _remove_invalid_combinations(session, inventory_id)
    _sync_option_quantities_from_combinations(session, inventory_id)
    _recalculate_inventory_stock(session, inventory_id)
    return {"saved": True}
