from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Supplier

router = APIRouter()

@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(session: Session = Depends(get_session)):
    """Get all suppliers"""
    suppliers = session.exec(select(Supplier)).all()
    return suppliers

@router.get("/suppliers/{supplier_id}", response_model=Supplier)
async def get_supplier(supplier_id: UUID, session: Session = Depends(get_session)):
    """Get a specific supplier by ID"""
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: dict, session: Session = Depends(get_session)):
    """Create a new supplier"""
    supplier = Supplier(**supplier_data)
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier
