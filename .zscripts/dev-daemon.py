#!/usr/bin/env python3
"""Double-fork daemon to run Next.js dev server detached from the shell.
Survives shell exit and auto-restarts on OOM crash.
"""
import os
import sys
import time
import subprocess
import signal

PROJECT = "/home/z/my-project"
LOG = f"{PROJECT}/dev.log"
NODE_OPTS = "--max-old-space-size=1024"

def daemon():
    # Double-fork to truly detach
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    # Redirect stdio to dev.log
    log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    # Keep PID
    with open(f"{PROJECT}/.zscripts/dev.pid", "w") as f:
        f.write(str(os.getpid()))
    # Auto-restart loop
    while True:
        env = dict(os.environ)
        env["NODE_OPTIONS"] = NODE_OPTS
        proc = subprocess.Popen(
            ["node", "node_modules/.bin/next", "dev", "-p", "3000"],
            cwd=PROJECT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        proc.wait()
        with open(LOG, "a") as f:
            f.write(f"[daemon {time.strftime('%H:%M:%S')}] next exited (rc={proc.returncode}), restarting in 5s\n")
        time.sleep(5)

if __name__ == "__main__":
    daemon()
