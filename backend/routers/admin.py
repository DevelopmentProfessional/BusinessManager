
from fastapi import APIRouter, status, Request, HTTPException
from fastapi.responses import JSONResponse
import logging
import os
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("admin_audit")

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
