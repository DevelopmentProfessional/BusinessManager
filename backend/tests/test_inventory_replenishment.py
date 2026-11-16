from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.inventory_costing import consume_inventory_fifo
from backend.inventory_replenishment import (
    estimate_daily_usage,
    generate_draft_purchase_orders,
    refresh_automatic_thresholds,
)
from backend.models import InventoryCostConsumption, InventoryCostLayer, ProcurementOrder, ProcurementOrderLine


class Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class Session:
    def __init__(self, results):
        self.results = iter(results)
        self.added = []

    def exec(self, _statement):
        return Result(next(self.results))

    def add(self, value):
        self.added.append(value)

    def flush(self):
        pass


def test_fifo_consumption_preserves_fractional_resource_stock():
    inventory_id = uuid4()
    inventory = SimpleNamespace(
        id=inventory_id,
        type="resource",
        quantity=1.5,
        cost=None,
        company_id="company-1",
        created_at=None,
    )
    layer = InventoryCostLayer(
        inventory_id=inventory_id,
        quantity_received=1.5,
        quantity_remaining=1.5,
        unit_cost=2.0,
    )
    session = Session([inventory, [layer], None])

    result = consume_inventory_fifo(
        session,
        inventory,
        0.25,
        reference_type="sale",
        reference_id=uuid4(),
    )

    assert inventory.quantity == pytest.approx(1.25)
    assert layer.quantity_remaining == pytest.approx(1.25)
    assert result["cost_amount"] == pytest.approx(0.5)
    consumption = next(row for row in session.added if isinstance(row, InventoryCostConsumption))
    assert consumption.quantity == pytest.approx(0.25)


def test_usage_threshold_waits_for_sufficient_history_then_calculates():
    now = datetime(2026, 6, 30)
    inventory = SimpleNamespace(
        id=uuid4(),
        type="resource",
        auto_min_stock_level=True,
        min_stock_level=None,
        procurement_lead_days=14,
        updated_at=None,
    )
    recent_rows = [
        SimpleNamespace(created_at=now - timedelta(days=day), quantity=0.5)
        for day in range(1, 31)
    ]

    insufficient = Session([recent_rows[:2]])
    assert estimate_daily_usage(insufficient, inventory, now) is None

    session = Session([[inventory], recent_rows])
    refresh_automatic_thresholds(session, "company-1", now)

    assert inventory.min_stock_level == pytest.approx(4.9)
    assert inventory.updated_at == now


def test_low_stock_creates_supplier_linked_draft_purchase_order():
    supplier_id = uuid4()
    inventory = SimpleNamespace(
        id=uuid4(),
        type="resource",
        name="Shampoo",
        company_id="company-1",
        quantity=1.0,
        min_stock_level=2.0,
        auto_min_stock_level=False,
        procurement_lead_days=0,
        supplier_id=supplier_id,
        cost=3.0,
    )
    supplier = SimpleNamespace(id=supplier_id, company_id="company-1", name="Supplier")
    now = datetime(2026, 6, 30)
    session = Session([[inventory], [], [], [], supplier])

    orders = generate_draft_purchase_orders(
        session,
        "company-1",
        scheduled=False,
        now=now,
    )

    assert len(orders) == 1
    order = orders[0]
    assert isinstance(order, ProcurementOrder)
    assert order.status == "draft"
    assert order.supplier_id == supplier_id
    line = next(row for row in session.added if isinstance(row, ProcurementOrderLine))
    assert line.quantity_ordered == 2
    assert line.inventory_id == inventory.id
    assert line.line_total == pytest.approx(6.0)
