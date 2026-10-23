#!/usr/bin/env bash
# Run the UI dev server (http://localhost:5290, also reachable on the LAN for dev-remote builds).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi

exec npm run dev -w ui
