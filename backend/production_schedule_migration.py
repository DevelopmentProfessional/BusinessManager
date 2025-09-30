#!/usr/bin/env python3
"""
Production Schedule Permissions Migration
========================================

Run this in production to update schedule permissions:
python production_schedule_migration.py

This safely updates:
- write_all -> view_all (for schedule page only) 
- read -> read_all (for schedule page only)

Does NOT touch appointment data or any other tables.
"""

import os
import sys
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Run the production migration"""
    try:
        # Import the migration script
        from safe_schedule_permissions_migration import main as run_migration
        
        logger.info("🚀 Starting Production Schedule Permissions Migration")
        logger.info("⚠️  This will update schedule permissions: write_all->view_all, read->read_all")
        logger.info("⚠️  No appointment data will be touched")
        
        # Run the migration (it will handle user confirmation in production)
        result = run_migration()
        
        if result:
            logger.info("✅ Production migration completed successfully")
        else:
            logger.error("❌ Production migration failed")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()