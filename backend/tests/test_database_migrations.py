from backend import database


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
        "schema_current",
        "required_artifacts",
    ]