#!/bin/bash
# Pre-warm webpack cache through multiple compile cycles.
# Each cycle compiles more chunks and caches them in .next/.
# Eventually all chunks are cached and the server survives.
cd /home/z/my-project

HEAP=2560
LOG=dev.log

start_server() {
  nohup bash -c "NODE_OPTIONS=\"--max-old-space-size=${HEAP}\" node node_modules/next/dist/bin/next dev --webpack -p 3000 > $LOG 2>&1" >/dev/null 2>&1 &
  disown
  for i in $(seq 1 15); do
    sleep 1
    if grep -q "Ready" $LOG 2>/dev/null; then return 0; fi
  done
  return 1
}

kill_server() {
  pkill -f "next dev" 2>/dev/null
  pkill -f "next-server" 2>/dev/null
  sleep 2
}

for cycle in 1 2 3 4 5; do
  echo "=== Cycle $cycle ==="
  kill_server
  start_server
  echo "[$(date '+%H:%M:%S')] Server started, triggering compile..."
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 180 http://localhost:3000/)
  echo "[$(date '+%H:%M:%S')] HTTP $CODE"
  sleep 3
  if ps aux | grep -q "[n]ext-server"; then
    RSS=$(ps aux | grep "[n]ext-server" | awk '{print $6/1024}' | head -1)
    echo "[$(date '+%H:%M:%S')] ALIVE - RSS: ${RSS}MB"
    echo "=== SUCCESS: server survived at cycle $cycle ==="
    exit 0
  else
    echo "[$(date '+%H:%M:%S')] DEAD — cache partially warmed, retrying..."
  fi
done

echo "=== Server did not survive after 5 cycles ==="
exit 1
