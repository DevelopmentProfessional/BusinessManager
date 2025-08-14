from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from datetime import datetime
from database import get_session
from models import Attendance, AttendanceCreate

router = APIRouter()

@router.get("/attendance", response_model=List[Attendance])
async def get_attendance(session: Session = Depends(get_session)):
    """Get all attendance records"""
    attendance_records = session.exec(select(Attendance)).all()
    return attendance_records

@router.get("/attendance/employee/{employee_id}", response_model=List[Attendance])
async def get_employee_attendance(employee_id: UUID, session: Session = Depends(get_session)):
    """Get attendance records for a specific employee"""
    statement = select(Attendance).where(Attendance.employee_id == employee_id)
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.post("/attendance", response_model=Attendance)
async def clock_in_out(attendance_data: AttendanceCreate, session: Session = Depends(get_session)):
    """Clock in or out for an employee"""
    attendance = Attendance(**attendance_data.dict())
    
    # Calculate total hours if both clock_in and clock_out are provided
    if attendance.clock_in and attendance.clock_out:
        time_diff = attendance.clock_out - attendance.clock_in
        attendance.total_hours = time_diff.total_seconds() / 3600
    
    session.add(attendance)
    session.commit()
    session.refresh(attendance)
    return attendance

@router.put("/attendance/{attendance_id}", response_model=Attendance)
async def update_attendance(
    attendance_id: UUID,
    attendance_data: dict,
    session: Session = Depends(get_session)
):
    """Update attendance record"""
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
