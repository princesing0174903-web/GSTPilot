#!/bin/bash
# GSTPilot permanent watchdog — SINGLE instance, auto-restarts dev server.
# Uses setsid -f so both watchdog AND server survive command boundaries + OOM.
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project

# Guard: exit if another watchdog is already running
LOCKFILE=/tmp/gstpilot-watchdog.lock
exec 200>"$LOCKFILE"
if ! flock -n 200; then
  echo "[$(date +%H:%M:%S)] another watchdog is already running — exiting" >> /home/z/my-project/watchdog.log
  exit 0
fi

echo "[$(date +%H:%M:%S)] permanent watchdog started (single-instance)" >> /home/z/my-project/watchdog.log
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] next-server down — starting with setsid -f..." >> /home/z/my-project/watchdog.log
    setsid -f bash -c 'NODE_OPTIONS="--max-old-space-size=2200 --max-semi-space-size=48" node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1'
    sleep 12  # wait for server to be ready before checking again
  fi
  sleep 8
done
