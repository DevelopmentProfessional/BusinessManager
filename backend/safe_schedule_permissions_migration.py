#!/usr/bin/env python3
"""
SAFE Schedule Permissions Migration Script
=========================================

CRITICAL SAFETY NOTE: 
- This script ONLY touches UserPermission records for the 'schedule' page
- It does NOT modify any appointment data, schedule data, or other tables
- It only updates permission enum values for better schedule functionality

Changes:
- Updates existing 'write_all' permissions on 'schedule' page to 'view_all' 
- Updates existing 'read' permissions on 'schedule' page to 'read_all'
- Leaves all other permissions and data completely untouched

This is required because the schedule APIs work better with view_all/read_all permissions.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from database import get_session, engine
from models import UserPermission, PermissionType

def create_backup():
    """Create a backup of current permission state before migration"""
    print("📋 Creating backup of current schedule permissions...")
    
    backup_file = f"schedule_permissions_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    
    with Session(engine) as session:
        # Get all schedule permissions
        schedule_permissions = session.exec(
            select(UserPermission).where(UserPermission.page == "schedule")
        ).all()
        
        backup_data = []
        for perm in schedule_permissions:
            backup_data.append(f"-- User {perm.user_id}: {perm.page} -> {perm.permission} (granted: {perm.granted})")
            backup_data.append(
                f"UPDATE user_permission SET permission = '{perm.permission}' "
                f"WHERE id = '{perm.id}';"
            )
        
        with open(backup_file, 'w') as f:
            f.write("-- Schedule Permissions Backup\n")
            f.write(f"-- Created: {datetime.now()}\n")
            f.write("-- Use this file to restore permissions if needed\n\n")
            f.write("\n".join(backup_data))
    
    print(f"   ✅ Backup saved to: {backup_file}")
    return len(schedule_permissions)

def preview_changes():
    """Preview what changes will be made"""
    print("\n🔍 Previewing changes to schedule permissions...")
    
    with Session(engine) as session:
        # Find write_all permissions on schedule page
        write_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.WRITE_ALL)
            )
        ).all()
        
        # Find read permissions on schedule page  
        read_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.READ)
            )
        ).all()
        
        print(f"   📝 Will change {len(write_all_perms)} 'write_all' permissions to 'view_all'")
        print(f"   📖 Will change {len(read_perms)} 'read' permissions to 'read_all'")
        
        if write_all_perms:
            print("\n   Write_all -> View_all changes:")
            for perm in write_all_perms:
                print(f"      User {perm.user_id}: schedule.write_all -> schedule.view_all")
        
        if read_perms:
            print("\n   Read -> Read_all changes:")
            for perm in read_perms:
                print(f"      User {perm.user_id}: schedule.read -> schedule.read_all")
        
        if not write_all_perms and not read_perms:
            print("   ℹ️  No schedule permissions need updating")
        
        return len(write_all_perms) + len(read_perms)

def perform_migration():
    """Perform the actual migration"""
    print("\n🚀 Performing schedule permissions migration...")
    
    changes_made = 0
    
    with Session(engine) as session:
        # Update write_all to view_all for schedule page
        write_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.WRITE_ALL)
            )
        ).all()
        
        for perm in write_all_perms:
            old_permission = perm.permission
            perm.permission = PermissionType.VIEW_ALL
            perm.updated_at = datetime.utcnow()
            print(f"   ✅ Updated User {perm.user_id}: schedule.{old_permission} -> schedule.{perm.permission}")
            changes_made += 1
        
        # Update read to read_all for schedule page
        read_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.READ)
            )
        ).all()
        
        for perm in read_perms:
            old_permission = perm.permission
            perm.permission = PermissionType.READ_ALL
            perm.updated_at = datetime.utcnow()
            print(f"   ✅ Updated User {perm.user_id}: schedule.{old_permission} -> schedule.{perm.permission}")
            changes_made += 1
        
        # Commit all changes
        session.commit()
        print(f"\n   💾 Committed {changes_made} permission updates")
    
    return changes_made

def verify_migration():
    """Verify the migration was successful"""
    print("\n🔍 Verifying migration results...")
    
    with Session(engine) as session:
        # Check that no write_all or read permissions remain on schedule page
        remaining_write_all = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.WRITE_ALL)
            )
        ).all()
        
        remaining_read = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.READ)
            )
        ).all()
        
        # Count new permissions
        view_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.VIEW_ALL)
            )
        ).all()
        
        read_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.READ_ALL)
            )
        ).all()
        
        print(f"   📊 Current schedule permissions:")
        print(f"      view_all: {len(view_all_perms)}")
        print(f"      read_all: {len(read_all_perms)}")
        print(f"      write_all (should be 0): {len(remaining_write_all)}")
        print(f"      read (should be 0): {len(remaining_read)}")
        
        success = len(remaining_write_all) == 0 and len(remaining_read) == 0
        
        if success:
            print("   ✅ Migration verification PASSED")
        else:
            print("   ❌ Migration verification FAILED - some old permissions remain")
        
        return success

def main():
    """Main migration process"""
    print("🔄 SAFE Schedule Permissions Migration")
    print("=" * 50)
    print("⚠️  SAFETY: This script ONLY modifies UserPermission records for 'schedule' page")
    print("⚠️  SAFETY: No appointment data, schedule data, or other tables are touched")
    print("=" * 50)
    
    try:
        # Step 1: Create backup
        backup_count = create_backup()
        
        # Step 2: Preview changes
        change_count = preview_changes()
        
        if change_count == 0:
            print("\n✅ No changes needed. Schedule permissions are already up to date.")
            return
        
        # Step 3: Confirm before proceeding
        print(f"\n⚠️  Ready to update {change_count} schedule permissions")
        print("   This will change:")
        print("   - 'write_all' -> 'view_all' (for schedule page only)")
        print("   - 'read' -> 'read_all' (for schedule page only)")
        
        confirm = input("\n   Proceed with migration? (yes/no): ").lower().strip()
        
        if confirm != 'yes':
            print("❌ Migration cancelled by user")
            return
        
        # Step 4: Perform migration
        changes_made = perform_migration()
        
        # Step 5: Verify results
        success = verify_migration()
        
        if success:
            print(f"\n🎉 MIGRATION COMPLETED SUCCESSFULLY!")
            print(f"   ✅ {changes_made} schedule permissions updated")
            print(f"   ✅ All appointment data remains untouched")
            print(f"   ✅ Backup available for rollback if needed")
        else:
            print(f"\n❌ MIGRATION COMPLETED WITH ISSUES!")
            print(f"   ⚠️  Please check the verification results above")
        
    except Exception as e:
        print(f"\n💥 MIGRATION FAILED: {e}")
        print("   🔄 Database should be in original state")
        print("   📋 Use backup file to restore if needed")
        raise

if __name__ == "__main__":
    main()