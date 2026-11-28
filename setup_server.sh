#!/bin/bash
set -e

BACKEND_ENV_FILE="/opt/businessmanager/backend/.env"
SECURITY_ENV_FILE="/opt/businessmanager/backend/.security.env"

if [ ! -f "$BACKEND_ENV_FILE" ]; then
    echo "ERROR: Missing $BACKEND_ENV_FILE; create the backend environment file before running setup."
    exit 1
fi

if ! grep -Eq '^SECRET_KEY=[^[:space:]]{32,}$' "$BACKEND_ENV_FILE"; then
    secret_key=$(/usr/bin/python3.11 -c "import secrets; print(secrets.token_urlsafe(48))")
    printf '\nSECRET_KEY=%s\n' "$secret_key" >> "$BACKEND_ENV_FILE"
    chmod 600 "$BACKEND_ENV_FILE"
    echo "Generated and persisted the staff API signing key."
fi

if { [ ! -f "$BACKEND_ENV_FILE" ] || ! grep -Eq '^PAYMENT_DATA_ENCRYPTION_KEY=[^[:space:]]+$' "$BACKEND_ENV_FILE"; } \
    && { [ ! -f "$SECURITY_ENV_FILE" ] || ! grep -Eq '^PAYMENT_DATA_ENCRYPTION_KEY=[^[:space:]]+$' "$SECURITY_ENV_FILE"; }; then
    echo "ERROR: Configure a persistent PAYMENT_DATA_ENCRYPTION_KEY in $BACKEND_ENV_FILE or $SECURITY_ENV_FILE before starting the API."
    echo "Generate one with: python3.11 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
    exit 1
fi

chmod 600 "$BACKEND_ENV_FILE"

if ! id -u businessmanager >/dev/null 2>&1; then
    useradd --system --home-dir /opt/businessmanager --shell /usr/sbin/nologin businessmanager
fi
install -d -o businessmanager -g businessmanager -m 750 /opt/businessmanager/backend/uploads

# Staff API systemd service
cat > /etc/systemd/system/staff-api.service << 'EOF'
[Unit]
Description=BusinessManager Staff API
After=network.target docker.service

[Service]
User=businessmanager
Group=businessmanager
WorkingDirectory=/opt/businessmanager
EnvironmentFile=/opt/businessmanager/backend/.env
EnvironmentFile=-/opt/businessmanager/backend/.security.env
ExecStart=/usr/bin/python3.11 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/businessmanager/backend/uploads

[Install]
WantedBy=multi-user.target
EOF

# Client API systemd service
cat > /etc/systemd/system/client-api.service << 'EOF'
[Unit]
Description=BusinessManager Client API
After=network.target docker.service

[Service]
User=businessmanager
Group=businessmanager
WorkingDirectory=/opt/businessmanager/client-api
EnvironmentFile=/opt/businessmanager/client-api/.env
EnvironmentFile=-/opt/businessmanager/client-api/.security.env
ExecStart=/usr/bin/python3.11 -m uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

# Daily delayed app startup (10:10 AM Bermuda)
cat > /etc/systemd/system/businessmanager-app-start.service << 'EOF'
[Unit]
Description=Start BusinessManager APIs (staff + client)
After=network.target docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash /opt/businessmanager/scripts/restart_server.sh
EOF

cat > /etc/systemd/system/businessmanager-app-start.timer << 'EOF'
[Unit]
Description=Run BusinessManager API startup daily at 10:10 AM Bermuda time

[Timer]
OnCalendar=*-*-* 10:10:00 America/Bermuda
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Nginx config - Pure API Proxy (no static files)
cat > /etc/nginx/conf.d/businessmanager.conf << 'EOF'
# CORS origin allowlist for browser-based API calls (production + local/LAN clients)
map $http_origin $cors_allow_origin {
    default "";
    ~^https://([a-zA-Z0-9-]+\.)?vadpivi\.com$ $http_origin;
    ~^https?://localhost(:\d+)?$ $http_origin;
}

# Upstream servers
upstream staff_api {
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
}

upstream client_api {
    server 127.0.0.1:8001 max_fails=3 fail_timeout=30s;
}

# API Proxy server
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Staff API routes
    location /api/v1/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $cors_allow_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Vary "Origin" always;
            return 204;
        }

        proxy_pass http://staff_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        client_max_body_size 50M;
    }

    # Client API routes
    location /api/client/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $cors_allow_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Vary "Origin" always;
            return 204;
        }

        proxy_pass http://client_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        client_max_body_size 50M;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://staff_api/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # Catch-all - return 404
    location / {
        return 404;
    }
}
EOF

systemctl daemon-reload
timedatectl set-timezone Atlantic/Bermuda || true

# Enable services to run continuously (not scheduled)
systemctl enable staff-api client-api
systemctl start staff-api
systemctl start client-api

# Disable and stop the startup timer (services run continuously)
systemctl disable businessmanager-app-start.timer || true
systemctl stop businessmanager-app-start.timer || true

systemctl restart nginx

echo "=== Service Status ==="
systemctl status staff-api --no-pager | tail -3
systemctl status client-api --no-pager | tail -3
echo "=== Nginx Status ==="
systemctl status nginx --no-pager | tail -3
echo "SETUP_COMPLETE"
