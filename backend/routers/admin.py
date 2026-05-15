
from fastapi import APIRouter, Depends, status, Request, HTTPException
from fastapi.responses import JSONResponse
from backend.models import User
from backend.routers.auth import get_current_admin_user
from backend.database import engine
import logging
import os
from datetime import datetime
from sqlalchemy import text

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("admin_audit")
LAVISH_COMPANY_ID = "03200"

def emit_audit_log(actor: str, action: str, target: str = "", extra: dict = None):
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "actor": actor,
        "action": action,
        "target": target,
    }
    if extra:
        log_entry.update(extra)
    logger.info(f"AUDIT: {log_entry}")


def _count_company_rows(table_name: str, company_id: str) -> int:
    with engine.connect() as conn:
        result = conn.execute(
            text(f'SELECT COUNT(*) FROM public."{table_name}" WHERE company_id = :company_id'),
            {"company_id": company_id},
        )
        return int(result.scalar_one())


@router.post("/run-lavish-schedule-import", status_code=200)
def run_lavish_schedule_import(current_user: User = Depends(get_current_admin_user)):
    if (current_user.company_id or "") != LAVISH_COMPANY_ID:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lavish import is restricted to company 03200.")

    counts = {
        "schedule_count": _count_company_rows("schedule", LAVISH_COMPANY_ID),
    }
    emit_audit_log(
        actor=str(current_user.id),
        action="run_lavish_schedule_import",
        target="schedule",
        extra={"status": "skipped_disabled", **counts},
    )
    return {
        "message": "Lavish schedule import is disabled.",
        "company_id": LAVISH_COMPANY_ID,
        "import_executed": False,
        **counts,
    }

# --- Secure DB check endpoint with static token, not DB auth ---
@router.post("/check-or-start-database", status_code=200)
async def check_or_start_database(request: Request):
    # Use a static admin token for DB-down scenarios
    ADMIN_START_DB_TOKEN = os.getenv("ADMIN_START_DB_TOKEN", "changeme")
    token = request.headers.get("x-admin-db-token")
    if not token or token != ADMIN_START_DB_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin token required.")

    # Try DB connection
    try:
        import psycopg2
        from backend.db_config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, dbname=DB_NAME, connect_timeout=2)
        conn.close()
        emit_audit_log(actor="admin-token", action="check_db", target="database", extra={"status": "running"})
        return {"message": "Database is running."}
    except Exception as e:
        logger.exception("Database connection failed during /admin/check-or-start-database")
        emit_audit_log(actor="admin-token", action="check_db", target="database", extra={"status": "unavailable"})
        return JSONResponse(status_code=503, content={"detail": "Database unavailable; contact support."})
