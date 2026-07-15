#!/bin/bash
# Dev server wrapper — stays alive as long as next dev runs
cd /home/z/my-project
exec node node_modules/next/dist/bin/next dev -p 3000 --webpack
