from datetime import datetime, timedelta
from uuid import uuid4
import os
import random

from sqlmodel import Session, select

from database import engine, create_db_and_tables
from models import (
    Client, Product, Inventory, Supplier, Service,
    Employee, Schedule, Asset, Attendance, Document, EntityType
)


def get_one(session: Session, model, where):
    stmt = select(model).where(*where)
    return session.exec(stmt).first()


def get_or_create(session: Session, model, defaults: dict | None = None, **unique_by):
    obj = get_one(session, model, [getattr(model, k) == v for k, v in unique_by.items()])
    if obj:
        return obj, False
    data = {**unique_by}
    if defaults:
        data.update(defaults)
    obj = model(**data)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj, True


def ensure_uploads():
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    # Create tiny placeholder files
    placeholder1 = os.path.join(upload_dir, "welcome_note.txt")
    placeholder2 = os.path.join(upload_dir, "color_chart.txt")
    if not os.path.exists(placeholder1):
        with open(placeholder1, "w", encoding="utf-8") as f:
            f.write("Welcome to our salon!\n")
    if not os.path.exists(placeholder2):
        with open(placeholder2, "w", encoding="utf-8") as f:
            f.write("Balayage • Highlights • Toner\n")
    return placeholder1, placeholder2


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        # Suppliers
        supplier1, _ = get_or_create(
            session, Supplier,
            name="BeautyPro Distributors",
            defaults={
                "contact_person": "Liam Parker",
                "email": "orders@beautypro.example",
                "phone": "+1-555-1001",
                "address": "101 Glam Ave, Suite 200",
            },
        )
        supplier2, _ = get_or_create(
            session, Supplier,
            name="Glamor Supply Co",
            defaults={
                "contact_person": "Nora King",
                "email": "hello@glamorco.example",
                "phone": "+1-555-1002",
                "address": "202 Style Blvd",
            },
        )

        # Products (ensure a baseline two and then up to 20 total)
        product1, _ = get_or_create(
            session, Product,
            sku="AO-SHAM-500",
            defaults={
                "name": "Argan Oil Shampoo",
                "price": 18.50,
                "description": "Nourishing shampoo with argan oil",
            },
        )
        product2, _ = get_or_create(
            session, Product,
            sku="KT-COND-500",
            defaults={
                "name": "Keratin Conditioner",
                "price": 21.00,
                "description": "Smoothing conditioner with keratin",
            },
        )

        # Bulk products up to 20
        base_products = [
            ("Volumizing Mousse", 16.00),
            ("Sea Salt Spray", 14.50),
            ("Heat Protectant Mist", 17.25),
            ("Curl Defining Cream", 19.99),
            ("Scalp Detox Scrub", 22.00),
            ("Dry Shampoo", 12.75),
            ("Leave-In Conditioner", 18.75),
            ("Hair Repair Mask", 24.50),
            ("Anti-Frizz Serum", 20.00),
            ("Purple Toning Shampoo", 19.00),
            ("Texturizing Spray", 15.50),
            ("Shine Enhancing Oil", 23.00),
            ("Strong Hold Hairspray", 13.99),
            ("Color Protect Conditioner", 21.50),
            ("Tea Tree Shampoo", 17.80),
            ("Aloe Hydrating Conditioner", 18.20),
        ]
        # Ensure up to 20 total products
        existing_products = session.exec(select(Product)).all()
        idx = 1
        for name, price in base_products:
            if len(existing_products) >= 20:
                break
            sku = f"SAL-P-{idx:03d}"
            idx += 1
            prod, created = get_or_create(
                session, Product,
                sku=sku,
                defaults={
                    "name": name,
                    "price": float(price),
                    "description": f"Salon retail: {name}",
                },
            )
            if created:
                existing_products.append(prod)

        # Inventory
        inv1, _ = get_or_create(
            session, Inventory,
            product_id=product1.id,
            defaults={
                "supplier_id": supplier1.id,
                "quantity": 25,
                "min_stock_level": 10,
                "location": "Backroom A",
            },
        )
        inv2, _ = get_or_create(
            session, Inventory,
            product_id=product2.id,
            defaults={
                "supplier_id": supplier2.id,
                "quantity": 18,
                "min_stock_level": 10,
                "location": "Backroom B",
            },
        )

        # Services
        service1, _ = get_or_create(
            session, Service,
            name="Women's Haircut",
            defaults={
                "description": "Wash, cut, and style",
                "price": 55.0,
                "duration_minutes": 60,
            },
        )
        service2, _ = get_or_create(
            session, Service,
            name="Balayage Color",
            defaults={
                "description": "Hand-painted highlights",
                "price": 140.0,
                "duration_minutes": 150,
            },
        )

        # Employees (ensure up to 20)
        hire_base = datetime.utcnow() - timedelta(days=365)
        emp1, _ = get_or_create(
            session, Employee,
            email="ava.turner@salon.example",
            defaults={
                "first_name": "Ava",
                "last_name": "Turner",
                "phone": "+1-555-2001",
                "role": "Stylist",
                "hire_date": hire_base,
                "is_active": True,
            },
        )
        emp2, _ = get_or_create(
            session, Employee,
            email="mia.lopez@salon.example",
            defaults={
                "first_name": "Mia",
                "last_name": "Lopez",
                "phone": "+1-555-2002",
                "role": "Colorist",
                "hire_date": hire_base + timedelta(days=30),
                "is_active": True,
            },
        )
        first_names = ["Olivia","Emma","Charlotte","Amelia","Sophia","Isabella","Ava","Mia","Evelyn","Harper",
                       "Liam","Noah","Oliver","Elijah","Mateo","Lucas","Levi","Leo","Ezra","Luca"]
        last_names = ["Reed","Parker","Diaz","Nguyen","Kim","Patel","Gonzalez","Brown","Wilson","Clark",
                      "Hall","Young","King","Wright","Lopez","Hill","Scott","Green","Adams","Baker"]
        roles = ["Stylist","Colorist","Barber","Receptionist","Manager","Assistant","Makeup Artist","Nail Technician"]
        existing_emps = session.exec(select(Employee)).all()
        i = 0
        while len(existing_emps) < 20 and i < 200:
            i += 1
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}{i}@salon.example"
            emp, created = get_or_create(
                session, Employee,
                email=email,
                defaults={
                    "first_name": fn,
                    "last_name": ln,
                    "phone": f"+1-555-2{random.randint(100,999)}",
                    "role": random.choice(roles),
                    "hire_date": hire_base + timedelta(days=random.randint(0, 360)),
                    "is_active": True,
                },
            )
            if created:
                existing_emps.append(emp)

        # Clients (ensure up to 100)
        client1, _ = get_or_create(
            session, Client,
            name="Sophia Martinez",
            defaults={
                "email": "sophia.martinez@example.com",
                "phone": "+1-555-3001",
                "address": "11 Rose St",
                "notes": "Prefers afternoon appointments",
            },
        )
        client2, _ = get_or_create(
            session, Client,
            name="Emma Johnson",
            defaults={
                "email": "emma.johnson@example.com",
                "phone": "+1-555-3002",
                "address": "22 Oak Ave",
                "notes": "Allergic to sulfates",
            },
        )
        client_firsts = [
            "Sophia","Emma","Olivia","Ava","Isabella","Mia","Charlotte","Amelia","Evelyn","Abigail",
            "Harper","Emily","Elizabeth","Avery","Sofia","Ella","Madison","Scarlett","Victoria","Aria",
            "Liam","Noah","Oliver","Elijah","William","James","Benjamin","Lucas","Henry","Alexander",
            "Mason","Michael","Ethan","Daniel","Jacob","Logan","Jackson","Levi","Sebastian","Mateo"
        ]
        client_lasts = [
            "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
            "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
            "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson"
        ]
        existing_clients = session.exec(select(Client)).all()
        idx = 1
        while len(existing_clients) < 100 and idx <= 500:
            fn = random.choice(client_firsts)
            ln = random.choice(client_lasts)
            name = f"{fn} {ln}"
            email = f"{fn.lower()}.{ln.lower()}{idx}@example.com"
            phone = f"+1-555-{random.randint(3000,3999)}"
            client, created = get_or_create(
                session, Client,
                name=name,
                defaults={
                    "email": email,
                    "phone": phone,
                    "address": f"{random.randint(10,999)} {random.choice(['Oak','Maple','Pine','Cedar','Elm'])} St",
                    "notes": random.choice([
                        "Prefers morning appointments","Sensitive scalp","Loves balayage",
                        "Prefers stylist Ava","Uses sulfate-free products","First-time client"
                    ]),
                },
            )
            if created:
                existing_clients.append(client)
            idx += 1

        # Schedule (appointments this week)
        now = datetime.utcnow()
        next_mon = now - timedelta(days=(now.weekday()))  # Monday this week
        appt1_date = next_mon + timedelta(days=2, hours=10)  # Wed 10:00
        appt2_date = next_mon + timedelta(days=4, hours=14)  # Fri 14:00

        # Always insert two sample appointments (idempotency by approximate uniqueness)
        if not get_one(session, Schedule, [Schedule.client_id == client1.id, Schedule.appointment_date == appt1_date]):
            session.add(Schedule(client_id=client1.id, service_id=service1.id, employee_id=emp1.id, appointment_date=appt1_date, status="scheduled", notes="First visit"))
        if not get_one(session, Schedule, [Schedule.client_id == client2.id, Schedule.appointment_date == appt2_date]):
            session.add(Schedule(client_id=client2.id, service_id=service2.id, employee_id=emp2.id, appointment_date=appt2_date, status="scheduled", notes="Balayage refresh"))
        session.commit()

        # Assets
        asset1, _ = get_or_create(
            session, Asset,
            name="Salon Chair SC-200",
            defaults={
                "asset_type": "Furniture",
                "serial_number": "SC200-001",
                "purchase_price": 450.00,
                "status": "active",
                "assigned_employee_id": emp1.id,
            },
        )
        asset2, _ = get_or_create(
            session, Asset,
            name="Hair Dryer HDX-500",
            defaults={
                "asset_type": "Equipment",
                "serial_number": "HDX500-002",
                "purchase_price": 120.00,
                "status": "active",
                "assigned_employee_id": emp2.id,
            },
        )

        # Attendance (today)
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if not get_one(session, Attendance, [Attendance.employee_id == emp1.id, Attendance.date == today]):
            session.add(Attendance(employee_id=emp1.id, date=today, clock_in=today.replace(hour=9), clock_out=today.replace(hour=17), total_hours=8.0, notes="On time"))
        if not get_one(session, Attendance, [Attendance.employee_id == emp2.id, Attendance.date == today]):
            session.add(Attendance(employee_id=emp2.id, date=today, clock_in=today.replace(hour=10), clock_out=today.replace(hour=18), total_hours=8.0, notes="Color session"))
        session.commit()

        # Documents: create two placeholders tied to client and product
        p1, p2 = ensure_uploads()
        if not get_one(session, Document, [Document.original_filename == os.path.basename(p1)]):
            doc1 = Document(
                filename=os.path.basename(p1),
                original_filename=os.path.basename(p1),
                file_path=p1,
                file_size=os.path.getsize(p1),
                content_type="text/plain",
                entity_type=EntityType.CLIENT,
                entity_id=client1.id,
                description="Welcome note",
            )
            session.add(doc1)
        if not get_one(session, Document, [Document.original_filename == os.path.basename(p2)]):
            doc2 = Document(
                filename=os.path.basename(p2),
                original_filename=os.path.basename(p2),
                file_path=p2,
                file_size=os.path.getsize(p2),
                content_type="text/plain",
                entity_type=EntityType.PRODUCT,
                entity_id=product2.id,
                description="Color chart",
            )
            session.add(doc2)
        session.commit()

        print("Seed completed: ensured >=20 products, >=20 employees, >=100 clients, plus base relations.")


if __name__ == "__main__":
    seed()
