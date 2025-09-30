"""
One-time migration endpoint - REMOVE AFTER USE
This creates a temporary web endpoint to run the database migration
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from database import get_session
from models import UserPermission, PermissionType, User, UserRole
from routers.auth import get_current_user
import os

# Create temporary router
temp_router = APIRouter()

@temp_router.post("/admin/migrate-schedule-permissions")
def migrate_schedule_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    ONE-TIME MIGRATION ENDPOINT
    Updates schedule permissions: write_all->view_all, read->read_all
    REMOVE THIS ENDPOINT AFTER MIGRATION IS COMPLETE
    """
    
    # Only allow admin and only if environment variable is set
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Safety check - only allow if specific env var is set
    if os.getenv("ALLOW_MIGRATION_ENDPOINT") != "true":
        raise HTTPException(status_code=404, detail="Migration endpoint disabled")
    
    try:
        changes_made = 0
        
        # Update write_all to view_all for schedule page
        write_all_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "write_all")
            )
        ).all()
        
        for perm in write_all_perms:
            old_permission = perm.permission
            perm.permission = PermissionType.VIEW_ALL
            changes_made += 1
            print(f"✅ Updated User {perm.user_id}: schedule.{old_permission} -> schedule.{perm.permission}")
        
        # Update read to read_all for schedule page
        read_perms = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "read")
            )
        ).all()
        
        for perm in read_perms:
            old_permission = perm.permission
            perm.permission = PermissionType.READ_ALL
            changes_made += 1
            print(f"✅ Updated User {perm.user_id}: schedule.{old_permission} -> schedule.{perm.permission}")
        
        # Commit changes
        session.commit()
        
        # Verify results
        remaining_write_all = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "write_all")
            )
        ).all()
        
        remaining_read = session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == "read")
            )
        ).all()
        
        view_all_count = len(session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.VIEW_ALL)
            )
        ).all())
        
        read_all_count = len(session.exec(
            select(UserPermission).where(
                (UserPermission.page == "schedule") & 
                (UserPermission.permission == PermissionType.READ_ALL)
            )
        ).all())
        
        return {
            "success": True,
            "message": "Schedule permissions migration completed",
            "changes_made": changes_made,
            "current_state": {
                "schedule_view_all_permissions": view_all_count,
                "schedule_read_all_permissions": read_all_count,
                "remaining_write_all_permissions": len(remaining_write_all),
                "remaining_read_permissions": len(remaining_read)
            },
            "warning": "REMOVE THIS ENDPOINT AFTER MIGRATION - Set ALLOW_MIGRATION_ENDPOINT=false"
        }
        
    except Exception as e:
        session.rollback()
        print(f"💥 Migration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

# Export the router to be included in main app
migration_router = temp_router