@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次執行，正在安裝套件...
  call npm install
)
if not exist .env copy .env.example .env >nul
call npm run init-db
pause
