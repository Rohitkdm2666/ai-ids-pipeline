# AI Cybersecurity IDS Platform — Complete Project Documentation

**For Word Export:** Open this file in Word (File → Open → select this .md) or copy all content and paste into a new Word document, then save as .docx.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Terminal Issues & Fixes](#2-terminal-issues--fixes)
3. [Architecture Overview](#3-architecture-overview)
4. [Real Packet-Based Detection Pipeline](#4-real-packet-based-detection-pipeline)
5. [Packet Capture Service](#5-packet-capture-service)
6. [Flow Extraction Service (CICFlowMeter)](#6-flow-extraction-service-cicflowmeter)
7. [IDS Backend](#7-ids-backend)
8. [Victim App (Target)](#8-victim-app-target)
9. [Python ML API](#9-python-ml-api)
10. [Database Schema](#10-database-schema)
11. [Hybrid ML + Rule Detection](#11-hybrid-ml--rule-detection)
12. [78 CICIDS Features](#12-78-cicids-features)
13. [Dashboard & UI](#13-dashboard--ui)
14. [Logging](#14-logging)
15. [Configuration](#15-configuration)
16. [Setup & Run Instructions](#16-setup--run-instructions)
17. [Supabase Migration](#17-supabase-migration)

---

## 1. Executive Summary

This project implements a **Hybrid ML and Rule-Based Intrusion Detection & Prevention System** with:

- **Real packet capture** via tcpdump/dumpcap
- **CICFlowMeter** for flow feature extraction from pcap files
- **78-feature CICIDS2017** compatibility with trained Random Forest model
- **Hybrid detection** (weighted fusion of ML probability and rule-based suspicion)
- **Supabase (PostgreSQL)** for traffic, attack, and blocked-IP logs
- **Admin dashboard** with traffic source indicators (SYNTHETIC vs REAL_PCAP)

**Architecture transition:**
- **Old:** Victim App → synthetic features → ML → Supabase → Dashboard
- **New:** Real Packets → Packet Capture → pcap → CICFlowMeter → 78 features → ML → Supabase → Dashboard

---

## 2. Terminal Issues & Fixes

### 2.1. IDS Platform (Terminal 2) Errors

**Error:** `Could not find the 'detection_source' column of 'traffic_logs' in the schema cache`

**Cause:** Supabase schema missing new columns (`ml_probability`, `suspicion_score`, `hybrid_score`, `detection_source`, `ground_truth_label`, `traffic_source`).

**Fix:** Run the migration in Supabase SQL Editor:

```
File: ids-platform/supabase_migration_add_columns.sql
```

Open Supabase Dashboard → SQL Editor → paste and run the migration.

---

**Error:** `ConnectTimeoutError` to Supabase (addresses 104.18.38.10, 172.64.149.246)

**Cause:** Network/firewall blocking Supabase (Cloudflare IPs). Common on corporate networks.

**Fix:**
- Check proxy/VPN settings
- Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct in `.env`
- Try from a different network

---

### 2.2. Victim App (Terminal 4) — IDS Request Timeout

**Cause:** IDS backend was failing (DB errors), causing long response times and timeouts.

**Fix:** Once Supabase schema is updated and connectivity is restored, IDS responds normally. Victim app no longer sends traffic to IDS (synthetic path removed); traffic now comes from flow-extraction-service only.

---

### 2.3. Python ML API (Terminal 1)

**Status:** Working. `[Parallel(n_jobs=8)]` messages are normal sklearn logging. HTTP 200 for `/predict` indicates healthy operation.

---

### 2.4. Attack Simulation Script Path

**Error:** `cd victim-app` when already in victim-app directory.

**Fix:** Run from project root:
```powershell
cd "D:\D Drive Backup\sem 4\EDI\ML model - Copy\victim-app"
node scripts/simulate_attack.js
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     REAL PACKET-BASED IDS ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Network Interface (eth0)                                                       │
│         │                                                                       │
│         ▼                                                                       │
│  ┌──────────────────────┐                                                      │
│  │ packet-capture-service│  tcpdump / dumpcap → rotating .pcap files            │
│  └──────────┬───────────┘                                                      │
│             │                                                                   │
│             ▼                                                                   │
│  ┌──────────────────────┐                                                      │
│  │ flow-extraction-service│  CICFlowMeter → CSV → 78 features                   │
│  └──────────┬───────────┘                                                      │
│             │                                                                   │
│             │ POST /analyze-traffic (traffic_source: REAL_PCAP)                 │
│             ▼                                                                   │
│  ┌──────────────────────┐     ┌─────────────────────┐                          │
│  │ ids-platform (Node)   │────▶│ Python ML API       │                          │
│  │ - Hybrid fusion       │     │ - Random Forest     │                          │
│  │ - Defense logic       │     │ - 78 features       │                          │
│  └──────────┬───────────┘     └─────────────────────┘                          │
│             │                                                                   │
│             ▼                                                                   │
│  ┌──────────────────────┐                                                      │
│  │ Supabase (PostgreSQL) │  traffic_logs, attack_logs, blocked_ips              │
│  └──────────┬───────────┘                                                      │
│             │                                                                   │
│             ▼                                                                   │
│  ┌──────────────────────┐                                                      │
│  │ Admin Dashboard (EJS)  │  KPIs, charts, traffic source indicator             │
│  └──────────────────────┘                                                      │
│                                                                                 │
│  Victim App (port 4000): Pure target — no IDS integration.                     │
│  Packets to victim app are captured and processed by the pipeline above.       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Real Packet-Based Detection Pipeline

1. **Packet Capture** — packet-capture-service captures packets from `NETWORK_INTERFACE` into rotating `.pcap` files.
2. **File Watch** — flow-extraction-service watches the pcap directory for new files.
3. **Flow Extraction** — CICFlowMeter (Python or Java) converts pcap to CSV with flow features.
4. **CSV Parsing** — Each row is parsed; columns are mapped to the 78 CICIDS feature names.
5. **IDS POST** — Each flow is sent to `POST /analyze-traffic` with `metadata.traffic_source = 'REAL_PCAP'`.
6. **ML Prediction** — IDS calls Python `/predict`; hybrid score is computed.
7. **Database** — Traffic, attacks, and blocked IPs are stored in Supabase.
8. **Dashboard** — Displays traffic with REAL_PCAP / SYNTHETIC source badge.
9. **Cleanup** — Optional: delete pcap after processing (`DELETE_PCAP_AFTER_PROCESS=true`).

---

## 5. Packet Capture Service

**Location:** `packet-capture-service/`

**Purpose:** Capture network packets into rotating `.pcap` files.

**Behavior:**
- Uses `tcpdump` (Linux/macOS) or `dumpcap` (Windows with Npcap/Wireshark)
- Writes to `PCAP_DIR` (default: `./pcap`)
- Rotates files by size and count (`-C 5`, `-W 5` for tcpdump)
- Logs: `[PACKET_CAPTURE_STARTED]`, `[PCAP_ROTATED]`

**Env:**
- `NETWORK_INTERFACE` — e.g. `eth0` (Linux), `1` (dumpcap Windows)
- `PCAP_DIR` — output directory
- `PCAP_ROTATE_INTERVAL_MS` — optional interval-based rotate

**Run:**
```bash
cd packet-capture-service
npm install
node index.js
```

**Note:** Requires root/admin on Linux for raw capture; tcpdump or Npcap on Windows.

---

## 6. Flow Extraction Service (CICFlowMeter)

**Location:** `flow-extraction-service/`

**Purpose:** Process pcap files with CICFlowMeter, parse CSV, send flows to IDS.

**Dependencies:** `cicflowmeter` (Python) — `pip install cicflowmeter`

**Behavior:**
- Watches `PCAP_DIR` for new `.pcap` files
- Runs: `cicflowmeter -f file.pcap -c output.csv`
- Parses CSV; maps columns to 78 CICIDS feature names
- POSTs each flow to `IDS_BACKEND_URL/analyze-traffic`
- Logs: `[FLOW_EXTRACTION_COMPLETE]`, `[FLOW_SENT_TO_IDS]`

**Env:**
- `PCAP_DIR` — usually `../packet-capture-service/pcap`
- `IDS_BACKEND_URL`, `IDS_API_KEY`
- `BATCH_DELAY_MS` — delay between flows (default 50ms)
- `DELETE_PCAP_AFTER_PROCESS` — set `true` to delete after processing

**Run:**
```bash
cd flow-extraction-service
npm install
pip install cicflowmeter
node index.js
```

**Column Mapping:** Feature names from CICFlowMeter CSV are matched (case-insensitive, with aliases) to the 78 CICIDS2017 columns. Missing columns default to 0.

---

## 7. IDS Backend

**Location:** `ids-platform/`

**Main Flow:**
1. Validate payload (`src_ip`, `dest_ip`, `dest_port`, `features`)
2. Defense pre-check — if IP in `blocked_ips` → 403
3. Call Python ML API `predictFlow(features)`
4. Log `[ML_PREDICTION_COMPLETE]`
5. Hybrid fusion: `hybrid_score = w_ml * ml_prob + w_rule * (suspicion/100)`
6. If `hybrid_score >= threshold` → attack
7. Store in `traffic_logs` (with `traffic_source`)
8. If attack → `attack_logs`, `blocked_ips`
9. Return JSON

**Traffic Source:** From `metadata.traffic_source` — `REAL_PCAP` (flow extractor) or `SYNTHETIC` (legacy).

**Hybrid Weights (env):**
- `HYBRID_ML_WEIGHT=0.7`
- `HYBRID_RULE_WEIGHT=0.3`
- `HYBRID_ATTACK_THRESHOLD=0.6`

---

## 8. Victim App (Target)

**Location:** `victim-app/`

**Purpose:** Simulated banking website used as attack target. Serves pages (login, search, contact, profile, file upload).

**Change:** Synthetic feature generation and IDS monitoring middleware have been **removed**. The app is a pure HTTP target. Traffic to it is captured by packet-capture-service and processed by the flow extraction pipeline.

**Run:**
```bash
cd victim-app
npm install
npm start
```

Port: 4000 (default).

---

## 9. Python ML API

**Location:** `app/api/prediction_api.py`

**Endpoints:**
- `GET /health` — health check
- `POST /predict` — expects `{ "flow": { "<feature_name>": <number>, ... } }`

**Behavior:**
- Loads `ids_random_forest_model.pkl`, `scaler.pkl`
- Feature columns from `CICIDS2017_Processed.csv` (78 columns)
- Reorders input to training column order
- Scales with `StandardScaler`
- Predicts with `RandomForestClassifier`
- Returns: `prediction`, `is_attack`, `label`, `probability`, `severity`

**Run:**
```bash
cd app/api
python prediction_api.py
```

Port: 5000.

---

## 10. Database Schema

**Tables:**

**traffic_logs:**
- `id`, `src_ip`, `dest_ip`, `src_port`, `dest_port`, `protocol`
- `is_attack`, `probability`, `severity`, `label`
- `analyzed_at`, `flow_features` (jsonb)
- `ml_probability`, `suspicion_score`, `hybrid_score`, `detection_source`, `ground_truth_label`
- `traffic_source` — `'SYNTHETIC'` or `'REAL_PCAP'`

**attack_logs:** `id`, `traffic_log_id`, `src_ip`, `dest_ip`, `dest_port`, `severity`, `probability`, `label`, `detected_at`

**blocked_ips:** `id`, `ip_address`, `severity`, `reason`, `first_blocked_at`, `last_seen_at`, `is_blocked`

---

## 11. Hybrid ML + Rule Detection

- **ML channel:** Probability from Random Forest (0–1)
- **Rule channel:** Suspicion score from content inspection (0–100), normalized to 0–1
- **Fusion:** `hybrid_score = 0.7 * ml_prob + 0.3 * rule_norm`
- **Decision:** `is_attack = hybrid_score >= 0.6`
- **detection_source:** `ML`, `RULE`, `HYBRID`, or `RULE_WARNING`

For REAL_PCAP flows, suspicion is 0 (no HTTP content); hybrid score equals ML probability scaled by weight.

---

## 12. 78 CICIDS Features

(Exact names from `CICIDS2017_Processed.csv`)

Destination Port, Flow Duration, Total Fwd Packets, Total Backward Packets, Total Length of Fwd Packets, Total Length of Bwd Packets, Fwd Packet Length Max, Fwd Packet Length Min, Fwd Packet Length Mean, Fwd Packet Length Std, Bwd Packet Length Max, Bwd Packet Length Min, Bwd Packet Length Mean, Bwd Packet Length Std, Flow Bytes/s, Flow Packets/s, Flow IAT Mean, Flow IAT Std, Flow IAT Max, Flow IAT Min, Fwd IAT Total, Fwd IAT Mean, Fwd IAT Std, Fwd IAT Max, Fwd IAT Min, Bwd IAT Total, Bwd IAT Mean, Bwd IAT Std, Bwd IAT Max, Bwd IAT Min, Fwd PSH Flags, Bwd PSH Flags, Fwd URG Flags, Bwd URG Flags, Fwd Header Length, Bwd Header Length, Fwd Packets/s, Bwd Packets/s, Min Packet Length, Max Packet Length, Packet Length Mean, Packet Length Std, Packet Length Variance, FIN Flag Count, SYN Flag Count, RST Flag Count, PSH Flag Count, ACK Flag Count, URG Flag Count, CWE Flag Count, ECE Flag Count, Down/Up Ratio, Average Packet Size, Avg Fwd Segment Size, Avg Bwd Segment Size, Fwd Header Length.1, Fwd Avg Bytes/Bulk, Fwd Avg Packets/Bulk, Fwd Avg Bulk Rate, Bwd Avg Bytes/Bulk, Bwd Avg Packets/Bulk, Bwd Avg Bulk Rate, Subflow Fwd Packets, Subflow Fwd Bytes, Subflow Bwd Packets, Subflow Bwd Bytes, Init_Win_bytes_forward, Init_Win_bytes_backward, act_data_pkt_fwd, min_seg_size_forward, Active Mean, Active Std, Active Max, Active Min, Idle Mean, Idle Std, Idle Max, Idle Min

---

## 13. Dashboard & UI

**Pages:**
- **Dashboard** — KPIs (traffic, attacks, detection rate, blocked IPs), traffic source (REAL_PCAP / SYNTHETIC counts), chart, recent attacks, blocked IPs
- **Live Traffic** — Table with Time, Src IP, Dest IP, Dest Port, Protocol, **Source** (badge), Attack, Severity, Probability
- **Attack Logs** — Detected attacks
- **Blocked IPs** — Block list

**Traffic Source Badges:**
- `REAL_PCAP` — from packet capture + CICFlowMeter
- `SYNTHETIC` — legacy (if any)

---

## 14. Logging

**Packet Capture:**
- `[PACKET_CAPTURE_STARTED]`
- `[PCAP_ROTATED]`

**Flow Extraction:**
- `[FLOW_EXTRACTION_START]`
- `[FLOW_EXTRACTION_COMPLETE]`
- `[FLOW_SENT_TO_IDS]`

**IDS:**
- `[ML_PREDICTION_COMPLETE]`
- `[PREDICTION_FAILURE]`
- `[DB_ERROR_*]`, `[ANALYZE_TRAFFIC_FAILURE]`

---

## 15. Configuration

**Environment files:**
- `ids-platform/.env` — PORT, Supabase, HYBRID_*, IDS_API_KEY
- `victim-app/.env` — PORT, SERVER_IP
- `packet-capture-service/.env` — NETWORK_INTERFACE, PCAP_DIR
- `flow-extraction-service/.env` — PCAP_DIR, IDS_BACKEND_URL, IDS_API_KEY

---

## 16. Setup & Run Instructions

1. **Supabase:** Create project, run `supabase_migration_add_columns.sql`
2. **Python ML:** `cd app/api && python prediction_api.py`
3. **IDS Platform:** `cd ids-platform && npm install && npm start`
4. **Victim App:** `cd victim-app && npm install && npm start`
5. **Packet Capture:** `cd packet-capture-service && npm install && node index.js` (requires tcpdump/Npcap)
6. **Flow Extractor:** `pip install cicflowmeter`, `cd flow-extraction-service && npm install && node index.js`

**Order:** Start Python API and IDS first. Then victim app (target). Then packet capture and flow extractor.

---

## 17. Supabase Migration

Run in Supabase SQL Editor:

```sql
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS ml_probability double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS suspicion_score double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS hybrid_score double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS detection_source text;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS ground_truth_label text;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS traffic_source text;
```

---

*End of documentation. Save as Word (.docx) for submission or reporting.*
