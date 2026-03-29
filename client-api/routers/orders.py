"""
ORDERS ROUTER  — /api/client/orders
=====================================
All endpoints require a valid client JWT (role='client').
Row-level security: clients only see their OWN orders.

POST /orders/checkout   — Create an order from the current cart
POST /orders/{id}/pay   — Mark an order as paid (temporary manual payment flow)
GET  /orders            — List my orders
GET  /orders/{id}       — Order detail
GET  /orders/{id}/items — Just the line items
"""

import logging
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
    ClientBooking,
    ClientOrder,
    ClientOrderItem,
    Inventory,
    OrderCreate,
    OrderItemRead,
    OrderRead,
    Schedule,
    Service,
)

router = APIRouter(prefix="/orders", tags=["orders"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


def _parse_optional_uuid(value: str | UUID | None, field_name: str, item_name: str) -> UUID | None:
    if value in (None, ""):
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        logger.warning("Checkout received invalid %s for item '%s': %r", field_name, item_name, value)
        return None


def _order_to_read(o: ClientOrder) -> OrderRead:
    return OrderRead(
        id=o.id,
        client_id=o.client_id,
        employee_id=o.employee_id,
        status=o.status,
        subtotal=o.subtotal,
        tax_amount=o.tax_amount,
        total=o.total,
        payment_method=o.payment_method,
        stripe_payment_intent_id=o.stripe_payment_intent_id,
        paid_at=o.paid_at,
        fulfilled_at=o.fulfilled_at,
        inventory_deducted_at=o.inventory_deducted_at,
        created_at=o.created_at,
    )


class PayOrderBody(OrderCreate):
    items: List = []


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def checkout(
    request: Request,
    body: OrderCreate,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """
    Create an order in `payment_pending` status.

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

    Payment is handled by a separate `/orders/{id}/pay` action for now.
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

    try:
        order = ClientOrder(
            client_id=current_client.id,
            status="payment_pending",
            subtotal=round(subtotal, 2),
            tax_amount=tax_amount,
            total=total,
            payment_method=body.payment_method,
            company_id=company_id,
        )
        session.add(order)
        session.flush()

        for item in body.items:
            line = ClientOrderItem(
                order_id=order.id,
                item_id=_parse_optional_uuid(item.item_id, "item_id", item.item_name),
                item_type=item.item_type,
                item_name=item.item_name,
                unit_price=item.unit_price,
                quantity=item.quantity,
                line_total=round(item.unit_price * item.quantity, 2),
                booking_id=_parse_optional_uuid(item.booking_id, "booking_id", item.item_name),
                options_json=item.options_json,
                company_id=company_id,
            )
            session.add(line)

        session.commit()
        session.refresh(order)
    except Exception:
        logger.exception("Failed to create checkout order for client %s", current_client.id)
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create order.")

    return {
        "order_id": str(order.id),
        "client_secret": None,
        "total": total,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
        "status": order.status,
    }


@router.post("/{order_id}/pay", response_model=OrderRead)
@limiter.limit("20/minute")
def pay_order(
    request: Request,
    order_id: UUID,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    order = session.exec(
        select(ClientOrder).where(
            ClientOrder.id == order_id,
            ClientOrder.client_id == current_client.id,
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != "payment_pending":
        return _order_to_read(order)

    order.status = "ordered"
    order.paid_at = order.paid_at or __import__("datetime").datetime.utcnow()
    order.payment_method = order.payment_method or "card"
    session.add(order)
    try:
        session.commit()
        session.refresh(order)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order payment.")

    # ── Auto-revoke soft bookings displaced by this hard ("locked") payment ──
    # For every hard booking in this order, cancel any soft booking that overlaps
    # the same service + time window for the same company.
    try:
        items = session.exec(
            select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)
        ).all()
        for item in items:
            if not item.booking_id:
                continue
            hard_booking = session.exec(
                select(ClientBooking).where(ClientBooking.id == item.booking_id)
            ).first()
            if not hard_booking or hard_booking.booking_mode != "locked":
                continue

            slot_start = hard_booking.appointment_date
            slot_end   = slot_start + __import__("datetime").timedelta(minutes=hard_booking.duration_minutes or 60)

            # Find overlapping soft bookings for the same service (excluding this booking)
            soft_bookings = session.exec(
                select(ClientBooking).where(
                    ClientBooking.service_id == hard_booking.service_id,
                    ClientBooking.company_id == order.company_id,
                    ClientBooking.booking_mode == "soft",
                    ClientBooking.status.notin_(["cancelled", "completed"]),
                    ClientBooking.id != hard_booking.id,
                )
            ).all()

            from datetime import timedelta as _td
            for sb in soft_bookings:
                sb_end = sb.appointment_date + _td(minutes=sb.duration_minutes or 60)
                # Check time overlap
                if slot_start < sb_end and slot_end > sb.appointment_date:
                    sb.status = "cancelled"
                    session.add(sb)
                    # Also cancel the linked soft_hold schedule
                    if sb.schedule_id:
                        sched = session.exec(
                            select(Schedule).where(Schedule.id == sb.schedule_id)
                        ).first()
                        if sched and sched.status == "soft_hold":
                            sched.status = "cancelled"
                            session.add(sched)

        session.commit()
    except Exception:
        # Non-fatal: order payment succeeded; log but don't fail the response
        logger.exception("Failed to cancel overlapping soft bookings after order checkout for order %s", order.id)
        session.rollback()

    return _order_to_read(order)


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
            options_json=i.options_json,
        )
        for i in items
    ]


# ── Legacy Stripe Webhook ──────────────────────────────────────────────────────

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
            payment_intent.succeeded   → order.status = 'ordered'
      payment_intent.canceled    → order.status = 'cancelled'
    """
    import os
    import stripe

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, stripe_webhook_secret)
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
        order.status = "ordered"
        order.paid_at = order.paid_at or __import__("datetime").datetime.utcnow()
        order.stripe_charge_id = pi.get("latest_charge")
    elif event["type"] == "payment_intent.canceled":
        order.status = "cancelled"

    try:
        session.commit()
    except Exception:
        session.rollback()

    return {"received": True}
