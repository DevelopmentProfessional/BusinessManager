"""
test_permissions/conftest.py — Role clients available to permission tests.

These fixtures pull from the session-scoped test_users dict (created in
stage2_api/conftest.py) so each role runs as a dedicated test account
with that role's specific permissions assigned — not as the real admin.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest
from helpers.api_client import AuthedClient


@pytest.fixture(scope="package")
def role_clients(admin_client, manager_client, employee_client, viewer_client):
    """Return a dict of role-name → AuthedClient (all test accounts, not real admin)."""
    return {
        "admin":    admin_client,
        "manager":  manager_client,
        "employee": employee_client,
        "viewer":   viewer_client,
    }
