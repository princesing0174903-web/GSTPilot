#!/bin/bash
# Dev server startup script — fully detached, signal-resistant
# Uses Turbopack (memory-efficient for large module graphs) with a 1800MB heap.
# The lightweight page.tsx (5 dynamic imports) keeps the initial compile under
# the 4 GB sandbox cgroup limit.
trap '' SIGHUP SIGTERM SIGINT
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1800 --max-semi-space-size=48"
exec node node_modules/.bin/next dev -p 3000 --turbo > /home/z/my-project/dev.log 2>&1
