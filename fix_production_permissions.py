#!/usr/bin/env python3
"""
Direct Production Database Fix - Schedule Permissions
====================================================

This script directly connects to the production database and updates
the schedule permissions to fix the CORS/500 errors.

Just like we fixed the login issue - this directly updates the database.

Usage: python fix_production_permissions.py
"""

import os
import psycopg2
from datetime import datetime
import sys

def connect_to_production():
    """Connect to production database using DATABASE_URL"""
    
    # Try to get DATABASE_URL from environment or use the production URL pattern
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        print("💡 You can set it manually or run this on Render")
        return None
    
    try:
        # Parse the URL and connect
        conn = psycopg2.connect(database_url)
        print("✅ Connected to production database")
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return None

def fix_schedule_permissions():
    """Fix schedule permissions in production database"""
    
    print("🔄 Starting Schedule Permissions Fix")
    print("=" * 50)
    
    conn = connect_to_production()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # First, let's see what we're working with
        print("📋 Checking current permissions in user_permissions table...")
        
        cursor.execute("""
            SELECT permission_type, COUNT(*) 
            FROM user_permissions 
            GROUP BY permission_type
        """)
        
        current_perms = cursor.fetchall()
        print("   Current permission types:")
        for perm, count in current_perms:
            print(f"      {perm}: {count}")
        
        # Update write_all to view_all (for all write_all permissions)
        print("\n🔧 Updating write_all -> view_all...")
        
        cursor.execute("""
            UPDATE user_permissions 
            SET permission_type = 'view_all'
            WHERE permission_type = 'write_all'
        """)
        
        write_all_updated = cursor.rowcount
        print(f"   ✅ Updated {write_all_updated} write_all permissions to view_all")
        
        # Update read to read_all (for all read permissions)
        print("\n🔧 Updating read -> read_all...")
        
        cursor.execute("""
            UPDATE user_permissions 
            SET permission_type = 'read_all'
            WHERE permission_type = 'read'
        """)
        
        read_updated = cursor.rowcount
        print(f"   ✅ Updated {read_updated} read permissions to read_all")
        
        # Commit the changes
        conn.commit()
        print(f"\n💾 Committed {write_all_updated + read_updated} permission updates")
        
        # Verify the changes
        print("\n🔍 Verifying changes...")
        
        cursor.execute("""
            SELECT permission_type, COUNT(*) 
            FROM user_permissions 
            GROUP BY permission_type
        """)
        
        updated_perms = cursor.fetchall()
        print("   Updated permission types:")
        for perm, count in updated_perms:
            print(f"      {perm}: {count}")
        
        # Check for any remaining old permissions
        cursor.execute("""
            SELECT COUNT(*) FROM user_permissions 
            WHERE permission_type IN ('write_all', 'read')
        """)
        
        remaining_old = cursor.fetchone()[0]
        
        if remaining_old == 0:
            print("\n🎉 SUCCESS! All permissions updated correctly")
            print("✅ No old permission types remain")
            print("✅ The 500 errors should now be resolved")
            return True
        else:
            print(f"\n⚠️ Warning: {remaining_old} old permissions still remain")
            return False
            
    except Exception as e:
        print(f"\n💥 Error during migration: {e}")
        conn.rollback()
        return False
        
    finally:
        cursor.close()
        conn.close()
        print("\n🔒 Database connection closed")

def main():
    """Main execution"""
    print("🚀 Production Schedule Permissions Fix")
    print("⚠️  This will update permission types in production database")
    print("⚠️  Only affects user_permissions table - no appointments touched")
    print("🔄 Converting: write_all → view_all, read → read_all")
    
    # Run the fix
    success = fix_schedule_permissions()
    
    if success:
        print("\n" + "=" * 50)
        print("✅ PRODUCTION FIX COMPLETED SUCCESSFULLY!")
        print("✅ Schedule permission errors should now be resolved")
        print("✅ Users can now create view_all and read_all permissions")
        sys.exit(0)
    else:
        print("\n" + "=" * 50)
        print("❌ PRODUCTION FIX FAILED!")
        print("❌ Manual intervention may be required")
        sys.exit(1)

if __name__ == "__main__":
    main()