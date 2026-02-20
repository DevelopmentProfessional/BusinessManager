from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime
from backend.database import get_session
from backend.models import LeaveRequest, OnboardingRequest, OffboardingRequest, User, UserRole
from backend.routers.auth import get_current_user

router = APIRouter()


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
    try:
        req_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format")

    req = session.get(LeaveRequest, req_uuid)
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    action = action_data.get("action")
    if action not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'denied'")

    # Authorization: admin can act on anything; supervisor can only act on requests routed to them
    is_admin = current_user.role == UserRole.ADMIN
    is_supervisor = str(req.supervisor_id) == str(current_user.id) if req.supervisor_id else False
    if not is_admin and not is_supervisor:
        raise HTTPException(status_code=403, detail="Not authorized to act on this request")

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


@router.put("/onboarding-requests/{request_id}/action")
def onboarding_request_action(
    request_id: str,
    action_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Approve or deny an onboarding request."""
    try:
        req_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format")

    req = session.get(OnboardingRequest, req_uuid)
    if not req:
        raise HTTPException(status_code=404, detail="Onboarding request not found")

    action = action_data.get("action")
    if action not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'denied'")

    is_admin = current_user.role == UserRole.ADMIN
    is_supervisor = str(req.supervisor_id) == str(current_user.id) if req.supervisor_id else False
    if not is_admin and not is_supervisor:
        raise HTTPException(status_code=403, detail="Not authorized to act on this request")

    req.status = action
    req.updated_at = datetime.utcnow()
    session.add(req)
    session.commit()
    session.refresh(req)

    return {"message": f"Request {action}", "id": str(req.id), "status": req.status}


@router.put("/offboarding-requests/{request_id}/action")
def offboarding_request_action(
    request_id: str,
    action_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Approve or deny an offboarding request."""
    try:
        req_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format")

    req = session.get(OffboardingRequest, req_uuid)
    if not req:
        raise HTTPException(status_code=404, detail="Offboarding request not found")

    action = action_data.get("action")
    if action not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'denied'")

    is_admin = current_user.role == UserRole.ADMIN
    is_supervisor = str(req.supervisor_id) == str(current_user.id) if req.supervisor_id else False
    if not is_admin and not is_supervisor:
        raise HTTPException(status_code=403, detail="Not authorized to act on this request")

    req.status = action
    req.updated_at = datetime.utcnow()
    session.add(req)
    session.commit()
    session.refresh(req)

    return {"message": f"Request {action}", "id": str(req.id), "status": req.status}
