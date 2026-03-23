"""
Audit API-to-database table coverage.

This script compares live database tables with registered FastAPI routes and
reports which tables appear to have CRUD endpoint coverage. The goal is to
highlight missing coverage early so troubleshooting is easier.

Usage:
    python backend/scripts/api_table_coverage_audit.py
    python backend/scripts/api_table_coverage_audit.py --fail-on-missing
    python backend/scripts/api_table_coverage_audit.py --json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Iterable

from fastapi.routing import APIRoute
from sqlalchemy import inspect as sa_inspect


# Make sure we can import the backend package when run as a script.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.database import engine  # noqa: E402
from backend.main import app  # noqa: E402


IGNORE_TABLES = {
    "schema_migration",
}

# Manual aliases for routes that do not use the exact table name.
TABLE_ALIASES: dict[str, set[str]] = {
    "user": {"users", "employees", "auth"},
    "inventory": {"inventory", "products", "assets"},
    "document": {"documents"},
    "document_template": {"templates"},
    "leave_request": {"leave-requests", "leave_requests"},
    "sale_transaction": {"sales", "transactions"},
    "sale_transaction_item": {"sales", "transactions", "items"},
    "chat_message": {"chat", "messages"},
    "appsettings": {"settings"},
    "databaseconnection": {"database-connections", "database_connections"},
}


@dataclass
class RouteRecord:
    path: str
    methods: set[str]
    segments: set[str]


def normalize_token(value: str) -> str:
    return value.strip().lower().replace("-", "_")


def singularize(value: str) -> str:
    if value.endswith("ies") and len(value) > 3:
        return value[:-3] + "y"
    if value.endswith("ses") and len(value) > 3:
        return value[:-2]
    if value.endswith("s") and len(value) > 1:
        return value[:-1]
    return value


def pluralize(value: str) -> str:
    if value.endswith("y") and len(value) > 1 and value[-2] not in "aeiou":
        return value[:-1] + "ies"
    if value.endswith("s"):
        return value
    return value + "s"


def build_aliases_for_table(table_name: str) -> set[str]:
    aliases = {normalize_token(table_name)}

    base = normalize_token(table_name)
    aliases.add(pluralize(base))
    aliases.add(singularize(base))

    if "_" in base:
        compact = base.replace("_", "")
        aliases.add(compact)
        parts = base.split("_")
        aliases.update(parts)

        if len(parts) >= 2:
            # Include simple plural of the final segment for names like
            # leave_request -> leave_requests.
            aliases.add("_".join(parts[:-1] + [pluralize(parts[-1])]))

    aliases.update(normalize_token(a) for a in TABLE_ALIASES.get(table_name, set()))
    return aliases


def collect_routes() -> list[RouteRecord]:
    records: list[RouteRecord] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue

        path = route.path
        if not path.startswith("/api/v1"):
            continue

        segments = set()
        for raw in path.strip("/").split("/"):
            if not raw or raw.startswith("{"):
                continue
            segments.add(normalize_token(raw))
            segments.add(normalize_token(singularize(raw)))

        records.append(
            RouteRecord(
                path=path,
                methods={m.upper() for m in route.methods if m.upper() != "HEAD"},
                segments=segments,
            )
        )
    return records


def collect_tables() -> list[str]:
    inspector = sa_inspect(engine)
    return sorted(
        t for t in inspector.get_table_names() if normalize_token(t) not in IGNORE_TABLES
    )


def evaluate_table_coverage(table_name: str, routes: Iterable[RouteRecord]) -> dict:
    aliases = build_aliases_for_table(table_name)

    matched_routes: list[RouteRecord] = []
    methods: set[str] = set()

    for route in routes:
        if aliases & route.segments:
            matched_routes.append(route)
            methods.update(route.methods)

    crud_flags = {
        "read": "GET" in methods,
        "create": "POST" in methods,
        "update": "PUT" in methods or "PATCH" in methods,
        "delete": "DELETE" in methods,
    }
    crud_score = sum(1 for value in crud_flags.values() if value)

    return {
        "table": table_name,
        "aliases": sorted(aliases),
        "crud": crud_flags,
        "crud_score": crud_score,
        "matched_route_count": len(matched_routes),
        "matched_routes": sorted(
            [
                {
                    "path": r.path,
                    "methods": sorted(r.methods),
                }
                for r in matched_routes
            ],
            key=lambda x: x["path"],
        ),
    }


def build_report() -> dict:
    routes = collect_routes()
    tables = collect_tables()

    table_results = [evaluate_table_coverage(table, routes) for table in tables]

    no_routes = [r for r in table_results if r["matched_route_count"] == 0]
    partial_crud = [r for r in table_results if 0 < r["crud_score"] < 4]
    full_crud = [r for r in table_results if r["crud_score"] == 4]

    return {
        "summary": {
            "table_count": len(tables),
            "api_route_count": len(routes),
            "tables_with_no_routes": len(no_routes),
            "tables_with_partial_crud": len(partial_crud),
            "tables_with_full_crud": len(full_crud),
        },
        "tables_with_no_routes": no_routes,
        "tables_with_partial_crud": partial_crud,
        "tables_with_full_crud": full_crud,
        "all_tables": table_results,
    }


def print_human_report(report: dict) -> None:
    summary = report["summary"]
    print("\n=== API Table Coverage Audit ===")
    print(f"Tables discovered:       {summary['table_count']}")
    print(f"API routes discovered:   {summary['api_route_count']}")
    print(f"No route coverage:       {summary['tables_with_no_routes']}")
    print(f"Partial CRUD coverage:   {summary['tables_with_partial_crud']}")
    print(f"Full CRUD coverage:      {summary['tables_with_full_crud']}")

    if report["tables_with_no_routes"]:
        print("\nTables with NO matching API routes:")
        for item in report["tables_with_no_routes"]:
            print(f"  - {item['table']}")

    if report["tables_with_partial_crud"]:
        print("\nTables with PARTIAL CRUD route coverage:")
        for item in report["tables_with_partial_crud"]:
            crud = item["crud"]
            status = (
                f"R:{'Y' if crud['read'] else 'N'} "
                f"C:{'Y' if crud['create'] else 'N'} "
                f"U:{'Y' if crud['update'] else 'N'} "
                f"D:{'Y' if crud['delete'] else 'N'}"
            )
            print(f"  - {item['table']} ({status})")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit API-to-table coverage")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output full report as JSON",
    )
    parser.add_argument(
        "--fail-on-missing",
        action="store_true",
        help="Exit with code 1 if any table has no matching API route",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report()

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_human_report(report)

    if args.fail_on_missing and report["summary"]["tables_with_no_routes"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
