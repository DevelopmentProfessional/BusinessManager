#!/bin/bash
set -e
systemctl stop staff-api.service || true
systemctl stop client-api.service || true
echo "Services stopped."
