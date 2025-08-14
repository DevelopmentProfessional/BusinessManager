from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Product, ProductCreate

router = APIRouter()

@router.get("/products", response_model=List[Product])
async def get_products(session: Session = Depends(get_session)):
    """Get all products"""
    products = session.exec(select(Product)).all()
    return products

@router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: UUID, session: Session = Depends(get_session)):
    """Get a specific product by ID"""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, session: Session = Depends(get_session)):
    """Create a new product"""
    product = Product(**product_data.dict())
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

@router.delete("/products/{product_id}")
async def delete_product(product_id: UUID, session: Session = Depends(get_session)):
    """Delete a product"""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    session.delete(product)
    session.commit()
    return {"message": "Product deleted successfully"}
