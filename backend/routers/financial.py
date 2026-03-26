"""
Router: /api/v1/financial
Financial modules: AR, AP, GL, procurement.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime

try:
    from backend.database import get_session
    from backend.models import (
        AccountsReceivable, AccountsPayable, GeneralLedgerEntry, GeneralLedgerAccount,
        ProcurementOrder, ProcurementOrderLine, InventoryCost,
        User, Supplier, Inventory
    )
    from backend.routers.auth import get_current_user
except ImportError:
    from database import get_session
    from models import (
        AccountsReceivable, AccountsPayable, GeneralLedgerEntry, GeneralLedgerAccount,
        ProcurementOrder, ProcurementOrderLine, InventoryCost,
        User, Supplier, Inventory
    )
    from routers.auth import get_current_user

router = APIRouter()


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

@router.post("/purchase-orders")
def create_purchase_order(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a purchase order"""
    
    po = ProcurementOrder(
        po_number=payload.get('po_number', f"PO-{datetime.utcnow().timestamp()}"),
        supplier_id=payload['supplier_id'],
        order_date=datetime.utcnow(),
        expected_delivery_date=payload.get('expected_delivery_date'),
        total_amount=sum([item['quantity'] * item['unit_price'] for item in payload.get('items', [])]),
        status='draft',
        created_by=current_user.id,
        company_id=current_user.company_id
    )
    
    session.add(po)
    session.commit()
    session.refresh(po)
    
    # Add line items
    for item in payload.get('items', []):
        line = ProcurementOrderLine(
            po_id=po.id,
            inventory_id=item['inventory_id'],
            quantity_ordered=item['quantity'],
            unit_price=item['unit_price'],
            line_total=item['quantity'] * item['unit_price']
        )
        session.add(line)
    
    session.commit()
    
    return po


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
    
    return session.exec(stmt).all()


@router.put("/purchase-orders/{po_id}/send")
def send_purchase_order(
    po_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark PO as sent to supplier"""
    
    po = session.get(ProcurementOrder, po_id)
    if not po or po.company_id != current_user.company_id:
        raise Exception("Not found")
    
    po.status = 'sent'
    session.add(po)
    session.commit()
    
    return po


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
