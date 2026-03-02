"""
stage2_api/conftest.py — Role-specific test users and client fixtures for API tests.

Creates 4 dedicated test accounts at session start, assigns each role's permissions,
and exposes AuthedClient fixtures for every role.  The real admin token (from the
root conftest) is used ONLY to create/delete test users and register cleanup URLs —
all actual API tests use role-specific test accounts.

Role permission matrix:
  admin   → all permissions (auto-granted by the API for admin role)
  manager → read/write/delete on most pages; no admin panel
  employee→ read on most pages; read+write on attendance only
  viewer  → read-only on all pages
"""
import sys
import os
import uuid as _uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from helpers.api_client import AuthedClient, login
from helpers.test_data import make_user

# ── Permission definitions ─────────────────────────────────────────────────────

_MANAGER_PERMS = [
    ("clients",    "read"),  ("clients",    "write"), ("clients",    "delete"),
    ("inventory",  "read"),  ("inventory",  "write"), ("inventory",  "delete"),
    ("suppliers",  "read"),  ("suppliers",  "write"),
    ("services",   "read"),  ("services",   "write"), ("services",   "delete"),
    ("employees",  "read"),  ("employees",  "write"),
    ("schedule",   "read"),  ("schedule",   "write"), ("schedule",   "delete"),
    ("attendance", "read"),  ("attendance", "write"),
    ("documents",  "read"),  ("documents",  "write"), ("documents",  "delete"),
    ("reports",    "read"),
]

_EMPLOYEE_PERMS = [
    ("clients",    "read"),
    ("inventory",  "read"),
    ("services",   "read"),
    ("schedule",   "read"),
    ("attendance", "read"),  ("attendance", "write"),
    ("documents",  "read"),
]

_VIEWER_PERMS = [
    ("clients",    "read"),
    ("inventory",  "read"),
    ("suppliers",  "read"),
    ("services",   "read"),
    ("schedule",   "read"),
    ("attendance", "read"),
    ("documents",  "read"),
    ("reports",    "read"),
]


# ── Helper: create one test user + assign permissions ──────────────────────────

def _create_test_user(
    admin_token: str,
    cleanup,
    role: str,
    permissions: list[tuple[str, str]],
) -> tuple[str, str]:
    """
    Create a test user with the given role, assign individual permissions,
    register for cleanup, and return (user_id, token).

    Args:
        admin_token: Real admin bearer token (for user creation and permission assignment).
        cleanup:     CleanupRegistry — user is registered for deletion at session end.
        role:        "admin" | "manager" | "employee" | "viewer"
        permissions: List of (page, permission) tuples to assign.

    Returns:
        (user_id: str, token: str)
    """
    client = AuthedClient(token=admin_token)
    suffix = _uuid.uuid4().hex[:8]
    payload = make_user(
        role=role,
        username=f"regtest_{role}_{suffix}",
        first_name=f"[REGTEST]",
        last_name=f"{role.capitalize()}-{suffix}",
        email=f"regtest_{role}_{suffix}@example.com",
    )

    resp = client.post("/api/v1/auth/users", json=payload)
    assert resp.status_code in (200, 201), (
        f"Failed to create test {role} user: {resp.status_code} {resp.text[:300]}"
    )
    user = resp.json()
    user_id = user.get("id")
    assert user_id, f"No id in created user response: {user}"

    # Register for cleanup (real admin token — most reliable)
    cleanup.register(
        f"/api/v1/auth/users/{user_id}",
        token=admin_token,
        label=f"test {role} user",
    )

    # Assign individual permissions (admin role gets everything automatically)
    if role != "admin":
        for page, permission in permissions:
            perm_resp = client.post(
                f"/api/v1/auth/users/{user_id}/permissions",
                json={"page": page, "permission": permission, "granted": True},
            )
            # 400 if already exists is acceptable; anything else is a problem
            assert perm_resp.status_code in (200, 201, 400), (
                f"Failed to assign {page}:{permission} to {role}: "
                f"{perm_resp.status_code} {perm_resp.text[:200]}"
            )

    # Login as the new user
    token = login(payload["username"], payload["password"])
    return user_id, token, payload["username"], payload["password"]


# ── Session fixture: all 4 test users ─────────────────────────────────────────

@pytest.fixture(scope="session")
def test_users(admin_token, cleanup) -> dict:
    """
    Create one test user per role and return a dict:

        {
            "admin":    {"id": "...", "token": "...", "username": "...", "password": "..."},
            "manager":  {...},
            "employee": {...},
            "viewer":   {...},
        }

    The real admin token (from .env) is used ONLY here to create test users.
    All actual API tests use the role-specific tokens exposed via
    admin_client / manager_client / employee_client / viewer_client.
    """
    users = {}
    for role, perms in [
        ("admin",    []),
        ("manager",  _MANAGER_PERMS),
        ("employee", _EMPLOYEE_PERMS),
        ("viewer",   _VIEWER_PERMS),
    ]:
        uid, tok, uname, pwd = _create_test_user(admin_token, cleanup, role, perms)
        users[role] = {"id": uid, "token": tok, "username": uname, "password": pwd}
    return users


# ── Per-role token string fixtures ───────────────────────────────────────────

@pytest.fixture(scope="session")
def test_admin_token(test_users) -> str:
    """
    Bearer token for the test ADMIN account.
    Use this (NOT admin_token from root conftest) for cleanup.register() calls
    in all stage2 tests.  The real admin credentials are used ONLY in the
    test_users fixture above to bootstrap the test accounts.
    """
    return test_users["admin"]["token"]


@pytest.fixture(scope="session")
def manager_token(test_users) -> str:
    return test_users["manager"]["token"]


@pytest.fixture(scope="session")
def employee_token(test_users) -> str:
    return test_users["employee"]["token"]


@pytest.fixture(scope="session")
def viewer_token(test_users) -> str:
    return test_users["viewer"]["token"]


# ── Per-role AuthedClient fixtures ────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_client(test_users) -> AuthedClient:
    """AuthedClient for the test ADMIN account (not the real admin from .env)."""
    return AuthedClient(token=test_users["admin"]["token"])


@pytest.fixture(scope="session")
def manager_client(test_users) -> AuthedClient:
    """AuthedClient for the test MANAGER account."""
    return AuthedClient(token=test_users["manager"]["token"])


@pytest.fixture(scope="session")
def employee_client(test_users) -> AuthedClient:
    """AuthedClient for the test EMPLOYEE account."""
    return AuthedClient(token=test_users["employee"]["token"])


@pytest.fixture(scope="session")
def viewer_client(test_users) -> AuthedClient:
    """AuthedClient for the test VIEWER account."""
    return AuthedClient(token=test_users["viewer"]["token"])
