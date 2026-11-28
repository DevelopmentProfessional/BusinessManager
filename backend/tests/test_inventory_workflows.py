import json
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import UserRole
from backend.routers import isud, portal_orders, production


class Result:
    def __init__(self, value):
        self.value = value

    def all(self):
        return self.value


class Session:
    def __init__(self, records=None, results=()):
        self.records = records or {}
        self.results = iter(results)
        self.exec_calls = 0
        self.added = []

    def get(self, _model, record_id):
        return self.records.get(record_id)

    def exec(self, _statement):
        self.exec_calls += 1
        return Result(next(self.results))

    def add(self, record):
        self.added.append(record)


def test_sale_inventory_consumption_is_idempotent():
    sale_id = uuid4()
    sale = SimpleNamespace(inventory_consumed_at=datetime.now())
    session = Session(records={sale_id: sale})

    isud._consume_sale_transaction_inventory(session, sale_id)

    assert session.exec_calls == 0


def test_service_sale_consumes_both_linked_included_item_types(monkeypatch):
    sale_id = uuid4()
    service_id = uuid4()
    resource_id = uuid4()
    product_id = uuid4()
    sale = SimpleNamespace(
        id=sale_id,
        company_id="company-1",
        inventory_consumed_at=None,
    )
    sale_item = SimpleNamespace(
        id=uuid4(),
        item_type="service",
        item_id=service_id,
        quantity=2,
        options_json=json.dumps(
            [
                {
                    "linked_inventory_id": str(resource_id),
                    "linked_product_id": str(product_id),
                    "consume_inventory": True,
                    "consume_quantity_per_unit": 1,
                    "quantity": 2,
                }
            ]
        ),
    )
    session = Session(
        records={
            sale_id: sale,
            resource_id: SimpleNamespace(id=resource_id),
            product_id: SimpleNamespace(id=product_id),
        },
        results=(
            [sale_item],
            [],
            [SimpleNamespace(resource_id=resource_id, quantity_per_batch=0.5)],
        ),
    )
    consumed = []
    monkeypatch.setattr(
        isud,
        "consume_inventory_fifo",
        lambda _session, inventory, quantity, *_args, **_kwargs: consumed.append(
            (inventory.id, quantity)
        ),
    )

    isud._consume_sale_transaction_inventory(session, sale_id)

    assert dict(consumed) == {resource_id: 6, product_id: 4}


def test_inventory_adjustment_requires_a_reason_before_database_access():
    inventory_id = uuid4()
    user = SimpleNamespace(role=UserRole.ADMIN)
    session = Session()

    with pytest.raises(HTTPException) as exc_info:
        isud.adjust_inventory_stock(
            inventory_id,
            {"quantity_delta": 1},
            session,
            user,
        )

    assert exc_info.value.status_code == 400
    assert "reason is required" in exc_info.value.detail
    assert session.exec_calls == 0


def test_stock_adjustment_permission_rejects_users_without_inventory_write(monkeypatch):
    monkeypatch.setattr(isud, "get_user_permissions_list", lambda _user, _session: [])

    with pytest.raises(HTTPException) as exc_info:
        isud._require_stock_adjustment_permission(
            SimpleNamespace(role="employee"),
            None,
        )

    assert exc_info.value.status_code == 403


def test_portal_order_fulfillment_consumes_product_stock_through_fifo(monkeypatch):
    inventory_id = uuid4()
    order_id = uuid4()
    order = SimpleNamespace(id=order_id, company_id="company-1", inventory_deducted_at=None)
    inventory = SimpleNamespace(id=inventory_id, quantity=3)
    order_item = SimpleNamespace(
        item_type="product",
        item_id=inventory_id,
        quantity=2,
        options_json=None,
    )
    session = Session(records={inventory_id: inventory}, results=([order_item], []))
    consumed = []
    monkeypatch.setattr(
        portal_orders,
        "consume_inventory_fifo",
        lambda *args, **kwargs: consumed.append((args, kwargs)),
    )

    portal_orders._deduct_inventory_for_order(session, order)

    assert len(consumed) == 1
    assert consumed[0][0][2] == 2
    assert consumed[0][1]["reference_type"] == "client_order"
    assert order.inventory_deducted_at is not None


def test_production_task_cannot_be_completed_twice():
    schedule_id = uuid4()
    schedule = SimpleNamespace(id=schedule_id, status="completed")
    session = Session(records={schedule_id: schedule})

    with pytest.raises(HTTPException) as exc_info:
        production.complete_production_task(
            schedule_id,
            session,
            SimpleNamespace(),
        )

    assert exc_info.value.status_code == 409
