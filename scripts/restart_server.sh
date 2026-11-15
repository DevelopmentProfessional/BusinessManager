#!/bin/bash
set -e
systemctl daemon-reload
systemctl restart staff-api.service
systemctl restart client-api.service
echo "Services restarted."
