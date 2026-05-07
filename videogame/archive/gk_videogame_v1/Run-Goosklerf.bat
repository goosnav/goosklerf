@echo off
setlocal
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%goosklerf-digital
set URL=http://127.0.0.1:5173

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node 20+ or 22+ first.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  where corepack >nul 2>nul
  if not errorlevel 1 corepack enable
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is required. Run: corepack enable
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"
if not exist node_modules (
  echo Installing dependencies...
  pnpm install
)

start "" "%URL%"
echo Starting Goosklerf II at %URL%
pnpm --filter desktop run dev --host 127.0.0.1 --strictPort
pause
