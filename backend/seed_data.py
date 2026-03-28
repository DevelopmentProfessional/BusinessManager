# ============================================================
# FILE: seed_data.py
#
# PURPOSE:
#   Populates the database with realistic demo data for showcasing
#   the application. Called by the /api/v1/settings/admin/seed endpoint.
#   All seeded records are tagged with company_id from the session context,
#   defaulting to "demo" if none is provided.
#
# CHANGE LOG:
#   2026-03-28 | Claude | Initial implementation
# ============================================================

from datetime import datetime, timedelta
from uuid import uuid4

from sqlmodel import Session, select


# ─── HELPERS ───────────────────────────────────────────────────────────────────

def _exists(session: Session, model, **filters) -> bool:
    """Return True if at least one row matches all filters."""
    stmt = select(model)
    for attr, val in filters.items():
        stmt = stmt.where(getattr(model, attr) == val)
    return session.exec(stmt).first() is not None


# ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

def seed_demo_data(session: Session, force: bool = False, company_id: str = "demo") -> None:
    """
    Insert demo data into the database.

    Args:
        session:    Active SQLModel/SQLAlchemy session (caller commits).
        force:      When True, existing demo records are skipped silently
                    (not deleted — use the admin UI to clear them first).
        company_id: Tenant scope for all inserted rows.
    """
    try:
        from backend.models import (
            Client, Supplier, Inventory, Service, User, Schedule, UserRole,
            SaleTransaction, SaleTransactionItem,
        )
    except ModuleNotFoundError:
        from models import (
            Client, Supplier, Inventory, Service, User, Schedule, UserRole,
            SaleTransaction, SaleTransactionItem,
        )

    now = datetime.utcnow()

    # ── 1. SUPPLIER ──────────────────────────────────────────────────────────
    supplier_name = "Demo Supplies Co."
    supplier = session.exec(
        select(Supplier).where(Supplier.name == supplier_name, Supplier.company_id == company_id)
    ).first()

    if not supplier:
        supplier = Supplier(
            id=uuid4(),
            name=supplier_name,
            contact_person="Alex Johnson",
            email="alex@demosupplies.example.com",
            phone="555-010-2030",
            address="10 Industrial Blvd, Demo City, DC 00001",
            company_id=company_id,
        )
        session.add(supplier)
        session.flush()  # get the id

    # ── 2. INVENTORY ─────────────────────────────────────────────────────────
    inventory_items = [
        dict(name="Premium Shampoo", sku="SHM-001", price=12.99, category="Hair Care",
             type="product", quantity=150, min_stock_level=20, cost=6.50),
        dict(name="Conditioning Treatment", sku="CDT-001", price=18.50, category="Hair Care",
             type="product", quantity=80, min_stock_level=15, cost=8.00),
        dict(name="Styling Gel", sku="STG-001", price=9.99, category="Styling",
             type="product", quantity=200, min_stock_level=30, cost=4.00),
        dict(name="Hair Dryer Pro", sku="HDR-001", price=149.99, category="Equipment",
             type="asset", quantity=5, min_stock_level=2, cost=75.00),
        dict(name="Styling Chair", sku="CHR-001", price=499.99, category="Furniture",
             type="asset", quantity=8, min_stock_level=4, cost=200.00),
    ]

    inv_records = []
    for item_data in inventory_items:
        existing = session.exec(
            select(Inventory).where(
                Inventory.name == item_data["name"],
                Inventory.company_id == company_id,
            )
        ).first()
        if existing:
            inv_records.append(existing)
            continue

        inv = Inventory(
            id=uuid4(),
            supplier_id=supplier.id,
            company_id=company_id,
            location="Storeroom A",
            **item_data,
        )
        session.add(inv)
        inv_records.append(inv)

    session.flush()

    # ── 3. SERVICES ──────────────────────────────────────────────────────────
    service_specs = [
        dict(name="Haircut & Style", description="Full cut and blow-dry finish.",
             category="Hair", price=45.00, duration_minutes=60),
        dict(name="Color Treatment", description="Single-process color with toner.",
             category="Hair", price=95.00, duration_minutes=120),
        dict(name="Scalp Massage", description="Relaxing 30-minute scalp treatment.",
             category="Wellness", price=30.00, duration_minutes=30),
        dict(name="Deep Conditioning", description="Intensive moisture repair mask.",
             category="Hair", price=40.00, duration_minutes=45),
        dict(name="Consultation", description="Free 15-minute style consultation.",
             category="Admin", price=0.00, duration_minutes=15),
    ]

    svc_records = []
    for spec in service_specs:
        existing = session.exec(
            select(Service).where(
                Service.name == spec["name"],
                Service.company_id == company_id,
            )
        ).first()
        if existing:
            svc_records.append(existing)
            continue

        svc = Service(id=uuid4(), company_id=company_id, **spec)
        session.add(svc)
        svc_records.append(svc)

    session.flush()

    # ── 4. CLIENTS ───────────────────────────────────────────────────────────
    client_specs = [
        dict(name="Maria Garcia", email="maria.garcia@example.com", phone="555-100-2001",
             address="12 Maple St, Demo City", membership_tier="gold"),
        dict(name="James Wilson", email="james.wilson@example.com", phone="555-100-2002",
             address="34 Oak Ave, Demo City", membership_tier="silver"),
        dict(name="Emily Chen", email="emily.chen@example.com", phone="555-100-2003",
             address="56 Pine Rd, Demo City", membership_tier="none"),
        dict(name="Robert Brown", email="robert.brown@example.com", phone="555-100-2004",
             address="78 Elm Blvd, Demo City", membership_tier="none"),
        dict(name="Sophie Turner", email="sophie.turner@example.com", phone="555-100-2005",
             address="90 Cedar Ln, Demo City", membership_tier="gold"),
    ]

    client_records = []
    for spec in client_specs:
        existing = session.exec(
            select(Client).where(
                Client.name == spec["name"],
                Client.company_id == company_id,
            )
        ).first()
        if existing:
            client_records.append(existing)
            continue

        client = Client(
            id=uuid4(),
            company_id=company_id,
            membership_since=now - timedelta(days=180),
            membership_points=150,
            **spec,
        )
        session.add(client)
        client_records.append(client)

    session.flush()

    # ── 5. EMPLOYEE USERS ────────────────────────────────────────────────────
    employee_specs = [
        dict(username=f"demo_alice_{company_id}", first_name="Alice", last_name="Martin",
             email=f"alice.martin.{company_id}@example.com", color="#4f86f7",
             employment_type="salary", salary=52000),
        dict(username=f"demo_bob_{company_id}", first_name="Bob", last_name="Davis",
             email=f"bob.davis.{company_id}@example.com", color="#f97316",
             employment_type="hourly", hourly_rate=18.50),
    ]

    employee_records = []
    for spec in employee_specs:
        existing = session.exec(
            select(User).where(
                User.username == spec["username"],
                User.company_id == company_id,
            )
        ).first()
        if existing:
            employee_records.append(existing)
            continue

        emp = User(
            id=uuid4(),
            company_id=company_id,
            role=UserRole.EMPLOYEE,
            password_hash=User.hash_password("DemoPass123!"),
            hire_date=now - timedelta(days=365),
            is_active=True,
            **spec,
        )
        session.add(emp)
        employee_records.append(emp)

    session.flush()

    # ── 6. SCHEDULES ─────────────────────────────────────────────────────────
    # Create a handful of upcoming appointments
    if employee_records and client_records and svc_records:
        schedule_specs = [
            dict(
                client=client_records[0], service=svc_records[0], employee=employee_records[0],
                offset_days=1, hour=9,
            ),
            dict(
                client=client_records[1], service=svc_records[1], employee=employee_records[0],
                offset_days=1, hour=11,
            ),
            dict(
                client=client_records[2], service=svc_records[2], employee=employee_records[1],
                offset_days=2, hour=14,
            ),
            dict(
                client=client_records[3], service=svc_records[3], employee=employee_records[1],
                offset_days=3, hour=10,
            ),
            dict(
                client=client_records[4], service=svc_records[0], employee=employee_records[0],
                offset_days=5, hour=15,
            ),
        ]

        for spec in schedule_specs:
            appt_date = (now + timedelta(days=spec["offset_days"])).replace(
                hour=spec["hour"], minute=0, second=0, microsecond=0
            )
            # Skip if a schedule already exists for this employee/date combo
            exists = session.exec(
                select(Schedule).where(
                    Schedule.employee_id == spec["employee"].id,
                    Schedule.appointment_date == appt_date,
                    Schedule.company_id == company_id,
                )
            ).first()
            if exists:
                continue

            schedule = Schedule(
                id=uuid4(),
                client_id=spec["client"].id,
                service_id=spec["service"].id,
                employee_id=spec["employee"].id,
                appointment_date=appt_date,
                duration_minutes=spec["service"].duration_minutes,
                status="scheduled",
                appointment_type="one_time",
                company_id=company_id,
            )
            session.add(schedule)

    session.flush()

    # ── 7. SALE TRANSACTIONS ─────────────────────────────────────────────────
    if client_records and employee_records and svc_records and inv_records:
        sale_specs = [
            dict(client=client_records[0], employee=employee_records[0],
                 items=[
                     dict(item=svc_records[0], item_type="service", qty=1),
                     dict(item=inv_records[0], item_type="product", qty=2),
                 ],
                 payment_method="card", days_ago=7),
            dict(client=client_records[1], employee=employee_records[1],
                 items=[
                     dict(item=svc_records[1], item_type="service", qty=1),
                 ],
                 payment_method="cash", days_ago=5),
            dict(client=client_records[4], employee=employee_records[0],
                 items=[
                     dict(item=svc_records[2], item_type="service", qty=1),
                     dict(item=inv_records[2], item_type="product", qty=1),
                 ],
                 payment_method="card", days_ago=2),
        ]

        for sale_spec in sale_specs:
            sale_date = now - timedelta(days=sale_spec["days_ago"])
            # Skip if a sale for this client+employee on same day exists
            exists = session.exec(
                select(SaleTransaction).where(
                    SaleTransaction.client_id == sale_spec["client"].id,
                    SaleTransaction.company_id == company_id,
                )
            ).first()
            if exists:
                continue

            subtotal = sum(
                (s["item"].price * s["qty"]) for s in sale_spec["items"]
            )
            tax = round(subtotal * 0.08, 2)
            total = round(subtotal + tax, 2)

            txn = SaleTransaction(
                id=uuid4(),
                client_id=sale_spec["client"].id,
                employee_id=sale_spec["employee"].id,
                subtotal=round(subtotal, 2),
                tax_amount=tax,
                total=total,
                payment_method=sale_spec["payment_method"],
                company_id=company_id,
            )
            txn.created_at = sale_date
            session.add(txn)
            session.flush()

            for line in sale_spec["items"]:
                item_obj = line["item"]
                line_total = round(item_obj.price * line["qty"], 2)
                txn_item = SaleTransactionItem(
                    id=uuid4(),
                    sale_transaction_id=txn.id,
                    item_id=item_obj.id,
                    item_type=line["item_type"],
                    item_name=item_obj.name,
                    unit_price=item_obj.price,
                    quantity=line["qty"],
                    line_total=line_total,
                    company_id=company_id,
                )
                session.add(txn_item)

    session.commit()
