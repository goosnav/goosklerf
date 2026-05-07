#!/bin/bash
# Play-Goosklerf.command — macOS double-click launcher.
#
# Double-clicking this in Finder opens Terminal, installs deps if needed,
# builds the card database if needed, and launches the CLI game.
#
# If something goes wrong, the terminal stays open with the error so you
# can read it before closing.

# Find this script's directory and cd to it (handles spaces in the path).
cd "$(dirname "$0")" || { echo "Cannot cd to script directory"; read -p "Press Enter..."; exit 1; }

echo "──────────────────────────────────────────────"
echo "  Goosklerf launcher  (macOS)"
echo "──────────────────────────────────────────────"
echo ""

# Finder-launched scripts don't inherit your shell's PATH. Pull in common
# locations where pnpm and node tend to live.
if [ -f "$HOME/.zshrc" ]; then . "$HOME/.zshrc" 2>/dev/null || true; fi
if [ -f "$HOME/.bash_profile" ]; then . "$HOME/.bash_profile" 2>/dev/null || true; fi
export PATH="$HOME/.local/share/pnpm:$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Confirm pnpm is reachable. If not, fail clearly with install instructions.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found on your PATH."
  echo ""
  echo "Install pnpm via Homebrew:"
  echo "    brew install pnpm"
  echo ""
  echo "Or via npm (requires Node.js):"
  echo "    npm install -g pnpm"
  echo ""
  echo "Then run this launcher again."
  read -p "Press Enter to close this window..." _
  exit 1
fi

# Hop into the active code directory.
cd gk_videogame_v2 || { echo "Cannot find gk_videogame_v2/ — has the folder been moved?"; read -p "Press Enter..." _; exit 1; }

# First-run setup: install deps if node_modules missing.
if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (this takes ~30 seconds)..."
  pnpm install || { echo "pnpm install failed."; read -p "Press Enter..." _; exit 1; }
  echo ""
fi

# First-run setup: build the card database if not yet generated.
if [ ! -f packages/cards/data/cards.generated.json ]; then
  echo "First run — building card database..."
  pnpm cards:build || { echo "pnpm cards:build failed."; read -p "Press Enter..." _; exit 1; }
  echo ""
fi

# Launch the game. Pass through any arguments the user dragged onto the script.
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
read -p "Press Enter to close this window..." _
exit $exit_code
