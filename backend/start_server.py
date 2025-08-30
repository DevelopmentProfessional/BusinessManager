#!/usr/bin/env python3
"""
Startup script for Business Management API with minimal logging
"""

import os
import sys
import logging

# Completely disable ALL logging before any imports
logging.disable(logging.CRITICAL)

# Set environment variables for quiet logging BEFORE any imports
os.environ["SQLALCHEMY_WARN_20"] = "false"
os.environ["QUIET_MODE"] = "true"
os.environ["SQLALCHEMY_SILENCE_UBER_WARNING"] = "1"
os.environ["SQLALCHEMY_DISABLE_POOLING"] = "1"

# Redirect stdout to suppress any print statements during import
original_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')

try:
    import uvicorn
    from main import app
finally:
    # Restore stdout
    sys.stdout.close()
    sys.stdout = original_stdout

if __name__ == "__main__":
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    print("Starting Business Management API...")
    print(f"Server will be available at:")
    print(f"   Local:   http://localhost:{port}")
    print(f"   Network: http://{host}:{port}")
    print("All database logs suppressed")
    print("-" * 50)
    
    # Start server with minimal logging
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="critical",
        access_log=False
    )
