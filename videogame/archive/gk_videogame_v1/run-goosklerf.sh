#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR="$SCRIPT_DIR/goosklerf-digital"
URL="http://127.0.0.1:5173"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 20+ or 22+ first."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it with: corepack enable"
  exit 1
fi

cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

if command -v open >/dev/null 2>&1; then
  (sleep 3 && open "$URL") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 3 && xdg-open "$URL") &
fi

echo "Starting Goosklerf II at $URL"
pnpm --filter desktop run dev --host 127.0.0.1 --strictPort
