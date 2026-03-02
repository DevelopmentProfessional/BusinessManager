"""
config.py — loads .env and exposes typed constants used across the test suite.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the regressiontest/ directory
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path, override=False)

# --- Core URLs ---
BASE_URL: str = os.getenv("API_BASE_URL", "https://businessmanager-reference-api.onrender.com").rstrip("/")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# --- Admin credentials ---
ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

# --- Playwright ---
PLAYWRIGHT_HEADLESS: bool = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() != "false"

# --- HTTP ---
REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "30"))


def validate_config() -> None:
    """Raise ValueError if required config is missing."""
    if not ADMIN_PASSWORD:
        raise ValueError(
            "ADMIN_PASSWORD is not set. "
            "Copy regressiontest/.env.template to regressiontest/.env and fill it in."
        )
    if not BASE_URL.startswith("http"):
        raise ValueError(f"API_BASE_URL looks invalid: {BASE_URL!r}")
