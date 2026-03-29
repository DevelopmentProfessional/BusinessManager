"""
db_schema.py — Print all tables and their columns from the Render PostgreSQL database.

Usage:
    python db_schema.py              # uses the Render database URL from db_config
    python db_schema.py --json       # output as JSON
    python db_schema.py --table user # show only the 'user' table
"""

import sys
import json as json_mod
import argparse

sys.path.insert(0, "backend")

from db_config import get_database_url, get_current_environment
from sqlalchemy import create_engine, inspect, text


def get_engine():
    url = get_database_url()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url, echo=False)


def get_schema(engine, filter_table: str = None) -> dict:
    inspector = inspect(engine)
    tables = inspector.get_table_names(schema="public")
    if filter_table:
        tables = [t for t in tables if t == filter_table]

    schema = {}
    for table in sorted(tables):
        cols = inspector.get_columns(table, schema="public")
        schema[table] = [
            {
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col.get("nullable", True),
            }
            for col in cols
        ]
    return schema


def print_schema(schema: dict):
    sep = "-" * 60
    for table, cols in schema.items():
        print(f"\n{sep}")
        print(f"  TABLE: {table}  ({len(cols)} columns)")
        print(sep)
        for col in cols:
            nullable = "" if col["nullable"] else " NOT NULL"
            print(f"    {col['name']:<35} {col['type']}{nullable}")


def main():
    parser = argparse.ArgumentParser(description="Print DB schema (tables + columns)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--table", metavar="NAME", help="Show only this table")
    args = parser.parse_args()

    env = get_current_environment()
    print(f"Environment: {env}", file=sys.stderr)

    engine = get_engine()
    schema = get_schema(engine, filter_table=args.table)

    if not schema:
        print("No tables found." if not args.table else f"Table '{args.table}' not found.")
        return

    if args.json:
        print(json_mod.dumps(schema, indent=2))
    else:
        sep = "-" * 60
        print_schema(schema)
        print(f"\n{sep}")
        print(f"  Total: {len(schema)} table(s)")
        print(sep)


if __name__ == "__main__":
    main()
