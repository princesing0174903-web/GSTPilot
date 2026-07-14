#!/bin/bash
cd /home/z/my-project
exec env NODE_OPTIONS="--max-old-space-size=3072" /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack
