#!/usr/bin/env bash
# dev-keepalive-direct.sh — Permanent dev server auto-restart wrapper
#
# Bypasses `bun run dev` (which uses `bun x next` and gets stuck retrying
# network fetches). Calls ./node_modules/.bin/next directly with a 2GB heap.
#
# Auto-restarts on OOM/crash. Caps dev.log at 2MB. Single instance.

set -u

PROJECT_DIR="/home/z/my-project"
LOG_FILE="$PROJECT_DIR/dev.log"
PIDFILE="/tmp/gstpilot-dev-keepalive.pid"
NEXT_BIN="$PROJECT_DIR/node_modules/.bin/next"

# ─── Kill any existing dev server + keepalive ────────────────────────────────
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
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun x next" 2>/dev/null || true
sleep 2

# ─── Start the keepalive loop in a detached session ──────────────────────────
nohup setsid bash -c "
  PROJECT_DIR='$PROJECT_DIR'
  LOG_FILE='$LOG_FILE'
  NEXT_BIN='$NEXT_BIN'

  rotate_log() {
    if [ -f \"\$LOG_FILE\" ] && [ \"\$(stat -c%s \"\$LOG_FILE\" 2>/dev/null || echo 0)\" -gt 2097152 ]; then
      mv \"\$LOG_FILE\" \"\$LOG_FILE.old\" 2>/dev/null || true
    fi
  }

  while true; do
    rotate_log
    echo \"=== [keepalive] starting next dev at \$(date -u +%Y-%m-%dT%H:%M:%SZ) ===\" >> \"\$LOG_FILE\"
    cd \"\$PROJECT_DIR\"
    NODE_OPTIONS='--max-old-space-size=2048' \"\$NEXT_BIN\" dev -p 3000 --webpack >> \"\$LOG_FILE\" 2>&1
    EXIT_CODE=\$?
    echo \"=== [keepalive] dev server exited (code=\$EXIT_CODE) at \$(date -u +%Y-%m-%dT%H:%M:%SZ) — restarting in 3s ===\" >> \"\$LOG_FILE\"
    sleep 3
  done
" > /dev/null 2>&1 < /dev/null &
KEEPALIVE_PID=$!
disown 2>/dev/null || true

echo "$KEEPALIVE_PID" > "$PIDFILE"
echo "Dev keepalive started (PID $KEEPALIVE_PID)"
echo "Auto-restart on crash is ON."
echo "To stop: kill \$(cat $PIDFILE)"
