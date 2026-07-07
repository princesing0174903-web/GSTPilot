#!/bin/bash
# GSTPilot Infinity™ — Persistent Dev Server Watchdog
# Uses setsid --fork to persist across bash tool calls
# Auto-restarts the Next.js dev server if it dies (OOM killed in 4GB sandbox)
trap '' SIGHUP SIGTERM SIGINT
cd /home/z/my-project
while true; do
  echo "[watchdog $(date +%H:%M:%S)] starting next dev..." >> dev.log
  NODE_OPTIONS="--max-old-space-size=2000" node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[watchdog $(date +%H:%M:%S)] next dev exited with code $EXIT_CODE — restarting in 3s..." >> dev.log
  sleep 3
done
