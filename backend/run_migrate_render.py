"""
Apply current schema to a database (e.g. Render Postgres) from your machine.

Usage:
  1. In Render: Dashboard → your database (dd_reference_temp) → Connect → "External Database URL"
  2. Copy the URL. It looks like: postgresql://user:pass@host/dbname
  3. From project root, run (PowerShell):
       $env:DATABASE_URL = "postgresql://user:pass@host/dbname"
       python -m backend.run_migrate_render
  4. Or one line (replace with your actual URL):
       $env:DATABASE_URL = "YOUR_RENDER_EXTERNAL_DATABASE_URL"; python -m backend.run_migrate_render

You do NOT need pgAdmin. This script uses the same create_db_and_tables() as the app.
"""
import os
import sys

# Ensure project root is on path
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_this_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

url = os.getenv("DATABASE_URL", "").strip()
if not url:
    print("ERROR: Set DATABASE_URL to your Render database URL.")
    print("Example (PowerShell): $env:DATABASE_URL = 'postgresql://user:pass@host/dbname'")
    print("Get the URL from Render: Dashboard → Database → Connect → External Database URL")
    sys.exit(1)

if not url.startswith("postgres"):
    print("WARNING: DATABASE_URL does not look like PostgreSQL. Continuing anyway.")

# Import after path is set
from backend.database import create_db_and_tables

if __name__ == "__main__":
    print("Applying schema to database...")
    create_db_and_tables()
    print("Done. Tables are up to date.")
