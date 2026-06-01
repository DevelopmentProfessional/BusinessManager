"""Company scaffold helpers for seeding baseline company data.

This module is intentionally idempotent so it can run during company creation
and again on approval/retry without creating duplicate records.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import text


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:t)"
        ),
        {"t": table_name},
    ).scalar()
    return bool(row)


def _load_template_seed_rows() -> list[dict]:
    """Load built-in templates from templates router and append scaffold extras."""
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
    ]

    by_name: dict[str, dict] = {}
    for tpl in standard_templates + extra_templates:
        by_name[str(tpl.get("name", ""))] = tpl
    return list(by_name.values())


def _seed_document_templates(conn, company_id: str) -> int:
    if not _table_exists(conn, "document_template"):
        return 0

    seeded = 0
    for tpl in _load_template_seed_rows():
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


def _seed_inventory_categories(conn, company_id: str) -> int:
    if not _table_exists(conn, "inventory_category"):
        return 0

    categories = {
        "product": ["Core Products", "Seasonal", "Clearance", "Accessories", "Samples"],
        "resource": ["Raw Materials", "Packaging", "Consumables", "Office Supplies"],
        "asset": ["Equipment", "Tools", "Devices", "Furniture"],
        "location": ["Front", "Back Room", "Warehouse", "Office"],
        "item": ["General", "Promo", "Display", "Miscellaneous"],
        "bundle": ["Starter Pack", "Bundle", "Gift Set"],
        "mix": ["Custom Mix", "Preset Mix"],
    }

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


def _seed_discount_rules(conn, company_id: str) -> int:
    if not _table_exists(conn, "discount_rule"):
        return 0

    rules = [
        {
            "name": "Welcome Offer",
            "description": "Starter discount for first-time campaigns.",
            "applies_to": "all",
            "discount_type": "percentage",
            "discount_value": 10.0,
            "is_recurring": False,
            "is_active": True,
        },
        {
            "name": "Midweek Promo",
            "description": "Recurring promotion for slower weekdays.",
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
            "description": "Fixed amount markdown for clearing overstock.",
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
                "(id, created_at, updated_at, name, description, applies_to, item_ids, discount_type, discount_value, "
                "start_date, end_date, is_recurring, recur_frequency, recur_days, recur_count, times_per_day, "
                "day_start_time, day_end_time, is_active, company_id) "
                "VALUES (:id, :created_at, :updated_at, :name, :description, :applies_to, :item_ids, :discount_type, :discount_value, "
                ":start_date, :end_date, :is_recurring, :recur_frequency, :recur_days, :recur_count, :times_per_day, "
                ":day_start_time, :day_end_time, :is_active, :company_id)"
            ),
            {
                "id": str(uuid4()),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "name": rule["name"],
                "description": rule.get("description"),
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


def seed_company_scaffold(conn, company_id: str, admin_user_id: str | None = None) -> dict:
    """Seed baseline records for a newly created company.

    Notes:
    - Idempotent by design.
    - Does not seed suppliers (left intentionally empty).
    """
    cid = (company_id or "").strip().upper()
    if not cid:
        raise ValueError("company_id is required for scaffold seeding")

    templates_seeded = _seed_document_templates(conn, cid)
    roles_created, perms_created, _viewer_role_id = _seed_roles_and_permissions(conn, cid)
    categories_seeded = _seed_inventory_categories(conn, cid)
    discount_rules_seeded = _seed_discount_rules(conn, cid)
    report_filters_seeded = _seed_saved_report_filters(conn, cid, admin_user_id)
    users_pto_defaulted = _apply_pto_defaults(conn, cid)

    return {
        "templates_seeded": templates_seeded,
        "roles_created": roles_created,
        "role_permissions_created": perms_created,
        "inventory_categories_seeded": categories_seeded,
        "discount_rules_seeded": discount_rules_seeded,
        "report_filters_seeded": report_filters_seeded,
        "users_pto_defaulted": users_pto_defaulted,
    }
