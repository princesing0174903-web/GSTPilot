#!/bin/bash
# GSTPilot permanent watchdog — auto-restarts the dev server if it crashes.
# Uses setsid -f to survive command boundaries (the key fix).
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
while true; do
  # Check if next-server is running
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] next-server down — starting..." >> /home/z/my-project/watchdog.log
    setsid -f bash -c 'NODE_OPTIONS="--max-old-space-size=1500 --max-semi-space-size=48" node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1'
    sleep 8  # wait for server to be ready
  fi
  sleep 5  # check every 5 seconds
done
