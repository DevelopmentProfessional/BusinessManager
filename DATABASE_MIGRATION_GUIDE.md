# 🚀 Database Migration Guide: InventoryImage Table

## Overview
This guide helps you add the new `InventoryImage` table to your database, enabling multiple image support for inventory items.

## 🗄️ What's Being Added

### Database Table: `inventoryimage`
```sql
- id: UUID (Primary Key)
- inventory_id: UUID (Foreign Key to inventory.id)
- image_url: TEXT (for URL-based images)
- file_path: TEXT (for uploaded file images)  
- file_name: TEXT (original filename)
- is_primary: BOOLEAN (whether this is the primary image)
- sort_order: INTEGER (for ordering images)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Features
- **Flexible Storage**: Supports both URL links and uploaded files
- **Primary Image**: One image per item can be marked as primary
- **Ordering**: Images can be sorted in a specific order
- **Constraints**: Ensures at least one of image_url or file_path is provided
- **Cascade Delete**: When inventory item is deleted, all its images are deleted
- **Performance**: Includes optimized indexes for fast queries

## 🛠️ Migration Steps

### Step 1: Test Migration Locally (Recommended)
```bash
cd /path/to/BusinessManager
python test_migration.py
```

### Step 2: Run Migration on Your Database
Choose one of the following options:

#### Option A: Use the Migration Script (Recommended)
```bash
cd /path/to/BusinessManager/backend
python migrate_inventory_images.py
```

#### Option B: Manual SQL (Advanced Users)
If you prefer to run the SQL directly, use the commands in the migration script.

### Step 3: Deploy Updated Backend
1. Commit and push your backend changes
2. Deploy to Render (will automatically use the new table structure)

### Step 4: Deploy Frontend
1. The frontend is already updated to use the new image system
2. Deploy your frontend changes

## 🔧 Configuration

### Database Environment
Make sure your database environment is set correctly:

```bash
# Check current environment
python -c "from backend.db_config import get_current_environment; print(get_current_environment())"

# Set to production for Render deployment
python -c "from backend.db_config import set_current_environment; set_current_environment('development')"
```

### Environment Variables (Render)
Ensure these are set in your Render service:
- `DATABASE_URL`: Your PostgreSQL connection string (automatically set by Render)

## 🧪 Testing

### 1. Test Migration
```bash
python test_migration.py
```

### 2. Test API Endpoints
After migration, test these new endpoints:
- `POST /api/v1/isud/inventory/{id}/images/url` - Add image URL
- `POST /api/v1/isud/inventory/{id}/images/upload` - Upload image file
- `GET /api/v1/isud/inventory/{id}/images` - Get all images
- `PUT /api/v1/isud/inventory/images/{image_id}` - Update image
- `DELETE /api/v1/isud/inventory/images/{image_id}` - Delete image

### 3. Test Frontend Features
- Add images via URL in ItemForm
- Upload image files in ItemForm
- View multiple images in ItemDetailModal
- Navigate between images with arrow buttons

## 🚨 Rollback Plan

If you need to rollback the migration:

### Remove the Table
```sql
-- PostgreSQL
DROP TABLE IF EXISTS inventoryimage CASCADE;

-- SQLite  
DROP TABLE IF EXISTS inventoryimage;
```

### Revert Code Changes
```bash
git revert <commit-hash>
```

## ⚡ Performance Notes

- **Indexes**: Automatically created for optimal query performance
- **File Storage**: Uploaded files stored in `backend/uploads/` directory
- **Caching**: API responses are cached for better performance
- **Lazy Loading**: Images loaded on-demand when viewing item details

## 🔐 Security

- **File Validation**: Only image files (JPEG, PNG, GIF, WebP) allowed
- **Path Security**: File paths are sanitized and stored securely
- **Access Control**: Images follow the same permission system as inventory items

## 📞 Support

If you encounter any issues:

1. **Check Logs**: Look at your server logs for error messages
2. **Test Locally**: Run the test migration script first
3. **Verify Environment**: Ensure database environment is correct
4. **Check Database**: Verify table was created successfully

## ✅ Success Indicators

After migration, you should see:
- ✅ "Created InventoryImage table" message in logs
- ✅ New endpoints respond successfully
- ✅ Frontend image management works
- ✅ Existing inventory items still display correctly
- ✅ Legacy image_url field still supported

The migration maintains full backward compatibility - existing inventory items will continue to work exactly as before, with the added benefit of supporting multiple images!