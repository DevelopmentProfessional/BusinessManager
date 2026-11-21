"""
Router: /api/v1/audit
CRUD for audit logs and compliance tracking.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

try:
    from backend.database import get_session
    from backend.models import AuditLog, User
    from backend.routers.auth import get_current_user
except ImportError:
    from database import get_session
    from models import AuditLog, User
    from routers.auth import get_current_user

router = APIRouter()


@router.get("/audit-logs")
def get_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[UUID] = None,
    days: int = Query(7, ge=1, le=90),  # Default last 7 days, max 90
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get audit logs for company (requires admin role)"""
    
    # Only admins can view audit logs
    if current_user.role != "admin":
        raise Exception("Unauthorized")
    
    stmt = select(AuditLog).where(
        AuditLog.company_id == current_user.company_id
    )
    
    # Filter by date
    start_date = datetime.utcnow() - timedelta(days=days)
    stmt = stmt.where(AuditLog.created_at >= start_date)
    
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    
    if action:
        stmt = stmt.where(AuditLog.action == action)
    
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    
    stmt = stmt.order_by(AuditLog.created_at.desc())
    
    return session.exec(stmt).all()


@router.get("/audit-logs/{log_id}")
def get_audit_log(
    log_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get specific audit log"""
    
    if current_user.role != "admin":
        raise Exception("Unauthorized")
    
    log = session.get(AuditLog, log_id)
    if not log or log.company_id != current_user.company_id:
        raise Exception("Not found")
    
    return log


@router.get("/audit-summary")
def get_audit_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get audit summary for dashboard"""
    
    if current_user.role != "admin":
        raise Exception("Unauthorized")
    
    stmt = select(AuditLog).where(
        AuditLog.company_id == current_user.company_id
    ).order_by(AuditLog.created_at.desc()).limit(100)
    
    recent_logs = session.exec(stmt).all()
    
    # Count by action
    action_counts = {}
    for log in recent_logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1
    
    # Count failures
    failure_count = len([l for l in recent_logs if l.status == 'failure'])
    
    return {
        'total': len(recent_logs),
        'failures': failure_count,
        'by_action': action_counts,
        'recent': recent_logs[:20]
    }
