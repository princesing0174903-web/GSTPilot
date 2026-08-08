#!/usr/bin/env bash
# Zoho QA watchdog — keeps the Next.js dev server alive.
# Restarts on crash (OOM-kill). Uses 2048MB heap.
# Logs to dev.log. Writes its own PID to .dev-watchdog.pid.
set -u
cd /home/z/my-project
echo "[watchdog $(date +%H:%M:%S)] starting supervisor" >> dev.log
while true; do
  NODE_OPTIONS="--max-old-space-size=2048" node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1
  RC=$?
  echo "[watchdog $(date +%H:%M:%S)] next exited (rc=$RC), restarting in 4s" >> dev.log
  sleep 4
done
