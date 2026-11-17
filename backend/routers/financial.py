"""
Router: /api/v1/financial
Financial modules: AR, AP, GL, procurement.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import math

try:
    from backend.database import get_session
    from backend.models import (
        AccountsReceivable, AccountsPayable, GeneralLedgerEntry, GeneralLedgerAccount,
        ProcurementOrder, ProcurementOrderLine, InventoryCost, InventoryCostLayer, SupplierProduct,
        User, UserRole, Supplier, Inventory, InventoryCategory
    )
    from backend.routers.auth import get_current_user
    from backend.routers.auth import get_user_permissions_list
except ImportError:
    from database import get_session
    from models import (
        AccountsReceivable, AccountsPayable, GeneralLedgerEntry, GeneralLedgerAccount,
        ProcurementOrder, ProcurementOrderLine, InventoryCost, InventoryCostLayer, SupplierProduct,
        User, UserRole, Supplier, Inventory, InventoryCategory
    )
    from routers.auth import get_current_user
    from routers.auth import get_user_permissions_list

router = APIRouter()


def _require_procurement_permission(
    current_user: User,
    session: Session,
    pages: tuple[str, ...],
    action: str,
) -> None:
    if current_user.role == UserRole.ADMIN:
        return

    permissions = set(get_user_permissions_list(current_user, session))
    for page in pages:
        if f"{page}:{action}" in permissions or f"{page}:admin" in permissions:
            return
        if action == "write" and f"{page}:write_all" in permissions:
            return
        if action == "read" and any(
            f"{page}:{permission}" in permissions
            for permission in ("write", "write_self_only", "write_all", "delete")
        ):
            return
    required = " or ".join(f"{page}:{action}" for page in pages)
    raise HTTPException(status_code=403, detail=f"Missing permission: {required}")


# ─── ACCOUNTS RECEIVABLE ───────────────────────────────────────────────────────

@router.get("/accounts-receivable")
def get_ar_summary(
    status: Optional[str] = None,
    days_overdue: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get AR aging summary"""
    
    stmt = select(AccountsReceivable).where(
        AccountsReceivable.company_id == current_user.company_id
    )
    
    if status:
        stmt = stmt.where(AccountsReceivable.status == status)
    
    records = session.exec(stmt).all()
    
    # Calculate aging
    now = datetime.utcnow()
    aged_buckets = {
        'current': [],
        '30_days': [],
        '60_days': [],
        '90_plus': []
    }
    
    total_outstanding = 0.0
    for record in records:
        if record.status in ['outstanding', 'overdue']:
            days_past_due = (now - record.due_date).days
            
            if days_past_due < 0:
                aged_buckets['current'].append(record)
            elif days_past_due < 30:
                aged_buckets['30_days'].append(record)
            elif days_past_due < 60:
                aged_buckets['60_days'].append(record)
            else:
                aged_buckets['90_plus'].append(record)
            
            total_outstanding += record.amount_remaining
    
    return {
        'total_outstanding': total_outstanding,
        'by_age': {
            'current': len(aged_buckets['current']),
            '30_days': len(aged_buckets['30_days']),
            '60_days': len(aged_buckets['60_days']),
            '90_plus': len(aged_buckets['90_plus'])
        },
        'details': aged_buckets
    }


@router.post("/accounts-receivable")
def create_ar_record(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create AR record (typically from invoice)"""
    
    record = AccountsReceivable(
        invoice_number=payload['invoice_number'],
        client_id=payload['client_id'],
        invoice_date=datetime.utcnow(),
        due_date=payload.get('due_date'),
        amount=payload['amount'],
        amount_remaining=payload['amount'],
        company_id=current_user.company_id
    )
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return record


# ─── ACCOUNTS PAYABLE ──────────────────────────────────────────────────────────

@router.get("/accounts-payable")
def get_ap_summary(
    status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get AP aging summary"""
    
    stmt = select(AccountsPayable).where(
        AccountsPayable.company_id == current_user.company_id
    )
    
    if status:
        stmt = stmt.where(AccountsPayable.status == status)
    
    records = session.exec(stmt).all()
    
    # Calculate aging
    now = datetime.utcnow()
    aged_buckets = {
        'current': [],
        '30_days': [],
        '60_days': [],
        '90_plus': []
    }
    
    total_payable = 0.0
    for record in records:
        if record.status in ['outstanding', 'overdue']:
            days_past_due = (now - record.due_date).days
            
            if days_past_due < 0:
                aged_buckets['current'].append(record)
            elif days_past_due < 30:
                aged_buckets['30_days'].append(record)
            elif days_past_due < 60:
                aged_buckets['60_days'].append(record)
            else:
                aged_buckets['90_plus'].append(record)
            
            total_payable += record.amount_remaining
    
    return {
        'total_payable': total_payable,
        'by_age': {
            'current': len(aged_buckets['current']),
            '30_days': len(aged_buckets['30_days']),
            '60_days': len(aged_buckets['60_days']),
            '90_plus': len(aged_buckets['90_plus'])
        }
    }


@router.post("/accounts-payable")
def create_ap_record(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create AP record (typically from vendor invoice)"""
    
    record = AccountsPayable(
        invoice_number=payload['invoice_number'],
        supplier_id=payload['supplier_id'],
        invoice_date=datetime.utcnow(),
        due_date=payload.get('due_date'),
        amount=payload['amount'],
        amount_remaining=payload['amount'],
        company_id=current_user.company_id
    )
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return record


# ─── GENERAL LEDGER ────────────────────────────────────────────────────────────

@router.get("/gl-accounts")
def list_gl_accounts(
    account_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List chart of accounts"""
    
    stmt = select(GeneralLedgerAccount).where(
        GeneralLedgerAccount.company_id == current_user.company_id,
        GeneralLedgerAccount.is_active == True
    )
    
    if account_type:
        stmt = stmt.where(GeneralLedgerAccount.account_type == account_type)
    
    stmt = stmt.order_by(GeneralLedgerAccount.account_code)
    
    return session.exec(stmt).all()


@router.get("/gl-trial-balance")
def get_trial_balance(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get trial balance"""
    
    accounts = session.exec(
        select(GeneralLedgerAccount).where(
            GeneralLedgerAccount.company_id == current_user.company_id
        )
    ).all()
    
    trial_balance = {}
    for account in accounts:
        stmt = select(func.sum(GeneralLedgerEntry.debit), func.sum(GeneralLedgerEntry.credit)).where(
            GeneralLedgerEntry.account_id == account.id
        )
        debits, credits = session.exec(stmt).first()
        debits = debits or 0
        credits = credits or 0
        
        if debits != 0 or credits != 0:
            trial_balance[account.account_code] = {
                'account': account.account_name,
                'debit': debits,
                'credit': credits,
                'balance': debits - credits
            }
    
    return trial_balance


# ─── PROCUREMENT ──────────────────────────────────────────────────────────────

def _serialize_po(po: ProcurementOrder, lines: Optional[list] = None) -> dict:
    data = {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_id": po.supplier_id,
        "order_date": po.order_date,
        "expected_delivery_date": po.expected_delivery_date,
        "actual_delivery_date": po.actual_delivery_date,
        "total_amount": float(po.total_amount or 0),
        "import_tax": float(getattr(po, "import_tax", None) or 0),
        "shipping_cost": float(getattr(po, "shipping_cost", None) or 0),
        "shipping_rate_type": getattr(po, "shipping_rate_type", "fixed") or "fixed",
        "shipping_rate": float(getattr(po, "shipping_rate", None) or 0),
        "status": po.status,
        "notes": po.notes,
        "created_at": getattr(po, "created_at", None),
    }
    if lines is not None:
        data["line_items"] = lines
    return data


def _serialize_po_line(line: ProcurementOrderLine) -> dict:
    return {
        "id": line.id,
        "inventory_id": line.inventory_id,
        "supplier_product_id": line.supplier_product_id,
        "quantity_ordered": line.quantity_ordered,
        "quantity_received": line.quantity_received,
        "unit_price": float(line.unit_price or 0),
        "line_total": float(line.line_total or 0),
        "purchase_unit": line.purchase_unit,
        "units_per_purchase_unit": line.units_per_purchase_unit,
        "notes": line.notes,
    }


def _positive_integer(value, field_name: str) -> int:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive whole number")
    if not math.isfinite(numeric) or numeric < 1 or not numeric.is_integer():
        raise HTTPException(status_code=400, detail=f"{field_name} must be a positive whole number")
    return int(numeric)


def _nonnegative_price(value, field_name: str = "unit_price") -> float:
    try:
        price = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a non-negative number")
    if not math.isfinite(price) or price < 0:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a non-negative number")
    return price


def _supplier_product_for_item(
    session: Session,
    supplier_id: UUID,
    inventory_id: UUID,
    company_id: str,
) -> SupplierProduct:
    product = session.exec(
        select(SupplierProduct).where(
            SupplierProduct.supplier_id == supplier_id,
            SupplierProduct.inventory_id == inventory_id,
            SupplierProduct.company_id == company_id,
        )
    ).first()
    if not product:
        inventory = session.get(Inventory, inventory_id)
        if inventory and inventory.company_id == company_id:
            product = SupplierProduct(
                supplier_id=supplier_id,
                inventory_id=inventory_id,
                purchase_unit=inventory.stock_unit or "unit",
                units_per_purchase_unit=1,
                unit_price=float(inventory.cost or 0),
                is_preferred=bool(inventory.supplier_id == supplier_id),
                company_id=company_id,
            )
            session.add(product)
            session.flush()
            return product
        raise HTTPException(
            status_code=400,
            detail="Add this item to the supplier catalog before ordering it",
        )
    return product


@router.get("/supplier-products")
def list_supplier_products(
    supplier_id: Optional[UUID] = None,
    inventory_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_procurement_permission(current_user, session, ("suppliers", "inventory"), "read")
    statement = select(SupplierProduct).where(
        SupplierProduct.company_id == current_user.company_id
    )
    if supplier_id:
        statement = statement.where(SupplierProduct.supplier_id == supplier_id)
    if inventory_id:
        statement = statement.where(SupplierProduct.inventory_id == inventory_id)

    products = session.exec(statement.order_by(SupplierProduct.created_at)).all()
    rows = []
    for product in products:
        inventory = session.get(Inventory, product.inventory_id)
        supplier = session.get(Supplier, product.supplier_id)
        if inventory and supplier:
            rows.append({
                "id": product.id,
                "supplier_id": product.supplier_id,
                "supplier_name": supplier.name,
                "inventory_id": product.inventory_id,
                "inventory_name": inventory.name,
                "purchase_unit": product.purchase_unit,
                "units_per_purchase_unit": product.units_per_purchase_unit,
                "unit_price": float(product.unit_price or 0),
                "is_preferred": product.is_preferred,
            })
    return rows


@router.post("/supplier-products")
def save_supplier_product(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_procurement_permission(current_user, session, ("suppliers", "inventory"), "write")
    try:
        supplier_id = UUID(str(payload.get("supplier_id")))
        inventory_id = UUID(str(payload.get("inventory_id")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid supplier and inventory item are required")

    supplier = session.get(Supplier, supplier_id)
    inventory = session.get(Inventory, inventory_id)
    if not supplier or supplier.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if not inventory or inventory.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    purchase_unit = str(payload.get("purchase_unit") or "").strip()
    if not purchase_unit:
        raise HTTPException(status_code=400, detail="Purchase unit is required")
    if len(purchase_unit) > 80:
        raise HTTPException(status_code=400, detail="Purchase unit must be 80 characters or fewer")

    units_per_purchase_unit = _positive_integer(
        payload.get("units_per_purchase_unit", 1),
        "units_per_purchase_unit",
    )
    unit_price = _nonnegative_price(payload.get("unit_price", 0))
    is_preferred = bool(payload.get("is_preferred", False))

    product = session.exec(
        select(SupplierProduct).where(
            SupplierProduct.supplier_id == supplier_id,
            SupplierProduct.inventory_id == inventory_id,
            SupplierProduct.company_id == current_user.company_id,
        )
    ).first()
    if product is None:
        product = SupplierProduct(
            supplier_id=supplier_id,
            inventory_id=inventory_id,
            company_id=current_user.company_id,
        )

    product.purchase_unit = purchase_unit
    product.units_per_purchase_unit = units_per_purchase_unit
    product.unit_price = unit_price
    product.is_preferred = is_preferred

    if is_preferred:
        other_products = session.exec(
            select(SupplierProduct).where(
                SupplierProduct.inventory_id == inventory_id,
                SupplierProduct.company_id == current_user.company_id,
                SupplierProduct.id != product.id,
            )
        ).all()
        for other in other_products:
            other.is_preferred = False
            session.add(other)
        inventory.supplier_id = supplier_id
        session.add(inventory)
    elif inventory.supplier_id == supplier_id:
        inventory.supplier_id = None
        session.add(inventory)

    session.add(product)
    try:
        session.commit()
        session.refresh(product)
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save supplier product: {exc}")

    return {
        "id": product.id,
        "supplier_id": product.supplier_id,
        "inventory_id": product.inventory_id,
        "purchase_unit": product.purchase_unit,
        "units_per_purchase_unit": product.units_per_purchase_unit,
        "unit_price": float(product.unit_price or 0),
        "is_preferred": product.is_preferred,
    }


@router.post("/purchase-orders")
def create_purchase_order(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a purchase order"""
    _require_procurement_permission(current_user, session, ("suppliers", "inventory"), "write")
    items = payload.get("items") or []
    if not isinstance(items, list) or not items or any(not isinstance(item, dict) for item in items):
        raise HTTPException(status_code=400, detail="At least one purchase-order item is required")
    expected = payload.get("expected_delivery_date")
    expected_dt = None
    if expected:
        try:
            expected_dt = datetime.fromisoformat(str(expected).replace("Z", "+00:00"))
        except ValueError:
            try:
                expected_dt = datetime.strptime(str(expected)[:10], "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid expected delivery date")

    try:
        supplier_id = UUID(str(payload.get("supplier_id")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid supplier is required")

    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=400, detail="Supplier not found")
    if supplier.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Supplier does not belong to your company")

    shipping_rate_type = str(getattr(supplier, "shipping_rate_type", "fixed") or "fixed").lower()
    if shipping_rate_type not in {"fixed", "percentage"}:
        raise HTTPException(status_code=400, detail="Supplier shipping rate type must be fixed or percentage")
    shipping_rate = _nonnegative_price(getattr(supplier, "shipping_rate", 0) or 0, "supplier shipping rate")
    category_tax_rates = {
        (str(category.item_type or "").strip().lower(), str(category.name or "").strip().casefold()):
        _nonnegative_price(category.import_tax_rate or 0, "category import-tax rate")
        for category in session.exec(
            select(InventoryCategory).where(InventoryCategory.company_id == current_user.company_id)
        ).all()
    }

    line_models = []
    subtotal = 0.0
    import_tax = 0.0
    try:
        po = ProcurementOrder(
            po_number=payload.get("po_number", f"PO-{int(datetime.utcnow().timestamp())}"),
            supplier_id=supplier_id,
            order_date=datetime.utcnow(),
            expected_delivery_date=expected_dt,
            total_amount=0,
            import_tax=0,
            shipping_cost=0,
            shipping_rate_type=shipping_rate_type,
            shipping_rate=shipping_rate,
            status="draft",
            created_by=current_user.id,
            notes=payload.get("notes"),
            company_id=current_user.company_id,
        )
        session.add(po)
        session.flush()

        for item in items:
            try:
                inventory_id = UUID(str(item.get("inventory_id")))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="A purchase-order item has an invalid inventory item")
            inventory = session.get(Inventory, inventory_id)
            if not inventory:
                raise HTTPException(status_code=400, detail="Inventory item not found")
            if inventory.company_id != current_user.company_id:
                raise HTTPException(status_code=403, detail="Inventory item does not belong to your company")

            supplier_product = _supplier_product_for_item(
                session,
                supplier_id,
                inventory_id,
                current_user.company_id,
            )
            qty = _positive_integer(item.get("quantity"), "quantity")
            unit_price = _nonnegative_price(item.get("unit_price", supplier_product.unit_price))
            line = ProcurementOrderLine(
                po_id=po.id,
                inventory_id=inventory_id,
                supplier_product_id=supplier_product.id,
                quantity_ordered=qty,
                unit_price=unit_price,
                line_total=qty * unit_price,
                purchase_unit=supplier_product.purchase_unit,
                units_per_purchase_unit=supplier_product.units_per_purchase_unit,
            )
            session.add(line)
            line_models.append(line)
            subtotal += line.line_total
            category_key = (
                str(inventory.type or "").strip().lower(),
                str(inventory.category or "").strip().casefold(),
            )
            import_tax += line.line_total * category_tax_rates.get(category_key, 0) / 100
        shipping_cost = shipping_rate if shipping_rate_type == "fixed" else subtotal * shipping_rate / 100
        po.import_tax = round(import_tax, 2)
        po.shipping_cost = round(shipping_cost, 2)
        po.total_amount = round(subtotal + po.import_tax + po.shipping_cost, 2)

        session.add(po)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create purchase order: {exc}")

    session.refresh(po)
    line_rows = [
        _serialize_po_line(line)
        for line in line_models
    ]
    return _serialize_po(po, line_rows)


@router.get("/purchase-orders")
def list_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List purchase orders"""

    stmt = select(ProcurementOrder).where(
        ProcurementOrder.company_id == current_user.company_id
    )

    if status:
        stmt = stmt.where(ProcurementOrder.status == status)

    if supplier_id:
        stmt = stmt.where(ProcurementOrder.supplier_id == supplier_id)

    stmt = stmt.order_by(ProcurementOrder.order_date.desc())

    orders = session.exec(stmt).all()
    return [_serialize_po(po) for po in orders]


@router.get("/purchase-orders/{po_id}")
def get_purchase_order(
    po_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a purchase order with line items"""
    po = session.get(ProcurementOrder, po_id)
    if not po or po.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    lines = session.exec(
        select(ProcurementOrderLine).where(ProcurementOrderLine.po_id == po_id)
    ).all()
    line_rows = [_serialize_po_line(ln) for ln in lines]
    return _serialize_po(po, line_rows)


@router.post("/purchase-orders/{po_id}/items")
def add_purchase_order_items(
    po_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_procurement_permission(current_user, session, ("suppliers", "inventory"), "write")
    items = payload.get("items")
    if not isinstance(items, list) or not items or any(not isinstance(item, dict) for item in items):
        raise HTTPException(status_code=400, detail="At least one purchase-order item is required")

    po = session.exec(
        select(ProcurementOrder)
        .where(
            ProcurementOrder.id == po_id,
            ProcurementOrder.company_id == current_user.company_id,
        )
        .with_for_update()
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in {"draft", "sent", "confirmed", "partially_received"}:
        raise HTTPException(status_code=409, detail="Items cannot be added to a completed purchase order")

    try:
        categories = session.exec(
            select(InventoryCategory).where(InventoryCategory.company_id == current_user.company_id)
        ).all()
        category_tax_rates = {
            (str(category.item_type or "").strip().lower(), str(category.name or "").strip().casefold()):
            _nonnegative_price(category.import_tax_rate or 0, "category import-tax rate")
            for category in categories
        }
        added_import_tax = 0.0
        for item in items:
            try:
                inventory_id = UUID(str(item.get("inventory_id")))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="A purchase-order item has an invalid inventory item")
            inventory = session.get(Inventory, inventory_id)
            if not inventory or inventory.company_id != current_user.company_id:
                raise HTTPException(status_code=404, detail="Inventory item not found")

            supplier_product = _supplier_product_for_item(
                session,
                po.supplier_id,
                inventory_id,
                current_user.company_id,
            )
            qty = _positive_integer(item.get("quantity"), "quantity")
            unit_price = _nonnegative_price(item.get("unit_price", supplier_product.unit_price))
            line = ProcurementOrderLine(
                po_id=po.id,
                inventory_id=inventory_id,
                supplier_product_id=supplier_product.id,
                quantity_ordered=qty,
                unit_price=unit_price,
                line_total=qty * unit_price,
                purchase_unit=supplier_product.purchase_unit,
                units_per_purchase_unit=supplier_product.units_per_purchase_unit,
            )
            session.add(line)
            category_key = (
                str(inventory.type or "").strip().lower(),
                str(inventory.category or "").strip().casefold(),
            )
            added_import_tax += line.line_total * category_tax_rates.get(category_key, 0) / 100

        all_lines = session.exec(
            select(ProcurementOrderLine).where(ProcurementOrderLine.po_id == po.id)
        ).all()
        subtotal = sum(float(line.line_total or 0) for line in all_lines)
        shipping_rate_type = str(getattr(po, "shipping_rate_type", "fixed") or "fixed").lower()
        if shipping_rate_type not in {"fixed", "percentage"}:
            raise HTTPException(status_code=400, detail="Purchase-order shipping rate type is invalid")
        shipping_rate = _nonnegative_price(getattr(po, "shipping_rate", 0) or 0, "purchase-order shipping rate")
        po.import_tax = round(float(po.import_tax or 0) + added_import_tax, 2)
        po.shipping_cost = round(
            shipping_rate if shipping_rate_type == "fixed" else subtotal * shipping_rate / 100,
            2,
        )
        po.total_amount = round(subtotal + po.import_tax + po.shipping_cost, 2)
        po.updated_at = datetime.utcnow()
        session.add(po)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add purchase-order items: {exc}")

    session.refresh(po)
    lines = session.exec(
        select(ProcurementOrderLine).where(ProcurementOrderLine.po_id == po.id)
    ).all()
    return _serialize_po(po, [_serialize_po_line(line) for line in lines])


@router.put("/purchase-orders/{po_id}/send")
def send_purchase_order(
    po_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark PO as sent to supplier"""
    _require_procurement_permission(current_user, session, ("suppliers", "inventory"), "write")
    
    po = session.get(ProcurementOrder, po_id)
    if not po or po.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft purchase orders can be marked sent")
    po.status = "sent"
    session.add(po)
    session.commit()
    session.refresh(po)

    return _serialize_po(po)


@router.post("/purchase-orders/{po_id}/receive")
def receive_purchase_order(
    po_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_procurement_permission(current_user, session, ("inventory",), "write")
    receipts = payload.get("items")
    if not isinstance(receipts, list) or not receipts or any(not isinstance(item, dict) for item in receipts):
        raise HTTPException(status_code=400, detail="At least one received item is required")

    po = session.exec(
        select(ProcurementOrder)
        .where(
            ProcurementOrder.id == po_id,
            ProcurementOrder.company_id == current_user.company_id,
        )
        .with_for_update()
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in {"sent", "confirmed", "partially_received"}:
        raise HTTPException(status_code=409, detail="Only sent or confirmed purchase orders can be received")

    lines = session.exec(
        select(ProcurementOrderLine)
        .where(ProcurementOrderLine.po_id == po.id)
        .with_for_update()
    ).all()
    line_by_id = {line.id: line for line in lines}
    seen_line_ids = set()
    now = datetime.utcnow()

    try:
        for receipt in receipts:
            try:
                line_id = UUID(str(receipt.get("line_id")))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="A received item has an invalid purchase-order line")
            if line_id in seen_line_ids:
                raise HTTPException(status_code=400, detail="A purchase-order line can only appear once per receipt")
            seen_line_ids.add(line_id)

            line = line_by_id.get(line_id)
            if not line:
                raise HTTPException(status_code=400, detail="Purchase-order line does not belong to this order")
            received_quantity = _positive_integer(receipt.get("quantity"), "received quantity")
            if line.quantity_received + received_quantity > line.quantity_ordered:
                raise HTTPException(status_code=400, detail="Received quantity cannot exceed the remaining order quantity")

            actual_unit_price = _nonnegative_price(
                receipt.get("unit_price", line.unit_price),
                "received unit price",
            )
            inventory = session.exec(
                select(Inventory)
                .where(
                    Inventory.id == line.inventory_id,
                    Inventory.company_id == current_user.company_id,
                )
                .with_for_update()
            ).first()
            if not inventory:
                raise HTTPException(status_code=404, detail="Inventory item not found")

            stock_quantity = received_quantity * line.units_per_purchase_unit
            inventory.quantity += stock_quantity
            inventory.updated_at = now
            line.quantity_received += received_quantity
            session.add(inventory)
            session.add(line)
            session.add(InventoryCostLayer(
                inventory_id=inventory.id,
                procurement_order_line_id=line.id,
                quantity_received=stock_quantity,
                quantity_remaining=stock_quantity,
                unit_cost=actual_unit_price / line.units_per_purchase_unit,
                received_at=now,
                company_id=current_user.company_id,
            ))

        all_received = all(line.quantity_received >= line.quantity_ordered for line in lines)
        any_received = any(line.quantity_received > 0 for line in lines)
        if all_received:
            po.status = "received"
        elif any_received:
            po.status = "partially_received"
        if any_received and po.actual_delivery_date is None:
            po.actual_delivery_date = now

        session.add(po)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to receive purchase order: {exc}")

    session.refresh(po)
    refreshed_lines = session.exec(
        select(ProcurementOrderLine).where(ProcurementOrderLine.po_id == po.id)
    ).all()
    return _serialize_po(po, [_serialize_po_line(line) for line in refreshed_lines])


# ─── INVENTORY COSTING ────────────────────────────────────────────────────────

@router.get("/inventory-costs")
def get_inventory_costs(
    low_stock_only: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get inventory costing and reorder insights"""
    
    stmt = select(InventoryCost).join(Inventory).where(
        Inventory.company_id == current_user.company_id
    )
    
    costs = session.exec(stmt).all()
    
    insights = []
    for cost in costs:
        inventory = session.get(Inventory, cost.inventory_id)
        
        if low_stock_only and inventory.quantity > cost.reorder_point:
            continue
        
        insights.append({
            'inventory_id': cost.inventory_id,
            'inventory_name': inventory.name,
            'current_quantity': inventory.quantity,
            'reorder_point': cost.reorder_point,
            'reorder_quantity': cost.reorder_quantity,
            'standard_cost': cost.standard_cost,
            'actual_cost': cost.actual_cost,
            'should_reorder': inventory.quantity <= cost.reorder_point,
            'estimated_days_until_stockout': (
                (inventory.quantity - cost.reorder_point) / max(1, cost.reorder_quantity / cost.lead_time_days)
            ) if cost.lead_time_days > 0 else None
        })
    
    return insights


@router.post("/inventory-costs")
def create_inventory_cost(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create or update inventory costing"""
    
    cost = InventoryCost(
        inventory_id=payload['inventory_id'],
        standard_cost=payload.get('standard_cost'),
        actual_cost=payload.get('actual_cost'),
        reorder_quantity=payload.get('reorder_quantity', 10),
        reorder_point=payload.get('reorder_point', 5),
        lead_time_days=payload.get('lead_time_days', 0),
        company_id=current_user.company_id
    )
    
    session.add(cost)
    session.commit()
    session.refresh(cost)
    
    return cost
