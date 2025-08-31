import os
import logging

# Completely disable ALL SQLAlchemy logging BEFORE any imports
logging.getLogger("sqlalchemy").disabled = True
logging.getLogger("sqlalchemy.engine").disabled = True
logging.getLogger("sqlalchemy.pool").disabled = True
logging.getLogger("sqlalchemy.dialects").disabled = True
logging.getLogger("sqlalchemy.orm").disabled = True
logging.getLogger("sqlalchemy.engine.base.Engine").disabled = True
logging.getLogger("sqlalchemy.dialects.sqlite").disabled = True
logging.getLogger("sqlalchemy.pool.impl.QueuePool").disabled = True

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from database import create_db_and_tables
from routers import clients, inventory, suppliers, services, employees, schedule, attendance, documents, auth

# Create database tables
create_db_and_tables()

app = FastAPI(
    title="Business Management API",
    description="A comprehensive business management system API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://*.onrender.com"
        ).split(",") if origin.strip()
    ],
    allow_origin_regex=os.getenv("ALLOWED_ORIGIN_REGEX") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        from database import get_session
        from models import User
        
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
    print("Database tables initialized")
    print("All routers loaded successfully")

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(clients.router, prefix="/api/v1", tags=["clients"])
app.include_router(inventory.router, prefix="/api/v1", tags=["inventory"])
app.include_router(suppliers.router, prefix="/api/v1", tags=["suppliers"])
app.include_router(services.router, prefix="/api/v1", tags=["services"])
app.include_router(employees.router, prefix="/api/v1", tags=["employees"])
app.include_router(schedule.router, prefix="/api/v1", tags=["schedule"])
app.include_router(attendance.router, prefix="/api/v1", tags=["attendance"])
app.include_router(documents.router, prefix="/api/v1", tags=["documents"])

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
