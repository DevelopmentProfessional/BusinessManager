"""
Database environment configuration.
Allows switching between Development, Test, and Production databases.
"""
import os
import json
from pathlib import Path

# Configuration file path (stored in backend folder)
CONFIG_FILE = Path(__file__).parent / "db_environment.json"

# Hardcoded database URLs for each environment
DATABASE_ENVIRONMENTS = {
    "development": "postgresql://db_reference_user:AGONHh5kBrXztl8hwYUEIGpCZncxK06j@dpg-d5scoucoud1c73b1s5tg-a.oregon-postgres.render.com/db_reference_name",
    "test": "",  # Empty for now - can be configured later
    "production": "",  # Empty for now - can be configured later
}

# Default environment
DEFAULT_ENVIRONMENT = "development"


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
