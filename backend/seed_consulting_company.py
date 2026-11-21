"""Seed a realistic consulting company dataset in dependency order.

The seed is intentionally company-scoped and additive-only. Existing records
with the same stable business key are reused untouched instead of duplicated
or modified.
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

    new_user_ids = {user.id for user in session.new if isinstance(user, User)}
    hierarchy = {
        "caroline": (),
        "marcus.lee": ("caroline",),
        "priya.shah": ("caroline",),
        "daniel.ortiz": ("caroline",),
        "harper.gray": ("caroline",),
        "benjamin.king": ("caroline",),
        "chloe.adams": ("caroline",),
        "henry.brooks": ("caroline",),
        "elena.ross": ("marcus.lee",),
        "jamal.wright": ("marcus.lee",),
        "sofia.kim": ("marcus.lee",),
        "noah.bennett": ("marcus.lee",),
        "maya.patel": ("priya.shah",),
        "liam.carter": ("priya.shah",),
        "zoe.hughes": ("priya.shah",),
        "owen.foster": ("priya.shah",),
        "isla.mitchell": ("daniel.ortiz",),
        "ethan.reed": ("daniel.ortiz",),
        "ava.sullivan": ("caroline",),
        "lucas.morris": ("caroline",),
    }
    for username, manager_names in hierarchy.items():
        if users[username].id in new_user_ids and manager_names:
            users[username].reports_to = users[manager_names[0]].id
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
        tier = "gold" if index <= 3 else ("silver" if index <= 6 else "none")
        client = _get_or_add(session, Client, {"company_id": COMPANY_ID, "name": name}, {
            "company_id": COMPANY_ID, "name": name, "email": email,
            "phone": f"+1 555 755 {index:04d}", "address": f"{100 + index} Market Street, Denver, CO",
            "notes": "Consulting client seeded for Northstar demonstration data.",
            "membership_tier": tier, "membership_since": now - timedelta(days=400),
        })
        clients.append(client)

    # 7. Appointments, spanning 1 year of past engagements and 3 weeks of future schedule.
    service_list = list(services.values())
    consultants = [users[name] for name in ("caroline", "marcus.lee", "priya.shah", "elena.ross", "jamal.wright", "sofia.kim", "noah.bennett")]

    # Pre-fetch existing schedule keys for this company in a single bulk query
    existing_schedule_keys = {
        (str(row[0]), str(row[1]), row[2])
        for row in session.exec(
            select(Schedule.client_id, Schedule.employee_id, Schedule.appointment_date).where(
                Schedule.company_id == COMPANY_ID
            )
        ).all()
    }

    # Generate business-day appointments across past 365 days up to +21 days into the future (~52 weeks).
    for day_offset in range(-365, 22):
        target_date = now.date() + timedelta(days=day_offset)
        # Weekdays only (Monday = 0, Friday = 4)
        if target_date.weekday() >= 5:
            continue

        # 1 to 3 appointments per business day across consultants
        daily_count = 2 if (abs(day_offset) % 3 != 0) else (1 if abs(day_offset) % 2 == 0 else 3)
        for slot in range(daily_count):
            client = clients[(abs(day_offset) * 3 + slot * 2) % len(clients)]
            service = service_list[(abs(day_offset) * 2 + slot) % len(service_list)]
            employee = consultants[(abs(day_offset) + slot * 3) % len(consultants)]
            hour = 9 + ((abs(day_offset) * 2 + slot * 3) % 7)
            minute = 0 if (abs(day_offset) + slot) % 2 == 0 else 30
            appointment_date = datetime(target_date.year, target_date.month, target_date.day, hour, minute, 0)

            sched_key = (str(client.id), str(employee.id), appointment_date)
            if sched_key in existing_schedule_keys:
                continue

            if appointment_date < now:
                # Realistic past appointment outcomes: ~93% completed, ~4% cancelled, ~3% no-show
                if (abs(day_offset) * 7 + slot) % 25 == 0:
                    status = "cancelled"
                    is_paid = False
                elif (abs(day_offset) * 11 + slot) % 35 == 0:
                    status = "no_show"
                    is_paid = False
                else:
                    status = "completed"
                    is_paid = True
            else:
                status = "scheduled"
                is_paid = False

            schedule = Schedule(
                id=uuid4(),
                company_id=COMPANY_ID,
                client_id=client.id,
                service_id=service.id,
                employee_id=employee.id,
                appointment_date=appointment_date,
                status=status,
                notes=f"{SEED_TAG}: {service.name} with {client.name}",
                appointment_type="workshop" if service.category == "Workshops" else "meeting",
                duration_minutes=service.duration_minutes,
                is_paid=is_paid,
                send_reminder=status == "scheduled",
            )
            session.add(schedule)
            existing_schedule_keys.add(sched_key)

    session.flush()

    # Load all company schedules for sales linking
    all_schedules = session.exec(
        select(Schedule).where(Schedule.company_id == COMPANY_ID)
    ).all()

    # 8. Sales history — completed appointment sales + direct client product/package sales over time.
    product_keys = [
        "Business Assessment Toolkit",
        "Executive Strategy Workbook",
        "Change Management Playbook",
        "Printed Workshop Materials",
        "Leadership Offsite Package",
        "Legacy Consulting Guide",
    ]

    existing_sale_schedule_ids = {
        row[0]
        for row in session.exec(
            select(SaleTransaction.schedule_id).where(
                SaleTransaction.company_id == COMPANY_ID,
                SaleTransaction.schedule_id.is_not(None),
            )
        ).all()
        if row[0] is not None
    }

    # 8A. Sales attached to completed appointments.
    for index, schedule in enumerate(all_schedules):
        if schedule.status != "completed":
            continue
        if schedule.id in existing_sale_schedule_ids:
            continue

        service = session.get(Service, schedule.service_id)
        if not service:
            continue

        # In ~35% of completed appointments, client also purchased an accompanying toolkit/workbook
        include_product = ((schedule.appointment_date.day + schedule.appointment_date.month + index) % 3 == 0)
        product_record = inventory[product_keys[index % len(product_keys)]] if include_product else None

        subtotal = round(service.price + (product_record.price if product_record else 0.0), 2)
        tax = round(subtotal * 0.0825, 2)
        payment_method = "card" if (index % 3 != 0) else ("cash" if index % 2 == 0 else "bank_transfer")

        sale = SaleTransaction(
            id=uuid4(),
            client_id=schedule.client_id,
            employee_id=schedule.employee_id,
            schedule_id=schedule.id,
            subtotal=subtotal,
            tax_amount=tax,
            total=round(subtotal + tax, 2),
            payment_method=payment_method,
            paid_at=schedule.appointment_date,
            company_id=COMPANY_ID,
        )
        session.add(sale)
        schedule.sale_transaction_id = sale.id
        schedule.is_paid = True
        existing_sale_schedule_ids.add(schedule.id)

        session.add(SaleTransactionItem(
            id=uuid4(),
            sale_transaction_id=sale.id,
            item_id=service.id,
            item_type="service",
            item_name=service.name,
            unit_price=service.price,
            quantity=1,
            line_total=service.price,
            company_id=COMPANY_ID,
        ))

        if product_record:
            session.add(SaleTransactionItem(
                id=uuid4(),
                sale_transaction_id=sale.id,
                item_id=product_record.id,
                item_type="product",
                item_name=product_record.name,
                unit_price=product_record.price,
                quantity=1,
                line_total=product_record.price,
                company_id=COMPANY_ID,
            ))

    session.flush()

    # 8B. Direct standalone client sales over time (toolkits, guides, offsite packages).
    existing_standalone_sales = {
        (str(row[0]), row[1])
        for row in session.exec(
            select(SaleTransaction.client_id, SaleTransaction.paid_at).where(
                SaleTransaction.company_id == COMPANY_ID,
                SaleTransaction.schedule_id.is_(None),
            )
        ).all()
    }

    for day_step in range(12, 365, 5):
        sale_date = (now - timedelta(days=day_step)).replace(hour=10 + (day_step % 6), minute=15, second=0)
        client = clients[day_step % len(clients)]
        consultant = consultants[day_step % len(consultants)]
        product_record = inventory[product_keys[(day_step // 5) % len(product_keys)]]

        if (str(client.id), sale_date) in existing_standalone_sales:
            continue

        quantity = 2 if (day_step % 7 == 0 and product_record.price < 200) else 1
        subtotal = round(product_record.price * quantity, 2)
        tax = round(subtotal * 0.0825, 2)
        payment_method = "card" if (day_step % 2 == 0) else "bank_transfer"

        direct_sale = SaleTransaction(
            id=uuid4(),
            client_id=client.id,
            employee_id=consultant.id,
            schedule_id=None,
            subtotal=subtotal,
            tax_amount=tax,
            total=round(subtotal + tax, 2),
            payment_method=payment_method,
            paid_at=sale_date,
            company_id=COMPANY_ID,
        )
        session.add(direct_sale)
        existing_standalone_sales.add((str(client.id), sale_date))

        session.add(SaleTransactionItem(
            id=uuid4(),
            sale_transaction_id=direct_sale.id,
            item_id=product_record.id,
            item_type="product",
            item_name=product_record.name,
            unit_price=product_record.price,
            quantity=quantity,
            line_total=round(product_record.price * quantity, 2),
            company_id=COMPANY_ID,
        ))

    session.flush()

    # 9. Purchase orders and accounts payable across the past 12 months (~24 procurement cycles).
    existing_po_numbers = {
        row[0]
        for row in session.exec(
            select(ProcurementOrder.po_number).where(ProcurementOrder.company_id == COMPANY_ID)
        ).all()
    }
    existing_ap_numbers = {
        row[0]
        for row in session.exec(
            select(AccountsPayable.invoice_number).where(AccountsPayable.company_id == COMPANY_ID)
        ).all()
    }

    po_inventory_items = [
        ("Insight Research Partners", "Printed Workshop Materials", 120, 7.0),
        ("OfficeWorks Business Supply", "Executive Strategy Workbook", 60, 24.0),
        ("OfficeWorks Business Supply", "Business Assessment Toolkit", 40, 55.0),
        ("OfficeWorks Business Supply", "Meeting Room Stationery", 80, 4.0),
        ("Summit Technology Group", "Facilitation Laptop", 2, 1100.0),
        ("Summit Technology Group", "Workshop Camera Kit", 2, 550.0),
        ("Summit Technology Group", "Portable Presentation Display", 2, 780.0),
    ]

    for cycle in range(1, 25):
        supplier_name, item_name, quantity, unit_price = po_inventory_items[(cycle - 1) % len(po_inventory_items)]
        order_date = now - timedelta(days=15 * (25 - cycle))
        po_number = f"NS-PO-{order_date.year}-{cycle:03d}"
        inv_number = f"NS-INV-{order_date.year}-{cycle:03d}"
        total_amount = round(quantity * unit_price, 2)

        is_recent = (order_date >= now - timedelta(days=12))
        po_status = "sent" if is_recent else "received"
        ap_status = "outstanding" if is_recent else "paid"
        amount_paid = 0.0 if is_recent else total_amount
        amount_remaining = total_amount if is_recent else 0.0

        if po_number not in existing_po_numbers:
            po = ProcurementOrder(
                id=uuid4(),
                po_number=po_number,
                supplier_id=suppliers[supplier_name].id,
                order_date=order_date,
                expected_delivery_date=order_date + timedelta(days=7),
                actual_delivery_date=None if is_recent else (order_date + timedelta(days=6)),
                total_amount=total_amount,
                status=po_status,
                created_by=caroline.id,
                notes=SEED_TAG,
                company_id=COMPANY_ID,
            )
            session.add(po)
            existing_po_numbers.add(po_number)

            session.add(ProcurementOrderLine(
                id=uuid4(),
                po_id=po.id,
                inventory_id=inventory[item_name].id,
                quantity_ordered=quantity,
                quantity_received=0 if is_recent else quantity,
                unit_price=unit_price,
                line_total=total_amount,
            ))

        if inv_number not in existing_ap_numbers:
            session.add(AccountsPayable(
                id=uuid4(),
                company_id=COMPANY_ID,
                invoice_number=inv_number,
                supplier_id=suppliers[supplier_name].id,
                invoice_date=order_date,
                due_date=order_date + timedelta(days=30),
                amount=total_amount,
                amount_paid=amount_paid,
                amount_remaining=amount_remaining,
                status=ap_status,
            ))
            existing_ap_numbers.add(inv_number)

    session.flush()

    # 10. Accounts receivable across the year (monthly client consulting invoices).
    existing_ar_numbers = {
        row[0]
        for row in session.exec(
            select(AccountsReceivable.invoice_number).where(AccountsReceivable.company_id == COMPANY_ID)
        ).all()
    }

    for month_idx in range(12):
        inv_date = (now - timedelta(days=30 * (12 - month_idx))).replace(day=15, hour=10, minute=0, second=0)
        for client_idx in range(3):
            client = clients[(month_idx * 3 + client_idx) % len(clients)]
            inv_number = f"NS-AR-{inv_date.year}-{(month_idx * 3 + client_idx + 1):03d}"
            if inv_number in existing_ar_numbers:
                continue

            amount = round(1500.0 + ((month_idx + client_idx) % 4) * 450.0, 2)
            is_recent_ar = (inv_date >= now - timedelta(days=25))
            ar_status = "outstanding" if (is_recent_ar and client_idx == 0) else "paid"
            ar_paid = 0.0 if ar_status == "outstanding" else amount
            ar_rem = amount if ar_status == "outstanding" else 0.0

            session.add(AccountsReceivable(
                id=uuid4(),
                company_id=COMPANY_ID,
                invoice_number=inv_number,
                client_id=client.id,
                invoice_date=inv_date,
                due_date=inv_date + timedelta(days=30),
                amount=amount,
                amount_paid=ar_paid,
                amount_remaining=ar_rem,
                status=ar_status,
                notes=f"{SEED_TAG}: monthly consulting retainer",
            ))
            existing_ar_numbers.add(inv_number)

    session.flush()

    # 11. Twelve months of compensation configuration and paid pay slips.
    existing_slip_keys = {
        (str(row[0]), row[1])
        for row in session.exec(
            select(PaySlip.employee_id, PaySlip.pay_period_start).where(PaySlip.company_id == COMPANY_ID)
        ).all()
    }

    for user in users.values():
        base_pay = user.salary if user.salary else (user.hourly_rate or 0) * 80
        _get_or_add(session, EmployeePaySchedule, {"company_id": COMPANY_ID, "employee_id": user.id}, {
            "company_id": COMPANY_ID, "employee_id": user.id, "frequency": "monthly" if user.salary else "biweekly",
            "work_days": "mon,tue,wed,thu,fri", "pay_timing": "arrears", "base_pay": base_pay,
            "compensation_percentage": 0.0, "base_pay_included": True,
        })
        for month in range(12):
            period_end = (now.replace(day=1) - timedelta(days=month * 30)).replace(day=1) - timedelta(days=1)
            period_start = period_end.replace(day=1)
            if (str(user.id), period_start) in existing_slip_keys:
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
            existing_slip_keys.add((str(user.id), period_start))

    session.commit()


if __name__ == "__main__":
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from backend.database import engine
    print(f"Seeding company {COMPANY_ID} with 1 year of appointments, sales, inventory POs, and payroll...")
    with Session(engine) as session:
        seed_consulting_company(session)
    print("Seed complete.")