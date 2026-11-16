from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import UserRole
from backend.routers import financial, isud


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
        self.committed = False
        self.rolled_back = False

    def exec(self, _statement):
        return Result(next(self.results))

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, _value):
        return None


def _receiving_setup(quantity_ordered=10):
    company_id = "company-1"
    po = SimpleNamespace(
        id=uuid4(),
        company_id=company_id,
        status="sent",
        actual_delivery_date=None,
        total_amount=25.0,
        import_tax=0.0,
        shipping_cost=0.0,
        po_number="PO-1",
        supplier_id=uuid4(),
        order_date=None,
        expected_delivery_date=None,
        notes=None,
        created_at=None,
    )
    line = SimpleNamespace(
        id=uuid4(),
        po_id=po.id,
        inventory_id=uuid4(),
        supplier_product_id=uuid4(),
        quantity_ordered=quantity_ordered,
        quantity_received=0,
        unit_price=2.5,
        line_total=quantity_ordered * 2.5,
        units_per_purchase_unit=6,
        purchase_unit="case",
        notes=None,
    )
    inventory = SimpleNamespace(id=line.inventory_id, quantity=10, updated_at=None)
    user = SimpleNamespace(role=UserRole.ADMIN, company_id=company_id)
    return po, line, inventory, user


def test_receive_purchase_order_adds_converted_stock_and_actual_cost_layer():
    po, line, inventory, user = _receiving_setup()
    session = Session([po, [line], inventory, [line]])

    result = financial.receive_purchase_order(
        po.id,
        {"items": [{"line_id": str(line.id), "quantity": 2, "unit_price": 3.0}]},
        session,
        user,
    )

    cost_layers = [row for row in session.added if row.__class__.__name__ == "InventoryCostLayer"]
    assert inventory.quantity == 22
    assert line.quantity_received == 2
    assert po.status == "partially_received"
    assert len(cost_layers) == 1
    assert cost_layers[0].quantity_received == 12
    assert cost_layers[0].unit_cost == pytest.approx(0.5)
    assert result["status"] == "partially_received"
    assert session.committed


def test_receive_purchase_order_rejects_receipt_above_remaining_quantity():
    po, line, inventory, user = _receiving_setup(quantity_ordered=1)
    session = Session([po, [line]])

    with pytest.raises(HTTPException) as exc_info:
        financial.receive_purchase_order(
            po.id,
            {"items": [{"line_id": str(line.id), "quantity": 2}]},
            session,
            user,
        )

    assert exc_info.value.status_code == 400
    assert session.rolled_back
    assert not session.committed
    assert inventory.quantity == 10


def test_inventory_write_all_permission_can_receive_purchase_orders(monkeypatch):
    monkeypatch.setattr(
        financial,
        "get_user_permissions_list",
        lambda _user, _session: ["inventory:write_all"],
    )

    financial._require_procurement_permission(
        SimpleNamespace(role=None),
        None,
        ("inventory",),
        "write",
    )


def test_inventory_creation_links_preferred_supplier_catalog_product():
    supplier_id = uuid4()
    inventory = SimpleNamespace(id=uuid4(), supplier_id=supplier_id)
    supplier = SimpleNamespace(company_id="company-1")

    class LinkSession:
        def __init__(self):
            self.results = iter([Result(None), Result([])])
            self.added = []

        def get(self, _model, _record_id):
            return supplier

        def exec(self, _statement):
            return next(self.results)

        def add(self, value):
            self.added.append(value)

    session = LinkSession()

    isud._save_inventory_supplier_product(
        session,
        inventory,
        {
            "supplier_id": str(supplier_id),
            "purchase_unit": "case",
            "units_per_purchase_unit": 6,
            "unit_price": 12.5,
        },
        "company-1",
    )

    assert len(session.added) == 1
    product = session.added[0]
    assert product.supplier_id == supplier_id
    assert product.inventory_id == inventory.id
    assert product.purchase_unit == "case"
    assert product.units_per_purchase_unit == 6
    assert product.unit_price == pytest.approx(12.5)
    assert product.is_preferred
