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
    from backend.routers import auth, isud, settings, database_connections
except ModuleNotFoundError as e:
    # Fallback if executed with CWD=backend and package not resolved.
    if getattr(e, "name", None) in {"backend.routers", "backend.routers.auth", "backend.routers.isud", "backend.routers.settings", "backend.routers.database_connections"}:
        from routers import auth, isud, settings, database_connections  # type: ignore
    else:
        raise

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
    "http://localhost:5173",
    "https://localhost:5173",
    "https://localhost:5174",
    "http://localhost:5174",
    # Network access
    "https://192.168.4.118:5173",
    "http://192.168.4.118:5173",
    "https://192.168.4.118:5174",
    "http://192.168.4.118:5174"
]

# Add any additional origins from environment variable
allowed_origins = _extend_allowed_origins_from_env(allowed_origins)

print(f"CORS ALLOWED ORIGINS: {allowed_origins}")

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
    # Initialize database tables
    try:
        from backend.database import create_db_and_tables
    except ModuleNotFoundError:
        from database import create_db_and_tables
    create_db_and_tables()
    print("Database tables initialized")
    print("All routers loaded successfully")

# Include routers (documents + document_category CRUD go through isud)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(isud.router, prefix="/api/v1/isud", tags=["isud"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(database_connections.router, prefix="/api/v1", tags=["database-connections"])

# Document file operations only: upload (create record + file) and download (serve file).
# List/get/update/delete document metadata go through isud (/api/v1/isud/documents, /api/v1/isud/document_category).
import shutil
import uuid as _uuid
from uuid import UUID
from typing import Optional
from fastapi import Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

try:
    from backend.database import get_session
    from backend.models import Document, User
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import Document, User
    from routers.auth import get_current_user

_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)


def _resolve_document_path(file_path: str, upload_dir: str) -> str:
    if not file_path:
        return ""
    if os.path.isabs(file_path) and os.path.exists(file_path):
        return file_path
    fallback = os.path.join(upload_dir, os.path.basename(file_path))
    if os.path.exists(fallback):
        return fallback
    return file_path


@app.post("/api/v1/documents/upload", tags=["documents"])
async def document_upload(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    entity_id: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    session=Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Upload a file and create a document record. Metadata CRUD is via isud."""
    file_ext = os.path.splitext(file.filename or "")[1]
    unique_filename = f"{_uuid.uuid4()}{file_ext}"
    path = os.path.join(_UPLOAD_DIR, unique_filename)
    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_size = os.path.getsize(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    parsed_entity_id = UUID(entity_id) if entity_id else None
    parsed_category_id = UUID(category_id) if category_id else None
    doc = Document(
        filename=unique_filename,
        original_filename=file.filename or "unknown",
        file_path=path,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        description=description,
        entity_type=entity_type,
        entity_id=parsed_entity_id,
        category_id=parsed_category_id,
        owner_id=current_user.id,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@app.get("/api/v1/documents/{document_id}/download", tags=["documents"])
async def document_download(
    document_id: UUID,
    download: bool = Query(False, description="Force download"),
    session=Depends(get_session),
):
    """Serve the document file. Document metadata is via isud."""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = _resolve_document_path(doc.file_path, _UPLOAD_DIR)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path,
        filename=doc.original_filename,
        media_type=doc.content_type,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.original_filename}"'},
    )


@app.get("/api/v1/documents/{document_id}/onlyoffice-config", tags=["documents"])
async def document_onlyoffice_config(
    document_id: UUID,
    session=Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Stub for document editor component; real config/connection lives in the editor."""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"documentType": None, "notConfigured": True, "document": {"title": doc.original_filename}}



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
# Reload trigger Sat, Jan 31, 2026 12:37:03 PM
# Reload trigger
