V Q# BusinessManager Application Audit

**Date:** February 11, 2026
**Branch:** Document-Management
**Audited By:** Claude Code (Opus 4.6)

---

## Table of Contents

1. [Application Structure](#1-application-structure)
2. [Broken Things](#2-broken-things)
3. [Missing Things](#3-missing-things)
4. [Possible Improvements](#4-possible-improvements)
5. [Duplicates & Redundancies](#5-duplicates--redundancies)
6. [Git & Deployment State](#6-git--deployment-state)

---

## 1. Application Structure

### Directory Overview

```
BusinessManager/
├── backend/                          # FastAPI Python backend
│   ├── main.py                       # App entry point, startup, CORS, document endpoints
│   ├── database.py                   # Engine setup, migrations, session management
│   ├── db_config.py                  # Multi-environment DB switching (local/dev/test/prod)
│   ├── models.py                     # All SQLModel table definitions + Pydantic schemas
│   ├── requirements.txt              # Python dependencies
│   ├── db_environment.json           # Current environment selection (untracked)
│   ├── api_docs.html                 # Swagger/API reference page
│   ├── routers/
│   │   ├── auth.py                   # Authentication, JWT, users, roles, permissions
│   │   ├── isud.py                   # Generic CRUD router for all tables
│   │   ├── settings.py               # AppSettings singleton endpoint
│   │   └── database_connections.py   # DB connection management endpoints
│   ├── migrations/
│   │   └── add_days_of_operation.py  # Manual migration script
│   ├── scripts/
│   │   ├── migrate_document_entity_type.py
│   │   └── verify_insert.py
│   └── uploads/                      # Document file storage (UUID-named files)
│       └── .gitkeep
│
├── frontend/                         # React + Vite frontend
│   ├── vite.config.js                # Vite config (HTTPS, proxy to backend, build)
│   ├── package.json                  # Frontend dependencies
│   ├── tailwind.config.js            # Dynamic color theming via CSS variables
│   ├── postcss.config.js             # Tailwind + Autoprefixer
│   ├── index.html                    # SPA entry HTML
│   └── src/
│       ├── main.jsx                  # React entry (imports Bootstrap CSS + Tailwind)
│       ├── App.jsx                   # Route definitions, auth guards, lazy loading
│       ├── index.css                 # Tailwind directives + Bootstrap overrides
│       ├── debug-api-config.js       # Debug utility for API config
│       ├── services/
│       │   ├── api.js                # Axios instance, all API endpoint functions
│       │   ├── useStore.js           # Zustand global state (auth, CRUD, permissions)
│       │   ├── useDarkMode.js        # Dark mode persistence hook
│       │   └── useBranding.js        # Dynamic color palette generation
│       ├── pages/
│       │   ├── Login.jsx             # Login + password reset flow
│       │   ├── Profile.jsx           # User profile + dark mode + DB env switch
│       │   ├── Clients.jsx           # Client management
│       │   ├── Inventory.jsx         # Inventory (products/resources/assets)
│       │   ├── Documents.jsx         # Document management + file upload
│       │   ├── DocumentEditor.jsx    # OnlyOffice-based editing
│       │   ├── Employees.jsx         # User/employee management + permissions
│       │   ├── Sales.jsx             # POS / checkout
│       │   ├── Schedule.jsx          # Calendar views (month/week/day)
│       │   ├── Services.jsx          # Service management
│       │   ├── Suppliers.jsx         # Supplier management
│       │   ├── Attendance.jsx        # Attendance tracking
│       │   ├── Reports.jsx           # Reporting dashboards
│       │   ├── Settings.jsx          # App settings + DB connections
│       │   └── NotFound.jsx          # 404 page with cookie/session cleanup
│       └── pages/components/
│           ├── Layout.jsx            # Sidebar + mobile nav + route wrappers
│           ├── Modal.jsx             # Reusable modal (standard + fullscreen)
│           ├── PermissionGate.jsx    # Permission-based UI hiding
│           ├── PermissionDebug.jsx   # Dev tool for permission matrix
│           ├── DocumentViewerModal.jsx  # Preview images, PDFs, DOCX, text
│           ├── DocumentEditModal.jsx # Inline document editing
│           ├── ClientForm.jsx        # Client CRUD form
│           ├── ItemForm.jsx          # Inventory CRUD form + barcode scanner
│           ├── ScheduleForm.jsx      # Schedule CRUD form
│           ├── ServiceForm.jsx       # Service CRUD form
│           ├── EmployeeFormTabs.jsx  # Multi-tab employee form
│           ├── DatabaseConnectionManager.jsx  # DB connection CRUD UI
│           ├── CustomDropdown.jsx    # Reusable dropdown
│           ├── ItemDetailModal.jsx   # Inventory detail view
│           ├── ActionFooter.jsx      # Mobile action bar
│           ├── CheckoutModal.jsx     # POS checkout flow
│           ├── AttendanceWidget.jsx  # Clock in/out widget
│           ├── BarcodeScanner.jsx    # Camera-based barcode scanning
│           ├── CSVImportButton.jsx   # CSV import trigger
│           ├── DataImportModal.jsx   # Bulk data import
│           ├── DarkModeToggle.jsx    # Theme toggle button
│           ├── ClockInOut.jsx        # Attendance clock component
│           ├── OnlyOfficeEditor.jsx  # OnlyOffice integration
│           ├── ReportChart.jsx       # Chart.js wrapper
│           ├── ReportFilter.jsx      # Report filtering
│           ├── SalesChartModal.jsx   # Sales chart display
│           ├── GlobalClientModal.jsx # Client quick-add from any page
│           ├── IconButton.jsx        # Reusable icon button
│           ├── MobileAddButton.jsx   # Mobile floating add button
│           ├── MobileTable.jsx       # Responsive table
│           ├── Scrollable.jsx        # Scrollable container
│           ├── SquareImage.jsx       # Aspect-ratio image
│           ├── imageUtils.js         # Image processing helpers
│           └── editors/
│               ├── RichTextEditor.jsx      # Tiptap rich text editor
│               ├── CodeEditor.jsx          # CodeMirror code editor
│               ├── EditorToolbar.jsx       # Shared editor toolbar
│               ├── useDocumentEditor.js    # Editor state hook
│               └── documentEditorUtils.js  # Doc type detection utilities
│
├── ssl/                              # SSL certificate generation
│   └── generate_certs.py            # Self-signed cert script
├── testscripts/                      # Test/debug scripts
├── start-server.ps1                  # PowerShell dev start script (frontend + backend)
├── render.yaml                       # Render.com deployment config
├── eslint.config.js                  # ESLint configuration
├── package.json                      # Root package.json (dependencies here, not in frontend/)
├── package-lock.json                 # Lock file
├── business_manager.db               # Local SQLite database (224 KB)
└── .gitignore                        # Comprehensive ignore rules
```

### Architecture Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | FastAPI + SQLModel + SQLAlchemy | Generic ISUD router for all tables |
| **Database** | PostgreSQL (Render) / SQLite (local) | Switchable via `db_config.py` |
| **Frontend** | React 18 + Vite 7 | Lazy-loaded pages, Zustand state |
| **Styling** | TailwindCSS + Bootstrap 5 (mixed) | Both loaded - see Issues |
| **Auth** | JWT + bcrypt | Role-based with granular permissions |
| **Deployment** | Render.com | Static frontend + Python backend + PostgreSQL |

### Key API Pattern

All table CRUD goes through one generic router: `POST/GET/PATCH/DELETE /api/v1/isud/{table_name}`

Specialized routers exist for: authentication (`/api/v1/auth/`), settings (`/api/v1/settings/`), database connections (`/api/v1/database-connections/`), and document file operations (`/api/v1/documents/`).

---

## 2. Broken Things

### CRITICAL: Bare `session.commit()` calls in `isud.py` (will cause 500 errors)

Multiple commit calls in the generic CRUD router have no error handling. When a database constraint is violated or any error occurs, these produce unhelpful 500 errors with no rollback.

| Location | Endpoint | Fix |
|----------|----------|-----|
| `backend/routers/isud.py:429` | `insert_record` (non-file insert) | Wrap in `try/except` with `session.rollback()` |
| `backend/routers/isud.py:452` | `update_by_id` | Same |
| `backend/routers/isud.py:560` | `update_records` (bulk) | Same |
| `backend/routers/isud.py:572` | `update_records` (single) | Same |

**Example fix:**
```python
# Before (broken):
session.add(record)
session.commit()
session.refresh(record)

# After (fixed):
session.add(record)
try:
    session.commit()
    session.refresh(record)
except Exception as e:
    session.rollback()
    raise HTTPException(status_code=400, detail=str(e))
```

### CRITICAL: Missing `session` parameter in `_serialize_record()` calls

Two call sites pass only `(record, table_name)` but the function needs `session` for inventory image loading and relationship access.

| Location | Fix |
|----------|-----|
| `backend/routers/isud.py:431` | Change to `_serialize_record(record, table_name, session)` |
| `backend/routers/isud.py:574` | Change to `_serialize_record(record, table_name, session)` |

### HIGH: `DatabaseConnectionManager.jsx` was using hardcoded `http://localhost:8000`

**Status: FIXED in this session** - Changed to use the shared `api` service which routes through the Vite HTTPS proxy and includes auth tokens automatically. The hardcoded HTTP URL was causing mixed-content errors from the HTTPS dev server, producing the 500 error on the Settings page.

### HIGH: `db_environment.json` not set / not gitignored

The file that controls which database the backend connects to (`backend/db_environment.json`):
- Is **not tracked** in git
- Is **not in `.gitignore`**
- Defaults to `"local"` (SQLite) when missing
- Anyone cloning the repo gets no data because they hit an empty SQLite DB

**Fix:** Add `backend/db_environment.json` to `.gitignore` and document the setup step in README.

### HIGH: Local branch is 6 commits behind `origin/Document-Management`

Missing commits include README.md, Task model, and other changes. The local codebase is out of date.

**Fix:** `git pull origin Document-Management`

### MEDIUM: `Document-Management` branch is not descended from `main`

The branch has diverged from or was never branched from `main`. Merging to `main` will likely require careful conflict resolution.

**Fix:** When ready to merge, use a squash merge strategy or rebase onto main.

---

## 3. Missing Things

### Missing `READ_SCHEMA_MAP` entries in `isud.py`

These models have Read schemas defined in `models.py` but aren't registered in the ISUD router's schema map. ISUD queries for these tables will fall back to raw `model_dump()` which may expose relationships or miss computed fields.

| Table | Schema Exists | In Map |
|-------|--------------|--------|
| `supplier` | No schema defined | No |
| `attendance` | No schema defined | No |
| `app_settings` | `AppSettingsRead` | No |
| `role` | `RoleRead` | No |
| `role_permission` | `RolePermissionRead` | No |
| `user_permission` | `UserPermissionRead` | No |
| `inventory_image` | `InventoryImageRead` | No |
| `database_connection` | `DatabaseConnectionRead` | No |

**Fix:** Add entries to `READ_SCHEMA_MAP` in `isud.py` and create `SupplierRead` / `AttendanceRead` schemas.

### Missing `README.md` on local branch

The remote has a README (71 lines) but it's not on the local branch. Pulling from remote will resolve this.

### Missing Linux/macOS start script

`start-server.ps1` is Windows-only. No equivalent `start-server.sh` exists for Linux deployment or cross-platform development.

**Fix:** Create a `start-server.sh` bash equivalent.

### Missing Error Boundaries in React

No React error boundaries exist. If any component throws during render, the entire app crashes with a white screen.

**Fix:** Add an `<ErrorBoundary>` wrapper around route content in `App.jsx`.

---

## 4. Possible Improvements

### Bootstrap + TailwindCSS Conflict (Medium Priority)

Both frameworks are loaded simultaneously:
- `main.jsx` imports Bootstrap CSS globally
- `index.css` loads Tailwind directives after Bootstrap
- Components mix both: Bootstrap (`card`, `btn`, `form-control`, `d-flex`, `badge`, `spinner-border`, `modal`) alongside Tailwind (`flex`, `text-gray-900`, `dark:bg-gray-800`)

**Impact:** CSS specificity conflicts, unpredictable styling, larger bundle size.

**Affected components:** `Profile.jsx`, `Layout.jsx`, `DatabaseConnectionManager.jsx`, all form components, all modal usage.

**Recommendation:** Standardize on Tailwind. Create a migration plan to replace Bootstrap classes incrementally. The `index.css` already has Tailwind replacements for `.btn-primary`, `.btn-secondary`, etc.

### Debug Print Statements in `auth.py`

Lines 547-632 and 780-824 contain extensive debug logging with fire emoji (`🔥 PERMISSION CREATE DEBUG`, etc.). These are useful for development but should be replaced with proper `logging` calls or removed before production.

### Hardcoded Database Credentials in `db_config.py`

The Render PostgreSQL connection string (including username and password) is hardcoded in `DATABASE_ENVIRONMENTS`. If the repo is ever public, these credentials are exposed.

**Fix:** Move to environment variables. In production, Render already injects `DATABASE_URL`. For local development pointing at Render, use a `.env` file (already gitignored).

### `settings.py` commits without explicit error handling

Lines 34 and 60 in `backend/routers/settings.py` have `session.commit()` without try/except. While these are simple operations unlikely to fail, they should follow the same pattern as the rest of the codebase for consistency.

### Cookie Clearing in `NotFound.jsx`

Line 26 uses `document.cookie.split(";").forEach(...)` to clear cookies, which is unreliable across browsers. Replace with explicit cookie deletion for known cookie names.

### Component Size

Several page components exceed 500 lines (e.g., `Login.jsx` at 525 lines). Consider extracting sub-components for maintainability.

### Form Validation

Validation logic is duplicated across form components. Consider a shared validation utility or a library like `react-hook-form` + `zod`.

---

## 5. Duplicates & Redundancies

### Duplicate `_serialize_records()` function in `isud.py`

Defined twice:
- **First definition:** Lines 106-127 (full implementation)
- **Second definition:** Lines 497-499 (overrides the first)

The second definition is a simple wrapper that calls `_serialize_record` in a loop. The first has additional logic. The second silently replaces the first at import time.

**Fix:** Remove the duplicate at line 497-499.

### Duplicate `useDarkMode.js` files

Two files with the same name in different directories:
- `frontend/src/services/useDarkMode.js` (active, imported by components)
- `frontend/src/scripts/useDarkMode.js` (appears unused/legacy)

**Fix:** Delete `src/scripts/useDarkMode.js` if unused. Verify no imports reference it first.

### Legacy `itemsAPI` alias in `api.js`

Line 225: `export const itemsAPI = inventoryAPI;` exists as a backward-compatibility alias from when inventory was called "items."

**Fix:** Search for `itemsAPI` imports across the frontend. If none remain, remove the alias.

### Redundant `debug-api-config.js`

`frontend/src/debug-api-config.js` (13 lines) is a debug utility that logs API configuration. This duplicates the debug logging already in `api.js` lines 32-39.

**Fix:** Remove if not actively used for debugging.

---

## 6. Git & Deployment State

### Branch Summary

| Branch | Status |
|--------|--------|
| `main` | Base branch, not currently checked out |
| `Document-Management` (local) | Active branch, 6 commits behind remote |
| `origin/Document-Management` | Has README, Task model, and other updates |
| `document-management` (lowercase) | Created by accident on laptop 2 — may need cleanup |

### Uncommitted Changes (current working tree)

| File | Change | Source |
|------|--------|--------|
| `backend/main.py` | Database connection seeding added to startup | This session |
| `frontend/src/pages/components/DatabaseConnectionManager.jsx` | Refactored to use shared `api` service | This session |
| `frontend/vite.config.js` | SSL config simplified to use `@vitejs/plugin-basic-ssl` | Previous change |
| `backend/db_environment.json` | **Untracked** — set to `"development"` (Render DB) | This session |

### Render Deployment Config (`render.yaml`)

```
Backend:  uvicorn backend.main:app --host 0.0.0.0 --port $PORT
Frontend: Static site built from frontend/dist
Database: PostgreSQL on Render (dd_reference_temp)
```

The deployment config looks correct. The backend build command installs from `backend/requirements.txt` and the frontend build uses Vite with the production API URL injected.

### Recommended Immediate Actions

1. **Pull remote changes:** `git pull origin Document-Management` to get the 6 missing commits
2. **Add to `.gitignore`:** `backend/db_environment.json`
3. **Fix the 4 bare commits** in `isud.py` (highest code risk)
4. **Fix the 2 missing session params** in `isud.py`
5. **Remove the duplicate** `_serialize_records()` in `isud.py`
6. **Decide on the database connection seeding** added to `main.py` startup — keep or revert
7. **Clean up the accidental `document-management`** (lowercase) branch on remote if it still exists

---

*End of audit.*
