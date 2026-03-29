"""
DATABASE URL CONFIGURATION
Reads from environment variable DATABASE_URL (same shared Postgres as internal API).

SECURITY NOTE: All database connection strings MUST be read from environment variables
(via os.getenv() and .env files). Never hardcode DATABASE_URL values in source code or
commit them to version control. If DATABASE_URL or credentials have ever been exposed in
git history, rotate the database password immediately in the Render dashboard and update
the DATABASE_URL secret in all deployed environments using the new credentials.
"""
import os
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

def _validate_render_database_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        raise RuntimeError("A Render PostgreSQL DATABASE_URL is required.")
    if value.startswith("sqlite://"):
        raise RuntimeError("SQLite URLs are disabled. Configure a Render PostgreSQL DATABASE_URL.")
    if not value.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("Only PostgreSQL DATABASE_URL values are supported.")

    host = (urlparse(value).hostname or "").strip().rstrip(".").lower()
    if not (
        host == "render.com"
        or host.endswith(".render.com")
        or host == "render.internal"
        or host.endswith(".render.internal")
    ):
        raise RuntimeError("DATABASE_URL must point to a Render-hosted PostgreSQL database.")

    return value


DATABASE_URL = _validate_render_database_url(os.getenv("DATABASE_URL", ""))
