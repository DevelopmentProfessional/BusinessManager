# ============================================================
# FILE: db_config.py
#
# PURPOSE:
#   Manages database environment selection (local SQLite, local Postgres,
#   Render development/test/production). Provides helpers for reading and
#   writing the active environment, resolving the connection URL, and
#   inspecting or extending the environment registry.
#
# FUNCTIONAL PARTS:
#   [1] Imports & Configuration        — stdlib imports and CONFIG_FILE path
#   [2] Environment Registry           — DATABASE_ENVIRONMENTS dict and
#                                        DEFAULT_ENVIRONMENT constant
#   [3] Environment Read/Write         — get_current_environment(),
#                                        set_current_environment()
#   [4] URL Resolution                 — get_database_url() with env-var override
#   [5] Environment Inspection Helpers — get_all_environments(),
#                                        get_configured_environments(),
#                                        get_environment_info()
#   [6] Environment Mutation Helpers   — add_environment(),
#                                        validate_database_url()
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

"""
Database environment configuration.
Allows switching between Development, Test, and Production databases.
"""

# ─── 1 IMPORTS & CONFIGURATION ─────────────────────────────────────────────────
import os
import json
from pathlib import Path

# ─── 2 ENVIRONMENT REGISTRY ────────────────────────────────────────────────────
# Configuration file path (stored in backend folder)
CONFIG_FILE = Path(__file__).parent / "db_environment.json"

# Hardcoded database URLs for each environment
DATABASE_ENVIRONMENTS = {
    "local": "sqlite:///./business_manager.db",
    "local-postgres": "postgresql://postgres:password@localhost:5432/businessmanager",
    "development": "postgresql://db_reference_user:AGONHh5kBrXztl8hwYUEIGpCZncxK06j@dpg-d5scoucoud1c73b1s5tg-a.oregon-postgres.render.com/db_reference_name",
    "test": "",  # Empty for now - can be configured later
    "production": "",  # Empty for now - can be configured later
}

# Default environment - use SQLite for local development
DEFAULT_ENVIRONMENT = "local"


# ─── 3 ENVIRONMENT READ / WRITE ────────────────────────────────────────────────
def get_current_environment() -> str:
    """Get the currently selected database environment."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                return config.get("environment", DEFAULT_ENVIRONMENT)
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_ENVIRONMENT


def set_current_environment(environment: str) -> bool:
    """Set the current database environment. Returns True on success."""
    if environment not in DATABASE_ENVIRONMENTS:
        return False
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump({"environment": environment}, f)
        return True
    except IOError:
        return False


# ─── 4 URL RESOLUTION ──────────────────────────────────────────────────────────
def get_database_url() -> str:
    """Get the database URL for the current environment.
    When DATABASE_URL is set (e.g. on Render), use it so the deployed app uses the linked database.
    """
    # Prefer env var so Render/CI/production use the injected connection string
    env_url = os.getenv("DATABASE_URL", "").strip()
    if env_url:
        return env_url

    env = get_current_environment()
    url = DATABASE_ENVIRONMENTS.get(env, "")

    # If the selected environment has no URL configured, fall back to development
    if not url:
        url = DATABASE_ENVIRONMENTS.get("development", "")

    # If still no URL, fall back to SQLite for local development
    if not url:
        url = "sqlite:///./business_manager.db"

    return url


# ─── 5 ENVIRONMENT INSPECTION HELPERS ──────────────────────────────────────────
def get_all_environments() -> dict:
    """Get all available environments with their configuration status."""
    current = get_current_environment()
    return {
        env: {
            "name": env.capitalize(),
            "configured": bool(url),
            "is_current": env == current,
        }
        for env, url in DATABASE_ENVIRONMENTS.items()
    }


def get_configured_environments() -> dict:
    """Get only configured environments (those with database URLs set)."""
    current = get_current_environment()
    return {
        env: {
            "name": env.capitalize(),
            "configured": True,
            "is_current": env == current,
        }
        for env, url in DATABASE_ENVIRONMENTS.items()
        if url  # Only include if URL is set
    }


def get_environment_info(include_urls: bool = False) -> dict:
    """
    Get detailed information about all database environments.
    
    Args:
        include_urls: If True, includes masked database URLs for display
    
    Returns:
        Dictionary with environment details
    """
    current = get_current_environment()
    result = {
        "current_environment": current,
        "environments": {}
    }
    
    for env, url in DATABASE_ENVIRONMENTS.items():
        env_info = {
            "name": env.capitalize(),
            "configured": bool(url),
            "is_current": env == current,
        }
        
        if include_urls and url:
            # Mask the URL for security (show host only)
            try:
                # Extract host from URL (e.g., postgresql://user:pass@host:port/db)
                if "@" in url:
                    host_part = url.split("@")[1].split("/")[0]
                    env_info["host"] = host_part.split(":")[0] if ":" in host_part else host_part
                else:
                    env_info["host"] = "local"
            except (IndexError, AttributeError):
                env_info["host"] = "configured"
        
        result["environments"][env] = env_info
    
    return result


# ─── 6 ENVIRONMENT MUTATION HELPERS ────────────────────────────────────────────
def add_environment(name: str, url: str) -> bool:
    """
    Add or update a database environment configuration.
    Note: This only updates the in-memory configuration. 
    For persistent changes, modify DATABASE_ENVIRONMENTS directly.
    
    Args:
        name: Environment name (lowercase)
        url: PostgreSQL connection URL
    
    Returns:
        True if added/updated successfully
    """
    name = name.lower()
    DATABASE_ENVIRONMENTS[name] = url
    return True


def validate_database_url(url: str) -> bool:
    """
    Validate that a database URL is properly formatted.
    
    Args:
        url: Database connection URL
    
    Returns:
        True if the URL appears valid
    """
    if not url:
        return False
    
    valid_prefixes = ["postgresql://", "postgres://", "sqlite:///"]
    return any(url.startswith(prefix) for prefix in valid_prefixes)
