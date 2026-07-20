#!/bin/bash
# GSTPilot dev server keepalive script
# Starts the Next.js dev server (webpack mode, 2.5GB heap) and keeps it running.
# The server tends to die if left idle in the sandbox, so this script restarts it.
cd /home/z/my-project

while true; do
  echo "[$(date)] Starting dev server..."
  NODE_OPTIONS='--max-old-space-size=2560' node node_modules/next/dist/bin/next dev --webpack -p 3000 > dev.log 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Server PID: $SERVER_PID"

  # Wait for "Ready" message
  for i in $(seq 1 15); do
    sleep 1
    if grep -q "Ready" dev.log 2>/dev/null; then
      echo "[$(date)] Server ready"
      break
    fi
  done

  # Trigger initial compile so the server is "warm" and less likely to be reaped
  sleep 1
  curl -s -o /dev/null --max-time 30 http://localhost:3000/ 2>/dev/null && echo "[$(date)] Initial compile done" || echo "[$(date)] Initial compile failed"

  # Keep the server alive by polling it every 10 seconds
  while true; do
    sleep 10
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server died, restarting..."
      break
    fi
    # Gentle ping to keep it active
    curl -s -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null
    # Check if still alive after ping
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server died during ping, restarting..."
      break
    fi
  done
done
