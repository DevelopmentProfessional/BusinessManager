# Backend Agent Instructions

## Scope
These instructions apply to backend/.

## Search Order
1. Start with backend/routers/ for endpoint and behavior changes.
2. Check backend/models.py for schema and shared data shape changes.
3. Check backend/database.py for schema setup and migrations.
4. Check backend/migrations/ only when a schema change clearly requires it.

## Avoid By Default
- backend/uploads/
- backend/scripts/ unless the task explicitly involves standalone scripts
- deleted, seeded, generated, or legacy helper scripts unless the user asks for them

## Cross-App Impact
- If an API contract, shared workflow, auth rule, or data shape changes here, evaluate whether frontend/, client-portal/, and client-api/ also need updates.

## Validation
- For backend-only changes, validate the smallest affected surface first.