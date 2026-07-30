#!/bin/bash
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project

LOCKFILE=/tmp/t10-watchdog.lock
exec 200>"$LOCKFILE"
if ! flock -n 200; then exit 0; fi

echo "[$(date +%H:%M:%S)] T10 watchdog started (pid $$)" >> /home/z/my-project/watchdog.log
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] starting next dev (turbopack, 1.5GB heap)" >> /home/z/my-project/watchdog.log
    cd /home/z/my-project
    NODE_OPTIONS="--max-old-space-size=1536" setsid -f node /home/z/my-project/node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
    sleep 15
  fi
  sleep 10
done
