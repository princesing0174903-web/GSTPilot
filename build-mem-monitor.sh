#!/bin/bash
# Memory monitor — samples RSS of the build process tree every 1s.
# Writes timestamped rows to /home/z/my-project/build-mem.log
LOG=/home/z/my-project/build-mem.log
echo "timestamp total_rss_kb total_vsz_kb next_pids next_rss_kb" > "$LOG"
while true; do
  TS=$(date +%s%3N)
  # Sum RSS of all node/next processes
  PIDS=$(pgrep -f "next\|node" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  if [ -z "$PIDS" ]; then
    echo "$TS 0 0 0 0" >> "$LOG"
  else
    # ps -o rss,vsz in KB
    READOUT=$(ps -eo rss,vsz,comm 2>/dev/null | awk '$3 ~ /next|node/ {rss+=$1; vsz+=$2; n++} END {printf "%d %d %d", rss, vsz, n}')
    echo "$TS $READOUT" >> "$LOG"
  fi
  sleep 1
done
