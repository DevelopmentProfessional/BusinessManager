# ============================================================
# FILE: payroll.py
#
# PURPOSE:
#   Handles employee payroll processing for BusinessManager. Provides endpoints
#   to process wage payments (creating pay slips), retrieve pay slip history per
#   employee or across all employees, and check whether an employee is eligible
#   for payment in a given pay period (duplicate prevention).
#
# FUNCTIONAL PARTS:
#   [1] Payment Processing — compute gross/net pay with insurance deductions and persist a PaySlip record
#   [2] Pay Slip Retrieval — fetch pay slips for a single employee or all employees
#   [3] Payment Eligibility Check — determine whether an employee has already been paid for a period
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-08-04 | GitHub Copilot | Convert annual salary to period gross using employee pay frequency when gross is omitted
#   2026-09-11 | GitHub Copilot | Added base-pay and percentage compensation for paid scheduled services
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime, time, timedelta

try:
    from backend.database import get_session
    from backend.models import (
        PaySlip,
        PaySlipCreate,
        PaySlipRead,
        User,
        InsurancePlan,
        PaySchedule,
        PayScheduleCreate,
        PayScheduleRead,
        EmployeePaySchedule,
        EmployeePayScheduleCreate,
        EmployeePayScheduleRead,
        SaleTransaction,
        SaleTransactionItem,
        Schedule,
    )
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import (
        PaySlip,
        PaySlipCreate,
        PaySlipRead,
        User,
        InsurancePlan,
        PaySchedule,
        PayScheduleCreate,
        PayScheduleRead,
        EmployeePaySchedule,
        EmployeePayScheduleCreate,
        EmployeePayScheduleRead,
        SaleTransaction,
        SaleTransactionItem,
        Schedule,
    )
    from routers.auth import get_current_user

router = APIRouter()


def _salary_gross_for_frequency(salary_annual: float, pay_frequency: str | None) -> float:
    """Convert annual salary to gross amount for one pay period."""
    freq = (pay_frequency or "").strip().lower()
    if freq == "weekly":
        return salary_annual / 52.0
    if freq == "biweekly":
        return salary_annual / 26.0
    if freq == "monthly":
        return salary_annual / 12.0
    if freq == "daily":
        return salary_annual / 260.0
    return salary_annual


def _calculate_compensation_gross(
    service_revenue: float,
    base_pay: float,
    compensation_percentage: float,
) -> float:
    """Pay base until revenue exceeds twice base, then share the excess."""
    revenue = max(0.0, float(service_revenue or 0.0))
    base = max(0.0, float(base_pay or 0.0))
    rate = min(100.0, max(0.0, float(compensation_percentage or 0.0))) / 100.0
    threshold = base * 2
    gross = base + max(0.0, revenue - threshold) * rate
    return round(gross, 2)


def _service_revenue_for_period(
    session: Session,
    employee_id: UUID,
    company_id: str,
    period_start: datetime,
    period_end: datetime,
) -> float:
    """Sum paid service line totals linked to this employee's appointments."""
    period_end_exclusive = datetime.combine(period_end.date() + timedelta(days=1), time.min, tzinfo=period_end.tzinfo)
    statement = (
        select(SaleTransactionItem.line_total)
        .join(SaleTransaction, SaleTransactionItem.sale_transaction_id == SaleTransaction.id)
        .join(Schedule, SaleTransaction.schedule_id == Schedule.id)
        .where(
            Schedule.employee_id == employee_id,
            Schedule.company_id == company_id,
            Schedule.is_paid == True,  # noqa: E712
            Schedule.appointment_date >= period_start,
            Schedule.appointment_date < period_end_exclusive,
            SaleTransaction.company_id == company_id,
            SaleTransactionItem.item_type == "service",
            SaleTransactionItem.item_id == Schedule.service_id,
        )
    )
    return round(sum(float(value or 0.0) for value in session.exec(statement).all()), 2)


def _get_employee_compensation_schedule(session: Session, employee_id: UUID, company_id: str) -> EmployeePaySchedule | None:
    return session.exec(
        select(EmployeePaySchedule).where(
            EmployeePaySchedule.company_id == company_id,
            EmployeePaySchedule.employee_id == employee_id,
        )
    ).first()


# ─── 1 PAYMENT PROCESSING ──────────────────────────────────────────────────────

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
    if current_user.company_id and employee.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Duplicate check: same employee + same period start + status paid (scoped to company)
    dup_stmt = select(PaySlip).where(
        PaySlip.employee_id == employee_id,
        PaySlip.pay_period_start == data.pay_period_start,
        PaySlip.status == "paid",
    )
    dup_stmt = dup_stmt.where(PaySlip.company_id == current_user.company_id)
    existing = session.exec(dup_stmt).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Employee has already been paid for the period starting {data.pay_period_start.date()}",
        )

    emp_type = data.employment_type or employee.employment_type or "salary"

    company_id = current_user.company_id or ""
    compensation_schedule = _get_employee_compensation_schedule(session, employee_id, company_id)
    base_pay = float(compensation_schedule.base_pay or 0.0) if compensation_schedule else 0.0
    compensation_percentage = float(compensation_schedule.compensation_percentage or 0.0) if compensation_schedule else 0.0
    base_pay_included = True
    compensation_active = base_pay > 0 or compensation_percentage > 0
    service_revenue = 0.0

    # Gross calculation
    hourly_rate = data.hourly_rate_snapshot or employee.hourly_rate or 0.0
    if compensation_active:
        service_revenue = _service_revenue_for_period(
            session,
            employee_id,
            company_id,
            data.pay_period_start,
            data.pay_period_end,
        )
        gross = _calculate_compensation_gross(service_revenue, base_pay, compensation_percentage)
    elif emp_type == "hourly":
        gross = hourly_rate * (data.hours_worked or 0.0)
    else:
        if data.gross_amount is not None:
            gross = data.gross_amount
        else:
            gross = _salary_gross_for_frequency(float(employee.salary or 0.0), employee.pay_frequency)

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
        service_revenue=service_revenue,
        base_pay_snapshot=base_pay if compensation_active else None,
        compensation_percentage_snapshot=compensation_percentage if compensation_active else None,
        base_pay_included_snapshot=base_pay_included if compensation_active else None,
        pay_frequency=employee.pay_frequency,
        notes=data.notes,
        status="paid",
        insurance_plan_name=insurance_plan_name,
        company_id=company_id,
    )
    session.add(slip)
    session.commit()
    session.refresh(slip)
    return slip


@router.get("/payroll/compensation-preview/{employee_id}", tags=["payroll"])
def get_compensation_preview(
    employee_id: UUID,
    period_start: str = Query(...),
    period_end: str = Query(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Preview service revenue and calculated gross for a pay period."""
    employee = session.get(User, employee_id)
    if not employee or (current_user.company_id and employee.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        start = datetime.fromisoformat(period_start.replace("Z", "+00:00"))
        end = datetime.fromisoformat(period_end.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid pay period")
    if end < start:
        raise HTTPException(status_code=400, detail="Pay period end must not be before start")

    company_id = current_user.company_id or ""
    schedule = _get_employee_compensation_schedule(session, employee_id, company_id)
    base_pay = float(schedule.base_pay or 0.0) if schedule else 0.0
    percentage = float(schedule.compensation_percentage or 0.0) if schedule else 0.0
    included = True
    revenue = _service_revenue_for_period(session, employee_id, company_id, start, end)
    return {
        "service_revenue": revenue,
        "base_pay": base_pay,
        "compensation_percentage": percentage,
        "base_pay_included": included,
        "compensation_active": base_pay > 0 or percentage > 0,
        "gross_amount": _calculate_compensation_gross(revenue, base_pay, percentage),
    }


# ─── 2 PAY SLIP RETRIEVAL ──────────────────────────────────────────────────────

@router.get("/payroll/pay-slips/{employee_id}", response_model=list[PaySlipRead], tags=["payroll"])
def get_employee_pay_slips(
    employee_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return all pay slips for a specific employee, newest first."""
    stmt = select(PaySlip).where(PaySlip.employee_id == employee_id, PaySlip.company_id == current_user.company_id)
    slips = session.exec(stmt.order_by(PaySlip.pay_period_start.desc())).all()
    return slips


@router.get("/payroll/pay-slips", response_model=list[PaySlipRead], tags=["payroll"])
def get_all_pay_slips(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return all pay slips across all employees (admin use)."""
    stmt = select(PaySlip).where(PaySlip.company_id == current_user.company_id)
    slips = session.exec(stmt.order_by(PaySlip.pay_period_start.desc())).all()
    return slips


# ─── 3 PAYMENT ELIGIBILITY CHECK ───────────────────────────────────────────────

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

    stmt = select(PaySlip).where(
        PaySlip.employee_id == employee_id,
        PaySlip.pay_period_start == period_dt,
        PaySlip.status == "paid",
    )
    stmt = stmt.where(PaySlip.company_id == current_user.company_id)
    existing = session.exec(stmt).first()
    return {
        "can_pay": existing is None,
        "existing_slip_id": str(existing.id) if existing else None,
    }


# ─── 4 PAY SCHEDULE (COMPANY-LEVEL SETTINGS) ───────────────────────────────────

@router.get("/payroll/schedule", response_model=PayScheduleRead, tags=["payroll"])
def get_pay_schedule(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return the company's payroll schedule settings. Returns defaults if none configured."""
    company_id = current_user.company_id or ""
    schedule = session.exec(
        select(PaySchedule).where(PaySchedule.company_id == company_id)
    ).first()
    if not schedule:
        # Return a sensible default (not persisted)
        return PayScheduleRead(
            id="00000000-0000-0000-0000-000000000000",
            company_id=company_id,
            frequency="monthly",
            work_days="mon,tue,wed,thu,fri",
            payday_weekday="fri",
            monthly_payday_type="date",
            monthly_payday_date=28,
            pay_timing="arrears",
        )
    return schedule


@router.put("/payroll/schedule", response_model=PayScheduleRead, tags=["payroll"])
def upsert_pay_schedule(
    data: PayScheduleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create or update the company's payroll schedule settings."""
    company_id = current_user.company_id or ""
    schedule = session.exec(
        select(PaySchedule).where(PaySchedule.company_id == company_id)
    ).first()
    if schedule:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(schedule, field, value)
        schedule.updated_at = datetime.utcnow()
    else:
        schedule = PaySchedule(company_id=company_id, **data.model_dump())
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


@router.get("/payroll/employee-schedule/{employee_id}", response_model=EmployeePayScheduleRead, tags=["payroll"])
def get_employee_pay_schedule(
    employee_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    employee = session.get(User, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.company_id and employee.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    company_id = current_user.company_id or ""
    schedule = session.exec(
        select(EmployeePaySchedule).where(
            EmployeePaySchedule.company_id == company_id,
            EmployeePaySchedule.employee_id == employee_id,
        )
    ).first()
    if schedule:
        return schedule

    company_schedule = session.exec(select(PaySchedule).where(PaySchedule.company_id == company_id)).first()
    if not company_schedule:
        return EmployeePayScheduleRead(
            id="00000000-0000-0000-0000-000000000000",
            company_id=company_id,
            employee_id=employee_id,
            frequency="monthly",
            work_days="mon,tue,wed,thu,fri",
            payday_weekday="fri",
            monthly_payday_type="date",
            monthly_payday_date=28,
            pay_timing="arrears",
        )

    return EmployeePayScheduleRead(
        id="00000000-0000-0000-0000-000000000000",
        company_id=company_id,
        employee_id=employee_id,
        frequency=company_schedule.frequency,
        work_days=company_schedule.work_days,
        payday_weekday=company_schedule.payday_weekday,
        monthly_payday_type=company_schedule.monthly_payday_type,
        monthly_payday_date=company_schedule.monthly_payday_date,
        monthly_payday_week=company_schedule.monthly_payday_week,
        monthly_payday_weekday=company_schedule.monthly_payday_weekday,
        pay_timing=company_schedule.pay_timing,
        cycle_anchor_date=company_schedule.cycle_anchor_date,
    )


@router.put("/payroll/employee-schedule/{employee_id}", response_model=EmployeePayScheduleRead, tags=["payroll"])
def upsert_employee_pay_schedule(
    employee_id: UUID,
    data: EmployeePayScheduleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    employee = session.get(User, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.company_id and employee.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    company_id = current_user.company_id or ""
    schedule = session.exec(
        select(EmployeePaySchedule).where(
            EmployeePaySchedule.company_id == company_id,
            EmployeePaySchedule.employee_id == employee_id,
        )
    ).first()

    if schedule:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(schedule, field, value)
        schedule.updated_at = datetime.utcnow()
    else:
        schedule = EmployeePaySchedule(company_id=company_id, employee_id=employee_id, **data.model_dump())

    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule
