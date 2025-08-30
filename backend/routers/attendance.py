from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from database import get_session
from models import Attendance, AttendanceCreate, AttendanceRead, Employee
from routers.auth import get_current_user
from models import UserRole

router = APIRouter()

@router.get("/attendance", response_model=List[AttendanceRead])
async def get_attendance(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all attendance records (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    attendance_records = session.exec(select(Attendance)).all()
    return attendance_records

@router.get("/attendance/employee/{employee_id}", response_model=List[AttendanceRead])
async def get_employee_attendance(
    employee_id: UUID, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for a specific employee"""
    # Validate employee exists
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Users can only view attendance for employees linked to their user, or admins can view all
    if current_user.role != UserRole.ADMIN:
        if employee.user_id is None or str(employee.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Attendance).where(Attendance.employee_id == employee_id)
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.get("/attendance/employee/{employee_id}/date/{date}", response_model=List[AttendanceRead])
async def get_employee_attendance_by_date(
    employee_id: UUID,
    date: str,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for a specific employee on a specific date"""
    # Validate employee exists
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Users can only view attendance for employees linked to their user, or admins can view all
    if current_user.role != UserRole.ADMIN:
        if employee.user_id is None or str(employee.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Parse the date string
    try:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get attendance records for the specific date
    statement = select(Attendance).where(
        (Attendance.employee_id == employee_id) &
        (Attendance.date >= target_date) &
        (Attendance.date < target_date + timedelta(days=1))
    )
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.get("/attendance/me", response_model=List[AttendanceRead])
async def get_my_attendance(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for the current user (by linked employee)."""
    try:
        # Find employee linked to current user
        employee = session.exec(select(Employee).where(Employee.user_id == current_user.id)).first()
        
        if not employee:
            # No employee profile linked; return empty list for convenience
            print(f"No employee profile found for user {current_user.id}")
            return []
        
        # Get attendance records for the employee
        records = session.exec(select(Attendance).where(Attendance.employee_id == employee.id)).all()
        print(f"Found {len(records)} attendance records for employee {employee.id}")
        return records
        
    except Exception as e:
        print(f"Error in get_my_attendance: {str(e)}")
        # Return empty list instead of raising error
        return []

@router.get("/attendance/check-employee")
async def check_employee_profile(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Check if current user has an employee profile linked."""
    try:
        employee = session.exec(select(Employee).where(Employee.user_id == current_user.id)).first()
        return {
            "has_employee_profile": employee is not None,
            "employee_id": str(employee.id) if employee else None
        }
    except Exception as e:
        print(f"Error checking employee profile: {str(e)}")
        return {
            "has_employee_profile": False,
            "employee_id": None
        }

@router.post("/attendance/clock-in", response_model=AttendanceRead)
async def clock_in(
    attendance_data: Optional[dict] = None,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock in for the current user"""
    today = date.today()
    
    # Determine employee_id: use provided one if present, otherwise resolve from current user
    if attendance_data and attendance_data.get('employee_id'):
        employee_id = attendance_data.get('employee_id')
    else:
        employee = session.exec(select(Employee).where(Employee.user_id == current_user.id)).first()
        if not employee:
            raise HTTPException(status_code=400, detail="No employee profile linked to current user")
        employee_id = employee.id
    
    # Check if already clocked in today
    existing_record = session.exec(
        select(Attendance).where(
            (Attendance.employee_id == employee_id) &
            (Attendance.date >= today)
        )
    ).first()
    
    if existing_record and existing_record.clock_in:
        raise HTTPException(status_code=400, detail="Already clocked in today")
    
    if existing_record:
        # Update existing record
        existing_record.clock_in = datetime.utcnow()
        session.add(existing_record)
        session.commit()
        session.refresh(existing_record)
        return existing_record
    else:
        # Create new record
        attendance = Attendance(
            employee_id=employee_id,
            user_id=current_user.id,
            date=datetime.utcnow(),
            clock_in=datetime.utcnow()
        )
        session.add(attendance)
        session.commit()
        session.refresh(attendance)
        return attendance

@router.post("/attendance/clock-out", response_model=AttendanceRead)
async def clock_out(
    attendance_data: Optional[dict] = None,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock out for the current user"""
    today = date.today()
    
    # Determine employee_id: use provided one if present, otherwise resolve from current user
    if attendance_data and attendance_data.get('employee_id'):
        employee_id = attendance_data.get('employee_id')
    else:
        employee = session.exec(select(Employee).where(Employee.user_id == current_user.id)).first()
        if not employee:
            raise HTTPException(status_code=400, detail="No clock-in record found for today")
        employee_id = employee.id
    
    # Find today's attendance record
    attendance_record = session.exec(
        select(Attendance).where(
            (Attendance.employee_id == employee_id) &
            (Attendance.date >= today)
        )
    ).first()
    
    if not attendance_record:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    
    if attendance_record.clock_out:
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    attendance_record.clock_out = datetime.utcnow()
    
    # Calculate total hours
    if attendance_record.clock_in:
        time_diff = attendance_record.clock_out - attendance_record.clock_in
        attendance_record.total_hours = time_diff.total_seconds() / 3600
    
    session.add(attendance_record)
    session.commit()
    session.refresh(attendance_record)
    return attendance_record

@router.post("/attendance", response_model=AttendanceRead)
async def clock_in_out(attendance_data: AttendanceCreate, session: Session = Depends(get_session)):
    """Clock in or out for an employee (legacy endpoint)"""
    attendance = Attendance(**attendance_data.dict())
    
    # Calculate total hours if both clock_in and clock_out are provided
    if attendance.clock_in and attendance.clock_out:
        time_diff = attendance.clock_out - attendance.clock_in
        attendance.total_hours = time_diff.total_seconds() / 3600
    
    session.add(attendance)
    session.commit()
    session.refresh(attendance)
    return attendance

@router.put("/attendance/{attendance_id}", response_model=AttendanceRead)
async def update_attendance(
    attendance_id: UUID,
    attendance_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update attendance record (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    attendance = session.get(Attendance, attendance_id)
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    for key, value in attendance_data.items():
        if hasattr(attendance, key):
            setattr(attendance, key, value)
    
    # Recalculate total hours if times are updated
    if attendance.clock_in and attendance.clock_out:
        time_diff = attendance.clock_out - attendance.clock_in
        attendance.total_hours = time_diff.total_seconds() / 3600
    
    session.add(attendance)
    session.commit()
    session.refresh(attendance)
    return attendance
