@echo off
title Booleans Master - Remote Teaching Server
cd /d "%~dp0"
echo Starting Booleans Master Server...
python run_server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An error occurred. Press any key to exit...
    pause >nul
)

