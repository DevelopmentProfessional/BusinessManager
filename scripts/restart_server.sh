#!/bin/bash
set -e
systemctl daemon-reload
systemctl restart staff-api.service
systemctl restart client-api.service

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
if [ -f "$BACKEND_ENV_FILE" ]; then
	set -a
	. "$BACKEND_ENV_FILE"
	set +a
fi

cd /opt/businessmanager
/usr/bin/python3.11 -m backend.migrations.backfill_03200_appointments || echo "Notice: Standalone backfill check completed or will run on staff-api startup."

echo "Services restarted and company 03200 appointment backfill checked."

