# Render Deployment Guide — Client API & Client Portal

## Overview

Two new independent Render services:
| Service | Type | Root Dir | Render Name |
|---------|------|----------|-------------|
| client-api | Web Service (Python) | `client-api/` | `businessmanager-client-api` |
| client-portal | Static Site | `client-portal/` | `businessmanager-client-portal` |

Both use the **same existing PostgreSQL** — no new database needed.

---

## Step 0 — Run the migration ONCE (before deploying)

From your local machine (with the shared Postgres DATABASE_URL available):

```bash
cd client-api
pip install -r requirements.txt
DATABASE_URL="postgresql://user:pass@host/db" python migrations/client_portal_migration.py
```

This adds auth columns to `client`, adds `cancellation_percentage` / `refund_percentage`
to `app_settings`, and creates `client_booking`, `client_order`, `client_order_item` tables.

---

## Step 1 — Deploy client-api (Web Service)

### 1.1 Create the service
1. Go to [render.com/dashboard](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (`BusinessManager`)
3. Fill in:
   - **Name**: `businessmanager-client-api`
   - **Root Directory**: `client-api`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 1.2 Environment variables (set in Render Dashboard → Environment)
```
DATABASE_URL          = <copy Internal Database URL from your existing Postgres service>
CLIENT_JWT_SECRET     = <generate a NEW random 64-char secret — DIFFERENT from internal API>
STRIPE_SECRET_KEY     = sk_live_...   (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET = whsec_...     (from Stripe Dashboard → Webhooks)
ALLOWED_ORIGINS       = https://clients.yourdomain.com
```

> ⚠️ CLIENT_JWT_SECRET MUST be different from the internal API's JWT_SECRET.
> This ensures internal staff tokens cannot be replayed against client endpoints.

### 1.3 Postgres Connection Pooling
The client-api uses `pool_size=3, max_overflow=5` (total max 8 connections).
Your existing internal API uses its own pool. If you have Render's free Postgres
(max 25 connections), this is well within limits.

For production, add PgBouncer or use Render's connection pooling feature:
- Go to your Postgres service → **Connection Pooling** → Enable
- Use the **pooled connection string** as DATABASE_URL in both services

### 1.4 Custom Domain (optional)
- Render Dashboard → client-api → Settings → Custom Domains
- Add: `api.clients.yourdomain.com`
- Update ALLOWED_ORIGINS in client-api and VITE_CLIENT_API_URL in client-portal

---

## Step 2 — Deploy client-portal (Static Site)

### 2.1 Create the service
1. Render Dashboard → **New → Static Site**
2. Connect same GitHub repo
3. Fill in:
   - **Name**: `businessmanager-client-portal`
   - **Root Directory**: `client-portal`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### 2.2 Environment variables
```
VITE_CLIENT_API_URL        = https://businessmanager-client-api.onrender.com
VITE_STRIPE_PUBLISHABLE_KEY = pk_live_...   (or pk_test_... for testing)
```

Note: Vite bakes env vars at build time (they must start with `VITE_`).

### 2.3 SPA Routing rewrite rule
Render Static Sites need a rewrite rule for React Router:
- Render Dashboard → client-portal → Redirects/Rewrites
- Add: `/* → /index.html` (Status: 200)

### 2.4 Custom Domain
- Add `clients.yourdomain.com` as a custom domain
- Update the client-api's ALLOWED_ORIGINS to include this domain
- Redeploy client-api after updating the env var

---

## Step 3 — Stripe Webhook Setup

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://businessmanager-client-api.onrender.com/api/client/orders/webhooks/stripe`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.canceled`
4. Copy the **Signing Secret** → paste as `STRIPE_WEBHOOK_SECRET` in client-api env vars

---

## Step 4 — Set cancellation/refund percentages

In the internal app → Profile → Settings → Scheduling Settings:
- Add `cancellation_percentage` field (e.g. 10 = 10%)
- Add `refund_percentage` field (e.g. 80 = 80% refund)

Or directly via the internal API:
```
PATCH /api/v1/settings
{ "cancellation_percentage": 10, "refund_percentage": 80 }
```

---

## Architecture Diagram

```
Browser (client)
     │
     ├── GET/POST client-portal.onrender.com  →  client-portal (Static Site)
     │            (React/Vite SPA)
     │
     └── GET/POST client-api.onrender.com     →  client-api (Web Service)
                  /api/client/*                     │
                                               Shared PostgreSQL
                                               (same DB as internal API)
                                                    │
                                          Internal API (unchanged)
                                          businessmanager-reference-api.onrender.com
```

---

## Build Commands Summary

| Service | Build | Start |
|---------|-------|-------|
| Internal API | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| client-api | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| client-portal | `npm install && npm run build` | (static — no start command) |
