#!/bin/bash
set -e
systemctl daemon-reload
systemctl restart staff-api.service
systemctl restart client-api.service

cd /opt/businessmanager
/usr/bin/python3.11 -m backend.migrations.backfill_03200_appointments

echo "Services restarted and company 03200 appointment backfill checked."
