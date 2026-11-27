#!/bin/bash
set -euo pipefail

cd /opt/businessmanager

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
if [ ! -f "$BACKEND_ENV_FILE" ]; then
	echo "ERROR: $BACKEND_ENV_FILE not found"
	exit 1
fi

set -a
. "$BACKEND_ENV_FILE"
set +a

echo "Initializing database schema and running startup migrations..."
/usr/bin/python3.11 /opt/businessmanager/backend/init_database.py
echo "Database schema initialization completed."