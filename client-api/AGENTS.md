# Client API Agent Instructions

## Scope
These instructions apply to client-api/.

## Search Order
1. Start with client-api/routers/ for endpoint changes.
2. Check client-api/models.py for shared data shapes.
3. Check client-api/database.py and client-api/migrations/ for schema/setup work.
4. Check client-api/main.py when routing, startup, or app wiring is involved.

## Cross-App Impact
- If a client-facing API contract changes here, evaluate whether client-portal/ also needs updates.

## Validation
- Validate the smallest affected surface first.