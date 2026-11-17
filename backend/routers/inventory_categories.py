"""
Router for company-scoped inventory categories and purchase-unit choices.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
import math

try:
    from backend.database import get_session
    from backend.models import (
        INVENTORY_PURCHASE_UNIT_BUILT_INS,
        InventoryCategory,
        InventoryCategoryRead,
        InventoryPurchaseUnit,
        InventoryPurchaseUnitRead,
    )
    from backend.routers.auth import get_current_user, has_page_permission, require_page_permission
    from backend.utils.db_helpers import safe_commit, safe_commit_refresh
except ImportError:
    from database import get_session
    from models import (
        INVENTORY_PURCHASE_UNIT_BUILT_INS,
        InventoryCategory,
        InventoryCategoryRead,
        InventoryPurchaseUnit,
        InventoryPurchaseUnitRead,
    )
    from routers.auth import get_current_user, has_page_permission, require_page_permission
    from utils.db_helpers import safe_commit, safe_commit_refresh

router = APIRouter()


def _require_category_permission(current_user, session, action: str, include_suppliers: bool = False) -> None:
    pages = ("inventory", "suppliers") if include_suppliers else ("inventory",)
    if any(has_page_permission(current_user, session, page, action) for page in pages):
        return
    required = " or ".join(f"{page}:{action}" for page in pages)
    raise HTTPException(status_code=403, detail=f"Missing permission: {required}")


@router.get("/inventory-categories", response_model=List[InventoryCategoryRead])
def list_inventory_categories(
    item_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    _require_category_permission(current_user, session, "read", include_suppliers=True)
    company_id = getattr(current_user, "company_id", None)
    stmt = select(InventoryCategory).where(InventoryCategory.company_id == company_id)
    if item_type:
        stmt = stmt.where(InventoryCategory.item_type == item_type.lower())
    stmt = stmt.order_by(InventoryCategory.name)
    return session.exec(stmt).all()


@router.post("/inventory-categories", response_model=InventoryCategoryRead, status_code=201)
def create_inventory_category(
    payload: dict,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    require_page_permission(current_user, session, "inventory", "write")
    company_id = getattr(current_user, "company_id", None)
    name = (payload.get("name") or "").strip()
    item_type = (payload.get("item_type") or "").strip().lower()
    if not name or not item_type:
        raise HTTPException(status_code=422, detail="name and item_type are required")

    # Deduplicate
    normalized_name = name.casefold()
    existing = session.exec(
        select(InventoryCategory).where(
            InventoryCategory.company_id == company_id,
            InventoryCategory.item_type == item_type,
            func.lower(InventoryCategory.name) == normalized_name,
        )
    ).first()
    if existing:
        return existing

    cat = InventoryCategory(item_type=item_type, name=name, company_id=company_id)
    session.add(cat)
    return safe_commit_refresh(session, cat, "create category")


@router.get("/inventory-purchase-units", response_model=List[InventoryPurchaseUnitRead])
def list_inventory_purchase_units(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    if not any(
        has_page_permission(current_user, session, page, action)
        for page in ("inventory", "suppliers")
        for action in ("read", "write")
    ):
        raise HTTPException(status_code=403, detail="Missing permission: inventory:read or suppliers:read")
    company_id = getattr(current_user, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=403, detail="User must belong to a company to access purchase units")
    return session.exec(
        select(InventoryPurchaseUnit)
        .where(InventoryPurchaseUnit.company_id == company_id)
        .order_by(InventoryPurchaseUnit.name)
    ).all()


@router.post(
    "/inventory-purchase-units",
    response_model=InventoryPurchaseUnitRead,
    status_code=201,
)
def create_inventory_purchase_unit(
    payload: dict,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    require_page_permission(current_user, session, "inventory", "write")
    company_id = getattr(current_user, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=403, detail="User must belong to a company to create purchase units")
    name = str(payload.get("name") or "").strip()
    if not name or len(name) > 80:
        raise HTTPException(status_code=422, detail="name is required and must be 80 characters or fewer")
    if name.casefold() in INVENTORY_PURCHASE_UNIT_BUILT_INS:
        raise HTTPException(status_code=422, detail="This purchase unit is already built in")

    existing = session.exec(
        select(InventoryPurchaseUnit).where(
            InventoryPurchaseUnit.company_id == company_id,
            func.lower(InventoryPurchaseUnit.name) == name.casefold(),
        )
    ).first()
    if existing:
        return existing

    unit = InventoryPurchaseUnit(name=name, company_id=company_id)
    session.add(unit)
    return safe_commit_refresh(session, unit, "create inventory purchase unit")


@router.delete("/inventory-categories/{category_id}", status_code=204)
def delete_inventory_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    require_page_permission(current_user, session, "inventory", "delete")
    company_id = getattr(current_user, "company_id", None)
    cat = session.get(InventoryCategory, category_id)
    if not cat or cat.company_id != company_id:
        raise HTTPException(status_code=404, detail="Category not found")
    session.delete(cat)
    safe_commit(session, "delete category")


@router.put("/inventory-categories/{category_id}", response_model=InventoryCategoryRead)
def update_inventory_category(
    category_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    _require_category_permission(current_user, session, "write", include_suppliers=True)
    company_id = getattr(current_user, "company_id", None)
    cat = session.get(InventoryCategory, category_id)
    if not cat or cat.company_id != company_id:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        import_tax_rate = float(payload.get("import_tax_rate"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="import_tax_rate must be a non-negative number")
    if not math.isfinite(import_tax_rate) or import_tax_rate < 0:
        raise HTTPException(status_code=422, detail="import_tax_rate must be a non-negative number")
    cat.import_tax_rate = import_tax_rate
    session.add(cat)
    return safe_commit_refresh(session, cat, "update category import-tax rate")
