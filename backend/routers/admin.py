from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List
import os
import tempfile
from pathlib import Path

from backend.database import get_session
from backend.models import User, UserRole, Client, Service, Schedule
from backend.routers.auth import get_current_user

router = APIRouter()

@router.post("/import-data")
async def import_data_from_csv(
    clients_file: UploadFile = File(None),
    services_file: UploadFile = File(None),
    appointments_file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Import data from CSV files (admin only)"""
    
    # Check if user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if at least one file is provided
    if not any([clients_file, services_file, appointments_file]):
        raise HTTPException(status_code=400, detail="At least one CSV file must be provided")
    
    # Check file types
    for file, file_type in [(clients_file, "clients"), (services_file, "services"), (appointments_file, "appointments")]:
        if file and not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail=f"{file_type} file must be a CSV file")
    
    try:
        temp_files = []
        
        # Save uploaded files temporarily
        if clients_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
                content = await clients_file.read()
                tmp_file.write(content)
                temp_files.append(tmp_file.name)
                clients_file_path = tmp_file.name
        else:
            clients_file_path = None
            
        if services_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
                content = await services_file.read()
                tmp_file.write(content)
                temp_files.append(tmp_file.name)
                services_file_path = tmp_file.name
        else:
            services_file_path = None
            
        if appointments_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
                content = await appointments_file.read()
                tmp_file.write(content)
                temp_files.append(tmp_file.name)
                appointments_file_path = tmp_file.name
        else:
            appointments_file_path = None
        
        # Import the data (disabled - import tool removed)
        raise HTTPException(status_code=501, detail="CSV import disabled in this build")
        
        # Clean up temporary files
        for tmp_file in temp_files:
            if os.path.exists(tmp_file):
                os.unlink(tmp_file)
        
        return {"message": "Data import completed successfully"}
        
    except Exception as e:
        # Clean up temporary files on error
        for tmp_file in temp_files:
            if os.path.exists(tmp_file):
                os.unlink(tmp_file)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.get("/system-info")
async def get_system_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get system information (admin only)"""
    
    # Check if user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get counts
        client_count = len(session.exec(select(Client)).all())
        service_count = len(session.exec(select(Service)).all())
        schedule_count = len(session.exec(select(Schedule)).all())
        employee_count = len(session.exec(select(User).where(User.role != UserRole.ADMIN)).all())

        return {
            "clients": client_count,
            "services": service_count,
            "appointments": schedule_count,
            "employees": employee_count,
            "total_records": client_count + service_count + schedule_count + employee_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system info: {str(e)}")

@router.get("/test-appointments")
async def test_appointments(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Test endpoint to verify appointments are properly loaded (admin only)"""
    
    # Check if user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get sample data
        clients = session.exec(select(Client)).all()
        services = session.exec(select(Service)).all()
        appointments = session.exec(select(Schedule)).all()
        employees = session.exec(select(User).where(User.role != UserRole.ADMIN)).all()

        # Create a sample response with appointment details
        sample_appointments = []
        for apt in appointments[:5]:  # Show first 5 appointments
            client = next((c for c in clients if c.id == apt.client_id), None)
            service = next((s for s in services if s.id == apt.service_id), None)
            employee = next((e for e in employees if e.id == apt.employee_id), None)

            sample_appointments.append({
                "id": str(apt.id),
                "appointment_date": apt.appointment_date.isoformat() if apt.appointment_date else None,
                "status": apt.status,
                "client_name": client.name if client else "Unknown",
                "service_name": service.name if service else "Unknown",
                "employee_name": f"{employee.first_name} {employee.last_name}" if employee else "Unknown",
                "notes": apt.notes
            })

        return {
            "total_appointments": len(appointments),
            "total_clients": len(clients),
            "total_services": len(services),
            "total_employees": len(employees),
            "sample_appointments": sample_appointments
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test appointments: {str(e)}")
