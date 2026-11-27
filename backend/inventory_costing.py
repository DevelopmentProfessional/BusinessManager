"""Shared FIFO stock consumption and cost-layer helpers."""

from datetime import datetime
import math
from typing import Optional
from uuid import UUID

from sqlmodel import Session, select

try:
    from backend.models import Inventory, InventoryCost, InventoryCostConsumption, InventoryCostLayer
except ModuleNotFoundError:
    from models import Inventory, InventoryCost, InventoryCostConsumption, InventoryCostLayer


def fallback_unit_cost(session: Session, inventory: Inventory) -> Optional[float]:
    if inventory.cost is not None:
        return float(inventory.cost)

    cost_record = session.exec(
        select(InventoryCost).where(InventoryCost.inventory_id == inventory.id)
    ).first()
    if cost_record is None:
        return None

    for value in (cost_record.actual_cost, cost_record.standard_cost):
        if value is not None:
            return float(value)
    return None


def create_opening_stock_layer(session: Session, inventory: Inventory) -> None:
    """Capture initial stock as the oldest FIFO layer, preserving unknown cost as NULL."""
    quantity = max(0.0, float(inventory.quantity or 0))
    if quantity == 0 or str(inventory.type or "").lower() in {"asset", "location"}:
        return

    session.add(
        InventoryCostLayer(
            inventory_id=inventory.id,
            procurement_order_line_id=None,
            source_type="opening_balance",
            source_reference_id=inventory.id,
            quantity_received=quantity,
            quantity_remaining=quantity,
            unit_cost=fallback_unit_cost(session, inventory),
            received_at=inventory.created_at or datetime.utcnow(),
            company_id=inventory.company_id,
        )
    )


def _add_consumption(
    session: Session,
    inventory: Inventory,
    layer: Optional[InventoryCostLayer],
    quantity: float,
    reference_type: str,
    reference_id: UUID,
    company_id: Optional[str],
) -> tuple[Optional[float], float]:
    unit_cost = layer.unit_cost if layer else None
    extended_cost = float(unit_cost) * quantity if unit_cost is not None else None
    session.add(
        InventoryCostConsumption(
            inventory_id=inventory.id,
            cost_layer_id=layer.id if layer else None,
            reference_type=reference_type,
            reference_id=reference_id,
            quantity=quantity,
            unit_cost=unit_cost,
            extended_cost=extended_cost,
            company_id=company_id or inventory.company_id,
        )
    )
    return extended_cost, quantity if unit_cost is None else 0


def consume_inventory_fifo(
    session: Session,
    inventory: Inventory,
    requested_quantity: float,
    reference_type: str,
    reference_id: UUID,
    company_id: Optional[str] = None,
) -> dict[str, Optional[float] | int]:
    """Consume available units oldest-first and persist a cost slice for each layer.

    Any pre-existing stock not covered by receipt layers is represented as an opening
    layer using the item's current cost when available. Unknown legacy cost remains NULL.
    Sales that exceed available stock retain their existing non-blocking behavior, but the
    shortfall is persisted as an explicitly uncosted consumption row.
    """
    quantity = float(requested_quantity)
    if not math.isfinite(quantity):
        raise ValueError("Inventory consumption quantity must be finite.")
    if quantity <= 0:
        return {"quantity_consumed": 0, "cost_amount": 0.0, "unknown_quantity": 0, "short_quantity": 0}

    locked_inventory = session.exec(
        select(Inventory)
        .where(Inventory.id == inventory.id)
        .with_for_update()
    ).first()
    if locked_inventory is None:
        raise ValueError(f"Inventory item {inventory.id} no longer exists.")
    inventory = locked_inventory

    on_hand = max(0.0, float(inventory.quantity or 0))
    layers = session.exec(
        select(InventoryCostLayer)
        .where(
            InventoryCostLayer.inventory_id == inventory.id,
            InventoryCostLayer.quantity_remaining > 0,
        )
        .order_by(
            InventoryCostLayer.received_at,
            InventoryCostLayer.created_at,
            InventoryCostLayer.id,
        )
        .with_for_update()
    ).all()

    layered_quantity = sum(max(0.0, float(layer.quantity_remaining or 0)) for layer in layers)
    if layered_quantity > on_hand:
        excess = layered_quantity - on_hand
        for layer in reversed(layers):
            if excess <= 0:
                break
            reduction = min(excess, float(layer.quantity_remaining or 0))
            if reduction <= 0:
                continue
            layer.quantity_remaining -= reduction
            session.add(layer)
            _add_consumption(
                session,
                inventory,
                layer,
                reduction,
                "stock_reconciliation",
                inventory.id,
                company_id,
            )
            excess -= reduction
        layers = [layer for layer in layers if layer.quantity_remaining > 0]
        layered_quantity = on_hand

    if layered_quantity < on_hand:
        session.add(
            InventoryCostLayer(
                inventory_id=inventory.id,
                procurement_order_line_id=None,
                source_type="opening_balance",
                source_reference_id=inventory.id,
                quantity_received=on_hand - layered_quantity,
                quantity_remaining=on_hand - layered_quantity,
                unit_cost=fallback_unit_cost(session, inventory),
                received_at=inventory.created_at or datetime.utcnow(),
                company_id=company_id or inventory.company_id,
            )
        )
        session.flush()
        layers = session.exec(
            select(InventoryCostLayer)
            .where(
                InventoryCostLayer.inventory_id == inventory.id,
                InventoryCostLayer.quantity_remaining > 0,
            )
            .order_by(
                InventoryCostLayer.received_at,
                InventoryCostLayer.created_at,
                InventoryCostLayer.id,
            )
            .with_for_update()
        ).all()

    available_to_consume = min(quantity, on_hand)
    remaining = available_to_consume
    total_cost = 0.0
    unknown_quantity = 0

    for layer in layers:
        if remaining <= 0:
            break
        taken = min(remaining, float(layer.quantity_remaining or 0))
        if taken <= 0:
            continue
        layer.quantity_remaining -= taken
        session.add(layer)
        extended_cost, unknown = _add_consumption(
            session,
            inventory,
            layer,
            taken,
            reference_type,
            reference_id,
            company_id,
        )
        if extended_cost is not None:
            total_cost += extended_cost
        unknown_quantity += unknown
        remaining -= taken

    if remaining > 0:
        extended_cost, unknown = _add_consumption(
            session,
            inventory,
            None,
            remaining,
            reference_type,
            reference_id,
            company_id,
        )
        if extended_cost is not None:
            total_cost += extended_cost
        unknown_quantity += unknown

    short_quantity = quantity - available_to_consume
    if short_quantity > 0:
        _, unknown = _add_consumption(
            session,
            inventory,
            None,
            short_quantity,
            reference_type,
            reference_id,
            company_id,
        )
        unknown_quantity += unknown

    inventory.quantity = on_hand - available_to_consume
    session.add(inventory)
    if str(getattr(inventory, "type", "") or "").lower() in {"product", "resource", "item"}:
        try:
            from backend.inventory_replenishment import maybe_generate_immediate_draft
        except ModuleNotFoundError:
            from inventory_replenishment import maybe_generate_immediate_draft
        maybe_generate_immediate_draft(session, inventory)
    return {
        "quantity_consumed": quantity,
        "cost_amount": None if unknown_quantity else total_cost,
        "known_cost_amount": total_cost,
        "unknown_quantity": unknown_quantity,
        "short_quantity": short_quantity,
    }


def add_inventory_cost_layer(
    session: Session,
    inventory: Inventory,
    quantity: float,
    unit_cost: Optional[float],
    source_type: str,
    source_reference_id: Optional[UUID],
    company_id: Optional[str] = None,
) -> None:
    if quantity <= 0:
        return
    session.add(
        InventoryCostLayer(
            inventory_id=inventory.id,
            procurement_order_line_id=None,
            source_type=source_type,
            source_reference_id=source_reference_id,
            quantity_received=quantity,
            quantity_remaining=quantity,
            unit_cost=unit_cost,
            received_at=datetime.utcnow(),
            company_id=company_id or inventory.company_id,
        )
    )
