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
from datetime import datetime, timedelta, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel as PydanticModel
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


def _utcnow() -> datetime:
    # Keep naive UTC timestamps to match existing DB/model conventions.
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


class PayOrderRequest(PydanticModel):
    payment_method: str | None = None


NON_PAYABLE_ORDER_STATUSES = {"cancelled", "refunded"}
TERMINAL_BOOKING_STATUSES = {"cancelled", "completed", "no_show"}


def _normalize_payment_method(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"", "pending", "payment_pending"}:
        return "card"
    return normalized


def _deduct_inventory_for_order(order: ClientOrder, session: Session) -> None:
    if order.inventory_deducted_at is not None:
        return

    items = session.exec(select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)).all()
    for item in items:
        if item.item_type != "product" or not item.item_id:
            continue
        inventory_item = session.exec(
            select(Inventory).where(
                Inventory.id == item.item_id,
                Inventory.company_id == order.company_id,
            )
        ).first()
        if not inventory_item:
            continue
        current_qty = int(inventory_item.quantity or 0)
        deduction = int(item.quantity or 0)
        inventory_item.quantity = max(0, current_qty - deduction)
        session.add(inventory_item)

    order.inventory_deducted_at = _utcnow()
    session.add(order)


def _reconcile_bookings_for_paid_order(order: ClientOrder, current_client_id: UUID, session: Session) -> None:
    items = session.exec(select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)).all()
    for item in items:
        if not item.booking_id:
            continue

        booking = session.exec(
            select(ClientBooking).where(
                ClientBooking.id == item.booking_id,
                ClientBooking.client_id == current_client_id,
                ClientBooking.company_id == order.company_id,
            )
        ).first()
        if not booking:
            continue

        # Paid orders finalize active bookings.
        if booking.status not in {"cancelled", "completed", "no_show"}:
            booking.status = "confirmed"

        # Preserve a recorded paid amount for locked bookings; for soft bookings,
        # this remains an informational value for downstream billing/reporting.
        line_total = float(item.line_total or 0)
        if line_total > 0:
            booking.amount_paid = max(float(booking.amount_paid or 0), line_total)

        session.add(booking)

        if booking.schedule_id:
            linked_schedule = session.exec(
                select(Schedule).where(
                    Schedule.id == booking.schedule_id,
                    Schedule.company_id == order.company_id,
                )
            ).first()
            if linked_schedule and linked_schedule.status == "soft_hold":
                linked_schedule.status = "scheduled"
                linked_schedule.is_paid = True
                session.add(linked_schedule)


def _validate_service_booking_for_checkout(
    booking_id: UUID | None,
    service_id: UUID | None,
    current_client: Client,
    session: Session,
) -> UUID:
    if not booking_id:
        raise HTTPException(status_code=400, detail="Service items require a valid booking_id.")

    booking = session.exec(
        select(ClientBooking).where(
            ClientBooking.id == booking_id,
            ClientBooking.client_id == current_client.id,
            ClientBooking.company_id == current_client.company_id,
        )
    ).first()
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found for this client.")

    if service_id and booking.service_id != service_id:
        raise HTTPException(status_code=400, detail="Booking does not match the selected service.")

    if (booking.status or "").lower() in TERMINAL_BOOKING_STATUSES:
        raise HTTPException(status_code=400, detail=f"Booking is already '{booking.status}' and cannot be checked out.")

    if booking.appointment_date and booking.appointment_date < _utcnow():
        raise HTTPException(status_code=400, detail="Booking appointment is in the past. Please rebook before checkout.")

    existing_order_lines = session.exec(
        select(ClientOrderItem).where(
            ClientOrderItem.booking_id == booking_id,
            ClientOrderItem.company_id == current_client.company_id,
        )
    ).all()
    for line in existing_order_lines:
        existing_order = session.exec(
            select(ClientOrder).where(
                ClientOrder.id == line.order_id,
                ClientOrder.client_id == current_client.id,
            )
        ).first()
        if existing_order and (existing_order.status or "").lower() not in NON_PAYABLE_ORDER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="This booking is already attached to an active order.",
            )

    return booking_id


def _validate_order_bookings_for_payment(order: ClientOrder, current_client: Client, session: Session) -> None:
    lines = session.exec(select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)).all()
    for line in lines:
        if line.item_type != "service" or not line.booking_id:
            continue

        booking = session.exec(
            select(ClientBooking).where(
                ClientBooking.id == line.booking_id,
                ClientBooking.client_id == current_client.id,
                ClientBooking.company_id == current_client.company_id,
            )
        ).first()
        if not booking:
            raise HTTPException(
                status_code=400,
                detail=f"Order item '{line.item_name}' has an invalid booking reference.",
            )

        normalized_status = (booking.status or "").lower()
        if normalized_status in TERMINAL_BOOKING_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot pay this order because '{line.item_name}' is tied to a "
                    f"{normalized_status} booking. Please rebook and checkout again."
                ),
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
            payment_method=_normalize_payment_method(body.payment_method),
            company_id=company_id,
        )
        session.add(order)
        session.flush()

        for item in body.items:
            parsed_item_id = _parse_optional_uuid(item.item_id, "item_id", item.item_name)
            parsed_booking_id = _parse_optional_uuid(item.booking_id, "booking_id", item.item_name)

            if item.item_type == "service":
                parsed_booking_id = _validate_service_booking_for_checkout(
                    parsed_booking_id,
                    parsed_item_id,
                    current_client,
                    session,
                )

            line = ClientOrderItem(
                order_id=order.id,
                item_id=parsed_item_id,
                item_type=item.item_type,
                item_name=item.item_name,
                unit_price=item.unit_price,
                quantity=item.quantity,
                line_total=round(item.unit_price * item.quantity, 2),
                booking_id=parsed_booking_id,
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
    body: PayOrderRequest,
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

    current_status = (order.status or "payment_pending").lower()
    if current_status in NON_PAYABLE_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot pay an order in '{current_status}' status.")

    if current_status == "ordered":
        if order.inventory_deducted_at is None:
            try:
                _deduct_inventory_for_order(order, session)
                _reconcile_bookings_for_paid_order(order, current_client.id, session)
                session.commit()
                session.refresh(order)
            except Exception:
                session.rollback()
                raise HTTPException(status_code=500, detail="Failed to reconcile paid order inventory.")
        return _order_to_read(order)

    if current_status != "payment_pending":
        raise HTTPException(status_code=400, detail=f"Order cannot be paid from '{current_status}' status.")

    _validate_order_bookings_for_payment(order, current_client, session)

    order.status = "ordered"
    order.paid_at = order.paid_at or _utcnow()
    order.payment_method = _normalize_payment_method(body.payment_method or order.payment_method)
    session.add(order)
    try:
        _deduct_inventory_for_order(order, session)
        _reconcile_bookings_for_paid_order(order, current_client.id, session)
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
            slot_end = slot_start + timedelta(minutes=hard_booking.duration_minutes or 60)

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

            for sb in soft_bookings:
                sb_end = sb.appointment_date + timedelta(minutes=sb.duration_minutes or 60)
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
        order.paid_at = order.paid_at or _utcnow()
        order.stripe_charge_id = pi.get("latest_charge")
        session.add(order)
        try:
            session.commit()
            session.refresh(order)
        except Exception:
            logger.exception("Failed to persist webhook payment success status for order %s", order.id)
            session.rollback()
            raise HTTPException(status_code=500, detail="Failed to persist paid order status.")

        try:
            _deduct_inventory_for_order(order, session)
            _reconcile_bookings_for_paid_order(order, order.client_id, session)
            session.commit()
        except Exception:
            logger.exception("Failed to reconcile webhook payment success for order %s", order.id)
            session.rollback()
            raise HTTPException(status_code=500, detail="Failed to reconcile paid order state.")
    elif event["type"] == "payment_intent.canceled":
        order.status = "cancelled"
        session.add(order)
        try:
            session.commit()
        except Exception:
            session.rollback()

    return {"received": True}
