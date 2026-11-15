# ============================================================
# FILE: db_config.py
#
# PURPOSE:
#   Provides PostgreSQL database configuration for the backend.
#   Local database selection and SQLite fallback are intentionally disabled,
#   and the connection string must come from the environment.
#
# FUNCTIONAL PARTS:
#   [1] Imports & Constants            — stdlib imports and env constants
#   [2] URL Validation                 — PostgreSQL URL checks
#   [3] URL Resolution                 — get_database_url()
#   [4] Compatibility Helpers          — environment inspection shims
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-29 | GitHub Copilot | Removed hardcoded DB fallback and tightened PostgreSQL URL validation
#   2026-04-08 | Claude  | Removed provider-specific host restrictions to support AWS RDS migration
#   2026-05-15 | GitHub Copilot | Load backend and repo env files for consistent local AWS database startup
# ============================================================

"""PostgreSQL database configuration for the AWS RDS-backed application."""

# ─── 1 IMPORTS & CONSTANTS ─────────────────────────────────────────────────────
import os
from pathlib import Path
from dotenv import load_dotenv

_CURRENT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _CURRENT_DIR.parent

load_dotenv(_REPO_ROOT / ".env", override=True)
load_dotenv(_CURRENT_DIR / ".env", override=False)
load_dotenv(_CURRENT_DIR / ".env.local", override=True)


# ─── 2 URL VALIDATION ──────────────────────────────────────────────────────────
def _is_postgres_url(url: str) -> bool:
    return url.startswith(("postgresql://", "postgres://", "postgresql+psycopg://"))



# ─── 3 URL RESOLUTION ──────────────────────────────────────────────────────────
def get_database_url() -> str:
    """Return the PostgreSQL URL supplied by the active environment."""
    env_url = os.getenv("DATABASE_URL", "").strip()
    if not env_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure it with the AWS RDS PostgreSQL URL."
        )
    if ".render.com" in env_url.lower():
        raise RuntimeError(
            "Render PostgreSQL URLs are no longer supported. Configure DATABASE_URL with the AWS RDS PostgreSQL URL."
        )
    return env_url


def validate_database_url(url: str) -> bool:
    """Return True for any valid PostgreSQL URL."""
    return _is_postgres_url(url)
