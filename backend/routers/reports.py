# ============================================================
# FILE: reports.py
#
# PURPOSE:
#   Provides read-only analytics and reporting endpoints for the
#   BusinessManager application. Each route aggregates data from one or more
#   database tables and returns label/data pairs suitable for charting on the
#   frontend. All routes support optional date-range and grouping parameters.
#
# FUNCTIONAL PARTS:
#   [1] Helper Utilities — date parsing, group-label generation, and date-range filtering
#   [2] Appointments Report — scheduled appointments grouped by day/week/month with status/employee filters
#   [3] Revenue Report — combined revenue from completed appointments and sale transactions
#   [4] Clients Report — new client registrations and appointment counts over time
#   [5] Services Report — appointment counts broken down by service (popularity ranking)
#   [6] Inventory Report — current stock levels and low-stock alerts
#   [7] Employees Report — appointment counts per employee (performance ranking)
#   [8] Attendance Report — attendance record counts grouped over time with employee filter
#   [9] Sales Report — sale transaction totals grouped over time
#   [10] Payroll Report — net pay totals from pay slips grouped over time
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-15 | Claude  | Added authentication + company_id scoping to all endpoints
# ============================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import Optional
import logging
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, NoSuchTableError
from backend.database import get_session
from backend.models import Schedule, Client, Service, User, Inventory, SaleTransaction, Attendance, PaySlip, ClientOrder
from backend.routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

REPORTABLE_PORTAL_ORDER_STATUSES = {
    "ordered",
    "processing",
    "ready_for_pickup",
    "out_for_delivery",
    "delivered",
    "picked_up",
}


# ─── 1 HELPER UTILITIES ────────────────────────────────────────────────────────

def _parse_date(d: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
    if not d:
        return None
    try:
        parsed = datetime.strptime(d, "%Y-%m-%d")
        if end_of_day:
            return parsed + timedelta(days=1) - timedelta(microseconds=1)
        return parsed
    except ValueError:
        return None


def _group_label(dt: datetime, group_by: str) -> str:
    if group_by == "week":
        return f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
    if group_by == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


def _date_filter(items, date_field_getter, start, end):
    """Filter a list of ORM objects by date range."""
    result = []
    for item in items:
        dt = date_field_getter(item)
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        result.append(item)
    return result


# ─── 2 APPOINTMENTS REPORT ─────────────────────────────────────────────────────

@router.get("/reports/appointments")
def get_appointments_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Appointments over time grouped by day/week/month."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(Schedule).where(Schedule.company_id == current_user.company_id)
    schedules = session.exec(stmt).all()

    grouped: dict = {}
    for s in schedules:
        dt = s.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        if status and status != "all" and s.status != status:
            continue
        if employee_id and employee_id != "all" and str(s.employee_id) != employee_id:
            continue
        label = _group_label(dt, group_by)
        grouped[label] = grouped.get(label, 0) + 1

    sorted_keys = sorted(grouped.keys())
    return {"labels": sorted_keys, "data": [grouped[k] for k in sorted_keys]}


# ─── 3 REVENUE REPORT ──────────────────────────────────────────────────────────

@router.get("/reports/revenue")
def get_revenue_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Revenue from completed appointments (service price) and sale transactions."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    # Load services for lookup
    stmt_service = select(Service).where(Service.company_id == current_user.company_id)
    services = session.exec(stmt_service).all()
    service_map = {str(s.id): s.price for s in services}

    grouped_total: dict = {}
    grouped_service: dict = {}
    grouped_pos: dict = {}
    grouped_portal: dict = {}
    warnings: list[str] = []

    # Appointment-based revenue
    stmt_schedule = select(Schedule).where(Schedule.company_id == current_user.company_id)
    schedules = session.exec(stmt_schedule).all()
    for s in schedules:
        if s.status != "completed":
            continue
        # If the schedule is already tied to a POS sale transaction,
        # revenue is accounted for by transactions and should not be double-counted.
        if s.sale_transaction_id:
            continue
        dt = s.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        price = service_map.get(str(s.service_id), 0) if s.service_id else 0
        label = _group_label(dt, group_by)
        grouped_service[label] = grouped_service.get(label, 0) + price
        grouped_total[label] = grouped_total.get(label, 0) + price

    # Sale transaction revenue
    try:
        stmt_tx = select(SaleTransaction).where(SaleTransaction.company_id == current_user.company_id)
        transactions = session.exec(stmt_tx).all()
        for tx in transactions:
            dt = tx.created_at
            if dt is None:
                continue
            if start and dt < start:
                continue
            if end and dt > end:
                continue
            label = _group_label(dt, group_by)
            amount = tx.total or 0
            grouped_pos[label] = grouped_pos.get(label, 0) + amount
            grouped_total[label] = grouped_total.get(label, 0) + amount
    except NoSuchTableError as e:
        logger.exception(
            "Revenue report: SaleTransaction table unavailable (query=select(SaleTransaction).where(company_id=%s), error=%s).",
            current_user.company_id,
            e,
        )
        warnings.append("POS sales data unavailable")
    except SQLAlchemyError as e:
        logger.exception(
            "Revenue report: critical SaleTransaction query failure (query=select(SaleTransaction).where(company_id=%s), error=%s).",
            current_user.company_id,
            e,
        )
        raise HTTPException(status_code=500, detail="Failed to load POS sales data.")

    # Portal paid orders revenue
    try:
        stmt_orders = select(ClientOrder).where(ClientOrder.company_id == current_user.company_id)
        orders = session.exec(stmt_orders).all()
        for order in orders:
            if (order.status or "").lower() not in REPORTABLE_PORTAL_ORDER_STATUSES:
                continue
            dt = order.paid_at or order.created_at
            if dt is None:
                continue
            if start and dt < start:
                continue
            if end and dt > end:
                continue
            label = _group_label(dt, group_by)
            amount = order.total or 0
            grouped_portal[label] = grouped_portal.get(label, 0) + amount
            grouped_total[label] = grouped_total.get(label, 0) + amount
    except (NoSuchTableError, SQLAlchemyError, IntegrityError) as exc:
        logger.exception(
            "Revenue report: failed portal orders query block for ClientOrder (query=select(ClientOrder).where(company_id=%s), error=%s).",
            current_user.company_id,
            exc,
        )

    sorted_keys = sorted(grouped_total.keys())
    return {
        "labels": sorted_keys,
        "data": [grouped_total.get(k, 0) for k in sorted_keys],
        "datasets": [
            {"label": "Total Revenue", "data": [grouped_total.get(k, 0) for k in sorted_keys]},
            {"label": "Service Revenue", "data": [grouped_service.get(k, 0) for k in sorted_keys]},
            {"label": "POS Revenue", "data": [grouped_pos.get(k, 0) for k in sorted_keys]},
            {"label": "Portal Revenue", "data": [grouped_portal.get(k, 0) for k in sorted_keys]},
        ],
        "warnings": warnings,
    }


# ─── 4 CLIENTS REPORT ──────────────────────────────────────────────────────────

@router.get("/reports/clients")
def get_clients_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Client activity: new clients registered over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt_client = select(Client).where(Client.company_id == current_user.company_id)
    clients = session.exec(stmt_client).all()

    new_clients: dict = {}
    for c in clients:
        dt = c.created_at
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        label = _group_label(dt, group_by)
        new_clients[label] = new_clients.get(label, 0) + 1

    # Appointments per time period
    stmt_schedule = select(Schedule).where(Schedule.company_id == current_user.company_id)
    schedules = session.exec(stmt_schedule).all()
    appt_counts: dict = {}
    for a in schedules:
        dt = a.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        label = _group_label(dt, group_by)
        appt_counts[label] = appt_counts.get(label, 0) + 1

    all_labels = sorted(set(list(new_clients.keys()) + list(appt_counts.keys())))
    return {
        "labels": all_labels,
        "data": [new_clients.get(k, 0) for k in all_labels],
        "datasets": [
            {"label": "New Clients", "data": [new_clients.get(k, 0) for k in all_labels]},
            {"label": "Appointments", "data": [appt_counts.get(k, 0) for k in all_labels]},
        ]
    }


# ─── 5 SERVICES REPORT ─────────────────────────────────────────────────────────

@router.get("/reports/services")
def get_services_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Service popularity: count of appointments per service."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt_service = select(Service).where(Service.company_id == current_user.company_id)
    services = session.exec(stmt_service).all()
    service_name_map = {str(s.id): s.name for s in services}

    stmt_schedule = select(Schedule).where(Schedule.company_id == current_user.company_id)
    schedules = session.exec(stmt_schedule).all()
    service_counts: dict = {}
    for s in schedules:
        dt = s.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        name = service_name_map.get(str(s.service_id), "No Service") if s.service_id else "No Service"
        service_counts[name] = service_counts.get(name, 0) + 1

    sorted_items = sorted(service_counts.items(), key=lambda x: x[1], reverse=True)
    labels = [item[0] for item in sorted_items]
    data = [item[1] for item in sorted_items]
    return {"labels": labels, "data": data}


# ─── 6 INVENTORY REPORT ────────────────────────────────────────────────────────

@router.get("/reports/inventory")
def get_inventory_report(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Inventory analytics: current stock levels per item."""
    stmt = select(Inventory).where(Inventory.company_id == current_user.company_id)
    items = session.exec(stmt).all()
    labels = [item.name for item in items]
    data = [item.quantity for item in items]
    low_stock = [item.name for item in items if item.quantity <= item.min_stock_level]

    return {
        "labels": labels,
        "data": data,
        "low_stock_items": low_stock,
        "total_items": len(items),
        "low_stock_count": len(low_stock),
    }


# ─── 7 EMPLOYEES REPORT ────────────────────────────────────────────────────────

@router.get("/reports/employees")
def get_employees_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Employee performance: appointments per employee."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt_user = select(User).where(User.company_id == current_user.company_id)
    users = session.exec(stmt_user).all()
    user_name_map = {str(u.id): f"{u.first_name} {u.last_name}" for u in users}

    stmt_schedule = select(Schedule).where(Schedule.company_id == current_user.company_id)
    schedules = session.exec(stmt_schedule).all()
    emp_counts: dict = {}
    for s in schedules:
        dt = s.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        name = user_name_map.get(str(s.employee_id), "Unknown")
        emp_counts[name] = emp_counts.get(name, 0) + 1

    sorted_items = sorted(emp_counts.items(), key=lambda x: x[1], reverse=True)
    labels = [item[0] for item in sorted_items]
    data = [item[1] for item in sorted_items]
    return {"labels": labels, "data": data}


# ─── 8 ATTENDANCE REPORT ───────────────────────────────────────────────────────

@router.get("/reports/attendance")
def get_attendance_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    employee_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Attendance analytics: attendance records grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(Attendance).where(Attendance.company_id == current_user.company_id)
    rows = session.exec(stmt).all()
    grouped: dict = {}

    for row in rows:
        dt = row.date
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        if employee_id and employee_id != "all" and str(row.user_id) != employee_id:
            continue

        label = _group_label(dt, group_by)
        grouped[label] = grouped.get(label, 0) + 1

    sorted_keys = sorted(grouped.keys())
    return {"labels": sorted_keys, "data": [grouped[k] for k in sorted_keys]}


# ─── 9 SALES REPORT ────────────────────────────────────────────────────────────

@router.get("/reports/sales")
def get_sales_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Sales analytics: transaction totals grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    grouped_total: dict = {}
    grouped_pos: dict = {}
    grouped_portal: dict = {}

    try:
        stmt = select(SaleTransaction).where(SaleTransaction.company_id == current_user.company_id)
        txs = session.exec(stmt).all()
        for tx in txs:
            dt = tx.created_at
            if dt is None:
                continue
            if start and dt < start:
                continue
            if end and dt > end:
                continue

            label = _group_label(dt, group_by)
            amount = tx.total or 0
            grouped_pos[label] = grouped_pos.get(label, 0) + amount
            grouped_total[label] = grouped_total.get(label, 0) + amount
    except (NoSuchTableError, SQLAlchemyError, IntegrityError):
        logger.exception(
            "Sales report: failed SaleTransaction query block (query=select(SaleTransaction).where(company_id=%s)).",
            current_user.company_id,
        )

    # Include paid portal orders so "sales" reflects total transaction volume.
    try:
        stmt_orders = select(ClientOrder).where(ClientOrder.company_id == current_user.company_id)
        orders = session.exec(stmt_orders).all()
        for order in orders:
            if (order.status or "").lower() not in REPORTABLE_PORTAL_ORDER_STATUSES:
                continue
            dt = order.paid_at or order.created_at
            if dt is None:
                continue
            if start and dt < start:
                continue
            if end and dt > end:
                continue
            label = _group_label(dt, group_by)
            amount = order.total or 0
            grouped_portal[label] = grouped_portal.get(label, 0) + amount
            grouped_total[label] = grouped_total.get(label, 0) + amount
    except (NoSuchTableError, SQLAlchemyError, IntegrityError):
        logger.exception(
            "Sales report: failed portal orders query block for ClientOrder (query=select(ClientOrder).where(company_id=%s)).",
            current_user.company_id,
        )

    sorted_keys = sorted(grouped_total.keys())
    return {
        "labels": sorted_keys,
        "data": [grouped_total.get(k, 0) for k in sorted_keys],
        "datasets": [
            {"label": "Total Sales", "data": [grouped_total.get(k, 0) for k in sorted_keys]},
            {"label": "POS Sales", "data": [grouped_pos.get(k, 0) for k in sorted_keys]},
            {"label": "Portal Sales", "data": [grouped_portal.get(k, 0) for k in sorted_keys]},
        ],
    }


# ─── 10 PAYROLL REPORT ─────────────────────────────────────────────────────────

@router.get("/reports/payroll")
def get_payroll_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("month"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Payroll analytics: total net pay grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(PaySlip).where(PaySlip.company_id == current_user.company_id)
    slips = session.exec(stmt).all()
    grouped: dict = {}

    for slip in slips:
        dt = slip.pay_period_end
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue

        label = _group_label(dt, group_by)
        grouped[label] = grouped.get(label, 0) + (slip.net_amount or 0)

    sorted_keys = sorted(grouped.keys())
    return {"labels": sorted_keys, "data": [grouped[k] for k in sorted_keys]}
