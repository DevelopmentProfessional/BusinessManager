# BusinessManager Regression Test Suite

Prevents broken code from reaching Render production. Runs locally against the **live Render database** — no local SQLite, no mocking. All test data is created and fully torn down within each run.

---

## How It Works

### The Big Picture

```
You write code → run Stage 1 → push to Render → run Stages 2–4 → check report
```

### The 4 Stages

| Stage | What it tests | When to run |
|-------|--------------|-------------|
| **Stage 1** | API is reachable, `/health` is healthy, all expected routes exist in OpenAPI spec | Before every `git push` |
| **Stage 2** | Every backend endpoint (CRUD for all tables, auth flows, reports, payroll, chat, etc.) with all 4 roles | After deploying to Render |
| **Stage 3** | Browser UI (login flow, page loads, buttons visible/hidden by role) | After deploying frontend |
| **Stage 4** | Database integrity (cascade deletes, duplicate prevention, FK constraints) | After schema changes |

### How Data Stays Clean

Every record created during a test run is registered in a `CleanupRegistry`. After the session ends — even if tests crash midway — all records are deleted in reverse-creation order (to respect foreign key dependencies). If cleanup ever fails, leftovers are identifiable by their `[REGTEST]` prefix in name fields, and the full list is logged to `cleanup.log`.

### How Roles Are Tested

Stage 2 creates 4 dedicated **test accounts** at session start — one per role (admin, manager, employee, viewer) — and assigns each role's permission set via the API. Every test runs as the appropriate role's test account, not as the real admin.

| Role | Permissions assigned |
|------|----------------------|
| **test admin** | All (automatic for admin role) |
| **test manager** | read/write/delete on clients, inventory, services, schedule, attendance, documents; read on reports |
| **test employee** | read on clients, inventory, services, schedule, documents; read+write on attendance |
| **test viewer** | read-only on all pages |

The real admin account (from `.env`) is used **only** to create these test users and register cleanup URLs. All CRUD tests and permission checks run as the role-specific test accounts. All 4 test accounts are deleted in session teardown.

**Why this matters:** Tests prove that each role's permissions work correctly end-to-end through the actual permission system, not through the admin bypass.

---

## Setup (One Time)

### 1. Install Python dependencies

```bash
cd regressiontest
pip install -r requirements.txt
```

Windows PowerShell (recommended):

```powershell
cd regressiontest
.\setup-regression.ps1
```

This creates an isolated venv at `regressiontest/.venv-regression`, installs dependencies, installs Playwright Chromium, and creates `.env` from `.env.template` if missing.

### 2. Install Playwright browser (for Stage 3 E2E only)

```bash
playwright install chromium
```

### 3. Create your `.env` file

```bash
cp .env.template .env
```

Open `.env` and fill in:

```
API_BASE_URL=https://businessmanager-reference-api.onrender.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_actual_admin_password
FRONTEND_URL=http://localhost:5173
PLAYWRIGHT_HEADLESS=true
```

> `.env` is gitignored. Never commit it.

---

## Running Tests

### GUI (recommended)

```bash
cd regressiontest
python runner_gui.py
```

Opens a browser at `http://localhost:7771` automatically. From there:

- Check/uncheck which stages to run
- Click **▶ Run Selected** — output streams live in the terminal panel
- Each test line is colour-coded (green PASSED, red FAILED, yellow SKIPPED)
- Stage cards in the sidebar show live pass/fail counts as tests run
- After the run, **View Full Report** opens the detailed HTML report

```bash
python runner_gui.py --port 8080    # use a different port
python runner_gui.py --no-browser   # don't auto-open browser
```

---

### Command line — Full suite (all 4 stages, generates HTML report)

```bash
cd regressiontest
python orchestrator.py
```

**Behavior:** ALL stages and ALL tests run to completion, regardless of failures. This provides a complete pass/fail ratio showing exactly which functions work and which don't.

Report is written to `reports/regression_report.html` — open it in a browser.

JSON reports for each stage are in `reports/stage1.json`, `reports/stage2.json`, etc.

---

### Run individual stages

```bash
# Stage 1 — pre-push gate (fast, ~30 seconds)
pytest stage1_precheck/ -m stage1 -v

# Stage 2 — full API coverage
pytest stage2_api/ -m stage2 -v

# Stage 3 — browser E2E (start frontend dev server first)
npm run dev   # in the frontend/ directory, separate terminal
pytest stage3_e2e/ -m stage3 -v

# Stage 4 — database integrity
pytest stage4_database/ -m stage4 -v
```

---

### Run a single domain or file

```bash
# Just clients
pytest stage2_api/test_clients.py -v

# Just permission tests
pytest stage2_api/test_permissions/ -v

# Just the viewer permission tests
pytest stage2_api/test_permissions/test_viewer.py -v

# Just chat
pytest stage2_api/test_chat.py -v

# Stop on first failure
pytest stage2_api/ -m stage2 -v -x
```

---

### Orchestrator options

```bash
# Run only specific stages
python orchestrator.py --stages 1 2

# Skip HTML report generation (JSON reports still created)
python orchestrator.py --no-report
```

### View failures from last run

```powershell
# PowerShell
.\show-failures.ps1
```

This reads the JSON reports and displays all failures with full error messages and a summary count.

---

## File Structure

```
regressiontest/
│
├── orchestrator.py         ← Central runner. Run this for the full suite.
├── config.py               ← Reads .env, exposes BASE_URL, ADMIN_* constants
├── conftest.py             ← Session fixtures: admin_token, cleanup registry
├── pytest.ini              ← Marker definitions (stage1/2/3/4), log settings
├── requirements.txt        ← Python deps
├── .env.template           ← Copy to .env and fill in secrets
├── .gitignore              ← Excludes .env, reports/, __pycache__/
│
├── helpers/
│   ├── api_client.py       ← AuthedClient(token) — wraps httpx, injects Bearer header
│   ├── cleanup.py          ← CleanupRegistry — register URLs, delete in teardown
│   ├── test_data.py        ← Factory functions: make_client(), make_user(), etc.
│   ├── assertions.py       ← assert_ok(), assert_permission_denied(), assert_schema()
│   └── report.py           ← Generates HTML from pytest JSON report files
│
├── stage1_precheck/
│   ├── test_connectivity.py  ← /health, /docs, /openapi.json reachable
│   └── test_openapi.py       ← All expected route paths exist in OpenAPI spec
│
├── stage2_api/
│   ├── conftest.py           ← Creates manager/employee/viewer test users
│   ├── test_auth.py          ← Login, logout, token validation, lock/unlock, password reset
│   ├── test_users.py         ← User CRUD, profile, roles, permissions
│   ├── test_clients.py       ← Client CRUD
│   ├── test_inventory.py     ← Inventory CRUD + image upload
│   ├── test_services.py      ← Service CRUD
│   ├── test_schedule.py      ← Schedule/appointment CRUD
│   ├── test_attendance.py    ← Clock in / clock out lifecycle
│   ├── test_documents.py     ← Upload, serve, download, content edit, sign, assign
│   ├── test_templates.py     ← Template CRUD + render
│   ├── test_tasks.py         ← Task CRUD + link/unlink
│   ├── test_chat.py          ← Send messages, history, mark read, unread counts
│   ├── test_reports.py       ← All 9 report endpoints
│   ├── test_payroll.py       ← Process payroll, duplicate check, pay slips
│   ├── test_leave_requests.py ← Submit + approve/reject leave
│   ├── test_settings.py      ← Get/put schedule settings and company info
│   └── test_permissions/
│       ├── test_admin.py     ← Admin can do everything
│       ├── test_manager.py   ← Manager: broad access, limited admin ops
│       ├── test_employee.py  ← Employee: own data only, no admin ops
│       └── test_viewer.py    ← Viewer: reads OK, writes return 403
│
├── stage3_e2e/
│   ├── conftest.py           ← Playwright browser/page fixtures, login helpers
│   ├── test_login_flow.py    ← Login → redirect → logout → redirect back
│   ├── test_clients_ui.py    ← Add client form, verify row, delete
│   ├── test_employees_ui.py  ← Employee list, profile modal
│   ├── test_schedule_ui.py   ← Calendar renders, appointment modal
│   ├── test_documents_ui.py  ← Upload file, viewer opens
│   └── test_permissions_ui.py ← Admin sees write buttons; Viewer does not
│
├── stage4_database/
│   ├── test_cascade_delete.py ← Delete parent → child records gone, no 500s
│   └── test_constraints.py    ← Duplicate username/SKU/payslip blocked, 404 on ghost updates
│
└── reports/                  ← Generated after each run (gitignored)
    ├── stage1.json
    ├── stage2.json
    ├── stage3.json
    ├── stage4.json
    └── regression_report.html
```

---

## How to Add a New Test

### New endpoint or feature

1. Find the matching test file in `stage2_api/` (e.g., a new payroll endpoint → `test_payroll.py`).
2. Add a test class or method. Use `admin_token` and `cleanup` fixtures.
3. Register any created records with `cleanup.register(url, token, label)`.
4. If it's a new table, add a factory function to `helpers/test_data.py`.

```python
def test_new_feature(self, admin_token, cleanup):
    client = AuthedClient(token=admin_token)
    resp = client.post("/api/v1/isud/my_new_table", json=make_my_thing())
    body = assert_created(resp, "POST /isud/my_new_table")
    rec_id = body.get("id")
    cleanup.register(f"/api/v1/isud/my_new_table/{rec_id}", token=admin_token, label="my thing")
    assert body.get("some_field") == "expected_value"
```

### New route in OpenAPI spec

Add the path string to `REQUIRED_PATHS` in `stage1_precheck/test_openapi.py`. This ensures a future rename or accidental deletion gets caught before it reaches Render.

### New permission rule

Add the operation to the appropriate file in `stage2_api/test_permissions/`:
- `test_viewer.py` — if viewers should be blocked from it
- `test_employee.py` — if employees should be blocked
- `test_admin.py` — if it's an admin-only capability to verify

### New E2E page

Add a file to `stage3_e2e/`. Use `login_as_admin(page)` from `conftest.py`. Keep selectors broad (`:has-text("Add")` rather than specific class names) since UI styling changes frequently.

---

## How to Update an Existing Test

### Endpoint path changed

Update the URL string in the test file and in `stage1_precheck/test_openapi.py` → `REQUIRED_PATHS`.

### Response schema changed (new required field)

Update the field list in any `assert_schema(body, [...], ...)` call in the relevant test file.

### New table added

1. Add a factory function to `helpers/test_data.py`.
2. Add a new test file `stage2_api/test_<table>.py` following the pattern of `test_clients.py`.
3. Add the ISUD path to `REQUIRED_PATHS` in `test_openapi.py`.

### Permission rules changed

Update the assertions in `stage2_api/test_permissions/`. The viewer, employee, manager, and admin test files map directly to the permission matrix in `auth.py`.

---

## Troubleshooting

### Admin account is locked
The admin account locks after 5 failed login attempts (30-minute cooldown). Run the unlock tool:

```bash
cd regressiontest
python tools/unlock_admin.py
```

This waits for the lock to auto-expire, then confirms the account is healthy. The root-cause bug (`test_login_wrong_password` using the real admin username) has been fixed — future runs will no longer accumulate failed attempts on the real admin.

### "Configuration error: ADMIN_PASSWORD is not set"
Copy `.env.template` to `.env` and fill in your admin password.

### PowerShell says `/c:/.../python.exe` is not recognized
Use Windows path format or activate a venv first; do not run commands with a leading `/c:/` prefix.

```powershell
cd regressiontest
.\setup-regression.ps1
& .\.venv-regression\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### Stage 1 fails — "Cannot reach API"
Render might be sleeping (free tier spins down after inactivity). Wait 30 seconds and try again, or visit the Render URL in a browser to wake it up.

### Stage 1 fails — "Missing from OpenAPI spec: /api/v1/some/path"
A route was deleted or renamed. Check recent commits to `main.py` or the relevant router file. Either restore the route or update `REQUIRED_PATHS` in `test_openapi.py` to match the new path.

### Stage 2 — Permission test fails unexpectedly (e.g., employee gets 200 when expecting 403)
The permission config in `auth.py` may have changed. Check `get_user_permissions_list()` or the role permission tables. Update the test expectation to match the new intended behavior.

### Cleanup fails / `[REGTEST]` records left in DB
Check `cleanup.log` in the `regressiontest/` directory. It lists every attempted delete and any errors. You can manually delete leftovers using the admin UI or by re-running the suite (it will try again).

### Stage 3 E2E — "browser not found"
Run `playwright install chromium`.

### Stage 3 E2E — tests fail immediately
Make sure the frontend dev server is running: `cd frontend && npm run dev`. The `FRONTEND_URL` in `.env` must match (default: `http://localhost:5173`).

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `pytest` | Test runner |
| `httpx` | HTTP client for API tests |
| `playwright` | Browser automation for E2E |
| `pytest-asyncio` | Async test support |
| `pytest-json-report` | JSON output consumed by orchestrator |
| `python-dotenv` | Loads `.env` file |
| `jinja2` | HTML report rendering |
