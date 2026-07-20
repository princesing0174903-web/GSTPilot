#!/bin/bash
# GSTPilot webpack dev-server watchdog
# Restarts the Next.js dev server (webpack mode) whenever it dies.
# The 4GB sandbox OOM-kills next-server during heavy compiles; this script
# keeps it alive so webpack's .next cache eventually warms up and compiles
# become fast + low-memory.
cd /home/z/my-project

HEAP=2560
PORT=3000
LOG=dev.log
PIDFILE=.dev-server.pid

while true; do
  echo "[$(date '+%H:%M:%S')] ▶ starting dev server (heap=${HEAP}MB)..."
  NODE_OPTIONS="--max-old-space-size=${HEAP}" node node_modules/next/dist/bin/next dev --webpack -p $PORT > $LOG 2>&1 &
  SERVER_PID=$!
  echo $SERVER_PID > $PIDFILE
  echo "[$(date '+%H:%M:%S')] ✓ server PID $SERVER_PID"

  # Wait for "Ready"
  for i in $(seq 1 20); do
    sleep 1
    if grep -q "Ready" $LOG 2>/dev/null; then
      echo "[$(date '+%H:%M:%S')] ✓ server ready"
      break
    fi
  done

  # Keep alive: poll every 8s, restart on death
  while true; do
    sleep 8
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date '+%H:%M:%S')] ✗ server died — restarting..."
      break
    fi
  done
done
