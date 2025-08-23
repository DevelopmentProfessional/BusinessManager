from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from datetime import datetime, date
from database import get_session
from models import Attendance, AttendanceCreate, AttendanceRead
from routers.auth import get_current_user

router = APIRouter()

@router.get("/attendance", response_model=List[AttendanceRead])
async def get_attendance(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all attendance records (admin only)"""
    if current_user.role != "admin":
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
    # Users can only view their own attendance or admins can view all
    if current_user.role != "admin" and str(current_user.id) != str(employee_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Attendance).where(Attendance.employee_id == employee_id)
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.post("/attendance/clock-in", response_model=AttendanceRead)
async def clock_in(
    attendance_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock in for the current user"""
    today = date.today()
    
    # Check if already clocked in today
    existing_record = session.exec(
        select(Attendance).where(
            (Attendance.employee_id == attendance_data.get('employee_id')) &
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
            employee_id=attendance_data.get('employee_id'),
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
    attendance_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock out for the current user"""
    today = date.today()
    
    # Find today's attendance record
    attendance_record = session.exec(
        select(Attendance).where(
            (Attendance.employee_id == attendance_data.get('employee_id')) &
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
    if current_user.role != "admin":
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
