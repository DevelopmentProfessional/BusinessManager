#!/usr/bin/env python3
"""
Data import script for importing clients, services, and appointments from Excel files.
This script can handle the Salon Manager.xlsx file and import data into the database.
"""

import os
import sys
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import uuid

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import engine, get_session
from models import SQLModel, Client, Service, Schedule, Employee, User, UserRole
import bcrypt

def clean_string(value):
    """Clean string value by removing problematic characters"""
    if pd.isna(value):
        return None
    
    try:
        # Convert to string and clean
        cleaned = str(value)
        # Remove or replace problematic characters (like emojis)
        cleaned = cleaned.encode('ascii', 'ignore').decode('ascii')
        return cleaned.strip()
    except:
        return None

def parse_date(date_str):
    """Parse various date formats from Excel"""
    if pd.isna(date_str):
        return None
    
    if isinstance(date_str, datetime):
        return date_str
    
    if isinstance(date_str, str):
        # Try different date formats
        formats = [
            '%m/%d/%Y',
            '%m/%d/%y',
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%d/%m/%y',
            '%m-%d-%Y',
            '%Y/%m/%d'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
    
    return None

def parse_time(time_str):
    """Parse time from Excel"""
    if pd.isna(time_str):
        return None
    
    if isinstance(time_str, datetime):
        return time_str.time()
    
    if isinstance(time_str, str):
        # Try different time formats
        formats = [
            '%H:%M',
            '%H:%M:%S',
            '%I:%M %p',
            '%I:%M:%S %p'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt).time()
            except ValueError:
                continue
    
    return None

def import_clients_from_csv(file_path, session):
    """Import clients from CSV file"""
    print("📋 Importing clients from CSV...")
    
    try:
        # Read CSV file
        df = pd.read_csv(file_path)
        print(f"✅ Found clients in CSV file: {file_path}")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Map common column names based on actual Excel columns
        column_mapping = {
            'name': ['name', 'client name', 'customer name', 'full name', 'client'],
            'email': ['email', 'email address', 'e-mail', 'clientemail'],
            'phone': ['phone', 'phone number', 'telephone', 'mobile', 'cell', 'number'],
            'address': ['address', 'street address', 'location'],
            'notes': ['notes', 'comments', 'description', 'details', 'timestamp']
        }
        
        # Find actual column names
        actual_columns = {}
        for target_col, possible_names in column_mapping.items():
            for col in df.columns:
                if any(name in col for name in possible_names):
                    actual_columns[target_col] = col
                    break
        
        imported_count = 0
        
        for index, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row.get(actual_columns.get('name', 'name'), '')):
                    continue
                
                # Check if client already exists
                existing_client = session.query(Client).filter(
                    Client.name == str(row[actual_columns.get('name', 'name')]).strip()
                ).first()
                
                if existing_client:
                    print(f"⚠️  Client '{row[actual_columns.get('name', 'name')]}' already exists, skipping...")
                    continue
                
                # Collect additional fields for notes
                additional_info = []
                if actual_columns.get('notes') and not pd.isna(row[actual_columns.get('notes', 'notes')]):
                    additional_info.append(f"Original Notes: {row[actual_columns.get('notes', 'notes')]}")
                
                # Add timestamp if available
                if 'timestamp' in df.columns and not pd.isna(row['timestamp']):
                    additional_info.append(f"Import Timestamp: {row['timestamp']}")
                
                # Combine notes
                combined_notes = "; ".join(additional_info) if additional_info else None
                
                # Create new client
                client_data = {
                    'name': clean_string(row[actual_columns.get('name', 'name')]),
                    'email': clean_string(row[actual_columns.get('email', 'email')]) if actual_columns.get('email') else None,
                    'phone': clean_string(row[actual_columns.get('phone', 'phone')]) if actual_columns.get('phone') else None,
                    'address': clean_string(row[actual_columns.get('address', 'address')]) if actual_columns.get('address') else None,
                    'notes': clean_string(combined_notes) if combined_notes else None
                }
                
                # Remove None values
                client_data = {k: v for k, v in client_data.items() if v is not None}
                
                new_client = Client(**client_data)
                session.add(new_client)
                imported_count += 1
                
                print(f"✅ Imported client: {client_data['name']}")
                
            except Exception as e:
                print(f"❌ Error importing client at row {index + 1}: {str(e)}")
                continue
        
        session.commit()
        print(f"🎉 Successfully imported {imported_count} clients")
        return imported_count
        
    except Exception as e:
        print(f"❌ Error reading clients from Excel: {str(e)}")
        session.rollback()
        return 0

def import_services_from_csv(file_path, session):
    """Import services from CSV file"""
    print("🔧 Importing services from CSV...")
    
    try:
        # Read CSV file
        df = pd.read_csv(file_path)
        print(f"✅ Found services in CSV file: {file_path}")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Map common column names based on actual Excel columns
        column_mapping = {
            'name': ['name', 'service name', 'product name', 'service', 'product'],
            'description': ['description', 'desc', 'details', 'notes', 'category', 'type'],
            'price': ['price', 'cost', 'amount', 'rate', 'fee', 'standardprice'],
            'duration': ['duration', 'time', 'length', 'minutes', 'hours']
        }
        
        # Find actual column names
        actual_columns = {}
        print(f"🔍 Available columns: {df.columns.tolist()}")
        for target_col, possible_names in column_mapping.items():
            for col in df.columns:
                if any(name in col for name in possible_names):
                    actual_columns[target_col] = col
                    print(f"✅ Mapped {target_col} -> {col}")
                    break
        print(f"📋 Final mapping: {actual_columns}")
        
        imported_count = 0
        
        for index, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row.get(actual_columns.get('name', 'name'), '')):
                    continue
                
                # Check if service already exists
                existing_service = session.query(Service).filter(
                    Service.name == str(row[actual_columns.get('name', 'name')]).strip()
                ).first()
                
                if existing_service:
                    print(f"⚠️  Service '{row[actual_columns.get('name', 'name')]}' already exists, skipping...")
                    continue
                
                # Parse price
                price = 0.0
                if actual_columns.get('price'):
                    try:
                        price_val = row[actual_columns.get('price', 'price')]
                        if pd.isna(price_val):
                            price = 0.0
                        else:
                            price = float(price_val)
                    except:
                        price = 0.0
                
                # Parse duration
                duration = 60  # default 60 minutes
                if actual_columns.get('duration'):
                    try:
                        duration_val = row[actual_columns.get('duration', 'duration')]
                        if isinstance(duration_val, str):
                            # Handle "1 hour" or "30 min" format
                            if 'hour' in duration_val.lower():
                                duration = int(float(duration_val.split()[0]) * 60)
                            elif 'min' in duration_val.lower():
                                duration = int(float(duration_val.split()[0]))
                            else:
                                duration = int(float(duration_val))
                        else:
                            duration = int(float(duration_val))
                    except:
                        duration = 60
                
                # Collect additional fields for description
                additional_info = []
                if actual_columns.get('description') and not pd.isna(row[actual_columns.get('description', 'description')]):
                    additional_info.append(f"Category: {row[actual_columns.get('description', 'description')]}")
                
                # Add additional service fields if available
                for field in ['type', 'length', 'thickness', 'hours', 'minutes']:
                    if field in df.columns and not pd.isna(row[field]):
                        additional_info.append(f"{field.title()}: {row[field]}")
                
                # Combine description
                combined_description = "; ".join(additional_info) if additional_info else None
                
                # Create new service
                service_data = {
                    'name': clean_string(row[actual_columns.get('name', 'name')]),
                    'description': clean_string(combined_description) if combined_description else None,
                    'price': price,
                    'duration_minutes': duration
                }
                
                # Remove None values
                service_data = {k: v for k, v in service_data.items() if v is not None}
                
                new_service = Service(**service_data)
                session.add(new_service)
                imported_count += 1
                
                print(f"✅ Imported service: {service_data['name']} - ${price:.2f} ({duration} min)")
                
            except Exception as e:
                print(f"❌ Error importing service at row {index + 1}: {str(e)}")
                continue
        
        session.commit()
        print(f"🎉 Successfully imported {imported_count} services")
        return imported_count
        
    except Exception as e:
        print(f"❌ Error reading services from Excel: {str(e)}")
        session.rollback()
        return 0

def import_appointments_from_csv(file_path, session):
    """Import appointments from CSV file"""
    print("📅 Importing appointments from CSV...")
    
    try:
        # Read CSV file
        df = pd.read_csv(file_path)
        print(f"✅ Found appointments in CSV file: {file_path}")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Map common column names based on actual Excel columns
        column_mapping = {
            'client': ['client', 'client name', 'customer', 'customer name'],
            'service': ['service', 'service name', 'product', 'product name'],
            'employee': ['employee', 'staff', 'stylist', 'technician'],
            'date': ['date', 'appointment date', 'booking date', 'appointmentdate'],
            'time': ['time', 'appointment time', 'start time', 'time slot', 'appointmenttime', 'appointmentendtime'],
            'notes': ['notes', 'comments', 'description', 'timestamp', 'category', 'type', 'length', 'thickness', 'priceadjustment', 'paid', 'canceled', 'walkin', 'year', 'month', 'monthname', 'day', 'dayname', 'weeknum', 'daynametext']
        }
        
        # Find actual column names
        actual_columns = {}
        for target_col, possible_names in column_mapping.items():
            for col in df.columns:
                if any(name in col for name in possible_names):
                    actual_columns[target_col] = col
                    break
        
        imported_count = 0
        
        for index, row in df.iterrows():
            try:
                # Skip empty rows
                if pd.isna(row.get(actual_columns.get('client', 'client'), '')):
                    continue
                
                # Find client
                client_name = clean_string(row[actual_columns.get('client', 'client')])
                client = session.query(Client).filter(Client.name == client_name).first()
                
                if not client:
                    print(f"⚠️  Client '{client_name}' not found, skipping appointment...")
                    continue
                
                # Find service
                service_name = clean_string(row[actual_columns.get('service', 'service')])
                service = session.query(Service).filter(Service.name == service_name).first()
                
                if not service:
                    print(f"⚠️  Service '{service_name}' not found, skipping appointment...")
                    continue
                
                # Find Tameshia Pinto (username: tpin) as the employee for all appointments
                employee = None
                
                # First try to find by username in the User table
                user = session.query(User).filter(User.username == 'tpin').first()
                if user and user.employee:
                    employee = user.employee
                    print(f"✅ Found Tameshia Pinto (tpin) - {employee.first_name} {employee.last_name}")
                else:
                    # Fallback: try to find by name
                    employee = session.query(Employee).filter(
                        (Employee.first_name == 'Tameshia') & (Employee.last_name == 'Pinto')
                    ).first()
                    
                    if not employee:
                        # Last resort: use first available employee
                        employee = session.query(Employee).first()
                        if not employee:
                            print(f"⚠️  No employees found, skipping appointment...")
                            continue
                        else:
                            print(f"⚠️  Tameshia Pinto not found, using first available employee: {employee.first_name} {employee.last_name}")
                    else:
                        print(f"✅ Found Tameshia Pinto by name - {employee.first_name} {employee.last_name}")
                
                # Parse date and time
                appointment_date = None
                if actual_columns.get('date'):
                    date_val = parse_date(row[actual_columns.get('date', 'date')])
                    if date_val:
                        if actual_columns.get('time'):
                            time_val = parse_time(row[actual_columns.get('time', 'time')])
                            if time_val:
                                appointment_date = datetime.combine(date_val.date(), time_val)
                            else:
                                appointment_date = date_val
                        else:
                            appointment_date = date_val
                
                if not appointment_date:
                    print(f"⚠️  Could not parse date/time for appointment, skipping...")
                    continue
                
                # Check if appointment already exists
                existing_appointment = session.query(Schedule).filter(
                    Schedule.client_id == client.id,
                    Schedule.service_id == service.id,
                    Schedule.employee_id == employee.id,
                    Schedule.appointment_date == appointment_date
                ).first()
                
                if existing_appointment:
                    print(f"⚠️  Appointment already exists for {client_name} on {appointment_date}, skipping...")
                    continue
                
                # Collect additional fields for notes
                additional_info = []
                if actual_columns.get('notes') and not pd.isna(row[actual_columns.get('notes', 'notes')]):
                    additional_info.append(f"Original Notes: {row[actual_columns.get('notes', 'notes')]}")
                
                # Add additional appointment fields if available
                for field in ['timestamp', 'category', 'type', 'length', 'thickness', 'priceadjustment', 'paid', 'canceled', 'walkin', 'year', 'month', 'monthname', 'day', 'dayname', 'weeknum', 'daynametext', 'appointmentendtime']:
                    if field in df.columns and not pd.isna(row[field]):
                        additional_info.append(f"{field.title()}: {row[field]}")
                
                # Combine notes
                combined_notes = "; ".join(additional_info) if additional_info else None
                
                # Create new appointment
                appointment_data = {
                    'client_id': client.id,
                    'service_id': service.id,
                    'employee_id': employee.id,
                    'appointment_date': appointment_date,
                    'status': 'scheduled',
                    'notes': clean_string(combined_notes) if combined_notes else None
                }
                
                # Remove None values
                appointment_data = {k: v for k, v in appointment_data.items() if v is not None}
                
                new_appointment = Schedule(**appointment_data)
                session.add(new_appointment)
                imported_count += 1
                
                print(f"✅ Imported appointment: {client_name} - {service_name} with Tameshia Pinto on {appointment_date}")
                
            except Exception as e:
                print(f"❌ Error importing appointment at row {index + 1}: {str(e)}")
                continue
        
        session.commit()
        print(f"🎉 Successfully imported {imported_count} appointments")
        return imported_count
        
    except Exception as e:
        print(f"❌ Error reading appointments from Excel: {str(e)}")
        session.rollback()
        return 0

def ensure_tameshia_pinto_exists(session):
    """Ensure Tameshia Pinto exists as an employee and user"""
    print("🔍 Checking for Tameshia Pinto...")
    
    # Check if user exists
    user = session.query(User).filter(User.username == 'tpin').first()
    if user:
        print(f"✅ User 'tpin' already exists")
        if user.employee:
            print(f"✅ Tameshia Pinto employee record already exists")
            return user.employee
        else:
            print("⚠️  User exists but no employee record, creating employee record...")
    else:
        print("⚠️  User 'tpin' not found, creating user and employee records...")
    
    # Create employee record
    from datetime import datetime
    employee = Employee(
        first_name="Tameshia",
        last_name="Pinto",
        email="tameshia@example.com",  # You can update this
        phone=None,
        role="stylist",
        hire_date=datetime.now(),
        is_active=True
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    
    # Create user record if it doesn't exist
    if not user:
        import bcrypt
        password_hash = User.hash_password("password123")  # You can change this default password
        user = User(
            username="tpin",
            email="tameshia@example.com",  # You can update this
            password_hash=password_hash,
            first_name="Tameshia",
            last_name="Pinto",
            role=UserRole.EMPLOYEE
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # Link user to employee
    employee.user_id = user.id
    session.add(employee)
    session.commit()
    session.refresh(employee)
    
    print(f"✅ Created Tameshia Pinto - User ID: {user.id}, Employee ID: {employee.id}")
    return employee

def import_data_from_csv_files(clients_file="clients.csv", services_file="services.csv", appointments_file="appointments.csv"):
    """Main function to import all data from separate CSV files"""
    print(f"🚀 Starting data import from CSV files:")
    print(f"   📋 Clients: {clients_file}")
    print(f"   🔧 Services: {services_file}")
    print(f"   📅 Appointments: {appointments_file}")
    
    # Check if files exist
    missing_files = []
    for file_path in [clients_file, services_file, appointments_file]:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return
    
    # Create database tables
    SQLModel.metadata.create_all(engine)
    
    # Get a session
    session = next(get_session())
    
    try:
        # Ensure Tameshia Pinto exists before importing data
        ensure_tameshia_pinto_exists(session)
        
        # Import data in order (clients and services first, then appointments)
        clients_count = import_clients_from_csv(clients_file, session)
        services_count = import_services_from_csv(services_file, session)
        appointments_count = import_appointments_from_csv(appointments_file, session)
        
        print("\n" + "="*50)
        print("📊 IMPORT SUMMARY")
        print("="*50)
        print(f"✅ Clients imported: {clients_count}")
        print(f"✅ Services imported: {services_count}")
        print(f"✅ Appointments imported: {appointments_count}")
        print(f"✅ Total records imported: {clients_count + services_count + appointments_count}")
        print("="*50)
        
    except Exception as e:
        print(f"❌ Error during import: {str(e)}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    # Default CSV files in the current directory
    clients_file = "clients.csv"
    services_file = "services.csv"
    appointments_file = "appointments.csv"
    
    # Allow command line arguments to override default files
    if len(sys.argv) > 1:
        clients_file = sys.argv[1]
    if len(sys.argv) > 2:
        services_file = sys.argv[2]
    if len(sys.argv) > 3:
        appointments_file = sys.argv[3]
    
    import_data_from_csv_files(clients_file, services_file, appointments_file)
