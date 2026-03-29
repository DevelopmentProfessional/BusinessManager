"""
BOOKINGS ROUTER  — /api/client/bookings
========================================
All endpoints require a valid client JWT (role='client').
Row-level security: clients can only see/modify their OWN bookings.

POST   /bookings            — Create a booking (soft or locked)
GET    /bookings            — List my bookings
GET    /bookings/{id}       — Single booking detail
PATCH  /bookings/{id}/cancel — Cancel a booking (applies fee logic)

Booking Modes:
  soft   — No payment upfront. If cancelled: charge cancellation_percentage of service price.
  locked — Payment required at booking time (Stripe). If cancelled: refund refund_percentage of amount_paid.

Both percentages are read from AppSettings (cancellation_percentage, refund_percentage).
Double-booking is prevented with a SELECT FOR UPDATE advisory pattern.
"""

import os
import logging
import stripe
from datetime import datetime, timedelta, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address

import auth as auth_utils
from database import get_session
from models import (
    AppSettings,
    BookingCreate,
    BookingRead,
    Client,
    ClientBooking,
    Schedule,
    Service,
    ServiceAsset,
    ServiceEmployee,
    AssetUnit,
)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

router = APIRouter(prefix="/bookings", tags=["bookings"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


def _get_settings(company_id: str, session: Session) -> AppSettings:
    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()
    if not settings:
        raise HTTPException(status_code=500, detail="Company settings not configured.")
    return settings


def _find_available_employee(
    service_id: UUID,
    company_id: str,
    slot_start: datetime,
    slot_end: datetime,
    session: Session,
    booking_mode: str = "soft",
) -> str | None:
    """Return the first employee_id free for this slot, or None.

    Hard bookings ("locked") can override soft-hold slots; soft bookings cannot.
    """
    se_rows = session.exec(
        select(ServiceEmployee).where(
            ServiceEmployee.service_id == service_id,
            ServiceEmployee.company_id == company_id,
        )
    ).all()

    # Hard bookings only block on confirmed slots; soft bookings also block on soft_hold
    blocking = ["scheduled", "confirmed"]
    if booking_mode == "soft":
        blocking.append("soft_hold")

    existing = session.exec(
        select(Schedule).where(
            Schedule.company_id == company_id,
            Schedule.status.in_(blocking),
            Schedule.appointment_date < slot_end,
        )
    ).all()

    for se in se_rows:
        emp_id = str(se.user_id)
        conflict = any(
            str(s.employee_id) == emp_id
            and slot_start < (s.appointment_date + timedelta(minutes=s.duration_minutes or 60))
            and slot_end > s.appointment_date
            for s in existing
        )
        if not conflict:
            return emp_id
    return None


def _check_assets_available(
    service_id: UUID,
    company_id: str,
    slot_start: datetime,
    slot_end: datetime,
    session: Session,
) -> bool:
    """Return True if all required asset types have at least one free unit."""
    sa_rows = session.exec(
        select(ServiceAsset).where(
            ServiceAsset.service_id == service_id,
            ServiceAsset.company_id == company_id,
        )
    ).all()

    if not sa_rows:
        return True

    existing = session.exec(
        select(Schedule).where(
            Schedule.company_id == company_id,
            Schedule.status.in_(["scheduled", "confirmed"]),
        )
    ).all()

    for sa in sa_rows:
        units = session.exec(
            select(AssetUnit).where(
                AssetUnit.inventory_id == sa.inventory_id,
                AssetUnit.company_id == company_id,
            )
        ).all()
        has_free = False
        for unit in units:
            if unit.state not in ("available", "arriving_soon"):
                continue
            if unit.schedule_id is None:
                has_free = True
                break
            linked = next((s for s in existing if str(s.id) == str(unit.schedule_id)), None)
            if not linked:
                has_free = True
                break
            s_end = linked.appointment_date + timedelta(minutes=linked.duration_minutes or 60)
            if not (slot_start < s_end and slot_end > linked.appointment_date):
                has_free = True
                break
        if not has_free:
            return False
    return True


def _booking_to_read(b: ClientBooking) -> BookingRead:
    return BookingRead(
        id=b.id,
        client_id=b.client_id,
        service_id=b.service_id,
        booking_mode=b.booking_mode,
        status=b.status,
        appointment_date=b.appointment_date,
        duration_minutes=b.duration_minutes,
        notes=b.notes,
        amount_paid=b.amount_paid,
        cancellation_charge=b.cancellation_charge,
        refund_amount=b.refund_amount,
        created_at=b.created_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def create_booking(
    request: Request,
    body: BookingCreate,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """
    Create a booking for a service.

    booking_mode:
      "soft"   — No payment required now. Cancellation fee applies.
      "locked" — Client must have provided a Stripe PaymentIntent already.
                 Pass `stripe_payment_intent_id` in future extensions.

    Request:
    ```json
    {
      "service_id": "<uuid>",
      "appointment_date": "2026-04-01T10:00:00",
      "booking_mode": "soft",
      "notes": "Prefer morning"
    }
    ```

    Errors:
      409 — Slot is no longer available (double-booking prevention).
      400 — Service not found or date in the past.
    """
    service_id = UUID(body.service_id)
    company_id = current_client.company_id

    svc = session.exec(
        select(Service).where(Service.id == service_id, Service.company_id == company_id)
    ).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found.")

    slot_start = body.appointment_date
    slot_end   = slot_start + timedelta(minutes=svc.duration_minutes or 60)

    if slot_start <= datetime.now():
        raise HTTPException(status_code=400, detail="Appointment date must be in the future.")

    # ── Row-level lock: advisory lock per company+slot to prevent races ────────
    lock_key = hash(f"{company_id}:{slot_start.isoformat()}")
    session.exec(text(f"SELECT pg_advisory_xact_lock({abs(lock_key) % (2**31)})"))

    # Re-check availability inside the lock
    emp_id = _find_available_employee(service_id, company_id, slot_start, slot_end, session, body.booking_mode)
    if not emp_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No available employees for this time slot. Please choose another time.",
        )

    if not _check_assets_available(service_id, company_id, slot_start, slot_end, session):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Required equipment is unavailable for this time slot.",
        )

    if body.booking_mode == "locked":
        conflicting_soft_holds = session.exec(
            select(Schedule).where(
                Schedule.company_id == company_id,
                Schedule.employee_id == UUID(emp_id),
                Schedule.status == "soft_hold",
                Schedule.appointment_date < slot_end,
            )
        ).all()
        for soft_hold in conflicting_soft_holds:
            soft_hold_end = soft_hold.appointment_date + timedelta(minutes=soft_hold.duration_minutes or 60)
            if not (slot_start < soft_hold_end and slot_end > soft_hold.appointment_date):
                continue

            soft_hold.status = "cancelled"
            session.add(soft_hold)

            linked_booking = session.exec(
                select(ClientBooking).where(
                    ClientBooking.schedule_id == soft_hold.id,
                    ClientBooking.company_id == company_id,
                    ClientBooking.status.notin_(["cancelled", "completed"]),
                )
            ).first()
            if linked_booking:
                linked_booking.status = "cancelled"
                session.add(linked_booking)

    try:
        booking = ClientBooking(
            client_id=current_client.id,
            service_id=service_id,
            booking_mode=body.booking_mode,
            status="pending",
            appointment_date=slot_start,
            duration_minutes=svc.duration_minutes or 60,
            notes=body.notes,
            amount_paid=0.0,
            company_id=company_id,
        )
        session.add(booking)

        # Create internal Schedule record. Soft bookings use "soft_hold" so hard bookings
        # can still take the slot; hard ("locked") bookings use "scheduled" to fully reserve.
        sched_status = "soft_hold" if body.booking_mode == "soft" else "scheduled"
        schedule = Schedule(
            client_id=current_client.id,
            service_id=service_id,
            employee_id=UUID(emp_id),
            appointment_date=slot_start,
            status=sched_status,
            duration_minutes=svc.duration_minutes or 60,
            notes=body.notes,
            task_type="service",
            company_id=company_id,
        )
        session.add(schedule)
        session.flush()

        booking.schedule_id = schedule.id
        session.add(booking)
        session.commit()
        session.refresh(booking)
    except Exception:
        logger.exception("Failed to create client booking and linked schedule for client %s", current_client.id)
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to create booking.")

    return _booking_to_read(booking)


@router.get("", response_model=List[BookingRead])
@limiter.limit("30/minute")
def list_bookings(
    request: Request,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """Return all bookings for the authenticated client."""
    bookings = session.exec(
        select(ClientBooking)
        .where(ClientBooking.client_id == current_client.id)
        .order_by(ClientBooking.appointment_date.desc())
    ).all()
    return [_booking_to_read(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingRead)
@limiter.limit("60/minute")
def get_booking(
    request: Request,
    booking_id: UUID,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    booking = session.exec(
        select(ClientBooking).where(
            ClientBooking.id == booking_id,
            ClientBooking.client_id == current_client.id,   # Row-level security
        )
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return _booking_to_read(booking)


@router.patch("/{booking_id}/cancel", response_model=BookingRead)
@limiter.limit("10/minute")
def cancel_booking(
    request: Request,
    booking_id: UUID,
    current_client: Client = Depends(auth_utils.get_current_client),
    session: Session = Depends(get_session),
):
    """
    Cancel a booking and apply the appropriate fee policy:

    - **soft booking** (no payment): Charge `cancellation_percentage` of the service price.
      The charge record is stored in `cancellation_charge` for staff billing reference.
    - **locked booking** (payment made): Issue Stripe refund of `refund_percentage` of amount_paid.
      `refund_amount` is set on the booking record.

    Both percentages come from AppSettings for this company.
    """
    booking = session.exec(
        select(ClientBooking).where(
            ClientBooking.id == booking_id,
            ClientBooking.client_id == current_client.id,
        )
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if booking.status in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status}.")

    settings = _get_settings(current_client.company_id, session)
    svc = session.get(Service, booking.service_id)

    if booking.booking_mode == "soft":
        # Charge cancellation percentage of service price
        fee = round((settings.cancellation_percentage / 100.0) * (svc.price if svc else 0.0), 2)
        booking.cancellation_charge = fee
        booking.status = "cancelled"

    elif booking.booking_mode == "locked":
        # Refund via Stripe
        refund_pct = settings.refund_percentage / 100.0
        refund_amt = round(refund_pct * booking.amount_paid, 2)
        booking.refund_amount = refund_amt
        booking.status = "cancelled"

        if booking.stripe_payment_intent_id and stripe.api_key:
            try:
                stripe.Refund.create(
                    payment_intent=booking.stripe_payment_intent_id,
                    amount=int(refund_amt * 100),   # Stripe uses cents
                )
            except stripe.StripeError as e:
                raise HTTPException(status_code=502, detail=f"Stripe refund failed: {str(e)}")

    # Cancel the internal Schedule as well
    if booking.schedule_id:
        internal_sched = session.get(Schedule, booking.schedule_id)
        if internal_sched:
            internal_sched.status = "cancelled"

    try:
        session.commit()
        session.refresh(booking)
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Cancellation failed.")

    return _booking_to_read(booking)
