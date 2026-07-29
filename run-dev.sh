#!/bin/bash
# Robust dev server runner — restarts next dev if it dies (memory pressure, crash, etc.)
# Webpack mode + 2560MB heap to stay under the 4GB cgroup limit while compiling the
# large AppRoot dependency tree.
cd /home/z/my-project
while true; do
  echo "[$(date +%H:%M:%S)] Starting next dev (webpack, 2560MB heap)..."
  NODE_OPTIONS="--max-old-space-size=2560" npx next dev -p 3000 --webpack >> dev.log 2>&1
  EXIT=$?
  echo "[$(date +%H:%M:%S)] next dev exited with code $EXIT, restarting in 3s..."
  sleep 3
done
