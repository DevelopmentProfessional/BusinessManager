from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Asset

router = APIRouter()

@router.get("/assets", response_model=List[Asset])
async def get_assets(session: Session = Depends(get_session)):
    """Get all assets"""
    assets = session.exec(select(Asset)).all()
    return assets

@router.get("/assets/{asset_id}", response_model=Asset)
async def get_asset(asset_id: UUID, session: Session = Depends(get_session)):
    """Get a specific asset by ID"""
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@router.post("/assets", response_model=Asset)
async def create_asset(asset_data: dict, session: Session = Depends(get_session)):
    """Create a new asset"""
    asset = Asset(**asset_data)
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset

@router.put("/assets/{asset_id}", response_model=Asset)
async def update_asset(
    asset_id: UUID, 
    asset_data: dict, 
    session: Session = Depends(get_session)
):
    """Update an asset"""
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    for key, value in asset_data.items():
        if hasattr(asset, key):
            setattr(asset, key, value)
    
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset
