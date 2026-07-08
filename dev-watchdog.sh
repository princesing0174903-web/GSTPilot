#!/bin/bash
# GSTPilot dev-server watchdog — Turbopack edition.
# Turbopack compiles the 146-dynamic-import page.tsx in ~12s (vs 90s for
# webpack) and uses ~40% less peak memory, which keeps the 4GB sandbox out of
# the OOM danger zone. Auto-restarts on any exit.
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[watchdog $(date +%H:%M:%S)] started (turbopack, heap=2000m)" >> dev.log
while true; do
  NODE_OPTIONS="--max-old-space-size=2000 --max-semi-space-size=64" \
    node node_modules/.bin/next dev -p 3000 --turbo >> dev.log 2>&1
  EC=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited code=$EC — restarting in 4s..." >> dev.log
  sync 2>/dev/null || true
  sleep 4
done
