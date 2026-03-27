# Agent Instructions

## Scope
These instructions apply to the whole repository and should be used as the first routing guide before broad codebase exploration.

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

## Prefer These Areas
- frontend/src/pages/components/ for shared UI behavior
- frontend/src/pages/ for page-level behavior
- frontend/src/services/ for frontend API access and shared state
- client-portal/src/pages/ for portal page-level behavior
- client-portal/src/components/ for portal shared UI
- client-portal/src/services/ for portal API access and shared state
- backend/routers/ for API behavior
- backend/models.py for schema and shared data shapes
- backend/database.py for schema setup and migrations

## Avoid By Default
Do not read these areas unless the task explicitly requires them.

- node_modules/
- frontend/public/ unless the task involves static assets, manifest, or icons
- frontend/index.html, frontend/vite.config.js, frontend/postcss.config.js, frontend/tailwind.config.js unless the task is build/config related
- client-portal/public/ unless the task involves static assets, manifest, or icons
- client-portal/index.html, client-portal/vite.config.js, client-portal/postcss.config.js, client-portal/tailwind.config.js unless the task is build/config related
- frontend/dist/ and frontend/dev-dist/
- client-portal/dist/ if present
- backend/uploads/
- ssl/
- .git/
- generated build output or cache files

## Investigation Rules
- Do not broad-search the entire repo up front; identify the primary area first, then expand only into the other affected apps.
- For frontend/ and client-portal/, stay inside src/ by default.
- Prefer shared components and API modules before scanning many page files.
- Prefer direct file reads after targeted search hits instead of opening large unrelated files.
- Treat deleted, seeded, generated, or legacy helper scripts as out of scope unless the user asks for them.
- If the addition or fix appears to require reading outside frontend/src/ or client-portal/src/, ask before expanding scope when the missing context is not explicit from the task.

## Validation
- For frontend changes, prefer npm run build from the repo root.
- For backend-only changes, validate the smallest affected surface first.

## Escalation
If the task is ambiguous about which app area it belongs to, inspect only the active file and one adjacent dependency first, then expand outward.

If work in frontend/ or client-portal/ appears blocked by missing config, asset, build, or entry-point context outside src/, ask for permission to read further rather than expanding scope automatically.
