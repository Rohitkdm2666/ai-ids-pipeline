# Phase 1 — Full System Analysis

## Component Inventory

| Component | Location | Technology | Purpose |
|-----------|----------|------------|---------|
| Packet Capture | packet-capture-service/capture_service.sh | tcpdump (bash) | Writes rotating PCAP to data/pcap/ |
| Flow Extraction | flow-extraction-service/flow_watcher.py, flow_extractor.py | Python, scapy | Watches PCAP, extracts top-20 features, outputs flows.csv |
| ML Service | ml-service/prediction_api.py | Flask (Python) | POST /predict on port 5000 |
| Backend | ids-platform/ (backend symlink) | Node.js, Express | Port 3000, /analyze-traffic, /api/* |
| Database | Supabase | PostgreSQL (hosted) | traffic_logs, attack_logs, blocked_ips |
| **Frontend 1** | ids-platform/views/ | EJS templates | Server-rendered dashboard (/, /live-traffic, /attack-logs, /blocked-ips) |
| **Frontend 2** | frontend/admin-dashboard/ | React + Vite | SPA on port 5173, fetches /api/* |
| Victim App | victim-app/ | Node.js, Express | Port 8080, target for simulate_attack |

## Two Dashboards Identified

1. **EJS Dashboard (ids-platform)**
   - Routes: dashboardRoutes (requireAuth): /, /live-traffic, /attack-logs, /blocked-ips
   - Uses: views/dashboard.ejs, live-traffic.ejs, attack-logs.ejs, blocked-ips.ejs, login.ejs
   - Theme: Dark (bg-dark, Bootstrap)
   - Auth: Session-based, login required

2. **React Dashboard (frontend/admin-dashboard)**
   - Standalone SPA on port 5173
   - Fetches: GET /api/metrics, /api/attacks, /api/traffic, /api/blocked-ips
   - Auth: None (API is public)
   - Theme: Basic CSS

## Dependencies

```
React Dashboard → GET /api/* → apiDashboardRoutes → databaseService → Supabase
EJS Dashboard  → GET /, /live-traffic, etc. → dashboardRoutes → dashboardController → databaseService → Supabase
flow_watcher   → POST /analyze-traffic → trafficRoutes → trafficController → predictionService (ML API) → databaseService → Supabase
```

## Conclusion

- **Preferred dashboard**: React (frontend/admin-dashboard)
- **EJS views can be archived**: apiDashboardRoutes provides same data as JSON; React consumes it
- **Backend routes to retain**: apiDashboardRoutes, trafficRoutes, authRoutes (login for evaluation/simulation - optional)
- **Backend routes to remove from main flow**: dashboardRoutes (EJS pages)
