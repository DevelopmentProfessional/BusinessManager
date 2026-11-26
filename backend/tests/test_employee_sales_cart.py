from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import EmployeeSalesCartItem, EmployeeSalesCartItemUpsert
from backend.routers import auth
from backend.routers.employee_sales_cart import (
    clear_employee_sales_cart,
    get_employee_sales_cart,
    remove_employee_sales_cart_item,
    upsert_employee_sales_cart_item,
)


class _QueryResult:
    def __init__(self, rows=None, first=None):
        self.rows = rows or []
        self.first_row = first

    def all(self):
        return self.rows

    def first(self):
        return self.first_row


class _CartSession:
    def __init__(self, *, rows=None, first=None):
        self.rows = rows or []
        self.first_row = first
        self.queries = []
        self.added = []
        self.deleted = []

    def exec(self, query):
        self.queries.append(query)
        return _QueryResult(self.rows, self.first_row)

    def add(self, item):
        self.added.append(item)

    def delete(self, item):
        self.deleted.append(item)

    def commit(self):
        return None

    def refresh(self, _item):
        return None

    def rollback(self):
        return None


def _assert_employee_company_scope(query, company_id, employee_id):
    params = query.compile().params
    assert company_id in params.values()
    assert employee_id in params.values()


def test_employee_sales_cart_reads_and_writes_are_scoped_to_authenticated_employee(monkeypatch):
    company_id = "company-a"
    employee_id = uuid4()
    user = SimpleNamespace(id=employee_id, role=auth.UserRole.MANAGER, role_id=None, company_id=company_id)
    session = _CartSession()
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["sales:read", "sales:write"])

    assert get_employee_sales_cart(session, user) == []
    _assert_employee_company_scope(session.queries[-1], company_id, employee_id)

    item_data = EmployeeSalesCartItemUpsert(
        cart_key="product-1",
        item_type="product",
        item_name="Product",
        unit_price=10,
        quantity=2,
        line_total=20,
    )
    upsert_employee_sales_cart_item(item_data, session, user)
    _assert_employee_company_scope(session.queries[-1], company_id, employee_id)
    saved_item = session.added[-1]
    assert saved_item.company_id == company_id
    assert saved_item.employee_id == employee_id


def test_employee_sales_cart_delete_operations_keep_company_and_employee_scope(monkeypatch):
    company_id = "company-a"
    employee_id = uuid4()
    user = SimpleNamespace(id=employee_id, role=auth.UserRole.MANAGER, role_id=None, company_id=company_id)
    item = EmployeeSalesCartItem(
        company_id=company_id,
        employee_id=employee_id,
        cart_key="product-1",
        item_type="product",
        item_name="Product",
    )
    session = _CartSession(rows=[item], first=item)
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["sales:write"])

    remove_employee_sales_cart_item("product-1", session, user)
    _assert_employee_company_scope(session.queries[-1], company_id, employee_id)
    assert session.deleted == [item]

    clear_employee_sales_cart(session, user)
    _assert_employee_company_scope(session.queries[-1], company_id, employee_id)
    assert session.deleted[-1] is item


def test_employee_sales_cart_requires_sales_write_permission(monkeypatch):
    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None, company_id="company-a")
    session = _CartSession()
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["sales:read"])

    with pytest.raises(HTTPException) as error:
        clear_employee_sales_cart(session, user)

    assert error.value.status_code == 403
