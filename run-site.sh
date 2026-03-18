#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-ui}"

if [ ! -d node_modules ]; then
  npm install
fi

case "$MODE" in
  ui)
    npm run dev:ui
    ;;
  full)
    npm run dev
    ;;
  build)
    npm run build:ui
    ;;
  data)
    npm run build:data
    npm run build:pages
    ;;
  *)
    echo "Usage: ./run-site.sh [ui|full|build|data]"
    echo "  ui    : fast local UI dev without rebuilding data"
    echo "  full  : rebuild data + pages, then start dev server"
    echo "  build : build the static UI bundle"
    echo "  data  : refresh data and regenerate pages"
    exit 1
    ;;
esac
