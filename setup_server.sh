#!/bin/bash
set -e

DB_URL="postgresql+psycopg://businessmanager:BizMgr0cfc1d86d23b1df4abc12918X@127.0.0.1:5432/businessmanager"

# Staff API systemd service
cat > /etc/systemd/system/staff-api.service << 'EOF'
[Unit]
Description=BusinessManager Staff API
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=/opt/businessmanager
EnvironmentFile=/opt/businessmanager/backend/.env
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
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=/opt/businessmanager/client-api
EnvironmentFile=/opt/businessmanager/client-api/.env
ExecStart=/usr/bin/python3.11 -m uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
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
systemctl enable staff-api client-api
systemctl start staff-api
sleep 5
systemctl start client-api
sleep 5
systemctl restart nginx

echo "=== Staff API Status ==="
systemctl status staff-api --no-pager | tail -5
echo "=== Client API Status ==="
systemctl status client-api --no-pager | tail -5
echo "=== Test staff API ==="
curl -s http://127.0.0.1:8000/health | head -c 100
echo ""
echo "SETUP_COMPLETE"
