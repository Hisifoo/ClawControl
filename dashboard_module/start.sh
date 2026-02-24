#!/bin/bash
# Start the dashboard server if not already running
if ! pgrep -f "node.*dashboards/server.js" > /dev/null 2>&1; then
  cd /home/openclaw/.openclaw/workspace/dashboards
  nohup node server.js >> /tmp/dashboard-server.log 2>&1 &
  echo "Dashboard server started on port 8000 (PID: $!)"
else
  echo "Dashboard server already running"
fi
