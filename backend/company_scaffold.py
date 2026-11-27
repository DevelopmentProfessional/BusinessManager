"""Company scaffold helpers for seeding baseline company data.

This module is intentionally idempotent so it can run during company creation
and again on approval/retry without creating duplicate records.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import text


BUSINESS_CATEGORIES = {
    "salon_spa": "Salon / Beauty / Spa",
    "consulting": "Consulting / Professional Services",
    "retail": "Retail / Store / Inventory",
    "healthcare": "Healthcare / Wellness",
    "general": "General / Other",
}


def normalize_business_category(category: str | None) -> str:
    """Normalize user-entered or stored business category into a standard key."""
    if not category:
        return "general"
    norm = category.strip().lower().replace("-", "_").replace(" ", "_")
    if any(k in norm for k in ("salon", "beauty", "spa", "hair", "nail", "esthetic")):
        return "salon_spa"
    if any(k in norm for k in ("consult", "professional", "advisory", "legal", "agency")):
        return "consulting"
    if any(k in norm for k in ("retail", "store", "shop", "merchandise", "apparel", "inventory")):
        return "retail"
    if any(k in norm for k in ("health", "wellness", "clinic", "medical", "care", "therapy")):
        return "healthcare"
    return "general"


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:t)"
        ),
        {"t": table_name},
    ).scalar()
    return bool(row)


def _load_template_seed_rows(category_key: str = "general") -> list[dict]:
    """Load built-in templates from templates router and append scaffold and category extras."""
    standard_templates = []
    try:
        from backend.routers.templates import _STANDARD_TEMPLATES  # type: ignore

        standard_templates = list(_STANDARD_TEMPLATES)
    except Exception:
        try:
            from routers.templates import _STANDARD_TEMPLATES  # type: ignore

            standard_templates = list(_STANDARD_TEMPLATES)
        except Exception:
            standard_templates = []

    extra_templates = [
        {
            "name": "Late Payment Notice",
            "template_type": "email",
            "accessible_pages": '["clients","sales"]',
            "description": "Follow-up reminder for overdue invoice balances.",
            "content": (
                "<p>Hello {{client.name}},</p>"
                "<p>Our records show an outstanding balance of <strong>{{invoice.total}}</strong> "
                "for invoice {{invoice.number}} due on {{invoice.due_date}}.</p>"
                "<p>Please make payment at your earliest convenience. If payment has already "
                "been sent, kindly ignore this notice.</p>"
                "<p>Thank you,<br>{{company.name}}</p>"
            ),
        },
        {
            "name": "Appointment Reminder",
            "template_type": "email",
            "accessible_pages": '["schedule","clients"]',
            "description": "Reminder email for upcoming appointments.",
            "content": (
                "<p>Dear {{client.name}},</p>"
                "<p>This is a reminder about your upcoming appointment:</p>"
                "<ul>"
                "<li><strong>Date:</strong> {{appointment.date}}</li>"
                "<li><strong>Time:</strong> {{appointment.time}}</li>"
                "<li><strong>Service:</strong> {{appointment.service}}</li>"
                "<li><strong>Duration:</strong> {{appointment.duration}}</li>"
                "<li><strong>With:</strong> {{appointment.employee_name}}</li>"
                "</ul>"
                "<p>If you need to reschedule, please use {{reschedule_link}} or contact us at {{company.phone}}.</p>"
                "<p>Cancellation policy: {{cancellation_policy}}</p>"
                "<p>Best regards,<br>{{company.name}}</p>"
            ),
        },
        {
            "name": "Appointment Cancellation Notice",
            "template_type": "email",
            "accessible_pages": '["schedule","clients"]',
            "description": "Notice sent after a cancellation or no-show.",
            "content": (
                "<p>Dear {{client.name}},</p>"
                "<p>Your appointment on {{appointment.date}} at {{appointment.time}} has been marked as <strong>{{appointment.status}}</strong>.</p>"
                "<p>Reason: {{cancellation_reason}}</p>"
                "<p>Any applicable fee: {{fee_amount}}</p>"
                "<p>If you'd like to reschedule, visit {{reschedule_link}} or contact {{company.phone}} / {{company.email}}.</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Client Feedback Request",
            "template_type": "email",
            "accessible_pages": '["clients","sales","schedule"]',
            "description": "Post-service review request email for clients.",
            "content": (
                "<p>Dear {{client.name}},</p>"
                "<p>Thank you for choosing {{company.name}} for {{service.name}} on {{appointment.date}}.</p>"
                "<p>We would appreciate your feedback here: {{review_link}}</p>"
                "<p>Your review helps us improve and serve you better.</p>"
                "<p>Best regards,<br>{{company.name}}</p>"
            ),
        },
        {
            "name": "New Client Welcome",
            "template_type": "email",
            "accessible_pages": '["clients"]',
            "description": "Welcome email sent to newly registered clients.",
            "content": (
                "<p>Welcome {{client.name}},</p>"
                "<p>Thanks for choosing {{company.name}}. We are excited to work with you.</p>"
                "<p>If you have questions, contact us at {{company.email}} or {{company.phone}}.</p>"
                "<p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}</p>"
            ),
        },
        {
            "name": "Membership Renewal Notice",
            "template_type": "email",
            "accessible_pages": '["clients","sales"]',
            "description": "Renewal notice for memberships and recurring client plans.",
            "content": (
                "<p>Dear {{client.name}},</p>"
                "<p>Your {{membership.name}} membership is due for renewal on {{renewal_date}}.</p>"
                "<p>Amount due: {{amount_due}}</p>"
                "<p>Please complete payment by {{deadline}} to keep your account active.</p>"
                "<p>Thank you,<br>{{company.name}}</p>"
            ),
        },
        {
            "name": "Employee Onboarding Contract",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Printable onboarding contract and acknowledgement form for new hires.",
            "content": (
                "<h2>Employee Onboarding Contract</h2>"
                "<p><strong>Employee:</strong> {{employee.first_name}} {{employee.last_name}}</p>"
                "<p><strong>Role:</strong> {{employee.role}}</p>"
                "<p><strong>Hire Date:</strong> {{employee.hire_date}}</p>"
                "<p><strong>Start Date:</strong> {{start_date}}</p>"
                "<p><strong>Compensation:</strong> {{compensation.amount}}</p>"
                "<p><strong>Manager:</strong> {{manager.name}}</p>"
                "<hr>"
                "<p>[Insert onboarding terms, confidentiality language, and acknowledgements here.]</p>"
                "<p>Signature Date: {{signature_date}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Employee Handbook Acknowledgment",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Acknowledgement that the employee received and reviewed the handbook.",
            "content": (
                "<h2>Handbook Acknowledgment</h2>"
                "<p><strong>Employee:</strong> {{employee.name}}</p>"
                "<p><strong>Handbook Version:</strong> {{handbook.version}}</p>"
                "<p><strong>Acknowledgment Date:</strong> {{acknowledgement.date}}</p>"
                "<p>[Employee confirms receipt, review, and agreement to comply with company policy.]</p>"
                "<p>Signature: ____________________</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Performance Review",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Performance review form for managers and HR.",
            "content": (
                "<h2>Performance Review</h2>"
                "<p><strong>Employee:</strong> {{employee.name}}</p>"
                "<p><strong>Review Period:</strong> {{review.period_start}} to {{review.period_end}}</p>"
                "<p><strong>Reviewer:</strong> {{reviewer.name}}</p>"
                "<p><strong>Rating:</strong> {{review.rating}}</p>"
                "<p><strong>Strengths:</strong> {{review.strengths}}</p>"
                "<p><strong>Improvement Areas:</strong> {{review.improvements}}</p>"
                "<p><strong>Goals:</strong> {{review.goals}}</p>"
                "<p><strong>Follow-up Date:</strong> {{follow_up_date}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Disciplinary Warning",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Formal coaching or disciplinary warning notice.",
            "content": (
                "<h2>Disciplinary Warning</h2>"
                "<p><strong>Employee:</strong> {{employee.name}}</p>"
                "<p><strong>Date:</strong> {{warning.date}}</p>"
                "<p><strong>Issue Summary:</strong> {{issue.summary}}</p>"
                "<p><strong>Expected Next Steps:</strong> {{next_steps}}</p>"
                "<p><strong>Follow-up Date:</strong> {{follow_up_date}}</p>"
                "<p><strong>Manager:</strong> {{manager.name}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Employee Offboarding Checklist",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Exit checklist for employee offboarding and access removal.",
            "content": (
                "<h2>Employee Offboarding Checklist</h2>"
                "<p><strong>Employee:</strong> {{employee.name}}</p>"
                "<p><strong>Last Day:</strong> {{last_day}}</p>"
                "<p><strong>Disable Access:</strong> {{disable_access_date}}</p>"
                "<p><strong>Exit Interview:</strong> {{exit_interview_date}}</p>"
                "<p><strong>Return Assets:</strong> {{return_assets}}</p>"
                "<p><strong>Manager:</strong> {{manager.name}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Payment Plan Agreement",
            "template_type": "memo",
            "accessible_pages": '["clients","sales"]',
            "description": "Agreement for splitting an outstanding balance into installments.",
            "content": (
                "<h2>Payment Plan Agreement</h2>"
                "<p><strong>Client:</strong> {{client.name}}</p>"
                "<p><strong>Invoice #:</strong> {{invoice.number}}</p>"
                "<p><strong>Balance Due:</strong> {{balance_due}}</p>"
                "<p><strong>Installments:</strong> {{installment_count}}</p>"
                "<p><strong>Installment Amount:</strong> {{installment_amount}}</p>"
                "<p><strong>Due Date:</strong> {{due_date}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Vendor Follow-up Request",
            "template_type": "memo",
            "accessible_pages": '["inventory"]',
            "description": "Purchase follow-up memo for suppliers and inventory restock.",
            "content": (
                "<h2>Vendor Follow-up Request</h2>"
                "<p><strong>Supplier:</strong> {{supplier.name}}</p>"
                "<p><strong>Item:</strong> {{item.name}}</p>"
                "<p><strong>Quantity:</strong> {{quantity}}</p>"
                "<p><strong>Need By:</strong> {{need_by_date}}</p>"
                "<p><strong>Requester:</strong> {{requester.name}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "Internal Policy Update",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Internal policy memo or company announcement.",
            "content": (
                "<h2>Internal Policy Update</h2>"
                "<p><strong>Effective Date:</strong> {{effective_date}}</p>"
                "<p><strong>Policy Title:</strong> {{policy.title}}</p>"
                "<p>{{policy.body}}</p>"
                "<p><strong>Issued By:</strong> {{sender.first_name}} {{sender.last_name}}</p>"
                "<p>{{company.name}}</p>"
            ),
        },
        {
            "name": "New Client Welcome",
            "template_type": "email",
            "accessible_pages": '["clients"]',
            "description": "Welcome email sent to newly registered clients.",
            "content": (
                "<p>Welcome {{client.name}},</p>"
                "<p>Thanks for choosing {{company.name}}. We are excited to work with you.</p>"
                "<p>If you have questions, contact us at {{company.email}} or {{company.phone}}.</p>"
                "<p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}</p>"
            ),
        },
        {
            "name": "Incident Report",
            "template_type": "memo",
            "accessible_pages": '["employees","documents"]',
            "description": "Internal incident report template for operations and HR.",
            "content": (
                "<h2>Incident Report</h2>"
                "<p><strong>Date:</strong> {{date}}</p>"
                "<p><strong>Location:</strong> [Location]</p>"
                "<p><strong>Reported by:</strong> {{sender.first_name}} {{sender.last_name}}</p>"
                "<hr>"
                "<p><strong>Summary:</strong></p>"
                "<p>[Describe what happened]</p>"
                "<p><strong>Action Taken:</strong></p>"
                "<p>[Describe immediate actions and follow-up]</p>"
            ),
        },
        {
            "name": "Purchase Order Request",
            "template_type": "memo",
            "accessible_pages": '["inventory","suppliers"]',
            "description": "Standard request memo for inventory procurement.",
            "content": (
                "<h2>Purchase Order Request</h2>"
                "<p><strong>Date:</strong> {{date}}</p>"
                "<p><strong>Requested by:</strong> {{sender.first_name}} {{sender.last_name}}</p>"
                "<p><strong>Supplier:</strong> [Supplier Name]</p>"
                "<hr>"
                "<p><strong>Items Requested:</strong></p>"
                "<p>[List items, quantities, target delivery date]</p>"
                "<p><strong>Reason:</strong> [Restock/New project/etc.]</p>"
            ),
        },
        {
            "name": "Time Off Decision Notice",
            "template_type": "email",
            "accessible_pages": '["employees","schedule"]',
            "description": "Approval or denial notice for leave requests.",
            "content": (
                "<p>Hello {{employee.first_name}},</p>"
                "<p>Your {{leave.type}} request from {{leave.start_date}} to {{leave.end_date}} "
                "has been <strong>{{leave.status}}</strong>.</p>"
                "<p>Notes: {{leave.notes}}</p>"
                "<p>Thanks,<br>{{company.name}}</p>"
            ),
        },
        {
            "name": "Service Catalog Card",
            "template_type": "memo",
            "accessible_pages": '["services","schedule","clients","sales"]',
            "description": "Client-facing service card with the mapped service details and image.",
            "content": (
                "<div style=\"display:flex;gap:1rem;align-items:flex-start;padding:1rem;"
                "border:1px solid #e5e7eb;border-radius:8px;\">"
                "<div style=\"flex:0 0 120px;\">{{service.image}}</div>"
                "<div><h2>{{service.name}}</h2>"
                "<p>{{service.description}}</p>"
                "<p><strong>Category:</strong> {{service.category}}<br>"
                "<strong>Duration:</strong> {{service.duration}}<br>"
                "<strong>Price:</strong> {{service.price}}</p></div></div>"
            ),
        },
        {
            "name": "Inventory Product Card",
            "template_type": "memo",
            "accessible_pages": '["inventory","services","clients","sales"]',
            "description": "Client-facing inventory card with SKU, mapped product details, and primary image.",
            "content": (
                "<div style=\"display:flex;gap:1rem;align-items:flex-start;padding:1rem;"
                "border:1px solid #e5e7eb;border-radius:8px;\">"
                "<div style=\"flex:0 0 120px;\">{{inventory.image}}</div>"
                "<div><h2>{{inventory.name}}</h2>"
                "<p><strong>SKU:</strong> {{inventory.sku}}<br>"
                "<strong>Category:</strong> {{inventory.category}}</p>"
                "<p>{{inventory.description}}</p>"
                "<p><strong>Price:</strong> {{inventory.price}}</p></div></div>"
            ),
        },
    ]

    category_templates = {
        "consulting": [
            {
                "name": "Project Proposal & Scope of Work",
                "template_type": "memo",
                "accessible_pages": '["documents","clients"]',
                "description": "Project proposal and engagement scope for advisory clients.",
                "content": (
                    "<h2>Project Proposal & Scope of Work</h2>"
                    "<p><strong>Client:</strong> {{client.name}}</p>"
                    "<p><strong>Project:</strong> [Project Title]</p>"
                    "<p><strong>Executive Summary:</strong></p>"
                    "<p>[Overview of strategic engagement objectives and expected deliverables.]</p>"
                    "<h3>Scope & Milestones:</h3>"
                    "<ul>"
                    "<li>Initial Discovery & Operational Diagnostic</li>"
                    "<li>Strategy Formulation & Advisory Roadmaps</li>"
                    "<li>Final Deliverable Presentation & Sign-off</li>"
                    "</ul>"
                    "<p><strong>Estimated Fee:</strong> [Engagement Fee]</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Deliverable Sign-Off",
                "template_type": "memo",
                "accessible_pages": '["documents","clients"]',
                "description": "Client acceptance and sign-off document for completed deliverables.",
                "content": (
                    "<h2>Deliverable Sign-Off</h2>"
                    "<p><strong>Client:</strong> {{client.name}}</p>"
                    "<p><strong>Deliverable Title:</strong> [Deliverable Title]</p>"
                    "<p><strong>Completion Date:</strong> {{date}}</p>"
                    "<p>Client acknowledges formal receipt and approval of the engagement deliverable.</p>"
                    "<p><strong>Client Signature:</strong> ____________________ Date: ________</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Client Retainer Agreement",
                "template_type": "memo",
                "accessible_pages": '["documents","clients","sales"]',
                "description": "Monthly recurring advisory retainer agreement.",
                "content": (
                    "<h2>Advisory Retainer Agreement</h2>"
                    "<p><strong>Client:</strong> {{client.name}}</p>"
                    "<p><strong>Retainer Term:</strong> Monthly Recurring</p>"
                    "<p><strong>Advisory Hours:</strong> [e.g. 20 hours/month]</p>"
                    "<p><strong>Monthly Rate:</strong> [Rate]</p>"
                    "<p>Scope includes priority strategic advisory, bi-weekly reviews, and on-call consulting.</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Mutual Non-Disclosure Agreement (NDA)",
                "template_type": "memo",
                "accessible_pages": '["documents","clients"]',
                "description": "Confidentiality and proprietary information protection agreement.",
                "content": (
                    "<h2>Mutual Non-Disclosure Agreement</h2>"
                    "<p>This Non-Disclosure Agreement is entered into by {{company.name}} and <strong>{{client.name}}</strong>.</p>"
                    "<p>Both parties agree that all trade secrets, client data, and proprietary methods shall remain strictly confidential.</p>"
                    "<p><strong>Signature:</strong> ____________________ Date: ________</p>"
                ),
            },
        ],
        "salon_spa": [
            {
                "name": "Client Service Waiver & Consent",
                "template_type": "memo",
                "accessible_pages": '["clients","documents","schedule"]',
                "description": "Consent and allergy disclosure waiver for salon and spa treatments.",
                "content": (
                    "<h2>Client Service Waiver & Consent</h2>"
                    "<p><strong>Client:</strong> {{client.name}}</p>"
                    "<p><strong>Service:</strong> {{service.name}}</p>"
                    "<p><strong>Date:</strong> {{date}}</p>"
                    "<p>I confirm that I have disclosed any allergies, sensitivities, or medical conditions and consent to treatment by licensed professionals.</p>"
                    "<p><strong>Client Signature:</strong> ____________________ Date: ________</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Hair Care Aftercare Guide",
                "template_type": "email",
                "accessible_pages": '["clients","schedule"]',
                "description": "Post-treatment aftercare recommendations for salon clients.",
                "content": (
                    "<p>Dear {{client.name}},</p>"
                    "<p>Thank you for visiting {{company.name}} today for your {{service.name}}.</p>"
                    "<p>Tips to maintain your look:</p>"
                    "<ul>"
                    "<li>Wait 48 hours before shampooing freshly colored hair.</li>"
                    "<li>Use sulfate-free color-safe cleansing products.</li>"
                    "<li>Apply heat protectant prior to blow-drying or heat styling.</li>"
                    "</ul>"
                    "<p>Book your next touch-up at {{company.phone}}.</p>"
                    "<p>Warmly,<br>{{company.name}}</p>"
                ),
            },
            {
                "name": "Skin Treatment Post-Care Instructions",
                "template_type": "email",
                "accessible_pages": '["clients","schedule"]',
                "description": "Skincare recovery and sun protection guide following facial treatments.",
                "content": (
                    "<p>Dear {{client.name}},</p>"
                    "<p>Thank you for your skincare appointment at {{company.name}}.</p>"
                    "<p>Post-care tips for glowing, healthy skin:</p>"
                    "<ul>"
                    "<li>Apply broad-spectrum SPF 30+ daily and avoid direct sun.</li>"
                    "<li>Refrain from heavy makeup and intense workouts for 24 hours.</li>"
                    "<li>Stay hydrated and use a gentle moisturizer.</li>"
                    "</ul>"
                    "<p>Best regards,<br>{{company.name}}</p>"
                ),
            },
        ],
        "retail": [
            {
                "name": "Store Return & Exchange Policy",
                "template_type": "memo",
                "accessible_pages": '["inventory","sales","documents"]',
                "description": "Standard return, exchange, and store credit policy.",
                "content": (
                    "<h2>Store Return & Exchange Policy</h2>"
                    "<p><strong>{{company.name}}</strong></p>"
                    "<p>Unworn merchandise with original tags attached may be returned or exchanged within 30 days of purchase with a valid receipt.</p>"
                    "<p>Sale items and clearance goods are final sale. Store credit is issued for gift returns.</p>"
                    "<p>Thank you for shopping with us!</p>"
                ),
            },
            {
                "name": "Daily Inventory Count Sheet",
                "template_type": "memo",
                "accessible_pages": '["inventory","documents"]',
                "description": "Auditing and cycle count worksheet for retail stockrooms.",
                "content": (
                    "<h2>Daily Inventory Count Sheet</h2>"
                    "<p><strong>Location:</strong> [Floor / Stockroom]</p>"
                    "<p><strong>Date:</strong> {{date}}</p>"
                    "<p><strong>Audited By:</strong> {{sender.first_name}} {{sender.last_name}}</p>"
                    "<p>[Verify system stock against actual physical count and record variances.]</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Wholesale Purchase Agreement",
                "template_type": "memo",
                "accessible_pages": '["sales","clients","documents"]',
                "description": "Wholesale and volume buyer terms agreement.",
                "content": (
                    "<h2>Wholesale Purchase Agreement</h2>"
                    "<p><strong>Buyer:</strong> {{client.name}}</p>"
                    "<p><strong>Seller:</strong> {{company.name}}</p>"
                    "<p>Governs wholesale terms, minimum order quantities (MOQ), tiered pricing, and shipping logistics.</p>"
                    "<p>Authorized Signature: ____________________ Date: ________</p>"
                ),
            },
        ],
        "healthcare": [
            {
                "name": "Patient Medical Intake & Consent",
                "template_type": "memo",
                "accessible_pages": '["clients","documents","schedule"]',
                "description": "Patient intake registration and clinical consent form.",
                "content": (
                    "<h2>Patient Medical Intake & Consent</h2>"
                    "<p><strong>Patient Name:</strong> {{client.name}}</p>"
                    "<p><strong>Date:</strong> {{date}}</p>"
                    "<p>Patient acknowledges receipt of clinical policies, HIPAA privacy statements, and consents to diagnostic and preventative care by licensed practitioners.</p>"
                    "<p>Signature: ____________________ Date: ________</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Treatment Plan Summary",
                "template_type": "memo",
                "accessible_pages": '["clients","documents","schedule"]',
                "description": "Clinical care plan summary with recommended schedule and goals.",
                "content": (
                    "<h2>Treatment Plan Summary</h2>"
                    "<p><strong>Patient:</strong> {{client.name}}</p>"
                    "<p><strong>Provider:</strong> {{employee.name}}</p>"
                    "<p><strong>Care Goals & Recommendations:</strong></p>"
                    "<p>[Clinical plan, follow-up cadence, and therapeutic milestones.]</p>"
                    "<p>{{company.name}}</p>"
                ),
            },
            {
                "name": "Health & Wellness Follow-up",
                "template_type": "email",
                "accessible_pages": '["clients","schedule"]',
                "description": "Follow-up email for patient recovery, checkups, and wellness.",
                "content": (
                    "<p>Dear {{client.name}},</p>"
                    "<p>Thank you for visiting {{company.name}} for your appointment on {{appointment.date}}.</p>"
                    "<p>Please continue your prescribed care plan and home wellness regimen. Contact our care team at {{company.phone}} if you have questions.</p>"
                    "<p>In good health,<br>{{company.name}}</p>"
                ),
            },
        ],
    }

    tailored_templates = category_templates.get(category_key, [])

    by_name: dict[str, dict] = {}
    for tpl in standard_templates + extra_templates + tailored_templates:
        by_name[str(tpl.get("name", ""))] = tpl
    return list(by_name.values())


def _seed_document_templates(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "document_template"):
        return 0

    if category_key == "general" and _table_exists(conn, "company"):
        c_row = conn.execute(
            text("SELECT business_category FROM company WHERE company_id=:cid"),
            {"cid": company_id},
        ).fetchone()
        if c_row and c_row[0]:
            category_key = normalize_business_category(c_row[0])

    seeded = 0
    for tpl in _load_template_seed_rows(category_key):
        existing = conn.execute(
            text(
                "SELECT id, content, template_type, accessible_pages, description "
                "FROM document_template WHERE company_id=:cid AND name=:name"
            ),
            {"cid": company_id, "name": tpl["name"]},
        ).fetchone()

        if existing:
            template_id, content, template_type, accessible_pages, description = existing
            updates = {}
            if not content:
                updates["content"] = tpl["content"]
            if not template_type:
                updates["template_type"] = tpl["template_type"]
            if not accessible_pages:
                updates["accessible_pages"] = tpl["accessible_pages"]
            if not description and tpl.get("description"):
                updates["description"] = tpl.get("description")
            if updates:
                conn.execute(
                    text(
                        "UPDATE document_template SET "
                        "content = COALESCE(:content, content), "
                        "template_type = COALESCE(:template_type, template_type), "
                        "accessible_pages = COALESCE(:accessible_pages, accessible_pages), "
                        "description = COALESCE(:description, description), "
                        "updated_at = :updated_at "
                        "WHERE id = :id"
                    ),
                    {
                        "id": str(template_id),
                        "content": updates.get("content"),
                        "template_type": updates.get("template_type"),
                        "accessible_pages": updates.get("accessible_pages"),
                        "description": updates.get("description"),
                        "updated_at": datetime.utcnow(),
                    },
                )
            continue

        conn.execute(
            text(
                "INSERT INTO document_template "
                "(id, created_at, updated_at, name, description, template_type, content, is_standard, is_active, accessible_pages, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :template_type, :content, :is_standard, :is_active, :accessible_pages, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": tpl["name"],
                "description": tpl.get("description"),
                "template_type": tpl["template_type"],
                "content": tpl["content"],
                "is_standard": True,
                "is_active": True,
                "accessible_pages": tpl.get("accessible_pages") or "[]",
                "company_id": company_id,
            },
        )
        seeded += 1

    return seeded


def seed_document_templates_for_all_companies(conn) -> dict[str, int]:
    """Backfill the scaffolded document templates for every existing company."""
    if not _table_exists(conn, "company") or not _table_exists(conn, "document_template"):
        return {}

    seeded_by_company: dict[str, int] = {}
    rows = conn.execute(
        text("SELECT company_id FROM company WHERE company_id IS NOT NULL ORDER BY company_id")
    ).fetchall()

    for row in rows:
        cid = str(row[0] or "").strip().upper()
        if not cid:
            continue
        seeded = _seed_document_templates(conn, cid)
        if seeded:
            seeded_by_company[cid] = seeded

    return seeded_by_company


def _seed_roles_and_permissions(conn, company_id: str) -> tuple[int, int, str | None]:
    if not _table_exists(conn, "role") or not _table_exists(conn, "role_permission"):
        return (0, 0, None)

    role_defs = [
        {
            "name": "Operations Manager",
            "description": "Manages day-to-day operations across core modules.",
            "permissions": [
                ("clients", "read"), ("clients", "write"),
                ("inventory", "read"), ("inventory", "write"),
                ("suppliers", "read"), ("suppliers", "write"),
                ("services", "read"), ("services", "write"),
                ("employees", "read"), ("employees", "write"),
                ("schedule", "read"), ("schedule", "write"), ("schedule", "view_all"),
                ("attendance", "read"),
                ("documents", "read"), ("documents", "write"),
                ("reports", "read"),
            ],
        },
        {
            "name": "Front Desk",
            "description": "Handles appointments, client check-in, and basic client updates.",
            "permissions": [
                ("clients", "read"), ("clients", "write"),
                ("services", "read"),
                ("schedule", "read"), ("schedule", "write"),
                ("documents", "read"),
                ("reports", "read"),
            ],
        },
        {
            "name": "Inventory Manager",
            "description": "Maintains inventory, procurement, and stock controls.",
            "permissions": [
                ("inventory", "read"), ("inventory", "write"),
                ("suppliers", "read"), ("suppliers", "write"),
                ("reports", "read"),
            ],
        },
        {
            "name": "Sales Associate",
            "description": "Processes sales and views relevant client and product data.",
            "permissions": [
                ("clients", "read"),
                ("inventory", "read"),
                ("sales", "read"), ("sales", "write"),
                ("services", "read"),
                ("schedule", "read"),
                ("reports", "read"),
            ],
        },
        {
            "name": "Viewer",
            "description": "Read-only access for auditing and oversight.",
            "permissions": [
                ("clients", "read"),
                ("inventory", "read"),
                ("suppliers", "read"),
                ("services", "read"),
                ("employees", "read"),
                ("schedule", "read"),
                ("attendance", "read"),
                ("documents", "read"),
                ("reports", "read"),
            ],
        },
    ]

    roles_created = 0
    perms_created = 0
    viewer_role_id: str | None = None

    for role_def in role_defs:
        role_row = conn.execute(
            text("SELECT id FROM role WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": role_def["name"]},
        ).fetchone()
        if role_row:
            role_id = str(role_row[0])
        else:
            role_id = str(uuid4())
            conn.execute(
                text(
                    "INSERT INTO role (id, created_at, updated_at, name, description, is_system, company_id) "
                    "VALUES (:id, :created_at, :updated_at, :name, :description, :is_system, :company_id)"
                ),
                {
                    "id": role_id,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "name": role_def["name"],
                    "description": role_def["description"],
                    "is_system": True,
                    "company_id": company_id,
                },
            )
            roles_created += 1

        if role_def["name"] == "Viewer":
            viewer_role_id = role_id

        for page, permission in role_def["permissions"]:
            exists = conn.execute(
                text(
                    "SELECT 1 FROM role_permission "
                    "WHERE role_id=:role_id AND page=:page AND CAST(permission AS TEXT)=:permission"
                ),
                {"role_id": role_id, "page": page, "permission": permission},
            ).fetchone()
            if exists:
                continue

            conn.execute(
                text(
                    "INSERT INTO role_permission (id, created_at, updated_at, role_id, page, permission, company_id) "
                    "VALUES (:id, :created_at, :updated_at, :role_id, :page, CAST(:permission AS permissiontype), :company_id)"
                ),
                {
                    "id": str(uuid4()),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "role_id": role_id,
                    "page": page,
                    "permission": permission,
                    "company_id": company_id,
                },
            )
            perms_created += 1

    return (roles_created, perms_created, viewer_role_id)


def _seed_inventory_categories(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "inventory_category"):
        return 0

    categories_by_category = {
        "salon_spa": {
            "product": ["Hair Care", "Skin Care", "Nail Care", "Styling Tools", "Retail Products", "Gift Sets"],
            "resource": ["Shampoos & Conditioners", "Hair Color & Dyes", "Developer", "Foils & Wraps", "Spa Oils & Lotions", "Sanitizers & Disinfectants"],
            "asset": ["Styling Chairs", "Washing Stations", "Hair Dryers & Steamers", "Esthetician Beds", "Manicure Tables", "Pedicure Basins"],
            "location": ["Reception / Retail", "Salon Floor", "Spa Treatment Room", "Shampoo Station", "Back Bar / Supply Room"],
            "item": ["General", "Promotional", "Display", "Samples"],
            "bundle": ["Spa Day Package", "Hair & Treatment Bundle", "Bridal Package"],
            "mix": ["Custom Color Formula", "Custom Treatment Mix"],
        },
        "consulting": {
            "product": ["Client Resources", "Assessment Toolkits", "Strategy Workbooks", "Playbooks", "Training Modules"],
            "resource": ["Workshop Supplies", "Presentation Materials", "Client Binders", "Office Supplies"],
            "asset": ["Facilitation Laptops", "Presentation Displays", "Video Conference Kits", "Projectors"],
            "location": ["Headquarters", "Meeting Room A", "Conference Suite", "Client Site Locker", "Remote / Virtual"],
            "item": ["Reports", "Guides", "Deliverables", "Templates"],
            "bundle": ["Advisory Package", "Leadership Offsite Bundle", "Executive Training Set"],
            "mix": ["Custom Assessment Mix", "Workshop Format Mix"],
        },
        "retail": {
            "product": ["Apparel", "Footwear", "Accessories", "Merchandise", "Seasonal Collection", "New Arrivals", "Clearance"],
            "resource": ["Packaging & Bags", "Price Tags & Labels", "Hangars", "Receipt Paper", "Shipping Boxes"],
            "asset": ["POS Terminals", "Barcode Scanners", "Cash Drawers", "Security Sensors", "Display Racks", "Shelving Units"],
            "location": ["Sales Floor", "Display Window", "Stockroom", "Warehouse Shelf", "Cash Register / Counter"],
            "item": ["General Merchandise", "Promo Goods", "Floor Display", "Overstock"],
            "bundle": ["Value Pack", "Gift Bundle", "Seasonal Outfit Set"],
            "mix": ["Assorted Color Pack", "Multi-Size Pack"],
        },
        "healthcare": {
            "product": ["Wellness Supplements", "Orthopedic Aids", "Skincare & Topicals", "Patient Care Kits"],
            "resource": ["PPE & Gloves", "Exam Table Paper", "Bandages & Gauze", "Antiseptics & Cleansers", "Syringes & Needles", "Specimen Containers"],
            "asset": ["Examination Tables", "Diagnostic Monitors", "Autoclaves", "Ultrasound Equipment", "Wheelchairs", "Vital Signs Monitors"],
            "location": ["Waiting Area", "Exam Room 1", "Exam Room 2", "Treatment Room", "Lab / Triage", "Supply Storage"],
            "item": ["General Supplies", "Patient Education", "Display", "Samples"],
            "bundle": ["Wellness Checkup Package", "New Patient Care Kit", "Therapy Bundle"],
            "mix": ["Custom Prescription Pack", "Therapy Regimen Mix"],
        },
        "general": {
            "product": ["Core Products", "Seasonal", "Clearance", "Accessories", "Samples"],
            "resource": ["Raw Materials", "Packaging", "Consumables", "Office Supplies"],
            "asset": ["Equipment", "Tools", "Devices", "Furniture"],
            "location": ["Front", "Back Room", "Warehouse", "Office"],
            "item": ["General", "Promo", "Display", "Miscellaneous"],
            "bundle": ["Starter Pack", "Bundle", "Gift Set"],
            "mix": ["Custom Mix", "Preset Mix"],
        },
    }

    categories = categories_by_category.get(category_key, categories_by_category["general"])

    inserted = 0
    for item_type, names in categories.items():
        for name in names:
            exists = conn.execute(
                text(
                    "SELECT 1 FROM inventory_category "
                    "WHERE company_id=:cid AND item_type=:item_type AND name=:name"
                ),
                {"cid": company_id, "item_type": item_type, "name": name},
            ).fetchone()
            if exists:
                continue

            conn.execute(
                text(
                    "INSERT INTO inventory_category (id, created_at, item_type, name, company_id) "
                    "VALUES (:id, :created_at, :item_type, :name, :company_id)"
                ),
                {
                    "id": str(uuid4()),
                    "created_at": datetime.utcnow(),
                    "item_type": item_type,
                    "name": name,
                    "company_id": company_id,
                },
            )
            inserted += 1

    return inserted


def _seed_service_categories(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "service_category"):
        return 0

    specs_by_category = {
        "salon_spa": [
            ("Hair Services", "Haircuts, styling, coloring, and treatments"),
            ("Skin Care & Facials", "Deep cleansing, rejuvenation, and facial treatments"),
            ("Nail Care", "Manicures, pedicures, and nail art"),
            ("Massage & Body", "Therapeutic massages and body treatments"),
            ("Waxing & Hair Removal", "Face and body hair removal services"),
            ("Special Packages", "Bridal, event, and complete day packages"),
        ],
        "consulting": [
            ("Strategy & Advisory", "Executive strategy, board advisory, and roadmap planning"),
            ("Operations & Process", "Operational efficiency, operating model review, and audits"),
            ("Change Management", "Organizational transformation, stakeholder alignment, and training"),
            ("Analysis & Research", "Market research, financial modeling, and performance analytics"),
            ("Workshops & Facilitation", "Interactive team workshops, offsites, and training sessions"),
            ("Retainer Services", "Ongoing monthly advisory and on-call consulting"),
        ],
        "retail": [
            ("Customer Services", "Personal shopping, styling consultation, and gift services"),
            ("Alterations & Tailoring", "Garment fitting, hemming, and custom alterations"),
            ("Repairs & Maintenance", "Product cleaning, leather conditioning, and hardware repairs"),
            ("Delivery & Assembly", "Curbside pickup, local delivery, and in-home setup"),
        ],
        "healthcare": [
            ("Consultations & Exams", "Primary consultations, comprehensive wellness exams, and follow-ups"),
            ("Diagnostic Services", "Laboratory screening, vital assessments, and diagnostic testing"),
            ("Therapy & Rehabilitation", "Physical therapy, rehabilitation, and clinical counseling"),
            ("Wellness & Prevention", "Nutritional coaching, preventative health, and lifestyle programs"),
            ("Specialized Procedures", "Targeted outpatient procedures and specialized care"),
        ],
        "general": [
            ("Standard Services", "General client services and core offerings"),
            ("Consultation", "Initial discovery and evaluation sessions"),
            ("Support & Maintenance", "Ongoing support, check-ins, and maintenance"),
        ],
    }

    specs = specs_by_category.get(category_key, specs_by_category["general"])
    inserted = 0
    for name, desc in specs:
        exists = conn.execute(
            text("SELECT 1 FROM service_category WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": name},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text(
                "INSERT INTO service_category (id, created_at, updated_at, name, description, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": name,
                "description": desc,
                "company_id": company_id,
            },
        )
        inserted += 1
    return inserted


def _seed_services(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "service"):
        return 0

    services_by_category = {
        "salon_spa": [
            ("Classic Haircut & Style", "Professional consultation, wash, precision haircut, and blowout.", "Hair Services", 65.0, 45),
            ("Signature Facial", "Deep pore cleansing, exfoliation, hydration, and relaxing facial massage.", "Skin Care & Facials", 95.0, 60),
            ("Deluxe Manicure", "Nail shaping, cuticle grooming, hand massage, and polish.", "Nail Care", 45.0, 30),
            ("Spa Pedicure", "Foot soak, exfoliation, nail care, massage, and polish.", "Nail Care", 55.0, 45),
            ("Deep Tissue Massage", "Targeted muscle tension relief and relaxation therapy.", "Massage & Body", 110.0, 60),
        ],
        "consulting": [
            ("Executive Strategy Advisory", "High-level board and executive strategy advisory session.", "Strategy & Advisory", 250.0, 60),
            ("Operational Process Audit", "Comprehensive operational workflow and process efficiency review.", "Operations & Process", 350.0, 90),
            ("Comprehensive Market Analysis", "Data-driven competitive landscape and market research review.", "Analysis & Research", 400.0, 120),
            ("Team Alignment Workshop", "Facilitated leadership workshop with actionable strategic takeaways.", "Workshops & Facilitation", 1200.0, 240),
            ("Monthly Advisory Check-in", "Scheduled monthly retainer advisory and milestone review.", "Retainer Services", 200.0, 45),
        ],
        "retail": [
            ("Personal Styling Session", "One-on-one wardrobe consultation and personalized outfit selection.", "Customer Services", 50.0, 60),
            ("Custom Garment Alteration", "Precision garment fitting, hemming, and tailoring adjustment.", "Alterations & Tailoring", 35.0, 30),
            ("Premium Gift Wrapping", "Custom artisan gift packaging with ribbon and presentation card.", "Customer Services", 15.0, 15),
            ("White-Glove In-Home Delivery", "Scheduled home delivery with unpacking and placement.", "Delivery & Assembly", 75.0, 45),
        ],
        "healthcare": [
            ("Comprehensive Wellness Exam", "Complete physical health review, vital assessment, and care planning.", "Consultations & Exams", 150.0, 45),
            ("Diagnostic Health Screening", "Targeted clinical diagnostic tests and laboratory panel review.", "Diagnostic Services", 120.0, 30),
            ("Physical Therapy Session", "Custom rehabilitation exercises and therapeutic mobility treatment.", "Therapy & Rehabilitation", 90.0, 45),
            ("Nutrition & Lifestyle Consultation", "Personalized dietary guidance and preventative wellness planning.", "Wellness & Prevention", 80.0, 45),
        ],
        "general": [
            ("Initial Consultation", "Introductory client consultation and needs assessment.", "Consultation", 75.0, 30),
            ("Standard Service Delivery", "Standard professional service fulfillment.", "Standard Services", 120.0, 60),
            ("Premium Support Session", "Dedicated one-on-one technical or advisory support.", "Support & Maintenance", 150.0, 60),
        ],
    }

    specs = services_by_category.get(category_key, services_by_category["general"])
    inserted = 0
    for name, desc, cat, price, duration in specs:
        exists = conn.execute(
            text("SELECT 1 FROM service WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": name},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text(
                "INSERT INTO service (id, created_at, updated_at, name, description, category, price, duration_minutes, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :category, :price, :duration_minutes, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": name,
                "description": desc,
                "category": cat,
                "price": price,
                "duration_minutes": duration,
                "company_id": company_id,
            },
        )
        inserted += 1
    return inserted


def _seed_client_statuses(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "client_status"):
        return 0

    statuses_by_category = {
        "salon_spa": [
            ("New", "First-time salon or spa client"),
            ("Active", "Regular returning client with recent bookings"),
            ("VIP", "Frequent client enrolled in loyalty / VIP tier"),
            ("Inactive", "No appointment bookings in over 6 months"),
        ],
        "consulting": [
            ("Lead", "Prospective client in discovery or proposal stage"),
            ("Active", "Client with an ongoing consulting engagement"),
            ("Retainer", "Client with active recurring advisory agreement"),
            ("Past Client", "Prior engagement successfully completed"),
            ("On Hold", "Engagement paused or awaiting budget approval"),
        ],
        "retail": [
            ("Shopper", "Registered walk-in or retail store customer"),
            ("Loyalty Member", "Customer enrolled in rewards points program"),
            ("VIP Customer", "High-value shopper with premier status"),
            ("Wholesale Account", "B2B commercial purchaser with bulk pricing"),
            ("Inactive", "No purchases recorded in over 6 months"),
        ],
        "healthcare": [
            ("New Intake", "Newly registered patient awaiting initial assessment"),
            ("Active Patient", "Regular patient with ongoing care"),
            ("Under Treatment", "Patient actively undergoing specialized treatment plan"),
            ("Discharged", "Patient who successfully concluded treatment plan"),
            ("Inactive", "No visits or checkups in over 12 months"),
        ],
        "general": [
            ("Lead", "Prospective client or customer"),
            ("Active", "Active client in good standing"),
            ("Inactive", "Dormant or past client"),
        ],
    }

    specs = statuses_by_category.get(category_key, statuses_by_category["general"])
    inserted = 0
    for name, desc in specs:
        exists = conn.execute(
            text("SELECT 1 FROM client_status WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": name},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text(
                "INSERT INTO client_status (id, created_at, updated_at, name, description, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": name,
                "description": desc,
                "company_id": company_id,
            },
        )
        inserted += 1
    return inserted


def _seed_employee_statuses(conn, company_id: str, _category_key: str = "general") -> int:
    if not _table_exists(conn, "employee_status"):
        return 0

    specs = [
        ("Full-Time", "Full-time regular employee"),
        ("Part-Time", "Part-time regular employee"),
        ("Contractor", "Independent contractor or specialist"),
        ("On Leave", "Temporarily on leave of absence"),
        ("Probationary", "New employee during initial review period"),
    ]
    inserted = 0
    for name, desc in specs:
        exists = conn.execute(
            text("SELECT 1 FROM employee_status WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": name},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text(
                "INSERT INTO employee_status (id, created_at, updated_at, name, description, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": name,
                "description": desc,
                "company_id": company_id,
            },
        )
        inserted += 1
    return inserted


def _seed_document_categories_and_statuses(conn, company_id: str, category_key: str = "general") -> tuple[int, int]:
    cat_inserted = 0
    status_inserted = 0

    if _table_exists(conn, "document_category"):
        cats_by_category = {
            "salon_spa": [
                ("Client Intakes", "Intake forms, health histories, and client cards"),
                ("Service Waivers", "Chemical and service consent waivers"),
                ("Staff Certifications", "Cosmetology and esthetician licenses"),
                ("Invoices & Receipts", "Billing and payment documentation"),
            ],
            "consulting": [
                ("Proposals & SOWs", "Client project proposals and statements of work"),
                ("Deliverables & Reports", "Formal client deliverables, audits, and research reports"),
                ("Client Contracts", "Master service agreements and engagement contracts"),
                ("NDAs", "Mutual non-disclosure and confidentiality agreements"),
                ("Strategy Briefs", "Internal and client-facing executive briefs"),
            ],
            "retail": [
                ("Purchase Orders", "Supplier procurement orders and PO receipts"),
                ("Supplier Invoices", "Inbound vendor bills and shipping manifests"),
                ("Inventory Audits", "Stock count records and shrinkage reports"),
                ("Store Policies", "Operating guidelines, return policies, and procedures"),
            ],
            "healthcare": [
                ("Medical Records", "Clinical notes, health histories, and diagnostic reports"),
                ("Consent Forms", "Informed consent and procedural release forms"),
                ("HIPAA Disclosures", "Privacy disclosures and data release authorizations"),
                ("Treatment Plans", "Clinical care plans and physician orders"),
            ],
            "general": [
                ("Contracts", "Agreements, vendor contracts, and leases"),
                ("Invoices", "Invoices, billing, and receipts"),
                ("Policies", "Standard operating procedures and internal policies"),
                ("Reports", "Financial and operational reports"),
            ],
        }
        specs = cats_by_category.get(category_key, cats_by_category["general"])
        for name, desc in specs:
            exists = conn.execute(
                text("SELECT 1 FROM document_category WHERE company_id=:cid AND name=:name"),
                {"cid": company_id, "name": name},
            ).fetchone()
            if exists:
                continue
            conn.execute(
                text(
                    "INSERT INTO document_category (id, created_at, updated_at, name, description, company_id) "
                    "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
                ),
                {
                    "id": str(uuid4()),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "name": name,
                    "description": desc,
                    "company_id": company_id,
                },
            )
            cat_inserted += 1

    if _table_exists(conn, "document_status"):
        statuses = [
            ("Draft", "Initial draft under preparation"),
            ("Under Review", "Pending internal or legal review"),
            ("Pending Signature", "Awaiting client or executive signature"),
            ("Approved", "Fully reviewed and signed off"),
            ("Archived", "Historical record archived for compliance"),
        ]
        for name, desc in statuses:
            exists = conn.execute(
                text("SELECT 1 FROM document_status WHERE company_id=:cid AND name=:name"),
                {"cid": company_id, "name": name},
            ).fetchone()
            if exists:
                continue
            conn.execute(
                text(
                    "INSERT INTO document_status (id, created_at, updated_at, name, description, company_id) "
                    "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
                ),
                {
                    "id": str(uuid4()),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "name": name,
                    "description": desc,
                    "company_id": company_id,
                },
            )
            status_inserted += 1

    return cat_inserted, status_inserted


def _seed_departments(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "department"):
        return 0

    depts_by_category = {
        "salon_spa": [
            ("Stylists", "Hair stylists, colorists, and barbers"),
            ("Estheticians & Skincare", "Facial, skincare, and waxing specialists"),
            ("Nail Technicians", "Manicurists and nail artists"),
            ("Front Desk & Guest Services", "Reception, scheduling, and client concierge"),
            ("Management", "Salon ownership and operational management"),
        ],
        "consulting": [
            ("Advisory", "Management consultants and strategic advisors"),
            ("Analytics & Research", "Data analysts, researchers, and financial modelers"),
            ("Operations", "Engagement delivery and operational management"),
            ("Client Success", "Account managers and client relationship leads"),
            ("Leadership", "Managing partners and practice leads"),
        ],
        "retail": [
            ("Sales Floor", "Retail sales associates and cashiers"),
            ("Inventory & Stock", "Receiving, stockroom, and warehouse staff"),
            ("Merchandising", "Visual display, styling, and product staging"),
            ("Customer Service", "Returns, client inquiries, and support"),
            ("Store Management", "Store managers and shift supervisors"),
        ],
        "healthcare": [
            ("Clinical Staff", "Physicians, specialists, and licensed clinicians"),
            ("Nursing & Triage", "Registered nurses, medical assistants, and phlebotomists"),
            ("Therapy & Rehab", "Physical therapists and clinical counselors"),
            ("Patient Services", "Patient intake, scheduling, and billing"),
            ("Administration", "Practice administration and compliance"),
        ],
        "general": [
            ("Operations", "Day-to-day business operations"),
            ("Sales & Marketing", "Revenue generation and client acquisition"),
            ("Customer Service", "Client care and account support"),
            ("Administration", "Executive management and finance"),
        ],
    }

    specs = depts_by_category.get(category_key, depts_by_category["general"])
    inserted = 0
    for name, desc in specs:
        exists = conn.execute(
            text("SELECT 1 FROM department WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": name},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text(
                "INSERT INTO department (id, created_at, updated_at, name, description, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": name,
                "description": desc,
                "company_id": company_id,
            },
        )
        inserted += 1
    return inserted


def _seed_inventory_items(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "inventory"):
        return 0

    items_by_category = {
        "retail": [
            {"name": "Classic Crewneck Tee", "sku": "RTL-APP-001", "price": 28.0, "cost": 12.0, "qty": 45.0, "min_stock": 15.0, "type": "product", "cat": "Apparel"},
            {"name": "Straight Fit Denim", "sku": "RTL-APP-002", "price": 78.0, "cost": 34.0, "qty": 25.0, "min_stock": 10.0, "type": "product", "cat": "Apparel"},
            {"name": "Leather Crossbody Bag", "sku": "RTL-ACC-003", "price": 120.0, "cost": 48.0, "qty": 12.0, "min_stock": 4.0, "type": "product", "cat": "Accessories"},
            {"name": "Canvas Low-Top Sneakers", "sku": "RTL-FTW-004", "price": 65.0, "cost": 28.0, "qty": 18.0, "min_stock": 6.0, "type": "product", "cat": "Footwear"},
            {"name": "Retail Branded Shopping Bags (Pack 100)", "sku": "RTL-RES-005", "price": 0.0, "cost": 25.0, "qty": 10.0, "min_stock": 3.0, "type": "resource", "cat": "Packaging & Bags"},
        ],
        "salon_spa": [
            {"name": "Botanical Moisturizing Shampoo", "sku": "SAL-PRD-001", "price": 24.0, "cost": 9.0, "qty": 20.0, "min_stock": 6.0, "type": "product", "cat": "Hair Care"},
            {"name": "Deep Nourishing Hair Mask", "sku": "SAL-PRD-002", "price": 32.0, "cost": 12.0, "qty": 15.0, "min_stock": 5.0, "type": "product", "cat": "Hair Care"},
            {"name": "Hydrating Rose Facial Mist", "sku": "SAL-PRD-003", "price": 28.0, "cost": 10.0, "qty": 18.0, "min_stock": 5.0, "type": "product", "cat": "Skin Care"},
            {"name": "Professional Backbar Shampoo (1 Gallon)", "sku": "SAL-RES-004", "price": 0.0, "cost": 22.0, "qty": 8.0, "min_stock": 3.0, "type": "resource", "cat": "Shampoos & Conditioners"},
            {"name": "Single-Use Client Capes (Pack 50)", "sku": "SAL-RES-005", "price": 0.0, "cost": 15.0, "qty": 10.0, "min_stock": 4.0, "type": "resource", "cat": "Sanitizers & Disinfectants"},
        ],
        "consulting": [
            {"name": "Strategic Growth Playbook", "sku": "CNS-PRD-001", "price": 129.0, "cost": 35.0, "qty": 30.0, "min_stock": 10.0, "type": "product", "cat": "Playbooks"},
            {"name": "Executive Assessment Toolkit", "sku": "CNS-PRD-002", "price": 149.0, "cost": 45.0, "qty": 20.0, "min_stock": 5.0, "type": "product", "cat": "Assessment Toolkits"},
            {"name": "Workshop Facilitation Binder Kit", "sku": "CNS-RES-003", "price": 0.0, "cost": 18.0, "qty": 40.0, "min_stock": 12.0, "type": "resource", "cat": "Workshop Supplies"},
        ],
        "healthcare": [
            {"name": "Daily Wellness Multivitamin (60ct)", "sku": "HLT-PRD-001", "price": 34.0, "cost": 12.0, "qty": 30.0, "min_stock": 10.0, "type": "product", "cat": "Wellness Supplements"},
            {"name": "Ergonomic Lumbar Support Cushion", "sku": "HLT-PRD-002", "price": 45.0, "cost": 18.0, "qty": 15.0, "min_stock": 5.0, "type": "product", "cat": "Orthopedic Aids"},
            {"name": "Disposable Exam Gloves (Box 100)", "sku": "HLT-RES-003", "price": 0.0, "cost": 8.5, "qty": 25.0, "min_stock": 8.0, "type": "resource", "cat": "PPE & Gloves"},
            {"name": "Clinical Sanitizing Surface Wipes", "sku": "HLT-RES-004", "price": 0.0, "cost": 6.0, "qty": 30.0, "min_stock": 10.0, "type": "resource", "cat": "Antiseptics & Cleansers"},
        ],
        "general": [
            {"name": "Core Product A", "sku": "GEN-PRD-001", "price": 49.0, "cost": 20.0, "qty": 25.0, "min_stock": 10.0, "type": "product", "cat": "Core Products"},
            {"name": "Office Supply Starter Kit", "sku": "GEN-RES-002", "price": 0.0, "cost": 15.0, "qty": 20.0, "min_stock": 5.0, "type": "resource", "cat": "Office Supplies"},
        ],
    }

    specs = items_by_category.get(category_key, items_by_category["general"])
    inserted = 0
    has_cost = _table_exists(conn, "inventory_cost")

    for item in specs:
        exists = conn.execute(
            text("SELECT id FROM inventory WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": item["name"]},
        ).fetchone()
        if exists:
            continue

        item_id = str(uuid4())
        now = datetime.utcnow()
        conn.execute(
            text(
                "INSERT INTO inventory "
                "(id, created_at, updated_at, name, sku, price, cost, quantity, min_stock_level, type, category, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :sku, :price, :cost, :quantity, :min_stock_level, :type, :category, :company_id)"
            ),
            {
                "id": item_id,
                "created_at": now,
                "updated_at": now,
                "name": item["name"],
                "sku": item["sku"],
                "price": item["price"],
                "cost": item["cost"],
                "quantity": item["qty"],
                "min_stock_level": item["min_stock"],
                "type": item["type"],
                "category": item["cat"],
                "company_id": company_id,
            },
        )
        inserted += 1

        if has_cost:
            cost_exists = conn.execute(
                text("SELECT 1 FROM inventory_cost WHERE inventory_id = :iid"),
                {"iid": item_id},
            ).fetchone()
            if not cost_exists:
                conn.execute(
                    text(
                        "INSERT INTO inventory_cost "
                        "(id, created_at, updated_at, inventory_id, standard_cost, actual_cost, acquisition_cost, "
                        "reorder_quantity, reorder_point, lead_time_days, company_id) "
                        "VALUES (:id, :created_at, :updated_at, :iid, :cost, :cost, :cost, :rq, :rp, 7, :cid)"
                    ),
                    {
                        "id": str(uuid4()),
                        "created_at": now,
                        "updated_at": now,
                        "iid": item_id,
                        "cost": item["cost"],
                        "rq": max(int(item["min_stock"] * 2), 5),
                        "rp": int(item["min_stock"]),
                        "cid": company_id,
                    },
                )

    return inserted


def _seed_app_settings(conn, company_id: str, category_key: str = "general") -> int:
    if not _table_exists(conn, "app_settings"):
        return 0

    presets_by_category = {
        "salon_spa": {
            "start": "08:00",
            "end": "19:00",
            "title": "Beauty, Wellness & Style",
            "subtitle": "Book appointments with our professional stylists and specialists.",
            "tagline": "Your premier destination for salon and spa care.",
        },
        "consulting": {
            "start": "08:30",
            "end": "17:30",
            "title": "Strategic Advisory Services",
            "subtitle": "Partner with experienced consultants to accelerate your business growth.",
            "tagline": "Clarity. Strategy. Execution.",
        },
        "retail": {
            "start": "09:00",
            "end": "21:00",
            "title": "Curated Retail & Apparel",
            "subtitle": "Explore our latest collections, seasonal arrivals, and member exclusives.",
            "tagline": "Quality goods crafted for every style.",
        },
        "healthcare": {
            "start": "08:00",
            "end": "17:00",
            "title": "Comprehensive Health & Wellness",
            "subtitle": "Schedule consultations and manage your health journey with our care team.",
            "tagline": "Dedicated to compassionate, preventative patient care.",
        },
        "general": {
            "start": "08:00",
            "end": "18:00",
            "title": "Client Services Portal",
            "subtitle": "Book appointments, explore services, and manage your account.",
            "tagline": "Professional solutions tailored for your needs.",
        },
    }

    preset = presets_by_category.get(category_key, presets_by_category["general"])

    company_name = company_id
    if _table_exists(conn, "company"):
        c_row = conn.execute(
            text("SELECT name FROM company WHERE company_id = :cid"),
            {"cid": company_id},
        ).fetchone()
        if c_row and c_row[0]:
            company_name = str(c_row[0])

    existing = conn.execute(
        text("SELECT id, portal_hero_title FROM app_settings WHERE company_id = :cid"),
        {"cid": company_id},
    ).fetchone()

    if existing:
        settings_id, current_title = existing
        if not current_title:
            conn.execute(
                text(
                    "UPDATE app_settings SET "
                    "portal_hero_title = COALESCE(portal_hero_title, :title), "
                    "portal_hero_subtitle = COALESCE(portal_hero_subtitle, :subtitle), "
                    "portal_hero_tagline = COALESCE(portal_hero_tagline, :tagline), "
                    "updated_at = :updated_at "
                    "WHERE id = :id"
                ),
                {
                    "id": str(settings_id),
                    "title": preset["title"],
                    "subtitle": preset["subtitle"],
                    "tagline": preset["tagline"],
                    "updated_at": datetime.utcnow(),
                },
            )
            return 1
        return 0

    now = datetime.utcnow()
    conn.execute(
        text(
            "INSERT INTO app_settings "
            "(id, created_at, updated_at, start_of_day, end_of_day, attendance_check_in_required, "
            "monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled, friday_enabled, "
            "saturday_enabled, sunday_enabled, company_name, company_id, "
            "portal_hero_title, portal_hero_subtitle, portal_hero_tagline, portal_show_hero) "
            "VALUES (:id, :ca, :ca, :start, :end, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, "
            ":cname, :cid, :title, :subtitle, :tagline, TRUE)"
        ),
        {
            "id": str(uuid4()),
            "ca": now,
            "start": preset["start"],
            "end": preset["end"],
            "cname": company_name,
            "cid": company_id,
            "title": preset["title"],
            "subtitle": preset["subtitle"],
            "tagline": preset["tagline"],
        },
    )
    return 1


def _seed_discount_rules(conn, company_id: str) -> int:
    if not _table_exists(conn, "discount_rule"):
        return 0

    rules = [
        {
            "name": "Welcome Offer",
            "applies_to": "all",
            "discount_type": "percentage",
            "discount_value": 10.0,
            "is_recurring": False,
            "is_active": True,
        },
        {
            "name": "Midweek Promo",
            "applies_to": "all",
            "discount_type": "percentage",
            "discount_value": 15.0,
            "is_recurring": True,
            "recur_frequency": "weekly",
            "recur_days": '["Tue","Wed"]',
            "day_start_time": "09:00",
            "day_end_time": "16:00",
            "is_active": True,
        },
        {
            "name": "Clearance Markdown",
            "applies_to": "selected",
            "discount_type": "fixed",
            "discount_value": 5.0,
            "item_ids": "[]",
            "is_recurring": False,
            "is_active": True,
        },
    ]

    inserted = 0
    for rule in rules:
        exists = conn.execute(
            text("SELECT 1 FROM discount_rule WHERE company_id=:cid AND name=:name"),
            {"cid": company_id, "name": rule["name"]},
        ).fetchone()
        if exists:
            continue

        conn.execute(
            text(
                "INSERT INTO discount_rule "
                "(id, created_at, updated_at, name, applies_to, item_ids, discount_type, discount_value, "
                "start_date, end_date, is_recurring, recur_frequency, recur_days, recur_count, times_per_day, "
                "day_start_time, day_end_time, is_active, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :applies_to, :item_ids, :discount_type, :discount_value, "
                ":start_date, :end_date, :is_recurring, :recur_frequency, :recur_days, :recur_count, :times_per_day, "
                ":day_start_time, :day_end_time, :is_active, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": rule["name"],
                "applies_to": rule.get("applies_to", "all"),
                "item_ids": rule.get("item_ids"),
                "discount_type": rule.get("discount_type", "percentage"),
                "discount_value": rule.get("discount_value", 0.0),
                "start_date": None,
                "end_date": None,
                "is_recurring": rule.get("is_recurring", False),
                "recur_frequency": rule.get("recur_frequency"),
                "recur_days": rule.get("recur_days"),
                "recur_count": None,
                "times_per_day": None,
                "day_start_time": rule.get("day_start_time"),
                "day_end_time": rule.get("day_end_time"),
                "is_active": rule.get("is_active", True),
                "company_id": company_id,
            },
        )
        inserted += 1

    return inserted


def _seed_saved_report_filters(conn, company_id: str, admin_user_id: str | None) -> int:
    if not admin_user_id or not _table_exists(conn, "saved_report_filter"):
        return 0

    filters = [
        {
            "name": "Weekly Revenue Snapshot",
            "report_id": "revenue",
            "date_range": "last7days",
            "group_by": "day",
            "chart_type": "line",
        },
        {
            "name": "Monthly Appointment Volume",
            "report_id": "appointments",
            "date_range": "last30days",
            "group_by": "week",
            "chart_type": "bar",
        },
        {
            "name": "Low Inventory Watch",
            "report_id": "inventory",
            "date_range": "all",
            "group_by": "month",
            "chart_type": "bar",
        },
        {
            "name": "Payroll Trend",
            "report_id": "payroll",
            "date_range": "last90days",
            "group_by": "month",
            "chart_type": "line",
        },
    ]

    inserted = 0
    for item in filters:
        exists = conn.execute(
            text(
                "SELECT 1 FROM saved_report_filter "
                "WHERE company_id=:cid AND user_id=:uid AND name=:name"
            ),
            {"cid": company_id, "uid": admin_user_id, "name": item["name"]},
        ).fetchone()
        if exists:
            continue

        conn.execute(
            text(
                "INSERT INTO saved_report_filter "
                "(id, created_at, updated_at, user_id, company_id, name, report_id, date_range, group_by, chart_type, "
                "status_filter, employee_id, service_id, event_type, additional_filters_json) "
                "VALUES (:id, :created_at, :updated_at, :user_id, :company_id, :name, :report_id, :date_range, :group_by, :chart_type, "
                ":status_filter, :employee_id, :service_id, :event_type, :additional_filters_json)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "user_id": admin_user_id,
                "company_id": company_id,
                "name": item["name"],
                "report_id": item["report_id"],
                "date_range": item.get("date_range"),
                "group_by": item.get("group_by"),
                "chart_type": item.get("chart_type"),
                "status_filter": None,
                "employee_id": None,
                "service_id": None,
                "event_type": None,
                "additional_filters_json": None,
            },
        )
        inserted += 1

    return inserted


def _apply_pto_defaults(conn, company_id: str) -> int:
    if not _table_exists(conn, "user"):
        return 0

    result = conn.execute(
        text(
            "UPDATE \"user\" SET "
            "vacation_days = COALESCE(vacation_days, 10), "
            "sick_days = COALESCE(sick_days, 5), "
            "vacation_days_used = COALESCE(vacation_days_used, 0), "
            "sick_days_used = COALESCE(sick_days_used, 0) "
            "WHERE company_id = :cid"
        ),
        {"cid": company_id},
    )
    return int(result.rowcount or 0)


def seed_company_scaffold(
    conn,
    company_id: str,
    admin_user_id: str | None = None,
    business_category: str | None = None,
) -> dict:
    """Seed baseline records for a newly created company.

    Notes:
    - Idempotent by design.
    - Does not seed suppliers (left intentionally empty).
    - Tailors item categories, service categories, services, client statuses,
      employee statuses, document categories/statuses, departments, templates,
      sample inventory items with thresholds, and app settings presets based
      on the company's business_category.
    """
    cid = (company_id or "").strip().upper()
    if not cid:
        raise ValueError("company_id is required for scaffold seeding")

    if business_category is None and _table_exists(conn, "company"):
        row = conn.execute(
            text("SELECT business_category FROM company WHERE company_id=:cid"),
            {"cid": cid},
        ).fetchone()
        if row and row[0]:
            business_category = str(row[0])

    category_key = normalize_business_category(business_category)

    templates_seeded = _seed_document_templates(conn, cid, category_key)
    roles_created, perms_created, _viewer_role_id = _seed_roles_and_permissions(conn, cid)
    categories_seeded = _seed_inventory_categories(conn, cid, category_key)
    service_categories_seeded = _seed_service_categories(conn, cid, category_key)
    services_seeded = _seed_services(conn, cid, category_key)
    client_statuses_seeded = _seed_client_statuses(conn, cid, category_key)
    employee_statuses_seeded = _seed_employee_statuses(conn, cid, category_key)
    doc_categories_seeded, doc_statuses_seeded = _seed_document_categories_and_statuses(conn, cid, category_key)
    departments_seeded = _seed_departments(conn, cid, category_key)
    inventory_items_seeded = _seed_inventory_items(conn, cid, category_key)
    app_settings_seeded = _seed_app_settings(conn, cid, category_key)
    discount_rules_seeded = _seed_discount_rules(conn, cid)
    report_filters_seeded = _seed_saved_report_filters(conn, cid, admin_user_id)
    users_pto_defaulted = _apply_pto_defaults(conn, cid)

    return {
        "business_category": category_key,
        "templates_seeded": templates_seeded,
        "roles_created": roles_created,
        "role_permissions_created": perms_created,
        "inventory_categories_seeded": categories_seeded,
        "service_categories_seeded": service_categories_seeded,
        "services_seeded": services_seeded,
        "client_statuses_seeded": client_statuses_seeded,
        "employee_statuses_seeded": employee_statuses_seeded,
        "document_categories_seeded": doc_categories_seeded,
        "document_statuses_seeded": doc_statuses_seeded,
        "departments_seeded": departments_seeded,
        "inventory_items_seeded": inventory_items_seeded,
        "app_settings_seeded": app_settings_seeded,
        "discount_rules_seeded": discount_rules_seeded,
        "report_filters_seeded": report_filters_seeded,
        "users_pto_defaulted": users_pto_defaulted,
    }
