# 🚀 Quick Start Guide

## Run from Main Directory

You can now run the entire Business Manager application from the main directory using any of these methods:

### Option 1: Simple Batch File (Recommended for Windows)

```bash
# Double-click or run from command line
start.bat
```

### Option 2: PowerShell Script

```powershell
# Run from PowerShell
.\start.ps1
```

### Option 3: NPM Scripts

```bash
# Install concurrently first
npm install

# Run both backend and frontend
npm run dev

# Or run separately
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

## What These Scripts Do

1. **Install Dependencies**
   - Backend: `fastapi`, `uvicorn`, `sqlmodel`, `python-multipart`
   - Frontend: All React dependencies from `package.json`

2. **Start Both Servers**
   - Backend API: http://localhost:8000
   - Frontend App: http://localhost:5173
   - API Documentation: http://localhost:8000/docs

3. **Use SQLite Database**
   - No PostgreSQL setup required
   - Database file: `backend/business_manager.db`
   - Automatically created on first run

## Access Your Application

- **Frontend**: <http://localhost:5173>
- **Backend API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/docs>
- **Health Check**: <http://localhost:8000/health>

## Features Available

✅ **Dashboard** - Overview with metrics and alerts
✅ **Clients** - Full CRUD operations (Create, Read, Update, Delete)
✅ **Items** - Item catalog management
✅ **Navigation** - All entity pages accessible
🔄 **Other Entities** - Ready for expansion (Services, Employees, etc.)

## Troubleshooting

If you encounter issues:

1. **Python not found**: Install Python 3.9+
2. **Node.js not found**: Install Node.js 18+
3. **Port conflicts**: Change ports in the scripts if needed
4. **Dependencies fail**: Try running individual install commands

## Next Steps

1. Run the application using any method above
2. Open <http://localhost:5173> in your browser
3. Start adding clients and items
4. Explore the API documentation at <http://localhost:8000/docs>
