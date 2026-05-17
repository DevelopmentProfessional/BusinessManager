#!/bin/bash
set -e
if [ -x /opt/businessmanager/scripts/ensure_local_postgres.sh ]; then
	/opt/businessmanager/scripts/ensure_local_postgres.sh
fi
systemctl daemon-reload
systemctl restart staff-api.service
systemctl restart client-api.service
echo "Services restarted."
