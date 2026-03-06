# AI-Based Intrusion Detection System — Final Documentation

This document provides complete technical documentation so another engineer can reproduce and operate the system from scratch.

---

## 1. Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NETWORK TRAFFIC (packets)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PACKET CAPTURE (tcpdump)                                                         │
│  packet-capture-service/capture_service.sh                                        │
│  • Interface: any (or NETWORK_INTERFACE env)                                      │
│  • Output: data/pcap/capture_YYYYMMDD_HHMMSS.pcap                                 │
│  • Rotation: every 10 seconds (-G 10)                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FLOW EXTRACTION (Python)                                                         │
│  flow-extraction-service/flow_watcher.py                                          │
│  • Watches: data/pcap/                                                            │
│  • Stability: file size unchanged for 3 seconds → process                         │
│  • Runs: flow_extractor.py per PCAP                                               │
│  • Output: data/flows/flows.csv (top 20 features + src_ip, dest_ip, etc.)         │
│  • Sends: POST /analyze-traffic for each flow                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BACKEND API (Node.js Express) — Port 3000                                        │
│  ids-platform/server.js                                                           │
│  • POST /analyze-traffic: receives flow, calls ML API, stores in Supabase         │
│  • GET /api/metrics, /api/attacks, /api/traffic, /api/blocked-ips: JSON for UI    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────────┐
│  ML PREDICTION API — 5000     │     │  SUPABASE (PostgreSQL)                     │
│  ml-service/prediction_api.py │     │  • traffic_logs: all analyzed flows        │
│  • POST /predict              │     │  • attack_logs: flows classified as attack │
│  • Loads: model.pkl, scaler,  │     │  • blocked_ips: firewall block list        │
│    top20_features.json        │     └───────────────────────────────────────────┘
└───────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (React + Vite) — Port 5173                                      │
│  frontend/admin-dashboard/                                                        │
│  • Fetches: /api/metrics, /api/attacks, /api/traffic, /api/blocked-ips            │
│  • Polls: every 5 seconds                                                         │
│  • Theme: clean white SOC style, red for attacks, green for normal                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Responsibilities

| Service | Location | Port | Responsibility |
|---------|----------|------|----------------|
| Packet Capture | packet-capture-service/capture_service.sh | - | tcpdump writes rotating PCAP to data/pcap/ |
| Flow Extraction | flow-extraction-service/flow_watcher.py, flow_extractor.py | - | Watches PCAP, extracts top-20 features, POSTs flows to backend |
| ML API | ml-service/prediction_api.py | 5000 | Flask server, POST /predict, returns prediction, probability, severity |
| Backend | ids-platform/ (backend symlink) | 3000 | Express: /analyze-traffic, /api/*, stores in Supabase |
| Victim App | victim-app/ | 8000 | Target for attack simulation |
| Admin Dashboard | frontend/admin-dashboard/ | 5173 | React SPA, displays metrics and alerts |

---

## 3. Directory Structure

```
ai-ids-pipeline/
├── packet-capture-service/
│   └── capture_service.sh          # tcpdump wrapper
├── flow-extraction-service/
│   ├── flow_extractor.py           # PCAP → CSV (top 20 features)
│   └── flow_watcher.py             # Watches data/pcap, processes, sends to backend
├── ml-service/
│   ├── prediction_api.py           # Flask ML API
│   └── model/
│       ├── model.pkl               # RandomForest
│       ├── scaler.pkl              # StandardScaler
│       └── top20_features.json     # Feature schema
├── ids-platform/                   # Backend (backend → symlink)
│   ├── server.js
│   ├── routes/                     # apiDashboard, traffic, auth
│   ├── controllers/
│   ├── services/                   # databaseService, predictionService
│   └── config/                     # supabaseClient, auth
├── frontend/admin-dashboard/       # React dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── components/
│   └── vite.config.js
├── victim-app/                     # Target for simulate_attack
├── data/
│   ├── pcap/                       # PCAP output
│   └── flows/                      # flows.csv
├── Data/
│   ├── top20_features.json         # Canonical feature list
│   └── Processed Data/             # CICIDS2017_Processed.csv (training)
├── logs/                           # Service logs
├── scripts/
│   ├── run_all_services.sh
│   ├── stop_all_services.sh
│   ├── simulate_attack.py
│   ├── check_pipeline.py
│   └── validate_pipeline.py
├── Trained Models/Models/          # Original model artifacts
└── archive_unused/                 # Archived EJS, old scripts
```

---

## 4. Data Pipeline Explanation

1. **Capture**: tcpdump captures packets on the specified interface. Every 10 seconds it rotates to a new file `capture_YYYYMMDD_HHMMSS.pcap`.

2. **Stability Check**: flow_watcher monitors data/pcap/. It considers a PCAP "stable" when its file size has not changed for 3 seconds (configurable via `PCAP_STABILITY_SECONDS`).

3. **Flow Extraction**: For each stable PCAP, flow_extractor.py:
   - Groups packets by 5-tuple (src_ip, dest_ip, src_port, dest_port, protocol)
   - Computes CICIDS2017-style features for each flow
   - Outputs top 20 features (from Data/top20_features.json) plus identifiers
   - Writes to data/flows/flows.csv

4. **Backend Submission**: flow_watcher POSTs each flow to `http://localhost:3000/analyze-traffic` with `X-API-Key: ids-internal-key`.

5. **ML Prediction**: Backend forwards features to `http://localhost:5000/predict`. ML API scales features, runs RandomForest, returns prediction (0/1), probability, severity.

6. **Storage**: Backend inserts into Supabase: traffic_logs (always), attack_logs and blocked_ips (if attack).

7. **Dashboard**: React app fetches /api/* every 5 seconds and displays metrics and alerts.

---

## 5. ML Model Explanation

- **Algorithm**: RandomForestClassifier (scikit-learn)
- **Features**: Top 20 from CICIDS2017, selected by feature importance
- **Labels**: 0 = Normal, 1 = Attack
- **Preprocessing**: StandardScaler (fit on training data)
- **Output**: prediction (0/1), probability (attack class), severity (low/medium/high/critical)
- **Training**: Scripts in scripts/ (select_top20_features.py, train_top20_model.py). Dataset: Data/Processed Data/CICIDS2017_Processed.csv

---

## 6. Feature Selection Explanation

- **Process**: Train RandomForest on full CICIDS2017_Processed.csv, extract `feature_importances_`, sort descending, take top 20.
- **Single source of truth**: Data/top20_features.json
- **Regeneration**: Run `python scripts/regenerate_ml_pipeline.py` (does feature selection + dataset + training).
- **flow_extractor**: Loads Data/top20_features.json dynamically. Any feature not computable from PCAP is filled with 0.

## 6b. Model Training Pipeline

1. **Regenerate pipeline**: `python scripts/regenerate_ml_pipeline.py`
   - Phase 2: Feature selection → Data/top20_features.json
   - Phase 3: Create Data/Processed Data/CICIDS2017_top20.csv (rows x 21 cols)
   - Phase 4: Train RandomForest, save to ml-service/model/

2. **Artifacts saved**: model.pkl, scaler.pkl, top20_features.json (in ml-service/model/)

3. **To retrain**: Re-run regenerate_ml_pipeline.py. Restart ML API to load new model.

## 6c. Feature Mapping (PCAP → Dataset)

| Feature | flow_extractor computation |
|---------|---------------------------|
| Fwd Packet Length Max | max(fwd_lengths) |
| Average Packet Size | total_bytes / total_packets |
| Subflow Fwd Bytes | sum(fwd_lengths) |
| Fwd Packet Length Mean | mean(fwd_lengths) |
| Bwd Packets/s | len(bwd) / duration |
| Avg Fwd Segment Size | mean(fwd_lengths) |
| Packet Length Std | stdev(all lengths) |
| Total Length of Fwd Packets | sum(fwd_lengths) |
| Max Packet Length | max(all lengths) |
| Init_Win_bytes_forward | First fwd TCP packet window |
| PSH Flag Count | TCP PSH flag count |
| Bwd Packet Length Max | max(bwd_lengths) |
| Packet Length Mean | mean(all lengths) |
| Fwd Header Length.1 | Sum of TCP header lengths (fwd) |
| Avg Bwd Segment Size | mean(bwd_lengths) |
| Subflow Bwd Bytes | sum(bwd_lengths) |
| Bwd Packet Length Mean | mean(bwd_lengths) |
| Bwd Packet Length Std | stdev(bwd_lengths) |
| ACK Flag Count | TCP ACK flag count |
| Total Fwd Packets | len(fwd) |

---

## 7. API Endpoints

### Backend (port 3000)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /analyze-traffic | X-API-Key | Receives flow features, calls ML, stores in DB |
| GET | /api/metrics | None | Returns { totalTraffic, totalAttacks, detectionRate, blockedIpCount } |
| GET | /api/traffic?limit=N | None | Recent traffic_logs |
| GET | /api/attacks?limit=N | None | Recent attack_logs |
| GET | /api/blocked-ips | None | Blocked IP list |
| GET | /login | None | Redirects to dashboard (port 5173) |

### ML API (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /predict | Body: { flow: { feature: value, ... } }. Returns { prediction, is_attack, label, probability, severity } |
| GET | /health | Returns { status: "ok" } |

---

## 8. Database Schema (Supabase)

```sql
-- traffic_logs: all analyzed flows
CREATE TABLE traffic_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  src_ip TEXT NOT NULL,
  dest_ip TEXT NOT NULL,
  src_port INTEGER,
  dest_port INTEGER NOT NULL,
  protocol TEXT,
  is_attack BOOLEAN NOT NULL DEFAULT false,
  probability DOUBLE PRECISION,
  severity TEXT,
  label TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flow_features JSONB,
  ml_probability DOUBLE PRECISION,
  suspicion_score DOUBLE PRECISION,
  hybrid_score DOUBLE PRECISION,
  detection_source TEXT,
  ground_truth_label TEXT,
  traffic_source TEXT DEFAULT 'SYNTHETIC'
);

-- attack_logs: only attacks
CREATE TABLE attack_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traffic_log_id UUID REFERENCES traffic_logs(id) ON DELETE CASCADE,
  src_ip TEXT NOT NULL,
  dest_ip TEXT NOT NULL,
  dest_port INTEGER,
  severity TEXT,
  probability DOUBLE PRECISION,
  label TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- blocked_ips: firewall block list
CREATE TABLE blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  severity TEXT,
  reason TEXT,
  first_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT true
);
```

---

## 9. How Packet Capture Works

- **Tool**: tcpdump (Linux)
- **Default Filter**: `port 8000` — captures only victim app traffic. Set `TCPDUMP_FILTER=""` for all traffic.
- **Command**: `tcpdump -i any port 8000 -G 10 -w data/pcap/capture_%Y%m%d_%H%M%S.pcap`
- **Interface**: Set via `NETWORK_INTERFACE` (default: any). Use `lo` for localhost.
- **Rotation**: `-G 10` creates a new file every 10 seconds. Files are complete when rotation occurs.
- **Output Dir**: `data/pcap/` (or `PCAP_DIR` env).

---

## 10. Flow Extraction Process

1. flow_watcher polls data/pcap/ every second.
2. For each .pcap file, tracks (mtime, size). When size is stable for 3 seconds, marks as ready.
3. Runs: `python flow_extractor.py <pcap> <output_csv>`.
4. flow_extractor:
   - Reads PCAP with scapy
   - Groups by 5-tuple
   - Computes features (packet counts, bytes, IAT, flags, etc.)
   - Outputs CSV with top 20 columns + src_ip, dest_ip, src_port, dest_port, protocol
5. flow_watcher merges into flows.csv and POSTs each row to backend.

---

## 11. ML Prediction Process

1. Backend receives /analyze-traffic with `features` object (20 keys).
2. Backend POSTs `{ flow: features }` to ML API.
3. ML API: loads model, scaler, feature list; builds DataFrame in correct order; scales; predicts.
4. Returns: prediction (0/1), probability, severity (derived from probability).
5. Backend stores result in Supabase.

---

## 12. Dashboard Architecture

- **Framework**: React + Vite
- **Port**: 5173
- **Data**: Fetches from http://localhost:3000/api every 5 seconds
- **Components**: MetricsBar, TrafficChart, AttackTable, BlockedIPList, TrafficDistribution
- **Theme**: White background, dark text, red for attacks, yellow for warnings, green for normal

---

## 13. Startup Scripts Explanation

**run_all_services.sh**: Starts in order:
1. tcpdump (capture_service.sh)
2. flow_watcher.py
3. ML API (prediction_api.py)
4. Backend (node server.js)
5. Victim app (port 8000)
6. Frontend (npm run dev)

All logs go to logs/. PIDs stored in logs/*.pid.

**stop_all_services.sh**: Kills processes by PID files and by name (tcpdump, flow_watcher, prediction_api, vite).

---

## 14. Attack Simulation Explanation

**simulate_attack.py**: Generates CICIDS-style attack traffic patterns:
- **HTTP flood**: 100 requests × 10 threads, 0.01s delay (high Flow Packets/s, Bwd Packets/s)
- **Random payloads**: Variable request sizes (0–5000 bytes) affecting packet length features
- **Target**: http://localhost:8000 (must match tcpdump filter `port 8000`)

Traffic → tcpdump (port 8000) → flow_extractor → backend → ML prediction → dashboard. High-rate or anomalous flows may be classified as attacks.

---

## 15. Troubleshooting Guide

| Problem | Cause | Fix |
|---------|-------|-----|
| No PCAP files | tcpdump not running | Check logs/capture.log; run with NETWORK_INTERFACE=lo for localhost |
| flows.csv empty | No stable PCAPs / flow_watcher not running | Ensure PCAPs exist; check logs/flow_watcher.log |
| 502 on /analyze-traffic | ML API down | Start: `python ml-service/prediction_api.py` |
| Dashboard shows 0s | Supabase empty or backend down | Configure Supabase in ids-platform/.env; start backend |
| CORS errors | Backend not allowing origin | Backend uses cors(); ensure frontend URL is allowed |
| Port in use | Previous run left processes | `bash scripts/stop_all_services.sh` |

---

## 16. Ports and Services

| Port | Service |
|------|---------|
| 3000 | Backend API |
| 5000 | ML Prediction API |
| 5173 | Admin Dashboard |
| 8000 | Victim App |

---

## 17. How to Run the Full System

```bash
cd /path/to/ai-ids-pipeline
bash scripts/run_all_services.sh
```

Then open http://localhost:5173 for the dashboard.

To simulate attacks:

```bash
python scripts/simulate_attack.py
```

---

## 18. Common Debugging Steps

1. **Check logs**: `tail -f logs/capture.log logs/flow_watcher.log logs/ml_api.log logs/backend.log`
2. **Verify PCAPs**: `ls -la data/pcap/`
3. **Verify flows**: `head data/flows/flows.csv`
4. **Test ML API**: `curl -X POST http://localhost:5000/predict -H "Content-Type: application/json" -d '{"flow":{...}}'`
5. **Test backend**: `curl http://localhost:3000/api/metrics`
6. **Health check**: `python scripts/check_pipeline.py`

---

## 19. Security Considerations

- API key for /analyze-traffic: X-API-Key (default: ids-internal-key). Change via IDS_API_KEY.
- Dashboard APIs (/api/*) are unauthenticated. Restrict in production.
- Supabase keys must be kept secret. Use env vars.
- tcpdump may require root on some systems.

---

## 20. Future Improvements

- Add authentication to React dashboard
- Use WebSockets for real-time updates instead of polling
- Add rate limiting to /analyze-traffic
- Implement model retraining pipeline
- Add alerting (email, Slack) for critical attacks
