#!/bin/bash
set -e
cd /home/ec2-user/businessmanager

echo "Installing backend dependencies..."
pip3 install -r backend/requirements.txt

echo "Installing client-api dependencies..."
pip3 install -r client-api/requirements.txt

echo "Dependencies installed."
