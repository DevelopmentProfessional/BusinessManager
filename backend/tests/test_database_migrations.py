from backend import database
from backend.models import UserPermission


def test_permissiontype_storage_labels_include_payment_permissions():
    labels = set(UserPermission.__table__.c.permission.type.enums)

    assert "APPROVE_PAYMENTS" in labels
    assert "INITIATE_REFUNDS" in labels
    assert "approve_payments" not in labels


def test_permissiontype_migration_uses_storage_labels(monkeypatch):
    statements = []

    class Connection:
        def execute(self, statement):
            statements.append(str(statement))

    class Transaction:
        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            return False

    class Engine:
        def begin(self):
            return Transaction()

    monkeypatch.setattr(database, "engine", Engine())

    database._ensure_permissiontype_enum_values_if_needed()

    assert "ALTER TYPE permissiontype ADD VALUE IF NOT EXISTS 'APPROVE_PAYMENTS'" in statements
    assert not any("'approve_payments'" in statement for statement in statements)


def test_payroll_compensation_migration_adds_settings_and_snapshots(monkeypatch):
    statements = []

    class Result:
        def fetchall(self):
            return []

    class Connection:
        def execute(self, statement, _parameters=None):
            statements.append(str(statement))
            return Result()

    class Transaction:
        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            return False

    class Engine:
        def begin(self):
            return Transaction()

    monkeypatch.setattr(database, "engine", Engine())

    database._ensure_payroll_compensation_columns_if_needed()

    assert any("employee_pay_schedule ADD COLUMN base_pay " in statement for statement in statements)
    assert any("employee_pay_schedule ADD COLUMN compensation_percentage " in statement for statement in statements)
    assert any("employee_pay_schedule ADD COLUMN base_pay_included " in statement for statement in statements)
    assert any("pay_slip ADD COLUMN service_revenue " in statement for statement in statements)
    assert any("pay_slip ADD COLUMN base_pay_snapshot " in statement for statement in statements)


def test_addon_columns_are_repaired_before_schema_fast_path(monkeypatch):
    calls = []

    monkeypatch.setattr(database.SQLModel.metadata, "create_all", lambda engine: calls.append("create_all"))
    monkeypatch.setattr(
        database,
        "_ensure_service_and_schedule_addons_if_needed",
        lambda: calls.append("repair_addons"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_permissiontype_enum_values_if_needed",
        lambda: calls.append("repair_permissions"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_payroll_compensation_columns_if_needed",
        lambda: calls.append("repair_compensation"),
    )
    monkeypatch.setattr(
        database,
        "_seed_document_templates_for_existing_companies_if_needed",
        lambda: calls.append("seed_templates"),
    )
    monkeypatch.setattr(
        database,
        "_schema_is_current",
        lambda: calls.append("schema_current") or True,
    )
    monkeypatch.setattr(
        database,
        "_required_schema_artifacts_present",
        lambda: calls.append("required_artifacts") or True,
    )

    database.create_db_and_tables()

    assert calls == [
        "create_all",
        "repair_addons",
        "repair_permissions",
        "repair_compensation",
        "seed_templates",
        "schema_current",
        "required_artifacts",
    ]