#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOGS_DIR="$PROJECT_ROOT/logs"
DATA_PCAP="$PROJECT_ROOT/data/pcap"
DATA_FLOWS="$PROJECT_ROOT/data/flows"

mkdir -p "$LOGS_DIR" "$DATA_PCAP" "$DATA_FLOWS"

# Fix permissions to prevent tcpdump ownership issues
echo "[RUN_ALL] Fixing permissions..."
chown -R $USER:$USER "$LOGS_DIR" "$DATA_PCAP" "$DATA_FLOWS" 2>/dev/null || true
chmod -R 775 "$LOGS_DIR" "$DATA_PCAP" "$DATA_FLOWS" 2>/dev/null || true

cd "$PROJECT_ROOT"

echo "[RUN_ALL] Starting IDS Pipeline..."

# Activate python environment
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  echo "[ERROR] Python venv not found"
  exit 1
fi

# 1 Packet capture
echo "[RUN_ALL] Starting packet capture..."
bash packet-capture-service/capture_service.sh > "$LOGS_DIR/capture.log" 2>&1 &
CAPTURE_PID=$!
echo $CAPTURE_PID > "$LOGS_DIR/capture.pid"

sleep 2

# 2 Flow watcher
echo "[RUN_ALL] Starting flow watcher..."
python3 flow-extraction-service/flow_watcher.py > "$LOGS_DIR/flow_watcher.log" 2>&1 &
WATCHER_PID=$!
echo $WATCHER_PID > "$LOGS_DIR/flow_watcher.pid"

sleep 2

# 3 ML API
echo "[RUN_ALL] Starting ML API..."
python3 ml-service/prediction_api.py > "$LOGS_DIR/ml_api.log" 2>&1 &
ML_PID=$!
echo $ML_PID > "$LOGS_DIR/ml_api.pid"

# Wait for ML API to be ready
echo "[RUN_ALL] Waiting for ML API to start..."
for i in {1..10}; do
  if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "[RUN_ALL] ML API is ready"
    break
  fi
  sleep 1
done

# 4 Backend
echo "[RUN_ALL] Starting backend..."
cd backend
node server.js > "$LOGS_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOGS_DIR/backend.pid"
cd "$PROJECT_ROOT"

# Wait for Backend to be ready
echo "[RUN_ALL] Waiting for Backend to start..."
for i in {1..15}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "[RUN_ALL] Backend is ready"
    break
  fi
  sleep 1
done

# 5 Victim app
echo "[RUN_ALL] Starting victim app..."
cd victim-app
PORT=8000 node server.js > "$LOGS_DIR/victim_app.log" 2>&1 &
VICTIM_PID=$!
echo $VICTIM_PID > "$LOGS_DIR/victim_app.pid"
cd "$PROJECT_ROOT"

# Wait for Victim app to be ready
echo "[RUN_ALL] Waiting for Victim app to start..."
for i in {1..10}; do
  if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "[RUN_ALL] Victim app is ready"
    break
  fi
  sleep 1
done

# 6 Frontend
echo "[RUN_ALL] Starting frontend..."
cd frontend/admin-dashboard

if [ ! -d "node_modules" ]; then
  npm install
fi

npm run dev > "$LOGS_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOGS_DIR/frontend.pid"

cd "$PROJECT_ROOT"

echo ""
echo "[RUN_ALL] IDS PIPELINE STARTED"
echo "Capture PID:  $CAPTURE_PID"
echo "Watcher PID:  $WATCHER_PID"
echo "ML API PID:   $ML_PID"
echo "Backend PID:  $BACKEND_PID"
echo "Victim PID:   $VICTIM_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Dashboard: http://localhost:5173"
echo "Backend:   http://localhost:3000"
echo "ML API:    http://localhost:5000"