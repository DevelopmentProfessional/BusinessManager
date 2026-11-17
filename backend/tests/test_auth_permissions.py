import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import PermissionType, User, UserPermission, UserPermissionCreate
from backend.routers import auth


class _Result:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value


class _PermissionSession:
    def __init__(self, target_user, existing_permission=None):
        self.target_user = target_user
        self.existing_permission = existing_permission
        self.added = []
        self.commit_count = 0

    def get(self, model, record_id):
        if model is User and record_id == self.target_user.id:
            return self.target_user
        return None

    def exec(self, _query):
        return _Result(self.existing_permission)

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commit_count += 1

    def refresh(self, _value):
        return None


class _EmptyPermissionSession:
    def exec(self, _query):
        return SimpleNamespace(all=lambda: [])

    def get(self, _model, _record_id):
        return None


def _admin(company_id):
    return SimpleNamespace(
        id=uuid4(),
        role=auth.UserRole.ADMIN,
        role_id=None,
        company_id=company_id,
    )


def test_create_approve_payments_permission_uses_enum_and_company_scope():
    company_id = "company-a"
    target_user = SimpleNamespace(id=uuid4(), company_id=company_id)
    session = _PermissionSession(target_user)

    result = auth.create_user_permission(
        str(target_user.id),
        UserPermissionCreate(page="schedule", permission="approve_payments", granted=True),
        _admin(company_id),
        session,
    )

    created = session.added[-1]
    assert created.permission is PermissionType.APPROVE_PAYMENTS
    assert created.company_id == company_id
    assert result.permission is PermissionType.APPROVE_PAYMENTS
    assert result.granted is True


def test_create_permission_regrants_existing_denied_permission():
    company_id = "company-a"
    target_user = SimpleNamespace(id=uuid4(), company_id=company_id)
    existing = UserPermission(
        user_id=target_user.id,
        page="schedule",
        permission=PermissionType.APPROVE_PAYMENTS,
        granted=False,
        company_id=company_id,
    )
    session = _PermissionSession(target_user, existing)

    result = auth.create_user_permission(
        str(target_user.id),
        UserPermissionCreate(page="schedule", permission="approve_payments", granted=True),
        _admin(company_id),
        session,
    )

    assert existing.granted is True
    assert result.granted is True
    assert session.commit_count == 1


def test_isud_permission_resolution_cross_workflow():
    from backend.routers.isud import _resolve_permission_pages

    # Services read resolves to services, sales, schedule
    read_services = _resolve_permission_pages("services", "read")
    assert "sales" in read_services
    assert "schedule" in read_services
    assert "services" in read_services

    # Services write does NOT resolve to sales/schedule
    write_services = _resolve_permission_pages("services", "write")
    assert "sales" not in write_services
    assert "schedule" not in write_services
    assert "services" in write_services

    # Inventory read resolves to sales
    read_inv = _resolve_permission_pages("inventory", "read")
    assert "sales" in read_inv

    # Supplier and inventory-feature permissions cross over for reads only.
    assert "inventory" in _resolve_permission_pages("supplier", "read")
    assert "inventory" not in _resolve_permission_pages("supplier", "write")
    assert "sales" in _resolve_permission_pages("inventory_feature", "read")
    assert "sales" not in _resolve_permission_pages("inventory_feature", "write")

    # Status and category lookups resolve to parent pages
    assert "clients" in _resolve_permission_pages("client_status", "read")
    assert "employees" in _resolve_permission_pages("employee_status", "read")
    assert "documents" in _resolve_permission_pages("document_status", "read")
    assert "documents" in _resolve_permission_pages("document_category", "read")


def test_page_permission_write_all_implies_write_but_not_delete(monkeypatch):
    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None)
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["inventory:write_all"])

    assert auth.has_page_permission(user, None, "inventory", "write")
    assert auth.has_page_permission(user, None, "inventory", "read")
    assert not auth.has_page_permission(user, None, "inventory", "delete")


def test_page_permission_write_self_only_is_schedule_scoped(monkeypatch):
    user = SimpleNamespace(role=auth.UserRole.EMPLOYEE, role_id=None)
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["schedule:write_self_only"])

    assert auth.has_page_permission(user, None, "schedule", "write")
    assert not auth.has_page_permission(user, None, "inventory", "write")


def test_inventory_bulk_import_accepts_write_all(monkeypatch):
    from backend.routers.products import _ensure_inventory_write_permission

    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None)
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["inventory:write_all"])

    _ensure_inventory_write_permission(user, _EmptyPermissionSession())


def test_inventory_categories_allow_supplier_workflow_permissions(monkeypatch):
    from backend.routers.inventory_categories import _require_category_permission, list_inventory_categories

    company_id = "company-a"
    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None, company_id=company_id)
    session = _EmptyPermissionSession()
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["suppliers:read"])

    assert list_inventory_categories(None, session, user) == []

    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["suppliers:write"])
    _require_category_permission(user, session, "write", include_suppliers=True)


def test_asset_availability_can_be_read_with_schedule_permission(monkeypatch):
    from backend.routers.assets import _require_asset_read

    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None)
    session = _EmptyPermissionSession()
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["schedule:read"])

    _require_asset_read(user, session, include_schedule=True)
    with pytest.raises(HTTPException) as error:
        _require_asset_read(user, session)
    assert error.value.status_code == 403


def test_custom_write_apis_require_page_permissions():
    from backend.routers.discount_rules import create_discount_rule
    from backend.routers.features import create_feature
    from backend.routers.templates import create_template

    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None)
    session = _EmptyPermissionSession()

    with pytest.raises(HTTPException) as deals_error:
        create_discount_rule(None, session, user)
    assert deals_error.value.status_code == 403

    with pytest.raises(HTTPException) as templates_error:
        create_template(None, user, session)
    assert templates_error.value.status_code == 403

    with pytest.raises(HTTPException) as inventory_error:
        asyncio.run(create_feature(None, session, user))
    assert inventory_error.value.status_code == 403


def test_client_cart_endpoints_require_sales_permissions():
    from backend.routers.client_cart import clear_client_cart, get_client_cart, remove_cart_item, upsert_cart_item

    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None, company_id="company-a")
    session = _EmptyPermissionSession()
    client_id = uuid4()

    endpoints = (
        (lambda: get_client_cart(client_id, session, user), "Missing permission: sales:read"),
        (lambda: upsert_cart_item(client_id, None, session, user), "Missing permission: sales:write"),
        (lambda: remove_cart_item(client_id, "service-1", session, user), "Missing permission: sales:write"),
        (lambda: clear_client_cart(client_id, session, user), "Missing permission: sales:write"),
    )
    for endpoint, expected_detail in endpoints:
        with pytest.raises(HTTPException) as error:
            endpoint()
        assert error.value.status_code == 403
        assert error.value.detail == expected_detail


def test_client_cart_read_allows_sales_read_permission(monkeypatch):
    from backend.routers.client_cart import get_client_cart

    user = SimpleNamespace(id=uuid4(), role=auth.UserRole.MANAGER, role_id=None, company_id="company-a")
    session = _EmptyPermissionSession()
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["sales:read"])

    assert get_client_cart(uuid4(), session, user) == []


def test_standard_templates_cannot_be_updated_even_with_write_permission(monkeypatch):
    from backend.routers import templates

    standard_template = SimpleNamespace(is_standard=True)
    session = _EmptyPermissionSession()
    session.get = lambda _model, _template_id: standard_template
    user = SimpleNamespace(role=auth.UserRole.MANAGER, role_id=None)
    monkeypatch.setattr(auth, "get_user_permissions_list", lambda _user, _session: ["templates:write"])

    with pytest.raises(HTTPException) as error:
        templates.update_template(uuid4(), None, user, session)

    assert error.value.status_code == 403
    assert error.value.detail == "Standard templates cannot be edited"
