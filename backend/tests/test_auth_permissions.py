from types import SimpleNamespace
from uuid import uuid4

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
