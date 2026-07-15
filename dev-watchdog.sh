#!/bin/bash
# Dev server watchdog — restarts next dev if it dies
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Starting next dev..." >> /home/z/my-project/watchdog.log
    NODE_OPTIONS='--max-old-space-size=768' node node_modules/next/dist/bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
    NODE_PID=$!
    # Wait for it to be ready (max 30s)
    for i in $(seq 1 30); do
      sleep 1
      if curl -s --max-time 2 http://localhost:3000/ > /dev/null 2>&1; then
        echo "[$(date)] Server ready (PID $NODE_PID)" >> /home/z/my-project/watchdog.log
        break
      fi
    done
  fi
  sleep 5
done
