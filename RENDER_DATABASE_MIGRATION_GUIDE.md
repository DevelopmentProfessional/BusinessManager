# Render Database Schema Migration Instructions

## 🚨 Problem
Your Render PostgreSQL database has an old schema that's missing columns that exist in your local SQLite database. This causes deployment failures when the application tries to query columns that don't exist in production.

## 🎯 Solution Overview
We need to safely migrate the Render PostgreSQL database to match your local schema by adding missing columns and tables **without losing any existing data**.

## 📋 Step-by-Step Instructions

### Method 1: Automated Migration Script (RECOMMENDED)

#### Step 1: Get Your Render Database Connection String
1. Go to your Render dashboard: https://dashboard.render.com/
2. Navigate to your `lavish-beauty-db` database
3. Click on "Connections" or "Info" tab
4. Copy the **External Connection String** (it looks like: `postgresql://user:password@host:port/database`)

#### Step 2: Run the Migration Script Locally
1. Open PowerShell in your project directory
2. Set the database connection environment variable:
   ```powershell
   $env:DATABASE_URL = "postgresql://your_render_connection_string_here"
   ```
3. Run the migration script:
   ```powershell
   cd backend
   C:/Users/dpint/OneDrive/Documents/Applications/BusinessManager/.venv/Scripts/python.exe production_schema_migration.py
   ```

#### Step 3: Verify Migration Success
The script will output detailed progress and should end with:
```
🎉 Production schema migration completed successfully!
📋 Summary of changes:
   ✅ User table: Added missing columns (phone, hire_date, etc.)
   ✅ PermissionType enum: Created/updated with all values  
   ✅ UserPermission table: Created with proper schema
   ✅ Document table: Added new columns
   ✅ All existing data: Preserved
```

#### Step 4: Trigger New Render Deployment
1. Make a small commit to trigger redeployment:
   ```powershell
   git add .
   git commit -m "Trigger deployment after schema migration"
   git push origin main
   ```

### Method 2: Manual SQL Commands (If Script Fails)

If the automated script doesn't work, you can run these SQL commands directly on your Render database:

#### Connect to Render Database
Use a PostgreSQL client (like pgAdmin, DBeaver, or psql) with your Render connection string.

#### Run These SQL Commands:

```sql
-- 1. Create PermissionType enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permissiontype') THEN
        CREATE TYPE permissiontype AS ENUM ('read', 'write', 'write_all', 'delete', 'admin', 'view_all');
    END IF;
END $$;

-- 2. Add missing columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone VARCHAR;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS hire_date TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT FALSE;

-- 3. Update existing user records with defaults
UPDATE "user" SET 
    hire_date = created_at WHERE hire_date IS NULL,
    is_active = TRUE WHERE is_active IS NULL,
    is_locked = FALSE WHERE is_locked IS NULL,
    force_password_reset = FALSE WHERE force_password_reset IS NULL,
    failed_login_attempts = 0 WHERE failed_login_attempts IS NULL,
    dark_mode = FALSE WHERE dark_mode IS NULL;

-- 4. Create userpermission table
CREATE TABLE IF NOT EXISTS userpermission (
    id VARCHAR PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    user_id VARCHAR NOT NULL,
    page VARCHAR NOT NULL,
    permission permissiontype NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_userpermission_user 
        FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_userpermission_user_id ON userpermission (user_id);
CREATE INDEX IF NOT EXISTS idx_userpermission_page_permission ON userpermission (page, permission);

-- 6. Add missing document table columns
ALTER TABLE document ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE document ADD COLUMN IF NOT EXISTS signed_by VARCHAR;
ALTER TABLE document ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
ALTER TABLE document ADD COLUMN IF NOT EXISTS owner_id VARCHAR;
ALTER TABLE document ADD COLUMN IF NOT EXISTS review_date TIMESTAMP;
ALTER TABLE document ADD COLUMN IF NOT EXISTS category_id VARCHAR;

-- 7. Verify the migration
SELECT COUNT(*) as user_count FROM "user";
SELECT COUNT(*) as permission_count FROM userpermission;
```

### Method 3: Render Console Access (Alternative)

If you have access to Render's console feature:

1. Go to your Render service dashboard
2. Open the "Console" tab
3. Run the migration script directly on Render:
   ```bash
   cd backend
   python production_schema_migration.py
   ```

## 🔍 Verification Steps

After running the migration:

1. **Check Render Logs**: Your next deployment should show successful database initialization
2. **Health Check**: Visit `https://api.lavishbeautyhairandnail.care/health` - should return healthy status
3. **Login Test**: Try logging into your admin account
4. **Permission Test**: Check if you can see "Write All Employee Schedules" in employee management

## 🚨 Safety Notes

- **Data Preservation**: All commands use `ADD COLUMN IF NOT EXISTS` - no existing data will be lost
- **Schedule Data**: Your schedule records are completely safe - no changes to that table structure
- **Rollback**: If something goes wrong, your existing data is preserved and the app will continue working with basic permissions

## 📞 Troubleshooting

### If Migration Script Fails:
1. Check your DATABASE_URL is correct
2. Ensure your local machine can connect to Render's database (firewall/network)
3. Try the manual SQL commands instead

### If Deployment Still Fails:
1. Check Render deployment logs for specific error messages
2. Verify all tables exist: `user`, `userpermission`, `schedule`, `client`, etc.
3. Verify PermissionType enum has all values: `read`, `write`, `write_all`, `delete`, `admin`, `view_all`

### If You Need Help:
- The migration script provides detailed logging
- All operations are safe and preserve existing data
- You can re-run the migration script multiple times safely

## 🎯 Expected Result

After successful migration:
- ✅ Render deployment succeeds
- ✅ All existing schedule data preserved
- ✅ Admin can login successfully  
- ✅ WRITE_ALL permissions available in UI
- ✅ All existing functionality works unchanged

---
**Migration Date**: September 30, 2025  
**Status**: Ready to Execute  
**Risk Level**: 🟢 LOW (All operations preserve existing data)