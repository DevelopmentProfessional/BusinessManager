# 🚀 Deployment Guide - Business Manager to Render

## 📋 Pre-Deployment Checklist

✅ **Database Migration Completed**
- SQLite data exported to CSV files
- Backup created: `business_manager_backup_YYYYMMDD_HHMMSS.db`
- Migration summary: `backend/data/migration_summary.txt`

✅ **Configuration Ready**
- `render.yaml` configured for PostgreSQL
- All dependencies in `requirements.txt` and `package.json`
- Frontend build process tested

## 🌐 Deployment Steps

### 1. **Push to Git Repository**
```bash
git add .
git commit -m "Ready for production deployment with PostgreSQL"
git push origin main
```

### 2. **Deploy to Render**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your Git repository
4. Render will automatically detect the `render.yaml` file
5. Click "Apply" to start deployment

### 3. **Monitor Deployment**
- Backend API: `lavish-beauty-api`
- Frontend App: `lavish-beauty-app`
- PostgreSQL Database: `lavish-beauty-db`

### 4. **Post-Deployment Data Import**

#### Option A: Use Admin Panel (Recommended)
1. Access your deployed application
2. Login with admin credentials: `admin` / `admin123`
3. Go to Admin panel
4. Use "Import Data" feature to upload:
   - `backend/data/user_export.csv` (for admin user)
   - `backend/data/Salon Manager.xlsx` (for business data)

#### Option B: Direct Database Import
1. Connect to PostgreSQL database via Render dashboard
2. Import CSV files directly using psql or pgAdmin

## 🔧 Configuration Details

### Environment Variables (Auto-configured by render.yaml)
- `DATABASE_URL`: PostgreSQL connection string
- `ALLOWED_ORIGINS`: CORS origins for frontend
- `ENVIRONMENT`: production
- `VITE_API_URL`: Backend API URL for frontend

### Database Schema
- All tables will be created automatically on first deployment
- Includes new `dark_mode` field for user preferences
- Compatible with existing data structure

## 📊 Data Migration Summary

**Exported Data:**
- ✅ Admin user (1 record)
- ⚠️ Other tables empty (ready for business data import)

**Files Ready for Import:**
- `backend/data/user_export.csv` - Admin user data
- `backend/data/Salon Manager.xlsx` - Business data (clients, services, appointments)

## 🔐 Security Notes

1. **Change Admin Password**: After first login, change the default admin password
2. **Environment Variables**: All sensitive data is stored in Render environment variables
3. **HTTPS**: Automatic SSL certificates provided by Render
4. **Database**: PostgreSQL with automatic backups

## 🚨 Important Notes

- **Database Persistence**: PostgreSQL data persists across deployments
- **File Storage**: Uploaded files are stored in Render's persistent storage
- **Backup**: Your original SQLite database is backed up locally
- **Rollback**: You can always revert to local development if needed

## 🆘 Troubleshooting

### If Deployment Fails:
1. Check Render logs for specific errors
2. Verify all dependencies are in requirements.txt
3. Ensure database connection string is correct

### If Data Import Fails:
1. Check CSV file format
2. Verify column names match database schema
3. Use Admin panel's error messages for guidance

### If Frontend Can't Connect to Backend:
1. Verify `VITE_API_URL` environment variable
2. Check CORS configuration
3. Ensure both services are running

## 📞 Support

- Render Documentation: https://render.com/docs
- Application Logs: Available in Render dashboard
- Database Access: Via Render PostgreSQL dashboard

---

**Ready to deploy! 🚀**
