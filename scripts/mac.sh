#!/usr/bin/env bash
# Sync the working tree to the Mac, build a preset there, optionally launch it.
# Usage: ./scripts/mac.sh <dev|dev-remote|release> [--run]
set -euo pipefail
cd "$(dirname "$0")/.."

preset="${1:?usage: $0 <dev|dev-remote|release> [--run]}"
run="${2:-}"
host="${GLITCH_MAC_HOST:-glitch-mac}"
dir="${GLITCH_MAC_DIR:-~/code/glitch}"
dev_host="${GLITCH_DEV_HOST:-}"

if [ "$preset" = dev-remote ] && [ -z "$dev_host" ]; then
  echo "dev-remote needs GLITCH_DEV_HOST (this machine's LAN IP or hostname)" >&2
  exit 1
fi

echo "==> Syncing to $host:$dir"
ssh "$host" "mkdir -p $dir"
rsync -az --delete \
  --exclude node_modules/ --exclude build/ --exclude ui/dist/ --exclude .git/ \
  ./ "$host:$dir/"

echo "==> Building $preset on $host"
# Configure every time: it's quick once cached, and picks up a changed GLITCH_DEV_HOST.
ssh "$host" "bash -lc '
  set -euo pipefail
  cd $dir
  if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci
  fi
  export GLITCH_DEV_HOST=\"$dev_host\"
  cmake --preset $preset
  cmake --build --preset $preset
'"

if [ "$run" = --run ]; then
  config=$([ "$preset" = release ] && echo Release || echo Debug)
  app="$dir/build/$preset/engine/Glitch_artefacts/$config/Glitch.app"
  echo "==> Launching $app (needs someone logged in on the Mac)"
  ssh "$host" "osascript -e 'quit app \"Glitch\"' >/dev/null 2>&1 || true; open $app"
fi
