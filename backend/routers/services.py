from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Service, ServiceCreate, ServiceRead

router = APIRouter()

@router.get("/services", response_model=List[ServiceRead])
async def get_services(session: Session = Depends(get_session)):
    """Get all services"""
    services = session.exec(select(Service)).all()
    return services

@router.get("/services/{service_id}", response_model=ServiceRead)
async def get_service(service_id: UUID, session: Session = Depends(get_session)):
    """Get a specific service by ID"""
    service = session.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.post("/services", response_model=ServiceRead)
async def create_service(service_data: ServiceCreate, session: Session = Depends(get_session)):
    """Create a new service"""
    service = Service(**service_data.dict())
    session.add(service)
    session.commit()
    session.refresh(service)
    return service

@router.put("/services/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: UUID, 
    service_data: ServiceCreate, 
    session: Session = Depends(get_session)
):
    """Update a service"""
    service = session.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service_dict = service_data.dict(exclude_unset=True)
    for key, value in service_dict.items():
        setattr(service, key, value)
    
    session.add(service)
    session.commit()
    session.refresh(service)
    return service

@router.delete("/services/{service_id}")
async def delete_service(service_id: UUID, session: Session = Depends(get_session)):
    """Delete a service"""
    service = session.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    session.delete(service)
    session.commit()
    return {"message": "Service deleted successfully"}
