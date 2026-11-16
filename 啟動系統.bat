@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 優先使用上一層 prj\.venv 裡已經裝好的套件（課堂環境）
set "VENV=%~dp0..\.venv\Scripts"
if exist "%VENV%\fastapi.exe" (
  echo 使用 prj\.venv 啟動伺服器...
  start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:8000"
  "%VENV%\fastapi.exe" dev main.py
) else (
  echo 找不到 prj\.venv，改用系統 Python 安裝套件...
  python -m pip install -r requirements.txt
  start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:8000"
  python -m fastapi dev main.py
)
pause
