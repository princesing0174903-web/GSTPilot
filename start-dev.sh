#!/bin/bash
# Dev server startup script — fully detached, signal-resistant
trap '' SIGHUP SIGTERM SIGINT
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1400"
exec node node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1
