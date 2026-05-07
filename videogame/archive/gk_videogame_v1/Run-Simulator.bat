@echo off
setlocal
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%goosklerf-digital

where pnpm >nul 2>nul
if errorlevel 1 (
  where corepack >nul 2>nul
  if not errorlevel 1 corepack enable
)

cd /d "%PROJECT_DIR%"
if not exist node_modules (
  echo Installing dependencies...
  pnpm install
)

if "%~1"=="" (
  pnpm sim -- --games 100 --players 2 --seed quickstart --out reports/quickstart --max-turns 200
) else (
  pnpm sim -- %*
)
pause
