import os
import sys
import logging

# Ensure the project root is on sys.path so 'backend' package is importable
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_this_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Completely disable ALL SQLAlchemy logging BEFORE any imports
_SQLALCHEMY_LOGGERS_TO_DISABLE = (
    "sqlalchemy",
    "sqlalchemy.engine",
    "sqlalchemy.pool",
    "sqlalchemy.dialects",
    "sqlalchemy.orm",
    "sqlalchemy.engine.base.Engine",
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.pool.impl.QueuePool",
)
for _logger_name in _SQLALCHEMY_LOGGERS_TO_DISABLE:
    logging.getLogger(_logger_name).disabled = True

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import uvicorn

try:
    from backend.routers import auth, isud
except Exception:
    # Fallback if executed with CWD=backend and package not resolved
    from routers import auth, isud  # type: ignore

# Suppress noisy health check access logs while keeping other access logs
class _SuppressHealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
            # Filter typical uvicorn access log patterns for /health
            return "/health" not in msg
        except Exception:
            return True

logging.getLogger("uvicorn.access").addFilter(_SuppressHealthFilter())


class AggressiveCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Handle preflight requests FIRST
        if request.method == "OPTIONS":
            # Echo origin and requested headers/methods to satisfy strict CORS policies
            origin = request.headers.get("Origin", "*")
            request_headers = request.headers.get("Access-Control-Request-Headers", "*")
            request_method = request.headers.get("Access-Control-Request-Method", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
            # If origin header is present, prefer echoing it over '*'
            allow_origin = origin if origin else "*"

            response = Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": allow_origin,
                    "Access-Control-Allow-Methods": request_method or "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": request_headers or "*",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin"
                }
            )
            return response
        
        # Process the request and ALWAYS set CORS headers, even on exceptions
        origin = request.headers.get("Origin", "*")
        req_headers = request.headers.get("Access-Control-Request-Headers")
        try:
            response = await call_next(request)
        except Exception as exc:
            # Build a minimal 500 response while preserving CORS so browsers show the real error
            response = Response("Internal Server Error", status_code=500)
        
        response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = req_headers or "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Expose-Headers"] = "*"
        response.headers["Vary"] = "Origin"
        return response


def _extend_allowed_origins_from_env(allowed_origins: list[str]) -> list[str]:
    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    if not env_origins:
        return allowed_origins

    additional_origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
    allowed_origins.extend(additional_origins)
    return allowed_origins


app = FastAPI(
    title="Business Management API",
    description="A comprehensive business management system API",
    version="1.0.0"
)

# Configure CORS with explicit production domains
allowed_origins = [
    # Local development
    "http://localhost:5173"
]

# Add any additional origins from environment variable
allowed_origins = _extend_allowed_origins_from_env(allowed_origins)

print(f"🔧 CORS ALLOWED ORIGINS: {allowed_origins}")

# Add aggressive CORS middleware first
app.add_middleware(AggressiveCORSMiddleware)

# Add standard CORS middleware as backup
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use explicit origins to avoid '*' with credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        from backend.database import get_session
        from backend.models import User
        
        # Test database connection
        session = next(get_session())
        user_count = session.query(User).count()
        session.close()
        
        return {
            "status": "healthy", 
            "message": "Business Management API is running",
            "database": "connected",
            "users_count": user_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": "Database connection failed",
            "error": str(e)
        }

@app.on_event("startup")
async def startup_event():
    print("Business Management API is starting...")
    print("All routers loaded successfully")

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(isud.router, prefix="/api/v1/isud", tags=["isud"])



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
