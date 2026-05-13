#!/usr/bin/env python3.11
"""
One-time migration: clients, services, schedule from Render (lavish_beauty_db) -> AWS.
- All records assigned company_id = 03200
- All schedule records assigned to employee tpinto
- ON CONFLICT (id) DO NOTHING — safe to re-run
"""

import psycopg
from psycopg.rows import dict_row

OLD_DB = "postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db"
NEW_DB = "postgresql://businessmanager:BizMgr0cfc1d86d23b1df4abc12918X@127.0.0.1:5432/businessmanager"
COMPANY_ID = "03200"


def get_columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
            (table,)
        )
        return {row[0] for row in cur.fetchall()}


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


def main():
    print("Connecting to databases...")
    with psycopg.connect(OLD_DB, row_factory=dict_row) as old_conn, \
         psycopg.connect(NEW_DB, row_factory=dict_row) as new_conn:

        # Resolve tpinto's UUID
        with new_conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM "user" WHERE username = %s AND company_id = %s',
                ("tpinto", COMPANY_ID)
            )
            row = cur.fetchone()
            if not row:
                cur.execute('SELECT id FROM "user" WHERE username = %s', ("tpinto",))
                row = cur.fetchone()
            if not row:
                print("ERROR: user 'tpinto' not found in the database. Aborting.")
                return
            tpinto_id = row["id"]
            print(f"Resolved tpinto -> {tpinto_id}")

        # ── Services ────────────────────────────────────────────────────────
        print("\n[1/3] Migrating services...")
        with old_conn.cursor() as cur:
            cur.execute("SELECT * FROM service")
            services = cur.fetchall()
        print(f"  Found {len(services)} services in old DB")
        migrate_table(old_conn, new_conn, "service", services)

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
        migrate_table(old_conn, new_conn, "schedule", schedules,
                      extra_overrides={"employee_id": tpinto_id})

        print("\nMigration complete.")


if __name__ == "__main__":
    main()
