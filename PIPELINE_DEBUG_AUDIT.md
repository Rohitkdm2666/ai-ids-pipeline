# REAL_PCAP IDS Pipeline Debug Audit

## Summary of Instrumentation

Full end-to-end instrumentation added across all services to identify the exact breaking point.

---

## Step 1 — Packet Capture Service

**Logs added:**
- `[PACKET_CAPTURE_ENV]` — Startup: interface, absolute PCAP_DIR, rotate interval
- `[PACKET_CAPTURE_STARTED]` — Includes `pcapDirAbsolute`, `expectedExtension`
- `[PCAP_DETECTED]` — Every 30s: lists .pcap files in directory
- `[PCAP_ROTATION_COMPLETE]` — When rotation interval ticks (tcpdump only; dumpcap rotates by size)
- `[PCAP_DIR_CREATED]` — When pcap directory is created

**Path fix:** `PCAP_DIR` now resolves to absolute path using `__dirname` when env value is relative, so it works regardless of `process.cwd()`.

---

## Step 2 — Flow Extraction Service

**Logs added:**
- `[FLOW_EXTRACTOR_STARTED]` — `pcapDirAbsolute`, `idsBackend`, `expectedExtension`, `debugMode`
- `[WATCHER_FILE_ADDED]` — Every file seen by chokidar (path, extension)
- `[PCAP_DETECTED]` — When .pcap file triggers processing
- `[CICFLOWMETER_COMMAND]` — Exact cmd + args, pcapPath, csvPath
- `[CICFLOWMETER_STDOUT]` / `[CICFLOWMETER_STDERR]` — Output from cicflowmeter
- `[CICFLOWMETER_ERROR]` — Exit code, stderr on failure; CSV not created
- `[CICFLOWMETER_CSV_CREATED]` — CSV path when created
- `[CSV_PARSED_ROWS]` — flowsParsed, headerMatches78, missingInCsv (if any)
- `[FLOW_SENT_TO_IDS]` — endpoint, src_ip, dest_ip, featureCount
- `[IDS_RESPONSE]` — status, dataKeys on success
- `[IDS_POST_ERROR]` — message, code, status, responseData, stack on failure

**Path fix:** `PCAP_DIR` resolved to absolute path via `path.resolve(__dirname, rawPcapDir)` so it matches packet-capture output regardless of cwd.

**Watcher fix:** `ignoreInitial: false` — processes existing .pcap files at startup (previously only new files).

---

## Step 3 — IDS Backend

**Logs added:**
- `[ANALYZE_TRAFFIC_REQUEST_RECEIVED]` — traffic_source, hasFeatures, featureCount
- `[ML_REQUEST_SENT]` — When calling Python API
- `[ML_RESPONSE_RECEIVED]` — prediction result
- `[DB_TRAFFIC_INSERT_SUCCESS]` — id, traffic_source
- `[DB_ATTACK_INSERT_SUCCESS]` — id (when attack)
- `[DB_TRAFFIC_INSERT_ERROR]` / `[DB_ATTACK_INSERT_ERROR]` — Supabase error details

**Startup:**
- `[IDS_STARTUP_ENV]` — PORT, SUPABASE_URL (masked), PYTHON_API_URL, IDS_API_KEY_SET
- `[DB_CONNECTION_TEST]` — Tests traffic_logs + schema columns (traffic_source, detection_source, etc.)

**Bug fixed:** `insertAttackLog` was passing undefined `probability`; now passes `mlProbability`.

---

## Step 4 — Python ML API

**Logs added:**
- `[ML_API_REQUEST]` — features_received count
- `[FEATURE_VALIDATION_ERROR]` — missing_columns when validation fails
- `[ML_API_REQUEST]` — dataframe_shape before scaling
- `[ML_PREDICTION_OUTPUT]` — prediction, probability, is_attack
- `[ML_API_ERROR]` — Full traceback on exception

---

## Step 5 — ENV Verification

| Service | Key vars | Notes |
|---------|----------|-------|
| packet-capture-service | NETWORK_INTERFACE, PCAP_DIR | PCAP_DIR=./pcap → resolved from __dirname |
| flow-extraction-service | PCAP_DIR, IDS_BACKEND_URL, IDS_API_KEY | Must match ids-platform IDS_API_KEY |
| ids-platform | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PYTHON_API_URL, IDS_API_KEY | |
| app/api (Python) | None | Runs on 5000, no .env |

**Port alignment:**
- Packet capture: N/A (writes to disk)
- Flow extraction: POST to IDS_BACKEND_URL (default 3000)
- IDS platform: PORT (default 3000)
- Python ML API: 5000
- PYTHON_API_URL in ids-platform: http://localhost:5000/predict

---

## Step 6 — Supabase Schema

Migration: `ids-platform/supabase_migration_add_columns.sql`

Required columns in `traffic_logs`:
- `traffic_source`
- `detection_source`
- `ml_probability`
- `suspicion_score`
- `hybrid_score`

**Action:** Run the migration in Supabase SQL Editor if not yet applied.  
IDS startup `[DB_CONNECTION_TEST]` will fail if columns are missing.

---

## Step 7 — DEBUG_MODE

Set `DEBUG_MODE=true` in flow-extraction-service `.env` for verbose flow journey logging (sampleFeatures in FLOW_SENT_TO_IDS).

---

## How to Run the Audit

1. **Start services in order:**
   ```bash
   # Terminal 1: Packet capture
   cd packet-capture-service && node index.js

   # Terminal 2: Python ML API
   cd app/api && python prediction_api.py

   # Terminal 3: IDS platform
   cd ids-platform && npm start

   # Terminal 4: Flow extraction (last)
   cd flow-extraction-service && node index.js
   ```

2. **Check logs for breaking point:**
   - No `[WATCHER_FILE_ADDED]` or `[PCAP_DETECTED]` → Path mismatch or no pcap files
   - `[CICFLOWMETER_ERROR]` → cicflowmeter not installed or failing
   - `[CSV_PARSED_ROWS]` with missingInCsv or 0 flows → CSV header mismatch
   - `[IDS_POST_ERROR]` → IDS not reachable or API key mismatch
   - No `[ANALYZE_TRAFFIC_REQUEST_RECEIVED]` → Request not reaching IDS
   - `[DB_TRAFFIC_INSERT_ERROR]` → Supabase schema or permissions
   - `[FEATURE_VALIDATION_ERROR]` in Python → Column name mismatch with CICFlowMeter output

3. **Verify PCAP_DIR alignment:**
   Compare `[PACKET_CAPTURE_STARTED] pcapDirAbsolute` with `[FLOW_EXTRACTOR_STARTED] pcapDirAbsolute` — they must be identical.

---

## Root Cause Identified (Windows)

**CICFlowMeter fails with `scapy.error.Scapy_Exception: tcpdump is not available`**

On Windows, the Python cicflowmeter uses Scapy, which invokes `tcpdump` to filter packets when reading pcap files. `tcpdump` is a Unix tool and is not available on Windows.

**Fix applied:** A patched wrapper (`scripts/cicflowmeter_patched.py`) monkey-patches AsyncSniffer to use `filter=None` when reading from file. This makes Scapy use `PcapReader` directly (native file read) instead of tcpdump. No WinDump/tcpdump required.

---

## Other Likely Root Causes (Pre-Audit)

1. **Path mismatch** — flow-extraction watched a different directory than packet-capture wrote to. Fixed by resolving both to absolute paths.
2. **ignoreInitial: false** — Existing pcap files were ignored; only new files were processed. Fixed.
3. **Undefined `probability` in insertAttackLog** — Could cause DB errors. Fixed.
4. **CICFlowMeter CSV column names** — May not match our 78 feature names; `[CSV_PARSED_ROWS]` will show missingInCsv.
5. **Supabase migration not run** — `traffic_source` etc. missing causes insert to fail. Run migration.
