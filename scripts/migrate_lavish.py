#!/usr/bin/env python3.11
"""
One-time migration: clients, services, schedule from Render (lavish_beauty_db) -> AWS.
- All records assigned company_id = 03200
- All schedule records assigned to employee tpinto
- ON CONFLICT (id) DO NOTHING — safe to re-run
"""

import os

import psycopg
from psycopg.rows import dict_row

OLD_DB = os.getenv(
    "MIGRATION_OLD_DATABASE_URL",
    "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db",
)
NEW_DB = os.getenv(
    "MIGRATION_NEW_DATABASE_URL",
    "postgresql://businessmanager:BizMgr0cfc1d86d23b1df4abc12918X@businessmanager-db.ckz8auiccetx.us-east-1.rds.amazonaws.com:5432/businessmanager",
)
COMPANY_ID = os.getenv("MIGRATION_COMPANY_ID", "03200")
TARGET_USERNAME = os.getenv("MIGRATION_TARGET_USERNAME", "tpinto")


def get_columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
            (table,)
        )
        return {row["column_name"] for row in cur.fetchall()}


def migrate_table(old_conn, new_conn, table, rows, extra_overrides=None):
    if not rows:
        print(f"  No rows found in {table}")
        return 0

    new_cols = get_columns(new_conn, table)
    old_cols = set(rows[0].keys())
    usable = list(old_cols & new_cols)

    if "company_id" in new_cols:
        if "company_id" not in usable:
            usable.append("company_id")

    inserted = 0
    errors = 0

    with new_conn.cursor() as cur:
        for row in rows:
            record = {c: row.get(c) for c in usable}
            record["company_id"] = COMPANY_ID
            if extra_overrides:
                record.update(extra_overrides)

            cols_sql = ", ".join(f'"{c}"' for c in record)
            placeholders = ", ".join(["%s"] * len(record))
            vals = list(record.values())

            try:
                cur.execute(
                    f'INSERT INTO "{table}" ({cols_sql}) VALUES ({placeholders}) '
                    f"ON CONFLICT (id) DO NOTHING",
                    vals,
                )
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Warning [{table}] row {record.get('id')}: {e}")
                new_conn.rollback()
                continue

        new_conn.commit()

    print(f"  Inserted {inserted}/{len(rows)} rows ({errors} skipped/errored)")
    return inserted


def migrate_schedule_rows(old_conn, new_conn, schedules, service_duration_by_id, employee_id):
    if not schedules:
        print("  No rows found in schedule")
        return 0

    new_cols = get_columns(new_conn, "schedule")
    inserted = 0
    errors = 0

    with new_conn.cursor() as cur:
        for row in schedules:
            service_id = row.get("service_id")
            record = {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "client_id": row.get("client_id"),
                "service_id": service_id,
                "employee_id": employee_id,
                "appointment_date": row.get("appointment_date"),
                "status": row.get("status") or "scheduled",
                "notes": row.get("notes"),
                "appointment_type": "one_time",
                "duration_minutes": service_duration_by_id.get(service_id, 60),
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
                cur.execute(
                    f'INSERT INTO "schedule" ({cols_sql}) VALUES ({placeholders}) '
                    f"ON CONFLICT (id) DO NOTHING",
                    vals,
                )
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Warning [schedule] row {record.get('id')}: {e}")
                new_conn.rollback()
                continue

        new_conn.commit()

    print(f"  Inserted {inserted}/{len(schedules)} rows ({errors} skipped/errored)")
    return inserted


def main():
    print("Connecting to databases...")
    with psycopg.connect(OLD_DB, row_factory=dict_row, connect_timeout=30) as old_conn, \
         psycopg.connect(NEW_DB, row_factory=dict_row, connect_timeout=15) as new_conn:

        # Resolve tpinto's UUID
        with new_conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM "user" WHERE username = %s AND company_id = %s',
                (TARGET_USERNAME, COMPANY_ID)
            )
            row = cur.fetchone()
            if not row:
                cur.execute('SELECT id FROM "user" WHERE username = %s', (TARGET_USERNAME,))
                row = cur.fetchone()
            if not row:
                print(f"ERROR: user '{TARGET_USERNAME}' not found in the database. Aborting.")
                return
            tpinto_id = row["id"]
            print(f"Resolved {TARGET_USERNAME} -> {tpinto_id}")

        # ── Services ────────────────────────────────────────────────────────
        print("\n[1/3] Migrating services...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM service")
            services = cur.fetchall()
        print(f"  Found {len(services)} services in old DB")
        migrate_table(old_conn, new_conn, "service", services)

        service_duration_by_id = {
            row["id"]: row.get("duration_minutes") or 60
            for row in services
        }

        # ── Clients ─────────────────────────────────────────────────────────
        print("\n[2/3] Migrating clients...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM client")
            clients = cur.fetchall()
        print(f"  Found {len(clients)} clients in old DB")
        migrate_table(old_conn, new_conn, "client", clients)

        # ── Schedule ─────────────────────────────────────────────────────────
        print("\n[3/3] Migrating schedule...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM schedule")
            schedules = cur.fetchall()
        print(f"  Found {len(schedules)} schedule records in old DB")
        migrate_schedule_rows(old_conn, new_conn, schedules, service_duration_by_id, tpinto_id)

        print("\nMigration complete.")


if __name__ == "__main__":
    main()
