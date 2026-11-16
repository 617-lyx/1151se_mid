@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 安裝 / 檢查 Python 套件...
pip install -q -r requirements.txt
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:8000"
fastapi dev main.py
pause
