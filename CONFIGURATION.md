# Configuration

This project uses environment variables to configure ports, CORS, and API base URLs.

## Backend (`backend/`)

- PORT: FastAPI/Uvicorn port (default: 8000)
- ALLOWED_ORIGINS: Comma-separated list of origins for CORS
  - Default: `http://localhost:5173,https://*.onrender.com`

The backend optionally loads a `.env` file if present (via python-dotenv). You can create `backend/.env` with:

```
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,https://*.onrender.com
```

## Frontend (`frontend/`)

- VITE_PORT: Vite dev server port (default: 5173)
- VITE_API_URL: Base API URL used by the app (default: `http://localhost:8000/api/v1`)

Create `frontend/.env` with:

```
VITE_PORT=5173
VITE_API_URL=http://localhost:8000/api/v1
```

## Start Scripts

- `start.ps1` and `start.bat` set sensible defaults and pass variables to servers.
- You can override variables before running the scripts, e.g. PowerShell:

```
$env:PORT=9000; $env:VITE_PORT=5174; ./start.ps1
```

Batch (cmd.exe):

```
set PORT=9000 && set VITE_PORT=5174 && start.bat
```

## Notes

- The backend reads `PORT` and `ALLOWED_ORIGINS` at runtime.
- The frontend reads `VITE_PORT` from Node process env (for dev server) and `VITE_API_URL` at build/runtime via Vite.
- Documentation files may still reference 8000/5173 as defaults; these remain correct unless you override.
