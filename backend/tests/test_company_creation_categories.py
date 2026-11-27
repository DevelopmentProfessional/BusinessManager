"""Tests for company creation business categories and tailored database defaults."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from backend.company_scaffold import (
    BUSINESS_CATEGORIES,
    _load_template_seed_rows,
    normalize_business_category,
    seed_company_scaffold,
)
from backend.models import Company
from backend.routers.company_registration import (
    CompanyInfo,
    CompanyRegistrationRequest,
    CompanyRegistrationResponse,
    CompanyStatusUpdate,
)


def test_normalize_business_category():
    # Salon / Beauty / Spa variations
    assert normalize_business_category("salon_spa") == "salon_spa"
    assert normalize_business_category("Salon / Beauty / Spa") == "salon_spa"
    assert normalize_business_category("hair_salon") == "salon_spa"
    assert normalize_business_category("Beauty Spa") == "salon_spa"
    assert normalize_business_category("Nail Studio") == "salon_spa"

    # Consulting / Professional Services variations
    assert normalize_business_category("consulting") == "consulting"
    assert normalize_business_category("Consulting / Professional Services") == "consulting"
    assert normalize_business_category("Strategic Advisory") == "consulting"
    assert normalize_business_category("Professional Services") == "consulting"

    # Retail / Store / Inventory variations
    assert normalize_business_category("retail") == "retail"
    assert normalize_business_category("Retail / Store / Inventory") == "retail"
    assert normalize_business_category("Clothing Store") == "retail"
    assert normalize_business_category("Apparel Shop") == "retail"

    # Healthcare / Wellness variations
    assert normalize_business_category("healthcare") == "healthcare"
    assert normalize_business_category("Healthcare / Wellness") == "healthcare"
    assert normalize_business_category("Wellness Clinic") == "healthcare"
    assert normalize_business_category("Medical Care") == "healthcare"

    # Fallback to general
    assert normalize_business_category(None) == "general"
    assert normalize_business_category("") == "general"
    assert normalize_business_category("General / Other") == "general"
    assert normalize_business_category("manufacturing_specialist") == "general"


def test_business_categories_map_contains_required_options():
    assert "salon_spa" in BUSINESS_CATEGORIES
    assert "consulting" in BUSINESS_CATEGORIES
    assert "retail" in BUSINESS_CATEGORIES
    assert "healthcare" in BUSINESS_CATEGORIES
    assert "general" in BUSINESS_CATEGORIES


def test_template_seed_rows_tailored_by_category():
    consulting_templates = _load_template_seed_rows("consulting")
    consulting_names = {t["name"] for t in consulting_templates}
    assert "Project Proposal & Scope of Work" in consulting_names
    assert "Deliverable Sign-Off" in consulting_names
    assert "Client Retainer Agreement" in consulting_names
    assert "Mutual Non-Disclosure Agreement (NDA)" in consulting_names

    salon_templates = _load_template_seed_rows("salon_spa")
    salon_names = {t["name"] for t in salon_templates}
    assert "Client Service Waiver & Consent" in salon_names
    assert "Hair Care Aftercare Guide" in salon_names
    assert "Skin Treatment Post-Care Instructions" in salon_names

    retail_templates = _load_template_seed_rows("retail")
    retail_names = {t["name"] for t in retail_templates}
    assert "Store Return & Exchange Policy" in retail_names
    assert "Daily Inventory Count Sheet" in retail_names
    assert "Wholesale Purchase Agreement" in retail_names

    healthcare_templates = _load_template_seed_rows("healthcare")
    healthcare_names = {t["name"] for t in healthcare_templates}
    assert "Patient Medical Intake & Consent" in healthcare_names
    assert "Treatment Plan Summary" in healthcare_names
    assert "Health & Wellness Follow-up" in healthcare_names

    # Common standard templates are present across all
    for templates in (consulting_templates, salon_templates, retail_templates, healthcare_templates):
        names = {t["name"] for t in templates}
        assert "Late Payment Notice" in names
        assert "Appointment Reminder" in names
        assert "Pay Slip" in names


class FakeConnection:
    """Mock connection that tracks executed SQL statements and emulates tables."""

    def __init__(self, existing_records=None, tables=None):
        self.statements = []
        self.inserted = []
        self.existing_records = existing_records or set()
        self.tables = tables or {
            "company",
            "document_template",
            "role",
            "role_permission",
            "inventory_category",
            "service_category",
            "service",
            "client_status",
            "employee_status",
            "document_category",
            "document_status",
            "department",
            "inventory",
            "inventory_cost",
            "app_settings",
            "discount_rule",
            "saved_report_filter",
            "user",
        }

    def execute(self, statement, parameters=None):
        sql = str(statement).strip()
        params = parameters or {}
        self.statements.append((sql, params))

        # Table existence checks
        if "information_schema.tables" in sql:
            t = params.get("t")
            exists = t in self.tables if t else True
            return SimpleNamespace(scalar=lambda: exists, fetchone=lambda: (1,) if exists else None)

        # Company category lookup
        if "SELECT business_category FROM company" in sql:
            return SimpleNamespace(fetchone=lambda: (None,))

        # Company name lookup
        if "SELECT name FROM company" in sql:
            return SimpleNamespace(fetchone=lambda: ("Test Company",))

        # Check existing checks (SELECT 1 FROM ...)
        if sql.startswith("SELECT") and "FROM" in sql:
            key = None
            if "FROM inventory_category" in sql:
                key = ("inventory_category", params.get("cid"), params.get("item_type"), params.get("name"))
            elif "FROM service_category" in sql:
                key = ("service_category", params.get("cid"), params.get("name"))
            elif "FROM service" in sql:
                key = ("service", params.get("cid"), params.get("name"))
            elif "FROM client_status" in sql:
                key = ("client_status", params.get("cid"), params.get("name"))
            elif "FROM employee_status" in sql:
                key = ("employee_status", params.get("cid"), params.get("name"))
            elif "FROM document_category" in sql:
                key = ("document_category", params.get("cid"), params.get("name"))
            elif "FROM document_status" in sql:
                key = ("document_status", params.get("cid"), params.get("name"))
            elif "FROM department" in sql:
                key = ("department", params.get("cid"), params.get("name"))
            elif "FROM inventory" in sql:
                key = ("inventory", params.get("cid"), params.get("name"))
            elif "FROM document_template" in sql:
                key = ("document_template", params.get("cid"), params.get("name"))
            elif "FROM discount_rule" in sql:
                key = ("discount_rule", params.get("cid"), params.get("name"))
            elif "FROM role" in sql:
                key = ("role", params.get("cid"), params.get("name"))
            elif "FROM app_settings" in sql:
                key = ("app_settings", params.get("cid"))

            if key and key in self.existing_records:
                if key[0] == "document_template":
                    return SimpleNamespace(
                        fetchone=lambda: (str(uuid4()), "content", "memo", "[]", "desc"),
                        fetchall=lambda: [(1,)],
                    )
                return SimpleNamespace(
                    fetchone=lambda: (str(uuid4()), "Existing Title" if "app_settings" in sql else None),
                    fetchall=lambda: [(1,)],
                )
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])

        # INSERT operations
        if sql.startswith("INSERT INTO"):
            self.inserted.append((sql, params))
            # Track newly inserted records
            if "INSERT INTO inventory_category" in sql:
                self.existing_records.add(("inventory_category", params.get("company_id"), params.get("item_type"), params.get("name")))
            elif "INSERT INTO service_category" in sql:
                self.existing_records.add(("service_category", params.get("company_id"), params.get("name")))
            elif "INSERT INTO service " in sql:
                self.existing_records.add(("service", params.get("company_id"), params.get("name")))
            elif "INSERT INTO client_status" in sql:
                self.existing_records.add(("client_status", params.get("company_id"), params.get("name")))
            elif "INSERT INTO employee_status" in sql:
                self.existing_records.add(("employee_status", params.get("company_id"), params.get("name")))
            elif "INSERT INTO document_category" in sql:
                self.existing_records.add(("document_category", params.get("company_id"), params.get("name")))
            elif "INSERT INTO document_status" in sql:
                self.existing_records.add(("document_status", params.get("company_id"), params.get("name")))
            elif "INSERT INTO department" in sql:
                self.existing_records.add(("department", params.get("company_id"), params.get("name")))
            elif "INSERT INTO inventory " in sql:
                self.existing_records.add(("inventory", params.get("company_id"), params.get("name")))
            elif "INSERT INTO document_template" in sql:
                self.existing_records.add(("document_template", params.get("company_id"), params.get("name")))
            elif "INSERT INTO app_settings" in sql:
                self.existing_records.add(("app_settings", params.get("cid")))

            return SimpleNamespace(rowcount=1)

        # UPDATE operations
        if sql.startswith("UPDATE"):
            return SimpleNamespace(rowcount=1)

        return SimpleNamespace(rowcount=0, fetchone=lambda: None, fetchall=lambda: [])


def test_seed_company_scaffold_salon_spa():
    conn = FakeConnection()
    res = seed_company_scaffold(conn, "SALON1", business_category="Salon / Beauty / Spa")

    assert res["business_category"] == "salon_spa"
    assert res["inventory_categories_seeded"] > 0
    assert res["service_categories_seeded"] > 0
    assert res["services_seeded"] > 0
    assert res["client_statuses_seeded"] > 0
    assert res["departments_seeded"] > 0
    assert res["inventory_items_seeded"] > 0

    inserted_names = [p.get("name") for _sql, p in conn.inserted if "name" in p]
    assert "Hair Care" in inserted_names
    assert "Skin Care" in inserted_names
    assert "Hair Services" in inserted_names
    assert "Nail Care" in inserted_names
    assert "Classic Haircut & Style" in inserted_names
    assert "Stylists" in inserted_names
    assert "VIP" in inserted_names


def test_seed_company_scaffold_consulting():
    conn = FakeConnection()
    res = seed_company_scaffold(conn, "CNSLT1", business_category="consulting")

    assert res["business_category"] == "consulting"
    assert res["services_seeded"] > 0
    assert res["client_statuses_seeded"] > 0

    inserted_names = [p.get("name") for _sql, p in conn.inserted if "name" in p]
    assert "Client Resources" in inserted_names
    assert "Strategy & Advisory" in inserted_names
    assert "Executive Strategy Advisory" in inserted_names
    assert "Lead" in inserted_names
    assert "Retainer" in inserted_names
    assert "Advisory" in inserted_names
    assert "Project Proposal & Scope of Work" in inserted_names


def test_seed_company_scaffold_retail():
    conn = FakeConnection()
    res = seed_company_scaffold(conn, "RETAIL1", business_category="retail")

    assert res["business_category"] == "retail"
    assert res["inventory_items_seeded"] > 0

    inserted_names = [p.get("name") for _sql, p in conn.inserted if "name" in p]
    assert "Apparel" in inserted_names
    assert "Footwear" in inserted_names
    assert "Accessories" in inserted_names
    assert "Personal Styling Session" in inserted_names
    assert "Shopper" in inserted_names
    assert "Loyalty Member" in inserted_names
    assert "Wholesale Account" in inserted_names
    assert "Sales Floor" in inserted_names
    assert "Store Return & Exchange Policy" in inserted_names

    # Verify inventory item reorder thresholds
    inventory_inserts = [p for sql, p in conn.inserted if "INSERT INTO inventory " in sql]
    assert any(item["min_stock_level"] >= 10 for item in inventory_inserts if item["sku"].startswith("RTL-APP"))


def test_seed_company_scaffold_healthcare():
    conn = FakeConnection()
    res = seed_company_scaffold(conn, "HLTH01", business_category="Healthcare / Wellness")

    assert res["business_category"] == "healthcare"
    inserted_names = [p.get("name") for _sql, p in conn.inserted if "name" in p]
    assert "Wellness Supplements" in inserted_names
    assert "Consultations & Exams" in inserted_names
    assert "Comprehensive Wellness Exam" in inserted_names
    assert "Active Patient" in inserted_names
    assert "New Intake" in inserted_names
    assert "Clinical Staff" in inserted_names
    assert "Patient Medical Intake & Consent" in inserted_names


def test_seed_company_scaffold_idempotency():
    conn = FakeConnection()
    res1 = seed_company_scaffold(conn, "IDEMP1", business_category="salon_spa")
    count_first_run = len(conn.inserted)
    assert count_first_run > 0

    # Second run on the same company should insert 0 duplicates
    res2 = seed_company_scaffold(conn, "IDEMP1", business_category="salon_spa")
    assert res2["inventory_categories_seeded"] == 0
    assert res2["service_categories_seeded"] == 0
    assert res2["services_seeded"] == 0
    assert res2["client_statuses_seeded"] == 0
    assert res2["departments_seeded"] == 0
    assert res2["inventory_items_seeded"] == 0


def test_company_registration_schemas():
    req = CompanyRegistrationRequest(
        company_id="TESTCO",
        company_name="Test Company",
        business_category="salon_spa",
        admin_username="testadmin",
        admin_password="password123",
    )
    assert req.business_category == "salon_spa"

    resp = CompanyRegistrationResponse(
        ok=True,
        company_id="TESTCO",
        company_name="Test Company",
        admin_username="testadmin",
        business_category="salon_spa",
        message="Registration submitted.",
    )
    assert resp.business_category == "salon_spa"

    info = CompanyInfo(
        company_id="TESTCO",
        name="Test Company",
        business_category="salon_spa",
        is_active=False,
    )
    assert info.business_category == "salon_spa"

    update = CompanyStatusUpdate(
        status="approved",
        business_category="consulting",
    )
    assert update.business_category == "consulting"


def test_company_model_stores_business_category():
    c = Company(
        company_id="CO1",
        name="Company 1",
        business_category="retail",
    )
    assert c.business_category == "retail"
