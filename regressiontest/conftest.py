"""
conftest.py — Session-wide fixtures: admin token, global cleanup registry.
"""
import sys
import os
import pytest

# Ensure regressiontest/ is on the path so helpers and config are importable
sys.path.insert(0, os.path.dirname(__file__))

from config import validate_config, ADMIN_USERNAME, ADMIN_PASSWORD, BASE_URL
from helpers.api_client import login
from helpers.cleanup import CleanupRegistry


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


@pytest.fixture(scope="session")
def cleanup(admin_token) -> CleanupRegistry:
    """
    Session-scoped CleanupRegistry.
    All created resources should be registered here.
    Teardown runs automatically after the session ends.
    """
    registry = CleanupRegistry()
    yield registry
    registry.teardown()
