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


def test_task_action_path_migration_adds_column(monkeypatch):
    statements = []

    class Result:
        def fetchone(self):
            return None

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

    database._ensure_task_action_path_column_if_needed()

    assert any("ALTER TABLE task ADD COLUMN action_path VARCHAR" in statement for statement in statements)


def test_service_task_automation_migration_adds_columns_and_unique_index(monkeypatch):
    statements = []

    class Result:
        def fetchone(self):
            return None

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

    database._ensure_service_task_automation_schema_if_needed()

    assert any("ALTER TABLE service ADD COLUMN task_automation_json TEXT" in statement for statement in statements)
    assert any("ALTER TABLE task ADD COLUMN source_schedule_id UUID" in statement for statement in statements)
    assert any("ALTER TABLE task ADD COLUMN automation_rule_id VARCHAR" in statement for statement in statements)
    assert any("CREATE UNIQUE INDEX IF NOT EXISTS uq_task_schedule_automation_rule" in statement for statement in statements)


def test_procurement_catalog_migration_adds_line_snapshots(monkeypatch):
    statements = []

    class Result:
        def scalar(self):
            return True

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

    database._ensure_procurement_catalog_columns_if_needed()

    assert any("ADD COLUMN supplier_product_id UUID REFERENCES supplier_product(id)" in statement for statement in statements)
    assert any("ADD COLUMN purchase_unit VARCHAR NOT NULL DEFAULT 'unit'" in statement for statement in statements)
    assert any("ADD COLUMN units_per_purchase_unit INTEGER NOT NULL DEFAULT 1" in statement for statement in statements)


def test_inventory_packaging_migration_moves_supplier_fields(monkeypatch):
    statements = []

    class Result:
        def __init__(self, rows=(), scalar=None, row=None):
            self.rows = rows
            self.scalar_value = scalar
            self.row = row

        def fetchall(self):
            return self.rows

        def scalar(self):
            return self.scalar_value

        def fetchone(self):
            return self.row

    class Connection:
        def execute(self, statement, _parameters=None):
            sql = str(statement)
            statements.append(sql)
            if "table_name='inventory'" in sql and "SELECT column_name" in sql:
                return Result(rows=[("id",), ("cost",)])
            if "table_name='supplier_product'" in sql and "SELECT column_name" in sql:
                return Result(rows=[
                    ("id",),
                    ("created_at",),
                    ("is_preferred",),
                    ("purchase_unit",),
                    ("units_per_purchase_unit",),
                    ("unit_price",),
                ])
            if "inventory_purchase_unit')" in sql:
                return Result(scalar=True)
            if "SELECT DISTINCT ON (i.company_id" in sql:
                return Result(rows=[])
            return Result(row=None)

    class Transaction:
        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            return False

    class Engine:
        def begin(self):
            return Transaction()

    monkeypatch.setattr(database, "engine", Engine())

    database._ensure_inventory_purchase_packaging_columns_if_needed()

    assert any("ADD COLUMN purchase_unit VARCHAR(80)" in statement for statement in statements)
    assert any("ADD COLUMN units_per_purchase_unit INTEGER" in statement for statement in statements)
    assert any("UPDATE inventory i SET" in statement and "chosen.unit_price" in statement for statement in statements)
    assert any("DROP COLUMN purchase_unit" in statement for statement in statements)
    assert any("DROP COLUMN units_per_purchase_unit" in statement for statement in statements)
    assert any("DROP COLUMN unit_price" in statement for statement in statements)


def test_addon_columns_are_repaired_before_schema_fast_path(monkeypatch):
    calls = []

    monkeypatch.setattr(database.SQLModel.metadata, "create_all", lambda engine: calls.append("create_all"))
    monkeypatch.setattr(
        database,
        "_ensure_user_undo_action_table_if_needed",
        lambda: calls.append("repair_undo_action"),
    )
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
        "_ensure_task_action_path_column_if_needed",
        lambda: calls.append("repair_task_action_path"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_fifo_stock_movement_schema_if_needed",
        lambda: calls.append("repair_fifo_stock_movement"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_fractional_inventory_schema_if_needed",
        lambda: calls.append("repair_fractional_inventory"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_client_auth_columns_if_needed",
        lambda: calls.append("repair_client_auth"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_contact_email_verification_columns_if_needed",
        lambda: calls.append("repair_contact_email"),
    )
    monkeypatch.setattr(
        database,
        "_ensure_app_settings_core_columns_if_needed",
        lambda: calls.append("repair_app_settings_core"),
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
        "repair_undo_action",
        "repair_addons",
        "repair_permissions",
        "repair_compensation",
        "seed_templates",
        "repair_task_action_path",
        "repair_fifo_stock_movement",
        "repair_fractional_inventory",
        "repair_client_auth",
        "repair_contact_email",
        "repair_app_settings_core",
        "schema_current",
        "required_artifacts",
    ]


def test_supplier_shipping_and_visibility_migration_adds_columns(monkeypatch):
    statements = []

    class Result:
        def __init__(self, data=None):
            self.data = data or []

        def scalar(self):
            return True

        def fetchall(self):
            return self.data

    class Connection:
        def execute(self, statement, _parameters=None):
            sql = str(statement)
            statements.append(sql)
            if "information_schema.tables" in sql:
                return Result([True])
            if "information_schema.columns" in sql:
                return Result([])
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

    database._ensure_supplier_shipping_and_category_tax_columns_if_needed()

    assert any("ALTER TABLE supplier ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE" in statement for statement in statements)
    assert any("ALTER TABLE supplier ADD COLUMN shipping_rate_type VARCHAR NOT NULL DEFAULT 'fixed'" in statement for statement in statements)
    assert any("ALTER TABLE supplier ADD COLUMN shipping_rate DOUBLE PRECISION NOT NULL DEFAULT 0" in statement for statement in statements)


def test_discount_rule_deal_type_migration_adds_column(monkeypatch):
    statements = []

    class Result:
        def __init__(self, data=None):
            self.data = data or []

        def scalar(self):
            return True

        def fetchone(self):
            return None

    class Connection:
        def execute(self, statement, _parameters=None):
            sql = str(statement)
            statements.append(sql)
            if "to_regclass" in sql:
                return Result([True])
            if "information_schema.columns" in sql:
                return Result(None)
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

    database._ensure_discount_rule_table_if_needed()

    assert any("ALTER TABLE discount_rule ADD COLUMN deal_type VARCHAR NOT NULL DEFAULT 'product'" in statement for statement in statements)


def test_03200_appointment_backfill_executes_packaged_sql_and_reads_marker():
    from backend.migrations import backfill_03200_appointments as migration

    statements = []
    details = {
        "past_appointments": 4,
        "new_sales_created": 3,
        "existing_sales_reused": 1,
    }

    class Result:
        def scalar_one(self):
            return details

    class Connection:
        def exec_driver_sql(self, statement):
            statements.append(statement)

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

    result = migration.run_migration(Engine())

    assert result == {"status": "completed", "details": details}
    assert len(statements) == 2
    assert "DO $$" in statements[0]
    assert "WHERE migration_key = :migration_key" in statements[1]


def test_03200_appointment_backfill_sql_is_scoped_and_price_independent():
    from pathlib import Path

    from backend.migrations import backfill_03200_appointments as migration

    sql_path = Path(migration.__file__).with_name("backfill_03200_appointment_sales.sql")
    sql = sql_path.read_text(encoding="utf-8")

    assert "pg_advisory_xact_lock(3200, 20261126)" in sql
    assert "s.company_id = '03200'" in sql
    assert "s.appointment_date::date" in sql
    assert "s.is_recurring_master IS NOT TRUE" in sql
    assert "NOT IN ('cancelled', 'canceled')" in sql
    assert "UPDATE schedule s" in sql
    assert "INSERT INTO sale_transaction (" in sql
    assert "payment_method = 'cash'" in sql
    assert "UPDATE service" not in sql


def test_database_calls_03200_appointment_backfill(monkeypatch):
    called = []

    from backend.migrations import backfill_03200_appointments as migration

    monkeypatch.setattr(migration, "run_migration", lambda _engine: called.append("backfill") or {"status": "completed"})

    database._backfill_03200_past_appointments_if_needed()

    assert called == ["backfill"]



