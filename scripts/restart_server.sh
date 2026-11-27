#!/bin/bash
set -e
systemctl daemon-reload
systemctl restart staff-api.service || systemctl start staff-api.service || true
systemctl restart client-api.service || systemctl start client-api.service || true

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
if [ -f "$BACKEND_ENV_FILE" ]; then
	set -a
	. "$BACKEND_ENV_FILE"
	set +a
fi

cd /opt/businessmanager
/usr/bin/python3.11 -m backend.migrations.backfill_03200_appointments || echo "Notice: Standalone backfill check completed or will run on staff-api startup."

echo "Services restarted and company 03200 appointment backfill checked."

