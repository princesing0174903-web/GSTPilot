#!/usr/bin/env python3
"""
GSTPilot Infinity™ — Dev Server Watchdog Daemon (Turbopack edition)

Double-fork daemon that auto-restarts the Next.js dev server if it dies
(OOM killed in 4GB sandbox). Logs to dev.log (append mode).

Uses Turbopack (--turbo) which is memory-efficient for the large module graph.
The lightweight page.tsx (5 dynamic imports) keeps the initial compile under
the 4 GB sandbox cgroup limit.
"""
import os, sys, time, signal

DEVLOG = "/home/z/my-project/dev.log"
CWD = "/home/z/my-project"
os.chdir(CWD)

# Double-fork daemon for true detachment
pid = os.fork()
if pid > 0:
    time.sleep(0.5)
    print(f"DAEMON_LAUNCHED child_pid={pid}")
    sys.exit(0)

os.setsid()
pid2 = os.fork()
if pid2 > 0:
    os._exit(0)

# Grandchild — the watchdog loop
# Truncate log on each daemon start so we don't accumulate stale OOM messages
logfd = os.open(DEVLOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
nullfd = os.open("/dev/null", os.O_RDONLY)
os.dup2(nullfd, 0)
os.dup2(logfd, 1)
os.dup2(logfd, 2)

env = dict(os.environ)
env["NODE_OPTIONS"] = "--max-old-space-size=1800 --max-semi-space-size=48"

def log(msg):
    line = f"[watchdog {time.strftime('%H:%M:%S')}] {msg}\n"
    os.write(logfd, line.encode())

log("watchdog daemon started (turbopack, heap=1800m) — will auto-restart next dev on exit")

while True:
    log("starting next dev (port 3000, turbopack)...")
    ret = os.spawnvpe(os.P_WAIT, "node",
        ["node", "node_modules/.bin/next", "dev", "-p", "3000", "--turbo"], env)
    log(f"next dev exited with code {ret} — restarting in 3s")
    time.sleep(3)
