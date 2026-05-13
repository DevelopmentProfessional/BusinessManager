#!/usr/bin/env python3
"""
CompanyCreation — Web UI
========================
Run:  python app.py
Then open: http://localhost:8765

Reads DATABASE_URL from environment or ../.env (PostgreSQL only)
"""

import os, sys, uuid, bcrypt, socket
from datetime import datetime

try:
    from sqlalchemy import create_engine, text
except ImportError:
    print("ERROR: sqlalchemy not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

# ── DB state (mutable at runtime via /set-db) ──────────────────────────────────
_db_url  = ""
_engine  = None

def _normalise_url(raw: str) -> str:
    url = raw.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if not url:
        raise RuntimeError("DATABASE_URL is required and must be PostgreSQL.")
    if url.startswith("sqlite"):
        raise RuntimeError("SQLite is not allowed. Configure a PostgreSQL DATABASE_URL.")
    if not url.startswith("postgresql://"):
        raise RuntimeError("Only PostgreSQL URLs are supported.")
    return url

def _make_engine(url: str):
    sa_url = url
    if sa_url.startswith("postgresql://"):
        sa_url = sa_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(sa_url)

def _set_active_db(raw_url: str):
    global _db_url, _engine
    url = _normalise_url(raw_url)
    _db_url   = url
    _engine   = _make_engine(url)

def _resolve_initial_db_url() -> str:
  # First choice: a CompanyCreation-specific env var, if provided.
  explicit_url = os.environ.get("COMPANY_CREATION_DATABASE_URL", "").strip()
  if explicit_url:
    return explicit_url

  # Second choice: DATABASE_URL from repo root .env (authoritative for this tool).
  parent_env = os.path.join(os.path.dirname(__file__), '..', '.env')
  try:
    from dotenv import dotenv_values
    if os.path.exists(parent_env):
      file_url = (dotenv_values(parent_env).get("DATABASE_URL") or "").strip()
      if file_url:
        return file_url
  except Exception:
    pass

  # Third choice: exported DATABASE_URL from process environment.
  env_url = os.environ.get("DATABASE_URL", "").strip()
  if env_url:
    return env_url

  # Fallback: reuse backend database environment configuration
  try:
    from backend.db_config import get_database_url
    return get_database_url()
  except Exception:
    pass

  try:
    parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent not in sys.path:
      sys.path.insert(0, parent)
    from backend.db_config import get_database_url
    return get_database_url()
  except Exception as e:
    raise RuntimeError(
      "No PostgreSQL database URL found. Set DATABASE_URL in .env or configure backend/db_config.py."
    ) from e

# Bootstrap from env / .env, or backend db_config fallback
_initial_url = _resolve_initial_db_url()
_set_active_db(_initial_url)

def _db_label() -> str:
    # Mask password in display
    try:
        from urllib.parse import urlparse
        p = urlparse(_db_url)
        return f"PostgreSQL — {p.hostname}/{p.path.lstrip('/')}"
    except Exception:
        return "PostgreSQL"

# ── Helpers ────────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def _exec(conn, sql, params=None):
    return conn.execute(text(sql), params or {})

def _scalar(conn, sql, params=None):
    return conn.execute(text(sql), params or {}).scalar()

def _table_exists(conn, name):
    return bool(_scalar(conn, f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='{name}')"))

def _user_table():
    return '"user"'

def _get_userrole_labels(conn):
  """Return labels from PostgreSQL userrole enum; empty list if unavailable."""
  try:
    rows = conn.execute(text(
      "SELECT e.enumlabel "
      "FROM pg_type t "
      "JOIN pg_enum e ON t.oid = e.enumtypid "
      "WHERE t.typname = 'userrole' "
      "ORDER BY e.enumsortorder"
    )).fetchall()
    return [r[0] for r in rows]
  except Exception:
    return []

def _resolve_admin_role_label(conn):
  """Pick the best admin enum label supported by the current DB (ADMIN or admin)."""
  labels = _get_userrole_labels(conn)
  if "ADMIN" in labels:
    return "ADMIN"
  if "admin" in labels:
    return "admin"
  return "admin"

def _ensure_bootstrap_tables():
  """Create the minimum required tables for CompanyCreation in PostgreSQL."""
  import threading
  
  def _do_bootstrap():
    try:
      with _engine.begin() as conn:
        conn.execute(text("""
          CREATE TABLE IF NOT EXISTS company (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP,
            company_id VARCHAR UNIQUE NOT NULL,
            name VARCHAR NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
          )
        """))
        # Ensure expected userrole enum values exist
        for val in ("admin", "manager", "employee", "viewer", "ADMIN", "MANAGER", "EMPLOYEE", "VIEWER"):
          try:
            conn.execute(text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{val}'"))
          except Exception:
            pass

        # Normalize existing admin rows
        try:
            preferred_admin = _resolve_admin_role_label(conn)
            conn.execute(text(
                f"UPDATE {_user_table()} "
                "SET role = CAST(:preferred_admin AS userrole) "
                "WHERE LOWER(CAST(role AS TEXT)) = 'admin' "
                "AND CAST(role AS TEXT) <> :preferred_admin"
            ), {"preferred_admin": preferred_admin})
        except Exception:
            pass
        
        # Drop indexes
        for idx in ("ix_user_username", "ix_user_email"):
          try:
            conn.execute(text(f'DROP INDEX IF EXISTS "{idx}"'))
          except Exception:
            pass
        print("  + Ensured bootstrap tables")
    except Exception as e:
      print(f"  ! Could not ensure bootstrap tables: {e}")
  
  # Run bootstrap in background thread with 3-second timeout to prevent hanging
  thread = threading.Thread(target=_do_bootstrap, daemon=True)
  thread.start()
  thread.join(timeout=3.0)
  
  if thread.is_alive():
    print("  ! Database unreachable (timeout) — app will start but requests may fail")

_ensure_bootstrap_tables()

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="CompanyCreation", docs_url=None, redoc_url=None)

# ── Request model ──────────────────────────────────────────────────────────────
class CreateRequest(BaseModel):
    company_id: str
    company_name: str
    admin_username: str
    admin_password: str
    admin_first_name: str = "Admin"
    admin_last_name: str = "User"
    admin_email: Optional[str] = None

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def index():
    return HTML_PAGE

@app.get("/status")
def status():
    """Check DB connectivity and list existing companies."""
    try:
        _ensure_bootstrap_tables()
        with _engine.connect() as conn:
            if not _table_exists(conn, "company"):
                return {"ok": False, "error": "company table not found — start the main app once first to run migrations"}
            rows = conn.execute(text("SELECT company_id, name, is_active FROM company ORDER BY created_at")).fetchall()
            companies = [{"company_id": r[0], "name": r[1], "is_active": bool(r[2])} for r in rows]
            return {"ok": True, "database": _db_label(), "companies": companies}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.get("/companies")
def list_companies():
    """Return companies with employee counts and names."""
    try:
        _ensure_bootstrap_tables()
        with _engine.connect() as conn:
            if not _table_exists(conn, "company"):
                return {"ok": False, "error": "company table not found"}
            ut = _user_table()
            company_rows = conn.execute(
                text("SELECT company_id, name, is_active FROM company ORDER BY name")
            ).fetchall()
            result = []
            for c in company_rows:
                cid = c[0]
                emp_rows = conn.execute(
                    text(f"SELECT first_name, last_name, username, role FROM {ut} WHERE company_id = :cid ORDER BY first_name, last_name"),
                    {"cid": cid}
                ).fetchall()
                employees = [{"first_name": e[0] or "", "last_name": e[1] or "", "username": e[2], "role": e[3]} for e in emp_rows]
                result.append({
                    "company_id": cid,
                    "name": c[1],
                    "is_active": bool(c[2]),
                    "employee_count": len(employees),
                    "employees": employees,
                })
            return {"ok": True, "companies": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/create")
def create_company(req: CreateRequest):
    cid = req.company_id.strip().upper()
    if not cid:
        return JSONResponse({"ok": False, "error": "Company ID is required"}, 400)
    if len(req.admin_password) < 6:
        return JSONResponse({"ok": False, "error": "Password must be at least 6 characters"}, 400)

    try:
        _ensure_bootstrap_tables()
        with _engine.begin() as conn:
            if not _table_exists(conn, "company"):
                return JSONResponse({"ok": False, "error": "company table not found — start the main app at least once first"}, 400)

            existing = _scalar(conn, "SELECT id FROM company WHERE company_id = :cid", {"cid": cid})
            if existing:
                return JSONResponse({"ok": False, "error": f"Company ID '{cid}' already exists"}, 400)

            ut = _user_table()
            existing_user = conn.execute(
                text(f"SELECT id FROM {ut} WHERE username = :u AND company_id = :cid"),
                {"u": req.admin_username.strip(), "cid": cid}
            ).fetchone()
            if existing_user:
                return JSONResponse({"ok": False, "error": f"Username '{req.admin_username}' is already taken in company '{cid}'"}, 400)

            now = datetime.utcnow()
            company_uuid = str(uuid.uuid4())
            _exec(conn,
                "INSERT INTO company (id, created_at, company_id, name, is_active) VALUES (:id, :ca, :cid, :name, :active)",
              {"id": company_uuid, "ca": now, "cid": cid, "name": req.company_name.strip(), "active": True}
            )

            user_uuid = str(uuid.uuid4())
            pw_hash = hash_password(req.admin_password)
            admin_role_label = _resolve_admin_role_label(conn)
            _exec(conn,
                f"""INSERT INTO {ut}
                    (id, created_at, username, email, password_hash, first_name, last_name,
                     role, is_active, is_locked, force_password_reset, failed_login_attempts,
                     dark_mode, training_mode, db_environment, hire_date, company_id)
                VALUES
                    (:id, :ca, :un, :email, :pw, :fn, :ln,
                 CAST(:role AS userrole), :active, :false, :false2, 0,
                     :false3, :false4, 'production', :hire, :cid)""",
                {
                    "id": user_uuid, "ca": now,
                    "un": req.admin_username.strip(),
                    "email": req.admin_email or None,
                    "pw": pw_hash,
                    "fn": req.admin_first_name.strip() or "Admin",
                    "ln": req.admin_last_name.strip() or "User",
                "role": admin_role_label,
                    "active": True,
                    "false": False,
                    "false2": False,
                    "false3": False,
                    "false4": False,
                    "hire": now,
                    "cid": cid,
                }
            )

            settings_uuid = str(uuid.uuid4())
            _exec(conn,
                """INSERT INTO app_settings
                   (id, created_at, start_of_day, end_of_day, attendance_check_in_required,
                    monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled,
                    friday_enabled, saturday_enabled, sunday_enabled, company_name, company_id)
                VALUES
                   (:id, :ca, '06:00', '21:00', :t, :t, :t, :t, :t, :t, :t, :t, :cname, :cid)""",
                {"id": settings_uuid, "ca": now,
                  "t": True,
                 "cname": req.company_name.strip(), "cid": cid}
            )

        return {"ok": True, "company_id": cid, "company_name": req.company_name.strip(), "admin_username": req.admin_username.strip()}

    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, 500)


class AssignRequest(BaseModel):
    company_id: str
    company_name: str

@app.post("/assign-existing")
def assign_existing(req: AssignRequest):
    """Assign all untagged rows (NULL / DEFAULT / empty) to a new company."""
    TENANT_TABLES = [
        "user", "user_permission", "role", "role_permission",
        "client", "inventory", "inventory_image", "supplier",
        "descriptive_feature", "feature_option", "inventory_feature", "inventory_feature_option_data",
        "service", "service_resource", "service_asset", "service_employee",
        "service_location", "service_recipe",
        "schedule", "schedule_attendee", "schedule_document",
        "attendance", "app_settings", "document", "document_category", "document_assignment",
        "task", "task_link", "leave_request", "onboarding_request", "offboarding_request",
        "insurance_plan", "pay_slip", "sale_transaction", "sale_transaction_item",
        "chat_message", "document_template",
        "product_resource", "product_asset", "product_location", "client_cart_item",
    ]

    cid = req.company_id.strip().upper()
    if not cid:
        return JSONResponse({"ok": False, "error": "Company ID is required"}, 400)

    try:
        with _engine.begin() as conn:
            existing = _scalar(conn, "SELECT id FROM company WHERE company_id = :cid", {"cid": cid})
            if not existing:
                company_uuid = str(uuid.uuid4())
                now = datetime.utcnow()
                _exec(conn,
                    "INSERT INTO company (id, created_at, company_id, name, is_active) VALUES (:id, :ca, :cid, :name, :active)",
                    {"id": company_uuid, "ca": now, "cid": cid,
                     "name": req.company_name.strip() or cid,
                   "active": True}
                )

            updated = {}
            for table in TENANT_TABLES:
                if not _table_exists(conn, table):
                    continue
                cols = {row[0] for row in conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    f"WHERE table_schema='public' AND table_name='{table}'"
                )).fetchall()}
                if "company_id" not in cols:
                    continue

                quoted = f'"{table}"' if table == "user" else table
                result = conn.execute(text(
                    f"UPDATE {quoted} SET company_id = :cid WHERE company_id IS NULL OR company_id = 'DEFAULT' OR company_id = ''"
                ), {"cid": cid})
                if result.rowcount:
                    updated[table] = result.rowcount

            # Clean up DEFAULT placeholder company if empty
            default_co = conn.execute(text("SELECT id FROM company WHERE company_id = 'DEFAULT'")).fetchone()
            if default_co:
                ut = _user_table()
                still_using = _scalar(conn, f"SELECT COUNT(*) FROM {ut} WHERE company_id = 'DEFAULT'")
                if not still_using:
                    conn.execute(text("DELETE FROM company WHERE company_id = 'DEFAULT'"))

        return {"ok": True, "company_id": cid, "updated_tables": updated}

    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, 500)


# ── Embedded HTML ──────────────────────────────────────────────────────────────
HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BusinessManager — Company Creation</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem 4rem;
  }
  .header { text-align: center; margin-bottom: 2rem; }
  .header h1 { font-size: 1.75rem; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px; }
  .header p  { color: #94a3b8; margin-top: 0.4rem; font-size: 0.9rem; }

  .layout {
    display: flex;
    gap: 1.5rem;
    width: 100%;
    max-width: 1060px;
    align-items: flex-start;
  }

  /* ── Companies panel ── */
  .companies-panel {
    flex: 1 1 0;
    min-width: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .panel-header h2 {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6366f1;
  }
  .refresh-btn {
    background: none;
    border: 1px solid #334155;
    color: #64748b;
    border-radius: 0.375rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.72rem;
    cursor: pointer;
    width: auto;
    margin: 0;
    transition: border-color 0.15s, color 0.15s;
  }
  .refresh-btn:hover { border-color: #6366f1; color: #a5b4fc; background: none; }

  .company-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }
  .company-card-header {
    display: flex;
    align-items: center;
    padding: 0.9rem 1rem;
    cursor: pointer;
    user-select: none;
    gap: 0.75rem;
    transition: background 0.1s;
  }
  .company-card-header:hover { background: #263347; }
  .cid-tag {
    font-family: monospace;
    font-size: 0.78rem;
    font-weight: 700;
    background: #1e3a5f;
    border: 1px solid #1e40af;
    color: #93c5fd;
    border-radius: 0.375rem;
    padding: 0.2rem 0.55rem;
    white-space: nowrap;
  }
  .company-name {
    flex: 1;
    font-weight: 600;
    font-size: 0.9rem;
    color: #f1f5f9;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .emp-count {
    font-size: 0.75rem;
    color: #64748b;
    white-space: nowrap;
  }
  .inactive-badge {
    font-size: 0.65rem;
    background: #451a03;
    border: 1px solid #92400e;
    color: #fbbf24;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    font-weight: 700;
  }
  .chevron {
    color: #475569;
    font-size: 0.7rem;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .chevron.open { transform: rotate(90deg); }

  .employee-list {
    display: none;
    border-top: 1px solid #1e293b;
    padding: 0.5rem 0;
    background: #0f172a;
  }
  .employee-list.open { display: block; }
  .emp-row {
    display: flex;
    align-items: center;
    padding: 0.45rem 1rem;
    gap: 0.75rem;
    border-bottom: 1px solid #1a2438;
  }
  .emp-row:last-child { border-bottom: none; }
  .emp-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: #1e3a5f;
    border: 1px solid #1e40af;
    color: #93c5fd;
    font-size: 0.65rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .emp-name {
    flex: 1;
    font-size: 0.85rem;
    color: #e2e8f0;
    font-weight: 500;
  }
  .emp-username {
    font-size: 0.75rem;
    color: #64748b;
    font-family: monospace;
  }
  .emp-role {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
  }
  .emp-role.admin   { background: #2e1065; border: 1px solid #7c3aed; color: #c4b5fd; }
  .emp-role.manager { background: #1e3a5f; border: 1px solid #3b82f6; color: #93c5fd; }
  .emp-role.employee{ background: #052e16; border: 1px solid #166534; color: #86efac; }
  .emp-role.other   { background: #1e293b; border: 1px solid #475569; color: #94a3b8; }

  .no-companies {
    text-align: center;
    color: #475569;
    font-size: 0.85rem;
    padding: 2rem 1rem;
    background: #1e293b;
    border: 1px dashed #334155;
    border-radius: 0.75rem;
  }
  .panel-loading {
    text-align: center;
    color: #475569;
    font-size: 0.85rem;
    padding: 2rem;
  }

  /* ── Form card ── */
  .form-col {
    width: 480px;
    flex-shrink: 0;
  }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }
  .section-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6366f1;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #334155;
  }
  .field { margin-bottom: 1rem; }
  .field label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.35rem;
  }
  .field input {
    width: 100%;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 0.6rem 0.85rem;
    color: #f8fafc;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .field input:focus { border-color: #6366f1; }
  .field input.error { border-color: #ef4444; }
  .field .hint { font-size: 0.74rem; color: #64748b; margin-top: 0.25rem; }
  .row { display: flex; gap: 0.75rem; }
  .row .field { flex: 1; }
  .divider { height: 1px; background: #334155; margin: 1.5rem 0; }
  button {
    width: 100%;
    padding: 0.75rem;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 0.5rem;
  }
  button:hover { background: #4f46e5; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  .alert {
    border-radius: 0.5rem;
    padding: 0.85rem 1rem;
    font-size: 0.875rem;
    margin-top: 1rem;
    display: none;
  }
  .alert.show { display: block; }
  .alert.error   { background: #450a0a; border: 1px solid #991b1b; color: #fca5a5; }
  .alert.success { background: #052e16; border: 1px solid #166534; color: #86efac; }

  .success-box { text-align: center; padding: 1.5rem; display: none; }
  .success-box.show { display: block; }
  .success-box .check { font-size: 3rem; margin-bottom: 0.75rem; }
  .success-box h2 { font-size: 1.2rem; font-weight: 700; color: #4ade80; margin-bottom: 0.5rem; }
  .success-box p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem; }
  .success-box .cid-badge {
    display: inline-block;
    background: #1e3a5f;
    border: 1px solid #3b82f6;
    color: #93c5fd;
    border-radius: 0.375rem;
    padding: 0.25rem 0.75rem;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.05em;
    margin: 0.5rem 0;
  }
  .success-box button { margin-top: 1rem; max-width: 200px; margin-left: auto; margin-right: auto; }

  .status-bar {
    width: 100%;
    max-width: 1060px;
    margin-bottom: 1.25rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    padding: 0.65rem 1rem;
    font-size: 0.8rem;
    color: #64748b;
  }
  .status-bar.ok  { border-color: #166534; color: #86efac; }
  .status-bar.bad { border-color: #991b1b; color: #fca5a5; }
  .status-bar span.label { font-weight: 700; margin-right: 0.5rem; }

  .spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    vertical-align: middle;
    margin-right: 0.4rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 800px) {
    .layout { flex-direction: column-reverse; }
    .form-col { width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>BusinessManager</h1>
  <p>Company Provisioning Tool</p>
</div>

<div id="statusBar" class="status-bar">Checking database…</div>

<!-- Existing company selector -->
<div style="width:100%; max-width:1060px; margin-bottom:1rem; display:flex; gap:0.5rem; align-items:stretch;">
  <select id="companySelect"
    style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:0.5rem;
           padding:0.55rem 0.9rem; color:#e2e8f0; font-size:0.8rem; outline:none;">
    <option value="">Select an existing company...</option>
  </select>
  <button onclick="syncSelectedCompany()" style="width:auto; margin:0; padding:0.55rem 1.1rem; font-size:0.8rem; border-radius:0.5rem;">Use Selected</button>
</div>

<div class="layout">

  <!-- Left: Companies panel -->
  <div class="companies-panel">
    <div class="panel-header">
      <h2>Existing Companies</h2>
      <button class="refresh-btn" onclick="loadCompanies()">↻ Refresh</button>
    </div>
    <div id="companiesList"><div class="panel-loading">Loading…</div></div>
  </div>

  <!-- Right: Assign + Create form -->
  <div class="form-col">

    <!-- Assign existing data -->
    <div class="card" id="assignCard" style="margin-bottom:1.25rem;">
      <div class="section-title" style="color:#f59e0b;">Assign Existing Data to a Company</div>
      <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:1rem;">
        All rows currently untagged (no company ID) will be reassigned to the ID you enter below.
        Use this once to claim your existing data.
      </p>
      <div class="row">
        <div class="field">
          <label for="assign_id">Company ID <span style="color:#ef4444">*</span></label>
          <input id="assign_id" type="text" placeholder="e.g. 03897" autocomplete="off" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="field">
          <label for="assign_name">Company Name <span style="color:#ef4444">*</span></label>
          <input id="assign_name" type="text" placeholder="My Company">
        </div>
      </div>
      <div id="assignAlert" class="alert error"></div>
      <div id="assignSuccess" class="alert success"></div>
      <button id="assignBtn" onclick="assignExisting()" style="background:#b45309;">Assign Existing Data</button>
    </div>

    <div class="card" id="formCard">
      <div id="formSection">
        <div class="section-title">Company Details</div>

        <div class="field">
          <label for="company_id">Company ID <span style="color:#ef4444">*</span></label>
          <input id="company_id" type="text" placeholder="e.g. ACME" autocomplete="off" oninput="this.value=this.value.toUpperCase()">
          <div class="hint">Short unique code used at login. Letters &amp; numbers only.</div>
        </div>

        <div class="field">
          <label for="company_name">Company Name <span style="color:#ef4444">*</span></label>
          <input id="company_name" type="text" placeholder="e.g. Acme Corporation">
        </div>

        <div class="divider"></div>
        <div class="section-title">Admin User</div>

        <div class="row">
          <div class="field">
            <label for="first_name">First Name</label>
            <input id="first_name" type="text" placeholder="Admin">
          </div>
          <div class="field">
            <label for="last_name">Last Name</label>
            <input id="last_name" type="text" placeholder="User">
          </div>
        </div>

        <div class="field">
          <label for="username">Username <span style="color:#ef4444">*</span></label>
          <input id="username" type="text" placeholder="admin" autocomplete="off">
        </div>

        <div class="field">
          <label for="email">Email <span style="color:#64748b">(optional)</span></label>
          <input id="email" type="email" placeholder="admin@example.com">
        </div>

        <div class="row">
          <div class="field">
            <label for="password">Password <span style="color:#ef4444">*</span></label>
            <input id="password" type="password" placeholder="••••••••">
            <div class="hint">Min 6 characters</div>
          </div>
          <div class="field">
            <label for="confirm">Confirm Password <span style="color:#ef4444">*</span></label>
            <input id="confirm" type="password" placeholder="••••••••">
          </div>
        </div>

        <div id="errorAlert" class="alert error"></div>
        <button id="submitBtn" onclick="submitForm()">Create Company</button>
      </div>

      <div id="successSection" class="success-box">
        <div class="check">✅</div>
        <h2>Company Created!</h2>
        <p>Your new company is ready.</p>
        <p style="margin-top:0.75rem; color:#e2e8f0; font-weight:600;">Company ID</p>
        <div id="successCid" class="cid-badge"></div>
        <p id="successName" style="color:#94a3b8; font-size:0.8rem;"></p>
        <p style="margin-top:1rem; color:#94a3b8;">Admin username: <strong id="successUser" style="color:#e2e8f0;"></strong></p>
        <p style="color:#64748b; font-size:0.78rem; margin-top:0.5rem;">Users can now log in using the Company ID above.</p>
        <button onclick="resetForm()" style="background:#334155;">Create Another</button>
      </div>
    </div>
  </div>

</div><!-- .layout -->

<script>
function initials(first, last) {
  return ((first || '?')[0] + (last || '?')[0]).toUpperCase();
}

function roleClass(role) {
  if (!role) return 'other';
  const r = role.toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'employee') return 'employee';
  return 'other';
}

function toggleEmployees(cid) {
  const list = document.getElementById('emp-' + cid);
  const chev = document.getElementById('chev-' + cid);
  if (!list) return;
  list.classList.toggle('open');
  chev.classList.toggle('open');
}

let cachedCompanies = [];

function populateCompanyDropdown(companies) {
  const select = document.getElementById('companySelect');
  if (!select) return;

  select.innerHTML = '<option value="">Select an existing company...</option>';
  companies.forEach(c => {
    const option = document.createElement('option');
    option.value = c.company_id;
    option.textContent = `${c.company_id} - ${c.name}`;
    select.appendChild(option);
  });
}

function syncSelectedCompany() {
  const select = document.getElementById('companySelect');
  const cid = select?.value || '';
  if (!cid) return;
  const selected = cachedCompanies.find(c => c.company_id === cid);
  if (!selected) return;

  // Prefill assign section for claiming existing untagged rows.
  const assignId = document.getElementById('assign_id');
  const assignName = document.getElementById('assign_name');
  if (assignId) assignId.value = selected.company_id;
  if (assignName) assignName.value = selected.name;

  // Prefill create section to reduce manual re-entry.
  const companyId = document.getElementById('company_id');
  const companyName = document.getElementById('company_name');
  if (companyId) companyId.value = selected.company_id;
  if (companyName) companyName.value = selected.name;
}

async function loadCompanies() {
  const container = document.getElementById('companiesList');
  container.innerHTML = '<div class="panel-loading">Loading…</div>';
  try {
    const r = await fetch('/companies');
    const d = await r.json();
    if (!d.ok) {
      cachedCompanies = [];
      populateCompanyDropdown([]);
      container.innerHTML = `<div class="no-companies">${d.error}</div>`;
      return;
    }
    cachedCompanies = d.companies || [];
    populateCompanyDropdown(cachedCompanies);
    if (!d.companies.length) {
      container.innerHTML = '<div class="no-companies">No companies yet.<br>Create the first one →</div>';
      return;
    }
    container.innerHTML = d.companies.map(c => {
      const empRows = c.employees.map(e => {
        const fullName = [e.first_name, e.last_name].filter(Boolean).join(' ') || e.username;
        return `<div class="emp-row">
          <div class="emp-avatar">${initials(e.first_name, e.last_name)}</div>
          <div class="emp-name">${fullName}</div>
          <div class="emp-username">@${e.username}</div>
          <div class="emp-role ${roleClass(e.role)}">${e.role || '—'}</div>
        </div>`;
      }).join('');

      const activeBadge = !c.is_active ? '<span class="inactive-badge">INACTIVE</span>' : '';
      const empLabel = c.employee_count === 1 ? '1 employee' : `${c.employee_count} employees`;

      return `<div class="company-card">
        <div class="company-card-header" onclick="toggleEmployees('${c.company_id}')">
          <span class="cid-tag">${c.company_id}</span>
          <span class="company-name">${c.name}</span>
          ${activeBadge}
          <span class="emp-count">${empLabel}</span>
          <span class="chevron" id="chev-${c.company_id}">▶</span>
        </div>
        <div class="employee-list" id="emp-${c.company_id}">
          ${empRows || '<div style="padding:0.75rem 1rem; color:#475569; font-size:0.8rem;">No employees</div>'}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    cachedCompanies = [];
    populateCompanyDropdown([]);
    container.innerHTML = `<div class="no-companies">Cannot reach server</div>`;
  }
}

async function assignExisting() {
  const cid  = document.getElementById('assign_id').value.trim().toUpperCase();
  const name = document.getElementById('assign_name').value.trim();
  const errEl = document.getElementById('assignAlert');
  const okEl  = document.getElementById('assignSuccess');
  errEl.classList.remove('show'); okEl.classList.remove('show');

  if (!cid)  { errEl.textContent = 'Company ID is required.'; errEl.classList.add('show'); return; }
  if (!name) { errEl.textContent = 'Company Name is required.'; errEl.classList.add('show'); return; }

  const btn = document.getElementById('assignBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Assigning…';

  try {
    const r = await fetch('/assign-existing', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({company_id: cid, company_name: name})
    });
    const d = await r.json();
    if (d.ok) {
      const tables = Object.entries(d.updated_tables || {});
      const summary = tables.length
        ? tables.map(([t, n]) => `${t}: ${n} row${n !== 1 ? 's' : ''}`).join(', ')
        : 'no untagged rows found';
      okEl.textContent = `Done! Company ID "${d.company_id}" assigned. Updated — ${summary}`;
      okEl.classList.add('show');
      loadStatus();
      loadCompanies();
    } else {
      errEl.textContent = d.error || 'Unknown error';
      errEl.classList.add('show');
    }
  } catch(e) {
    errEl.textContent = 'Network error: ' + e.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Assign Existing Data';
  }
}

async function loadStatus() {
  const bar = document.getElementById('statusBar');
  try {
    const r = await fetch('/status');
    const d = await r.json();
    if (d.ok) {
      const count = d.companies.length;
      bar.innerHTML = `<span class="label">✓ ${d.database}</span> ${count} compan${count === 1 ? 'y' : 'ies'} registered`;
      bar.className = 'status-bar ok';
    } else {
      bar.innerHTML = `<span class="label">⚠ DB Error:</span> ${d.error}`;
      bar.className = 'status-bar bad';
    }
  } catch(e) {
    bar.innerHTML = `<span class="label">⚠ Cannot reach server</span>`;
    bar.className = 'status-bar bad';
  }
}

function showError(msg) {
  const el = document.getElementById('errorAlert');
  el.textContent = msg;
  el.classList.add('show');
}

function clearError() {
  const el = document.getElementById('errorAlert');
  el.textContent = '';
  el.classList.remove('show');
}

async function submitForm() {
  clearError();
  const company_id   = document.getElementById('company_id').value.trim().toUpperCase();
  const company_name = document.getElementById('company_name').value.trim();
  const username     = document.getElementById('username').value.trim();
  const password     = document.getElementById('password').value;
  const confirm      = document.getElementById('confirm').value;
  const first_name   = document.getElementById('first_name').value.trim() || 'Admin';
  const last_name    = document.getElementById('last_name').value.trim()  || 'User';
  const email        = document.getElementById('email').value.trim() || null;

  if (!company_id)   return showError('Company ID is required.');
  if (!/^[A-Z0-9_-]+$/.test(company_id)) return showError('Company ID may only contain letters, numbers, hyphens and underscores.');
  if (!company_name) return showError('Company Name is required.');
  if (!username)     return showError('Admin username is required.');
  if (password.length < 6) return showError('Password must be at least 6 characters.');
  if (password !== confirm)  return showError('Passwords do not match.');

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Creating…';

  try {
    const r = await fetch('/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({company_id, company_name, admin_username: username,
                            admin_password: password, admin_first_name: first_name,
                            admin_last_name: last_name, admin_email: email})
    });
    const d = await r.json();
    if (d.ok) {
      document.getElementById('formSection').style.display = 'none';
      const s = document.getElementById('successSection');
      s.classList.add('show');
      document.getElementById('successCid').textContent  = d.company_id;
      document.getElementById('successName').textContent = d.company_name;
      document.getElementById('successUser').textContent = d.admin_username;
      loadStatus();
      loadCompanies();
    } else {
      showError(d.error || 'Unknown error');
    }
  } catch(e) {
    showError('Network error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create Company';
  }
}

function resetForm() {
  ['company_id','company_name','username','email','password','confirm','first_name','last_name']
    .forEach(id => document.getElementById(id).value = '');
  clearError();
  document.getElementById('formSection').style.display = '';
  document.getElementById('successSection').classList.remove('show');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('submitBtn').disabled) submitForm();
});

loadStatus();
loadCompanies();
</script>
</body>
</html>"""

# ── Entry point ────────────────────────────────────────────────────────────────
def _pick_available_port(preferred_port: int, host: str = "127.0.0.1", max_tries: int = 25) -> int:
  """Return the first available port, starting from preferred_port."""
  for port in range(preferred_port, preferred_port + max_tries):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
      s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
      try:
        s.bind((host, port))
        return port
      except OSError:
        continue
  raise RuntimeError(f"No open port found in range {preferred_port}-{preferred_port + max_tries - 1}")


if __name__ == "__main__":
    try:
        import uvicorn
    except ImportError:
        print("ERROR: uvicorn not installed. Run: pip install -r requirements.txt")
        sys.exit(1)
    print("\n  BusinessManager — Company Creation UI")
    print("  ──────────────────────────────────────")
    db_label = "PostgreSQL (remote)"
    print(f"  Database : {db_label}")
    preferred_port = int(os.environ.get("COMPANY_CREATION_PORT", "8765"))
    port = _pick_available_port(preferred_port)
    if port != preferred_port:
      print(f"  Port     : {preferred_port} is busy, using {port}")
    print(f"  Open     : http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")

