from datetime import datetime
import json
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel as PydanticModel
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import (
        AppSettings,
        Client,
        ClientCartItem,
        ClientOrder,
        ClientOrderItem,
        ClientOrderItemRead,
        ClientOrderRead,
        DiscountRule,
        FeatureOption,
        Inventory,
        InventoryFeatureCombination,
        InventoryFeatureOptionData,
        User,
    )
    from backend.routers.auth import get_current_user
    from backend.utils.discount_service import get_applicable_discounts, apply_discount_to_cart_item
except ModuleNotFoundError:
    from database import get_session
    from models import (
        AppSettings,
        Client,
        ClientCartItem,
        ClientOrder,
        ClientOrderItem,
        ClientOrderItemRead,
        ClientOrderRead,
        DiscountRule,
        FeatureOption,
        Inventory,
        InventoryFeatureCombination,
        InventoryFeatureOptionData,
        User,
    )
    from routers.auth import get_current_user
    from utils.discount_service import get_applicable_discounts, apply_discount_to_cart_item  # type: ignore


router = APIRouter()

ORDER_STATUS_SEQUENCE = {
    "payment_pending": {"ordered", "cancelled"},
    "ordered": {"processing", "cancelled", "refunded"},
    "processing": {"ready_for_pickup", "out_for_delivery", "cancelled", "refunded"},
    "ready_for_pickup": {"picked_up", "cancelled"},
    "out_for_delivery": {"delivered", "cancelled"},
    "picked_up": {"refunded"},
    "delivered": {"refunded"},
    "cancelled": set(),
    "refunded": set(),
}
FINAL_FULFILLMENT_STATUSES = {"picked_up", "delivered"}


class PortalOrderRead(ClientOrderRead):
    client_name: Optional[str] = None
    employee_name: Optional[str] = None


class PortalOrderPaymentBody(PydanticModel):
    payment_method: Optional[str] = "card"


class PortalOrderStatusBody(PydanticModel):
    status: str


def _employee_name(user: Optional[User]) -> Optional[str]:
    if not user:
        return None
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.username


def _build_order_read(session: Session, order: ClientOrder) -> PortalOrderRead:
    client = session.get(Client, order.client_id)
    employee = session.get(User, order.employee_id) if order.employee_id else None
    return PortalOrderRead(
        id=order.id,
        client_id=order.client_id,
        employee_id=order.employee_id,
        status=order.status,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        total=order.total,
        payment_method=order.payment_method,
        stripe_payment_intent_id=order.stripe_payment_intent_id,
        stripe_charge_id=order.stripe_charge_id,
        paid_at=order.paid_at,
        fulfilled_at=order.fulfilled_at,
        inventory_deducted_at=order.inventory_deducted_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
        client_name=client.name if client else None,
        employee_name=_employee_name(employee),
    )


def _combination_key_from_option_ids(option_ids: List[str]) -> str:
    return "|".join(sorted(option_ids))


def _deduct_inventory_for_order(session: Session, order: ClientOrder) -> None:
    if order.inventory_deducted_at is not None:
        return

    items = session.exec(select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)).all()
    for item in items:
        if item.item_type != "product" or not item.item_id:
            continue

        option_ids: List[str] = []
        if item.options_json:
            try:
                parsed = json.loads(item.options_json)
                if isinstance(parsed, list):
                    option_ids = [str(opt.get("optionId") or opt.get("option_id")) for opt in parsed if opt.get("optionId") or opt.get("option_id")]
            except Exception:
                option_ids = []

        if option_ids:
            combo = session.exec(
                select(InventoryFeatureCombination).where(
                    InventoryFeatureCombination.inventory_id == item.item_id,
                    InventoryFeatureCombination.combination_key == _combination_key_from_option_ids(option_ids),
                )
            ).first()
            if combo:
                combo.quantity = max(0, combo.quantity - item.quantity)
                session.add(combo)

            rows = session.exec(
                select(InventoryFeatureOptionData).where(InventoryFeatureOptionData.inventory_id == item.item_id)
            ).all()
            totals = {row.option_id: 0 for row in rows}
            combos = session.exec(
                select(InventoryFeatureCombination).where(InventoryFeatureCombination.inventory_id == item.item_id)
            ).all()
            for existing_combo in combos:
                try:
                    combo_option_ids = [UUID(value) for value in json.loads(existing_combo.option_ids_json or "[]")]
                except Exception:
                    combo_option_ids = []
                for option_id in combo_option_ids:
                    totals[option_id] = totals.get(option_id, 0) + existing_combo.quantity

            for row in rows:
                row.quantity = totals.get(row.option_id, 0)
                session.add(row)

            item_inventory = session.get(Inventory, item.item_id)
            if item_inventory:
                item_inventory.quantity = sum(combo_row.quantity for combo_row in combos)
                session.add(item_inventory)
            continue

        inventory_item = session.get(Inventory, item.item_id)
        if inventory_item:
            inventory_item.quantity = max(0, (inventory_item.quantity or 0) - item.quantity)
            session.add(inventory_item)

    order.inventory_deducted_at = datetime.utcnow()
    session.add(order)


def _set_order_status(
    session: Session,
    order: ClientOrder,
    next_status: str,
    current_user: User,
    allow_payment_transition: bool = False,
) -> ClientOrder:
    current_status = order.status or "payment_pending"
    if next_status == current_status:
        return order
    if current_status == "payment_pending" and next_status == "ordered" and not allow_payment_transition:
        raise HTTPException(status_code=400, detail="Use the pay endpoint to move an order from payment_pending to ordered.")
    allowed = ORDER_STATUS_SEQUENCE.get(current_status, set())
    if next_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot move order from '{current_status}' to '{next_status}'.")

    order.status = next_status
    order.employee_id = current_user.id
    if next_status == "ordered" and order.paid_at is None:
        order.paid_at = datetime.utcnow()
    if next_status in FINAL_FULFILLMENT_STATUSES:
        order.fulfilled_at = datetime.utcnow()
        _deduct_inventory_for_order(session, order)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


@router.get("/portal-orders", response_model=List[PortalOrderRead])
def list_portal_orders(
    client_id: Optional[UUID] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ClientOrder).where(ClientOrder.company_id == current_user.company_id)
    if client_id:
        stmt = stmt.where(ClientOrder.client_id == client_id)
    orders = session.exec(stmt.order_by(ClientOrder.created_at.desc())).all()
    return [_build_order_read(session, order) for order in orders]


@router.get("/portal-orders/{order_id}/items", response_model=List[ClientOrderItemRead])
def get_portal_order_items(
    order_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = session.get(ClientOrder, order_id)
    if not order or order.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Order not found.")
    
    items = session.exec(select(ClientOrderItem).where(ClientOrderItem.order_id == order_id)).all()
    
    # Convert to read models with discount fields included
    result = []
    for item in items:
        item_dict = {
            'id': item.id,
            'order_id': item.order_id,
            'item_id': item.item_id,
            'item_type': item.item_type,
            'item_name': item.item_name,
            'unit_price': item.unit_price,
            'quantity': item.quantity,
            'line_total': item.line_total,
            'booking_id': getattr(item, 'booking_id', None),
            'options_json': item.options_json,
            'created_at': item.created_at,
            # Include discount fields if they exist
            'unit_price_original': getattr(item, 'unit_price_original', None),
            'unit_price_discounted': getattr(item, 'unit_price_discounted', None),
            'unit_discount_amount': getattr(item, 'unit_discount_amount', None),
            'line_total_before_discount': getattr(item, 'line_total_before_discount', None),
            'line_discount_amount': getattr(item, 'line_discount_amount', None),
            'discount_type': getattr(item, 'discount_type', None),
            'discount_value': getattr(item, 'discount_value', None),
        }
        result.append(ClientOrderItemRead(**item_dict))
    
    return result


@router.post("/portal-orders/from-client-cart/{client_id}", response_model=PortalOrderRead)
def create_order_from_client_cart(
    client_id: UUID,
    payment: PortalOrderPaymentBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    cart_items = session.exec(
        select(ClientCartItem).where(
            ClientCartItem.client_id == client_id,
            ClientCartItem.company_id == current_user.company_id,
        )
    ).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Client cart is empty.")

    settings = session.exec(select(AppSettings).where(AppSettings.company_id == current_user.company_id)).first()
    tax_rate = ((settings.tax_rate or 0.0) / 100.0) if settings else 0.0
    
    # Get applicable discounts for items in cart
    item_ids = [item.item_id for item in cart_items if item.item_id]
    discounts = get_applicable_discounts(session, item_ids, current_user.company_id) if item_ids else {}
    
    # Calculate totals with discounts applied
    subtotal = 0.0
    total_discount = 0.0
    for item in cart_items:
        line_subtotal = item.line_total or (item.unit_price * item.quantity)
        subtotal += line_subtotal
        
        # Apply discount if applicable
        discount = discounts.get(item.item_id) if item.item_id else None
        if discount and discount.is_active:
            from backend.utils.discount_service import apply_discount_to_price
            _, discount_per_unit = apply_discount_to_price(item.unit_price, discount.discount_type, float(discount.discount_value))
            total_discount += discount_per_unit * item.quantity
    
    subtotal_after_discount = subtotal - total_discount
    tax_amount = round(subtotal_after_discount * tax_rate, 2)
    total = round(subtotal_after_discount + tax_amount, 2)

    order = ClientOrder(
        client_id=client_id,
        employee_id=current_user.id,
        status="payment_pending",
        subtotal=round(subtotal, 2),
        tax_amount=tax_amount,
        total=total,
        payment_method=payment.payment_method or "pending",
        company_id=current_user.company_id,
    )
    session.add(order)
    session.commit()
    session.refresh(order)

    for cart_item in cart_items:
        # Get discount for this specific item
        discount = discounts.get(cart_item.item_id) if cart_item.item_id else None
        
        # Calculate discount details
        discount_data = {}
        if discount and discount.is_active:
            from backend.utils.discount_service import apply_discount_to_price
            discounted_unit_price, unit_discount = apply_discount_to_price(
                cart_item.unit_price, discount.discount_type, float(discount.discount_value)
            )
            discount_data = {
                'unit_price_original': cart_item.unit_price,
                'unit_price_discounted': discounted_unit_price,
                'unit_discount_amount': unit_discount,
                'line_total_before_discount': cart_item.line_total or (cart_item.unit_price * cart_item.quantity),
                'line_discount_amount': unit_discount * cart_item.quantity,
                'discount_type': discount.discount_type,
                'discount_value': discount.discount_value,
            }
        
        session.add(ClientOrderItem(
            order_id=order.id,
            item_id=cart_item.item_id,
            item_type=cart_item.item_type,
            item_name=cart_item.item_name,
            unit_price=cart_item.unit_price,
            quantity=cart_item.quantity,
            line_total=cart_item.line_total,
            options_json=cart_item.options_json,
            company_id=current_user.company_id,
            **discount_data,  # Add discount fields if applicable
        ))
        session.delete(cart_item)

    session.commit()
    session.refresh(order)
    return _build_order_read(session, order)


@router.post("/portal-orders/{order_id}/pay", response_model=PortalOrderRead)
def mark_portal_order_paid(
    order_id: UUID,
    body: PortalOrderPaymentBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = session.get(ClientOrder, order_id)
    if not order or order.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Order not found.")
    payment_method = body.payment_method or order.payment_method or "card"
    if str(payment_method).strip().lower() in {"", "pending", "payment_pending"}:
        payment_method = "card"
    order.payment_method = payment_method
    order = _set_order_status(session, order, "ordered", current_user, allow_payment_transition=True)
    return _build_order_read(session, order)


@router.patch("/portal-orders/{order_id}/status", response_model=PortalOrderRead)
def update_portal_order_status(
    order_id: UUID,
    body: PortalOrderStatusBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    order = session.get(ClientOrder, order_id)
    if not order or order.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Order not found.")
    order = _set_order_status(session, order, body.status, current_user)
    return _build_order_read(session, order)