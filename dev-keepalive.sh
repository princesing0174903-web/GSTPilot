#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# dev-keepalive.sh — Permanent dev server auto-restart wrapper
#
# The Next.js dev server occasionally OOM-crashes in this 4GB sandbox because
# the app is huge (Firebase + 50+ Radix UI components + recharts + framer-motion
# + Turbopack compilation). This wrapper guarantees the preview NEVER stays dead:
#
#   - Starts `bun run dev` with a 1.5GB heap (doubled from the original 768MB)
#   - If the process exits for ANY reason (OOM, crash, signal), it restarts
#     automatically after 3 seconds
#   - Caps the dev.log at 2MB (rotates) so it can't fill the disk
#   - Single instance: kills any existing dev server before starting
#
# This script is idempotent — running it twice just replaces the running
# keepalive. Safe to call from cron / startup / manually.
# ═══════════════════════════════════════════════════════════════════════════════

set -u

PROJECT_DIR="/home/z/my-project"
LOG_FILE="$PROJECT_DIR/dev.log"
PIDFILE="/tmp/gstpilot-dev-keepalive.pid"

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

# Kill any stray next-server / bun run dev processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "bun run dev" 2>/dev/null || true
sleep 2

# ─── Start the keepalive loop in a detached session ──────────────────────────
# We use setsid + nohup + disown so the wrapper survives shell exit.
nohup setsid bash -c '
  PROJECT_DIR="/home/z/my-project"
  LOG_FILE="$PROJECT_DIR/dev.log"

  # Rotate log if > 2MB
  rotate_log() {
    if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 2097152 ]; then
      mv "$LOG_FILE" "$LOG_FILE.old" 2>/dev/null || true
    fi
  }

  while true; do
    rotate_log
    echo "=== [keepalive] starting bun run dev at $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG_FILE"
    cd "$PROJECT_DIR"
    bun run dev >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "=== [keepalive] dev server exited (code=$EXIT_CODE) at $(date -u +%Y-%m-%dT%H:%M:%SZ) — restarting in 3s ===" >> "$LOG_FILE"
    sleep 3
  done
' > /dev/null 2>&1 < /dev/null &
KEEPALIVE_PID=$!
disown 2>/dev/null || true

echo "$KEEPALIVE_PID" > "$PIDFILE"
echo "Dev keepalive started (PID $KEEPALIVE_PID)"
echo "The dev server will auto-restart forever if it crashes."
echo "To stop: kill \$(cat $PIDFILE)"
