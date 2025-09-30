from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Schedule, ScheduleCreate, ScheduleRead, User, UserRole, UserPermission
from routers.auth import get_current_user, get_user_permissions_list

router = APIRouter()

@router.get("/schedule", response_model=List[ScheduleRead])
async def get_schedule(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get appointments based on user permissions"""
    try:
        # Get user permissions
        permissions = get_user_permissions_list(current_user, session)
        
        # Admin users can see all appointments
        if current_user.role == UserRole.ADMIN or any(perm.startswith("schedule:admin") for perm in permissions):
            appointments = session.exec(select(Schedule)).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # Check if user has view_all permission
        if any(perm.startswith("schedule:view_all") for perm in permissions):
            appointments = session.exec(select(Schedule)).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # Check if user has basic schedule read permission (read or read_all)
        if any(perm.startswith("schedule:read") for perm in permissions) or any(perm.startswith("schedule:read_all") for perm in permissions):
            # Only show appointments for the current user
            appointments = session.exec(
                select(Schedule).where(Schedule.employee_id == current_user.id)
            ).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # No permissions - return empty list
        return []
        
    except Exception as e:
        print(f"Schedule endpoint error: {e}")
        import traceback
        traceback.print_exc()
        # Return empty list on error to prevent 500
        return []

@router.get("/schedule/employee/{employee_id}", response_model=List[ScheduleRead])
async def get_employee_schedule(
    employee_id: UUID, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get schedule for a specific employee (requires view_all permission)"""
    # Get user permissions
    permissions = get_user_permissions_list(current_user, session)
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and not any(perm.startswith("schedule:view_all") for perm in permissions):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    statement = select(Schedule).where(Schedule.employee_id == employee_id)
    appointments = session.exec(statement).all()
    return appointments

@router.get("/schedule/employees", response_model=List[dict])
async def get_available_employees(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get list of employees available for scheduling based on user permissions"""
    # Get user permissions
    permissions = get_user_permissions_list(current_user, session)
    
    # Check permissions for employee dropdown access
    has_write_all = any(perm == "schedule:write_all" for perm in permissions)
    has_view_all = any(perm == "schedule:view_all" for perm in permissions) 
    has_admin = any(perm == "schedule:admin" for perm in permissions)
    is_admin = current_user.role == UserRole.ADMIN
    
    # Admin or users with write_all/view_all/admin permissions can see all employees
    if is_admin or has_write_all or has_view_all or has_admin:
        users = session.exec(select(User)).all()
        return [
            {
                "id": str(user.id),
                "name": f"{user.first_name} {user.last_name}",
                "is_active": user.is_active
            }
            for user in users if user.is_active
        ]
    else:
        # Users with only basic write permission can only see themselves
        return [
            {
                "id": str(current_user.id),
                "name": f"{current_user.first_name} {current_user.last_name}",
                "is_active": current_user.is_active
            }
        ]

@router.post("/schedule", response_model=ScheduleRead)
async def create_appointment(
    appointment_data: ScheduleCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new appointment"""
    # Get user permissions
    permissions = get_user_permissions_list(current_user, session)
    
    # Check permissions
    has_write_all = any(perm == "schedule:write_all" for perm in permissions)
    has_write = any(perm == "schedule:write" for perm in permissions)
    has_admin = any(perm == "schedule:admin" for perm in permissions)
    is_admin = current_user.role == UserRole.ADMIN
    
    if not (has_write_all or has_write or has_admin or is_admin):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    appointment_dict = appointment_data.dict()
    
    # If user only has write permission (not write_all), restrict to their own employee_id
    if has_write and not has_write_all and not has_admin and not is_admin:
        appointment_dict["employee_id"] = current_user.id
    
    # Handle datetime conversion for appointment_date if it's a string
    if isinstance(appointment_dict.get("appointment_date"), str):
        from datetime import datetime
        try:
            appointment_dict["appointment_date"] = datetime.fromisoformat(
                appointment_dict["appointment_date"].replace('Z', '+00:00')
            )
        except ValueError:
            appointment_dict["appointment_date"] = datetime.fromisoformat(appointment_dict["appointment_date"])
    
    appointment = Schedule(**appointment_dict)
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return appointment

@router.put("/schedule/{appointment_id}", response_model=ScheduleRead)
async def update_appointment(
    appointment_id: UUID, 
    appointment_data: dict, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an appointment"""
    try:
        # Get user permissions
        permissions = get_user_permissions_list(current_user, session)
        
        # Check permissions
        has_write_all = any(perm == "schedule:write_all" for perm in permissions)
        has_write = any(perm == "schedule:write" for perm in permissions)
        has_admin = any(perm == "schedule:admin" for perm in permissions)
        is_admin = current_user.role == UserRole.ADMIN
        
        if not (has_write_all or has_write or has_admin or is_admin):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        appointment = session.get(Schedule, appointment_id)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # If user only has write permission (not write_all), restrict to their own appointments
        if has_write and not has_write_all and not has_admin and not is_admin:
            if appointment.employee_id != current_user.id:
                raise HTTPException(status_code=403, detail="Can only edit your own appointments")
        
        # Handle type conversion for known fields
        for key, value in appointment_data.items():
            if hasattr(appointment, key):
                # Convert datetime string -> datetime
                if key == "appointment_date" and isinstance(value, str):
                    from datetime import datetime
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        value = datetime.fromisoformat(value)
                # Convert UUID strings -> UUID objects
                if key in {"client_id", "service_id", "employee_id"} and isinstance(value, str):
                    try:
                        from uuid import UUID as _UUID
                        value = _UUID(value)
                    except Exception:
                        raise HTTPException(status_code=422, detail=f"Invalid {key}")
                
                # If user only has write permission, prevent changing employee_id to someone else
                if key == "employee_id" and has_write and not has_write_all and not has_admin and not is_admin:
                    if value != current_user.id:
                        raise HTTPException(status_code=403, detail="Cannot schedule appointments for other employees")
                
                setattr(appointment, key, value)
        
        # Update the updated_at timestamp
        from datetime import datetime
        appointment.updated_at = datetime.utcnow()
        
        session.add(appointment)
        session.commit()
        session.refresh(appointment)
        return appointment
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
