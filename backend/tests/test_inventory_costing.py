from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.inventory_costing import consume_inventory_fifo, create_opening_stock_layer
from backend.models import InventoryCostConsumption, InventoryCostLayer


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


def test_consume_inventory_fifo_uses_oldest_layers_first():
    inventory_id = uuid4()
    inventory = SimpleNamespace(id=inventory_id, quantity=4, cost=None, company_id="company-1", created_at=None)
    oldest = InventoryCostLayer(
        inventory_id=inventory_id,
        quantity_received=2,
        quantity_remaining=2,
        unit_cost=1.5,
    )
    newest = InventoryCostLayer(
        inventory_id=inventory_id,
        quantity_received=2,
        quantity_remaining=2,
        unit_cost=3.0,
    )
    session = Session([inventory, [oldest, newest]])

    result = consume_inventory_fifo(
        session,
        inventory,
        3,
        reference_type="test",
        reference_id=uuid4(),
    )

    assert inventory.quantity == 1
    assert oldest.quantity_remaining == 0
    assert newest.quantity_remaining == 1
    assert result["cost_amount"] == pytest.approx(6.0)
    consumptions = [row for row in session.added if row.__class__.__name__ == "InventoryCostConsumption"]
    assert [row.quantity for row in consumptions] == [2, 1]


def test_consume_inventory_fifo_preserves_unknown_cost_as_unknown():
    inventory_id = uuid4()
    inventory = SimpleNamespace(id=inventory_id, quantity=1, cost=None, company_id="company-1", created_at=None)
    unknown_layer = InventoryCostLayer(
        inventory_id=inventory_id,
        quantity_received=1,
        quantity_remaining=1,
        unit_cost=None,
    )
    session = Session([inventory, [unknown_layer]])

    result = consume_inventory_fifo(
        session,
        inventory,
        1,
        reference_type="test",
        reference_id=uuid4(),
    )

    assert inventory.quantity == 0
    assert result["cost_amount"] is None
    assert result["unknown_quantity"] == 1


def test_consume_inventory_fifo_records_unavailable_stock_as_uncosted_shortfall():
    inventory_id = uuid4()
    inventory = SimpleNamespace(id=inventory_id, quantity=1, cost=2.0, company_id="company-1", created_at=None)
    only_layer = InventoryCostLayer(
        inventory_id=inventory_id,
        quantity_received=1,
        quantity_remaining=1,
        unit_cost=2.0,
    )
    session = Session([inventory, [only_layer]])

    result = consume_inventory_fifo(
        session,
        inventory,
        2,
        reference_type="test",
        reference_id=uuid4(),
    )

    assert inventory.quantity == 0
    assert result["short_quantity"] == 1
    assert result["unknown_quantity"] == 1
    assert result["cost_amount"] is None
    shortfall = [
        row for row in session.added
        if isinstance(row, InventoryCostConsumption) and row.cost_layer_id is None
    ]
    assert [(row.quantity, row.extended_cost) for row in shortfall] == [(1, None)]


def test_create_opening_stock_layer_preserves_unknown_legacy_cost():
    inventory_id = uuid4()
    inventory = SimpleNamespace(
        id=inventory_id,
        quantity=4,
        cost=None,
        type="resource",
        company_id="company-1",
        created_at=None,
    )
    session = Session([None])

    create_opening_stock_layer(session, inventory)

    assert len(session.added) == 1
    layer = session.added[0]
    assert isinstance(layer, InventoryCostLayer)
    assert layer.source_type == "opening_balance"
    assert layer.source_reference_id == inventory_id
    assert layer.quantity_received == layer.quantity_remaining == 4
    assert layer.unit_cost is None
