"""
Router: /api/v1/inventory-categories
CRUD for per-type, per-company inventory category lookup entries.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID

try:
    from backend.database import get_session
    from backend.models import InventoryCategory, InventoryCategoryRead
    from backend.routers.auth import get_current_user
except ImportError:
    from database import get_session
    from models import InventoryCategory, InventoryCategoryRead
    from routers.auth import get_current_user

router = APIRouter()


@router.get("/inventory-categories", response_model=List[InventoryCategoryRead])
def list_inventory_categories(
    item_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
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
    company_id = getattr(current_user, "company_id", None)
    name = (payload.get("name") or "").strip()
    item_type = (payload.get("item_type") or "").strip().lower()
    if not name or not item_type:
        raise HTTPException(status_code=422, detail="name and item_type are required")

    # Deduplicate
    existing = session.exec(
        select(InventoryCategory).where(
            InventoryCategory.company_id == company_id,
            InventoryCategory.item_type == item_type,
            InventoryCategory.name == name,
        )
    ).first()
    if existing:
        return existing

    cat = InventoryCategory(item_type=item_type, name=name, company_id=company_id)
    session.add(cat)
    try:
        session.commit()
        session.refresh(cat)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create category")
    return cat


@router.delete("/inventory-categories/{category_id}", status_code=204)
def delete_inventory_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", None)
    cat = session.get(InventoryCategory, category_id)
    if not cat or cat.company_id != company_id:
        raise HTTPException(status_code=404, detail="Category not found")
    session.delete(cat)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete category")
