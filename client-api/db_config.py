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

def _validate_database_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL is not set.")
    if value.startswith("sqlite://"):
        raise RuntimeError("SQLite URLs are disabled. Configure a PostgreSQL DATABASE_URL.")
    if not value.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("Only PostgreSQL DATABASE_URL values are supported.")
    return value


DATABASE_URL = _validate_database_url(os.getenv("DATABASE_URL", ""))
