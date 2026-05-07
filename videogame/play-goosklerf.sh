#!/bin/bash
# play-goosklerf.sh — Linux launcher.
#
# Make executable once (`chmod +x play-goosklerf.sh`) then run from a file
# manager (depending on your distro/file manager you may need to enable
# "Execute as Program" or similar) or from a terminal:
#
#     ./play-goosklerf.sh
#
# Identical to Play-Goosklerf.command on macOS — kept separate for clarity.

cd "$(dirname "$0")" || { echo "Cannot cd to script directory"; read -p "Press Enter..."; exit 1; }

echo "──────────────────────────────────────────────"
echo "  Goosklerf launcher  (Linux)"
echo "──────────────────────────────────────────────"
echo ""

# Pick up pnpm/node from common install locations even when launched from a
# file manager (which doesn't inherit a login-shell PATH).
if [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc" 2>/dev/null || true; fi
if [ -f "$HOME/.profile" ]; then . "$HOME/.profile" 2>/dev/null || true; fi
export PATH="$HOME/.local/share/pnpm:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found on your PATH."
  echo ""
  echo "Install pnpm via npm (requires Node.js):"
  echo "    npm install -g pnpm"
  echo ""
  echo "Or follow https://pnpm.io/installation"
  read -p "Press Enter to close..." _
  exit 1
fi

cd gk_videogame_v2 || { echo "Cannot find gk_videogame_v2/ — has the folder been moved?"; read -p "Press Enter..." _; exit 1; }

if [ ! -d node_modules ]; then
  echo "First run — installing dependencies..."
  pnpm install || { echo "pnpm install failed."; read -p "Press Enter..." _; exit 1; }
  echo ""
fi

if [ ! -f packages/cards/data/cards.generated.json ]; then
  echo "First run — building card database..."
  pnpm cards:build || { echo "pnpm cards:build failed."; read -p "Press Enter..." _; exit 1; }
  echo ""
fi

echo "Launching Goosklerf..."
echo ""
pnpm play -- "$@"
exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
  echo "Game ended cleanly."
else
  echo "Game exited with code $exit_code."
fi
read -p "Press Enter to close..." _
exit $exit_code
