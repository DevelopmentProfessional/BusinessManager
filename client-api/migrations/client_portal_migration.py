"""
CLIENT PORTAL MIGRATION
=======================
Adds auth columns to the existing `client` table and
cancellation/refund fields to `app_settings`.

New tables (client_booking, client_order, client_order_item) are created
by SQLModel.metadata.create_all() in database.py — no manual SQL needed.

Run this ONCE against the shared Postgres database before deploying the
client-api service:

    python migrations/client_portal_migration.py

Environment variable DATABASE_URL must be set.
"""

import sys
import os

# Allow running from repo root or migrations/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import DATABASE_URL
import psycopg

# Normalise URL for psycopg
_url = DATABASE_URL
if _url.startswith("postgresql+psycopg://"):
    _url = _url.replace("postgresql+psycopg://", "postgresql://", 1)


def run():
    print("Connecting to database …")
    with psycopg.connect(_url, autocommit=False) as conn:
        with conn.cursor() as cur:

            # ── 1. Extend `client` table with auth columns ─────────────────
            print("  [1/3] Adding auth columns to `client` …")
            columns = {
                "password_hash":        "VARCHAR",
                "email_verified":       "BOOLEAN DEFAULT FALSE",
                "last_login":           "TIMESTAMP",
                "reset_token":          "VARCHAR",
                "reset_token_expires":  "TIMESTAMP",
            }
            for col, definition in columns.items():
                cur.execute(f"""
                    ALTER TABLE client
                    ADD COLUMN IF NOT EXISTS {col} {definition};
                """)

            # ── 2. Extend `app_settings` with cancellation/refund policy ───
            print("  [2/3] Adding cancellation/refund columns to `app_settings` …")
            cur.execute("""
                ALTER TABLE app_settings
                ADD COLUMN IF NOT EXISTS cancellation_percentage FLOAT DEFAULT 10.0;
            """)
            cur.execute("""
                ALTER TABLE app_settings
                ADD COLUMN IF NOT EXISTS refund_percentage FLOAT DEFAULT 80.0;
            """)

            # ── 3. Create new client-portal tables ─────────────────────────
            print("  [3/3] Creating new client-portal tables …")

            cur.execute("""
                CREATE TABLE IF NOT EXISTS client_booking (
                    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    client_id                 UUID NOT NULL REFERENCES client(id),
                    service_id                UUID NOT NULL REFERENCES service(id),
                    schedule_id               UUID,
                    booking_mode              VARCHAR NOT NULL DEFAULT 'soft',
                    status                    VARCHAR NOT NULL DEFAULT 'pending',
                    appointment_date          TIMESTAMP NOT NULL,
                    duration_minutes          INT NOT NULL DEFAULT 60,
                    notes                     TEXT,
                    stripe_payment_intent_id  VARCHAR,
                    amount_paid               FLOAT NOT NULL DEFAULT 0.0,
                    cancellation_charge       FLOAT NOT NULL DEFAULT 0.0,
                    refund_amount             FLOAT NOT NULL DEFAULT 0.0,
                    company_id                VARCHAR,
                    created_at                TIMESTAMP DEFAULT NOW(),
                    updated_at                TIMESTAMP DEFAULT NOW()
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_booking_client_id  ON client_booking(client_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_booking_service_id ON client_booking(service_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_booking_company_id ON client_booking(company_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_booking_appt_date  ON client_booking(appointment_date);")

            cur.execute("""
                CREATE TABLE IF NOT EXISTS client_order (
                    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    client_id                 UUID NOT NULL REFERENCES client(id),
                    status                    VARCHAR NOT NULL DEFAULT 'pending',
                    subtotal                  FLOAT NOT NULL DEFAULT 0.0,
                    tax_amount                FLOAT NOT NULL DEFAULT 0.0,
                    total                     FLOAT NOT NULL DEFAULT 0.0,
                    payment_method            VARCHAR,
                    stripe_payment_intent_id  VARCHAR,
                    stripe_charge_id          VARCHAR,
                    company_id                VARCHAR,
                    created_at                TIMESTAMP DEFAULT NOW(),
                    updated_at                TIMESTAMP DEFAULT NOW()
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_order_client_id  ON client_order(client_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_order_company_id ON client_order(company_id);")

            cur.execute("""
                CREATE TABLE IF NOT EXISTS client_order_item (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    order_id         UUID NOT NULL REFERENCES client_order(id),
                    item_id          UUID,
                    item_type        VARCHAR NOT NULL DEFAULT 'product',
                    item_name        VARCHAR NOT NULL,
                    unit_price       FLOAT NOT NULL DEFAULT 0.0,
                    quantity         INT   NOT NULL DEFAULT 1,
                    line_total       FLOAT NOT NULL DEFAULT 0.0,
                    booking_id       UUID REFERENCES client_booking(id),
                    company_id       VARCHAR,
                    created_at       TIMESTAMP DEFAULT NOW(),
                    updated_at       TIMESTAMP DEFAULT NOW()
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS ix_client_order_item_order_id ON client_order_item(order_id);")

            conn.commit()
            print("Migration complete.")


if __name__ == "__main__":
    run()
