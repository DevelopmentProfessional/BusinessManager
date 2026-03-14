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
    from backend.models import ClientCartItem, ClientCartItemRead, ClientCartItemUpsert
except ModuleNotFoundError:
    from database import get_session          # type: ignore
    from models import ClientCartItem, ClientCartItemRead, ClientCartItemUpsert  # type: ignore

router = APIRouter()


@router.get("/client-cart/{client_id}", response_model=list[ClientCartItemRead])
def get_client_cart(client_id: UUID, session: Session = Depends(get_session)):
    items = session.exec(
        select(ClientCartItem).where(ClientCartItem.client_id == client_id)
    ).all()
    return items


@router.put("/client-cart/{client_id}/item", response_model=ClientCartItemRead)
def upsert_cart_item(
    client_id: UUID,
    data: ClientCartItemUpsert,
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == client_id,
            ClientCartItem.cart_key == data.cart_key,
        )
    ).first()

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

    new_item = ClientCartItem(client_id=client_id, **data.model_dump())
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
):
    item = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == client_id,
            ClientCartItem.cart_key == cart_key,
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


@router.delete("/client-cart/{client_id}")
def clear_client_cart(client_id: UUID, session: Session = Depends(get_session)):
    items = session.exec(
        select(ClientCartItem).where(ClientCartItem.client_id == client_id)
    ).all()
    for item in items:
        session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True, "deleted": len(items)}
