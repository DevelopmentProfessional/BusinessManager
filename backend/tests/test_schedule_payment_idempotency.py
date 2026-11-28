import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.models import SaleTransaction, Schedule, UserRole
from backend.routers import isud


class _Result:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value


class _DuplicateSaleSession:
    def __init__(self, schedule, sale):
        self.schedule = schedule
        self.sale = sale
        self.exec_count = 0
        self.added = []
        self.commit_count = 0
        self.locked = False

    def execute(self, statement, parameters=None):
        assert "pg_advisory_xact_lock" in str(statement)
        assert parameters == {"schedule_id": str(self.schedule.id)}
        self.locked = True

    def exec(self, _statement):
        self.exec_count += 1
        return _Result(self.schedule if self.exec_count == 1 else self.sale)

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commit_count += 1

    def rollback(self):
        return None

    def refresh(self, _value):
        return None


def _request():
    return Request({"type": "http", "method": "POST", "path": "/api/v1/isud/sale_transaction", "headers": []})


def _admin(company_id):
    return SimpleNamespace(role=UserRole.ADMIN, company_id=company_id)


def test_duplicate_schedule_payment_reuses_purchase_history_transaction():
    company_id = "company-a"
    schedule = Schedule(
        id=uuid4(),
        employee_id=uuid4(),
        appointment_date="2026-09-11T10:00:00",
        is_paid=True,
        company_id=company_id,
    )
    sale = SaleTransaction(
        id=uuid4(),
        client_id=uuid4(),
        employee_id=uuid4(),
        subtotal=500,
        tax_amount=0,
        total=500,
        payment_method="cash",
        schedule_id=schedule.id,
        company_id=company_id,
    )
    schedule.sale_transaction_id = sale.id
    session = _DuplicateSaleSession(schedule, sale)

    result = asyncio.run(
        isud.insert(
            "sale_transaction",
            {
                "client_id": str(sale.client_id),
                "employee_id": str(sale.employee_id),
                "subtotal": 500,
                "discount_amount": 0,
                "tax_amount": 0,
                "total": 500,
                "payment_method": "card",
                "schedule_id": str(schedule.id),
            },
            _request(),
            session,
            _admin(company_id),
        )
    )

    assert session.locked is True
    assert session.commit_count == 1
    assert sale.payment_method == "card"
    assert schedule.sale_transaction_id == sale.id
    assert result["id"] == str(sale.id)
    assert result["reused_existing"] is True
    assert result["duplicate_payment_rejected"] is True


def test_pending_schedule_payment_rejects_second_checkout():
    company_id = "company-a"
    schedule = Schedule(
        id=uuid4(),
        employee_id=uuid4(),
        appointment_date="2026-09-11T10:00:00",
        is_paid=False,
        company_id=company_id,
    )
    sale = SaleTransaction(
        id=uuid4(),
        subtotal=500,
        tax_amount=0,
        total=500,
        payment_method="card",
        schedule_id=schedule.id,
        company_id=company_id,
    )
    session = _DuplicateSaleSession(schedule, sale)

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            isud.insert(
                "sale_transaction",
                {"total": 500, "payment_method": "card", "schedule_id": str(schedule.id)},
                _request(),
                session,
                _admin(company_id),
            )
        )

    assert error.value.status_code == 409
    assert "already in progress" in error.value.detail
