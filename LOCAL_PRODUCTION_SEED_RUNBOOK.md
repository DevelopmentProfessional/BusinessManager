# Local → Render Production Seed Runbook (No Render Shell)

This runbook lets you seed the Render production database from your local machine using Python.
No paid Render Shell required.

---

## What this does

- Connects your local `backend/seed_data.py` directly to the Render Postgres DB.
- Reseeds **last 4 months** of demo transactional data (`--force`):
  - schedules/appointments
  - client purchase history (products + services)
  - payslips/wages

---

## Prerequisites

- Repo is up to date locally.
- Python environment has backend dependencies installed.
- You have the Render production database connection string.

---

## 1) Get production DB URL from Render

1. Render Dashboard → your backend service (`BusinessManager_Reference_API`)
2. Environment / linked database section
3. Copy the production `DATABASE_URL` connection string

It usually looks like:

`postgres://user:password@host:5432/dbname`

The app will convert this to the correct SQLAlchemy driver automatically.

---

## 2) Run seed from local (PowerShell)

From project root:

```powershell
# Optional: activate venv if you use one
& .\backend\.venv\Scripts\Activate.ps1

# Set production DB URL only for this shell session
$env:DATABASE_URL = "<PASTE_RENDER_DATABASE_URL_HERE>"

# Force refresh 4-month seed window
python backend/seed_data.py --force
```

Expected success lines include:

- `force mode enabled: refreshing last 4 months...`
- `✓ Cleared recent schedules, sales, and payslips...`
- `✓ ~... appointments`
- `✓ ... sales transactions`
- `✓ ... payslips`
- `seed_demo_data: complete ✓`

---

## 3) Verify in app

After script completes:

1. Open production app
2. Go to Profile → Settings → Application
3. Click `Sync Now`
4. Refresh once
5. Check:
   - Schedule calendar populated (past 4 months)
   - Client purchase history has product + service lines
   - Payroll/wages populated in profile/payroll views
   - Reports show monthly data

---

## 4) Clear the env var locally (recommended)

When done, remove production DB URL from your shell session:

```powershell
Remove-Item Env:DATABASE_URL
```

---

## Troubleshooting

### A) Seed says "already seeded, skipping"
Run with force:

```powershell
python backend/seed_data.py --force
```

### B) DB connection/auth fails
- Re-copy `DATABASE_URL` from Render
- Ensure no extra spaces/quotes inside the URL
- Confirm you are using the production DB URL, not a stale one

### C) Seed succeeded but UI looks stale
- Click `Sync Now` in Profile settings
- Hard refresh browser (`Ctrl+F5`)

### D) Need repeat runs
You can safely rerun:

```powershell
python backend/seed_data.py --force
```

It only refreshes the recent transactional seed window and preserves core reference entities.

---

## Notes

- This is the recommended low-cost workflow when avoiding Render Shell.
- If you later want one-click in-app seeding, we can re-enable the admin seed endpoint with tighter guardrails and remove it again after use.
