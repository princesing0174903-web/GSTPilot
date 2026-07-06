#!/bin/bash
# GSTPilot Infinity™ — Dev Server Watchdog
# Auto-restarts the Next.js dev server if it dies (OOM killed in 4GB sandbox)
# Logs to dev.log

cd /home/z/my-project

while true; do
  echo "[watchdog $(date +%H:%M:%S)] starting next dev..." >> dev.log
  env NODE_OPTIONS="--max-old-space-size=1800" node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited with code $EXIT_CODE — restarting in 3s..." >> dev.log
  sleep 3
done
