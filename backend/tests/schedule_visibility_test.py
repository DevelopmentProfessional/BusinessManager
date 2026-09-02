from types import SimpleNamespace
from uuid import uuid4

from sqlmodel import select

from backend.models import Schedule, UserRole
from backend.routers import isud


def _user(role=UserRole.EMPLOYEE):
    return SimpleNamespace(id=uuid4(), role=role, company_id="test-company")


def test_schedule_view_all_permission_leaves_query_unscoped(monkeypatch):
    current_user = _user()
    stmt = select(Schedule)

    monkeypatch.setattr(isud, "get_user_permissions_list", lambda *_: ["schedule:view_all"])

    scoped_stmt = isud._apply_schedule_visibility_scope(stmt, current_user, object())

    assert scoped_stmt is stmt


def test_schedule_plain_write_permission_scopes_query_to_self_and_attendees(monkeypatch):
    current_user = _user()
    stmt = select(Schedule)

    monkeypatch.setattr(isud, "get_user_permissions_list", lambda *_: ["schedule:write"])

    scoped_stmt = isud._apply_schedule_visibility_scope(stmt, current_user, object())
    compiled_sql = str(scoped_stmt.compile(compile_kwargs={"literal_binds": False})).lower()

    assert "schedule.employee_id" in compiled_sql
    assert "schedule_attendee" in compiled_sql
    assert "schedule_attendee.user_id" in compiled_sql


def test_schedule_admin_role_leaves_query_unscoped(monkeypatch):
    current_user = _user(role=UserRole.ADMIN)
    stmt = select(Schedule)

    monkeypatch.setattr(isud, "get_user_permissions_list", lambda *_: [])

    scoped_stmt = isud._apply_schedule_visibility_scope(stmt, current_user, object())

    assert scoped_stmt is stmt