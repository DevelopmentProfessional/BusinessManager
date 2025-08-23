from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
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
    return {"status": "healthy", "message": "Business Management API is running"}

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
