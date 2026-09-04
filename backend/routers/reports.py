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
#   [11] Employee Activity Report — employee workdays with appointment and sales details
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-15 | Claude  | Added authentication + company_id scoping to all endpoints
#   2026-05-19 | GitHub Copilot | Added integrated inventory expenses report with recurring and one-time cost behavior
#   2026-08-01 | GitHub Copilot | Added base-vs-add-on service revenue split datasets for sales analytics
#   2026-09-04 | GitHub Copilot | Added employee activity workday report with appointments and sales
# ============================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import Optional
import json
import logging
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, NoSuchTableError
from backend.database import get_session
from backend.models import Schedule, Client, Service, User, Inventory, SaleTransaction, SaleTransactionItem, Attendance, PaySlip, ClientOrder, Task
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


def _period_floor(dt: datetime, group_by: str) -> datetime:
    if group_by == "month":
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if group_by == "week":
        d = dt - timedelta(days=dt.weekday())
        return d.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _period_next(dt: datetime, group_by: str) -> datetime:
    if group_by == "month":
        if dt.month == 12:
            return dt.replace(year=dt.year + 1, month=1)
        return dt.replace(month=dt.month + 1)
    if group_by == "week":
        return dt + timedelta(days=7)
    return dt + timedelta(days=1)


def _iter_periods(start: datetime, end: datetime, group_by: str):
    cur = _period_floor(start, group_by)
    while cur <= end:
        yield cur
        cur = _period_next(cur, group_by)


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
    grouped_service_base: dict = {}
    grouped_service_addon: dict = {}

    try:
        tx_label_by_id: dict = {}
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
            tx_label_by_id[str(tx.id)] = label
            grouped_pos[label] = grouped_pos.get(label, 0) + amount
            grouped_total[label] = grouped_total.get(label, 0) + amount

        # Split service line revenue into base and add-on components using options_json.
        stmt_items = select(SaleTransactionItem).where(SaleTransactionItem.company_id == current_user.company_id)
        tx_items = session.exec(stmt_items).all()
        for item in tx_items:
            if str(item.item_type or "").lower() != "service":
                continue
            label = tx_label_by_id.get(str(item.sale_transaction_id))
            if not label:
                continue

            line_total = float(item.line_total or 0)
            qty = max(0, int(item.quantity or 0))
            addon_total = 0.0

            raw_options = item.options_json
            if raw_options:
                try:
                    parsed_options = json.loads(raw_options) if isinstance(raw_options, str) else raw_options
                except (TypeError, ValueError, json.JSONDecodeError):
                    parsed_options = []
                if isinstance(parsed_options, list):
                    for addon in parsed_options:
                        if not isinstance(addon, dict):
                            continue
                        if addon.get("is_billable", True) is False:
                            continue
                        addon_qty = max(0, int(addon.get("quantity") or 0))
                        price_delta = float(addon.get("price_delta") or 0)
                        addon_total += price_delta * addon_qty
                    addon_total *= max(1, qty)

            addon_total = min(max(addon_total, 0), max(line_total, 0))
            base_total = max(0.0, line_total - addon_total)

            grouped_service_addon[label] = grouped_service_addon.get(label, 0) + addon_total
            grouped_service_base[label] = grouped_service_base.get(label, 0) + base_total
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
            {"label": "Base Service Revenue", "data": [grouped_service_base.get(k, 0) for k in sorted_keys]},
            {"label": "Service Add-on Revenue", "data": [grouped_service_addon.get(k, 0) for k in sorted_keys]},
        ],
    }


# ─── 10 PAYROLL REPORT ─────────────────────────────────────────────────────────

@router.get("/reports/employee-activity")
def get_employee_activity_report(
    employee_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return an employee's worked days, services performed, and attributed sales."""
    if not employee_id or employee_id == "all":
        return {
            "employee": None,
            "days": [],
            "totals": {"work_days": 0, "appointments": 0, "services_total": 0, "sales": 0, "sales_total": 0, "total": 0},
        }

    employee = session.exec(
        select(User).where(User.id == employee_id, User.company_id == current_user.company_id)
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)
    days: dict = {}

    services = session.exec(
        select(Service).where(Service.company_id == current_user.company_id)
    ).all()
    service_details = {
        str(service.id): {"name": service.name, "amount": float(service.price or 0)}
        for service in services
    }

    schedules = session.exec(
        select(Schedule).where(
            Schedule.company_id == current_user.company_id,
            Schedule.employee_id == employee.id,
        )
    ).all()
    for schedule in schedules:
        if start and schedule.appointment_date < start:
            continue
        if end and schedule.appointment_date > end:
            continue
        day_key = schedule.appointment_date.date().isoformat()
        day = days.setdefault(day_key, {"date": day_key, "appointments": [], "sales": []})
        service = service_details.get(str(schedule.service_id), {"name": "Unassigned service", "amount": 0})
        day["appointments"].append({
            "time": schedule.appointment_date.strftime("%H:%M"),
            "service": service["name"],
            "amount": service["amount"],
        })

    transactions = session.exec(
        select(SaleTransaction).where(
            SaleTransaction.company_id == current_user.company_id,
            SaleTransaction.employee_id == employee.id,
        )
    ).all()
    transaction_ids = [transaction.id for transaction in transactions]
    items_by_transaction: dict = {}
    if transaction_ids:
        items = session.exec(
            select(SaleTransactionItem).where(SaleTransactionItem.sale_transaction_id.in_(transaction_ids))
        ).all()
        for item in items:
            items_by_transaction.setdefault(str(item.sale_transaction_id), []).append(item.item_name)

    for transaction in transactions:
        sale_date = transaction.created_at
        if sale_date is None:
            continue
        if start and sale_date < start:
            continue
        if end and sale_date > end:
            continue
        day_key = sale_date.date().isoformat()
        day = days.setdefault(day_key, {"date": day_key, "appointments": [], "sales": []})
        day["sales"].append({
            "time": sale_date.strftime("%H:%M"),
            "items": items_by_transaction.get(str(transaction.id), []),
            "total": float(transaction.total or 0),
        })

    ordered_days = []
    for day_key in sorted(days):
        day = days[day_key]
        day["appointments"].sort(key=lambda appointment: appointment["time"])
        day["sales"].sort(key=lambda sale: sale["time"])
        day["appointment_count"] = len(day["appointments"])
        day["services_total"] = round(sum(appointment["amount"] for appointment in day["appointments"]), 2)
        day["sales_count"] = len(day["sales"])
        day["sales_total"] = round(sum(sale["total"] for sale in day["sales"]), 2)
        ordered_days.append(day)

    return {
        "employee": {
            "id": str(employee.id),
            "name": f"{employee.first_name} {employee.last_name}".strip() or employee.username,
        },
        "days": ordered_days,
        "totals": {
            "work_days": len(ordered_days),
            "appointments": sum(day["appointment_count"] for day in ordered_days),
            "services_total": round(sum(day["services_total"] for day in ordered_days), 2),
            "sales": sum(day["sales_count"] for day in ordered_days),
            "sales_total": round(sum(day["sales_total"] for day in ordered_days), 2),
            "total": round(sum(day["services_total"] + day["sales_total"] for day in ordered_days), 2),
        },
    }

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


# ─── 11 EXPENSES REPORT ───────────────────────────────────────────────────────

@router.get("/reports/expenses")
def get_expenses_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("month"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Expenses from inventory costs by purchase/rental behavior.

    one_time: counted once on date_of_purchase (or created_at fallback)
    recurring: counted each period from purchase date until sale date (if sold)
    """
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(Inventory).where(Inventory.company_id == current_user.company_id)
    items = session.exec(stmt).all()

    one_time_grouped: dict = {}
    recurring_grouped: dict = {}
    all_labels: set[str] = set()

    if start and end:
        periods = list(_iter_periods(start, end, group_by))
    else:
        periods = []

    if not periods:
        has_recurring = any(str(item.cost_type or "one_time").lower() == "recurring" for item in items)
        if has_recurring:
            raise HTTPException(
                status_code=400,
                detail="start_date and end_date are required when recurring costs are present.",
            )

    for item in items:
        amount = float(item.cost or 0)
        if amount <= 0:
            continue

        cost_type = str(item.cost_type or "one_time").lower()
        purchase_dt = item.date_of_purchase or item.created_at
        sale_dt = item.date_of_sale

        if purchase_dt is None:
            continue

        if cost_type == "recurring" and periods:
            for period_start in periods:
                period_end = _period_next(period_start, group_by) - timedelta(microseconds=1)
                if purchase_dt > period_end:
                    continue
                if sale_dt and sale_dt < period_start:
                    continue
                label = _group_label(period_start, group_by)
                recurring_grouped[label] = recurring_grouped.get(label, 0) + amount
                all_labels.add(label)
            continue

        event_dt = purchase_dt
        if start and event_dt < start:
            continue
        if end and event_dt > end:
            continue
        label = _group_label(event_dt, group_by)
        one_time_grouped[label] = one_time_grouped.get(label, 0) + amount
        all_labels.add(label)

    sorted_keys = sorted(all_labels)
    total_data = [round(one_time_grouped.get(k, 0) + recurring_grouped.get(k, 0), 2) for k in sorted_keys]

    return {
        "labels": sorted_keys,
        "data": total_data,
        "datasets": [
            {"label": "Total Expenses", "data": total_data},
            {"label": "One-Time Purchases", "data": [round(one_time_grouped.get(k, 0), 2) for k in sorted_keys]},
            {"label": "Recurring Rentals", "data": [round(recurring_grouped.get(k, 0), 2) for k in sorted_keys]},
        ],
    }


# ─── 12 PORTAL ORDERS REPORT ──────────────────────────────────────────────────

@router.get("/reports/orders")
def get_orders_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("month"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Portal orders analytics: order count and revenue grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(ClientOrder).where(ClientOrder.company_id == current_user.company_id)
    orders = session.exec(stmt).all()

    count_grouped: dict = {}
    revenue_grouped: dict = {}

    for order in orders:
        dt = order.created_at
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue
        if order.status in ("payment_pending", "cancelled", "refunded"):
            continue

        label = _group_label(dt, group_by)
        count_grouped[label] = count_grouped.get(label, 0) + 1
        revenue_grouped[label] = revenue_grouped.get(label, 0) + (order.total or 0)

    sorted_keys = sorted(set(list(count_grouped.keys()) + list(revenue_grouped.keys())))
    return {
        "labels": sorted_keys,
        "datasets": [
            {"label": "Orders", "data": [count_grouped.get(k, 0) for k in sorted_keys]},
            {"label": "Revenue ($)", "data": [round(revenue_grouped.get(k, 0), 2) for k in sorted_keys]},
        ],
    }


# ─── 13 TASKS REPORT ──────────────────────────────────────────────────────────

@router.get("/reports/tasks")
def get_tasks_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    group_by: str = Query("month"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Tasks analytics: completed vs open task counts grouped over time."""
    start = _parse_date(start_date)
    end = _parse_date(end_date, end_of_day=True)

    stmt = select(Task).where(Task.company_id == current_user.company_id)
    tasks = session.exec(stmt).all()

    completed_grouped: dict = {}
    open_grouped: dict = {}

    for task in tasks:
        dt = task.created_at
        if dt is None:
            continue
        if start and dt < start:
            continue
        if end and dt > end:
            continue

        label = _group_label(dt, group_by)
        if task.status == "completed":
            completed_grouped[label] = completed_grouped.get(label, 0) + 1
        else:
            open_grouped[label] = open_grouped.get(label, 0) + 1

    sorted_keys = sorted(set(list(completed_grouped.keys()) + list(open_grouped.keys())))
    return {
        "labels": sorted_keys,
        "datasets": [
            {"label": "Completed", "data": [completed_grouped.get(k, 0) for k in sorted_keys]},
            {"label": "Open", "data": [open_grouped.get(k, 0) for k in sorted_keys]},
        ],
    }


# ─── 14 SAVED REPORT FILTERS ─────────────────────────────────────────────────

from backend.models import SavedReportFilter, SavedReportFilterRead, SavedReportFilterCreate
from typing import List
from uuid import UUID


@router.get("/reports/saved-filters", response_model=List[SavedReportFilterRead])
def get_saved_filters(
    report_id: Optional[str] = Query(None, description="Filter by report type"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all saved report filters for the current user."""
    stmt = select(SavedReportFilter).where(
        SavedReportFilter.user_id == current_user.id,
        SavedReportFilter.company_id == current_user.company_id
    )
    if report_id:
        stmt = stmt.where(SavedReportFilter.report_id == report_id)
    stmt = stmt.order_by(SavedReportFilter.name)
    filters = session.exec(stmt).all()
    return filters


@router.post("/reports/saved-filters", response_model=SavedReportFilterRead)
def create_saved_filter(
    filter_data: SavedReportFilterCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Save a new report filter configuration."""
    new_filter = SavedReportFilter(
        user_id=current_user.id,
        company_id=current_user.company_id,
        **filter_data.model_dump()
    )
    session.add(new_filter)
    session.commit()
    session.refresh(new_filter)
    return new_filter


@router.put("/reports/saved-filters/{filter_id}", response_model=SavedReportFilterRead)
def update_saved_filter(
    filter_id: UUID,
    filter_data: SavedReportFilterCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing saved filter."""
    stmt = select(SavedReportFilter).where(
        SavedReportFilter.id == filter_id,
        SavedReportFilter.user_id == current_user.id,
        SavedReportFilter.company_id == current_user.company_id
    )
    existing = session.exec(stmt).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    
    for field, value in filter_data.model_dump().items():
        setattr(existing, field, value)
    
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return existing


@router.delete("/reports/saved-filters/{filter_id}")
def delete_saved_filter(
    filter_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved filter."""
    stmt = select(SavedReportFilter).where(
        SavedReportFilter.id == filter_id,
        SavedReportFilter.user_id == current_user.id,
        SavedReportFilter.company_id == current_user.company_id
    )
    existing = session.exec(stmt).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    
    session.delete(existing)
    session.commit()
    return {"message": "Filter deleted successfully"}

