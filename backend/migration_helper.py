"""
Quick Database Connection Helper

This script helps you connect to your Render PostgreSQL database
and run the schema migration.

Before running this script:
1. Get your Render database connection string from dashboard.render.com
2. Set it as an environment variable or paste it below
"""

import os
import sys

def get_render_connection_info():
    """Display information about getting Render connection string."""
    
    print("🔗 How to get your Render Database Connection String:")
    print()
    print("1. Go to: https://dashboard.render.com/")
    print("2. Click on your 'lavish-beauty-db' database")
    print("3. Go to 'Connections' or 'Info' tab")
    print("4. Copy the 'External Connection String'")
    print("   (Should look like: postgresql://user:pass@host:port/database)")
    print()
    
    # Check if already set
    if os.getenv("DATABASE_URL"):
        print("✅ DATABASE_URL environment variable is already set!")
        return True
    
    print("5. Set it as environment variable:")
    print('   PowerShell: $env:DATABASE_URL = "your_connection_string"')
    print('   Bash: export DATABASE_URL="your_connection_string"')
    print()
    
    # Option to set it directly
    print("6. Or paste it here directly:")
    connection_string = input("Enter connection string (or press Enter to skip): ").strip()
    
    if connection_string:
        os.environ["DATABASE_URL"] = connection_string
        print("✅ Connection string set!")
        return True
    
    return False

def run_migration():
    """Run the schema migration."""
    print("🚀 Running schema migration...")
    
    try:
        # Import and run the migration
        from production_schema_migration import main
        main()
        
    except ImportError:
        print("❌ Migration script not found!")
        print("Make sure you're in the backend directory.")
        return False
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False
    
    return True

def main():
    """Main function to guide through the process."""
    print("=" * 60)
    print("🛠️  RENDER DATABASE SCHEMA MIGRATION HELPER")
    print("=" * 60)
    print()
    
    # Step 1: Get connection info
    if not get_render_connection_info():
        print("❌ Database connection string required!")
        print("Please set DATABASE_URL environment variable and try again.")
        sys.exit(1)
    
    print()
    print("-" * 60)
    
    # Step 2: Confirm migration
    print("⚠️  IMPORTANT SAFETY NOTICE:")
    print("   - This migration adds missing columns to your Render database")
    print("   - ALL EXISTING DATA WILL BE PRESERVED")
    print("   - Schedule records will NOT be touched")
    print("   - You can run this migration multiple times safely")
    print()
    
    confirm = input("Ready to run migration? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("❌ Migration cancelled.")
        sys.exit(0)
    
    print()
    print("-" * 60)
    
    # Step 3: Run migration
    if run_migration():
        print()
        print("🎉 Migration completed successfully!")
        print()
        print("Next steps:")
        print("1. Go to your Render dashboard")
        print("2. Trigger a new deployment (or push a commit to GitHub)")
        print("3. Check deployment logs for successful startup")
        print("4. Test your application!")
        
    else:
        print()
        print("❌ Migration failed!")
        print("Check the error messages above and try the manual SQL method.")

if __name__ == "__main__":
    main()