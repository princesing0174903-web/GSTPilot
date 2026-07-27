#!/usr/bin/env bash
# Turbopack dev keepalive — lighter memory than webpack, survives OOM pressure
set -u
PROJECT_DIR="/home/z/my-project"
LOG_FILE="$PROJECT_DIR/dev.log"
PIDFILE="/tmp/gstpilot-dev-keepalive.pid"

if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "${OLDPID:-}" ] && kill -0 "$OLDPID" 2>/dev/null; then
    kill "$OLDPID" 2>/dev/null || true
    sleep 2
    kill -9 "$OLDPID" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
fi

pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"; exit 0' TERM INT EXIT

while true; do
  rotate_log() {
    if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 2097152 ]; then
      mv "$LOG_FILE" "$LOG_FILE.old" 2>/dev/null || true
    fi
  }
  rotate_log
  echo "=== [keepalive-turbo] starting next dev (turbopack, 1536MB) at $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG_FILE"
  cd "$PROJECT_DIR"
  NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=64" node /home/z/my-project/node_modules/.bin/next dev -p 3000 --turbopack >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  echo "=== [keepalive-turbo] dev server exited (code=$EXIT_CODE) at $(date -u +%Y-%m-%dT%H:%M:%SZ) — restarting in 3s ===" >> "$LOG_FILE"
  sleep 3
done
