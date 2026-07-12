#!/bin/bash
# Webpack edition — lower memory peak for the large root page.
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[watchdog $(date +%H:%M:%S)] started (webpack, heap=1500m, warm-cache)" >> dev.log
while true; do
  NODE_OPTIONS="--max-old-space-size=1500 --max-semi-space-size=48" \
    node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1
  EC=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited code=$EC — restarting in 4s..." >> dev.log
  sync 2>/dev/null || true
  sleep 4
done
