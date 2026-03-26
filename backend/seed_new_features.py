"""
============================================================
Script: Seed test data for new features

PURPOSE:
   Populate new database tables with test data for development
   and manual testing of workflows, audit, financial, and
   procurement features.

USAGE:
   python seed_new_features.py

CREATES:
   - 3 workflow templates
   - 50 audit log entries
   - Sample GL accounts and entries
   - AR/AP sample records
   - 5 purchase orders at various stages
   - Inventory costing records
   - Schedule settings for users
============================================================
"""

import json
from datetime import datetime, timedelta
from uuid import uuid4
from decimal import Decimal

try:
    from backend.database import get_session
    from backend.models import (
        WorkflowTemplate, AuditLog, GeneralLedgerAccount, GeneralLedgerEntry,
        AccountsReceivable, AccountsPayable, ProcurementOrder, ProcurementOrderLine,
        InventoryCost, ScheduleSettings, User, Inventory, Client, Supplier
    )
except ImportError:
    from database import get_session
    from models import (
        WorkflowTemplate, AuditLog, GeneralLedgerAccount, GeneralLedgerEntry,
        AccountsReceivable, AccountsPayable, ProcurementOrder, ProcurementOrderLine,
        InventoryCost, ScheduleSettings, User, Inventory, Client, Supplier
    )


def seed_workflow_templates(session, company_id):
    """Create sample workflow templates."""
    workflows = [
        {
            "name": "Document Approval",
            "description": "Basic approval for contracts and agreements",
            "document_type": "contract",
            "stages_json": json.dumps({
                "stages": [
                    {
                        "id": "1",
                        "name": "Initial Review",
                        "approver_type": "role",
                        "approver_value": "manager",
                        "sla_hours": 24
                    },
                    {
                        "id": "2",
                        "name": "Compliance Check",
                        "approver_type": "role",
                        "approver_value": "admin",
                        "sla_hours": 12
                    },
                    {
                        "id": "3",
                        "name": "Final Approval",
                        "approver_type": "role",
                        "approver_value": "director",
                        "sla_hours": 6
                    }
                ]
            })
        },
        {
            "name": "Purchase Order Approval",
            "description": "Approval workflow for purchase orders",
            "document_type": "purchase_order",
            "stages_json": json.dumps({
                "stages": [
                    {
                        "id": "1",
                        "name": "Manager Review",
                        "approver_type": "role",
                        "approver_value": "manager",
                        "sla_hours": 24
                    },
                    {
                        "id": "2",
                        "name": "Finance Approval",
                        "approver_type": "role",
                        "approver_value": "finance",
                        "sla_hours": 24
                    }
                ]
            })
        },
        {
            "name": "Expense Reimbursement",
            "description": "Approval for employee expense reimbursement",
            "document_type": "expense",
            "stages_json": json.dumps({
                "stages": [
                    {
                        "id": "1",
                        "name": "Manager Review",
                        "approver_type": "role",
                        "approver_value": "manager",
                        "sla_hours": 12
                    },
                    {
                        "id": "2",
                        "name": "Finance Check",
                        "approver_type": "role",
                        "approver_value": "finance",
                        "sla_hours": 8
                    }
                ]
            })
        }
    ]

    for wf in workflows:
        template = WorkflowTemplate(
            name=wf["name"],
            description=wf["description"],
            document_type=wf["document_type"],
            stages_json=wf["stages_json"],
            company_id=company_id,
            is_active=True,
            created_by=None  # Set to actual user ID if available
        )
        session.add(template)

    session.commit()
    print("✓ Created 3 workflow templates")


def seed_audit_logs(session, company_id, user_id):
    """Create sample audit logs."""
    actions = ["create", "update", "delete", "approve", "reject"]
    entity_types = ["document", "order", "inventory", "client", "expense"]
    statuses = ["success", "success", "success", "failure"]  # Mostly successes

    now = datetime.utcnow()

    for i in range(50):
        log = AuditLog(
            user_id=user_id,
            username=f"user{i % 5}",
            action=actions[i % len(actions)],
            entity_type=entity_types[i % len(entity_types)],
            entity_id=str(uuid4()),
            changes_json=json.dumps({
                "before": {"status": "submitted"},
                "after": {"status": "approved"}
            }),
            status=statuses[i % len(statuses)],
            error_message=None if i % 10 != 0 else "Invalid state transition",
            company_id=company_id,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0",
            created_at=now - timedelta(hours=i)
        )
        session.add(log)

    session.commit()
    print("✓ Created 50 audit log entries")


def seed_gl_accounts(session, company_id):
    """Create general ledger accounts."""
    accounts = [
        {"code": "1000", "name": "Cash", "type": "asset"},
        {"code": "1200", "name": "Accounts Receivable", "type": "asset"},
        {"code": "1300", "name": "Inventory", "type": "asset"},
        {"code": "2000", "name": "Accounts Payable", "type": "liability"},
        {"code": "3000", "name": "Equity", "type": "equity"},
        {"code": "4000", "name": "Sales Revenue", "type": "revenue"},
        {"code": "5000", "name": "Cost of Goods Sold", "type": "expense"},
        {"code": "5100", "name": "Salaries & Wages", "type": "expense"},
        {"code": "5200", "name": "Rent Expense", "type": "expense"},
    ]

    for acc in accounts:
        gl_account = GeneralLedgerAccount(
            account_code=acc["code"],
            account_name=acc["name"],
            account_type=acc["type"],
            description=f"Sample {acc['name']} account",
            is_active=True,
            company_id=company_id
        )
        session.add(gl_account)

    session.commit()
    print("✓ Created 9 GL accounts")


def seed_ar_records(session, company_id, client_id):
    """Create accounts receivable records."""
    now = datetime.utcnow()
    base_amount = 5000

    for i in range(5):
        invoice_date = now - timedelta(days=45 + i * 10)
        due_date = invoice_date + timedelta(days=30)
        days_past_due = (now - due_date).days

        ar = AccountsReceivable(
            invoice_number=f"INV-{1000 + i}",
            client_id=client_id,
            invoice_date=invoice_date,
            due_date=due_date,
            amount=Decimal(base_amount + i * 1000),
            amount_paid=Decimal(0),
            amount_remaining=Decimal(base_amount + i * 1000),
            status="overdue" if days_past_due > 0 else "outstanding",
            company_id=company_id
        )
        session.add(ar)

    session.commit()
    print("✓ Created 5 AR records")


def seed_ap_records(session, company_id, supplier_id):
    """Create accounts payable records."""
    now = datetime.utcnow()
    base_amount = 3000

    for i in range(5):
        invoice_date = now - timedelta(days=30 + i * 5)
        due_date = invoice_date + timedelta(days=30)

        ap = AccountsPayable(
            invoice_number=f"SINV-{5000 + i}",
            supplier_id=supplier_id,
            invoice_date=invoice_date,
            due_date=due_date,
            amount=Decimal(base_amount + i * 500),
            amount_paid=Decimal(0),
            amount_remaining=Decimal(base_amount + i * 500),
            status="outstanding",
            company_id=company_id
        )
        session.add(ap)

    session.commit()
    print("✓ Created 5 AP records")


def seed_purchase_orders(session, company_id, supplier_id, inventory_id):
    """Create purchase orders at various stages."""
    now = datetime.utcnow()
    statuses = ["draft", "sent", "confirmed", "received", "invoiced"]

    for i, status in enumerate(statuses):
        po = ProcurementOrder(
            po_number=f"PO-{2024}-{1000 + i}",
            supplier_id=supplier_id,
            order_date=now - timedelta(days=10 - i),
            expected_delivery_date=now + timedelta(days=5 - i),
            status=status,
            created_by=None,  # Set to actual user if available
            company_id=company_id
        )
        session.add(po)
        session.flush()

        # Add line items
        for j in range(2):
            line = ProcurementOrderLine(
                po_id=po.id,
                inventory_id=inventory_id,
                quantity_ordered=100 + j * 50,
                quantity_received=50 if status in ["received", "invoiced"] else 0,
                unit_price=Decimal("25.00"),
                notes=f"Line item {j + 1}"
            )
            session.add(line)

    session.commit()
    print("✓ Created 5 purchase orders at various stages")


def seed_inventory_costs(session, company_id, inventory_id):
    """Create inventory costing records."""
    now = datetime.utcnow()

    cost = InventoryCost(
        inventory_id=inventory_id,
        standard_cost=Decimal("20.00"),
        actual_cost=Decimal("18.50"),
        acquisition_cost=Decimal("15.00"),
        reorder_quantity=500,
        reorder_point=100,
        lead_time_days=7,
        company_id=company_id
    )
    session.add(cost)
    session.commit()
    print("✓ Created 1 inventory cost record")


def seed_schedule_settings(session, company_id, user_id):
    """Create user schedule settings."""
    settings = ScheduleSettings(
        user_id=user_id,
        auto_accept_client_bookings=True,
        auto_accept_pending_hours=24,
        company_id=company_id
    )
    session.add(settings)
    session.commit()
    print("✓ Created schedule settings for user")


def main():
    """Run all seeding operations."""
    session = next(get_session())

    try:
        # Get or create test data
        # This assumes you have at least one user, client, and supplier
        # Adjust these queries based on your actual data
        
        company_id = uuid4()  # Use actual company ID
        user_id = None
        client_id = None
        supplier_id = None
        inventory_id = None

        # Try to get existing test data
        user = session.query(User).first()
        if user:
            user_id = user.id
            company_id = user.company_id

        client = session.query(Client).first()
        if client:
            client_id = client.id

        supplier = session.query(Supplier).first()
        if supplier:
            supplier_id = supplier.id

        inventory = session.query(Inventory).first()
        if inventory:
            inventory_id = inventory.id

        if not user_id:
            print("⚠️  No users found. Please create a user first.")
            return

        print(f"\nSeeding test data for company: {company_id}")
        print("=" * 50)

        seed_workflow_templates(session, company_id)
        seed_audit_logs(session, company_id, user_id)
        seed_gl_accounts(session, company_id)

        if client_id:
            seed_ar_records(session, company_id, client_id)

        if supplier_id:
            seed_ap_records(session, company_id, supplier_id)

        if supplier_id and inventory_id:
            seed_purchase_orders(session, company_id, supplier_id, inventory_id)

        if inventory_id:
            seed_inventory_costs(session, company_id, inventory_id)

        seed_schedule_settings(session, company_id, user_id)

        print("\n" + "=" * 50)
        print("✅ Test data seeding completed successfully!")

    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
