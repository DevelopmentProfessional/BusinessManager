"""
CLIENT API — main.py
====================
Independent FastAPI service for the client-facing portal.
Deployed on Render as a separate Web Service from the internal API.

Shares the same PostgreSQL database but exposes ONLY client-specific
endpoints. Internal staff JWT tokens are explicitly rejected.

Security features:
  - slowapi rate limiting on every route (per-IP)
  - CORS restricted to client-portal domain + existing sales page domain
  - JWT with role='client' enforced on all authenticated routes
  - Row-level security in every router (clients see only their own data)
  - No internal admin endpoints exposed

Environment variables (set in Render Dashboard):
  DATABASE_URL            — Shared PostgreSQL connection string
  CLIENT_JWT_SECRET       — DIFFERENT secret from internal API (important!)
  STRIPE_SECRET_KEY       — Stripe live/test secret key
  STRIPE_WEBHOOK_SECRET   — From Stripe Dashboard → Webhooks
  ALLOWED_ORIGINS         — Comma-separated extra origins (optional)
  PORT                    — Injected by Render automatically
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from database import create_client_tables
from routers import auth, catalog, bookings, orders, companies, cart

# ── Logging ─────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("client-api")


# ── Lifespan ────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting client-api — running DB migrations …")
    create_client_tables()
    logger.info("client-api ready.")
    yield


# ── Rate limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BusinessManager Client API",
    description="Client-facing API for the client portal. Internal staff tokens are rejected.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ── CORS ─────────────────────────────────────────────────────────────────────────
# Only allow the client portal domain and the existing sales/marketing page.
# The internal API domain is intentionally NOT in this list.
_base_origins = [
    "https://clients.yourdomain.com",                             # client portal (Render custom domain)
    "https://businessmanager-client-portal.onrender.com",         # client portal (Render default subdomain)
    "https://businessmanager-reference.onrender.com",             # existing sales page
    "http://localhost:5174",                                       # local dev — client portal
    "http://localhost:5175",
]

_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
_all_origins = list(dict.fromkeys(_base_origins + _extra))   # Deduplicate, preserve order

app.add_middleware(
    CORSMiddleware,
    allow_origins=_all_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition"],
)


# ── Health ───────────────────────────────────────────────────────────────────────
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok", "service": "client-api"}


# ── Routers ──────────────────────────────────────────────────────────────────────
PREFIX = "/api/client"

app.include_router(companies.router, prefix=PREFIX)
app.include_router(auth.router,      prefix=PREFIX)
app.include_router(catalog.router,   prefix=PREFIX)
app.include_router(cart.router,      prefix=PREFIX)
app.include_router(bookings.router,  prefix=PREFIX)
app.include_router(orders.router,    prefix=PREFIX)

# Stripe webhook is registered under /api/client/orders/webhooks/stripe
# (already prefixed inside orders.router)


# ── Entry point ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
