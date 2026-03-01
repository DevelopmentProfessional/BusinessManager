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
# ============================================================

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from datetime import datetime
from typing import Optional
from backend.database import get_session
from backend.models import Schedule, Client, Service, User, Inventory, SaleTransaction, Attendance, PaySlip

router = APIRouter()


# ─── 1 HELPER UTILITIES ────────────────────────────────────────────────────────

def _parse_date(d: Optional[str]) -> Optional[datetime]:
    if not d:
        return None
    try:
        return datetime.strptime(d, "%Y-%m-%d")
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
):
    """Appointments over time grouped by day/week/month."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    schedules = session.exec(select(Schedule)).all()

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
):
    """Revenue from completed appointments (service price) and sale transactions."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    # Load services for lookup
    services = session.exec(select(Service)).all()
    service_map = {str(s.id): s.price for s in services}

    grouped: dict = {}

    # Appointment-based revenue
    schedules = session.exec(select(Schedule)).all()
    for s in schedules:
        if s.status != "completed":
            continue
        dt = s.appointment_date
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        price = service_map.get(str(s.service_id), 0) if s.service_id else 0
        label = _group_label(dt, group_by)
        grouped[label] = grouped.get(label, 0) + price

    # Sale transaction revenue
    try:
        transactions = session.exec(select(SaleTransaction)).all()
        for tx in transactions:
            dt = tx.created_at
            if dt is None:
                continue
            if start and dt < start:
                continue
            if end and dt > end:
                continue
            label = _group_label(dt, group_by)
            grouped[label] = grouped.get(label, 0) + (tx.total or 0)
    except Exception:
        pass  # SaleTransaction table may not exist yet

    sorted_keys = sorted(grouped.keys())
    return {"labels": sorted_keys, "data": [grouped[k] for k in sorted_keys]}


# ─── 4 CLIENTS REPORT ──────────────────────────────────────────────────────────

@router.get("/reports/clients")
def get_clients_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("day"),
    session: Session = Depends(get_session),
):
    """Client activity: new clients registered over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    clients = session.exec(select(Client)).all()

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
    schedules = session.exec(select(Schedule)).all()
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
):
    """Service popularity: count of appointments per service."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    services = session.exec(select(Service)).all()
    service_name_map = {str(s.id): s.name for s in services}

    schedules = session.exec(select(Schedule)).all()
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
):
    """Inventory analytics: current stock levels per item."""
    items = session.exec(select(Inventory)).all()
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
):
    """Employee performance: appointments per employee."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    users = session.exec(select(User)).all()
    user_name_map = {str(u.id): f"{u.first_name} {u.last_name}" for u in users}

    schedules = session.exec(select(Schedule)).all()
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
):
    """Attendance analytics: attendance records grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    rows = session.exec(select(Attendance)).all()
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
):
    """Sales analytics: transaction totals grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    txs = session.exec(select(SaleTransaction)).all()
    grouped: dict = {}

    for tx in txs:
        dt = tx.created_at
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue

        label = _group_label(dt, group_by)
        grouped[label] = grouped.get(label, 0) + (tx.total or 0)

    sorted_keys = sorted(grouped.keys())
    return {"labels": sorted_keys, "data": [grouped[k] for k in sorted_keys]}


# ─── 10 PAYROLL REPORT ─────────────────────────────────────────────────────────

@router.get("/reports/payroll")
def get_payroll_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("month"),
    session: Session = Depends(get_session),
):
    """Payroll analytics: total net pay grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    slips = session.exec(select(PaySlip)).all()
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
