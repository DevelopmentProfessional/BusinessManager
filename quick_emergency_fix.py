#!/usr/bin/env python3
"""
EMERGENCY Production Permission Fix - No Dependencies
====================================================

This script connects directly to your production database and fixes
the permission validation errors that are causing the 500 errors.

Run this IMMEDIATELY to fix the production issues.
"""

import os
import sys

def main():
    print("🚨 EMERGENCY PRODUCTION PERMISSION FIX")
    print("=" * 60)
    
    # Check for DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not found!")
        print()
        print("🔧 TO FIX THIS:")
        print("1. Get your production DATABASE_URL from Render dashboard")
        print("2. Set it as environment variable:")
        print("   $env:DATABASE_URL=\"your_database_url_here\"")
        print("3. Run this script again")
        print()
        print("🎯 OR run this script directly on Render in the Shell:")
        print("   pip install psycopg2-binary")
        print("   python fix_production_permissions.py")
        return
    
    print("✅ DATABASE_URL found - ready to fix permissions")
    print()
    
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not installed")
        print("🔧 Install it with: pip install psycopg2-binary")
        return
    
    try:
        # Connect and fix
        print("🔌 Connecting to production database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Show current state
        cursor.execute("SELECT permission_type, COUNT(*) FROM user_permissions GROUP BY permission_type")
        current = cursor.fetchall()
        print("📊 Current permissions:")
        for ptype, count in current:
            print(f"   {ptype}: {count}")
        
        # Fix write_all -> view_all
        cursor.execute("UPDATE user_permissions SET permission_type = 'view_all' WHERE permission_type = 'write_all'")
        write_updated = cursor.rowcount
        
        # Fix read -> read_all  
        cursor.execute("UPDATE user_permissions SET permission_type = 'read_all' WHERE permission_type = 'read'")
        read_updated = cursor.rowcount
        
        conn.commit()
        
        print(f"✅ Updated {write_updated} write_all -> view_all")
        print(f"✅ Updated {read_updated} read -> read_all")
        print()
        
        # Verify
        cursor.execute("SELECT permission_type, COUNT(*) FROM user_permissions GROUP BY permission_type")
        updated = cursor.fetchall()
        print("📊 Updated permissions:")
        for ptype, count in updated:
            print(f"   {ptype}: {count}")
        
        cursor.close()
        conn.close()
        
        print()
        print("🎉 SUCCESS! Permission 500 errors should now be fixed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
        print("🔧 Try running this on Render Shell instead:")
        print("1. Go to Render Dashboard -> Your Backend Service -> Shell")
        print("2. Run: pip install psycopg2-binary")
        print("3. Run: python fix_production_permissions.py")

if __name__ == "__main__":
    main()