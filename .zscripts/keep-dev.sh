#!/bin/bash
cd /home/z/my-project
while true; do
  bun run dev >> dev.log 2>&1
  echo "[keepalive] dev server exited, restarting in 3s..." >> dev.log
  sleep 3
done
