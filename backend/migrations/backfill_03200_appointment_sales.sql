DO $$
DECLARE
    v_migration_key CONSTANT TEXT := '2026-11-26_03200_past_appointments_paid';
    appointment_count BIGINT;
    reused_sale_count BIGINT;
    new_sale_count BIGINT;
BEGIN
    CREATE TABLE IF NOT EXISTS public.businessmanager_data_migration (
        migration_key TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        details JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    PERFORM pg_advisory_xact_lock(3200, 20261126);

    IF EXISTS (
        SELECT 1
        FROM public.businessmanager_data_migration
        WHERE businessmanager_data_migration.migration_key = v_migration_key
    ) THEN
        RAISE NOTICE 'Company 03200 appointment sales backfill already applied; no changes made.';
        RETURN;
    END IF;

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
    FROM discount_rows;

    SELECT COUNT(*)
    INTO appointment_count
    FROM appointment_backfill;

    SELECT COUNT(*)
    INTO reused_sale_count
    FROM appointment_backfill
    WHERE existing_sale_id IS NOT NULL;

    CREATE TEMP TABLE created_schedule_sales (
        schedule_id UUID PRIMARY KEY,
        sale_id UUID NOT NULL
    ) ON COMMIT DROP;

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
    FROM inserted_sales;

    UPDATE sale_transaction st
    SET payment_method = 'cash',
        paid_at = b.sale_at,
        created_at = b.sale_at,
        updated_at = NOW()
    FROM appointment_backfill b
    WHERE b.existing_sale_id = st.id;

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
    JOIN appointment_backfill b ON b.schedule_id = n.schedule_id;

    UPDATE schedule s
    SET is_paid = TRUE,
        sale_transaction_id = COALESCE(b.existing_sale_id, n.sale_id),
        updated_at = NOW()
    FROM appointment_backfill b
    LEFT JOIN created_schedule_sales n ON n.schedule_id = b.schedule_id
    WHERE s.id = b.schedule_id
      AND s.company_id = '03200';

    SELECT COUNT(*)
    INTO new_sale_count
    FROM created_schedule_sales;

    INSERT INTO public.businessmanager_data_migration (
        migration_key, applied_at, details
    )
    VALUES (
        v_migration_key,
        NOW(),
        jsonb_build_object(
            'past_appointments', appointment_count,
            'new_sales_created', new_sale_count,
            'existing_sales_reused', reused_sale_count
        )
    );

    RAISE NOTICE
        'Company 03200 appointment sales backfill applied: % past appointments, % new sales, % existing sales reused.',
        appointment_count,
        new_sale_count,
        reused_sale_count;
END
$$;
