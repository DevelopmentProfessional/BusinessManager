from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from database import get_session
from models import Inventory, Item, Supplier, ItemRead, ItemType, ItemCreate, ItemUpdate, InventoryRead
from sqlalchemy.exc import IntegrityError

router = APIRouter()


def _coerce_item_type(val) -> ItemType:
    """Accept enum instance, enum value (e.g., 'item', 'consumable'), or enum name (e.g., 'ITEM').
    Also maps legacy values 'product' and 'asset' to ItemType.ITEM. Defaults to ItemType.ITEM on failure.
    """
    if isinstance(val, ItemType):
        return val
    if isinstance(val, str):
        s = val.strip()
        # Legacy synonyms -> map to ITEM
        if s.lower() in {"product", "asset"}:
            return ItemType.ITEM
        # Try by value (lowercase)
        try:
            return ItemType(s.lower())
        except Exception:
            pass
        # Try by name (uppercase)
        try:
            return ItemType[s.upper()]
        except Exception:
            pass
    return ItemType.ITEM

@router.get("/inventory", response_model=List[InventoryRead])
async def get_inventory(session: Session = Depends(get_session)):
    """Get all inventory items with item details"""
    inventory_items = session.exec(select(Inventory)).all()
    return inventory_items

@router.get("/inventory/low-stock", response_model=List[InventoryRead])
async def get_low_stock_items(session: Session = Depends(get_session)):
    """Get items with stock below minimum level"""
    statement = select(Inventory).where(Inventory.quantity <= Inventory.min_stock_level)
    low_stock_items = session.exec(statement).all()
    return low_stock_items

# Items list for inventory UI
@router.get("/items", response_model=List[ItemRead])
async def list_items(session: Session = Depends(get_session)):
    """List item definitions"""
    items = session.exec(select(Item)).all()
    result: List[ItemRead] = []
    for it in items:
        # Normalize enum and numeric fields
        itype = _coerce_item_type(it.type)
        try:
            price_val = float(it.price) if it.price is not None else 0.0
            if price_val < 0 or price_val != price_val:  # NaN check
                price_val = 0.0
        except Exception:
            price_val = 0.0
        result.append(ItemRead(
            id=it.id,
            created_at=it.created_at,
            updated_at=it.updated_at,
            name=it.name or "",
            sku=it.sku or "",
            price=price_val,
            description=it.description,
            type=itype,
        ))
    return result

@router.get("/items/{item_id}", response_model=ItemRead)
async def get_item(item_id: UUID, session: Session = Depends(get_session)):
    """Get a specific item by ID"""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Map to ItemRead with safe defaults
    ptype = _coerce_item_type(item.type)
    return ItemRead(
        id=item.id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        name=item.name or "",
        sku=item.sku or "",
        price=float(item.price) if item.price is not None else 0.0,
        description=item.description,
        type=ptype,
    )

@router.post("/items", response_model=ItemRead)
async def create_item(item_data: ItemCreate, session: Session = Depends(get_session)):
    """Create a new item"""
    # Normalize type before creating
    data = item_data.dict()
    coerced = _coerce_item_type(data.get("type"))
    data["type"] = coerced.value  # store string in DB
    item = Item(**data)
    session.add(item)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="SKU must be unique") from e
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="Failed to create item") from e
    session.refresh(item)
    # Always coerce for API response
    ptype = _coerce_item_type(item.type)
    return ItemRead(
        id=item.id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        name=item.name or "",
        sku=item.sku or "",
        price=float(item.price) if item.price is not None else 0.0,
        description=item.description,
        type=ptype,
    )

@router.put("/items/{item_id}", response_model=ItemRead)
async def update_item(item_id: UUID, item_data: ItemUpdate, session: Session = Depends(get_session)):
    """Update an item"""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = item_data.dict(exclude_unset=True)
    for field, value in data.items():
        if field == "type":
            setattr(item, field, _coerce_item_type(value).value)
        else:
            setattr(item, field, value)
    session.add(item)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="SKU must be unique") from e
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="Failed to update item") from e
    session.refresh(item)
    ptype = _coerce_item_type(item.type)
    return ItemRead(
        id=item.id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        name=item.name or "",
        sku=item.sku or "",
        price=float(item.price) if item.price is not None else 0.0,
        description=item.description,
        type=ptype,
    )

@router.delete("/items/{item_id}")
async def delete_item(item_id: UUID, session: Session = Depends(get_session)):
    """Delete an item"""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}

@router.post("/inventory", response_model=InventoryRead)
async def update_inventory(
    item_id: UUID = Body(...),
    quantity: int = Body(...),
    min_stock_level: Optional[int] = Body(None),
    location: Optional[str] = Body(None),
    session: Session = Depends(get_session)
):
    """Update inventory for an item. If no inventory row exists, create it (upsert).
    Optionally accepts min_stock_level and location to set or update these fields.
    """
    # Ensure item exists
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    inventory = session.exec(
        select(Inventory).where(Inventory.item_id == item_id)
    ).first()

    if not inventory:
        # Create new inventory row with sensible defaults
        inventory = Inventory(
            item_id=item_id,
            quantity=quantity,
            min_stock_level=min_stock_level if min_stock_level is not None else 10,
            location=location,
        )
    else:
        inventory.quantity = quantity
        if min_stock_level is not None:
            inventory.min_stock_level = min_stock_level
        if location is not None:
            inventory.location = location

    session.add(inventory)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="Inventory constraint error") from e
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail="Failed to update inventory") from e
    session.refresh(inventory)
    return inventory
