"""Seed a realistic consulting company dataset in dependency order.

The seed is intentionally company-scoped and idempotent so it can run on every
deployment. Existing records with the same stable business key are updated or
reused instead of duplicated.
"""

from datetime import datetime, timedelta
import json
from typing import Dict, Iterable, Optional
from uuid import UUID, uuid4

from sqlmodel import Session, select


COMPANY_ID = "75597"
COMPANY_NAME = "Northstar Advisory Group"
SEED_TAG = "northstar-consulting-seed-v1"


def _one(session: Session, model, **filters):
    statement = select(model)
    for field, value in filters.items():
        statement = statement.where(getattr(model, field) == value)
    return session.exec(statement).first()


def _get_or_add(session: Session, model, filters: dict, values: dict):
    record = _one(session, model, **filters)
    if record is None:
        record = model(id=uuid4(), **values)
        session.add(record)
    else:
        for field, value in values.items():
            if field != "id":
                setattr(record, field, value)
    session.flush()
    return record


def _seed_users(session: Session, User, UserRole, Department, now: datetime):
    departments = {}
    for name in ("Advisory", "Operations", "Finance", "People & Culture"):
        departments[name] = _get_or_add(
            session,
            Department,
            {"company_id": COMPANY_ID, "name": name},
            {"company_id": COMPANY_ID, "name": name, "description": f"{name} team"},
        )

    specs = [
        ("caroline", "Caroline", "Morgan", "manager", "Advisory", 118000, None),
        ("marcus.lee", "Marcus", "Lee", "manager", "Advisory", 98000, None),
        ("priya.shah", "Priya", "Shah", "manager", "Operations", 92000, None),
        ("daniel.ortiz", "Daniel", "Ortiz", "manager", "Finance", 88000, None),
        ("elena.ross", "Elena", "Ross", "employee", "Advisory", 76000, None),
        ("jamal.wright", "Jamal", "Wright", "employee", "Advisory", 72000, None),
        ("sofia.kim", "Sofia", "Kim", "employee", "Advisory", 69000, None),
        ("noah.bennett", "Noah", "Bennett", "employee", "Advisory", 67000, None),
        ("maya.patel", "Maya", "Patel", "employee", "Operations", 64000, None),
        ("liam.carter", "Liam", "Carter", "employee", "Operations", 62000, None),
        ("zoe.hughes", "Zoe", "Hughes", "employee", "Operations", 60000, None),
        ("owen.foster", "Owen", "Foster", "employee", "Operations", 58000, None),
        ("isla.mitchell", "Isla", "Mitchell", "employee", "Finance", 65000, None),
        ("ethan.reed", "Ethan", "Reed", "employee", "Finance", 61000, None),
        ("ava.sullivan", "Ava", "Sullivan", "employee", "People & Culture", 59000, None),
        ("lucas.morris", "Lucas", "Morris", "employee", "People & Culture", 57000, None),
        ("harper.gray", "Harper", "Gray", "viewer", "Operations", None, 25.0),
        ("benjamin.king", "Benjamin", "King", "viewer", "Finance", None, 24.0),
        ("chloe.adams", "Chloe", "Adams", "viewer", "People & Culture", None, 23.0),
        ("henry.brooks", "Henry", "Brooks", "viewer", "Advisory", None, 22.0),
    ]
    users = {}
    for username, first, last, role, department, salary, hourly_rate in specs:
        users[username] = _get_or_add(
            session,
            User,
            {"company_id": COMPANY_ID, "username": username},
            {
                "company_id": COMPANY_ID,
                "username": username,
                "email": f"{username}@northstaradvisory.example.com",
                "password_hash": User.hash_password("NorthstarDemo123!"),
                "first_name": first,
                "last_name": last,
                "role": getattr(UserRole, role.upper()),
                "hire_date": now - timedelta(days=900 if username == "caroline" else 500),
                "is_active": True,
                "department_id": departments[department].id,
                "employment_type": "salary" if salary else "hourly",
                "salary": salary,
                "hourly_rate": hourly_rate,
                "pay_frequency": "monthly" if salary else "biweekly",
                "reports_to": None,
                "location": "Northstar HQ",
            },
        )

    users["caroline"].reports_to = None
    for username in ("marcus.lee", "priya.shah", "daniel.ortiz", "harper.gray", "benjamin.king", "chloe.adams", "henry.brooks"):
        users[username].reports_to = users["caroline"].id
    for username in ("elena.ross", "jamal.wright", "sofia.kim", "noah.bennett"):
        users[username].reports_to = users["marcus.lee"].id
    for username in ("maya.patel", "liam.carter", "zoe.hughes", "owen.foster"):
        users[username].reports_to = users["priya.shah"].id
    for username in ("isla.mitchell", "ethan.reed"):
        users[username].reports_to = users["daniel.ortiz"].id
    for username in ("ava.sullivan", "lucas.morris"):
        users[username].reports_to = users["caroline"].id
    session.flush()
    return users


def seed_consulting_company(session: Session, company_id: str = COMPANY_ID) -> None:
    """Populate company_id with consulting data in foreign-key order."""
    global COMPANY_ID
    COMPANY_ID = str(company_id)
    now = datetime.utcnow().replace(microsecond=0)
    from backend.models import (
        AccountsPayable, AccountsReceivable, AssetUnit, Client, Company,
        Department, EmployeePaySchedule, Inventory, InventoryCost,
        PaySlip, ProcurementOrder, ProcurementOrderLine, ProductLocation,
        SaleTransaction, SaleTransactionItem, Schedule, Service,
        ServiceEmployee, ServiceLocation, Supplier, User, UserRole,
    )

    # 1. Tenant identity.
    _get_or_add(session, Company, {"company_id": COMPANY_ID}, {
        "company_id": COMPANY_ID, "name": COMPANY_NAME,
        "company_email": "hello@northstaradvisory.example.com",
        "company_phone": "+1 555 014 7559",
        "company_address": "200 Market Street, Suite 800, Denver, CO 80202",
        "tax_rate": 0.0825, "is_active": True, "registration_status": "approved",
    })

    # 2. Users and reporting hierarchy.
    users = _seed_users(session, User, UserRole, Department, now)
    caroline = users["caroline"]

    # 3. Suppliers before inventory and purchase orders.
    suppliers = {}
    for name, contact in (("Insight Research Partners", "Nadia Coleman"), ("OfficeWorks Business Supply", "Trevor Miles"), ("Summit Technology Group", "Grace Lin")):
        suppliers[name] = _get_or_add(session, Supplier, {"company_id": COMPANY_ID, "name": name}, {
            "company_id": COMPANY_ID, "name": name, "contact_person": contact,
            "email": f"{contact.lower().replace(' ', '.')}@supplier.example.com",
            "phone": "+1 555 010 2000", "address": "Denver, CO",
        })

    # 4. Every supported inventory type, including three service locations.
    inventory_specs = [
        ("Business Assessment Toolkit", "product", "PRD-BA-001", 149.0, 40, 55.0, "Client Resources", "HQ Stockroom"),
        ("Executive Strategy Workbook", "product", "PRD-ES-002", 79.0, 65, 24.0, "Client Resources", "HQ Stockroom"),
        ("Change Management Playbook", "product", "PRD-CM-003", 129.0, 35, 44.0, "Client Resources", "Remote Store"),
        ("Printed Workshop Materials", "resource", "RES-WM-001", 18.0, 250, 7.0, "Workshop Supplies", "HQ Stockroom"),
        ("Name Badges and Lanyards", "resource", "RES-NB-002", 3.5, 400, 1.1, "Workshop Supplies", "Remote Store"),
        ("Meeting Room Stationery", "resource", "RES-MS-003", 12.0, 80, 4.0, "Office Supplies", "Client Site Locker"),
        ("Portable Presentation Display", "asset", "AST-PD-001", 1250.0, 3, 780.0, "Equipment", "HQ Stockroom"),
        ("Workshop Camera Kit", "asset", "AST-CK-002", 900.0, 2, 550.0, "Equipment", "Remote Store"),
        ("Facilitation Laptop", "asset", "AST-FL-003", 1800.0, 6, 1100.0, "Equipment", "HQ Stockroom"),
        ("Northstar HQ - Denver", "location", "LOC-DEN-001", 0.0, 1, 0.0, "Locations", "Northstar HQ"),
        ("Client Collaboration Center", "location", "LOC-CCC-002", 0.0, 1, 0.0, "Locations", "Client Site Locker"),
        ("Remote Workshop Hub", "location", "LOC-RWH-003", 0.0, 1, 0.0, "Locations", "Remote Store"),
        ("Leadership Offsite Package", "bundle", "BND-LO-001", 950.0, 10, 500.0, "Packages", "HQ Stockroom"),
        ("Workshop Format Mix", "mix", "MIX-WF-001", 125.0, 20, 45.0, "Packages", "Remote Store"),
        ("Legacy Consulting Guide", "item", "ITM-LCG-001", 49.0, 25, 16.0, "Client Resources", "HQ Stockroom"),
    ]
    inventory = {}
    for name, item_type, sku, price, quantity, cost, category, location in inventory_specs:
        supplier = suppliers["OfficeWorks Business Supply"] if item_type in {"product", "resource", "item", "location"} else suppliers["Summit Technology Group"]
        inventory[name] = _get_or_add(session, Inventory, {"company_id": COMPANY_ID, "name": name}, {
            "company_id": COMPANY_ID, "name": name, "sku": sku, "type": item_type,
            "price": price, "quantity": quantity, "cost": cost, "category": category,
            "location": location, "supplier_id": supplier.id,
            "description": f"{name} for Northstar consulting operations.",
            "date_of_purchase": now - timedelta(days=90), "procurement_lead_days": 10,
        })
        _get_or_add(session, InventoryCost, {"inventory_id": inventory[name].id}, {
            "inventory_id": inventory[name].id, "standard_cost": cost,
            "actual_cost": cost, "acquisition_cost": cost, "reorder_quantity": max(quantity // 2, 1),
            "reorder_point": max(quantity // 5, 1), "lead_time_days": 10, "company_id": COMPANY_ID,
        })

    # 5. Consulting services.
    service_specs = [
        ("Executive Strategy Advisory", "Board and executive strategy advisory engagement.", "Strategy", 275.0, 120),
        ("Operational Excellence Review", "Process, operating model, and efficiency review.", "Operations", 225.0, 90),
        ("Change Management Program", "Stakeholder alignment and change adoption program.", "Change", 250.0, 120),
        ("Leadership Coaching Session", "One-to-one leadership coaching session.", "Leadership", 180.0, 60),
        ("Data & Market Analysis", "Research-backed market and performance analysis.", "Research", 195.0, 90),
        ("Workshop Facilitation", "Facilitated client workshop with materials.", "Workshops", 1500.0, 240),
    ]
    services = {}
    for name, description, category, price, duration in service_specs:
        services[name] = _get_or_add(session, Service, {"company_id": COMPANY_ID, "name": name}, {
            "company_id": COMPANY_ID, "name": name, "description": description,
            "category": category, "price": price, "duration_minutes": duration,
        })
        for username in ("caroline", "marcus.lee", "priya.shah", "elena.ross", "jamal.wright"):
            _get_or_add(session, ServiceEmployee, {"service_id": services[name].id, "user_id": users[username].id}, {
                "service_id": services[name].id, "user_id": users[username].id, "company_id": COMPANY_ID,
            })
        for location_name in ("Northstar HQ - Denver", "Client Collaboration Center", "Remote Workshop Hub"):
            _get_or_add(session, ServiceLocation, {"service_id": services[name].id, "inventory_id": inventory[location_name].id}, {
                "service_id": services[name].id, "inventory_id": inventory[location_name].id,
                "company_id": COMPANY_ID, "notes": "Available consulting delivery location",
            })

    # 6. Clients before appointments, sales, and receivables.
    clients = []
    client_specs = [
        ("Aspen Ridge Manufacturing", "operations@aspenridge.example.com"),
        ("BluePeak Health Systems", "procurement@bluepeak.example.com"),
        ("Canyon State Credit Union", "strategy@canyonstate.example.com"),
        ("Evergreen Public Services", "projects@evergreenps.example.com"),
        ("Frontier Foods Group", "leadership@frontierfoods.example.com"),
        ("Granite Peak Logistics", "finance@granitepeak.example.com"),
        ("Highline Education Network", "admin@highlineedu.example.com"),
        ("Juniper Energy Partners", "transformation@juniperenergy.example.com"),
        ("Milepost Software", "founders@milepost.example.com"),
        ("Pioneer Hospitality Collective", "operations@pioneerhospitality.example.com"),
    ]
    for index, (name, email) in enumerate(client_specs, 1):
        client = _get_or_add(session, Client, {"company_id": COMPANY_ID, "name": name}, {
            "company_id": COMPANY_ID, "name": name, "email": email,
            "phone": f"+1 555 755 {index:04d}", "address": f"{100 + index} Market Street, Denver, CO",
            "notes": "Consulting client seeded for Northstar demonstration data.",
            "membership_tier": "none", "membership_since": now - timedelta(days=180),
        })
        clients.append(client)

    # 7. Appointments, mixing upcoming and completed client engagements.
    schedules = []
    service_list = list(services.values())
    consultants = [users[name] for name in ("caroline", "marcus.lee", "priya.shah", "elena.ross", "jamal.wright")]
    for index in range(24):
        client = clients[index % len(clients)]
        service = service_list[index % len(service_list)]
        employee = consultants[index % len(consultants)]
        appointment_date = now + timedelta(days=index - 10, hours=9 + (index % 7))
        status = "completed" if appointment_date < now else "scheduled"
        schedule = _get_or_add(session, Schedule, {
            "company_id": COMPANY_ID, "client_id": client.id, "employee_id": employee.id,
            "appointment_date": appointment_date,
        }, {
            "company_id": COMPANY_ID, "client_id": client.id, "service_id": service.id,
            "employee_id": employee.id, "appointment_date": appointment_date,
            "status": status, "notes": f"{SEED_TAG}: client consulting appointment",
            "appointment_type": "meeting", "duration_minutes": service.duration_minutes,
            "is_paid": status == "completed", "send_reminder": status == "scheduled",
        })
        schedules.append(schedule)

    # 8. Sales history for completed appointments and additional products.
    for index, schedule in enumerate(schedules[:16]):
        if _one(session, SaleTransaction, schedule_id=schedule.id, company_id=COMPANY_ID):
            continue
        service = session.get(Service, schedule.service_id)
        product = inventory_specs[index % 3][0]
        product_record = inventory[product]
        subtotal = round(service.price + (product_record.price if index % 2 == 0 else 0), 2)
        tax = round(subtotal * 0.0825, 2)
        sale = SaleTransaction(
            id=uuid4(), client_id=schedule.client_id, employee_id=schedule.employee_id,
            schedule_id=schedule.id, subtotal=subtotal, tax_amount=tax, total=subtotal + tax,
            payment_method="card" if index % 2 == 0 else "cash", paid_at=schedule.appointment_date,
            company_id=COMPANY_ID,
        )
        session.add(sale)
        session.flush()
        for item, item_type, quantity in ((service, "service", 1), (product_record, "product", 1 if index % 2 == 0 else 0)):
            if not quantity:
                continue
            session.add(SaleTransactionItem(
                id=uuid4(), sale_transaction_id=sale.id, item_id=item.id, item_type=item_type,
                item_name=item.name, unit_price=item.price, quantity=quantity,
                line_total=item.price * quantity, company_id=COMPANY_ID,
            ))

    # 9. Purchase orders and accounts payable.
    for index, (supplier_name, item_name, quantity, unit_price) in enumerate((
        ("Insight Research Partners", "Printed Workshop Materials", 100, 7.0),
        ("OfficeWorks Business Supply", "Executive Strategy Workbook", 50, 24.0),
        ("Summit Technology Group", "Facilitation Laptop", 2, 1100.0),
    ), 1):
        po = _get_or_add(session, ProcurementOrder, {"po_number": f"NS-PO-2026-{index:03d}"}, {
            "po_number": f"NS-PO-2026-{index:03d}", "supplier_id": suppliers[supplier_name].id,
            "order_date": now - timedelta(days=30 * index), "expected_delivery_date": now - timedelta(days=30 * index - 7),
            "actual_delivery_date": now - timedelta(days=30 * index - 8), "total_amount": quantity * unit_price,
            "status": "received", "created_by": caroline.id, "notes": SEED_TAG, "company_id": COMPANY_ID,
        })
        _get_or_add(session, ProcurementOrderLine, {"po_id": po.id, "inventory_id": inventory[item_name].id}, {
            "po_id": po.id, "inventory_id": inventory[item_name].id, "quantity_ordered": quantity,
            "quantity_received": quantity, "unit_price": unit_price, "line_total": quantity * unit_price,
        })
        _get_or_add(session, AccountsPayable, {"company_id": COMPANY_ID, "invoice_number": f"NS-INV-{index:03d}"}, {
            "company_id": COMPANY_ID, "invoice_number": f"NS-INV-{index:03d}",
            "supplier_id": suppliers[supplier_name].id, "invoice_date": now - timedelta(days=30 * index),
            "due_date": now - timedelta(days=30 * index - 30), "amount": quantity * unit_price,
            "amount_paid": quantity * unit_price, "amount_remaining": 0, "status": "paid",
        })

    # 10. Accounts receivable for a few completed client engagements.
    for index, schedule in enumerate(schedules[:6], 1):
        service = session.get(Service, schedule.service_id)
        _get_or_add(session, AccountsReceivable, {"company_id": COMPANY_ID, "invoice_number": f"NS-AR-{index:03d}"}, {
            "company_id": COMPANY_ID, "invoice_number": f"NS-AR-{index:03d}", "client_id": schedule.client_id,
            "invoice_date": schedule.appointment_date, "due_date": schedule.appointment_date + timedelta(days=30),
            "amount": service.price, "amount_paid": service.price, "amount_remaining": 0,
            "status": "paid", "notes": SEED_TAG,
        })

    # 11. Six months of compensation configuration and paid pay slips.
    for user in users.values():
        base_pay = user.salary if user.salary else (user.hourly_rate or 0) * 80
        pay_schedule = _get_or_add(session, EmployeePaySchedule, {"company_id": COMPANY_ID, "employee_id": user.id}, {
            "company_id": COMPANY_ID, "employee_id": user.id, "frequency": "monthly" if user.salary else "biweekly",
            "work_days": "mon,tue,wed,thu,fri", "pay_timing": "arrears", "base_pay": base_pay,
            "compensation_percentage": 0.0, "base_pay_included": True,
        })
        for month in range(6):
            period_end = (now.replace(day=1) - timedelta(days=month * 30)).replace(day=1) - timedelta(days=1)
            period_start = period_end.replace(day=1)
            if _one(session, PaySlip, employee_id=user.id, company_id=COMPANY_ID, pay_period_start=period_start):
                continue
            gross = round(base_pay / 12 if user.salary else base_pay * 2, 2)
            insurance = 180.0 if user.salary else 0.0
            session.add(PaySlip(
                id=uuid4(), employee_id=user.id, pay_period_start=period_start, pay_period_end=period_end,
                gross_amount=gross, insurance_deduction=insurance, other_deductions=0,
                net_amount=gross - insurance, employment_type=user.employment_type or "salary",
                hours_worked=None if user.salary else 80, hourly_rate_snapshot=user.hourly_rate,
                salary_snapshot=user.salary, pay_frequency=user.pay_frequency, status="paid",
                notes=SEED_TAG, company_id=COMPANY_ID,
            ))

    session.commit()