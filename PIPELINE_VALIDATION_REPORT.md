# IDS Pipeline Validation Report

## Pipeline Flow

```
Victim Web App (localhost:8000)
    → tcpdump Packet Capture (port 8000 only)
    → PCAP files (data/pcap/)
    → Flow Extraction (flow_extractor.py)
    → Top-20 Feature Vector
    → ML Prediction API (port 5000)
    → Backend (port 3000)
    → Database (Supabase)
    → Admin Dashboard (port 5173)
```

---

## 1. Packet Capture Verification

**File:** `packet-capture-service/capture_service.sh`

- **Filter:** `tcp port 8000` — captures only victim app traffic
- **Override:** Set `TCPDUMP_FILTER=""` to capture all traffic
- **Rotation:** Every 10 seconds (`-G 10`)
- **Output:** `data/pcap/capture_YYYYMMDD_HHMMSS.pcap`

**Logs:**
- `[PACKET_CAPTURE_STARTED]` — on startup
- `[PCAP_FILE_CREATED]` — when a new PCAP file is written

**Note:** Packet capture requires root. Run `bash scripts/run_all_services.sh` in a terminal and enter the sudo password when prompted for the capture step.

---

## 2. Flow Extraction Verification

**File:** `flow-extraction-service/flow_extractor.py`

- **Feature source:** Loads `Data/top20_features.json` dynamically
- **Output:** CSV with `src_ip`, `dest_ip`, `src_port`, `dest_port`, `protocol` + 20 features

**Logs:**
- `[FEATURE_EXTRACTION_VALIDATED] missing_features=0` — confirms all top-20 features present
- `[PACKET_SOURCE] src_ip=... dest_ip=... dest_port=...` — packet origin (dest_port 8000 = victim app)

**Top 20 Features (CICIDS2017):**
- Fwd Packet Length Max, Average Packet Size, Subflow Fwd Bytes, Fwd Packet Length Mean
- Bwd Packets/s, Avg Fwd Segment Size, Packet Length Std, Total Length of Fwd Packets
- Max Packet Length, Init_Win_bytes_forward, PSH Flag Count, Bwd Packet Length Max
- Packet Length Mean, Fwd Header Length.1, Avg Bwd Segment Size, Subflow Bwd Bytes
- Bwd Packet Length Mean, Bwd Packet Length Std, ACK Flag Count, Total Fwd Packets

---

## 3. Feature Schema Validation

| Component            | Feature Source                     | Status  |
|---------------------|-------------------------------------|---------|
| Flow Extractor      | `Data/top20_features.json`         | ✓       |
| ML Model            | `ml-service/model/top20_features.json` | ✓   |
| Prediction API      | `ml-service/model/top20_features.json` | ✓   |

All components use the same 20-feature schema. Extra keys in requests are ignored.

---

## 4. ML Model Retraining

**Script:** `scripts/retrain_top20_model.py`

**Steps:**
1. Load `Data/Processed Data/CICIDS2017_Processed.csv`
2. Load `Data/top20_features.json`
3. Extract top-20 columns + Label
4. 80/20 stratified train/test split
5. StandardScaler fit on train
6. RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)

**Output:** `ml-service/model/model.pkl`, `scaler.pkl`, `top20_features.json`

**Last Run Metrics:**
- Accuracy: 0.9990
- Precision: 0.9990
- Recall: 0.9980
- F1 Score: 0.9985

---

## 5. Attack Simulation

**Script:** `scripts/simulate_attack.py`

**Phases:**
1. **HTTP flood:** 200 threads × 20 requests (4000 requests), minimal delay
2. **Large payload bursts:** POST to `/api/comment` with variable payload sizes (0–20KB)

**Target:** `http://localhost:8000`

**Logs:**
- `[ATTACK_SIMULATION_STARTED]`
- `[REQUESTS_SENT]` per phase

---

## 6. Hybrid Detection Layer

**File:** `backend/controllers/trafficController.js`

**Rules (env-overridable):**
- `Total Fwd Packets > 80` → attack
- `Bwd Packets/s > 50` → attack
- `ML probability > 0.6` → attack

**Final:** `is_attack = ML_prediction OR rule_detection`

**Log:** `[HYBRID_DETECTION_TRIGGERED]` when rule fires

---

## 7. Victim App

**File:** `victim-app/server.js`

- **Port:** 8000 (overridden by `PORT=8000` in run script)
- **Bind:** `0.0.0.0` for accessibility
- **URL:** http://localhost:8000

---

## 8. Log Markers

| Log                         | Location         |
|-----------------------------|------------------|
| [PACKET_CAPTURE_STARTED]    | logs/capture.log |
| [PCAP_FILE_CREATED]         | logs/capture.log |
| [FLOW_EXTRACTION_COMPLETE]  | logs/flow_watcher.log |
| [FEATURE_EXTRACTION_VALIDATED] | flow_extractor stdout |
| [PACKET_SOURCE]             | flow_extractor stdout |
| [FLOW_SENT_TO_BACKEND]      | logs/flow_watcher.log |
| [ML_REQUEST_SENT]           | logs/backend.log |
| [ML_RESPONSE_RECEIVED]      | logs/backend.log |
| [ML_API_REQUEST]            | logs/ml_api.log |
| [ML_PREDICTION_OUTPUT]      | logs/ml_api.log |
| [HYBRID_DETECTION_TRIGGERED]| logs/backend.log |
| [DB_TRAFFIC_INSERT_SUCCESS] | logs/backend.log |

---

## 9. How to Retrain the Model

```bash
# Activate venv
source venv/bin/activate

# Option A: Retrain using existing top20 features
python scripts/retrain_top20_model.py

# Option B: Regenerate features + dataset + train (full pipeline)
python scripts/regenerate_ml_pipeline.py
```

---

## 10. Full Pipeline Test

```bash
# 1. Start all services (enter sudo password when prompted for capture)
bash scripts/run_all_services.sh

# 2. Generate attack traffic
python scripts/simulate_attack.py

# 3. Check dashboard
# http://localhost:5173 — traffic and alerts
```

---

*Report generated as part of IDS pipeline stabilization.*
