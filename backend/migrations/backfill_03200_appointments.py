"""One-time deployment backfill for company 03200's historical appointments."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, text


MIGRATION_KEY = "2026-11-26_03200_past_appointments_paid"
ADVISORY_LOCK_IDS = (3200, 20261126)

SERVICE_PRICE_MAP_SQL = """
CREATE TEMP TABLE service_price_map ON COMMIT DROP AS
SELECT *
FROM (VALUES
    ('African', 85.00::numeric),
    ('Braids', 85.00::numeric),
    ('Braids - Box (Short)', 140.00::numeric),
    ('Braids - Cornrow (Long)', 100.00::numeric),
    ('Braids - Cornrow (Medium)', 85.00::numeric),
    ('Braids - Ropetwist (Long)', 200.00::numeric),
    ('Braids - Ropetwist (Medium)', 150.00::numeric),
    ('Closure', 150.00::numeric),
    ('Closure - Regular', 150.00::numeric),
    ('Comb twist', 60.00::numeric),
    ('Dreads', 100.00::numeric),
    ('Dreads - Interlock (Long)', 150.00::numeric),
    ('Dreads - Interlock (Medium)', 125.00::numeric),
    ('Dreads - Palmroll (Long)', 125.00::numeric),
    ('Dreads - Palmroll (Medium)', 100.00::numeric),
    ('Gel pedicure', 85.00::numeric),
    ('T braids', 85.00::numeric),
    ('Toe fix', 25.00::numeric),
    ('Weave', 200.00::numeric)
) AS prices(service_name, proposed_price)
"""

APPOINTMENT_BACKFILL_SQL = """
CREATE TEMP TABLE appointment_backfill ON COMMIT DROP AS
WITH appointment_base AS (
    SELECT
        s.id AS schedule_id,
        s.service_id,
        s.client_id,
        s.employee_id,
        s.company_id,
        s.appointment_date
            + make_interval(mins => COALESCE(s.duration_minutes, 60)) AS sale_at,
        sv.name AS service_name,
        ROUND(sv.price::numeric, 2) AS service_price,
        COALESCE(addons.addon_total, 0)::numeric AS addon_total,
        GREATEST(COALESCE(s.discount, 0)::numeric, 0) AS schedule_discount,
        COALESCE(c.tax_rate, 0)::numeric AS tax_rate,
        s.service_addons_json,
        existing_sale.id AS existing_sale_id
    FROM schedule s
    JOIN service sv
      ON sv.id = s.service_id
     AND sv.company_id = s.company_id
    JOIN company c
      ON c.company_id = s.company_id
    LEFT JOIN LATERAL (
        SELECT st.id
        FROM sale_transaction st
        WHERE st.company_id = s.company_id
          AND (st.id = s.sale_transaction_id OR st.schedule_id = s.id)
        ORDER BY
            CASE WHEN st.id = s.sale_transaction_id THEN 0 ELSE 1 END,
            st.created_at
        LIMIT 1
    ) existing_sale ON TRUE
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
            CASE
                WHEN COALESCE((addon.value->>'is_billable')::boolean, TRUE)
                THEN COALESCE(NULLIF(addon.value->>'price_delta', '')::numeric, 0)
                     * GREATEST(
                         COALESCE(NULLIF(addon.value->>'quantity', '')::integer, 0),
                         0
                     )
                ELSE 0
            END
        ), 0) AS addon_total
        FROM jsonb_array_elements(
            CASE
                WHEN NULLIF(BTRIM(s.service_addons_json), '') IS NULL
                    THEN '[]'::jsonb
                WHEN jsonb_typeof(s.service_addons_json::jsonb) = 'array'
                    THEN s.service_addons_json::jsonb
                ELSE '[]'::jsonb
            END
        ) AS addon(value)
        WHERE NULLIF(BTRIM(addon.value->>'name'), '') IS NOT NULL
    ) addons ON TRUE
    WHERE s.company_id = '03200'
      AND s.service_id IS NOT NULL
      AND COALESCE(s.task_type, 'service') = 'service'
      AND s.appointment_date::date
          < (
              CURRENT_TIMESTAMP
              AT TIME ZONE COALESCE(NULLIF(c.timezone, ''), 'Atlantic/Bermuda')
          )::date
      AND s.is_recurring_master IS NOT TRUE
      AND LOWER(COALESCE(s.status, '')) NOT IN ('cancelled', 'canceled')
),
subtotal_rows AS (
    SELECT
        appointment_base.*,
        ROUND(GREATEST(service_price + addon_total, 0), 2) AS subtotal
    FROM appointment_base
),
discount_rows AS (
    SELECT
        subtotal_rows.*,
        LEAST(schedule_discount, subtotal) AS discount_amount
    FROM subtotal_rows
)
SELECT
    discount_rows.*,
    ROUND((subtotal - discount_amount) * tax_rate / 100, 2) AS tax_amount,
    ROUND(
        subtotal - discount_amount
        + ROUND((subtotal - discount_amount) * tax_rate / 100, 2),
        2
    ) AS total
FROM discount_rows
"""

def run_migration(database_engine: Engine) -> dict[str, Any]:
    """Apply the backfill once, atomically, and return a small execution summary."""
    with database_engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.businessmanager_data_migration (
                migration_key TEXT PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
                details JSONB NOT NULL DEFAULT '{}'::jsonb
            )
        """))
        conn.execute(
            text("SELECT pg_advisory_xact_lock(:class_id, :object_id)"),
            {"class_id": ADVISORY_LOCK_IDS[0], "object_id": ADVISORY_LOCK_IDS[1]},
        )

        already_applied = conn.execute(
            text("""
                SELECT 1
                FROM public.businessmanager_data_migration
                WHERE migration_key = :migration_key
            """),
            {"migration_key": MIGRATION_KEY},
        ).scalar()
        if already_applied:
            return {"status": "already_applied"}

        conn.execute(text(SERVICE_PRICE_MAP_SQL))

        unsafe_services = conn.execute(text("""
            SELECT m.service_name
            FROM service_price_map m
            WHERE NOT EXISTS (
                SELECT 1
                FROM service s
                WHERE s.company_id = '03200'
                  AND s.name = m.service_name
                  AND (
                      s.price = 0
                      OR ROUND(s.price::numeric, 2) = m.proposed_price
                  )
            )
            ORDER BY m.service_name
        """)).scalars().all()
        if unsafe_services:
            raise RuntimeError(
                "Company 03200 price backfill stopped; missing services or "
                "unexpected existing prices: " + ", ".join(unsafe_services)
            )

        updated_services = conn.execute(text("""
            UPDATE service s
            SET price = m.proposed_price
            FROM service_price_map m
            WHERE s.company_id = '03200'
              AND s.name = m.service_name
              AND s.price = 0
        """)).rowcount

        conn.execute(text(APPOINTMENT_BACKFILL_SQL))
        appointment_count = conn.execute(
            text("SELECT COUNT(*) FROM appointment_backfill")
        ).scalar_one()
        reused_sale_count = conn.execute(text("""
            SELECT COUNT(*)
            FROM appointment_backfill
            WHERE existing_sale_id IS NOT NULL
        """)).scalar_one()

        conn.execute(text("""
            CREATE TEMP TABLE created_schedule_sales (
                schedule_id UUID PRIMARY KEY,
                sale_id UUID NOT NULL
            ) ON COMMIT DROP
        """))
        conn.execute(text("""
            WITH inserted_sales AS (
                INSERT INTO sale_transaction (
                    id, created_at, updated_at,
                    client_id, employee_id,
                    subtotal, discount_amount, tax_amount, total,
                    payment_method, paid_at, schedule_id, company_id
                )
                SELECT
                    gen_random_uuid(),
                    b.sale_at,
                    NOW(),
                    b.client_id,
                    b.employee_id,
                    b.subtotal,
                    b.discount_amount,
                    b.tax_amount,
                    b.total,
                    'cash',
                    b.sale_at,
                    b.schedule_id,
                    b.company_id
                FROM appointment_backfill b
                WHERE b.existing_sale_id IS NULL
                RETURNING id, schedule_id
            )
            INSERT INTO created_schedule_sales (schedule_id, sale_id)
            SELECT schedule_id, id
            FROM inserted_sales
        """))

        conn.execute(text("""
            UPDATE sale_transaction st
            SET payment_method = 'cash',
                paid_at = b.sale_at,
                created_at = b.sale_at,
                updated_at = NOW()
            FROM appointment_backfill b
            WHERE b.existing_sale_id = st.id
        """))

        conn.execute(text("""
            INSERT INTO sale_transaction_item (
                id, created_at, updated_at,
                sale_transaction_id, item_id, item_type, item_name,
                unit_price, quantity, line_total, options_json, company_id
            )
            SELECT
                gen_random_uuid(),
                b.sale_at,
                b.sale_at,
                n.sale_id,
                b.service_id,
                'service',
                b.service_name,
                b.service_price + b.addon_total,
                1,
                b.subtotal,
                NULLIF(BTRIM(b.service_addons_json), ''),
                b.company_id
            FROM created_schedule_sales n
            JOIN appointment_backfill b ON b.schedule_id = n.schedule_id
        """))

        conn.execute(text("""
            UPDATE schedule s
            SET is_paid = TRUE,
                sale_transaction_id = COALESCE(b.existing_sale_id, n.sale_id),
                updated_at = NOW()
            FROM appointment_backfill b
            LEFT JOIN created_schedule_sales n ON n.schedule_id = b.schedule_id
            WHERE s.id = b.schedule_id
              AND s.company_id = '03200'
        """))

        new_sale_count = conn.execute(
            text("SELECT COUNT(*) FROM created_schedule_sales")
        ).scalar_one()
        summary = {
            "services_repriced": max(updated_services or 0, 0),
            "past_appointments": appointment_count,
            "new_sales_created": new_sale_count,
            "existing_sales_reused": reused_sale_count,
        }
        conn.execute(
            text("""
                INSERT INTO public.businessmanager_data_migration (
                    migration_key, applied_at, details
                )
                VALUES (:migration_key, NOW(), CAST(:details AS JSONB))
            """),
            {
                "migration_key": MIGRATION_KEY,
                "details": json.dumps(summary),
            },
        )

    return {"status": "applied", **summary}


def main() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repository_root))

    from backend.database import engine

    summary = run_migration(engine)
    print(f"Company 03200 appointment backfill: {summary}")


if __name__ == "__main__":
    main()
