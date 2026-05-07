#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR="$SCRIPT_DIR/goosklerf-digital"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
  fi
fi

cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

if [ "$#" -eq 0 ]; then
  set -- --games 100 --players 2 --seed quickstart --out reports/quickstart --max-turns 200
fi

pnpm sim -- "$@"
