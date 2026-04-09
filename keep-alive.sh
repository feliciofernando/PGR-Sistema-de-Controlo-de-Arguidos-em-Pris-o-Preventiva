#!/bin/bash
cd /home/z/my-project
while true; do
    echo "[$(date '+%H:%M:%S')] Starting dev server..." >> keep-alive.log
    NODE_OPTIONS="--max-old-space-size=256" npx next dev --port 3000 >> dev.log 2>&1
    echo "[$(date '+%H:%M:%S')] Server died, restarting in 2s..." >> keep-alive.log
    sleep 2
done
