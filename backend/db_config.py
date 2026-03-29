# ============================================================
# FILE: db_config.py
#
# PURPOSE:
#   Provides a Render-only PostgreSQL database configuration for the backend.
#   Local database selection and SQLite fallback are intentionally disabled,
#   and the connection string must come from the environment.
#
# FUNCTIONAL PARTS:
#   [1] Imports & Constants            — stdlib imports and Render env constants
#   [2] URL Validation                 — Render-hosted PostgreSQL checks
#   [3] URL Resolution                 — get_database_url()
#   [4] Compatibility Helpers          — environment inspection shims
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-29 | GitHub Copilot | Removed backend environment switching and enforced Render-only PostgreSQL routing
#   2026-03-29 | GitHub Copilot | Removed hardcoded DB fallback and tightened Render host validation
# ============================================================

"""Render-only backend database configuration."""

# ─── 1 IMPORTS & CONSTANTS ─────────────────────────────────────────────────────
import os
from urllib.parse import urlparse

RENDER_ENVIRONMENT_NAME = "render"
RENDER_DATABASE_URL_ENV_VAR = "DATABASE_URL"


# ─── 2 URL VALIDATION ──────────────────────────────────────────────────────────
def _is_postgres_url(url: str) -> bool:
    return url.startswith(("postgresql://", "postgres://", "postgresql+psycopg://"))


def _is_render_host(hostname: str) -> bool:
    host = (hostname or "").strip().rstrip(".").lower()
    return (
        host == "render.com"
        or host.endswith(".render.com")
        or host == "render.internal"
        or host.endswith(".render.internal")
    )





# ─── 3 URL RESOLUTION ──────────────────────────────────────────────────────────
def get_database_url() -> str:
    """Return the Render PostgreSQL URL used by the backend."""
    env_url = os.getenv(RENDER_DATABASE_URL_ENV_VAR, "").strip()
    if not env_url:
        raise RuntimeError(
            f"{RENDER_DATABASE_URL_ENV_VAR} is not set. Configure it with a PostgreSQL URL."
        )
    return env_url


# ─── 4 COMPATIBILITY HELPERS ───────────────────────────────────────────────────
def get_current_environment() -> str:
    """Compatibility shim for older tooling; backend is Render-only."""
    return RENDER_ENVIRONMENT_NAME


def set_current_environment(environment: str) -> bool:
    """Compatibility shim; set_current_environment only accepts RENDER_ENVIRONMENT_NAME.

    get_current_environment() and get_all_environments() always report the
    Render runtime, so environment switching remains disabled.
    """
    return environment == RENDER_ENVIRONMENT_NAME


def get_all_environments() -> dict:
    """Return the single supported backend database environment."""
    return {
        RENDER_ENVIRONMENT_NAME: {
            "name": "Render",
            "configured": True,
            "is_current": True,
        }
    }


def get_configured_environments() -> dict:
    """Return the single configured backend database environment."""
    return get_all_environments()


def get_environment_info(include_urls: bool = False) -> dict:
    """Return metadata for the single supported Render database target."""
    info = {
        "current_environment": RENDER_ENVIRONMENT_NAME,
        "environments": {
            RENDER_ENVIRONMENT_NAME: {
                "name": "Render",
                "configured": True,
                "is_current": True,
            }
        },
    }
    if include_urls:
        host = urlparse(get_database_url()).hostname or "render"
        info["environments"][RENDER_ENVIRONMENT_NAME]["host"] = host
    return info


def add_environment(name: str, url: str) -> bool:
    """Compatibility shim; custom environments are disabled."""
    return name.lower() in {RENDER_ENVIRONMENT_NAME, "production"} and validate_database_url(url)


def validate_database_url(url: str) -> bool:
    """Return True only for Render-hosted PostgreSQL URLs."""
    try:
        _validate_render_database_url(url)
    except RuntimeError:
        return False
    return True
