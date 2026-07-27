#!/usr/bin/env python
"""Compare PostgreSQL schema against all SQLModel tables in backend.models."""

from sqlmodel import SQLModel
from sqlalchemy import inspect

import backend.models  # noqa: F401  # Ensure all model tables are registered
from backend.database import engine


def main() -> int:
    inspector = inspect(engine)

    db_tables = set(inspector.get_table_names(schema="public"))
    model_tables = set(SQLModel.metadata.tables.keys())

    shared_tables = sorted(db_tables & model_tables)
    db_only_tables = sorted(db_tables - model_tables)
    model_only_tables = sorted(model_tables - db_tables)

    mismatch_count = 0
    for table_name in shared_tables:
        db_cols = {col["name"] for col in inspector.get_columns(table_name, schema="public")}
        model_cols = set(SQLModel.metadata.tables[table_name].columns.keys())

        db_only_cols = sorted(db_cols - model_cols)
        model_only_cols = sorted(model_cols - db_cols)

        if db_only_cols or model_only_cols:
            mismatch_count += 1
            print(f"\nMISMATCH {table_name}")
            if db_only_cols:
                print("  DB only: " + ", ".join(db_only_cols))
            if model_only_cols:
                print("  Model only: " + ", ".join(model_only_cols))

    print(f"\nShared tables checked: {len(shared_tables)}")
    print(f"DB-only tables: {len(db_only_tables)}")
    if db_only_tables:
        print("  -> " + ", ".join(db_only_tables[:20]) + (" ..." if len(db_only_tables) > 20 else ""))
    print(f"Model-only tables: {len(model_only_tables)}")
    if model_only_tables:
        print("  -> " + ", ".join(model_only_tables[:20]) + (" ..." if len(model_only_tables) > 20 else ""))
    print(f"Column mismatches in shared tables: {mismatch_count}")

    return 1 if (db_only_tables or model_only_tables or mismatch_count) else 0


if __name__ == "__main__":
    raise SystemExit(main())
