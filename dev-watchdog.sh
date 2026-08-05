#!/bin/bash
cd /home/z/my-project
exec >> /home/z/my-project/watchdog.log 2>&1
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Starting next dev (webpack)..."
    NODE_OPTIONS='--max-old-space-size=2560' node node_modules/next/dist/bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1 &
    NODE_PID=$!
    for i in $(seq 1 90); do
      sleep 1
      if curl -s --max-time 5 http://localhost:3000/ > /dev/null 2>&1; then
        echo "[$(date)] Server ready (PID $NODE_PID)"
        break
      fi
    done
  fi
  sleep 5
done
