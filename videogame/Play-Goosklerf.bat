@echo off
REM Play-Goosklerf.bat — Windows double-click launcher.
REM
REM Double-clicking opens cmd.exe, installs deps if needed, builds the card
REM database if needed, and launches the CLI game.

setlocal enabledelayedexpansion

REM cd to script directory (handles spaces and drive letters correctly).
cd /d "%~dp0" || ( echo Cannot cd to script directory & pause & exit /b 1 )

echo ----------------------------------------------
echo   Goosklerf launcher  (Windows)
echo ----------------------------------------------
echo.

REM Confirm pnpm is on PATH.
where pnpm >nul 2>nul
if errorlevel 1 (
    echo ERROR: pnpm not found on your PATH.
    echo.
    echo Install Node.js from https://nodejs.org first, then:
    echo     npm install -g pnpm
    echo.
    echo Then run this launcher again.
    pause
    exit /b 1
)

REM Hop into the active code directory.
cd gk_videogame_v2 || ( echo Cannot find gk_videogame_v2\ - has the folder been moved? & pause & exit /b 1 )

REM First-run setup: install dependencies if node_modules is missing.
if not exist node_modules (
    echo First run -- installing dependencies ^(this takes ~30 seconds^)...
    call pnpm install
    if errorlevel 1 ( echo pnpm install failed. & pause & exit /b 1 )
    echo.
)

REM First-run setup: build the card database if not yet generated.
if not exist packages\cards\data\cards.generated.json (
    echo First run -- building card database...
    call pnpm cards:build
    if errorlevel 1 ( echo pnpm cards:build failed. & pause & exit /b 1 )
    echo.
)

REM Launch the game. Pass through any extra arguments.
echo Launching Goosklerf...
echo.
call pnpm play -- %*
set exit_code=!errorlevel!

echo.
if !exit_code! equ 0 (
    echo Game ended cleanly.
) else (
    echo Game exited with code !exit_code!.
)
pause
exit /b !exit_code!
