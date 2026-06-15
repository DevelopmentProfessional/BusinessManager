#!/usr/bin/env python3.11
"""
One-time migration: clients, services, schedule from Render (lavish_beauty_db) -> AWS.
- All records assigned company_id = 03200
- Missing services/clients are inserted first
- Existing services/clients are mapped by normalized name
- Schedule rows from cutoff are remapped to target client/service IDs
- Schedule rows are assigned to the target employee and forced to status='scheduled'
"""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

OLD_DB = os.getenv(
    "MIGRATION_OLD_DATABASE_URL",
    "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db",
)
COMPANY_ID = os.getenv("MIGRATION_COMPANY_ID", "03200")
CUTOFF_DATE = os.getenv("MIGRATION_CUTOFF_DATE", "2026-05-22")
TARGET_EMPLOYEE_NAME = os.getenv("MIGRATION_TARGET_EMPLOYEE_NAME", "Tameshia Pinto")
TARGET_EMPLOYEE_USERNAME = os.getenv("MIGRATION_TARGET_USERNAME", "tpinto")
REPLACE_SCHEDULE_WINDOW = os.getenv("MIGRATION_REPLACE_SCHEDULE_WINDOW", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "y",
    "on",
}


def normalize_name(value):
    return (value or "").strip().lower()


def clear_global_ssl_env_overrides():
    # EC2 shells may export global libpq SSL settings that override connection behavior.
    for key in ("PGSSLMODE", "PGSSLROOTCERT"):
        os.environ.pop(key, None)


def normalize_postgres_url(url):
    url = (url or "").strip()
    if url.startswith("postgresql+psycopg://"):
        return "postgresql://" + url[len("postgresql+psycopg://") :]
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def apply_target_ssl_options(url):
    sslmode = os.getenv("MIGRATION_NEW_DB_SSLMODE", "").strip()
    sslrootcert = os.getenv("MIGRATION_NEW_DB_SSLROOTCERT", "").strip()

    if not url or (not sslmode and not sslrootcert):
        return url

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))

    if sslmode and "sslmode" not in query:
        query["sslmode"] = sslmode
    if sslrootcert and "sslrootcert" not in query:
        query["sslrootcert"] = sslrootcert.replace("\\", "/")

    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def get_target_db_url():
    configured_url = (
        os.getenv("MIGRATION_NEW_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    return apply_target_ssl_options(normalize_postgres_url(configured_url))


def resolve_target_employee_id(new_conn):
    with new_conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "user" WHERE company_id = %s AND (first_name || \' \' || last_name) = %s',
            (COMPANY_ID, TARGET_EMPLOYEE_NAME),
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                'SELECT id FROM "user" WHERE company_id = %s AND username = %s',
                (COMPANY_ID, TARGET_EMPLOYEE_USERNAME),
            )
            row = cur.fetchone()
        if not row:
            cur.execute(
                'SELECT id FROM "user" WHERE (first_name || \' \' || last_name) = %s',
                (TARGET_EMPLOYEE_NAME,),
            )
            row = cur.fetchone()
        if not row:
            cur.execute(
                'SELECT id FROM "user" WHERE username = %s',
                (TARGET_EMPLOYEE_USERNAME,),
            )
            row = cur.fetchone()
        if not row:
            raise RuntimeError(
                f"Target employee not found: {TARGET_EMPLOYEE_NAME} / {TARGET_EMPLOYEE_USERNAME}"
            )
        return row["id"]


def fetch_source_schedule_rows(old_conn):
    with old_conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM schedule WHERE appointment_date >= %s ORDER BY appointment_date ASC",
            (CUTOFF_DATE,),
        )
        return cur.fetchall()


def get_columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
            (table,)
        )
        return {row["column_name"] for row in cur.fetchall()}


def get_target_name_to_id(new_conn, table):
    with new_conn.cursor() as cur:
        cur.execute(
            f'SELECT id, name FROM "{table}" WHERE company_id = %s',
            (COMPANY_ID,),
        )
        return {normalize_name(row["name"]): row["id"] for row in cur.fetchall() if row.get("name")}


def apply_entity_defaults(table, record):
    if table == "client":
        if not record.get("membership_tier"):
            record["membership_tier"] = "none"
        if record.get("membership_points") is None:
            record["membership_points"] = 0
        if record.get("email_verified") is None:
            record["email_verified"] = False
    elif table == "service":
        if record.get("price") is None:
            record["price"] = 0.0
        if record.get("duration_minutes") is None:
            record["duration_minutes"] = 60
    return record


def migrate_entities_with_mapping(new_conn, table, rows):
    if not rows:
        print(f"  No rows found in {table}")
        return 0, {}

    new_cols = get_columns(new_conn, table)
    usable = list(set(rows[0].keys()) & new_cols)
    if "company_id" in new_cols and "company_id" not in usable:
        usable.append("company_id")

    name_to_target_id = get_target_name_to_id(new_conn, table)
    id_map = {}

    inserted = 0
    errors = 0

    with new_conn.cursor() as cur:
        for row in rows:
            source_id = row.get("id")
            source_name = row.get("name")
            normalized_name = normalize_name(source_name)

            if source_id in id_map:
                continue
            if normalized_name and normalized_name in name_to_target_id:
                id_map[source_id] = name_to_target_id[normalized_name]
                continue

            record = {c: row.get(c) for c in usable}
            record["company_id"] = COMPANY_ID
            record = apply_entity_defaults(table, record)

            cols_sql = ", ".join(f'"{c}"' for c in record)
            placeholders = ", ".join(["%s"] * len(record))
            vals = list(record.values())

            try:
                cur.execute("SAVEPOINT row_sp")
                cur.execute(
                    f'INSERT INTO "{table}" ({cols_sql}) VALUES ({placeholders}) '
                    f"ON CONFLICT (id) DO NOTHING",
                    vals,
                )
                cur.execute("RELEASE SAVEPOINT row_sp")

                if cur.rowcount > 0:
                    inserted += 1
                    id_map[source_id] = source_id
                    if normalized_name:
                        name_to_target_id[normalized_name] = source_id
                elif normalized_name and normalized_name in name_to_target_id:
                    id_map[source_id] = name_to_target_id[normalized_name]
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Warning [{table}] row {record.get('id')}: {e}")
                cur.execute("ROLLBACK TO SAVEPOINT row_sp")
                cur.execute("RELEASE SAVEPOINT row_sp")
                continue

        new_conn.commit()

    print(
        f"  Inserted {inserted}/{len(rows)} rows ({errors} skipped/errored, {len(id_map)} mapped total)"
    )
    return inserted, id_map


def migrate_schedule_rows(
    new_conn,
    schedules,
    source_client_name_by_id,
    source_service_name_by_id,
    source_service_duration_by_id,
    client_id_map,
    service_id_map,
    employee_id,
):
    if not schedules:
        print("  No rows found in schedule")
        return 0

    new_cols = get_columns(new_conn, "schedule")
    inserted = 0
    errors = 0
    skipped_client = 0
    skipped_service = 0
    deleted = 0

    target_client_name_to_id = get_target_name_to_id(new_conn, "client")
    target_service_name_to_id = get_target_name_to_id(new_conn, "service")

    with new_conn.cursor() as cur:
        if REPLACE_SCHEDULE_WINDOW:
            cur.execute(
                "DELETE FROM schedule WHERE company_id = %s AND appointment_date >= %s",
                (COMPANY_ID, CUTOFF_DATE),
            )
            deleted = cur.rowcount

        for row in schedules:
            source_client_id = row.get("client_id")
            source_service_id = row.get("service_id")

            target_client_id = client_id_map.get(source_client_id)
            if not target_client_id:
                source_client_name = source_client_name_by_id.get(source_client_id)
                target_client_id = target_client_name_to_id.get(normalize_name(source_client_name))

            target_service_id = service_id_map.get(source_service_id)
            if not target_service_id:
                source_service_name = source_service_name_by_id.get(source_service_id)
                target_service_id = target_service_name_to_id.get(normalize_name(source_service_name))

            if not target_client_id:
                skipped_client += 1
                continue
            if not target_service_id:
                skipped_service += 1
                continue

            record = {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "client_id": target_client_id,
                "service_id": target_service_id,
                "employee_id": employee_id,
                "appointment_date": row.get("appointment_date"),
                "status": "scheduled",
                "notes": row.get("notes"),
                "appointment_type": "one_time",
                "duration_minutes": source_service_duration_by_id.get(source_service_id, 60),
                "recurrence_frequency": None,
                "recurrence_end_date": None,
                "recurrence_count": None,
                "parent_schedule_id": None,
                "is_recurring_master": False,
                "is_paid": False,
                "discount": 0.0,
                "sale_transaction_id": None,
                "task_type": "service",
                "production_item_id": None,
                "production_quantity": 1,
                "company_id": COMPANY_ID,
            }

            record = {key: value for key, value in record.items() if key in new_cols}

            cols_sql = ", ".join(f'"{c}"' for c in record)
            placeholders = ", ".join(["%s"] * len(record))
            vals = list(record.values())

            try:
                cur.execute("SAVEPOINT row_sp")
                cur.execute(
                    f'INSERT INTO "schedule" ({cols_sql}) VALUES ({placeholders}) '
                    f"ON CONFLICT (id) DO NOTHING",
                    vals,
                )
                cur.execute("RELEASE SAVEPOINT row_sp")
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Warning [schedule] row {record.get('id')}: {e}")
                cur.execute("ROLLBACK TO SAVEPOINT row_sp")
                cur.execute("RELEASE SAVEPOINT row_sp")
                continue

        new_conn.commit()

    if REPLACE_SCHEDULE_WINDOW:
        print(f"  Deleted existing schedule rows in window: {deleted}")
    print(
        f"  Inserted {inserted}/{len(schedules)} rows "
        f"({errors} insert errors, {skipped_client} missing clients, {skipped_service} missing services)"
    )
    return inserted


def main():
    clear_global_ssl_env_overrides()

    new_db = get_target_db_url()

    if not new_db:
        raise RuntimeError(
            "Target AWS database URL is not configured. Set MIGRATION_NEW_DATABASE_URL or DATABASE_URL."
        )

    print("Connecting to databases...")
    with psycopg.connect(OLD_DB, row_factory=dict_row, connect_timeout=30) as old_conn, \
         psycopg.connect(new_db, row_factory=dict_row, connect_timeout=15) as new_conn:

        employee_id = resolve_target_employee_id(new_conn)
        print(f"Resolved {TARGET_EMPLOYEE_NAME} / {TARGET_EMPLOYEE_USERNAME} -> {employee_id}")

        # ── Services ────────────────────────────────────────────────────────
        print("\n[1/3] Migrating services and building source->target map...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM service")
            services = cur.fetchall()
        print(f"  Found {len(services)} services in old DB")
        _, service_id_map = migrate_entities_with_mapping(new_conn, "service", services)

        source_service_duration_by_id = {
            row["id"]: row.get("duration_minutes") or 60 for row in services
        }
        source_service_name_by_id = {row["id"]: row.get("name") for row in services}

        # ── Clients ─────────────────────────────────────────────────────────
        print("\n[2/3] Migrating clients and building source->target map...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM client")
            clients = cur.fetchall()
        print(f"  Found {len(clients)} clients in old DB")
        _, client_id_map = migrate_entities_with_mapping(new_conn, "client", clients)
        source_client_name_by_id = {row["id"]: row.get("name") for row in clients}

        # ── Schedule ─────────────────────────────────────────────────────────
        print("\n[3/3] Migrating schedule with mapped client/service IDs...")
        schedules = fetch_source_schedule_rows(old_conn)
        print(f"  Found {len(schedules)} schedule records in old DB on/after {CUTOFF_DATE}")
        migrate_schedule_rows(
            new_conn,
            schedules,
            source_client_name_by_id,
            source_service_name_by_id,
            source_service_duration_by_id,
            client_id_map,
            service_id_map,
            employee_id,
        )

        print("\nMigration complete.")


if __name__ == "__main__":
    main()
