#!/bin/bash
# GSTPilot dev-server watchdog — Turbopack edition (memory-optimized).
# 1500MB heap keeps the total next-server process under ~2.2GB, leaving ~400MB
# for the browser and other processes on the 4GB sandbox. Turbopack compiles
# the 146-dynamic-import page.tsx in ~2s (cached) / ~15s (cold).
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[watchdog $(date +%H:%M:%S)] started (turbopack, heap=1500m)" >> dev.log
while true; do
  NODE_OPTIONS="--max-old-space-size=1500 --max-semi-space-size=48" \
    node node_modules/.bin/next dev -p 3000 --turbo >> dev.log 2>&1
  EC=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited code=$EC — restarting in 4s..." >> dev.log
  sync 2>/dev/null || true
  sleep 4
done
