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

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlmodel import Session, select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from database import engine, create_client_tables
from models import Company
from routers import auth, catalog, bookings, orders, companies, cart

# ── Logging ─────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("client-api")


# ── Rate limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BusinessManager Client API",
    description="Client-facing API for the client portal. Internal staff tokens are rejected.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.on_event("startup")
def on_startup():
    """Ensure DB schema is up-to-date before serving requests."""
    try:
        create_client_tables()
        logger.info("DB schema migration complete.")
    except Exception:
        logger.exception("DB schema migration failed — API may be degraded.")
        raise


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


def _database_health_snapshot():
    with Session(engine) as session:
        session.exec(text("SELECT 1")).one()
        company_count = len(session.exec(select(Company.id).limit(10_000)).all())
        return {
            "database": "ok",
            "company_count": company_count,
        }


# ── Health ───────────────────────────────────────────────────────────────────────
@app.get("/health", include_in_schema=False)
def health():
    try:
        db = _database_health_snapshot()
        return {"status": "ok", "service": "client-api", **db}
    except Exception as exc:
        logger.exception("Client API health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "client-api",
                "database": "error",
                "detail": str(exc),
            },
        )


@app.get("/health/db", include_in_schema=False)
def health_db():
    try:
        return {"status": "ok", "service": "client-api", **_database_health_snapshot()}
    except Exception as exc:
        logger.exception("Client API database health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "client-api",
                "database": "error",
                "detail": str(exc),
            },
        )


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
