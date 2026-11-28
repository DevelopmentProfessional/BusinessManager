#!/bin/bash
set -e

cd /opt/businessmanager

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
if [ -f "$BACKEND_ENV_FILE" ]; then
	set -a
	. "$BACKEND_ENV_FILE"
	set +a
fi

echo "Initializing database schema..."
SEED_COMPANY_ID="75597" /usr/bin/python3.11 /opt/businessmanager/backend/init_database.py || echo "Warning: Database init completed with status $?, startup will verify schema."
echo "Database initialization step completed."