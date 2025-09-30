from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from backend.database import get_session
from backend.models import Attendance, AttendanceCreate, AttendanceRead, User
from backend.routers.auth import get_current_user
from backend.models import UserRole

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

@router.get("/attendance/user/{user_id}", response_model=List[AttendanceRead])
async def get_user_attendance(
    user_id: UUID, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for a specific user"""
    # Validate user exists
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Users can only view their own attendance, or admins can view all
    if current_user.role != UserRole.ADMIN:
        if str(user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Attendance).where(Attendance.user_id == user_id)
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.get("/attendance/user/{user_id}/date/{date}", response_model=List[AttendanceRead])
async def get_user_attendance_by_date(
    user_id: UUID,
    date: str,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for a specific user on a specific date"""
    # Validate user exists
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Users can only view their own attendance, or admins can view all
    if current_user.role != UserRole.ADMIN:
        if str(user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Parse the date string
    try:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get attendance records for the specific date
    statement = select(Attendance).where(
        (Attendance.user_id == user_id) &
        (Attendance.date >= target_date) &
        (Attendance.date < target_date + timedelta(days=1))
    )
    attendance_records = session.exec(statement).all()
    return attendance_records

@router.get("/attendance/my")
async def get_my_attendance(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get attendance records for the current user."""
    # Get attendance records for the current user
    records = session.exec(select(Attendance).where(Attendance.user_id == current_user.id)).all()
    return records

@router.get("/attendance/check-user")
async def check_user_profile(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Check current user profile."""
    # Provide both keys for backward/forward compatibility
    return {
        "has_user_profile": True,
        "has_employee_profile": True,
        "user_id": str(current_user.id)
    }

@router.post("/attendance/clock-in", response_model=AttendanceRead)
async def clock_in(
    attendance_data: Optional[dict] = None,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock in for the current user"""
    
    # Use current user ID
    user_id = current_user.id
    
    # Check if there's already an active attendance record (no clock-out) for today
    today = datetime.now().date()
    existing_record = session.exec(
        select(Attendance).where(
            (Attendance.user_id == user_id) &
            (Attendance.date >= today) &
            (Attendance.date < today + timedelta(days=1)) &
            (Attendance.clock_out.is_(None))
        )
    ).first()
    
    if existing_record:
        raise HTTPException(status_code=400, detail="Already clocked in. Please clock out first.")
    
    # Create new attendance record
    new_attendance = Attendance(
        user_id=user_id,
        date=datetime.now(),
        clock_in=datetime.now(),
        notes=attendance_data.get('notes') if attendance_data else None
    )
    
    session.add(new_attendance)
    session.commit()
    session.refresh(new_attendance)
    
    return new_attendance

@router.post("/attendance/clock-out", response_model=AttendanceRead)
async def clock_out(
    attendance_data: Optional[dict] = None,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clock out for the current user"""
    
    # Use current user ID
    user_id = current_user.id
    
    # Find the active attendance record (no clock-out) for today
    today = datetime.now().date()
    active_record = session.exec(
        select(Attendance).where(
            (Attendance.user_id == user_id) &
            (Attendance.date >= today) &
            (Attendance.date < today + timedelta(days=1)) &
            (Attendance.clock_out.is_(None))
        )
    ).first()
    
    if not active_record:
        raise HTTPException(status_code=400, detail="No active clock-in record found for today.")
    
    # Update the record with clock-out time
    clock_out_time = datetime.now()
    active_record.clock_out = clock_out_time
    
    # Calculate total hours
    if active_record.clock_in:
        time_diff = clock_out_time - active_record.clock_in
        active_record.total_hours = round(time_diff.total_seconds() / 3600, 2)
    
    # Update notes if provided
    if attendance_data and attendance_data.get('notes'):
        active_record.notes = attendance_data.get('notes')
    
    session.add(active_record)
    session.commit()
    session.refresh(active_record)
    
    return active_record

@router.post("/attendance", response_model=AttendanceRead)
async def create_attendance(
    attendance_data: AttendanceCreate,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new attendance record"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    attendance = Attendance(**attendance_data.dict())
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
    """Update an attendance record"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    attendance = session.get(Attendance, attendance_id)
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Update fields
    for key, value in attendance_data.items():
        if hasattr(attendance, key):
            setattr(attendance, key, value)
    
    attendance.updated_at = datetime.utcnow()
    session.add(attendance)
    session.commit()
    session.refresh(attendance)
    return attendance

@router.delete("/attendance/{attendance_id}")
async def delete_attendance(
    attendance_id: UUID,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete an attendance record"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    attendance = session.get(Attendance, attendance_id)
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    session.delete(attendance)
    session.commit()
    
    return {"message": "Attendance record deleted successfully"}