@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8766/"
  py -3 server.py
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    start "" "http://127.0.0.1:8766/"
    python server.py
  ) else (
    echo Necesitas instalar Python 3 desde https://www.python.org/downloads/
    pause
  )
)
