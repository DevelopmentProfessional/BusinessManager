from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Schedule, ScheduleCreate

router = APIRouter()

@router.get("/schedule", response_model=List[Schedule])
async def get_schedule(session: Session = Depends(get_session)):
    """Get all appointments"""
    appointments = session.exec(select(Schedule)).all()
    return appointments

@router.get("/schedule/employee/{employee_id}", response_model=List[Schedule])
async def get_employee_schedule(employee_id: UUID, session: Session = Depends(get_session)):
    """Get schedule for a specific employee"""
    statement = select(Schedule).where(Schedule.employee_id == employee_id)
    appointments = session.exec(statement).all()
    return appointments

@router.post("/schedule", response_model=Schedule)
async def create_appointment(appointment_data: ScheduleCreate, session: Session = Depends(get_session)):
    """Create a new appointment"""
    appointment = Schedule(**appointment_data.dict())
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return appointment

@router.put("/schedule/{appointment_id}", response_model=Schedule)
async def update_appointment(
    appointment_id: UUID, 
    appointment_data: dict, 
    session: Session = Depends(get_session)
):
    """Update an appointment"""
    appointment = session.get(Schedule, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    for key, value in appointment_data.items():
        if hasattr(appointment, key):
            setattr(appointment, key, value)
    
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return appointment
