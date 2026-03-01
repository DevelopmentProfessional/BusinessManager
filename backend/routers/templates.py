# ============================================================
# FILE: templates.py
#
# PURPOSE:
#   Manages HTML document templates with {{key}} placeholder variables used for
#   generating emails, invoices, receipts, memos, and quotes throughout the
#   application. Provides seeding of standard built-in templates at startup and
#   full CRUD plus a server-side render endpoint for user-defined templates.
#
# FUNCTIONAL PARTS:
#   [1] Standard Template Definitions — static list of built-in template objects (email, invoice, receipt, memo, quote)
#   [2] Seed Helper — upsert standard templates into the database at startup
#   [3] Render Helper — server-side {{key}} placeholder substitution utility
#   [4] Template CRUD Endpoints — list, get, create, update, delete templates
#   [5] Render Endpoint — POST to render a template with caller-supplied variables
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime
from uuid import UUID
import re

try:
    from backend.database import get_session
    from backend.models import DocumentTemplate, DocumentTemplateCreate, DocumentTemplateUpdate, DocumentTemplateRead
except ModuleNotFoundError:
    from database import get_session
    from models import DocumentTemplate, DocumentTemplateCreate, DocumentTemplateUpdate, DocumentTemplateRead

router = APIRouter()

# ─── 1 STANDARD TEMPLATE DEFINITIONS ───────────────────────────────────────────

# ---------------------------------------------------------------------------
# Standard template seed data
# ---------------------------------------------------------------------------

_STANDARD_TEMPLATES = [
    {
        "name": "Client Reminder Email",
        "template_type": "email",
        "accessible_pages": '["clients","schedule"]',
        "description": "A reminder email to send to clients about upcoming appointments.",
        "content": (
            "<p>Dear {{client.name}},</p>"
            "<p>This is a friendly reminder about your upcoming appointment:</p>"
            "<ul>"
            "<li><strong>Date:</strong> {{appointment.date}}</li>"
            "<li><strong>Time:</strong> {{appointment.time}}</li>"
            "<li><strong>Service:</strong> {{appointment.service}}</li>"
            "<li><strong>Duration:</strong> {{appointment.duration}}</li>"
            "<li><strong>With:</strong> {{appointment.employee_name}}</li>"
            "</ul>"
            "<p>If you need to reschedule, please contact us at {{company.phone}} or {{company.email}}.</p>"
            "<p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>"
        ),
    },
    {
        "name": "Invoice",
        "template_type": "invoice",
        "accessible_pages": '["sales"]',
        "description": "Standard invoice template.",
        "content": (
            "<h2>INVOICE</h2>"
            "<p><strong>Invoice #:</strong> {{invoice.number}}<br>"
            "<strong>Date:</strong> {{invoice.date}}</p>"
            "<hr>"
            "<p><strong>Bill To:</strong><br>{{client.name}}<br>{{client.email}}</p>"
            "<hr>"
            "<p>{{invoice.items}}</p>"
            "<hr>"
            "<p><strong>Subtotal:</strong> {{invoice.subtotal}}<br>"
            "<strong>Tax:</strong> {{invoice.tax}}<br>"
            "<strong>Total:</strong> {{invoice.total}}</p>"
            "<p><strong>Payment Method:</strong> {{invoice.payment_method}}</p>"
            "<p>Thank you for your business!</p>"
            "<p><em>{{company.name}} | {{company.email}} | {{company.phone}}</em></p>"
        ),
    },
    {
        "name": "Receipt",
        "template_type": "receipt",
        "accessible_pages": '["sales"]',
        "description": "Standard receipt template.",
        "content": (
            "<h2>RECEIPT</h2>"
            "<p><strong>Date:</strong> {{invoice.date}}</p>"
            "<hr>"
            "<p><strong>Customer:</strong> {{client.name}}</p>"
            "<p>{{invoice.items}}</p>"
            "<hr>"
            "<p><strong>Total Paid:</strong> {{invoice.total}}<br>"
            "<strong>Payment Method:</strong> {{invoice.payment_method}}</p>"
            "<p>Thank you! — {{company.name}}</p>"
        ),
    },
    {
        "name": "Employee Memo",
        "template_type": "memo",
        "accessible_pages": '["employees"]',
        "description": "Internal employee memo template.",
        "content": (
            "<h2>MEMO</h2>"
            "<p><strong>To:</strong> {{employee.first_name}} {{employee.last_name}}<br>"
            "<strong>From:</strong> {{sender.first_name}} {{sender.last_name}}<br>"
            "<strong>Date:</strong> {{date}}<br>"
            "<strong>Re:</strong> [Subject]</p>"
            "<hr>"
            "<p>[Memo body goes here]</p>"
            "<p>Please acknowledge receipt of this memo.</p>"
            "<p>{{company.name}}</p>"
        ),
    },
    {
        "name": "Broadcast Email",
        "template_type": "email",
        "accessible_pages": '["clients","employees"]',
        "description": "General broadcast email for clients and employees.",
        "content": (
            "<p>Dear {{client.name}},</p>"
            "<p>We have an important announcement from <strong>{{company.name}}</strong>.</p>"
            "<p>[Announcement content goes here]</p>"
            "<p>For inquiries: {{company.email}} | {{company.phone}}</p>"
            "<p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}</p>"
        ),
    },
    {
        "name": "Quote",
        "template_type": "quote",
        "accessible_pages": '["clients","sales"]',
        "description": "Price quote template for clients.",
        "content": (
            "<h2>QUOTE</h2>"
            "<p><strong>Date:</strong> {{date}}<br>"
            "<strong>Valid Until:</strong> [expiry date]</p>"
            "<hr>"
            "<p><strong>Prepared For:</strong><br>{{client.name}}<br>{{client.email}}</p>"
            "<hr>"
            "<p>{{invoice.items}}</p>"
            "<hr>"
            "<p><strong>Estimated Total:</strong> {{invoice.total}}</p>"
            "<p>To accept this quote, please contact us at {{company.email}}.</p>"
            "<p><em>{{company.name}} | {{company.phone}}</em></p>"
        ),
    },
    {
        "name": "Appointment Confirmation",
        "template_type": "email",
        "accessible_pages": '["schedule","clients"]',
        "description": "Confirmation email for a booked appointment.",
        "content": (
            "<p>Dear {{client.name}},</p>"
            "<p>Your appointment has been confirmed. Here are the details:</p>"
            "<ul>"
            "<li><strong>Date:</strong> {{appointment.date}}</li>"
            "<li><strong>Time:</strong> {{appointment.time}}</li>"
            "<li><strong>Service:</strong> {{appointment.service}}</li>"
            "<li><strong>Duration:</strong> {{appointment.duration}}</li>"
            "<li><strong>With:</strong> {{appointment.employee_name}}</li>"
            "</ul>"
            "<p>Please arrive a few minutes early. If you need to cancel or reschedule, "
            "contact us at {{company.phone}} or {{company.email}}.</p>"
            "<p>We look forward to seeing you!</p>"
            "<p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>"
        ),
    },
]


# ─── 2 SEED HELPER ─────────────────────────────────────────────────────────────

def seed_standard_templates(session: Session) -> None:
    """Upsert standard templates — insert if missing, update content/pages if already exists."""
    existing = {
        row.name: row
        for row in session.exec(
            select(DocumentTemplate).where(DocumentTemplate.is_standard == True)
        ).all()
    }
    for tpl in _STANDARD_TEMPLATES:
        if tpl["name"] in existing:
            obj = existing[tpl["name"]]
            obj.content = tpl["content"]
            obj.accessible_pages = tpl["accessible_pages"]
            obj.description = tpl.get("description", obj.description)
            obj.template_type = tpl["template_type"]
        else:
            obj = DocumentTemplate(
                name=tpl["name"],
                template_type=tpl["template_type"],
                accessible_pages=tpl["accessible_pages"],
                description=tpl.get("description"),
                content=tpl["content"],
                is_standard=True,
                is_active=True,
            )
            session.add(obj)
    try:
        session.commit()
    except Exception:
        session.rollback()


# ─── 3 RENDER HELPER ───────────────────────────────────────────────────────────

# ---------------------------------------------------------------------------
# Render helper (server-side)
# ---------------------------------------------------------------------------

def _render_template(html: str, variables: dict) -> str:
    """Replace {{key}} placeholders with values from the variables dict."""
    for key, val in variables.items():
        html = html.replace("{{" + key + "}}", str(val) if val is not None else "{{" + key + "}}")
    return html


# ─── 4 TEMPLATE CRUD ENDPOINTS ─────────────────────────────────────────────────

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/templates", response_model=list[DocumentTemplateRead])
def list_templates(
    page: str | None = None,
    session: Session = Depends(get_session),
):
    """List all templates, optionally filtered by accessible page."""
    stmt = select(DocumentTemplate).where(DocumentTemplate.is_active == True)
    templates = session.exec(stmt).all()
    if page:
        templates = [
            t for t in templates
            if page in (t.accessible_pages or "[]")
        ]
    return [DocumentTemplateRead.model_validate(t) for t in templates]


@router.get("/templates/{template_id}", response_model=DocumentTemplateRead)
def get_template(
    template_id: UUID,
    session: Session = Depends(get_session),
):
    tpl = session.get(DocumentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return DocumentTemplateRead.model_validate(tpl)


@router.post("/templates", response_model=DocumentTemplateRead)
def create_template(
    data: DocumentTemplateCreate,
    session: Session = Depends(get_session),
):
    tpl = DocumentTemplate(**data.model_dump())
    session.add(tpl)
    try:
        session.commit()
        session.refresh(tpl)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return DocumentTemplateRead.model_validate(tpl)


@router.put("/templates/{template_id}", response_model=DocumentTemplateRead)
def update_template(
    template_id: UUID,
    data: DocumentTemplateUpdate,
    session: Session = Depends(get_session),
):
    tpl = session.get(DocumentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tpl, field, value)
    tpl.updated_at = datetime.utcnow()
    try:
        session.commit()
        session.refresh(tpl)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return DocumentTemplateRead.model_validate(tpl)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: UUID,
    session: Session = Depends(get_session),
):
    tpl = session.get(DocumentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tpl.is_standard:
        raise HTTPException(status_code=403, detail="Standard templates cannot be deleted")
    session.delete(tpl)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"deleted": True}


# ─── 5 RENDER ENDPOINT ─────────────────────────────────────────────────────────

@router.post("/templates/{template_id}/render")
def render_template(
    template_id: UUID,
    body: dict,
    session: Session = Depends(get_session),
):
    """Render a template server-side with provided variables."""
    tpl = session.get(DocumentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    variables = body.get("variables", {})
    rendered = _render_template(tpl.content, variables)
    return {"html": rendered}
