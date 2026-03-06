#!/bin/bash
# Stop all IDS pipeline services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$PROJECT_ROOT/logs"

cd "$PROJECT_ROOT"

echo "[STOP_ALL] Stopping IDS services..."

for name in frontend victim_app backend ml_api flow_watcher capture; do
  pidfile="$LOGS_DIR/${name}.pid"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "[STOP_ALL] Stopped $name (PID $pid)"
    fi
    rm -f "$pidfile"
  fi
done

# Also kill tcpdump and any stray python/node
pkill -f "tcpdump.*data/pcap" 2>/dev/null || true
pkill -f "flow_watcher.py" 2>/dev/null || true
pkill -f "prediction_api.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "[STOP_ALL] Done."
