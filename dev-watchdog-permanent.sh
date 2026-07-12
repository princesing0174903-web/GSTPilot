#!/bin/bash
# GSTPilot permanent watchdog — auto-restarts the dev server using setsid -f
# so both the watchdog AND the server survive command boundaries + OOM kills.
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[$(date +%H:%M:%S)] permanent watchdog started" >> /home/z/my-project/watchdog.log
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] next-server down — starting with setsid -f..." >> /home/z/my-project/watchdog.log
    setsid -f bash -c 'NODE_OPTIONS="--max-old-space-size=2500 --max-semi-space-size=64" node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1'
    sleep 10
  fi
  sleep 5
done
