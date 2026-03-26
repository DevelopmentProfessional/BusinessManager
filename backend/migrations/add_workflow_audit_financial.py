"""
============================================================
Migration: Add comprehensive workflow, audit, and financial tables

Purpose:
   This migration adds all new database tables required for the 
   feature implementation: workflows, audit logging, financial 
   controls, procurement, and inventory intelligence.

Tables Created:
   - audit_log
   - workflow_template
   - document_workflow_instance
   - workflow_approval_step
   - pending_order
   - general_ledger_account
   - general_ledger_entry
   - accounts_receivable
   - accounts_payable
   - procurement_order
   - procurement_order_line
   - inventory_cost
   - schedule_settings
============================================================
"""

import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, DateTime,
    TIMESTAMP, UUID, ForeignKey, JSON, Boolean, Text
)
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import declarative_base
from uuid import uuid4

try:
    from backend.database import get_db_url
    from backend.models import Base
except ImportError:
    from database import get_db_url
    from models import Base


def upgrade():
    """Apply all new tables."""
    engine = create_engine(get_db_url(), echo=False)
    
    # Create all new tables defined in models.py
    Base.metadata.create_all(engine)
    
    print("✓ Migration completed: All tables created successfully")


def downgrade():
    """Remove all new tables."""
    engine = create_engine(get_db_url(), echo=False)
    
    # List of tables to drop (in reverse dependency order)
    tables_to_drop = [
        'procurement_order_line',
        'procurement_order',
        'accounts_payable',
        'accounts_receivable',
        'general_ledger_entry',
        'general_ledger_account',
        'workflow_approval_step',
        'document_workflow_instance',
        'workflow_template',
        'pending_order',
        'inventory_cost',
        'schedule_settings',
        'audit_log',
    ]
    
    with engine.begin() as conn:
        for table in tables_to_drop:
            try:
                conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
                print(f"  ✓ Dropped {table}")
            except Exception as e:
                print(f"  ✗ Error dropping {table}: {e}")
    
    print("✓ Migration reversed: All tables dropped")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'downgrade':
        downgrade()
    else:
        upgrade()
