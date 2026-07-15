#!/bin/bash
# Persistent dev server keeper — restarts server if it dies
# Uses minimal memory so it survives sandbox reapers
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] (Re)starting next dev..." >> /home/z/my-project/keeper.log
    NODE_OPTIONS='--max-old-space-size=768' nohup node node_modules/next/dist/bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    disown
  fi
  sleep 10
done
