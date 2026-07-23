#!/bin/bash
trap '' SIGHUP SIGTERM
cd /home/z/my-project
while true; do
  echo "[$(date +%H:%M:%S)] starting next dev" >> dev.log
  NODE_OPTIONS="--max-old-space-size=2560" npx next dev -p 3000 --webpack >> dev.log 2>&1
  echo "[$(date +%H:%M:%S)] next dev exited ($?), restart in 3s" >> dev.log
  sleep 3
done
