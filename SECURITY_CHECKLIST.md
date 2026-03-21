# Security Checklist — Client API & Client Portal

## Pre-Deployment

- [ ] `CLIENT_JWT_SECRET` is a unique, random 64+ character string
- [ ] `CLIENT_JWT_SECRET` is DIFFERENT from internal API's `JWT_SECRET`
- [ ] `STRIPE_SECRET_KEY` is set and correct (live vs test matches client portal env)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the Stripe Dashboard signing secret
- [ ] Migration ran successfully (auth columns added to `client` table)
- [ ] CORS `ALLOWED_ORIGINS` lists ONLY client-portal domain (no wildcards)
- [ ] `DATABASE_URL` uses the pooled connection string (not the direct URL) in production

## Authentication & Authorization

- [ ] Every non-public endpoint has `Depends(auth_utils.get_current_client)`
- [ ] `auth.py → decode_token()` rejects any token where `role != "client"`
      (internal staff with admin/manager/employee tokens cannot access client endpoints)
- [ ] Row-level security verified: every SELECT query includes `WHERE client_id = current_client.id`
- [ ] Registration endpoint: 409 returned for duplicate email (no user enumeration)
- [ ] Login endpoint: identical 401 for wrong email AND wrong password (timing-safe)
- [ ] bcrypt is used for password hashing (never plaintext, never md5/sha1)

## Rate Limiting

| Endpoint | Limit | Configured |
|----------|-------|-----------|
| POST /auth/register | 5/minute | [ ] |
| POST /auth/login | 10/minute | [ ] |
| GET /auth/me | 60/minute | [ ] |
| GET /catalog/* | 60/minute | [ ] |
| POST /bookings | 20/minute | [ ] |
| PATCH /bookings/*/cancel | 10/minute | [ ] |
| POST /orders/checkout | 10/minute | [ ] |
| Global default | 200/minute | [ ] |

## CORS

- [ ] No wildcard (`*`) in `allow_origins`
- [ ] Internal API domain is NOT in client-api's CORS list
- [ ] `allow_credentials=True` only when needed (JWT via Authorization header is fine without cookies)

## Stripe Security

- [ ] Webhook endpoint validates `stripe-signature` header before processing
- [ ] `stripe.Webhook.construct_event` called — rejects unsigned/tampered events
- [ ] Raw payment card data never passes through this server (Stripe.js handles it)
- [ ] PaymentIntent metadata includes `company_id` for audit trail

## Database

- [ ] `client_booking.schedule_id` → internal Schedule created atomically in same transaction
- [ ] `pg_advisory_xact_lock` prevents double-booking race conditions
- [ ] All `session.commit()` calls wrapped in `try/except` with `session.rollback()`
- [ ] No raw SQL except for advisory lock (parameterised queries via SQLModel ORM)

## Deployment

- [ ] `CLIENT_JWT_SECRET` and `STRIPE_SECRET_KEY` are set via Render env vars (NOT in code)
- [ ] `.env` files are gitignored and not committed
- [ ] `docs_url` and `redoc_url` are set (can be set to `None` to hide in production)
- [ ] Health endpoint `/health` returns no sensitive info

## Post-Deployment Verification

1. **Registration flow**
   ```bash
   curl -X POST https://businessmanager-client-api.onrender.com/api/client/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com","password":"Test123!","company_id":"your-company"}'
   # Expected: 201 with access_token
   ```

2. **Token isolation check** — Try using an INTERNAL staff token on a client endpoint:
   ```bash
   curl https://businessmanager-client-api.onrender.com/api/client/auth/me \
     -H "Authorization: Bearer <internal_staff_jwt>"
   # Expected: 403 Forbidden — "This endpoint is restricted to client accounts only."
   ```

3. **Row-level security check** — Try accessing another client's booking:
   ```bash
   curl https://businessmanager-client-api.onrender.com/api/client/bookings/<other-client-booking-id> \
     -H "Authorization: Bearer <your_client_jwt>"
   # Expected: 404 Not Found (not 403 — don't confirm existence)
   ```

4. **Rate limit check**:
   ```bash
   for i in {1..12}; do
     curl -X POST https://businessmanager-client-api.onrender.com/api/client/auth/login \
       -d '{"email":"x","password":"x","company_id":"x"}'; done
   # Expected: 429 Too Many Requests after 10 attempts
   ```

5. **CORS check** — Request from disallowed origin:
   ```bash
   curl -H "Origin: https://evil.com" https://businessmanager-client-api.onrender.com/api/client/catalog/products?company_id=x
   # Expected: No Access-Control-Allow-Origin header in response
   ```

6. **Stripe webhook signature** — Send a tampered webhook:
   ```bash
   curl -X POST https://businessmanager-client-api.onrender.com/api/client/orders/webhooks/stripe \
     -H "stripe-signature: invalid" -d '{}'
   # Expected: 400 Bad Request — "Invalid webhook signature."
   ```

7. **Double-booking prevention** — Attempt two simultaneous bookings for the same slot:
   - Use two separate client accounts
   - POST /bookings with identical service_id + appointment_date at the same second
   - Expected: one succeeds (201), one returns 409 Conflict
