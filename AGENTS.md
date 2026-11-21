# Agent Instructions

## Scope
These instructions apply to the whole repository and should be used as the first routing guide before broad codebase exploration.

Use the closest AGENTS.md file in the directory tree for area-specific guidance.

## Update Coverage
When making updates, evaluate impact across all application surfaces in this repository.

1. Check backend/ for API, database, schema, auth, and business logic changes.
2. Check frontend/src/ for manager UI, shared components, and service-layer changes.
3. Check client-portal/src/ for any portal UI or workflow impact.
4. Check client-api/ for any client-facing API contract or behavior impact.

If a change affects a shared workflow, data contract, or user-visible behavior, update every affected app in the same task rather than leaving the other surfaces stale.

## Default Search Order
For any task, start with the smallest relevant area instead of scanning the whole repo, but keep the full cross-app impact in mind.

1. If the active file already matches the task, start there.
2. For UI, page, modal, dropdown, layout, badge, template, or Vite issues, look in frontend/ first.
3. For API, database, model, router, migration, auth, or seeding issues, look in backend/ first.
4. After identifying the primary area, evaluate whether matching changes are needed in client-portal/.
5. After identifying the primary area, evaluate whether matching changes are needed in client-api/.

## Area Routing
- frontend/: defer to frontend/AGENTS.md
- backend/: defer to backend/AGENTS.md
- client-portal/: defer to client-portal/AGENTS.md
- client-api/: defer to client-api/AGENTS.md

## Avoid By Default
Do not read these areas unless the task explicitly requires them.

- node_modules/
- backend/uploads/
- ssl/
- .git/
- generated build output or cache files

## Investigation Rules
- Do not broad-search the entire repo up front; identify the primary area first, then expand only into the other affected apps.
- Prefer direct file reads after targeted search hits instead of opening large unrelated files.
- Treat deleted, seeded, generated, or legacy helper scripts as out of scope unless the user asks for them.

## Validation
- For frontend changes, prefer npm run build from the repo root.
- For backend-only changes, validate the smallest affected surface first.

## Escalation
If the task is ambiguous about which app area it belongs to, inspect only the active file and one adjacent dependency first, then expand outward.

## Infrastructure & Deployment

### EC2 Instance Setup
The BusinessManager application is deployed on AWS EC2 with the following architecture:

**Services:**
- **staff-api**: FastAPI application on port 8000 (`/api/v1/*` endpoints)
- **client-api**: FastAPI application on port 8001 (`/api/client/*` endpoints)
- Both services managed by systemd with `Restart=always` for continuous operation
- Database: PostgreSQL RDS (separate from EC2)

**Nginx Reverse Proxy:**
- Listens on port 80 for `api.vadpivi.com`
- Routes requests to backend APIs via upstream proxy blocks
- Includes CORS headers, request timeouts, and forwarded IP tracking
- Does NOT serve static files (frontend deployed separately via CDN)

**Important:** The `setup_server.sh` script contains the authoritative server configuration. Any changes to systemd services or Nginx must be made there AND applied to the running instance.

### Critical Infrastructure Decisions
1. **Frontend & Backend Separation**: React frontend deployed at `https://app.vadpivi.com` via CloudFront CDN. EC2 only proxies API requests at `https://api.vadpivi.com`.
2. **Continuous Operation**: Services run continuously with auto-restart, not on a schedule. The `businessmanager-app-start.timer` is disabled (kept in config as reference but must remain disabled).
3. **No Static File Serving**: Nginx does NOT serve any static HTML/CSS/JS files. It only proxies `/api/v1/*` and `/api/client/*` to the backend services.

**Recent Fix (May 20, 2026):** 
Instance was previously scheduled to stop/start daily at 10:10 AM via systemd timer, and Nginx was misconfigured to serve static files. Both issues have been resolved in `setup_server.sh`. See `/memories/repo/infrastructure-schedule-nginx-fix.md` for details.
