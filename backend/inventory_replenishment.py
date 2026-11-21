"""Usage-based inventory thresholds and supplier-grouped draft purchase orders."""

import logging
import math
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import uuid4

from sqlalchemy import func, text
from sqlmodel import Session, select

try:
    from backend.models import (
        AppSettings,
        Inventory,
        InventoryCostConsumption,
        ProcurementOrder,
        ProcurementOrderLine,
        ProductResource,
        Supplier,
        SupplierProduct,
    )
except ModuleNotFoundError:
    from models import (
        AppSettings,
        Inventory,
        InventoryCostConsumption,
        ProcurementOrder,
        ProcurementOrderLine,
        ProductResource,
        Supplier,
        SupplierProduct,
    )

logger = logging.getLogger(__name__)

SCHEDULE_DAYS = {
    "daily": 1,
    "weekly": 7,
    "monthly": 30,
    "quarterly": 91,
    "semiannual": 182,
    "annual": 365,
}
DEMAND_REFERENCE_TYPES = ("sale", "client_order", "production_task", "feature_deduction")
OPEN_ORDER_STATUSES = ("draft", "sent", "confirmed", "partially_received")
MIN_USAGE_HISTORY_DAYS = 28


def estimate_daily_usage(
    session: Session,
    inventory: Inventory,
    now: Optional[datetime] = None,
) -> Optional[float]:
    """Estimate daily demand after sufficient history, weighting recent trends."""
    now = now or datetime.utcnow()
    rows = session.exec(
        select(InventoryCostConsumption).where(
            InventoryCostConsumption.inventory_id == inventory.id,
            InventoryCostConsumption.reference_type.in_(DEMAND_REFERENCE_TYPES),
            InventoryCostConsumption.created_at >= now - timedelta(days=395),
        )
    ).all()
    rows = [row for row in rows if row.created_at and float(row.quantity or 0) > 0]
    if not rows:
        return None

    first_use = min(row.created_at for row in rows)
    if (now - first_use).days < MIN_USAGE_HISTORY_DAYS:
        return None
    active_days = {row.created_at.date() for row in rows}
    if len(active_days) < 3:
        return None

    daily_totals: dict[date, float] = defaultdict(float)
    for row in rows:
        daily_totals[row.created_at.date()] += float(row.quantity)

    recent_start = (now - timedelta(days=30)).date()
    prior_start = (now - timedelta(days=90)).date()
    recent = sum(value for day, value in daily_totals.items() if day >= recent_start) / 30
    prior = sum(value for day, value in daily_totals.items() if prior_start <= day < recent_start) / 60
    trend_rate = 0.7 * recent + 0.3 * prior

    year_start = (now - timedelta(days=395)).date()
    year_end = (now - timedelta(days=365)).date()
    comparable_year_usage = sum(
        value for day, value in daily_totals.items() if year_start <= day < year_end
    ) / 30
    has_year_comparison = any(year_start <= day < year_end for day in daily_totals)
    rate = 0.8 * trend_rate + 0.2 * comparable_year_usage if has_year_comparison else trend_rate
    return max(0.0, rate)


def refresh_automatic_thresholds(
    session: Session,
    company_id: str,
    now: Optional[datetime] = None,
) -> None:
    """Refresh automatic stock thresholds, leaving insufficient history unset."""
    items = session.exec(
        select(Inventory).where(
            Inventory.company_id == company_id,
            func.lower(Inventory.type).in_(("product", "resource", "item")),
            Inventory.auto_min_stock_level == True,
        )
    ).all()
    for inventory in items:
        daily_usage = estimate_daily_usage(session, inventory, now)
        if daily_usage is None:
            inventory.min_stock_level = None
            inventory.updated_at = now or datetime.utcnow()
            session.add(inventory)
            continue
        lead_days = max(7, int(inventory.procurement_lead_days or 0))
        inventory.min_stock_level = math.ceil(daily_usage * lead_days * 100) / 100
        inventory.updated_at = now or datetime.utcnow()
        session.add(inventory)


def _choose_supplier(
    session: Session,
    inventory: Inventory,
    company_id: str,
) -> Optional[tuple[Supplier, Optional[SupplierProduct], str, int, float]]:
    products = session.exec(
        select(SupplierProduct).where(
            SupplierProduct.inventory_id == inventory.id,
            SupplierProduct.company_id == company_id,
        )
    ).all()
    candidates = []
    for product in products:
        supplier = session.exec(
            select(Supplier).where(
                Supplier.id == product.supplier_id,
                Supplier.company_id == company_id,
            )
        ).first()
        if supplier:
            pack_size = max(1, int(inventory.units_per_purchase_unit or 1))
            candidates.append((
                supplier,
                product,
                inventory.purchase_unit or "unit",
                pack_size,
                float(inventory.cost or 0) * pack_size,
            ))
    if candidates:
        candidates.sort(
            key=lambda row: (
                not bool(row[1].is_preferred),
                row[4] / row[3],
                row[0].name.lower(),
            )
        )
        return candidates[0]

    if inventory.supplier_id:
        supplier = session.exec(
            select(Supplier).where(
                Supplier.id == inventory.supplier_id,
                Supplier.company_id == company_id,
            )
        ).first()
        if supplier:
            pack_size = max(1, int(inventory.units_per_purchase_unit or 1))
            return (
                supplier,
                None,
                inventory.purchase_unit or "unit",
                pack_size,
                float(inventory.cost or 0) * pack_size,
            )
    return None


def generate_draft_purchase_orders(
    session: Session,
    company_id: str,
    *,
    scheduled: bool,
    frequency: str = "monthly",
    inventory_ids: Optional[list] = None,
    now: Optional[datetime] = None,
) -> list[ProcurementOrder]:
    """Create or extend supplier-grouped draft orders for items needing replenishment."""
    now = now or datetime.utcnow()
    period_days = SCHEDULE_DAYS.get(frequency, SCHEDULE_DAYS["monthly"]) if scheduled else 0
    query = select(Inventory).where(
        Inventory.company_id == company_id,
        func.lower(Inventory.type).in_(("product", "resource", "item")),
    )
    if inventory_ids is not None:
        query = query.where(Inventory.id.in_(inventory_ids))
    items = session.exec(query).all()

    open_orders = session.exec(
        select(ProcurementOrder).where(
            ProcurementOrder.company_id == company_id,
            ProcurementOrder.status.in_(OPEN_ORDER_STATUSES),
        )
    ).all()
    order_ids = [order.id for order in open_orders]
    open_lines = session.exec(
        select(ProcurementOrderLine).where(ProcurementOrderLine.po_id.in_(order_ids))
    ).all() if order_ids else []
    order_by_id = {order.id: order for order in open_orders}
    lines_by_item: dict = defaultdict(list)
    for line in open_lines:
        order = order_by_id.get(line.po_id)
        if order:
            lines_by_item[line.inventory_id].append((order, line))

    created_or_updated = {}
    for inventory in items:
        if str(inventory.type or "").lower() == "product":
            has_recipe = session.exec(
                select(ProductResource.id).where(ProductResource.inventory_id == inventory.id)
            ).first()
            if has_recipe:
                continue

        daily_usage = estimate_daily_usage(session, inventory, now)
        if inventory.auto_min_stock_level:
            if daily_usage is None:
                inventory.min_stock_level = None
                inventory.updated_at = now
                session.add(inventory)
                continue
            lead_days = max(7, int(inventory.procurement_lead_days or 0))
            inventory.min_stock_level = math.ceil(daily_usage * lead_days * 100) / 100
            inventory.updated_at = now
            session.add(inventory)

        threshold = inventory.min_stock_level
        if threshold is None:
            continue
        on_hand = max(0.0, float(inventory.quantity or 0))
        if not scheduled and on_hand > threshold:
            continue

        supplier_choice = _choose_supplier(session, inventory, company_id)
        if supplier_choice is None:
            logger.warning(
                "No supplier configured for low-stock inventory item %s (%s)",
                inventory.id,
                inventory.name,
            )
            continue
        supplier, supplier_product, purchase_unit, pack_size, unit_price = supplier_choice

        inbound_stock = sum(
            max(0, line.quantity_ordered - line.quantity_received)
            * max(1, int(line.units_per_purchase_unit or 1))
            for _, line in lines_by_item.get(inventory.id, [])
        )
        lead_days = max(0, int(inventory.procurement_lead_days or 0))
        forecast_days = lead_days + period_days
        expected_usage = (daily_usage or 0.0) * forecast_days
        minimum_order_stock = pack_size
        target_stock = threshold + max(expected_usage, minimum_order_stock)
        stock_gap = target_stock - on_hand - inbound_stock
        if stock_gap <= 0:
            continue
        purchase_quantity = max(1, math.ceil(stock_gap / pack_size))

        existing_draft = next(
            (
                order for order in open_orders
                if order.supplier_id == supplier.id and order.status == "draft"
            ),
            None,
        )
        matching_line = next(
            (
                line for order, line in lines_by_item.get(inventory.id, [])
                if order.id == existing_draft.id
                and line.supplier_product_id == (supplier_product.id if supplier_product else None)
            ),
            None,
        ) if existing_draft else None

        if matching_line:
            matching_line.quantity_ordered += purchase_quantity
            matching_line.line_total = matching_line.quantity_ordered * matching_line.unit_price
            session.add(matching_line)
            existing_draft.total_amount += purchase_quantity * unit_price
            session.add(existing_draft)
            created_or_updated[existing_draft.id] = existing_draft
            continue

        if not existing_draft:
            existing_draft = ProcurementOrder(
                po_number=f"PO-AUTO-{now:%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}",
                supplier_id=supplier.id,
                order_date=now,
                expected_delivery_date=now + timedelta(days=lead_days),
                status="draft",
                created_by=None,
                notes="Automatically generated draft. Review quantities and package pricing before sending.",
                company_id=company_id,
            )
            session.add(existing_draft)
            session.flush()
            open_orders.append(existing_draft)
            order_by_id[existing_draft.id] = existing_draft

        line = ProcurementOrderLine(
            po_id=existing_draft.id,
            inventory_id=inventory.id,
            supplier_product_id=supplier_product.id if supplier_product else None,
            quantity_ordered=purchase_quantity,
            quantity_received=0,
            unit_price=unit_price,
            line_total=purchase_quantity * unit_price,
            purchase_unit=purchase_unit,
            units_per_purchase_unit=pack_size,
        )
        session.add(line)
        lines_by_item[inventory.id].append((existing_draft, line))
        existing_draft.total_amount += line.line_total
        session.add(existing_draft)
        created_or_updated[existing_draft.id] = existing_draft

    return list(created_or_updated.values())


def maybe_generate_immediate_draft(session: Session, inventory: Inventory) -> None:
    """Trigger immediate-mode replenishment after tracked stock is consumed."""
    if not inventory.company_id or str(inventory.type or "").lower() not in {"product", "resource", "item"}:
        return
    settings = session.exec(
        select(AppSettings).where(AppSettings.company_id == inventory.company_id)
    ).first()
    if not settings or settings.inventory_po_generation_mode not in {"immediate", "both"}:
        return
    generate_draft_purchase_orders(
        session,
        inventory.company_id,
        scheduled=False,
        inventory_ids=[inventory.id],
    )


def run_scheduled_replenishment(session: Session, now: Optional[datetime] = None) -> int:
    """Run due company schedules once, using a transaction advisory lock for workers."""
    now = now or datetime.utcnow()
    acquired = session.execute(text("SELECT pg_try_advisory_xact_lock(684215903)")).scalar_one()
    if not acquired:
        return 0

    settings_rows = session.exec(select(AppSettings)).all()
    generated_count = 0
    for settings in settings_rows:
        if settings.company_id:
            refresh_automatic_thresholds(session, settings.company_id, now)
        if settings.inventory_po_generation_mode not in {"scheduled", "both"}:
            continue
        period_days = SCHEDULE_DAYS.get(settings.inventory_po_frequency, 30)
        if settings.inventory_po_last_run_at and now - settings.inventory_po_last_run_at < timedelta(days=period_days):
            continue
        if not settings.company_id:
            logger.warning("Skipping scheduled replenishment for settings row %s without a company", settings.id)
            continue
        orders = generate_draft_purchase_orders(
            session,
            settings.company_id,
            scheduled=True,
            frequency=settings.inventory_po_frequency,
            now=now,
        )
        settings.inventory_po_last_run_at = now
        settings.updated_at = now
        session.add(settings)
        generated_count += len(orders)
    session.commit()
    return generated_count
