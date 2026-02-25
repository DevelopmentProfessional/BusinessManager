from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime

try:
    from backend.database import get_session
    from backend.models import PaySlip, PaySlipCreate, PaySlipRead, User, InsurancePlan
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import PaySlip, PaySlipCreate, PaySlipRead, User, InsurancePlan
    from routers.auth import get_current_user

router = APIRouter()


@router.post("/payroll/pay/{employee_id}", response_model=PaySlipRead, tags=["payroll"])
def process_payment(
    employee_id: UUID,
    data: PaySlipCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Process a wage payment for an employee. Blocks duplicate payments in the same pay period."""
    employee = session.get(User, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Duplicate check: same employee + same period start + status paid
    existing = session.exec(
        select(PaySlip).where(
            PaySlip.employee_id == employee_id,
            PaySlip.pay_period_start == data.pay_period_start,
            PaySlip.status == "paid",
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Employee has already been paid for the period starting {data.pay_period_start.date()}",
        )

    emp_type = data.employment_type or employee.employment_type or "salary"

    # Gross calculation
    hourly_rate = data.hourly_rate_snapshot or employee.hourly_rate or 0.0
    if emp_type == "hourly":
        gross = hourly_rate * (data.hours_worked or 0.0)
    else:
        gross = data.gross_amount if data.gross_amount is not None else (employee.salary or 0.0)

    # Auto-deduction from insurance plan
    insurance_deduction = 0.0
    insurance_plan_name = employee.insurance_plan
    if employee.insurance_plan:
        plan = session.exec(
            select(InsurancePlan).where(InsurancePlan.name == employee.insurance_plan)
        ).first()
        if plan and plan.monthly_deduction:
            insurance_deduction = float(plan.monthly_deduction)

    other_deductions = data.other_deductions or 0.0
    net = gross - insurance_deduction - other_deductions

    slip = PaySlip(
        employee_id=employee_id,
        pay_period_start=data.pay_period_start,
        pay_period_end=data.pay_period_end,
        gross_amount=gross,
        insurance_deduction=insurance_deduction,
        other_deductions=other_deductions,
        net_amount=net,
        employment_type=emp_type,
        hours_worked=data.hours_worked if emp_type == "hourly" else None,
        hourly_rate_snapshot=hourly_rate if emp_type == "hourly" else None,
        salary_snapshot=employee.salary,
        pay_frequency=employee.pay_frequency,
        notes=data.notes,
        status="paid",
        insurance_plan_name=insurance_plan_name,
    )
    session.add(slip)
    session.commit()
    session.refresh(slip)
    return slip


@router.get("/payroll/pay-slips/{employee_id}", response_model=list[PaySlipRead], tags=["payroll"])
def get_employee_pay_slips(
    employee_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return all pay slips for a specific employee, newest first."""
    slips = session.exec(
        select(PaySlip)
        .where(PaySlip.employee_id == employee_id)
        .order_by(PaySlip.pay_period_start.desc())
    ).all()
    return slips


@router.get("/payroll/pay-slips", response_model=list[PaySlipRead], tags=["payroll"])
def get_all_pay_slips(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return all pay slips across all employees (admin use)."""
    slips = session.exec(
        select(PaySlip).order_by(PaySlip.pay_period_start.desc())
    ).all()
    return slips


@router.get("/payroll/check/{employee_id}", tags=["payroll"])
def check_payment_eligibility(
    employee_id: UUID,
    period_start: str = Query(..., description="ISO date string for the pay period start"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Check whether an employee can receive a payment for the given period start."""
    try:
        period_dt = datetime.fromisoformat(period_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid period_start — use ISO format (YYYY-MM-DD)")

    existing = session.exec(
        select(PaySlip).where(
            PaySlip.employee_id == employee_id,
            PaySlip.pay_period_start == period_dt,
            PaySlip.status == "paid",
        )
    ).first()
    return {
        "can_pay": existing is None,
        "existing_slip_id": str(existing.id) if existing else None,
    }
