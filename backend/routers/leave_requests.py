# ============================================================
# FILE: leave_requests.py
#
# PURPOSE:
#   Handles approval and denial actions for three types of HR workflow requests:
#   leave (vacation/sick), onboarding, and offboarding. Enforces authorization
#   rules (admin or assigned supervisor only) and adjusts employee leave-day
#   counters when a leave request is approved or reversed.
#
# FUNCTIONAL PARTS:
#   [1] Leave Request Action — approve/deny leave requests with vacation/sick day ledger updates
#   [2] Onboarding Request Action — approve/deny new-hire onboarding requests
#   [3] Offboarding Request Action — approve/deny employee offboarding requests
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime
from backend.database import get_session
from backend.models import LeaveRequest, OnboardingRequest, OffboardingRequest, User, UserRole
from backend.routers.auth import get_current_user

router = APIRouter()

# ─── HELPERS ───────────────────────────────────────────────────────────────────

def _parse_uuid(value: str, label: str = "request ID") -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label} format")

def _require_admin_or_supervisor(current_user: User, req) -> None:
    """Raise 403 unless current_user is admin or the request's assigned supervisor."""
    is_admin = current_user.role == UserRole.ADMIN
    is_supervisor = str(req.supervisor_id) == str(current_user.id) if req.supervisor_id else False
    if not is_admin and not is_supervisor:
        raise HTTPException(status_code=403, detail="Not authorized to act on this request")

def _simple_request_action(model_class, request_id: str, action_data: dict, current_user: User, session: Session, label: str):
    """Generic approve/deny handler for onboarding and offboarding requests."""
    req_uuid = _parse_uuid(request_id)
    req = session.get(model_class, req_uuid)
    if not req or (current_user.company_id and req.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail=f"{label} not found")

    action = action_data.get("action")
    if action not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'denied'")

    _require_admin_or_supervisor(current_user, req)

    req.status = action
    req.updated_at = datetime.utcnow()
    session.add(req)
    session.commit()
    session.refresh(req)
    return {"message": f"Request {action}", "id": str(req.id), "status": req.status}

# ─── 1 LEAVE REQUEST ACTION ────────────────────────────────────────────────────

@router.put("/leave-requests/{request_id}/action")
def leave_request_action(
    request_id: str,
    action_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Approve or deny a leave request.
    - Only the supervisor the request was routed to, or an admin, may act on it.
    - Approving increments vacation_days_used / sick_days_used on the employee.
    - Changing from approved → denied reverses the deduction.
    """
    req_uuid = _parse_uuid(request_id)
    req = session.get(LeaveRequest, req_uuid)
    if not req or (current_user.company_id and req.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Leave request not found")

    action = action_data.get("action")
    if action not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'denied'")

    _require_admin_or_supervisor(current_user, req)

    old_status = req.status
    req.status = action
    req.updated_at = datetime.utcnow()

    days = int(req.days_requested) if req.days_requested else 0

    # Approve: increment used days
    if action == "approved" and old_status != "approved" and days > 0:
        employee = session.get(User, req.user_id)
        if employee:
            if req.leave_type == "vacation":
                employee.vacation_days_used = (employee.vacation_days_used or 0) + days
            elif req.leave_type == "sick":
                employee.sick_days_used = (employee.sick_days_used or 0) + days
            employee.updated_at = datetime.utcnow()
            session.add(employee)

    # Un-approve (approved → denied): reverse the deduction
    if action == "denied" and old_status == "approved" and days > 0:
        employee = session.get(User, req.user_id)
        if employee:
            if req.leave_type == "vacation":
                employee.vacation_days_used = max(0, (employee.vacation_days_used or 0) - days)
            elif req.leave_type == "sick":
                employee.sick_days_used = max(0, (employee.sick_days_used or 0) - days)
            employee.updated_at = datetime.utcnow()
            session.add(employee)

    session.add(req)
    session.commit()
    session.refresh(req)

    return {"message": f"Request {action}", "id": str(req.id), "status": req.status}


# ─── 2 ONBOARDING REQUEST ACTION ───────────────────────────────────────────────

@router.put("/onboarding-requests/{request_id}/action")
def onboarding_request_action(
    request_id: str,
    action_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Approve or deny an onboarding request."""
    return _simple_request_action(OnboardingRequest, request_id, action_data, current_user, session, "Onboarding request")


# ─── 3 OFFBOARDING REQUEST ACTION ──────────────────────────────────────────────

@router.put("/offboarding-requests/{request_id}/action")
def offboarding_request_action(
    request_id: str,
    action_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Approve or deny an offboarding request."""
    return _simple_request_action(OffboardingRequest, request_id, action_data, current_user, session, "Offboarding request")
