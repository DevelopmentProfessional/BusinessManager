# Business Manager - Deployment Guide

## 📁 Repository Information

- 🔗 **GitHub Repository**: <https://github.com/DevelopmentProfessional/BusinessManager>
- 🌐 **Production URL**: <https://lavishbeautyhairandnail.care>
- 📊 **API URL**: <https://api.lavishbeautyhairandnail.care>

## 🚀 Deployment Safety Checklist

### ✅ Database Protection

The application is designed with **SAFE** deployment practices:

1. **Conditional Table Creation**: Uses `CREATE TABLE IF NOT EXISTS`
2. **Safe Migrations**: All migrations check for existing data before changes
3. **Data Preservation**: Existing records are never overwritten
4. **Environment Variables**: Production uses PostgreSQL, development uses SQLite

### ✅ Recent Updates (Production Ready)

- **Schedule Permission System**: Added `schedule:write_all` permission for granular control
  - Users with `schedule:write` can only create appointments for themselves
  - Users with `schedule:write_all` can create appointments for any employee
  - Frontend UI automatically adjusts based on user permissions

- **Database Schema**: All changes are backwards compatible
  - New `WRITE_ALL = "write_all"` added to PermissionType enum
  - Frontend permission dropdowns updated to include new permission
  - Special UI toggles for easy permission management

### 🛡️ Pre-Deployment Protection

The following safety measures are in place:

```python
# Database initialization is SAFE
def create_db_and_tables():
    """Create database tables and run safe migrations."""
    SQLModel.metadata.create_all(engine)  # Uses CREATE IF NOT EXISTS
    _migrate_documents_table_if_needed()   # Conditional migrations
```

### 🔧 Environment Configuration

**Local Development:**
```bash
DATABASE_URL=sqlite:///./business_manager.db
```

**Production (Render.com):**
```bash
DATABASE_URL=postgresql://user:pass@host/db  # From render database
ENVIRONMENT=production
ALLOWED_ORIGINS=https://lavishbeautyhairandnail.care
```

## 📋 Deployment Steps

1. **Backup Current Data** (if needed):
   ```bash
   python pre_deployment_protection.py
   ```

2. **Push to Repository**:
   ```bash
   git add .
   git commit -m "feat: add schedule write_all permission system"
   git push origin main
   ```

3. **Render.com Auto-Deploy**:
   - Render will automatically detect the push
   - Build backend with `pip install -r backend/requirements.txt`
   - Initialize database with `python init_database.py`
   - Start API with `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Frontend Deploy**:
   - Build with `cd frontend && npm install && npm run build`
   - Serve with `npx serve dist -l $PORT -s`

## ✅ Safety Verification

### Database Migration Safety
```python
# All migrations are conditional and safe:
def _migrate_documents_table_if_needed():
    # Only runs if needed, preserves existing data
    
def _ensure_item_type_column_if_needed():
    # Only adds column if missing, no data loss
```

### Permission System Changes
- ✅ New permissions added to enum (backwards compatible)
- ✅ Frontend updated to support new permission
- ✅ Backend API handles both old and new permission models
- ✅ Existing users retain their current permissions

## 🎯 Ready for Production!

The application is **SAFE** to deploy because:

1. **No Breaking Changes**: All updates are additive and backwards compatible
2. **Data Protection**: Existing database records are preserved
3. **Graceful Fallbacks**: Code handles missing permissions gracefully
4. **Environment Separation**: Development and production databases are separate

## 📊 Post-Deployment Features

After deployment, admins can:

1. **Manage Permissions**: Use the updated UI to grant `schedule:write_all`
2. **Employee Scheduling**: Users see appropriate employee dropdown based on permissions
3. **Granular Control**: Fine-tune who can schedule for whom

The new permission system enhances security and workflow control without affecting existing functionality.

## 🔧 Emergency Rollback (if needed)

If any issues occur, the deployment can be safely rolled back:

1. **Database**: No destructive changes were made
2. **Code**: Previous version remains in git history
3. **Permissions**: Existing permissions continue to work

**The deployment is PRODUCTION READY and SAFE!** 🚀