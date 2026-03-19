# ============================================================
# FILE: products.py
#
# PURPOSE:
#   Product-focused endpoints, including bulk import for inventory products.
# ============================================================

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..database import get_session
from ..models import Inventory, User, UserRole
from .auth import get_current_user, get_user_permissions_list

router = APIRouter()


class BulkProductIn(SQLModel):
    name: str
    sku: Optional[str] = None
    price: float = 0
    quantity: int = 0
    min_stock_level: int = 10
    type: str = "product"
    category: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    cost: Optional[float] = None


class BulkImportRequest(SQLModel):
    products: List[BulkProductIn]


class BulkImportResponse(SQLModel):
    imported_count: int
    skipped_count: int
    errors: List[str]


def _ensure_inventory_write_permission(current_user: User, session: Session) -> None:
    if current_user.role == UserRole.ADMIN:
        return

    permissions = set(get_user_permissions_list(current_user, session))
    if "inventory:write" not in permissions and "inventory:admin" not in permissions:
        raise HTTPException(status_code=403, detail="Missing permission: inventory:write")


@router.post("/products/bulk-import", response_model=BulkImportResponse)
def bulk_import_products(
    payload: BulkImportRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _ensure_inventory_write_permission(current_user, session)

    products = payload.products or []
    if not products:
        raise HTTPException(status_code=400, detail="No products supplied for bulk import.")

    if len(products) > 2500:
        raise HTTPException(status_code=413, detail="Too many rows. Maximum is 2500 per import.")

    normalized_existing_skus = set(
        sku.strip().lower()
        for sku in session.exec(
            select(Inventory.sku).where(
                Inventory.company_id == current_user.company_id,
                Inventory.sku.is_not(None),
            )
        ).all()
        if sku and str(sku).strip()
    )

    seen_skus = set()
    errors: List[str] = []
    imported_count = 0
    skipped_count = 0

    for idx, product in enumerate(products, start=1):
        name = (product.name or "").strip()
        if not name:
            errors.append(f"Row {idx}: Name is required.")
            skipped_count += 1
            continue

        if product.price is not None and product.price < 0:
            errors.append(f"Row {idx}: Price cannot be negative.")
            skipped_count += 1
            continue

        if product.quantity is not None and product.quantity < 0:
            errors.append(f"Row {idx}: Quantity cannot be negative.")
            skipped_count += 1
            continue

        if product.min_stock_level is not None and product.min_stock_level < 0:
            errors.append(f"Row {idx}: Min stock level cannot be negative.")
            skipped_count += 1
            continue

        sku_value = (product.sku or "").strip()
        normalized_sku = sku_value.lower()
        if normalized_sku:
            if normalized_sku in seen_skus:
                errors.append(f"Row {idx}: Duplicate SKU in request ({sku_value}).")
                skipped_count += 1
                continue
            if normalized_sku in normalized_existing_skus:
                errors.append(f"Row {idx}: SKU already exists ({sku_value}).")
                skipped_count += 1
                continue
            seen_skus.add(normalized_sku)

        item_type = (product.type or "product").strip().lower()
        if item_type not in {"product", "resource", "asset", "location", "item", "bundle", "mix"}:
            item_type = "product"

        item = Inventory(
            name=name,
            sku=sku_value or None,
            price=float(product.price or 0),
            quantity=int(product.quantity or 0),
            min_stock_level=int(product.min_stock_level or 10),
            type=item_type,
            category=(product.category or "").strip() or None,
            description=(product.description or "").strip() or None,
            location=(product.location or "").strip() or None,
            cost=product.cost,
            company_id=current_user.company_id,
        )

        session.add(item)
        imported_count += 1

    if imported_count > 0:
        session.commit()

    return BulkImportResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors,
    )
