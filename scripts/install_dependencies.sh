#!/bin/bash
set -e
cd /opt/businessmanager

CLIENT_ENV_FILE="/opt/businessmanager/client-api/.env"
BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"

if [ ! -f "$CLIENT_ENV_FILE" ]; then
	echo "client-api .env missing. Creating it..."

	DATABASE_URL=""
	if [ -f "$BACKEND_ENV_FILE" ]; then
		DATABASE_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_ENV_FILE" | head -n 1 | cut -d '=' -f2-)
	fi

	if [ -z "$DATABASE_URL" ]; then
		echo "ERROR: DATABASE_URL not found in $BACKEND_ENV_FILE"
		exit 1
	fi

	CLIENT_JWT_SECRET=$(/usr/bin/python3.11 -c "import secrets; print(secrets.token_urlsafe(48))")

	cat > "$CLIENT_ENV_FILE" <<EOF
DATABASE_URL=$DATABASE_URL
CLIENT_JWT_SECRET=$CLIENT_JWT_SECRET
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ALLOWED_ORIGINS=https://vadpivi.com,https://www.vadpivi.com,https://clients.vadpivi.com,https://app.vadpivi.com,https://register.vadpivi.com
EOF

	chmod 600 "$CLIENT_ENV_FILE"
	echo "Created $CLIENT_ENV_FILE"
fi

echo "Installing backend dependencies..."
/usr/bin/python3.11 -m pip install -r backend/requirements.txt

echo "Installing client-api dependencies..."
/usr/bin/python3.11 -m pip install -r client-api/requirements.txt

if [ ! -f "$BACKEND_ENV_FILE" ]; then
	echo "ERROR: $BACKEND_ENV_FILE not found"
	exit 1
fi

set -a
. "$BACKEND_ENV_FILE"
set +a

echo "Running company 03200 migration against AWS DATABASE_URL..."
/usr/bin/python3.11 scripts/migrate_lavish.py

echo "Dependencies installed."
