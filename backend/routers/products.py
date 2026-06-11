# ============================================================
# FILE: products.py
#
# PURPOSE:
#   Product-focused endpoints, including bulk import for inventory products.
# ============================================================

from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..database import get_session
from ..models import (
    Inventory, User, UserRole,
    AssetUnit, ASSET_UNIT_STATES,
    DescriptiveFeature, FeatureOption, InventoryFeature, InventoryFeatureOptionData,
)
from .auth import get_current_user, get_user_permissions_list

router = APIRouter()


class BulkFeatureOptionIn(SQLModel):
    name: str


class BulkFeatureIn(SQLModel):
    name: str
    options: List[str] = []


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
    # New: asset unit count — only used when type == "asset"
    asset_unit_count: Optional[int] = None
    # New: feature definitions — list of {name, options: [str]}
    features: Optional[List[BulkFeatureIn]] = None


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
        session.flush()  # get item.id before creating child records

        # ── Asset units ──────────────────────────────────────────────────────
        if item_type == "asset":
            unit_count = int(product.asset_unit_count or 1)
            unit_count = max(1, min(unit_count, 500))  # clamp to [1, 500]
            for u in range(unit_count):
                session.add(AssetUnit(
                    inventory_id=item.id,
                    label=f"Unit {u + 1}",
                    state="available",
                    company_id=current_user.company_id,
                ))
            # Sync quantity to actual unit count
            item.quantity = unit_count
            session.add(item)

        # ── Descriptive features ─────────────────────────────────────────────
        raw_features: List[BulkFeatureIn] = product.features or []
        for feat_in in raw_features:
            feat_name = (feat_in.name or "").strip()
            if not feat_name:
                continue

            # Get-or-create the DescriptiveFeature (company-scoped)
            feature = session.exec(
                select(DescriptiveFeature).where(
                    DescriptiveFeature.company_id == current_user.company_id,
                    DescriptiveFeature.name == feat_name,
                )
            ).first()
            if feature is None:
                feature = DescriptiveFeature(
                    name=feat_name,
                    company_id=current_user.company_id,
                )
                session.add(feature)
                session.flush()

            # Link the feature to this inventory item (skip if already linked)
            existing_link = session.exec(
                select(InventoryFeature).where(
                    InventoryFeature.inventory_id == item.id,
                    InventoryFeature.feature_id == feature.id,
                )
            ).first()
            if existing_link is None:
                session.add(InventoryFeature(
                    inventory_id=item.id,
                    feature_id=feature.id,
                    affects_price=False,
                    company_id=current_user.company_id,
                ))

            # Get-or-create each option and add per-item data rows
            for opt_name in (feat_in.options or []):
                opt_name = opt_name.strip()
                if not opt_name:
                    continue

                option = session.exec(
                    select(FeatureOption).where(
                        FeatureOption.feature_id == feature.id,
                        FeatureOption.name == opt_name,
                    )
                ).first()
                if option is None:
                    option = FeatureOption(
                        feature_id=feature.id,
                        name=opt_name,
                        company_id=current_user.company_id,
                    )
                    session.add(option)
                    session.flush()

                # Create per-item option data (enabled by default)
                existing_data = session.exec(
                    select(InventoryFeatureOptionData).where(
                        InventoryFeatureOptionData.inventory_id == item.id,
                        InventoryFeatureOptionData.feature_id == feature.id,
                        InventoryFeatureOptionData.option_id == option.id,
                    )
                ).first()
                if existing_data is None:
                    session.add(InventoryFeatureOptionData(
                        inventory_id=item.id,
                        feature_id=feature.id,
                        option_id=option.id,
                        is_enabled=True,
                        quantity=0,
                        company_id=current_user.company_id,
                    ))

        imported_count += 1

    if imported_count > 0:
        session.commit()

    return BulkImportResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors,
    )
