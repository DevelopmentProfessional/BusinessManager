"""
ADD PORTAL BRANDING MIGRATION
==============================
Adds client portal branding fields to app_settings so each company
can customize their portal landing page (hero, banner, colors).

Run:
    python migrations/add_portal_branding.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import DATABASE_URL
import psycopg

_url = DATABASE_URL
if _url.startswith("postgresql+psycopg://"):
    _url = _url.replace("postgresql+psycopg://", "postgresql://", 1)


def run():
    print("Connecting to database …")
    with psycopg.connect(_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            print("  Adding portal branding fields to app_settings …")

            fields = [
                ("portal_hero_title",      "VARCHAR"),
                ("portal_hero_subtitle",   "VARCHAR"),
                ("portal_hero_tagline",    "VARCHAR"),
                ("portal_hero_bg_color",   "VARCHAR"),
                ("portal_hero_text_color", "VARCHAR"),
                ("portal_hero_image_url",  "VARCHAR"),
                ("portal_hero_image_data", "BYTEA"),
                ("portal_banner_text",     "VARCHAR"),
                ("portal_banner_color",    "VARCHAR"),
                ("portal_show_hero",       "BOOLEAN DEFAULT TRUE"),
                ("portal_show_banner",     "BOOLEAN DEFAULT FALSE"),
                ("portal_footer_text",     "VARCHAR"),
                ("portal_primary_color",   "VARCHAR"),
                ("portal_secondary_color", "VARCHAR"),
            ]

            for col_name, col_type in fields:
                cur.execute(f"""
                    ALTER TABLE app_settings
                    ADD COLUMN IF NOT EXISTS {col_name} {col_type};
                """)
                print(f"    + {col_name} {col_type}")

            conn.commit()
            print("Done.")


if __name__ == "__main__":
    run()
