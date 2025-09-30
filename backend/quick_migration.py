"""
Quick production permission migration fix
Run this on Render to update schedule permissions
"""
import os
import sys
from sqlmodel import Session, select
from database import engine
from models import UserPermission, PermissionType

def quick_migration():
    """Quickly update schedule permissions in production"""
    print("🔄 Running quick schedule permissions migration...")
    
    with Session(engine) as session:
        # Update write_all to view_all for schedule page
        write_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "write_all")  # Use string directly
            )
        ).all()
        
        for perm in write_all_perms:
            perm.permission = PermissionType.VIEW_ALL
            print(f"Updated {perm.user_id}: schedule.write_all -> view_all")
        
        # Update read to read_all for schedule page
        read_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "read")  # Use string directly
            )
        ).all()
        
        for perm in read_perms:
            perm.permission = PermissionType.READ_ALL
            print(f"Updated {perm.user_id}: schedule.read -> read_all")
        
        session.commit()
        print(f"✅ Updated {len(write_all_perms) + len(read_perms)} permissions")

if __name__ == "__main__":
    quick_migration()