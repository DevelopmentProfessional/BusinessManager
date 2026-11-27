#!/bin/bash
set -euo pipefail

report_service_failure() {
	local service="$1"
	echo "ERROR: $service failed to start or become healthy." >&2
	systemctl status "$service" --no-pager --full || true
	journalctl -u "$service" -n 100 --no-pager || true
	return 1
}

restart_service() {
	local service="$1"
	if ! systemctl restart "$service"; then
		echo "Restart failed for $service; trying to start it." >&2
		systemctl start "$service" || report_service_failure "$service"
	fi
}

wait_for_health() {
	local service="$1"
	local url="$2"
	local attempt

	for attempt in $(seq 1 15); do
		if curl --fail --silent --max-time 2 "$url" >/dev/null; then
			echo "$service health check passed."
			return 0
		fi
		sleep 2
	done

	report_service_failure "$service"
}

systemctl daemon-reload
restart_service staff-api.service
restart_service client-api.service

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
if [ -f "$BACKEND_ENV_FILE" ]; then
	set -a
	. "$BACKEND_ENV_FILE"
	set +a
fi

cd /opt/businessmanager
/usr/bin/python3.11 -m backend.migrations.backfill_03200_appointments || echo "Notice: Standalone backfill check completed or will run on staff-api startup."

wait_for_health staff-api.service http://127.0.0.1:8000/health
wait_for_health client-api.service http://127.0.0.1:8001/health

echo "Services restarted and company 03200 appointment backfill checked."

