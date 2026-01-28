#!/usr/bin/env python3
"""
Seed database with realistic data for a candle/soap/body care business.

Populates:
- Users/Employees (admin, manager, employees)
- Clients
- Services (candle making, soap making, consultations, etc.)
- Suppliers
- Items/Inventory (candles, soaps, shampoos, conditioners, body oils, creams, raw materials)
- Schedules (appointments linking clients, services, employees)
- Attendance (employee clock-in/out records)
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from uuid import uuid4
import random

# Add backend to path
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.database import get_session, create_db_and_tables
from backend.models import (
    User, UserRole, Client, Service, Supplier, Item, ItemType,
    Inventory, Schedule, Attendance
)
import bcrypt

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def seed_users():
    """Create employees with different roles"""
    users_data = [
        {
            "username": "admin",
            "email": "admin@lavishscents.com",
            "password": "admin123",
            "first_name": "Sarah",
            "last_name": "Johnson",
            "phone": "555-0100",
            "role": UserRole.ADMIN
        },
        {
            "username": "manager1",
            "email": "manager@lavishscents.com",
            "password": "manager123",
            "first_name": "Michael",
            "last_name": "Chen",
            "phone": "555-0101",
            "role": UserRole.MANAGER
        },
        {
            "username": "emily.davis",
            "email": "emily.davis@lavishscents.com",
            "password": "employee123",
            "first_name": "Emily",
            "last_name": "Davis",
            "phone": "555-0102",
            "role": UserRole.EMPLOYEE
        },
        {
            "username": "james.wilson",
            "email": "james.wilson@lavishscents.com",
            "password": "employee123",
            "first_name": "James",
            "last_name": "Wilson",
            "phone": "555-0103",
            "role": UserRole.EMPLOYEE
        },
        {
            "username": "maria.garcia",
            "email": "maria.garcia@lavishscents.com",
            "password": "employee123",
            "first_name": "Maria",
            "last_name": "Garcia",
            "phone": "555-0104",
            "role": UserRole.EMPLOYEE
        }
    ]
    
    users = []
    for data in users_data:
        user = User(
            id=uuid4(),
            username=data["username"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            first_name=data["first_name"],
            last_name=data["last_name"],
            phone=data["phone"],
            role=data["role"],
            hire_date=datetime.utcnow() - timedelta(days=random.randint(30, 730)),
            is_active=True,
            created_at=datetime.utcnow()
        )
        users.append(user)
    
    return users

def seed_clients():
    """Create client records"""
    clients_data = [
        {"name": "Olivia Martinez", "email": "olivia.m@email.com", "phone": "555-1001", "address": "123 Maple St, Springfield"},
        {"name": "Ethan Brown", "email": "ethan.brown@email.com", "phone": "555-1002", "address": "456 Oak Ave, Springfield"},
        {"name": "Sophia Taylor", "email": "sophia.t@email.com", "phone": "555-1003", "address": "789 Pine Rd, Springfield"},
        {"name": "Liam Anderson", "email": "liam.anderson@email.com", "phone": "555-1004", "address": "321 Elm St, Springfield"},
        {"name": "Ava Thomas", "email": "ava.thomas@email.com", "phone": "555-1005", "address": "654 Birch Ln, Springfield"},
        {"name": "Noah Jackson", "email": "noah.j@email.com", "phone": "555-1006", "address": "987 Cedar Dr, Springfield"},
        {"name": "Isabella White", "email": "isabella.white@email.com", "phone": "555-1007", "address": "147 Willow Way, Springfield"},
        {"name": "Mason Harris", "email": "mason.h@email.com", "phone": "555-1008", "address": "258 Spruce Ct, Springfield"},
        {"name": "Mia Clark", "email": "mia.clark@email.com", "phone": "555-1009", "address": "369 Ash Blvd, Springfield"},
        {"name": "Lucas Lewis", "email": "lucas.lewis@email.com", "phone": "555-1010", "address": "741 Poplar St, Springfield"}
    ]
    
    clients = []
    for data in clients_data:
        client = Client(
            id=uuid4(),
            name=data["name"],
            email=data["email"],
            phone=data["phone"],
            address=data["address"],
            notes=f"Regular customer, prefers natural products",
            created_at=datetime.utcnow() - timedelta(days=random.randint(10, 365))
        )
        clients.append(client)
    
    return clients

def seed_services():
    """Create service offerings"""
    services_data = [
        {"name": "Custom Candle Making Workshop", "description": "2-hour hands-on candle making class", "category": "Workshop", "price": 75.00, "duration": 120},
        {"name": "Soap Making Class", "description": "Learn to make natural soaps", "category": "Workshop", "price": 65.00, "duration": 90},
        {"name": "Product Consultation", "description": "Personalized product recommendations", "category": "Consultation", "price": 30.00, "duration": 30},
        {"name": "Custom Scent Blending", "description": "Create your signature scent", "category": "Custom", "price": 50.00, "duration": 45},
        {"name": "Body Care Package Design", "description": "Custom gift package creation", "category": "Custom", "price": 40.00, "duration": 30},
        {"name": "Wholesale Consultation", "description": "Business wholesale inquiry meeting", "category": "Business", "price": 100.00, "duration": 60},
        {"name": "Private Event Workshop", "description": "Private group candle/soap making", "category": "Event", "price": 250.00, "duration": 180}
    ]
    
    services = []
    for data in services_data:
        service = Service(
            id=uuid4(),
            name=data["name"],
            description=data["description"],
            category=data["category"],
            price=data["price"],
            duration_minutes=data["duration"],
            created_at=datetime.utcnow()
        )
        services.append(service)
    
    return services

def seed_suppliers():
    """Create supplier records"""
    suppliers_data = [
        {"name": "Natural Wax Co.", "contact": "John Smith", "email": "sales@naturalwax.com", "phone": "555-2001", "address": "100 Industrial Pkwy, Portland"},
        {"name": "Essential Oils Direct", "contact": "Lisa Wong", "email": "orders@essentialoils.com", "phone": "555-2002", "address": "200 Aroma Lane, Seattle"},
        {"name": "Fragrance Wholesale Inc", "contact": "David Lee", "email": "info@fragrancewholesale.com", "phone": "555-2003", "address": "300 Scent Blvd, Los Angeles"},
        {"name": "Organic Botanicals Supply", "contact": "Emma Rodriguez", "email": "sales@organicbotanicals.com", "phone": "555-2004", "address": "400 Herb St, Denver"},
        {"name": "Container & Packaging Pro", "contact": "Robert Kim", "email": "orders@containerpackaging.com", "phone": "555-2005", "address": "500 Box Ave, Chicago"},
        {"name": "Soap Base Suppliers", "contact": "Jennifer Taylor", "email": "info@soapbase.com", "phone": "555-2006", "address": "600 Lye Road, Austin"}
    ]
    
    suppliers = []
    for data in suppliers_data:
        supplier = Supplier(
            id=uuid4(),
            name=data["name"],
            contact_person=data["contact"],
            email=data["email"],
            phone=data["phone"],
            address=data["address"],
            created_at=datetime.utcnow()
        )
        suppliers.append(supplier)
    
    return suppliers

def seed_items_and_inventory(suppliers):
    """Create items (finished products and raw materials) with inventory"""
    items_data = [
        # Finished Products - Candles
        {"name": "Lavender Dreams Candle", "sku": "CAN-LAV-001", "price": 24.99, "description": "8oz soy candle with lavender essential oil", "type": ItemType.ITEM, "quantity": 45, "min_stock": 15},
        {"name": "Vanilla Bliss Candle", "sku": "CAN-VAN-002", "price": 24.99, "description": "8oz soy candle with vanilla fragrance", "type": ItemType.ITEM, "quantity": 38, "min_stock": 15},
        {"name": "Eucalyptus Mint Candle", "sku": "CAN-EUC-003", "price": 26.99, "description": "8oz soy candle with eucalyptus and mint", "type": ItemType.ITEM, "quantity": 32, "min_stock": 10},
        {"name": "Citrus Sunrise Candle", "sku": "CAN-CIT-004", "price": 24.99, "description": "8oz soy candle with citrus blend", "type": ItemType.ITEM, "quantity": 28, "min_stock": 10},
        
        # Finished Products - Soaps
        {"name": "Honey Oat Soap Bar", "sku": "SOAP-HON-001", "price": 8.99, "description": "Natural soap with honey and oatmeal", "type": ItemType.ITEM, "quantity": 120, "min_stock": 30},
        {"name": "Charcoal Detox Soap", "sku": "SOAP-CHA-002", "price": 9.99, "description": "Activated charcoal cleansing bar", "type": ItemType.ITEM, "quantity": 95, "min_stock": 25},
        {"name": "Rose Clay Soap", "sku": "SOAP-ROS-003", "price": 10.99, "description": "Gentle rose clay facial soap", "type": ItemType.ITEM, "quantity": 78, "min_stock": 20},
        {"name": "Tea Tree Mint Soap", "sku": "SOAP-TEA-004", "price": 9.99, "description": "Refreshing tea tree and mint soap", "type": ItemType.ITEM, "quantity": 88, "min_stock": 25},
        
        # Finished Products - Shampoos & Conditioners
        {"name": "Argan Oil Shampoo", "sku": "SHAM-ARG-001", "price": 16.99, "description": "8oz natural argan oil shampoo", "type": ItemType.ITEM, "quantity": 52, "min_stock": 15},
        {"name": "Coconut Milk Conditioner", "sku": "COND-COC-001", "price": 16.99, "description": "8oz coconut milk conditioner", "type": ItemType.ITEM, "quantity": 48, "min_stock": 15},
        {"name": "Rosemary Mint Shampoo", "sku": "SHAM-ROS-002", "price": 16.99, "description": "8oz rosemary mint shampoo", "type": ItemType.ITEM, "quantity": 41, "min_stock": 12},
        
        # Finished Products - Body Oils & Creams
        {"name": "Lavender Body Oil", "sku": "OIL-LAV-001", "price": 18.99, "description": "4oz lavender infused body oil", "type": ItemType.ITEM, "quantity": 35, "min_stock": 10},
        {"name": "Rose Hip Body Oil", "sku": "OIL-ROS-001", "price": 22.99, "description": "4oz rose hip seed oil blend", "type": ItemType.ITEM, "quantity": 28, "min_stock": 8},
        {"name": "Shea Butter Body Cream", "sku": "CRM-SHE-001", "price": 19.99, "description": "8oz whipped shea butter cream", "type": ItemType.ITEM, "quantity": 44, "min_stock": 12},
        {"name": "Cocoa Butter Body Cream", "sku": "CRM-COC-001", "price": 19.99, "description": "8oz cocoa butter body cream", "type": ItemType.ITEM, "quantity": 38, "min_stock": 12},
        
        # Raw Materials
        {"name": "Soy Wax Flakes (Bulk)", "sku": "RAW-WAX-001", "price": 45.00, "description": "10lb bag of natural soy wax", "type": ItemType.ASSET, "quantity": 15, "min_stock": 5},
        {"name": "Beeswax Blocks", "sku": "RAW-WAX-002", "price": 35.00, "description": "5lb block of pure beeswax", "type": ItemType.ASSET, "quantity": 8, "min_stock": 3},
        {"name": "Coconut Oil (Virgin)", "sku": "RAW-OIL-001", "price": 28.00, "description": "1 gallon virgin coconut oil", "type": ItemType.ASSET, "quantity": 12, "min_stock": 4},
        {"name": "Shea Butter (Unrefined)", "sku": "RAW-BUT-001", "price": 32.00, "description": "5lb unrefined shea butter", "type": ItemType.ASSET, "quantity": 10, "min_stock": 3},
        {"name": "Essential Oil - Lavender", "sku": "RAW-EO-LAV", "price": 24.00, "description": "4oz pure lavender essential oil", "type": ItemType.ASSET, "quantity": 18, "min_stock": 6},
        {"name": "Essential Oil - Peppermint", "sku": "RAW-EO-PEP", "price": 18.00, "description": "4oz pure peppermint essential oil", "type": ItemType.ASSET, "quantity": 15, "min_stock": 5},
        {"name": "Fragrance Oil - Vanilla", "sku": "RAW-FO-VAN", "price": 12.00, "description": "4oz vanilla fragrance oil", "type": ItemType.ASSET, "quantity": 22, "min_stock": 8},
        {"name": "Candle Wicks (100ct)", "sku": "RAW-WCK-001", "price": 15.00, "description": "100 cotton candle wicks", "type": ItemType.ASSET, "quantity": 8, "min_stock": 3},
        {"name": "Glass Jars 8oz (24ct)", "sku": "RAW-JAR-001", "price": 36.00, "description": "24 pack of 8oz glass jars", "type": ItemType.ASSET, "quantity": 6, "min_stock": 2},
        {"name": "Soap Molds (Silicone)", "sku": "RAW-MLD-001", "price": 22.00, "description": "Professional soap mold set", "type": ItemType.ASSET, "quantity": 5, "min_stock": 2}
    ]
    
    items = []
    inventories = []
    
    for data in items_data:
        item = Item(
            id=uuid4(),
            name=data["name"],
            sku=data["sku"],
            price=data["price"],
            description=data["description"],
            created_at=datetime.utcnow()
        )
        items.append(item)
        
        # Create inventory record for each item
        # Assign supplier based on item type
        supplier = None
        if "wax" in data["name"].lower():
            supplier = suppliers[0]  # Natural Wax Co.
        elif "oil" in data["name"].lower() and data["type"] == ItemType.ASSET:
            supplier = suppliers[1]  # Essential Oils Direct
        elif "fragrance" in data["name"].lower():
            supplier = suppliers[2]  # Fragrance Wholesale
        elif "butter" in data["name"].lower() and data["type"] == ItemType.ASSET:
            supplier = suppliers[3]  # Organic Botanicals
        elif "jar" in data["name"].lower() or "mold" in data["name"].lower():
            supplier = suppliers[4]  # Container & Packaging
        elif "soap" in data["name"].lower() and data["type"] == ItemType.ASSET:
            supplier = suppliers[5]  # Soap Base Suppliers
        else:
            supplier = random.choice(suppliers[:3])
        
        inventory = Inventory(
            id=uuid4(),
            item_id=item.id,
            supplier_id=supplier.id if supplier else None,
            quantity=data["quantity"],
            min_stock_level=data["min_stock"],
            location="Main Warehouse",
            created_at=datetime.utcnow()
        )
        inventories.append(inventory)
    
    return items, inventories

def seed_schedules(clients, services, employees):
    """Create appointment schedules"""
    schedules = []
    
    # Create appointments for the past 30 days and next 30 days
    start_date = datetime.utcnow() - timedelta(days=30)
    
    for day_offset in range(60):
        appointment_date = start_date + timedelta(days=day_offset)
        
        # Skip weekends
        if appointment_date.weekday() >= 5:
            continue
        
        # Create 2-4 appointments per day
        num_appointments = random.randint(2, 4)
        
        for _ in range(num_appointments):
            client = random.choice(clients)
            service = random.choice(services)
            employee = random.choice(employees)
            
            # Random time between 9 AM and 5 PM
            hour = random.randint(9, 16)
            minute = random.choice([0, 30])
            
            appointment_datetime = appointment_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Determine status based on date
            if appointment_datetime < datetime.utcnow():
                status = random.choice(["completed", "completed", "completed", "cancelled"])
            else:
                status = "scheduled"
            
            schedule = Schedule(
                id=uuid4(),
                client_id=client.id,
                service_id=service.id,
                employee_id=employee.id,
                appointment_date=appointment_datetime,
                status=status,
                notes=f"Appointment for {service.name}",
                created_at=datetime.utcnow()
            )
            schedules.append(schedule)
    
    return schedules

def seed_attendance(employees):
    """Create attendance records for employees"""
    attendance_records = []
    
    # Create attendance for the past 60 days
    start_date = datetime.utcnow() - timedelta(days=60)
    
    for employee in employees:
        # Skip admin for attendance (they don't clock in/out)
        if employee.role == UserRole.ADMIN:
            continue
        
        for day_offset in range(60):
            attendance_date = start_date + timedelta(days=day_offset)
            
            # Skip weekends
            if attendance_date.weekday() >= 5:
                continue
            
            # 90% attendance rate (some days off)
            if random.random() > 0.9:
                continue
            
            # Clock in between 8:30 AM and 9:15 AM
            clock_in_hour = random.choice([8, 9])
            clock_in_minute = random.randint(0, 59) if clock_in_hour == 8 else random.randint(0, 15)
            clock_in = attendance_date.replace(hour=clock_in_hour, minute=clock_in_minute, second=0, microsecond=0)
            
            # Clock out between 4:45 PM and 5:30 PM (if not today or future)
            clock_out = None
            total_hours = None
            
            if attendance_date.date() < datetime.utcnow().date():
                clock_out_hour = random.choice([16, 17])
                clock_out_minute = random.randint(45, 59) if clock_out_hour == 16 else random.randint(0, 30)
                clock_out = attendance_date.replace(hour=clock_out_hour, minute=clock_out_minute, second=0, microsecond=0)
                
                # Calculate total hours
                time_diff = clock_out - clock_in
                total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            attendance = Attendance(
                id=uuid4(),
                user_id=employee.id,
                date=attendance_date,
                clock_in=clock_in,
                clock_out=clock_out,
                total_hours=total_hours,
                notes="Regular shift",
                created_at=datetime.utcnow()
            )
            attendance_records.append(attendance)
    
    return attendance_records

def main():
    """Main seeding function"""
    print("🌱 Starting database seeding for Lavish Scents business...")
    
    # Ensure database tables exist
    create_db_and_tables()
    print("✅ Database tables verified")
    
    session = next(get_session())
    
    try:
        # Check if data already exists
        from sqlmodel import select
        existing_users = session.exec(select(User)).all()
        if len(existing_users) > 1:  # More than just admin
            print("⚠️  Database already contains data. Skipping seed.")
            print(f"   Found {len(existing_users)} users")
            response = input("   Do you want to clear and reseed? (yes/no): ")
            if response.lower() != "yes":
                print("❌ Seeding cancelled")
                return
            
            # Clear existing data (in reverse order of dependencies)
            print("🗑️  Clearing existing data...")
            session.exec(select(Attendance)).all()
            for record in session.exec(select(Attendance)).all():
                session.delete(record)
            for record in session.exec(select(Schedule)).all():
                session.delete(record)
            for record in session.exec(select(Inventory)).all():
                session.delete(record)
            for record in session.exec(select(Item)).all():
                session.delete(record)
            for record in session.exec(select(Supplier)).all():
                session.delete(record)
            for record in session.exec(select(Service)).all():
                session.delete(record)
            for record in session.exec(select(Client)).all():
                session.delete(record)
            # Keep admin user, delete others
            for user in existing_users:
                if user.username != "admin":
                    session.delete(user)
            session.commit()
            print("✅ Existing data cleared")
        
        # Seed data
        print("\n👥 Creating users/employees...")
        users = seed_users()
        for user in users:
            # Check if user already exists
            existing = session.exec(select(User).where(User.username == user.username)).first()
            if not existing:
                session.add(user)
        session.commit()
        print(f"✅ Created {len(users)} users")
        
        # Refresh users to get IDs
        employees = session.exec(select(User)).all()
        employee_list = [u for u in employees if u.role in [UserRole.EMPLOYEE, UserRole.MANAGER]]
        
        print("\n👤 Creating clients...")
        clients = seed_clients()
        for client in clients:
            session.add(client)
        session.commit()
        print(f"✅ Created {len(clients)} clients")
        
        print("\n🛠️  Creating services...")
        services = seed_services()
        for service in services:
            session.add(service)
        session.commit()
        print(f"✅ Created {len(services)} services")
        
        print("\n🏭 Creating suppliers...")
        suppliers = seed_suppliers()
        for supplier in suppliers:
            session.add(supplier)
        session.commit()
        print(f"✅ Created {len(suppliers)} suppliers")
        
        print("\n📦 Creating items and inventory...")
        items, inventories = seed_items_and_inventory(suppliers)
        for item in items:
            session.add(item)
        session.commit()
        for inventory in inventories:
            session.add(inventory)
        session.commit()
        print(f"✅ Created {len(items)} items with inventory records")
        
        print("\n📅 Creating schedules...")
        schedules = seed_schedules(clients, services, employee_list)
        for schedule in schedules:
            session.add(schedule)
        session.commit()
        print(f"✅ Created {len(schedules)} appointment schedules")
        
        print("\n⏰ Creating attendance records...")
        attendance_records = seed_attendance(employee_list)
        for attendance in attendance_records:
            session.add(attendance)
        session.commit()
        print(f"✅ Created {len(attendance_records)} attendance records")
        
        # Summary
        print("\n" + "="*60)
        print("🎉 Database seeding completed successfully!")
        print("="*60)
        print(f"📊 Summary:")
        print(f"   - Users/Employees: {len(employees)}")
        print(f"   - Clients: {len(clients)}")
        print(f"   - Services: {len(services)}")
        print(f"   - Suppliers: {len(suppliers)}")
        print(f"   - Items: {len(items)}")
        print(f"   - Inventory Records: {len(inventories)}")
        print(f"   - Schedules: {len(schedules)}")
        print(f"   - Attendance Records: {len(attendance_records)}")
        print("\n🔐 Login Credentials:")
        print("   Admin: admin / admin123")
        print("   Manager: manager1 / manager123")
        print("   Employee: emily.davis / employee123")
        print("="*60)
        
        session.close()
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {str(e)}")
        import traceback
        traceback.print_exc()
        session.rollback()
        session.close()
        raise

if __name__ == "__main__":
    main()
