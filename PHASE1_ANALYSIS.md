# Phase 1 — Project Analysis & Dependency Map

## Service Map

| Service | Location | Tech | Status | Notes |
|---------|----------|------|--------|-------|
| Packet Capture | packet-capture-service/index.js | Node + tcpdump | ACTIVE | Uses tcpdump/dumpcap; outputs to ./pcap |
| Flow Extraction | flow-extraction-service/ | Node + CICFlowMeter | **OBSOLETE** | Uses 78 features, CICFlowMeter; should use flow_extractor.py (20 features) |
| Flow Extractor (Python) | flow-extraction-service/flow_extractor.py | Python + scapy | ACTIVE | CLI: input.pcap output.csv; top 20 features |
| ML Prediction API | app/api/prediction_api.py | Flask | ACTIVE | Port 5000, top 20 features |
| Backend API | ids-platform/server.js | Express | ACTIVE | Port 3000, /analyze-traffic |
| Admin Dashboard | ids-platform/views/ | EJS | ACTIVE | Server-rendered, NOT React |
| Victim App | victim-app/server.js | Express | ACTIVE | Port 8000 (user wants 8080 for simulate) |

## File Classification

### ACTIVE (used in pipeline)
- app/api/prediction_api.py
- flow-extraction-service/flow_extractor.py
- ids-platform/server.js, routes/, controllers/, services/
- packet-capture-service/index.js
- Data/top20_features.json
- Trained Models/Models/*.pkl

### OBSOLETE / EXPERIMENTAL
- flow-extraction-service/index.js (uses CICFlowMeter 78-feature, not flow_extractor)
- flow-extraction-service/config/feature_columns.js (78 features)
- flow-extraction-service/scripts/cicflowmeter_patched.py
- flow-extraction-service/scripts/run_cicflowmeter_win.py
- app/ids_prediction_system.py (standalone test)
- full_test.py (simple test script)
- Trained Models/train_and_evaluate_RF.py, Training_RF_model.py, train_xgboost.py (legacy paths)

### DUPLICATE
- ids-platform/routes/trafficRoutes.js and traffic.js (both define /analyze-traffic)

### BROKEN / INCONSISTENT
- flow-extraction-service expects 78 features; model uses 20
- packet-capture-service writes to ./pcap, not data/pcap
- victim-app default port 8000 vs user spec 8080
- No React dashboard on 5173
- No tcpdump capture_service.sh (user wants tcpdump script)

## Dependency Flow (Current)

```
packet-capture-service (Node) → pcap/
flow-extraction-service (Node + CICFlowMeter) → csv_output/ → POST /analyze-traffic
                                                                    ↓
ids-platform (Express) → predictionService → ML API (5000) → Supabase
                                                                    ↓
                                            EJS Dashboard (served by ids-platform)
```

## Target Pipeline (User Spec)

```
tcpdump → data/pcap/
flow_extractor.py (daemon) → data/flows/flows.csv → ML API (5000) → Backend (3000) → React Dashboard (5173)
```

## Data Folders

- Data/Processed Data/ - CICIDS2017 CSVs (training)
- Data/top20_features.json - feature schema
- Trained Models/Models/ - model, scaler, top20_features.pkl
- packet-capture-service/pcap/ - current PCAP output
- flow-extraction-service/csv_output/ - CICFlowMeter output
- flows.csv, output.csv - ad-hoc outputs in project root
