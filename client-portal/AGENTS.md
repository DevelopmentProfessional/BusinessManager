# Client Portal Agent Instructions

## Scope
These instructions apply to client-portal/.

## Search Scope
- Stay inside client-portal/src/ by default.
- Start with the active file when it is already in client-portal/src/.
- Prefer client-portal/src/pages/ for page workflows.
- Prefer client-portal/src/components/ for shared UI.
- Prefer client-portal/src/services/ for API/state behavior.

## Avoid By Default
- client-portal/public/ unless the task involves static assets, manifest, or icons
- client-portal/index.html unless the task involves entry markup
- client-portal/vite.config.js, client-portal/postcss.config.js, client-portal/tailwind.config.js unless the task is build/config related
- client-portal/dist/

## Escalation
- If a fix or feature appears to require context outside client-portal/src/, ask before expanding scope when that missing context is not explicit from the task.