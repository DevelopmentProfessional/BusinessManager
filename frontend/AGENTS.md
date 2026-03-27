# Frontend Agent Instructions

## Scope
These instructions apply to frontend/.

## Search Scope
- Stay inside frontend/src/ by default.
- Start with the active file when it is already in frontend/src/.
- Prefer frontend/src/pages/components/ before scanning many page files.
- Prefer frontend/src/services/ before scanning many UI files when behavior may come from API/state wiring.

## Avoid By Default
- frontend/public/ unless the task involves static assets, manifest, or icons
- frontend/index.html unless the task involves entry markup
- frontend/vite.config.js, frontend/postcss.config.js, frontend/tailwind.config.js unless the task is build/config related
- frontend/dist/ and frontend/dev-dist/

## Escalation
- If a fix or feature appears to require context outside frontend/src/, ask before expanding scope when that missing context is not explicit from the task.

## Validation
- Prefer npm run build from the repo root for frontend changes.