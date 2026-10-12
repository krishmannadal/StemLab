@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo Install Python 3.11 from python.org, then run this again.
    pause
    exit /b 1
  )
)
.venv\Scripts\python.exe -m pip install -r requirements-local.txt
if errorlevel 1 (
  echo Dependency installation failed. Check internet and see README.md.
  pause
  exit /b 1
)
.venv\Scripts\python.exe run.py
pause
