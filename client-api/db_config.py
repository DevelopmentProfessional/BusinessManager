"""
DATABASE URL CONFIGURATION
Reads from environment variable DATABASE_URL (same shared Postgres as internal API).

SECURITY NOTE: All database connection strings MUST be read from environment variables
(via os.getenv() and .env files). Never hardcode DATABASE_URL values in source code or
commit them to version control. If DATABASE_URL or credentials have ever been exposed in
git history, rotate the database password and update the DATABASE_URL secret in every
deployed environment.
"""
import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv

_service_dir = Path(__file__).resolve().parent
_repo_env = _service_dir.parent / ".env"
_local_env = _service_dir / ".env.local"
if _local_env.exists():
    load_dotenv(_local_env, override=True)

load_dotenv(_repo_env, override=True)

def _validate_database_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL is not set.")
    if ".render.com" in value.lower():
        raise RuntimeError("Render PostgreSQL URLs are no longer supported. Configure DATABASE_URL with the AWS RDS PostgreSQL URL.")
    if value.startswith("sqlite://"):
        raise RuntimeError("SQLite URLs are disabled. Configure a PostgreSQL DATABASE_URL.")
    if not value.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("Only PostgreSQL DATABASE_URL values are supported.")
    return value


DATABASE_URL = _validate_database_url(os.getenv("DATABASE_URL", ""))
