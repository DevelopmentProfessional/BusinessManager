from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Schedule, ScheduleCreate, ScheduleRead

router = APIRouter()

@router.get("/schedule", response_model=List[ScheduleRead])
async def get_schedule(session: Session = Depends(get_session)):
    """Get all appointments"""
    appointments = session.exec(select(Schedule)).all()
    return appointments

@router.get("/schedule/employee/{employee_id}", response_model=List[ScheduleRead])
async def get_employee_schedule(employee_id: UUID, session: Session = Depends(get_session)):
    """Get schedule for a specific employee"""
    statement = select(Schedule).where(Schedule.employee_id == employee_id)
    appointments = session.exec(statement).all()
    return appointments

@router.post("/schedule", response_model=ScheduleRead)
async def create_appointment(appointment_data: ScheduleCreate, session: Session = Depends(get_session)):
    """Create a new appointment"""
    appointment_dict = appointment_data.dict()
    
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
    session: Session = Depends(get_session)
):
    """Update an appointment"""
    try:
        print(f"Updating appointment {appointment_id} with data: {appointment_data}")
        
        appointment = session.get(Schedule, appointment_id)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Handle type conversion for known fields
        for key, value in appointment_data.items():
            if hasattr(appointment, key):
                print(f"Setting {key} = {value} (type: {type(value)})")
                # Convert datetime string -> datetime
                if key == "appointment_date" and isinstance(value, str):
                    from datetime import datetime
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        print(f"Converted datetime: {value}")
                    except ValueError as e:
                        print(f"Datetime conversion error: {e}")
                        value = datetime.fromisoformat(value)
                # Convert UUID strings -> UUID objects
                if key in {"client_id", "service_id", "employee_id"} and isinstance(value, str):
                    try:
                        from uuid import UUID as _UUID
                        value = _UUID(value)
                    except Exception as e:
                        print(f"UUID conversion error for {key}: {e}")
                        raise HTTPException(status_code=422, detail=f"Invalid {key}")
                setattr(appointment, key, value)
        
        # Update the updated_at timestamp
        from datetime import datetime
        appointment.updated_at = datetime.utcnow()
        
        session.add(appointment)
        session.commit()
        session.refresh(appointment)
        print(f"Successfully updated appointment: {appointment}")
        return appointment
        
    except Exception as e:
        print(f"Error updating appointment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
