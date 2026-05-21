#!/bin/bash
set -e

# Staff API systemd service
cat > /etc/systemd/system/staff-api.service << 'EOF'
[Unit]
Description=BusinessManager Staff API
After=network.target docker.service

[Service]
User=root
WorkingDirectory=/opt/businessmanager
EnvironmentFile=/opt/businessmanager/backend/.env
ExecStartPre=/bin/bash /opt/businessmanager/scripts/ensure_local_postgres.sh
ExecStart=/usr/bin/python3.11 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Client API systemd service
cat > /etc/systemd/system/client-api.service << 'EOF'
[Unit]
Description=BusinessManager Client API
After=network.target docker.service

[Service]
User=root
WorkingDirectory=/opt/businessmanager/client-api
EnvironmentFile=/opt/businessmanager/client-api/.env
ExecStartPre=/bin/bash /opt/businessmanager/scripts/ensure_local_postgres.sh
ExecStart=/usr/bin/python3.11 -m uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

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
# Upstream servers
upstream staff_api {
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
}

upstream client_api {
    server 127.0.0.1:8001 max_fails=3 fail_timeout=30s;
}

# Disable default server
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

# API Proxy server
server {
    listen 80;
    listen [::]:80;
    server_name api.vadpivi.com ~^.*\.vadpivi\.com$;

    # Staff API routes
    location /api/v1/ {
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "$http_access_control_request_headers" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Vary "Origin" always;
            return 204;
        }

        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Expose-Headers "*" always;
        add_header Vary "Origin" always;

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
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "$http_access_control_request_headers" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Vary "Origin" always;
            return 204;
        }

        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Expose-Headers "*" always;
        add_header Vary "Origin" always;

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
