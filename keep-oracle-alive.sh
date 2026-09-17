#!/bin/bash
# Keepalive: start dev server ONLY if port 3000 is down (idempotent).
cd /home/z/my-project
if ss -tln 2>/dev/null | grep -q ":3000"; then
  exit 0  # server already up
fi
# Server is down — restart it
pkill -f "next dev" 2>/dev/null
sleep 1
NODE_OPTIONS="--max-old-space-size=2560" nohup setsid node node_modules/next/dist/bin/next dev --webpack -p 3000 > /home/z/my-project/dev.log 2>&1 < /dev/null &
disown
echo "[$(date '+%H:%M:%S')] dev server restarted by keepalive" >> /tmp/keepalive.log
