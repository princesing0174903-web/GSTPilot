#!/bin/bash
# GSTPilot dev-server watchdog — Turbopack edition (memory-optimized).
# 2500MB heap gives Turbopack room to cache the 146-dynamic-import page.tsx
# without hitting the memory warning that causes mid-request restarts.
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[watchdog $(date +%H:%M:%S)] started (turbopack, heap=1200m)" >> dev.log
while true; do
  NODE_OPTIONS="--max-old-space-size=1200 --max-semi-space-size=48" \
    node node_modules/.bin/next dev -p 3000 --turbo >> dev.log 2>&1
  EC=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited code=$EC — restarting in 4s..." >> dev.log
  sync 2>/dev/null || true
  sleep 4
done
