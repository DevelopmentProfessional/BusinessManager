# Render Deployment Performance Optimizations

Six issues have been identified that slow Render cold starts and redeployments.
None of these changes affect application behavior — they are purely startup/infrastructure improvements.

---

## Issue 1 — Inefficient Health Check Query

**File:** `backend/main.py` — `health_check()` function (~line 154)

**Problem:**
```python
user_count = session.query(User).count()   # full table scan on every health poll
```
Render polls `/health` continuously. A `COUNT(*)` on the User table creates unnecessary I/O and query planning on every poll.

**Fix:** Replace with a direct `SELECT 1` — only checks connectivity, no table involved.

```python
@app.get("/health")
async def health_check():
    try:
        from backend.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "message": "Business Management API is running",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": "Database connection failed",
            "error": str(e)
        }
```

Also remove the `from backend.models import User` import that was only needed for the old query.

**Expected impact:** Eliminates a table scan on every health check poll.

---

## Issue 2 — Database Migrations Running on Every Startup

**File:** `backend/database.py` — `create_db_and_tables()` function (~line 151)

**Problem:**
`create_db_and_tables()` runs 15+ migration-check functions on every startup. Each function makes one or more database round-trips to check if columns/tables already exist. On a production PostgreSQL deployment on Render, this adds significant latency to every restart.

**Fix:** Add a `schema_migration` table that stores a version string. Skip all migration functions when the version is already current. `SQLModel.metadata.create_all()` still runs always (needed for fresh deployments — it is idempotent).

### Step 1 — Add version constant and helper functions to `database.py`:

```python
# Bump this string whenever you add a new migration function
CURRENT_SCHEMA_VERSION = "2026.02.25.1"

def _schema_is_current() -> bool:
    """Returns True if schema is already at CURRENT_SCHEMA_VERSION."""
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migration (version TEXT PRIMARY KEY)"))
            result = conn.execute(
                text("SELECT 1 FROM schema_migration WHERE version = :v"),
                {"v": CURRENT_SCHEMA_VERSION}
            ).fetchone()
            return result is not None
    except Exception:
        return False

def _mark_schema_current():
    """Record that the schema is now at CURRENT_SCHEMA_VERSION."""
    try:
        with engine.begin() as conn:
            if DATABASE_URL.startswith("sqlite"):
                conn.execute(
                    text("INSERT OR REPLACE INTO schema_migration (version) VALUES (:v)"),
                    {"v": CURRENT_SCHEMA_VERSION}
                )
            else:
                conn.execute(
                    text("INSERT INTO schema_migration (version) VALUES (:v) ON CONFLICT (version) DO NOTHING"),
                    {"v": CURRENT_SCHEMA_VERSION}
                )
    except Exception as e:
        print(f"Warning: Could not mark schema version: {e}")
```

### Step 2 — Update `create_db_and_tables()`:

```python
def create_db_and_tables():
    """Create database tables and run safe migrations."""
    # Always run create_all — idempotent metadata check, required for fresh deploys
    SQLModel.metadata.create_all(engine)

    if _schema_is_current():
        print(f"Schema version {CURRENT_SCHEMA_VERSION} already applied, skipping migrations.")
        return

    print(f"Running migrations to schema version {CURRENT_SCHEMA_VERSION}...")
    _migrate_products_and_inventory_to_items_if_needed()
    _migrate_document_entity_type_enum_to_varchar()
    _ensure_item_type_column_if_needed()
    _migrate_documents_table_if_needed()
    _ensure_document_extra_columns_if_needed()
    _ensure_employee_user_id_column_if_needed()
    _ensure_employee_supervisor_column_if_needed()
    _normalize_item_types_if_needed()
    _ensure_inventory_image_table_if_needed()
    _ensure_service_duration_column_if_needed()
    _ensure_schedule_extra_columns_if_needed()
    _ensure_user_extra_columns_if_needed()
    _ensure_signature_columns_if_needed()
    _ensure_user_profile_picture_if_needed()
    _seed_user_colors_if_needed()
    _seed_insurance_plans_if_needed()
    _ensure_leave_request_supervisor_id_if_needed()
    _mark_schema_current()
    print("Migrations complete.")
```

> **Important:** Every time you add a new `_ensure_*` or `_migrate_*` function, bump `CURRENT_SCHEMA_VERSION`
> (e.g. `"2026.03.01.1"`). This triggers the migrations to run on the next deployment.

**Expected impact:** On same-code redeployments, eliminates 15+ database round-trips at startup.

---

## Issue 3 — Redundant Logging Setup

**File:** `backend/main.py` — lines 12–23

**Problem:**
```python
_SQLALCHEMY_LOGGERS_TO_DISABLE = (
    "sqlalchemy",
    "sqlalchemy.engine",
    "sqlalchemy.pool",
    "sqlalchemy.dialects",
    "sqlalchemy.orm",
    "sqlalchemy.engine.base.Engine",
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.pool.impl.QueuePool",
)
for _logger_name in _SQLALCHEMY_LOGGERS_TO_DISABLE:
    logging.getLogger(_logger_name).disabled = True
```

Python's logging system is hierarchical. All `sqlalchemy.*` child loggers inherit from the root `sqlalchemy` logger. Disabling each one individually is unnecessary.

**Fix:** Replace the entire block (lines 12–23) with:
```python
logging.getLogger("sqlalchemy").setLevel(logging.CRITICAL)
logging.getLogger("sqlalchemy").propagate = False
```

**Expected impact:** Minor — removes 6 redundant logger lookups at import time. More importantly, makes the intent clearer and is easier to maintain.

---

## Issue 4 — render.yaml Build Optimization

**File:** `render.yaml` — line 24

**Problem:**
```yaml
buildCommand: cd frontend && ... npm install && npm run build
```
`npm install` resolves and re-evaluates the dependency tree on every build.

**Fix:** Use `npm ci` instead. It installs directly from `package-lock.json` without resolution, which is faster and more reproducible in CI/CD environments.

```yaml
buildCommand: cd frontend && VITE_API_URL=https://businessmanager-reference-api.onrender.com/api/v1 VITE_ONLYOFFICE_URL=https://businessmanager-onlyoffice.onrender.com npm ci && npm run build
```

**Expected impact:** Faster frontend builds, especially on Render's cached builds where `node_modules` is partially preserved.

---

## Issue 5 — Dependencies

**File:** `backend/requirements.txt`

All 10 packages are actively used — no candidates for removal:

| Package | Used for |
|---------|----------|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `sqlmodel` | ORM + models |
| `python-multipart` | File upload parsing |
| `python-dotenv` | Environment config |
| `PyJWT` | Auth tokens |
| `bcrypt` | Password hashing |
| `pandas` | CSV import in settings router |
| `openpyxl` | Excel file operations |
| `psycopg[binary]` | PostgreSQL driver (binary = no compile step) |

**Future optimization (optional):** `pandas` is ~30 MB and is only used for CSV parsing. If the CSV import feature is rewritten using Python's built-in `csv` module, `pandas` and `openpyxl` could potentially be removed — saving install time and container size. This is a larger refactor and should be done separately.

**No changes needed now.**

---

## Issue 6 — OnlyOffice Script Load Timeout

**File:** `frontend/src/pages/components/Editor_OnlyOffice.jsx` — `loadOnlyOfficeScript()` function (lines 5–23)

**Problem:**
The `loadOnlyOfficeScript` function has no timeout. If the OnlyOffice server is unreachable (it's a separate Render service that may be cold), the browser will hang for minutes waiting for the script before eventually timing out on its own. This blocks the entire editor UI.

**Fix:** Add a 10-second timeout inside the Promise. Clear it on success or failure.

```javascript
function loadOnlyOfficeScript(onlyofficeUrl, timeoutMs = 10000) {
  const url = `${onlyofficeUrl.replace(/\/+$/, '')}/web-apps/apps/api/documents/api.js`;
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve(window.DocsAPI);

    const existing = Array.from(document.getElementsByTagName('script'))
      .find(s => s.src === url);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.DocsAPI));
      existing.addEventListener('error', () => reject(new Error('Failed to load OnlyOffice script')));
      return;
    }

    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error(`OnlyOffice script timed out after ${timeoutMs / 1000}s. Server may be starting up.`));
      }
    }, timeoutMs);

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (!done) { done = true; clearTimeout(timer); resolve(window.DocsAPI); }
    };
    script.onerror = () => {
      if (!done) { done = true; clearTimeout(timer); reject(new Error('Failed to load OnlyOffice script')); }
    };
    document.head.appendChild(script);
  });
}
```

Replace the existing `loadOnlyOfficeScript` function (lines 5–23) with this version. No other changes needed — the existing `.catch()` handler already displays the error message to the user.

**Expected impact:** Editor shows an error within 10 seconds if OnlyOffice is unreachable, instead of hanging indefinitely.

---

## Summary of Changes

| File | Change | Priority |
|------|--------|----------|
| `backend/main.py` | Replace `User.count()` with `SELECT 1` in health check | High |
| `backend/main.py` | Replace 8 logging disable calls with 2 lines | Low |
| `backend/database.py` | Add schema versioning to skip migrations on same-version restarts | High |
| `render.yaml` | `npm install` → `npm ci` | Medium |
| `frontend/src/pages/components/Editor_OnlyOffice.jsx` | Add 10s timeout to script load | Medium |
| `backend/requirements.txt` | No changes needed | — |
