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

# Nginx config
cat > /etc/nginx/conf.d/businessmanager.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60;
        client_max_body_size 50M;
    }

    location /api/client/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60;
        client_max_body_size 50M;
    }
}
EOF

systemctl daemon-reload
timedatectl set-timezone Atlantic/Bermuda || true
systemctl disable staff-api client-api || true
systemctl stop staff-api || true
systemctl stop client-api || true
systemctl enable businessmanager-app-start.timer
systemctl start businessmanager-app-start.timer
systemctl restart nginx

echo "=== Timer Status ==="
systemctl status businessmanager-app-start.timer --no-pager | tail -8
echo "=== Next Startup Window ==="
systemctl list-timers businessmanager-app-start.timer --all --no-pager
echo "SETUP_COMPLETE"
