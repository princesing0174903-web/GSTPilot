#!/bin/bash
trap '' SIGHUP SIGTERM SIGINT SIGPIPE
cd /home/z/my-project
echo "[$(date +%H:%M:%S)] watchdog started (webpack, heap=3072m)" > /home/z/my-project/watchdog.log
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] next-server down — starting..." >> /home/z/my-project/watchdog.log
    setsid -f bash -c 'NODE_OPTIONS="--max-old-space-size=3072 --max-semi-space-size=64" node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1'
    sleep 12
  fi
  sleep 6
done
