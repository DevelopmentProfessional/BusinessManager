@echo off
echo Starting Business Management System with minimal logging...
echo.

cd backend
set QUIET_MODE=true
set SQLALCHEMY_WARN_20=false
python start_server.py
