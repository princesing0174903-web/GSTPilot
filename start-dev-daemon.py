import os, sys, time

DEVLOG = "/home/z/my-project/dev.log"
CWD = "/home/z/my-project"
os.chdir(CWD)

# Double-fork daemon
pid = os.fork()
if pid > 0:
    time.sleep(0.5)
    print(f"DAEMON_LAUNCHED child_pid={pid}")
    sys.exit(0)

os.setsid()
pid2 = os.fork()
if pid2 > 0:
    os._exit(0)

# Grandchild
sys.stdout.flush(); sys.stderr.flush()
logfd = os.open(DEVLOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
nullfd = os.open("/dev/null", os.O_RDONLY)
os.dup2(nullfd, 0); os.dup2(logfd, 1); os.dup2(logfd, 2)
os.close(nullfd); os.close(logfd)

env = dict(os.environ)
env["NODE_OPTIONS"] = "--max-old-space-size=2200"
os.execvpe("node", ["node", "node_modules/.bin/next", "dev", "-p", "3000", "--webpack"], env)
