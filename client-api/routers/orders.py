"""
ORDERS ROUTER  — /api/client/orders
=====================================
All endpoints require a valid client JWT (role='client').
Row-level security: clients only see their OWN orders.

POST /orders/checkout   — Create order + Stripe PaymentIntent
GET  /orders            — List my orders
GET  /orders/{id}       — Order detail with line items
GET  /orders/{id}/items — Just the line items

Stripe Integration:
  - checkout returns a client_secret that the frontend uses with Stripe.js
    to complete card entry (no raw card data ever touches this server).
  - After the client confirms payment, Stripe sends a webhook to
    /api/client/webhooks/stripe which updates order.status → 'paid'.
"""

import os
import stripe
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address

import auth as auth_utils
from database import get_session
from models import (
    AppSettings,
    Client,
    ClientOrder,
    ClientOrderItem,
    Inventory,
    OrderCreate,
    OrderItemRead,
    OrderRead,
    Service,
)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

router = APIRouter(prefix="/orders", tags=["orders"])
limiter = Limiter(key_func=get_remote_address)


def _order_to_read(o: ClientOrder) -> OrderRead:
    return OrderRead(
        id=o.id,
        client_id=o.client_id,
        status=o.status,
        subtotal=o.subtotal,
        tax_amount=o.tax_amount,
        total=o.total,
        payment_method=o.payment_method,
        stripe_payment_intent_id=o.stripe_payment_intent_id,
        created_at=o.created_at,
    )


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def checkout(
    request: Request,
    body: OrderCreate,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """
    Create an order and a Stripe PaymentIntent.

    Request:
    ```json
    {
      "items": [
        { "item_id": "<uuid>", "item_type": "product", "item_name": "Widget", "unit_price": 19.99, "quantity": 2 },
        { "item_id": "<uuid>", "item_type": "service", "item_name": "Haircut", "unit_price": 45.00, "quantity": 1, "booking_id": "<booking_uuid>" }
      ],
      "payment_method": "card"
    }
    ```

    Response:
    ```json
    {
      "order_id": "<uuid>",
      "client_secret": "pi_xxx_secret_yyy",
      "total": 84.98
    }
    ```

    The frontend uses `client_secret` with Stripe.js `stripe.confirmCardPayment()`.
    """
    company_id = current_client.company_id

    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()
    tax_rate = (settings.tax_rate or 0.0) / 100.0 if settings else 0.0

    # Compute totals
    subtotal = sum(item.unit_price * item.quantity for item in body.items)
    tax_amount = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax_amount, 2)

    order = ClientOrder(
        client_id=current_client.id,
        status="pending",
        subtotal=round(subtotal, 2),
        tax_amount=tax_amount,
        total=total,
        payment_method=body.payment_method,
        company_id=company_id,
    )
    session.add(order)

    try:
        session.commit()
        session.refresh(order)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order.")

    # Create line items
    for item in body.items:
        line = ClientOrderItem(
            order_id=order.id,
            item_id=UUID(item.item_id) if item.item_id else None,
            item_type=item.item_type,
            item_name=item.item_name,
            unit_price=item.unit_price,
            quantity=item.quantity,
            line_total=round(item.unit_price * item.quantity, 2),
            booking_id=UUID(item.booking_id) if item.booking_id else None,
            company_id=company_id,
        )
        session.add(line)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order items.")

    # ── Stripe PaymentIntent ───────────────────────────────────────────────────
    client_secret = None
    if stripe.api_key and total > 0:
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(total * 100),   # Stripe uses cents
                currency="usd",
                metadata={
                    "order_id":  str(order.id),
                    "client_id": str(current_client.id),
                    "company_id": company_id,
                },
                description=f"Order {order.id} — {company_id}",
            )
            client_secret = intent["client_secret"]
            # Store payment intent ID on order
            order.stripe_payment_intent_id = intent["id"]
            session.commit()
        except stripe.StripeError as e:
            # Don't block the order creation — Stripe failure is logged, admin can retry
            print(f"Stripe PaymentIntent creation failed: {e}")

    return {
        "order_id": str(order.id),
        "client_secret": client_secret,
        "total": total,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
    }


@router.get("", response_model=List[OrderRead])
@limiter.limit("30/minute")
def list_orders(
    request: Request,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """Return all orders for the authenticated client, newest first."""
    orders = session.exec(
        select(ClientOrder)
        .where(ClientOrder.client_id == current_client.id)
        .order_by(ClientOrder.created_at.desc())
    ).all()
    return [_order_to_read(o) for o in orders]


@router.get("/{order_id}", response_model=OrderRead)
@limiter.limit("60/minute")
def get_order(
    request: Request,
    order_id: UUID,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    order = session.exec(
        select(ClientOrder).where(
            ClientOrder.id == order_id,
            ClientOrder.client_id == current_client.id,   # Row-level security
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return _order_to_read(order)


@router.get("/{order_id}/items", response_model=List[OrderItemRead])
@limiter.limit("60/minute")
def get_order_items(
    request: Request,
    order_id: UUID,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    # Verify ownership first
    order = session.exec(
        select(ClientOrder).where(
            ClientOrder.id == order_id,
            ClientOrder.client_id == current_client.id,
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    items = session.exec(
        select(ClientOrderItem).where(ClientOrderItem.order_id == order_id)
    ).all()
    return [
        OrderItemRead(
            id=i.id,
            order_id=i.order_id,
            item_id=i.item_id,
            item_type=i.item_type,
            item_name=i.item_name,
            unit_price=i.unit_price,
            quantity=i.quantity,
            line_total=i.line_total,
            booking_id=i.booking_id,
        )
        for i in items
    ]


# ── Stripe Webhook ─────────────────────────────────────────────────────────────

@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    session: Session = Depends(get_session),
):
    """
    Stripe sends events here after payment is confirmed in the browser.
    Set this URL in the Stripe Dashboard → Webhooks.

    Handles:
      payment_intent.succeeded   → order.status = 'paid'
      payment_intent.canceled    → order.status = 'cancelled'
    """
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook parse error.")

    pi = event["data"]["object"]
    order_id = pi.get("metadata", {}).get("order_id")
    if not order_id:
        return {"received": True}

    order = session.exec(
        select(ClientOrder).where(ClientOrder.id == UUID(order_id))
    ).first()

    if not order:
        return {"received": True}

    if event["type"] == "payment_intent.succeeded":
        order.status = "paid"
        order.stripe_charge_id = pi.get("latest_charge")
    elif event["type"] == "payment_intent.canceled":
        order.status = "cancelled"

    try:
        session.commit()
    except Exception:
        session.rollback()

    return {"received": True}
