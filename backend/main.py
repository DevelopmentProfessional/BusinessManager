from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
# Load .env if available (optional dependency)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass
from database import create_db_and_tables
from routers import clients, products, inventory, suppliers, services, employees, schedule, assets, attendance, documents

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    create_db_and_tables()
    yield

app = FastAPI(
    title="Business Management API",
    description="A comprehensive business management system API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,https://*.onrender.com"
        ).split(",") if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Business Management API is running"}

# Include routers
app.include_router(clients.router, prefix="/api/v1", tags=["clients"])
app.include_router(products.router, prefix="/api/v1", tags=["products"])
app.include_router(inventory.router, prefix="/api/v1", tags=["inventory"])
app.include_router(suppliers.router, prefix="/api/v1", tags=["suppliers"])
app.include_router(services.router, prefix="/api/v1", tags=["services"])
app.include_router(employees.router, prefix="/api/v1", tags=["employees"])
app.include_router(schedule.router, prefix="/api/v1", tags=["schedule"])
app.include_router(assets.router, prefix="/api/v1", tags=["assets"])
app.include_router(attendance.router, prefix="/api/v1", tags=["attendance"])
app.include_router(documents.router, prefix="/api/v1", tags=["documents"])

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
