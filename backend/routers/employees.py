from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Employee, EmployeeCreate, EmployeeRead

router = APIRouter()

@router.get("/employees", response_model=List[EmployeeRead])
async def get_employees(session: Session = Depends(get_session)):
    """Get all employees"""
    employees = session.exec(select(Employee)).all()
    return employees

@router.get("/employees/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: UUID, session: Session = Depends(get_session)):
    """Get a specific employee by ID"""
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.post("/employees", response_model=EmployeeRead)
async def create_employee(employee_data: EmployeeCreate, session: Session = Depends(get_session)):
    """Create a new employee"""
    employee = Employee(**employee_data.dict())
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee

@router.put("/employees/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: UUID, 
    employee_data: dict, 
    session: Session = Depends(get_session)
):
    """Update an employee"""
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    for key, value in employee_data.items():
        if hasattr(employee, key):
            setattr(employee, key, value)
    
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee

@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: UUID, session: Session = Depends(get_session)):
    """Delete an employee"""
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.is_active = False  # Soft delete
    session.add(employee)
    session.commit()
    return {"message": "Employee deactivated successfully"}
