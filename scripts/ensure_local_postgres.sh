#!/bin/bash
set -euo pipefail

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
CONTAINER_NAME="businessmanager-postgres"
DATA_DIR="/opt/businessmanager/postgres-data"

if [ ! -f "$BACKEND_ENV_FILE" ]; then
	echo "Local PostgreSQL bootstrap skipped: $BACKEND_ENV_FILE not found."
	exit 0
fi

DB_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV_FILE" | head -n 1 | cut -d '=' -f2-)
if [ -z "$DB_URL" ]; then
	echo "Local PostgreSQL bootstrap skipped: DATABASE_URL missing."
	exit 0
fi

readarray -t DB_PARTS < <(DB_URL="$DB_URL" /usr/bin/python3.11 - <<'PY'
import os
from urllib.parse import urlparse, unquote

parsed = urlparse(os.environ["DB_URL"])
print(parsed.hostname or "")
print(unquote(parsed.username or "postgres"))
print(unquote(parsed.password or ""))
db_name = parsed.path.lstrip("/") or "postgres"
print(db_name)
PY
)

DB_HOST="${DB_PARTS[0]:-}"
DB_USER="${DB_PARTS[1]:-postgres}"
DB_PASSWORD="${DB_PARTS[2]:-}"
DB_NAME="${DB_PARTS[3]:-postgres}"

case "$DB_HOST" in
	localhost|127.0.0.1|::1)
		;;
	*)
		echo "Local PostgreSQL bootstrap skipped: DATABASE_URL host is '$DB_HOST'."
		exit 0
		;;
esac

if [ -z "$DB_PASSWORD" ]; then
	echo "Local PostgreSQL bootstrap skipped: database password missing."
	exit 1
fi

systemctl start docker
mkdir -p "$DATA_DIR"

if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
	docker start "$CONTAINER_NAME" >/dev/null
else
	docker run -d \
		--name "$CONTAINER_NAME" \
		--restart unless-stopped \
		-p 127.0.0.1:5432:5432 \
		-e POSTGRES_USER="$DB_USER" \
		-e POSTGRES_PASSWORD="$DB_PASSWORD" \
		-e POSTGRES_DB="$DB_NAME" \
		-v "$DATA_DIR:/var/lib/postgresql/data" \
		postgres:17-alpine \
		-c max_connections=50 \
		-c shared_buffers=128MB \
		-c effective_cache_size=256MB \
		-c maintenance_work_mem=64MB \
		-c work_mem=4MB >/dev/null
fi

for _ in $(seq 1 30); do
	if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
		echo "Local PostgreSQL container is ready."
		exit 0
	fi
	sleep 2
done

echo "Local PostgreSQL container failed to become ready."
	exit 1