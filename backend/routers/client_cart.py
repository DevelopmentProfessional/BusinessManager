"""
Client Cart Router
==================
Provides a persistent, database-backed shopping cart for each client.
Multiple employees can add/modify items for the same client across sessions
and devices. The cart is separate from completed SaleTransactions; it is
cleared when a transaction is processed at checkout.

Endpoints
---------
GET    /client-cart/{client_id}              – list all cart items for a client
PUT    /client-cart/{client_id}/item         – upsert (create or update) by cart_key
DELETE /client-cart/{client_id}/item/{key}   – remove one item by cart_key (URL-encoded)
DELETE /client-cart/{client_id}              – clear all items for a client
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from uuid import UUID

try:
    from backend.database import get_session
    from backend.models import ClientCartItem, ClientCartItemRead, ClientCartItemUpsert, DiscountRule, User
    from backend.routers.auth import get_current_user
    from backend.utils.discount_service import get_applicable_discounts
except ModuleNotFoundError:
    from database import get_session          # type: ignore
    from models import ClientCartItem, ClientCartItemRead, ClientCartItemUpsert, DiscountRule, User  # type: ignore
    from routers.auth import get_current_user  # type: ignore
    from utils.discount_service import get_applicable_discounts  # type: ignore

router = APIRouter()


@router.get("/client-cart/{client_id}", response_model=list[ClientCartItemRead])
def get_client_cart(client_id: UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    stmt = select(ClientCartItem).where(ClientCartItem.client_id == client_id, ClientCartItem.company_id == current_user.company_id)
    items = session.exec(stmt).all()
    
    # Get applicable discounts for items in cart
    item_ids = [item.item_id for item in items if item.item_id]
    discounts = get_applicable_discounts(session, item_ids, current_user.company_id) if item_ids else {}
    
    # Convert to read models with discounts applied
    result = []
    for item in items:
        item_dict = {
            'id': item.id,
            'client_id': item.client_id,
            'cart_key': item.cart_key,
            'item_id': item.item_id,
            'item_type': item.item_type,
            'item_name': item.item_name,
            'unit_price': item.unit_price,
            'quantity': item.quantity,
            'line_total': item.line_total,
            'options_json': item.options_json,
            'created_at': item.created_at,
        }
        
        # Apply discount if applicable
        discount = discounts.get(item.item_id) if item.item_id else None
        if discount and discount.is_active:
            from backend.utils.discount_service import apply_discount_to_cart_item
            item_dict = apply_discount_to_cart_item(item_dict, discount)
        else:
            # Add discount fields without discount
            item_dict['unit_price_original'] = item.unit_price
            item_dict['unit_price_discounted'] = item.unit_price
            item_dict['unit_discount_amount'] = 0.0
            item_dict['line_total_before_discount'] = item.line_total
            item_dict['line_discount_amount'] = 0.0
            item_dict['discount_type'] = None
            item_dict['discount_value'] = None
        
        result.append(ClientCartItemRead(**item_dict))
    
    return result


@router.put("/client-cart/{client_id}/item", response_model=ClientCartItemRead)
def upsert_cart_item(
    client_id: UUID,
    data: ClientCartItemUpsert,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ClientCartItem).where(
        ClientCartItem.client_id == client_id,
        ClientCartItem.cart_key == data.cart_key,
        ClientCartItem.company_id == current_user.company_id,
    )
    existing = session.exec(stmt).first()

    if existing:
        existing.item_id = data.item_id
        existing.item_type = data.item_type
        existing.item_name = data.item_name
        existing.unit_price = data.unit_price
        existing.quantity = data.quantity
        existing.line_total = data.line_total
        existing.options_json = data.options_json
        session.add(existing)
        try:
            session.commit()
            session.refresh(existing)
        except Exception:
            session.rollback()
            raise
        return existing

    new_item = ClientCartItem(client_id=client_id, company_id=current_user.company_id or "", **data.model_dump())
    session.add(new_item)
    try:
        session.commit()
        session.refresh(new_item)
    except Exception:
        session.rollback()
        raise
    return new_item


@router.delete("/client-cart/{client_id}/item/{cart_key:path}")
def remove_cart_item(
    client_id: UUID,
    cart_key: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ClientCartItem).where(
        ClientCartItem.client_id == client_id,
        ClientCartItem.cart_key == cart_key,
        ClientCartItem.company_id == current_user.company_id,
    )
    item = session.exec(stmt).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True}


@router.delete("/client-cart/{client_id}")
def clear_client_cart(client_id: UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    stmt = select(ClientCartItem).where(ClientCartItem.client_id == client_id, ClientCartItem.company_id == current_user.company_id)
    items = session.exec(stmt).all()
    for item in items:
        session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True, "deleted": len(items)}
