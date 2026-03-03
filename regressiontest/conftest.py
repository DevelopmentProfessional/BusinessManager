"""
conftest.py — Session-wide fixtures: admin token, global cleanup registry,
              pre-run sweep, and per-test (function-scoped) cleanup fixture.

Pre-run sweep:
  At the very start of every test session (before any test data is created),
  sweep_regtest_data() calls DELETE /api/v1/regtest/sweep on the backend.
  That endpoint dynamically scans every database table for [REGTEST]-tagged
  records and removes them.  This handles orphans left by interrupted runs.

Rolling insert-delete:
  Use the `test_cleanup` fixture (function-scoped) for any resource a single
  test creates.  It tears down immediately after each test function, so
  the database is clean after every test rather than only at session end.

  Use `cleanup` (session-scoped) only for resources that must survive across
  the whole session — e.g. the test user accounts created in stage2_api/conftest.
"""
import sys
import os
import logging
import pytest

# Ensure regressiontest/ is on the path so helpers and config are importable
sys.path.insert(0, os.path.dirname(__file__))

from config import validate_config, ADMIN_USERNAME, ADMIN_PASSWORD, BASE_URL
from helpers.api_client import login
from helpers.cleanup import CleanupRegistry, sweep_regtest_data

log = logging.getLogger(__name__)


def pytest_configure(config):
    """Validate environment config before any tests run."""
    try:
        validate_config()
    except ValueError as e:
        pytest.exit(f"Configuration error: {e}", returncode=1)


# ── Placeholder password guard (prevents locking the admin account) ────────────
_PLACEHOLDER_PASSWORDS = {
    "your_admin_password_here", "changeme", "change_me",
    "password", "", "placeholder", "xxxxx",
}


@pytest.fixture(scope="session")
def admin_token() -> str:
    """Log in as admin and return the bearer token for the entire session.

    Exits pytest immediately with a human-readable error if credentials
    are wrong or the account is locked — rather than retrying and making
    things worse.
    """
    # ── Guard: catch obvious placeholder values before hitting the API ──────
    if ADMIN_PASSWORD.lower() in _PLACEHOLDER_PASSWORDS:
        _config_error(
            "ADMIN_PASSWORD looks like the template placeholder.",
            hint=(
                f"  Current value : ADMIN_PASSWORD={ADMIN_PASSWORD!r}\n"
                "  Fix           : Open regressiontest/.env and replace\n"
                "                  'your_admin_password_here' with the\n"
                "                  actual admin password for your app."
            ),
        )

    # ── Attempt login ────────────────────────────────────────────────────────
    try:
        return login(ADMIN_USERNAME, ADMIN_PASSWORD)
    except RuntimeError as exc:
        msg = str(exc).lower()

        if "locked" in msg:
            _config_error(
                "Admin account is LOCKED (too many failed login attempts).",
                hint=(
                    "  The lock expires automatically after 30 minutes.\n"
                    "  To wait it out, run:\n\n"
                    "      python tools/unlock_admin.py\n\n"
                    "  Root cause: something called the login endpoint with\n"
                    "  the real admin username and a wrong password.\n"
                    "  Check that ADMIN_PASSWORD in .env is correct."
                ),
            )
        elif "401" in msg or "invalid" in msg or "credentials" in msg:
            _config_error(
                "Admin login returned 401 — wrong password.",
                hint=(
                    f"  API URL  : {BASE_URL}\n"
                    f"  Username : {ADMIN_USERNAME}\n"
                    f"  Password : {ADMIN_PASSWORD!r}  <-- check this\n\n"
                    "  Fix: update ADMIN_PASSWORD in regressiontest/.env\n\n"
                    "  WARNING: each failed login increments failed_login_attempts.\n"
                    "  After 5 failed runs the admin account locks for 30 minutes.\n"
                    "  Fix the password NOW to avoid a lockout."
                ),
            )
        else:
            _config_error(
                "Admin login failed unexpectedly.",
                hint=f"  Original error: {exc}",
            )


def _config_error(headline: str, hint: str = "") -> None:
    """Print a clear, bordered error block then exit pytest immediately."""
    border = "=" * 64
    msg = (
        f"\n{border}\n"
        f"  ADMIN LOGIN ERROR\n"
        f"  {headline}\n"
        f"{border}\n"
        f"{hint}\n"
        f"{border}\n"
    )
    pytest.exit(msg, returncode=3)


# ── Pre-run sweep — runs once at session start, before any test ────────────────

@pytest.fixture(scope="session", autouse=True)
def pre_run_sweep(admin_token) -> None:
    """
    At the very start of each test session, call the backend sweep endpoint to
    delete any [REGTEST]-tagged records left over from a previously interrupted
    run.  Runs automatically (autouse=True) — no test needs to request it.

    The sweep is non-fatal: if it fails (e.g. backend is unreachable), a
    warning is logged and tests proceed.  The pre-sweep is a safety net, not
    a hard requirement.
    """
    try:
        result = sweep_regtest_data(admin_token)
        total = result.get("total", 0)
        if total:
            log.warning(
                f"[pre-run sweep] Removed {total} orphaned [REGTEST] record(s) "
                f"from a previous interrupted run: {result.get('deleted', {})}"
            )
        # Print to stdout so it's visible in pytest -v output
        print(
            f"\n[pre-run sweep] {'Cleaned ' + str(total) + ' orphaned record(s)' if total else 'Database clean'}"
        )
    except Exception as exc:
        log.warning(f"[pre-run sweep] Sweep failed (non-fatal): {exc}")
        print(f"\n[pre-run sweep] WARNING: sweep failed: {exc}")


# ── Session-scoped cleanup — for resources that span the whole session ─────────

@pytest.fixture(scope="session")
def cleanup(admin_token, pre_run_sweep) -> CleanupRegistry:
    """
    Session-scoped CleanupRegistry for resources that must persist across the
    entire test session (e.g. test user accounts created in stage2 conftest).

    Teardown runs automatically after the session ends.

    For per-test resources use `test_cleanup` instead.
    """
    registry = CleanupRegistry()
    yield registry
    registry.teardown()


# ── Function-scoped cleanup — rolling insert-delete per test ──────────────────

@pytest.fixture(scope="function")
def test_cleanup() -> CleanupRegistry:
    """
    Per-test CleanupRegistry.  Tears down immediately after each test function,
    so the database is returned to a clean state after every test regardless of
    pass or fail.

    Usage in tests:
        def test_create_client(self, admin_client, test_admin_token, test_cleanup):
            resp = admin_client.post("/api/v1/isud/clients", json=payload)
            rec_id = resp.json()["id"]
            test_cleanup.register(f"/api/v1/isud/clients/{rec_id}", token=test_admin_token)
            # assertions ...
            # After this function returns (pass OR fail), teardown() is called automatically.
    """
    registry = CleanupRegistry()
    yield registry
    registry.teardown()
