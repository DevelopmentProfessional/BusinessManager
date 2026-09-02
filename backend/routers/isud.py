# ============================================================
# FILE: isud.py
#
# PURPOSE:
#   Provides a single generic CRUD router mounted at
#   `/api/v1/isud/{table_name}` that dynamically dispatches Insert,
#   Select, Update, and Delete operations against any SQLModel table
#   without needing a dedicated router per model.  It also hosts
#   inventory-image management endpoints and lightweight sync-check
#   helpers used by the frontend cache layer.
#
# FUNCTIONAL PARTS:
#   [1]  Imports                        — stdlib, third-party, and local imports
#   [2]  Constants                      — UPLOAD_DIR definition and directory creation
#   [3]  Read Schema Map                — READ_SCHEMA_MAP dict mapping table names
#                                         to their Pydantic read schemas
#   [4]  Serialization Helpers          — _serialize_record, _serialize_records
#   [5]  Model Discovery / Mapping      — _MODEL_MAPPING_CACHE, _build_model_mapping,
#                                         get_model_mapping, get_model_class
#   [6]  Router Definition              — APIRouter instantiation
#   [7]  Filter Coercion Helper         — _coerce_filter_value
#   [8]  Insert Endpoints               — POST /{table_name}/insert (multipart/JSON),
#                                         POST /{table_name} (JSON-only)
#   [9]  Update Endpoints               — PUT /{table_name}/{id}, PUT /{table_name}
#  [10]  Special Endpoints              — GET /inventory/locations,
#                                         GET /{table_name}/sync
#  [11]  Select Endpoints (GET)         — GET /{table_name}, GET /{table_name}/{id}
#  [12]  Delete Endpoint                — DELETE /{table_name}/{id}
#  [13]  Inventory Image Management     — POST/GET/PUT/DELETE /inventory/{id}/images/*,
#                                         GET /inventory/images/{id}/file
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-17 | GitHub Copilot | Fixed inventory image upload compatibility with legacy check constraints
#   2026-06-11 | GitHub Copilot | Auto-create default asset unit on ASSET inventory insert; honor provided asset_units when supplied
#   2026-07-25 | GitHub Copilot | Aligned schedule payment update behavior with schedule write access
#   2026-07-26 | GitHub Copilot | Added manager-gated schedule refund initiation endpoint and protected schedule paid-state transitions
#   2026-09-02 | GitHub Copilot | Scoped schedule list reads to own/attended appointments unless view-all access is granted
# ============================================================

# ─── [1] IMPORTS ───────────────────────────────────────────────────────────────
import os
import inspect
import uuid as uuid_module
import jwt as pyjwt
import logging
import smtplib
import ssl
from datetime import datetime
from urllib.parse import urlparse
from typing import Type, Dict, Any, Optional
from uuid import UUID
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, Header
from fastapi.responses import FileResponse, Response
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from sqlmodel import SQLModel, select as sql_select
import stripe

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except ModuleNotFoundError:
    boto3 = None

    class BotoCoreError(Exception):
        pass

    class ClientError(Exception):
        pass

from ..database import get_session
from ..models import *
from .auth import get_current_user, get_current_company_id, get_user_permissions_list

# ─── [2] CONSTANTS ─────────────────────────────────────────────────────────────
# Upload dir for document file cleanup on delete (used when table is "document")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Tables without company_id (system tables, never filter by company)
SYSTEM_TABLES = {"company", "database_connection", "document_blob", "schema_migration"}
logger = logging.getLogger(__name__)


def _render_html_template(template_html: str, variables: dict[str, Any]) -> str:
    html = template_html or ""
    for key, value in variables.items():
        html = html.replace("{{" + key + "}}", str(value if value is not None else ""))
    return html


def _send_sale_receipt_email(session: Session, sale: SaleTransaction) -> bool:
    if not sale.client_id:
        return False

    client = session.get(Client, sale.client_id)
    recipient = (getattr(client, "email", None) or "").strip() if client else ""
    if not recipient:
        return False

    company = session.exec(
        sql_select(Company).where(Company.company_id == (sale.company_id or ""))
    ).first()
    sender_user = session.get(User, sale.employee_id) if sale.employee_id else None
    items = session.exec(
        sql_select(SaleTransactionItem).where(SaleTransactionItem.sale_transaction_id == sale.id)
    ).all()

    receipt_templates = session.exec(
        sql_select(DocumentTemplate)
        .where(DocumentTemplate.is_active == True)
        .where(DocumentTemplate.template_type == "receipt")
        .where(
            or_(
                DocumentTemplate.company_id == (sale.company_id or ""),
                DocumentTemplate.is_standard == True,
            )
        )
        .order_by(DocumentTemplate.updated_at.desc())
    ).all()

    selected_template = None
    for tpl in receipt_templates:
        if not getattr(tpl, "is_standard", False):
            selected_template = tpl
            break
    if selected_template is None and receipt_templates:
        selected_template = receipt_templates[0]

    company_name = (getattr(company, "name", None) or "BusinessManager").strip()
    company_email = (getattr(company, "company_email", None) or "").strip()
    company_phone = (getattr(company, "company_phone", None) or "").strip()
    client_name = (getattr(client, "name", None) or "Client").strip()
    invoice_date = (sale.created_at or datetime.utcnow()).strftime("%Y-%m-%d %H:%M")

    item_rows = "".join(
        [
            f"<tr><td>{(it.item_name or '')}</td><td style='text-align:right'>{int(it.quantity or 1)}</td><td style='text-align:right'>${float(it.unit_price or 0):.2f}</td><td style='text-align:right'>${float(it.line_total or 0):.2f}</td></tr>"
            for it in items
        ]
    )
    if not item_rows:
        item_rows = "<tr><td colspan='4'>No line items recorded.</td></tr>"

    items_table = (
        "<table style='width:100%;border-collapse:collapse' border='1' cellpadding='6'>"
        "<thead><tr><th align='left'>Item</th><th align='right'>Qty</th><th align='right'>Unit</th><th align='right'>Total</th></tr></thead>"
        f"<tbody>{item_rows}</tbody></table>"
    )

    variables = {
        "invoice.date": invoice_date,
        "invoice.number": str(sale.id),
        "invoice.items": items_table,
        "invoice.subtotal": f"${float(sale.subtotal or 0):.2f}",
        "invoice.tax": f"${float(sale.tax_amount or 0):.2f}",
        "invoice.total": f"${float(sale.total or 0):.2f}",
        "invoice.payment_method": str(sale.payment_method or "card").replace("_", " ").title(),
        "client.name": client_name,
        "client.email": recipient,
        "company.name": company_name,
        "company.email": company_email,
        "company.phone": company_phone,
        "sender.first_name": getattr(sender_user, "first_name", "") if sender_user else "",
        "sender.last_name": getattr(sender_user, "last_name", "") if sender_user else "",
    }

    default_html = (
        f"<p>Hi {client_name},</p>"
        f"<p>Your payment has been confirmed for sale <strong>{sale.id}</strong>.</p>"
        f"{items_table}"
        f"<p><strong>Total Paid:</strong> ${float(sale.total or 0):.2f}</p>"
        f"<p>Thank you,<br>{company_name}</p>"
    )
    html_body = _render_html_template(getattr(selected_template, "content", "") or default_html, variables)
    text_body = (
        f"Hi {client_name},\n\n"
        f"Your payment has been confirmed for sale {sale.id}.\n"
        f"Total paid: ${float(sale.total or 0):.2f}\n\n"
        f"Thank you,\n{company_name}"
    )
    subject = f"Payment receipt from {company_name}"

    ses_sender = (
        (os.getenv("AWS_SES_FROM_EMAIL") or "").strip()
        or (os.getenv("SMTP_FROM_EMAIL") or "").strip()
        or "no-reply@vadpivi.com"
    )
    ses_region = (os.getenv("AWS_SES_REGION") or os.getenv("AWS_REGION") or "us-east-1").strip()

    if boto3 is not None and ses_sender:
        try:
            client_ses = boto3.client("sesv2", region_name=ses_region)
            client_ses.send_email(
                FromEmailAddress=ses_sender,
                Destination={"ToAddresses": [recipient]},
                Content={
                    "Simple": {
                        "Subject": {"Data": subject},
                        "Body": {
                            "Text": {"Data": text_body},
                            "Html": {"Data": html_body},
                        },
                    }
                },
            )
            return True
        except (BotoCoreError, ClientError, Exception):
            logger.exception("Failed to send POS receipt via SES")

    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    if not smtp_host:
        return False

    sender = (
        (os.getenv("SMTP_FROM_EMAIL") or "").strip()
        or (os.getenv("SMTP_USERNAME") or "").strip()
        or ses_sender
    )
    smtp_port = int((os.getenv("SMTP_PORT") or "587").strip())
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD") or ""
    use_ssl = (os.getenv("SMTP_USE_SSL") or "").strip().lower() in {"1", "true", "yes", "on"}
    use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in {"1", "true", "yes", "on"}

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send POS receipt via SMTP")
        return False


def _sale_is_paid(session: Session, sale_transaction_id) -> bool:
    sale = session.get(SaleTransaction, sale_transaction_id)
    return bool(getattr(sale, "paid_at", None)) if sale else False


def _consume_sale_transaction_inventory(session: Session, sale_transaction_id) -> None:
    sale = session.get(SaleTransaction, sale_transaction_id)
    if not sale or getattr(sale, "inventory_consumed_at", None):
        return

    items = session.exec(
        sql_select(SaleTransactionItem).where(SaleTransactionItem.sale_transaction_id == sale_transaction_id)
    ).all()

    for sale_item in items:
        item_type = getattr(sale_item, "item_type", None)
        item_id = getattr(sale_item, "item_id", None)
        qty_sold = getattr(sale_item, "quantity", 1) or 1

        def _consume_resources(product_id, units_sold: float):
            try:
                res_links = session.exec(
                    sql_select(ProductResource).where(ProductResource.inventory_id == product_id)
                ).all()
                for pr in res_links:
                    res_inv = session.get(Inventory, pr.resource_id)
                    if res_inv is not None:
                        res_inv.quantity = max(0, (res_inv.quantity or 0) - (pr.quantity_per_batch * units_sold))
                        session.add(res_inv)
            except Exception as e:
                print(f"Warning: resource consumption failed for product {product_id}: {e}")

        if item_type == 'product' and item_id:
            try:
                inv = session.get(Inventory, item_id)
                if inv is not None:
                    inv.quantity = max(0, inv.quantity - qty_sold)
                    session.add(inv)
                _consume_resources(item_id, qty_sold)
            except Exception as e:
                print(f"Warning: stock decrement failed for inventory {item_id}: {e}")

        elif item_type == 'mix' and item_id:
            try:
                import json as _json
                raw = getattr(sale_item, 'mix_selections', None)
                selections = _json.loads(raw) if raw else []
                for sel in selections:
                    pid = sel.get('product_id')
                    qty = int(sel.get('quantity', 0)) * qty_sold
                    if pid and qty > 0:
                        comp_inv = session.get(Inventory, pid)
                        if comp_inv is not None:
                            comp_inv.quantity = max(0, comp_inv.quantity - qty)
                            session.add(comp_inv)
                        _consume_resources(pid, qty)
            except Exception as e:
                print(f"Warning: mix stock decrement failed for mix {item_id}: {e}")

        elif item_type == 'bundle' and item_id:
            try:
                components = session.exec(
                    sql_select(BundleComponent).where(BundleComponent.bundle_id == item_id)
                ).all()
                for comp in components:
                    comp_inv = session.get(Inventory, comp.component_id)
                    if comp_inv is not None and (comp_inv.type or '').lower() == 'product':
                        units = comp.quantity * qty_sold
                        comp_inv.quantity = max(0, comp_inv.quantity - units)
                        session.add(comp_inv)
                        _consume_resources(comp.component_id, units)
            except Exception as e:
                print(f"Warning: bundle stock decrement failed for bundle {item_id}: {e}")

    sale.inventory_consumed_at = datetime.utcnow()
    session.add(sale)


def _get_company_stripe_settings(session: Session, company_id: str | None) -> dict:
    if not company_id:
        return {
            "enabled": False,
            "mode": "test",
            "secret_key": None,
            "webhook_secret": None,
            "webhook_secrets": [],
        }

    settings = session.exec(
        sql_select(AppSettings).where(AppSettings.company_id == company_id)
    ).first()

    mode = str(getattr(settings, "stripe_mode", "test") or "test").strip().lower() if settings else "test"
    mode = "live" if mode == "live" else "test"

    def _clean(value: Any) -> str:
        return (str(value).strip() if value is not None else "")

    legacy_secret = _clean(getattr(settings, "stripe_secret_key", None)) if settings else ""
    legacy_webhook = _clean(getattr(settings, "stripe_webhook_secret", None)) if settings else ""
    test_secret = _clean(getattr(settings, "stripe_test_secret_key", None)) if settings else ""
    live_secret = _clean(getattr(settings, "stripe_live_secret_key", None)) if settings else ""
    test_webhook = _clean(getattr(settings, "stripe_test_webhook_secret", None)) if settings else ""
    live_webhook = _clean(getattr(settings, "stripe_live_webhook_secret", None)) if settings else ""
    has_env_specific = any([test_secret, live_secret, test_webhook, live_webhook])

    active_secret = live_secret if mode == "live" else test_secret
    if not active_secret and not has_env_specific:
        active_secret = legacy_secret

    active_webhook = live_webhook if mode == "live" else test_webhook
    if not active_webhook and not has_env_specific:
        active_webhook = legacy_webhook

    webhook_secrets = [s for s in [active_webhook, test_webhook, live_webhook, legacy_webhook] if s]

    return {
        "enabled": bool(getattr(settings, "stripe_enabled", False)) if settings else False,
        "mode": mode,
        "secret_key": active_secret or None,
        "webhook_secret": active_webhook or None,
        "webhook_secrets": list(dict.fromkeys(webhook_secrets)),
    }


def _resolve_stripe_checkout_base_url(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip()
    if origin:
        return origin.rstrip("/")

    referer = (request.headers.get("referer") or "").strip()
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"

    return os.getenv("CLIENT_PORTAL_URL", "https://clients.vadpivi.com").rstrip("/")


def _create_sale_checkout_session(record: SQLModel, request: Request, session: Session) -> tuple[str, str | None]:
    stripe_cfg = _get_company_stripe_settings(session, getattr(record, "company_id", None))
    if not stripe_cfg["enabled"] or not stripe_cfg["secret_key"]:
        return "", None

    stripe.api_key = stripe_cfg["secret_key"]
    base_url = _resolve_stripe_checkout_base_url(request)
    payment_method = str(getattr(record, "payment_method", "") or "").strip().lower()

    # Only card/tap-to-pay paths use Stripe; cash remains fully offline.
    if payment_method not in {"card", "card_scan", "tap_pay", "tap_to_pay"}:
        return "", None

    amount = max(0.5, float(getattr(record, "total", 0) or 0))
    sale_id = str(getattr(record, "id", ""))
    company_id = str(getattr(record, "company_id", "") or "")

    session_obj = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Sale {sale_id[:8] or ''}".strip()},
                    "unit_amount": int(round(amount * 100)),
                },
                "quantity": 1,
            }
        ],
        client_reference_id=sale_id,
        metadata={
            "sale_transaction_id": sale_id,
            "company_id": company_id,
        },
        success_url=f"{base_url}/sales?payment=success&sale_id={sale_id}&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/sales?payment=cancelled&sale_id={sale_id}",
    )
    return session_obj.get("url") or "", session_obj.get("id")


def _construct_stripe_event(payload: bytes, stripe_signature: str | None, session: Session):
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature header.")

    secrets: list[str] = []
    settings_rows = session.exec(sql_select(AppSettings)).all()
    for row in settings_rows:
        mode = str(getattr(row, "stripe_mode", "test") or "test").strip().lower()
        mode = "live" if mode == "live" else "test"
        candidates = [
            (getattr(row, "stripe_live_webhook_secret", None) or "").strip(),
            (getattr(row, "stripe_test_webhook_secret", None) or "").strip(),
            (getattr(row, "stripe_webhook_secret", None) or "").strip(),
        ]
        if mode == "live":
            candidates = [candidates[0], candidates[2], candidates[1]]
        else:
            candidates = [candidates[1], candidates[2], candidates[0]]

        for secret in candidates:
            if secret and secret not in secrets:
                secrets.append(secret)

    env_secret = (os.getenv("STRIPE_WEBHOOK_SECRET", "") or "").strip()
    if env_secret and env_secret not in secrets:
        secrets.append(env_secret)

    for secret in secrets:
        try:
            return stripe.Webhook.construct_event(payload, stripe_signature, secret)
        except stripe.SignatureVerificationError:
            continue
        except Exception:
            continue

    raise HTTPException(status_code=400, detail="Invalid webhook signature.")


def _normalize_inventory_cost_fields(record_data: Dict[str, Any], apply_default_purchase_date: bool = False) -> None:
    """Normalize inventory cost fields so reports can rely on consistent semantics."""
    raw_cost_type = str(record_data.get("cost_type") or "one_time").strip().lower()
    record_data["cost_type"] = "recurring" if raw_cost_type in {"recurring", "rental", "rent", "lease", "monthly"} else "one_time"

    if apply_default_purchase_date and not record_data.get("date_of_purchase"):
        record_data["date_of_purchase"] = datetime.utcnow()


def _normalize_asset_units_payload(asset_units: Any) -> list[Dict[str, Any]]:
    """Normalize optional asset_units payload for inventory creation."""
    if asset_units is None:
        return []
    if not isinstance(asset_units, list):
        raise HTTPException(status_code=400, detail="asset_units must be an array")

    normalized: list[Dict[str, Any]] = []
    for i, unit in enumerate(asset_units):
        if not isinstance(unit, dict):
            raise HTTPException(status_code=400, detail=f"asset_units[{i}] must be an object")

        state = str(unit.get("state") or "available").strip().lower()
        if state not in ASSET_UNIT_STATES:
            raise HTTPException(status_code=400, detail=f"asset_units[{i}].state must be one of: {sorted(ASSET_UNIT_STATES)}")

        employee_id = unit.get("employee_id")
        if isinstance(employee_id, str):
            employee_id = employee_id.strip() or None
            if employee_id:
                try:
                    employee_id = UUID(employee_id)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"asset_units[{i}].employee_id must be a valid UUID")
        elif employee_id is not None and not isinstance(employee_id, UUID):
            raise HTTPException(status_code=400, detail=f"asset_units[{i}].employee_id must be a valid UUID")

        normalized.append({
            "label": unit.get("label") or None,
            "employee_id": employee_id,
            "state": state,
            "notes": unit.get("notes") or None,
        })

    return normalized


def _validate_asset_unit_employee_assignment(session: Session, employee_id: Optional[UUID], company_id: str) -> None:
    if employee_id is None:
        return
    employee = session.get(User, employee_id)
    if not employee or employee.company_id != company_id:
        raise HTTPException(status_code=400, detail="Assigned employee is invalid for this company")


def _create_initial_asset_units_for_inventory(
    session: Session,
    inventory_record: Inventory,
    company_id: str,
    provided_units: Any,
) -> None:
    """Create supplied units, or one default unit, for newly created ASSET items."""
    units = _normalize_asset_units_payload(provided_units)
    if not units:
        units = [{"label": "Unit 1", "employee_id": None, "state": "available", "notes": None}]

    for unit in units:
        _validate_asset_unit_employee_assignment(session, unit["employee_id"], company_id)
        session.add(
            AssetUnit(
                inventory_id=inventory_record.id,
                label=unit["label"],
                employee_id=unit["employee_id"],
                state=unit["state"],
                notes=unit["notes"],
                company_id=company_id,
            )
        )

    # Quantity for ASSET should reflect number of concrete units.
    inventory_record.quantity = len(units)
    session.add(inventory_record)


def _resolve_permission_pages(table_name: str) -> set[str]:
    """Return candidate permission page names for a table endpoint."""
    base = (table_name or "").strip().lower()
    pages = {base}
    if base.endswith("s"):
        pages.add(base[:-1])
    else:
        pages.add(f"{base}s")
    if base in {"user", "users"}:
        pages.add("employees")
    if base in {"leave_request", "leave_requests"}:
        pages.add("leave")
    if base in {"sale_transaction", "sale_transactions", "sale_transaction_item", "sale_transaction_items", "discount_rule", "discount_rules"}:
        pages.add("sales")
    if base in {"membership", "memberships", "client_membership", "client_memberships"}:
        pages.add("clients")
        pages.add("sales")
    if base in {"document_template", "document_templates"}:
        pages.add("templates")
        pages.add("documents")
    if base in {"insurance_plan", "insurance_plans"}:
        pages.add("insurance")
        pages.add("employees")
    if base in {"app_settings", "settings"}:
        pages.add("settings")
    return {p for p in pages if p}


def _require_isud_permission(
    current_user: User,
    session: Session,
    table_name: str,
    action: str,
) -> None:
    """Require page permission for non-admin users on generic ISUD endpoints."""
    if current_user.role == UserRole.ADMIN:
        return

    permissions = set(get_user_permissions_list(current_user, session))
    for page in _resolve_permission_pages(table_name):
        if f"{page}:{action}" in permissions or f"{page}:admin" in permissions:
            return
        if action == "write" and page == "schedule" and f"{page}:write_self_only" in permissions:
            return
        # write/write_all/delete implies read
        if action == "read" and any(
            f"{page}:{p}" in permissions for p in ("write", "write_self_only", "write_all", "delete")
        ):
            return

    raise HTTPException(status_code=403, detail=f"Missing permission: {table_name}:{action}")

def _resolve_document_path(file_path: str, upload_dir: str) -> str:
    """Resolve path for a document file (stored path or upload_dir + basename)."""
    if not file_path:
        return ""
    if os.path.isabs(file_path) and os.path.exists(file_path):
        return file_path
    fallback = os.path.join(upload_dir, os.path.basename(file_path))
    if os.path.exists(fallback):
        return fallback
    return file_path

# ─── [3] READ SCHEMA MAP (CONSTANTS) ──────────────────────────────────────────
# Mapping of table names to their safe Read schemas (to avoid relationship serialization issues)
READ_SCHEMA_MAP = {
    'client': ClientRead,
    'clients': ClientRead,
    'membership': MembershipRead,
    'memberships': MembershipRead,
    'client_membership': ClientMembershipRead,
    'client_memberships': ClientMembershipRead,
    'inventory': InventoryRead,
    'service': ServiceRead,
    'services': ServiceRead,
    'user': UserRead,
    'users': UserRead,
    'schedule': ScheduleRead,
    'schedules': ScheduleRead,
    'schedule_attendee': ScheduleAttendeeRead,
    'schedule_attendees': ScheduleAttendeeRead,
    'document': DocumentRead,
    'documents': DocumentRead,
    'role': RoleRead,
    'roles': RoleRead,
    'role_permission': RolePermissionRead,
    'role_permissions': RolePermissionRead,
    'user_permission': UserPermissionRead,
    'user_permissions': UserPermissionRead,
    'app_settings': AppSettingsRead,
    'inventory_image': InventoryImageRead,
    'inventory_images': InventoryImageRead,
    'database_connection': DatabaseConnectionRead,
    'database_connections': DatabaseConnectionRead,
    'department': DepartmentRead,
    'departments': DepartmentRead,
    'supplier': SupplierRead,
    'suppliers': SupplierRead,
    'attendance': AttendanceRead,
    'insurance_plan': InsurancePlanRead,
    'insurance_plans': InsurancePlanRead,
    'leave_request': LeaveRequestRead,
    'leave_requests': LeaveRequestRead,
    'onboarding_request': OnboardingRequestRead,
    'onboarding_requests': OnboardingRequestRead,
    'offboarding_request': OffboardingRequestRead,
    'offboarding_requests': OffboardingRequestRead,
    'sale_transaction': SaleTransactionRead,
    'sale_transactions': SaleTransactionRead,
    'sale_transaction_item': SaleTransactionItemRead,
    'sale_transaction_items': SaleTransactionItemRead,
    'service_resource': ServiceResourceRead,
    'service_resources': ServiceResourceRead,
    'service_asset': ServiceAssetRead,
    'service_assets': ServiceAssetRead,
    'service_employee': ServiceEmployeeRead,
    'service_employees': ServiceEmployeeRead,
    'service_location': ServiceLocationRead,
    'service_locations': ServiceLocationRead,
    'service_recipe': ServiceRecipeRead,
    'service_recipes': ServiceRecipeRead,
    'product_resource': ProductResourceRead,
    'product_resources': ProductResourceRead,
    'product_asset': ProductAssetRead,
    'product_assets': ProductAssetRead,
    'product_location': ProductLocationRead,
    'product_locations': ProductLocationRead,
    'bundle_component': BundleComponentRead,
    'bundle_components': BundleComponentRead,
    'mix_config': MixConfigRead,
    'mix_component': MixComponentRead,
    'mix_components': MixComponentRead,
    'discount_rule': DiscountRuleRead,
    'discount_rules': DiscountRuleRead,
    'client_order': ClientOrderRead,
    'client_orders': ClientOrderRead,
    'client_order_item': ClientOrderItemRead,
    'client_order_items': ClientOrderItemRead,
}

# ─── [4] SERIALIZATION HELPERS ────────────────────────────────────────────────
def _client_membership_payload(record, client_memberships, membership_lookup):
    """Build membership_ids/names for one client from preloaded link rows."""
    selected_ids = []
    selected_names = []
    for link in client_memberships:
        selected_ids.append(link.membership_id)
        membership = membership_lookup.get(link.membership_id)
        if membership:
            selected_names.append(membership.name)
    return selected_ids, selected_names


def _serialize_clients_batch(records, session):
    """
    Serialize many clients with batched membership lookups.
    Avoids N+1 queries (per-client membership reload was timing out list GET /isud/clients).
    """
    if not records:
        return []

    read_schema = READ_SCHEMA_MAP.get("clients")
    if not read_schema:
        return [_serialize_record(record, "clients", session) for record in records]

    client_ids = [record.id for record in records]
    company_id = getattr(records[0], "company_id", None)

    cm_stmt = sql_select(ClientMembership).where(ClientMembership.client_id.in_(client_ids))
    memberships_stmt = sql_select(Membership)
    if company_id:
        cm_stmt = cm_stmt.where(ClientMembership.company_id == company_id)
        memberships_stmt = memberships_stmt.where(Membership.company_id == company_id)

    all_links = session.exec(cm_stmt).all()
    membership_rows = session.exec(memberships_stmt).all()
    membership_lookup = {m.id: m for m in membership_rows}

    links_by_client: Dict[UUID, list] = {}
    for link in all_links:
        links_by_client.setdefault(link.client_id, []).append(link)

    results = []
    for record in records:
        try:
            record_dict = record.model_dump() if hasattr(record, "model_dump") else record.__dict__.copy()
            selected_ids, selected_names = _client_membership_payload(
                record, links_by_client.get(record.id, []), membership_lookup
            )
            record_dict["membership_ids"] = selected_ids
            record_dict["membership_names"] = selected_names
            validated = read_schema.model_validate(record_dict)
            if hasattr(validated, "model_dump"):
                results.append(validated.model_dump(mode="json"))
            else:
                results.append(validated)
        except Exception as e:
            print(f"Warning: Failed to serialize client {getattr(record, 'id', 'unknown')}: {e}")
            results.append(_serialize_record(record, "clients", session))
    return results


def _serialize_record(record, table_name: str, session=None):
    """Serialize a record using the appropriate Read schema if available."""
    if record is None:
        return None
        
    read_schema = READ_SCHEMA_MAP.get(table_name.lower())
    if read_schema:
        if table_name.lower() in ['client', 'clients'] and session:
            try:
                record_dict = record.model_dump() if hasattr(record, 'model_dump') else record.__dict__.copy()
                cm_stmt = sql_select(ClientMembership).where(ClientMembership.client_id == record.id)
                if getattr(record, 'company_id', None):
                    cm_stmt = cm_stmt.where(ClientMembership.company_id == record.company_id)
                client_memberships = session.exec(cm_stmt).all()

                memberships_stmt = sql_select(Membership)
                if getattr(record, 'company_id', None):
                    memberships_stmt = memberships_stmt.where(Membership.company_id == record.company_id)
                membership_lookup = {m.id: m for m in session.exec(memberships_stmt).all()}

                selected_ids, selected_names = _client_membership_payload(
                    record, client_memberships, membership_lookup
                )
                record_dict['membership_ids'] = selected_ids
                record_dict['membership_names'] = selected_names

                validated = read_schema.model_validate(record_dict)
                if hasattr(validated, 'model_dump'):
                    return validated.model_dump(mode='json')
                return validated
            except Exception as e:
                print(f"Warning: Failed to include client memberships for client {getattr(record, 'id', 'unknown')}: {e}")

        # Special handling for inventory to include images
        if table_name.lower() in ['inventory'] and session:
            try:
                # Load images for this inventory item
                images_stmt = sql_select(InventoryImage).where(
                    InventoryImage.inventory_id == record.id
                ).order_by(InventoryImage.sort_order)
                images = session.exec(images_stmt).all()

                # Convert record to dict and add images
                record_dict = record.model_dump() if hasattr(record, 'model_dump') else record.__dict__.copy()
                record_dict['images'] = [
                    _image_to_read(img).model_dump(mode='json')
                    for img in images
                ]

                # Resolve supplier name from the FK
                if record.supplier_id:
                    supplier = session.get(Supplier, record.supplier_id)
                    record_dict['supplier_name'] = supplier.name if supplier else None
                else:
                    record_dict['supplier_name'] = None

                # Create and return the read schema instance
                validated = read_schema.model_validate(record_dict)
                if hasattr(validated, 'model_dump'):
                    return validated.model_dump(mode='json')
                return validated
            except Exception as e:
                # Fallback to basic serialization if image loading fails
                print(f"Warning: Failed to load images for inventory {record.id}: {e}")
        
        # Use from_orm_safe if available (for custom conversion logic)
        if hasattr(read_schema, 'from_orm_safe'):
            result = read_schema.from_orm_safe(record)
            # Convert to dict if it's a SQLModel instance
            if hasattr(result, 'model_dump'):
                return result.model_dump(mode='json')
            return result
        # Otherwise use model_validate with from_attributes
        try:
            validated = read_schema.model_validate(record)
            # CRITICAL: Convert to dict so all fields are included and relationships excluded
            if hasattr(validated, 'model_dump'):
                return validated.model_dump(mode='json')
            return validated
        except Exception as e:
            # Fallback: use model_dump directly with relationship exclusion
            if hasattr(record, 'model_dump'):
                return record.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'})
            raise
    
    # No schema - use model_dump directly with relationship exclusion
    if hasattr(record, 'model_dump'):
        return record.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'})
    return record

def _serialize_records(records, table_name: str, session=None):
    """Serialize multiple records using the appropriate Read schema."""
    if not records:
        return []

    if table_name.lower() in ("client", "clients") and session:
        return _serialize_clients_batch(records, session)

    # Special handling for inventory to include images
    if table_name.lower() in ['inventory'] and session:
        return [_serialize_record(record, table_name, session) for record in records]
        
    read_schema = READ_SCHEMA_MAP.get(table_name.lower())
    if read_schema:
        if hasattr(read_schema, 'from_orm_safe'):
            results = [read_schema.from_orm_safe(r) for r in records]
            return [(r.model_dump(mode='json') if hasattr(r, 'model_dump') else r) for r in results]
        try:
            validated_list = [read_schema.model_validate(r) for r in records]
            return [(v.model_dump(mode='json') if hasattr(v, 'model_dump') else v) for v in validated_list]
        except Exception:
            return [(r.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'}) if hasattr(r, 'model_dump') else r) for r in records]
    
    # No schema - use model_dump directly with relationship exclusion
    return [(r.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'}) if hasattr(r, 'model_dump') else r) for r in records]

# ─── [5] MODEL DISCOVERY / MAPPING HELPERS ────────────────────────────────────
# In-memory cache for model mapping
_MODEL_MAPPING_CACHE: Optional[Dict[str, Type[SQLModel]]] = None

def _build_model_mapping() -> Dict[str, Type[SQLModel]]:
    """Dynamically discover all SQLModel table classes from models module."""
    mapping = {}
    
    # Get all classes from the models module
    models_module = __import__('backend.models', fromlist=[''])
    
    for name, obj in inspect.getmembers(models_module, inspect.isclass):
        # Check if it's a SQLModel subclass with table=True
        if (issubclass(obj, SQLModel) and 
            obj != SQLModel and 
            obj != BaseModel and
            hasattr(obj, '__table__') and 
            obj.__table__ is not None):
            
            # Use the actual table name from SQLModel metadata
            table_name = obj.__table__.name.lower()
            mapping[table_name] = obj
            
            # Also add pluralized version for convenience (e.g., "user" -> "users")
            # Simple pluralization for common cases
            if not table_name.endswith('s'):
                plural_name = table_name + 's'
                if plural_name not in mapping:  # Don't override if already exists
                    mapping[plural_name] = obj
    
    return mapping

def get_model_mapping() -> Dict[str, Type[SQLModel]]:
    """Get model mapping, building it dynamically if not cached."""
    global _MODEL_MAPPING_CACHE
    if _MODEL_MAPPING_CACHE is None:
        _MODEL_MAPPING_CACHE = _build_model_mapping()
    return _MODEL_MAPPING_CACHE

def get_model_class(table_name: str) -> Type[SQLModel]:
    """Get model class for a table name, raising error if not found."""
    mapping = get_model_mapping()
    if table_name not in mapping:
        raise HTTPException(
            status_code=404, 
            detail=f"Table '{table_name}' not found. Available tables: {list(mapping.keys())}"
        )
    return mapping[table_name]


def _sync_client_memberships(
    session: Session,
    client_id: UUID,
    membership_ids: Optional[list[UUID]],
    company_id: Optional[str],
) -> None:
    if membership_ids is None:
        return

    requested_ids = set(membership_ids)
    existing_stmt = sql_select(ClientMembership).where(ClientMembership.client_id == client_id)
    if company_id:
        existing_stmt = existing_stmt.where(ClientMembership.company_id == company_id)
    existing_links = session.exec(existing_stmt).all()
    existing_ids = {link.membership_id for link in existing_links}

    to_remove = [link for link in existing_links if link.membership_id not in requested_ids]
    for link in to_remove:
        session.delete(link)

    to_add_ids = [mid for mid in requested_ids if mid not in existing_ids]
    if to_add_ids:
        valid_membership_stmt = sql_select(Membership).where(Membership.id.in_(to_add_ids))
        if company_id:
            valid_membership_stmt = valid_membership_stmt.where(Membership.company_id == company_id)
        valid_memberships = session.exec(valid_membership_stmt).all()
        valid_ids = {m.id for m in valid_memberships}

        for membership_id in to_add_ids:
            if membership_id in valid_ids:
                session.add(
                    ClientMembership(
                        client_id=client_id,
                        membership_id=membership_id,
                        company_id=company_id,
                    )
                )

# ─── [6] ROUTER DEFINITION ────────────────────────────────────────────────────
router = APIRouter()

# ─── [7] FILTER COERCION HELPER ───────────────────────────────────────────────
def _coerce_filter_value(model_class: Type[SQLModel], column: str, raw_value: str) -> Any:
    field_info = model_class.model_fields.get(column)
    if field_info is None:
        return raw_value

    annotation = field_info.annotation

    if annotation is UUID:
        return UUID(raw_value)
    if annotation is int:
        return int(raw_value)
    if annotation is float:
        return float(raw_value)
    if annotation is bool:
        lowered = raw_value.lower()
        if lowered in {"true", "1", "yes", "y", "t"}:
            return True
        if lowered in {"false", "0", "no", "n", "f"}:
            return False
        return bool(raw_value)

    return raw_value


def _can_view_all_schedules(current_user: User, session: Session) -> bool:
    if current_user.role == UserRole.ADMIN:
        return True

    permissions = set(get_user_permissions_list(current_user, session))
    return any(
        permission in permissions
        for permission in ("schedule:view_all", "schedule:write_all", "schedule:admin")
    )


def _apply_schedule_visibility_scope(stmt, current_user: User, session: Session):
    if _can_view_all_schedules(current_user, session):
        return stmt

    attended_schedule_ids = sql_select(ScheduleAttendee.schedule_id).where(
        ScheduleAttendee.user_id == current_user.id
    )
    if current_user.company_id:
        attended_schedule_ids = attended_schedule_ids.where(
            ScheduleAttendee.company_id == current_user.company_id
        )

    return stmt.where(
        or_(
            Schedule.employee_id == current_user.id,
            Schedule.id.in_(attended_schedule_ids),
        )
    )

# ─── [8] INSERT ENDPOINTS ──────────────────────────────────────────────────────
@router.post("/{table_name}/insert")
async def insert_with_file(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Flexible insert endpoint that handles both JSON and multipart/form-data.
    When a file is included (for document uploads), it processes the file and
    extracts form fields. Otherwise, it parses JSON body.
    """
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")
    record_data: Dict[str, Any] = {}

    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        # Handle multipart form data (file uploads)
        form = await request.form()
        uploaded_file: Optional[StarletteUploadFile] = None

        # Extract all form fields
        for key, value in form.items():
            if isinstance(value, StarletteUploadFile):
                # Store the file for processing
                if key == "file":
                    uploaded_file = value
            else:
                # Convert empty strings to None for optional fields
                if value == "" or value == "null" or value == "undefined":
                    record_data[key] = None
                else:
                    record_data[key] = value

        # Handle file upload for document table
        if uploaded_file and table_name.lower() in ("document", "documents"):
            # Generate unique filename
            file_ext = os.path.splitext(uploaded_file.filename or "")[1]
            unique_filename = f"{uuid_module.uuid4()}{file_ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            # Read file contents
            contents = await uploaded_file.read()

            # Save file to disk (best-effort; DB blob is the authoritative copy)
            try:
                with open(file_path, "wb") as f:
                    f.write(contents)
            except OSError:
                file_path = unique_filename  # disk save failed; store filename only

            # Add file metadata to record
            record_data["filename"] = unique_filename
            record_data["original_filename"] = uploaded_file.filename or "unknown"
            record_data["file_path"] = file_path
            record_data["file_size"] = len(contents)
            record_data["content_type"] = uploaded_file.content_type or "application/octet-stream"

            # Store raw bytes for later (saved to DocumentBlob after commit)
            _file_bytes = contents
        else:
            _file_bytes = None
    else:
        # Handle JSON body
        try:
            record_data = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request body")
        _file_bytes = None

    is_inventory_table = table_name.lower() in ('inventory', 'item', 'items')
    asset_units_payload = record_data.pop('asset_units', None) if is_inventory_table else None

    # Special handling for user table: hash plain password into password_hash
    if table_name.lower() in ('user', 'users') and 'password' in record_data:
        plain_password = record_data.pop('password')
        if plain_password:
            record_data['password_hash'] = User.hash_password(plain_password)

    # Auto-inject company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        record_data['company_id'] = current_user.company_id or ""

    try:
        record = model_class(**record_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")

    session.add(record)
    try:
        session.flush()
        if is_inventory_table and str(getattr(record, 'type', '') or '').upper() == 'ASSET':
            _create_initial_asset_units_for_inventory(session, record, current_user.company_id or "", asset_units_payload)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    session.refresh(record)

    # Serialize response BEFORE blob save (blob save may corrupt session state)
    result = _serialize_record(record, table_name, session)

    # Save file data to DocumentBlob table (separate from document metadata)
    if _file_bytes is not None:
        try:
            blob = DocumentBlob(document_id=record.id, data=_file_bytes)
            session.add(blob)
            session.commit()
        except Exception:
            session.rollback()

    return result


@router.post("/sale_transaction/webhooks/stripe", include_in_schema=False)
async def sale_transaction_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    session: Session = Depends(get_session),
):
    payload = await request.body()

    try:
        event = _construct_stripe_event(payload, stripe_signature, session)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook parse error.")

    payload_obj = event["data"]["object"]
    metadata = payload_obj.get("metadata", {}) if isinstance(payload_obj, dict) else {}
    sale_id = metadata.get("sale_transaction_id") or payload_obj.get("client_reference_id")
    if not sale_id:
        return {"received": True}

    try:
        sale_uuid = UUID(str(sale_id))
    except (TypeError, ValueError):
        return {"received": True}

    sale = session.get(SaleTransaction, sale_uuid)
    if not sale:
        return {"received": True}

    if event["type"] in {"checkout.session.completed", "payment_intent.succeeded"}:
        sale.paid_at = sale.paid_at or datetime.utcnow()
        if event["type"] == "checkout.session.completed":
            sale.stripe_checkout_session_id = payload_obj.get("id") or sale.stripe_checkout_session_id
            sale.stripe_payment_intent_id = payload_obj.get("payment_intent") or sale.stripe_payment_intent_id
        else:
            sale.stripe_payment_intent_id = payload_obj.get("id") or sale.stripe_payment_intent_id
            sale.stripe_charge_id = payload_obj.get("latest_charge") or sale.stripe_charge_id
        if getattr(sale, "schedule_id", None):
            schedule = session.get(Schedule, sale.schedule_id)
            if schedule is not None:
                schedule.is_paid = True
                schedule.sale_transaction_id = sale.id
        if not getattr(sale, "receipt_emailed_at", None):
            if _send_sale_receipt_email(session, sale):
                sale.receipt_emailed_at = datetime.utcnow()
        try:
            _consume_sale_transaction_inventory(session, sale_uuid)
            session.add(sale)
            session.commit()
        except Exception:
            session.rollback()
            raise HTTPException(status_code=500, detail="Failed to persist sale payment status.")

    return {"received": True}


@router.post("/schedules/{schedule_id}/initiate-refund")
async def initiate_schedule_refund(
    schedule_id: UUID,
    payload: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Initiate an appointment refund and unlock paid state with elevated permission."""
    permissions = set(get_user_permissions_list(current_user, session))
    has_refund_access = (
        current_user.role == UserRole.ADMIN
        or "schedule:initiate_refunds" in permissions
        or "schedule:admin" in permissions
    )
    if not has_refund_access:
        raise HTTPException(status_code=403, detail="Missing permission: schedule:initiate_refunds")

    schedule_stmt = sql_select(Schedule).where(Schedule.id == schedule_id)
    if hasattr(Schedule, "company_id"):
        schedule_stmt = schedule_stmt.where(Schedule.company_id == current_user.company_id)
    schedule = session.exec(schedule_stmt).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if not getattr(schedule, "is_paid", False):
        raise HTTPException(status_code=400, detail="Schedule is not marked as paid.")

    reason = str((payload or {}).get("reason") or "").strip()
    sale = session.get(SaleTransaction, schedule.sale_transaction_id) if getattr(schedule, "sale_transaction_id", None) else None
    refund_mode = "manual"

    # Attempt Stripe refund for non-cash transactions when enough Stripe context exists.
    if sale and str(getattr(sale, "payment_method", "") or "").strip().lower() != "cash":
        stripe_cfg = _get_company_stripe_settings(session, getattr(sale, "company_id", None) or current_user.company_id)
        if not stripe_cfg["enabled"] or not stripe_cfg["secret_key"]:
            raise HTTPException(status_code=400, detail="Stripe is not configured for refunds.")
        if not getattr(sale, "stripe_payment_intent_id", None) and not getattr(sale, "stripe_charge_id", None):
            raise HTTPException(status_code=400, detail="Sale has no Stripe identifiers to refund.")

        try:
            stripe.api_key = stripe_cfg["secret_key"]
            refund_payload = {
                "metadata": {
                    "schedule_id": str(schedule.id),
                    "sale_transaction_id": str(sale.id),
                    "company_id": str(current_user.company_id or ""),
                }
            }
            if reason:
                refund_payload["metadata"]["reason"] = reason

            if getattr(sale, "stripe_payment_intent_id", None):
                refund_payload["payment_intent"] = sale.stripe_payment_intent_id
            else:
                refund_payload["charge"] = sale.stripe_charge_id

            stripe.Refund.create(**refund_payload)
            refund_mode = "stripe"
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stripe refund failed: {str(exc)}")

    schedule.is_paid = False
    schedule.sale_transaction_id = None
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    audit_note = f"[Refund initiated {timestamp} by {current_user.username or 'user'} via {refund_mode}]"
    if reason:
        audit_note = f"{audit_note} {reason}"
    schedule.notes = f"{(schedule.notes or '').strip()}\n{audit_note}".strip()

    session.add(schedule)
    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to persist refund initiation: {str(exc)}")
    session.refresh(schedule)

    return {
        "ok": True,
        "schedule_id": str(schedule.id),
        "is_paid": schedule.is_paid,
        "refund_mode": refund_mode,
    }

@router.post("/{table_name}")
async def insert(
    table_name: str,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Standard JSON insert endpoint."""
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

    membership_ids = None
    if table_name.lower() in ('client', 'clients'):
        membership_ids = record_data.pop('membership_ids', None)

    is_inventory_table = table_name.lower() in ('inventory', 'item', 'items')
    asset_units_payload = record_data.pop('asset_units', None) if is_inventory_table else None

    # Special handling for user table: hash plain password into password_hash
    if table_name.lower() in ('user', 'users') and 'password' in record_data:
        plain_password = record_data.pop('password')
        if plain_password:
            record_data['password_hash'] = User.hash_password(plain_password)

    # Auto-inject company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        record_data['company_id'] = current_user.company_id or ""

    if is_inventory_table:
        _normalize_inventory_cost_fields(record_data, apply_default_purchase_date=True)

    try:
        record = model_class(**record_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")

    session.add(record)
    try:
        session.flush()
        if is_inventory_table and str(getattr(record, 'type', '') or '').upper() == 'ASSET':
            _create_initial_asset_units_for_inventory(session, record, current_user.company_id or "", asset_units_payload)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    session.refresh(record)

    checkout_url = ""
    checkout_session_id = None
    if table_name.lower() in ("sale_transaction", "sale_transactions"):
        try:
            checkout_url, checkout_session_id = _create_sale_checkout_session(record, request, session)
            if checkout_session_id:
                record.stripe_checkout_session_id = checkout_session_id
                session.add(record)
                session.commit()
                session.refresh(record)
        except HTTPException:
            raise
        except Exception as exc:
            session.rollback()
            raise HTTPException(status_code=502, detail=f"Stripe checkout creation failed: {str(exc)}")

    if table_name.lower() in ('client', 'clients') and membership_ids is not None:
        try:
            _sync_client_memberships(session, record.id, membership_ids, current_user.company_id)
            session.commit()
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save client memberships: {str(e)}")
        session.refresh(record)

    # ── P1-E: Decrement inventory stock when a product is sold ────────────────
    # Runs only for paid sales so tokenized Stripe payments do not deduct stock
    # until the payment is actually confirmed.
    if table_name.lower() in ('sale_transaction_item', 'sale_transaction_items'):
        sale_transaction_id = getattr(record, 'sale_transaction_id', None)
        sale = session.get(SaleTransaction, sale_transaction_id) if sale_transaction_id else None
        if sale and (getattr(sale, 'paid_at', None) or str(getattr(sale, 'payment_method', '')).lower() == 'cash'):
            try:
                _consume_sale_transaction_inventory(session, sale_transaction_id)
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Warning: stock decrement failed for sale transaction {sale_transaction_id}: {e}")

    result = _serialize_record(record, table_name, session)
    if checkout_url:
        result["checkout_url"] = checkout_url
    if checkout_session_id:
        result["stripe_checkout_session_id"] = checkout_session_id
    return result

# ─── [9] UPDATE ENDPOINTS ──────────────────────────────────────────────────────
@router.put("/{table_name}/{record_id}")
async def update_by_id(
    table_name: str,
    record_id: UUID,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    if table_name.lower() in ("schedule", "schedules"):
        stmt = _apply_schedule_visibility_scope(stmt, current_user, session)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    if table_name.lower() in ("schedule", "schedules") and "is_paid" in record_data:
        permissions = set(get_user_permissions_list(current_user, session))
        current_paid = bool(getattr(record, "is_paid", False))
        requested_paid = bool(record_data.get("is_paid"))

        if not current_paid and requested_paid:
            has_approve_permission = (
                current_user.role == UserRole.ADMIN
                or "schedule:approve_payments" in permissions
                or "schedule:admin" in permissions
            )
            if not has_approve_permission:
                raise HTTPException(status_code=403, detail="Missing permission: schedule:approve_payments")

        if current_paid and not requested_paid:
            has_refund_permission = (
                current_user.role == UserRole.ADMIN
                or "schedule:initiate_refunds" in permissions
                or "schedule:admin" in permissions
            )
            if not has_refund_permission:
                raise HTTPException(status_code=403, detail="Missing permission: schedule:initiate_refunds")

    membership_ids = None
    if table_name.lower() in ('client', 'clients'):
        membership_ids = record_data.pop('membership_ids', None)

    if table_name.lower() in ('inventory', 'item', 'items') and 'cost_type' in record_data:
        _normalize_inventory_cost_fields(record_data)

    for key, value in record_data.items():
        if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
            setattr(record, key, value)

    if hasattr(record, "updated_at"):
        from datetime import datetime
        record.updated_at = datetime.utcnow()

    session.add(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    session.refresh(record)

    if table_name.lower() in ('client', 'clients') and membership_ids is not None:
        try:
            _sync_client_memberships(session, record.id, membership_ids, current_user.company_id)
            session.commit()
        except Exception as e:
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save client memberships: {str(e)}")
        session.refresh(record)

    return _serialize_record(record, table_name, session)


# ─── [10] SPECIAL ENDPOINTS ───────────────────────────────────────────────────
# ===== INVENTORY LOCATIONS ENDPOINT (must be before generic routes) =====

@router.get("/inventory/locations")
async def get_inventory_locations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all unique locations from inventory items"""
    try:
        # Query distinct locations from inventory table — always scoped to company
        result = session.execute(
            sql_select(Inventory.location).where(
                and_(Inventory.location.isnot(None), Inventory.company_id == current_user.company_id)
            ).distinct()
        )
        locations = [row[0] for row in result.fetchall() if row[0]]
        return {"locations": sorted(locations)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")


# ===== SYNC CHECK ENDPOINT (lightweight count + max timestamp) =====

@router.get("/{table_name}/sync")
async def sync_check(
    table_name: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Return a lightweight summary (row count + latest created_at) so the
    frontend cache can decide whether an incremental fetch is needed.
    """
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

    base_stmt = sql_select(func.count()).select_from(model_class.__table__)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        base_stmt = base_stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    count_result = session.execute(base_stmt)
    total = count_result.scalar() or 0

    max_created_at = None
    if hasattr(model_class, "created_at"):
        max_stmt = sql_select(func.max(model_class.created_at))
        if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
            max_stmt = max_stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
        max_result = session.execute(max_stmt)
        val = max_result.scalar()
        if val is not None:
            max_created_at = val.isoformat() if hasattr(val, "isoformat") else str(val)

    return {"count": total, "max_created_at": max_created_at}


# ─── [11] SELECT ENDPOINTS (GET) ──────────────────────────────────────────────
@router.get("/{table_name}")
async def select(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

    raw_filters = [(k, v) for k, v in request.query_params.multi_items()]
    if len(raw_filters) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 filter parameters is allowed")

    stmt = sql_select(model_class)

    # ── Incremental fetch: _after=<ISO timestamp> ──────────────────
    # Returns only rows whose created_at > the supplied value.
    after_value = None
    user_filters = []
    for k, v in raw_filters:
        if k == "_after":
            after_value = v
        else:
            user_filters.append((k, v))

    if after_value and hasattr(model_class, "created_at"):
        stmt = stmt.where(model_class.created_at > after_value)

    conditions = []
    for column, raw_value in user_filters:
        if column not in model_class.model_fields:
            raise HTTPException(status_code=400, detail=f"Invalid filter column '{column}'")

        col_attr = getattr(model_class, column)

        if isinstance(raw_value, str) and "*" in raw_value:
            conditions.append(col_attr.like(raw_value.replace("*", "%")))
            continue

        value = _coerce_filter_value(model_class, column, raw_value)
        conditions.append(col_attr == value)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    # Auto-filter by company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)

    if table_name.lower() in ("schedule", "schedules"):
        stmt = _apply_schedule_visibility_scope(stmt, current_user, session)

    if any(k == "id" for k, _ in user_filters):
        record = session.exec(stmt).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")
        return _serialize_record(record, table_name, session)

    records = session.exec(stmt).all()
    return _serialize_records(records, table_name, session)


@router.get("/{table_name}/{record_id}")
async def select_by_id(
    table_name: str,
    record_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    if table_name.lower() in ("schedule", "schedules"):
        stmt = _apply_schedule_visibility_scope(stmt, current_user, session)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")
    return _serialize_record(record, table_name, session)

@router.put("/{table_name}")
async def update(
    table_name: str,
    request: Request,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

    raw_filters = [(k, v) for k, v in request.query_params.multi_items()]
    if not raw_filters:
        raise HTTPException(status_code=400, detail="Update requires at least one filter (e.g., id=...)")
    if len(raw_filters) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 filter parameters is allowed")

    stmt = sql_select(model_class)
    conditions = []
    for column, raw_value in raw_filters:
        if column not in model_class.model_fields:
            raise HTTPException(status_code=400, detail=f"Invalid filter column '{column}'")

        col_attr = getattr(model_class, column)

        if isinstance(raw_value, str) and "*" in raw_value:
            conditions.append(col_attr.like(raw_value.replace("*", "%")))
            continue

        value = _coerce_filter_value(model_class, column, raw_value)
        conditions.append(col_attr == value)

    stmt = stmt.where(and_(*conditions))
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    if table_name.lower() in ("schedule", "schedules"):
        stmt = _apply_schedule_visibility_scope(stmt, current_user, session)

    update_many = not any(k == "id" for k, _ in raw_filters)

    if table_name.lower() in ('inventory', 'item', 'items') and 'cost_type' in record_data:
        _normalize_inventory_cost_fields(record_data)

    if update_many:
        records = session.exec(stmt).all()
        if not records:
            raise HTTPException(status_code=404, detail=f"No matching records found in {table_name}")

        for record in records:
            for key, value in record_data.items():
                if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
                    setattr(record, key, value)
            session.add(record)

        session.commit()
        return {"count": len(records)}

    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    for key, value in record_data.items():
        if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
            setattr(record, key, value)

    session.add(record)
    session.commit()
    session.refresh(record)
    return _serialize_record(record, table_name, session)

# ─── [12] DELETE ENDPOINT ──────────────────────────────────────────────────────

def _cascade_delete(session: Session, table_name: str, record_id: UUID, record) -> None:
    """
    Remove or nullify all FK-dependent rows before deleting the parent record,
    so that no FK-constraint violation is raised.

    Rules:
    • Rows whose entire meaning is tied to the deleted parent  → delete them.
    • Rows that belong to another entity but reference this one via an optional FK
      → set that FK column to NULL so the row survives.
    • Shared/historical data (sale transactions, documents owned by others, etc.)
      → only nullify the reference, never delete the other entity.
    """
    tn = table_name.lower()

    def _del(model, **filters):
        """Delete all rows of `model` matching given column=value filters."""
        rows = session.exec(
            sql_select(model).where(
                and_(*[getattr(model, k) == v for k, v in filters.items()])
            )
        ).all()
        for r in rows:
            session.delete(r)

    def _null(model, filter_col: str, filter_val, null_col: str):
        """Set null_col = None on all rows of `model` where filter_col = filter_val."""
        rows = session.exec(
            sql_select(model).where(getattr(model, filter_col) == filter_val)
        ).all()
        for r in rows:
            setattr(r, null_col, None)
            session.add(r)

    # ── INVENTORY ────────────────────────────────────────────────────────────
    if tn == "inventory":
        iid = record_id
        # Owned sub-records: delete entirely
        _del(InventoryImage,              inventory_id=iid)
        _del(AssetUnit,                   inventory_id=iid)
        _del(InventoryFeature,            inventory_id=iid)
        _del(InventoryFeatureOptionData,  inventory_id=iid)
        # Cross-entity links: delete the *link* row, the service/product survives
        _del(ServiceResource,  inventory_id=iid)
        _del(ServiceAsset,     inventory_id=iid)
        _del(ServiceLocation,  inventory_id=iid)

    # ── SERVICE ──────────────────────────────────────────────────────────────
    elif tn == "service":
        sid = record_id
        _del(ServiceResource, service_id=sid)
        _del(ServiceAsset,    service_id=sid)
        _del(ServiceEmployee, service_id=sid)
        _del(ServiceLocation, service_id=sid)
        _del(ServiceRecipe,   service_id=sid)
        # Schedules/inventory keep their records but lose the service FK reference
        _null(Schedule,   "service_id", sid, "service_id")
        _null(Inventory,  "service_id", sid, "service_id")

    # ── CLIENT ───────────────────────────────────────────────────────────────
    elif tn in ("client", "clients"):
        cid = record_id
        _del(ClientMembership, client_id=cid)
        _null(Schedule, "client_id", cid, "client_id")
        _del(ScheduleAttendee, client_id=cid)
        _del(ClientCartItem,   client_id=cid)
        _null(SaleTransaction, "client_id", cid, "client_id")

    # ── MEMBERSHIP ──────────────────────────────────────────────────────────
    elif tn in ("membership", "memberships"):
        _del(ClientMembership, membership_id=record_id)

    # ── SCHEDULE ─────────────────────────────────────────────────────────────
    elif tn in ("schedule", "schedules"):
        scid = record_id
        _del(ScheduleAttendee,  schedule_id=scid)
        _del(ScheduleDocument,  schedule_id=scid)
        _null(Schedule,         "parent_schedule_id", scid, "parent_schedule_id")
        _null(SaleTransaction,  "schedule_id", scid, "schedule_id")

    # ── DOCUMENT ─────────────────────────────────────────────────────────────
    elif tn in ("document", "documents"):
        did = record_id
        # File cleanup is handled by the caller before this function
        _del(DocumentBlob,       document_id=did)
        _del(DocumentAssignment, document_id=did)
        _del(ScheduleDocument,   document_id=did)
        _null(ChatMessage, "document_id", did, "document_id")

    # ── USER / EMPLOYEE ──────────────────────────────────────────────────────
    elif tn in ("user", "users"):
        uid = record_id
        _del(UserPermission,    user_id=uid)
        _del(ScheduleAttendee,  user_id=uid)
        _del(Attendance,        user_id=uid)
        _del(LeaveRequest,      user_id=uid)
        _del(OnboardingRequest, user_id=uid)
        _del(OffboardingRequest, user_id=uid)
        _del(PaySlip,           employee_id=uid)
        # ChatMessage sender_id / receiver_id are NOT NULL — delete the messages
        _del(ChatMessage, sender_id=uid)
        _del(ChatMessage, receiver_id=uid)
        # Self-referential: clear reports_to for direct reports
        _null(User, "reports_to", uid, "reports_to")

    # ── SALE TRANSACTION ─────────────────────────────────────────────────────
    elif tn in ("sale_transaction",):
        _del(SaleTransactionItem, sale_transaction_id=record_id)

    # ── DESCRIPTIVE FEATURE ──────────────────────────────────────────────────
    elif tn in ("descriptive_feature",):
        _del(InventoryFeatureOptionData, feature_id=record_id)
        _del(InventoryFeature,           feature_id=record_id)
        _del(FeatureOption,              feature_id=record_id)

    # ── FEATURE OPTION ───────────────────────────────────────────────────────
    elif tn in ("feature_option",):
        _del(InventoryFeatureOptionData, option_id=record_id)

    # ── DOCUMENT CATEGORY ────────────────────────────────────────────────────
    elif tn in ("document_category",):
        _null(Document, "category_id", record_id, "category_id")


@router.delete("/{table_name}/{record_id}")
async def delete_by_id(
    table_name: str,
    record_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "delete")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    if table_name.lower() in ("schedule", "schedules"):
        stmt = _apply_schedule_visibility_scope(stmt, current_user, session)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    # Remove file from disk before the DB transaction for document deletes
    if table_name.lower() in ("document", "documents"):
        if hasattr(record, "file_path") and record.file_path:
            path = _resolve_document_path(record.file_path, UPLOAD_DIR)
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    # Cascade-delete / nullify all FK-dependent rows first
    _cascade_delete(session, table_name, record_id, record)

    session.delete(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    return {"count": 1}


# ─── [13] INVENTORY IMAGE MANAGEMENT ENDPOINTS ────────────────────────────────
# ===== INVENTORY IMAGE MANAGEMENT ENDPOINTS =====

def _image_to_read(img: InventoryImage) -> InventoryImageRead:
    """Build InventoryImageRead from an ORM instance, setting has_file correctly."""
    return InventoryImageRead(
        id=img.id,
        inventory_id=img.inventory_id,
        image_url=img.image_url,
        file_path=img.file_path,
        file_name=img.file_name,
        mime_type=img.mime_type,
        has_file=(img.image_data is not None) or bool(img.file_path),
        is_primary=img.is_primary,
        sort_order=img.sort_order,
        created_at=img.created_at,
        updated_at=img.updated_at,
    )

@router.post("/inventory/{inventory_id}/images/url")
async def add_inventory_image_url(
    inventory_id: UUID,
    image_data: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add an image URL to an inventory item"""
    # Verify inventory exists and belongs to user's company
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    from sqlalchemy import func as sa_func, update as sa_update
    existing_count = session.exec(
        sql_select(sa_func.count()).select_from(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    ).one()

    image = InventoryImage(
        inventory_id=inventory_id,
        image_url=image_data.get("image_url"),
        is_primary=image_data.get("is_primary", existing_count == 0),
        sort_order=image_data.get("sort_order", existing_count),
        company_id=inventory.company_id,
    )

    if image.is_primary:
        session.execute(
            sa_update(InventoryImage)
            .where(InventoryImage.inventory_id == inventory_id)
            .values(is_primary=False)
        )
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return _image_to_read(image)


@router.post("/inventory/{inventory_id}/images/upload")
async def upload_inventory_image_file(
    inventory_id: UUID,
    file: UploadFile,
    is_primary: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Upload an image file for an inventory item. Bytes are stored directly in the database."""
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")

    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")

    max_size_bytes = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max 5MB. Current: {len(content) / 1024 / 1024:.1f}MB",
        )

    # COUNT only — avoids loading binary blobs of existing images into memory
    from sqlalchemy import func as sa_func
    existing_count = session.exec(
        sql_select(sa_func.count()).select_from(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    ).one()
    is_first = existing_count == 0

    image = InventoryImage(
        inventory_id=inventory_id,
        file_name=file.filename,
        mime_type=file.content_type,
        image_data=content,          # Store bytes in the database — survives redeployments
        # Legacy DBs may still enforce check_image_source requiring file_path when image_url is null.
        # Keep a non-null marker path for compatibility; actual bytes remain in image_data.
        file_path=f"db://inventory-image/{uuid_module.uuid4()}",
        is_primary=is_primary or is_first,
        sort_order=existing_count,
        company_id=inventory.company_id,
    )

    if image.is_primary:
        # Bulk-unset without loading binary blobs
        from sqlalchemy import update as sa_update
        session.execute(
            sa_update(InventoryImage)
            .where(InventoryImage.inventory_id == inventory_id)
            .values(is_primary=False)
        )

    session.add(image)
    session.commit()
    session.refresh(image)

    return _image_to_read(image)


@router.get("/inventory/{inventory_id}/images")
async def get_inventory_images(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all images for an inventory item"""
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")

    stmt = sql_select(InventoryImage).where(
        and_(
            InventoryImage.inventory_id == inventory_id,
            # Keep compatibility with older rows where company_id may be null.
            (InventoryImage.company_id == inventory.company_id) | (InventoryImage.company_id.is_(None))
        )
    ).order_by(InventoryImage.sort_order)
    
    images = session.exec(stmt).all()
    return [_image_to_read(img) for img in images]


@router.put("/inventory/images/{image_id}")
async def update_inventory_image(
    image_id: UUID,
    image_data: InventoryImageUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Update fields
    update_data = image_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(image, field, value)
    
    # If setting as primary, unset others for this inventory item
    if image_data.is_primary:
        stmt = sql_select(InventoryImage).where(
            and_(
                InventoryImage.inventory_id == image.inventory_id,
                InventoryImage.id != image_id
            )
        )
        other_images = session.exec(stmt).all()
        for other_image in other_images:
            other_image.is_primary = False
            session.add(other_image)
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return _image_to_read(image)


@router.delete("/inventory/images/{image_id}")
async def delete_inventory_image(
    image_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file if it exists
    if image.file_path and os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except OSError:
            pass
    
    session.delete(image)
    session.commit()
    
    return {"message": "Image deleted successfully"}


@router.get("/inventory/images/{image_id}/file")
async def serve_inventory_image_file(
    image_id: UUID,
    request: Request,
    token: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Serve an inventory image.

    Reads bytes from the database (image_data column) so images persist across
    redeployments. Falls back to disk (file_path) for legacy pre-migration records.
    Accepts auth via Authorization: Bearer header OR ?token=<jwt> query param.
    """
    raw_token = token
    if not raw_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw_token = auth_header[7:]
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    _secret = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    try:
        claims = pyjwt.decode(raw_token, _secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    token_company_id = claims.get("company_id") if isinstance(claims, dict) else None
    if token_company_id and inventory.company_id != token_company_id:
        raise HTTPException(status_code=404, detail="Image not found")

    # Primary path: bytes stored in the database
    # Cast to bytes explicitly — psycopg2 may return memoryview for BYTEA columns
    if image.image_data is not None:
        media_type = image.mime_type or "image/jpeg"
        return Response(
            content=bytes(image.image_data),
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=86400"},
        )

    # Legacy fallback: file stored on disk (pre-migration uploads)
    if image.file_path:
        path = _resolve_document_path(image.file_path, UPLOAD_DIR)
        if os.path.exists(path):
            return FileResponse(path, media_type=image.mime_type or None, filename=image.file_name)

    raise HTTPException(status_code=404, detail="Image data not found")