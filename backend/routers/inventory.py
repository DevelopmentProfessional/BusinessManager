from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Inventory, Product, Supplier

router = APIRouter()

@router.get("/inventory", response_model=List[Inventory])
async def get_inventory(session: Session = Depends(get_session)):
    """Get all inventory items with product details"""
    inventory_items = session.exec(select(Inventory)).all()
    return inventory_items

@router.get("/inventory/low-stock")
async def get_low_stock_items(session: Session = Depends(get_session)):
    """Get items with stock below minimum level"""
    statement = select(Inventory).where(Inventory.quantity <= Inventory.min_stock_level)
    low_stock_items = session.exec(statement).all()
    return low_stock_items

@router.post("/inventory")
async def update_inventory(
    product_id: UUID,
    quantity: int,
    session: Session = Depends(get_session)
):
    """Update inventory quantity for a product"""
    inventory = session.exec(
        select(Inventory).where(Inventory.product_id == product_id)
    ).first()
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    inventory.quantity = quantity
    session.add(inventory)
    session.commit()
    session.refresh(inventory)
    return inventory
