#!/bin/bash
# GSTPilot — Cache-warming watchdog
#
# The 4GB sandbox OOM-kills next-server during heavy compiles. This script
# restarts the server through multiple cycles. Each cycle, webpack caches
# more compiled chunks in .next/dev/cache/webpack/. Eventually all chunks
# are cached, the compile is fast + low-memory, and the browser succeeds.
#
# Strategy:
#   1. Start server (2.5GB heap — minimum for successful compile)
#   2. Curl / to trigger page compile (caches the page chunk)
#   3. Try to open the browser (triggers client chunk compiles)
#   4. If server dies → restart (cached chunks persist in .next/dev/cache)
#   5. Repeat until browser loads successfully or max cycles reached

cd /home/z/my-project
LOG=dev.log
MAX_CYCLES=8

for cycle in $(seq 1 $MAX_CYCLES); do
  echo "═══════════════════════════════════════════════════════"
  echo "  CYCLE $cycle / $MAX_CYCLES"
  echo "═══════════════════════════════════════════════════════"

  # Kill any existing server
  pkill -f "next dev" 2>/dev/null
  sleep 2

  # Start server
  echo "[$(date '+%H:%M:%S')] Starting server..."
  nohup bash -c "NODE_OPTIONS='--max-old-space-size=2560' node node_modules/next/dist/bin/next dev --webpack -p 3000 > $LOG 2>&1" >/dev/null 2>&1 &
  disown

  # Wait for ready
  for i in $(seq 1 20); do
    sleep 1
    if grep -q "Ready" $LOG 2>/dev/null; then
      echo "[$(date '+%H:%M:%S')] Server ready (${i}s)"
      break
    fi
  done

  # Trigger page compile via curl
  echo "[$(date '+%H:%M:%S')] Compiling page..."
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 180 http://localhost:3000/)
  echo "[$(date '+%H:%M:%S')] Page compile: HTTP $CODE"

  if [ "$CODE" != "200" ]; then
    echo "[$(date '+%H:%M:%S')] Page compile failed — restarting..."
    continue
  fi

  # Check server alive
  if ! ps aux | grep -q "[n]ext-server"; then
    echo "[$(date '+%H:%M:%S')] Server died after compile — restarting..."
    continue
  fi

  RSS=$(ps aux | grep "[n]ext-server" | awk '{print $6/1024}' | head -1)
  echo "[$(date '+%H:%M:%S')] Server ALIVE — RSS: ${RSS}MB"

  # Try opening browser
  echo "[$(date '+%H:%M:%S')] Opening browser..."
  BROWSER_RESULT=$(agent-browser open http://localhost:3000/ --timeout 60000 2>&1)
  echo "$BROWSER_RESULT" | tail -3

  # Check if browser succeeded
  if echo "$BROWSER_RESULT" | grep -q "✓"; then
    echo "[$(date '+%H:%M:%S')] ★★★ BROWSER SUCCESS at cycle $cycle ★★★"

    # Take a snapshot to verify content
    echo "[$(date '+%H:%M:%S')] Taking snapshot..."
    agent-browser get title 2>&1 | tail -1
    agent-browser get url 2>&1 | tail -1

    # Keep server alive
    echo "[$(date '+%H:%M:%S')] Server is running. Keeping alive."
    exit 0
  fi

  echo "[$(date '+%H:%M:%S')] Browser failed — server may have died during chunk compile"
  echo "[$(date '+%H:%M:%S')] Cache size: $(du -sh .next/dev/cache/webpack/ 2>/dev/null | awk '{print $1}')"
done

echo "═══════════════════════════════════════════════════════"
echo "  Max cycles reached. Server may need more memory."
echo "═══════════════════════════════════════════════════════"
exit 1
