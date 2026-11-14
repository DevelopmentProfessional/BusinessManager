"""
CART ROUTER  — /api/client/cart
================================
Database-backed cart for the client portal.
Uses the shared `client_cart_item` table (same as the internal app).

GET    /cart              — load all items for the logged-in client
PUT    /cart/item         — upsert an item (add or update quantity)
DELETE /cart/item/{key}   — remove one item by cart_key
DELETE /cart              — clear the entire cart
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from uuid import UUID

from auth import get_current_client
from database import get_session
from models import Client, ClientCartItem, ClientCartItemRead, ClientCartItemUpsert

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=list[ClientCartItemRead])
def get_cart(
    current_client: Client = Depends(get_current_client),
    session: Session = Depends(get_session),
):
    items = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == current_client.id,
            ClientCartItem.company_id == current_client.company_id,
        )
    ).all()
    return items


@router.put("/item", response_model=ClientCartItemRead)
def upsert_item(
    data: ClientCartItemUpsert,
    current_client: Client = Depends(get_current_client),
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == current_client.id,
            ClientCartItem.cart_key == data.cart_key,
            ClientCartItem.company_id == current_client.company_id,
        )
    ).first()

    if existing:
        existing.item_id    = data.item_id
        existing.item_type  = data.item_type
        existing.item_name  = data.item_name
        existing.unit_price = data.unit_price
        existing.quantity   = data.quantity
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

    new_item = ClientCartItem(
        client_id=current_client.id,
        company_id=current_client.company_id or "",
        **data.model_dump(),
    )
    session.add(new_item)
    try:
        session.commit()
        session.refresh(new_item)
    except Exception:
        session.rollback()
        raise
    return new_item


@router.delete("/item/{cart_key:path}")
def remove_item(
    cart_key: str,
    current_client: Client = Depends(get_current_client),
    session: Session = Depends(get_session),
):
    item = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == current_client.id,
            ClientCartItem.cart_key == cart_key,
            ClientCartItem.company_id == current_client.company_id,
        )
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True}


@router.delete("")
def clear_cart(
    current_client: Client = Depends(get_current_client),
    session: Session = Depends(get_session),
):
    items = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == current_client.id,
            ClientCartItem.company_id == current_client.company_id,
        )
    ).all()
    for item in items:
        session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True, "deleted": len(items)}
