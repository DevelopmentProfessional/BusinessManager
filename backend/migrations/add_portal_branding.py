"""
Migration: Add client portal branding fields to app_settings
Run: python -m backend.migrations.add_portal_branding
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from backend.database import get_database_url
from sqlmodel import create_engine


def run_migration():
    database_url = get_database_url()
    engine = create_engine(database_url, echo=False)

    columns = [
        ("portal_hero_title",      "VARCHAR"),
        ("portal_hero_subtitle",   "VARCHAR"),
        ("portal_hero_tagline",    "VARCHAR"),
        ("portal_hero_bg_color",   "VARCHAR"),
        ("portal_hero_text_color", "VARCHAR"),
        ("portal_hero_image_url",  "VARCHAR"),
        ("portal_banner_text",     "VARCHAR"),
        ("portal_banner_color",    "VARCHAR"),
        ("portal_show_hero",       "BOOLEAN DEFAULT TRUE"),
        ("portal_show_banner",     "BOOLEAN DEFAULT FALSE"),
        ("portal_footer_text",     "VARCHAR"),
        ("portal_primary_color",   "VARCHAR"),
        ("portal_secondary_color", "VARCHAR"),
    ]

    with engine.connect() as conn:
        for col_name, col_type in columns:
            try:
                conn.execute(text(
                    f"ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                print(f"  + {col_name}")
            except Exception as e:
                print(f"  ! {col_name}: {e}")
        conn.commit()

    print("Portal branding migration complete.")


if __name__ == "__main__":
    run_migration()
