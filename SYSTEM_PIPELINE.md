# IDS System Pipeline Documentation

## 1. Architecture Diagram

```
                    Network Traffic
                          │
                          ▼
              ┌───────────────────────┐
              │   tcpdump (capture)   │
              │   capture_service.sh  │
              └───────────┬───────────┘
                          │
                          ▼
                   data/pcap/*.pcap
                          │
                          ▼
              ┌───────────────────────┐
              │  flow_watcher.py      │
              │  flow_extractor.py    │
              └───────────┬───────────┘
                          │
                          ▼
              data/flows/flows.csv (top 20 features)
                          │
                          ▼
              ┌───────────────────────┐
              │  Backend (3000)       │◄──── POST /analyze-traffic
              │  ids-platform         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  ML API (5000)        │
              │  POST /predict        │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Supabase DB          │
              │  traffic_logs, etc.   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Admin Dashboard      │
              │  React (5173)         │
              └───────────────────────┘
```

## 2. Service Responsibilities

| Service | Port | Responsibility |
|---------|------|----------------|
| **Packet Capture** | - | tcpdump writes rotating PCAP files to data/pcap/ |
| **Flow Extractor** | - | Watches data/pcap/, runs flow_extractor.py, outputs flows.csv, POSTs to backend |
| **ML API** | 5000 | Flask, POST /predict, returns prediction, probability, severity |
| **Backend** | 3000 | Express, receives /analyze-traffic, calls ML API, stores in Supabase |
| **Victim App** | 8000 | Target for simulate_attack.py |
| **Frontend** | 5173 | React dashboard, fetches /api/* from backend |

## 3. Data Flow

1. **Capture**: tcpdump writes capture_YYYYMMDD_HHMMSS.pcap every 10 seconds.
2. **Extract**: flow_watcher detects stable PCAP files (size unchanged for 3s), runs flow_extractor.py.
3. **Features**: flow_extractor outputs top 20 features (from Data/top20_features.json) plus src_ip, dest_ip, etc.
4. **Send**: For each flow, flow_watcher POSTs to backend /analyze-traffic with features.
5. **Predict**: Backend calls ML API /predict, gets prediction.
6. **Store**: Backend stores in Supabase traffic_logs, attack_logs, blocked_ips.
7. **Display**: React dashboard polls /api/metrics, /api/attacks, /api/traffic.

## 4. How to Start System

```bash
cd /path/to/ai-ids-pipeline
bash scripts/run_all_services.sh
```

This starts:
1. tcpdump → data/pcap/
2. flow_watcher.py
3. ML API (5000)
4. Backend (3000)
5. Victim app (8000)
6. Frontend (5173)

Logs go to `logs/`.

## 5. How to Simulate Attacks

```bash
# Ensure victim app and capture are running
python scripts/simulate_attack.py
```

This sends HTTP requests to http://localhost:8000. Traffic is captured, flows extracted, sent to backend, and alerts appear on the dashboard.

## 6. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No PCAP files | tcpdump not running / no traffic | Check logs/capture.log; ensure NETWORK_INTERFACE is correct (try `lo` for localhost) |
| flows.csv empty | flow_watcher not processing | Check logs/flow_watcher.log; PCAP files must be stable (3s no change) |
| 502 on /analyze-traffic | ML API down | Start ml-service: `python ml-service/prediction_api.py` |
| Dashboard shows 0s | Supabase empty / backend down | Configure Supabase in backend/.env; ensure backend running |
| simulate_attack no alerts | Victim app not running | Start victim app: `cd victim-app && PORT=8000 node server.js` |

## 7. Stop All Services

```bash
bash scripts/stop_all_services.sh
```

## 8. Health Check

```bash
python scripts/check_pipeline.py
```
