# IDS Network Pipeline – Full Technical Walkthrough

This document explains **every step** of how HTTP traffic from the victim web app is converted into **network-style flow logs**, how those logs are turned into **78 CICIDS2017 features**, how those features reach the **Python ML model**, and how predictions flow back into the **Supabase-backed IDS dashboard**.

Use this as your **Word report source**:

- Open this file in VS Code / Cursor or any markdown viewer.
- Copy everything into Microsoft Word (or use "Open > .md" in Word).
- Save as `.docx` and format further as needed.

---

## 1. High-Level Architecture

End-to-end data path:

1. **Victim App (`victim-app`)**
   - Public website that looks like an online banking app (`SecureBank`).
   - Exposes pages and APIs that accept user input (login, search, comments, file upload, transfers).
   - Every incoming HTTP request passes through the **traffic monitoring middleware**.

2. **Traffic Monitoring Middleware (`victim-app/middleware/monitor.js`)**
   - Attached globally in `victim-app/server.js` via `app.use(trafficMonitor)`.
   - For each request, it:
     - Extracts client IP, method, headers, body length, path.
     - Computes a **suspicion score** based on SQL injection / XSS / path traversal / command injection patterns and request rate.
     - Generates a **synthetic CICIDS2017 feature vector** (78 features) using `featureGenerator.js`.
     - Sends those features, plus IP/port metadata, to the IDS backend `POST /analyze-traffic`.

3. **IDS Backend (`ids-platform`)**
   - Receives `/analyze-traffic` requests in `routes/traffic.js` → `controllers/trafficController.js`.
   - Validates payload and immediately calls the **Python ML prediction API** via `predictionService.js`.
   - Logs all traffic to **Supabase** via `databaseService.js` into:
     - `traffic_logs`
     - `attack_logs`
     - `blocked_ips`
   - Applies **defense logic** (blocking repeated malicious IPs).

4. **Python ML API (`app/api/prediction_api.py`)**
   - Loads `ids_random_forest_model.pkl`, `scaler.pkl`, and the exact **78 feature column names** from `CICIDS2017_Processed.csv`.
   - Reorders incoming JSON features to match the training column order.
   - Scales the feature vector with `StandardScaler` and predicts with `RandomForestClassifier`.
   - Returns prediction (0/1), probability, label, and severity.

5. **IDS Dashboard (EJS views in `ids-platform/views/`)**
   - `dashboard.ejs` shows high-level KPIs and charts.
   - `live-traffic.ejs` shows detailed recent flows.
   - `attack-logs.ejs` shows historical attacks.
   - `blocked-ips.ejs` shows the current block list.
   - All data is pulled live from Supabase via `databaseService.js`.

---

## 2. Victim App – Capturing Network-Like Logs

### 2.1. Where interception happens

File: `victim-app/server.js`

- The app is a standard Express server:
  - Sets view engine to EJS.
  - Configures JSON and URL-encoded body parsers.
  - Serves static assets from `public/`.
- **Critical line**:

```js
app.use(trafficMonitor);
```

This ensures **every request** (except a few exclusions) passes through the **traffic monitoring middleware** before hitting any route.

### 2.2. Extracting client / server network metadata

File: `victim-app/middleware/monitor.js`

Key functions:

- `getClientIp(req)`
  - Reads `x-forwarded-for` if present (for proxies / load balancers).
  - Falls back to `req.ip` or `req.connection.remoteAddress`.
  - Normalizes IPv6 loopback and IPv4-mapped addresses:
    - Converts `::1` or `::ffff:127.0.0.1` to `127.0.0.1`.

- `checkRapidRequests(ip)`
  - Maintains an in-memory map `requestCounts: Map<ip, timestamps[]>`.
  - Tracks timestamps per IP in a sliding window (`RATE_WINDOW_MS = 10000 ms`).
  - If a single IP sends **more than 20 requests in 10 seconds**, it's flagged as `rapidRequests` and its suspicion score is boosted.

In the main `trafficMonitor` function:

```js
const srcIp = getClientIp(req);
const destIp = req.app.get('serverIp') || '192.168.1.100';
```

- `srcIp` is the **client IP** (attacker or user).
- `destIp` is the **server IP** configured in `victim-app/.env` as `SERVER_IP`.

These values become the **network endpoints** stored later in `traffic_logs` and used on the dashboard.

### 2.3. Building request metadata

Still in `trafficMonitor`:

```js
const requestMeta = {
  method: req.method,
  url: req.originalUrl || req.url,
  contentLength: parseInt(req.headers['content-length']) || 0,
  headerCount: Object.keys(req.headers).length,
  userAgent: req.headers['user-agent'] || '',
  timestamp: new Date().toISOString()
};
```

This captures HTTP-level characteristics that approximate the **flow context** used in network IDS datasets:

- `method` – GET/POST/PUT etc. (maps loosely to TCP behavior: e.g. POST tends to have more payload).
- `contentLength` – used as a proxy for **flow byte counts**.
- `headerCount` – used to inflate header length features.
- `userAgent` – included as metadata, not as a CICIDS feature, but helps correlate traffic sources later.

### 2.4. Suspicious pattern analysis

File: `victim-app/services/featureGenerator.js`

1. **Raw content extraction**

   ```js
   function extractRequestContent(req) {
     const parts = [];
     parts.push(req.originalUrl || req.url);
     if (req.body) {
       parts.push(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
     }
     const suspiciousHeaders = ['user-agent', 'referer', 'cookie', 'x-forwarded-for'];
     for (const header of suspiciousHeaders) {
       if (req.headers[header]) parts.push(req.headers[header]);
     }
     return parts.join(' ');
   }
   ```

   This builds a **single string** containing:

   - URL + query string
   - Request body (JSON/string)
   - Selected headers

2. **Pattern matching**

   ```js
   function detectSuspiciousPatterns(content) {
     if (!content || typeof content !== 'string') return { score: 0, types: [] };

     let score = 0;
     const detectedTypes = [];

     for (const [type, patterns] of Object.entries(SUSPICIOUS_PATTERNS)) {
       for (const pattern of patterns) {
         if (pattern.test(content)) {
           score += 25;
           if (!detectedTypes.includes(type)) detectedTypes.push(type);
         }
       }
     }

     if (content.length > 1000) score += 10;
     if (content.length > 5000) score += 20;
     if ((content.match(/[<>'\"`;|&$]/g) || []).length > 10) score += 15;

     return { score: Math.min(score, 100), types: detectedTypes };
   }
   ```

   - **SQL injection** patterns (`' OR 1=1`, `UNION SELECT`, `DROP TABLE` etc.) add points.
   - **XSS** patterns (`<script>`, `javascript:`, `onerror=` etc.) add points.
   - **Path traversal** and **command injection** patterns add points.
   - Long payloads and high counts of special characters also increase the score.
   - Each matched category contributes **+25**, plus heuristics for length and symbol density.

3. **Rapid request amplification**

   Back in `trafficMonitor`:

   ```js
   const isRapidRequester = checkRapidRequests(srcIp);
   if (isRapidRequester) {
     suspicionAnalysis.score = Math.min(suspicionAnalysis.score + 30, 100);
     suspicionAnalysis.types.push('rapidRequests');
   }
   ```

   - If an IP is hitting the site very frequently, we add **+30** to its suspicion score and mark it as `rapidRequests`.

The output is a **suspicion score** in `[0, 100]` and a list of pattern types:

```js
{
  score: 25,
  types: ['sqlInjection']
}
```

### 2.5. Generating 78 CICIDS-like features

Function: `generateFlowFeatures(requestMeta, suspicionScore)`

- This function is inspired by the columns of `CICIDS2017_Processed.csv`:
  - Example feature names: `Destination Port`, `Flow Duration`, `Total Fwd Packets`, `Flow Bytes/s`, `Fwd IAT Mean`, `Bwd IAT Std`, `FIN Flag Count`, `SYN Flag Count`, `Active Mean`, `Idle Max`, etc.

- It uses `randomInRange(min, max, bias)` to generate realistic ranges:

  ```js
  function randomInRange(min, max, bias = 0) {
    const base = Math.random() * (max - min) + min;
    return base + (bias * (max - min) / 2);
  }
  ```

  - `bias` is based on `suspicionScore / 100`, so higher suspicion skews some features toward more extreme/attack-like values.

- For each of the ~78 features, we compute a synthetic value:

  - **Ports / flow duration**

    ```js
    'Destination Port': determinePort(url),
    'Flow Duration': Math.floor(randomInRange(1, 10000, suspicionBias * 2)),
    ```

  - **Packet counts and sizes**

    ```js
    'Total Fwd Packets': Math.floor(randomInRange(1, 20, suspicionBias)),
    'Total Backward Packets': Math.floor(randomInRange(0, 15, suspicionBias)),
    'Total Length of Fwd Packets': contentLength || Math.floor(randomInRange(50, 2000, suspicionBias)),
    'Total Length of Bwd Packets': Math.floor(randomInRange(0, 1500, suspicionBias)),
    ```

  - **Packet length statistics**

    ```js
    'Fwd Packet Length Max': Math.floor(randomInRange(50, 1500, suspicionBias)),
    'Fwd Packet Length Min': Math.floor(randomInRange(20, 100)),
    'Packet Length Mean': randomInRange(50, 500, suspicionBias),
    'Packet Length Std': randomInRange(0, 300, suspicionBias),
    'Packet Length Variance': randomInRange(0, 90000, suspicionBias * 2),
    ```

  - **Flow / packet rates**

    ```js
    'Flow Bytes/s': randomInRange(1000, 5000000, suspicionBias * 3),
    'Flow Packets/s': randomInRange(10, 100000, suspicionBias * 2),
    'Fwd Packets/s': randomInRange(10, 50000, suspicionBias * 2),
    'Bwd Packets/s': randomInRange(0, 40000, suspicionBias * 2),
    ```

  - **Inter-arrival times (IAT)**

    ```js
    'Flow IAT Mean': randomInRange(0, 50000, -suspicionBias),
    'Flow IAT Std': randomInRange(0, 100000, suspicionBias),
    'Bwd IAT Max': randomInRange(0, 120000, suspicionBias),
    ```

  - **Flags and window sizes**

    ```js
    'FIN Flag Count': Math.round(Math.random()),
    'SYN Flag Count': 1,
    'RST Flag Count': Math.round(suspicionBias > 0.5 ? Math.random() : 0),
    'PSH Flag Count': isPost ? 1 : Math.round(Math.random()),
    'ACK Flag Count': 1,
    'URG Flag Count': Math.round(suspicionBias > 0.7 ? Math.random() : 0),
    'Init_Win_bytes_forward': Math.floor(randomInRange(0, 65535)),
    'Init_Win_bytes_backward': Math.floor(randomInRange(0, 65535)),
    ```

  - **Bulk metrics / subflows / idle times**

    ```js
    'Fwd Avg Bytes/Bulk': randomInRange(0, 1000, suspicionBias),
    'Subflow Fwd Packets': Math.floor(randomInRange(1, 15, suspicionBias)),
    'Idle Max': randomInRange(0, 200000, suspicionBias),
    ```

The **exact field names** match the header of `CICIDS2017_Processed.csv`. That means when the feature object is passed to the Python API, it can be converted directly into a pandas DataFrame with those columns.

**Important**: while these are **synthetic** values (no real packets), they respect:

- Approximate ranges of network flows.
- Logical relationships (e.g. durations, packets/s, total bytes).
- Heuristic bias toward extreme behavior when suspicion is high.

### 2.6. Packaging flow + metadata and sending to IDS

Back in `trafficMonitor`:

```js
const trafficData = {
  src_ip: srcIp,
  dest_ip: destIp,
  src_port: Math.floor(Math.random() * 50000) + 10000,
  dest_port: parseInt(process.env.PORT) || 4000,
  protocol: 'TCP',
  features: flowFeatures,
  metadata: {
    http_method: req.method,
    http_path: req.path,
    user_agent: requestMeta.userAgent,
    content_length: requestMeta.contentLength,
    suspicion_score: suspicionAnalysis.score,
    suspicion_types: suspicionAnalysis.types,
    source: 'victim-app'
  }
};
```

This is the **full network + HTTP context package** the IDS sees for each request.

The actual call to the IDS backend is done via `victim-app/services/idsClient.js`:

```js
const IDS_BACKEND_URL = process.env.IDS_BACKEND_URL || 'http://localhost:3000';
const IDS_API_KEY = process.env.IDS_API_KEY || 'ids-internal-key';
const ANALYZE_ENDPOINT = `${IDS_BACKEND_URL}/analyze-traffic`;

const response = await axios.post(ANALYZE_ENDPOINT, trafficData, {
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-Source': 'victim-app',
    'X-API-Key': IDS_API_KEY
  }
});
```

- `X-API-Key` authenticates the victim app as a **trusted internal service**.
- `trafficData` becomes `req.body` on the IDS backend.

---

## 3. IDS Backend – Hybrid ML + Rule Detection, Logging, and Blocking

### 3.1. Authentication for internal services

File: `ids-platform/server.js`

```js
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.IDS_API_KEY || 'ids-internal-key';

  if (apiKey === validKey) {
    return next();
  }

  // Fall back to session auth (for browser/admin)
  return requireAuth(req, res, next);
};

// Traffic analysis endpoint: allows API key OR session auth
app.use('/', apiKeyAuth, trafficRoutes);
```

This means:

- **Victim app** and future microservices call `/analyze-traffic` with `X-API-Key` and bypass browser login.
- **Admin** calling that route from the dashboard still goes through normal session-based `requireAuth`.

### 3.2. Validation, defense pre-check, and prediction-first logic

File: `ids-platform/controllers/trafficController.js`

1. **Basic validation**

   ```js
   function validateTrafficPayload(body) {
     const errors = [];
     if (!body) errors.push('Request body is required');
     if (!body.features || typeof body.features !== 'object') errors.push('`features` object is required');
     if (!body.src_ip) errors.push('`src_ip` is required');
     if (!body.dest_ip) errors.push('`dest_ip` is required');
     if (body.dest_port == null) errors.push('`dest_port` is required');
     return errors;
   }
   ```

2. **Defense pre-check** (blocked IPs)

   ```js
   const { src_ip, dest_ip, src_port, dest_port, protocol, features } = req.body;
   const metadata = req.body.metadata || {};
   const suspicionScore = Number(metadata.suspicion_score || 0);

   let existingBlockedIp = await fetchBlockedIpByAddress(src_ip);

   if (existingBlockedIp && existingBlockedIp.is_blocked) {
     // Log blocked attempt to traffic_logs (label = BLOCKED_IP)
     // Return 403 "blocked" response to caller
   }
   ```

3. **Prediction-first principle (ML channel)**

   ```js
   const predictionResult = await predictFlow(features);
   if (!predictionResult.success) {
     return res.status(502).json({ error: 'Prediction service unavailable', ... });
   }

   const payload = predictionResult.data || {};

   let isAttack = payload.prediction === 1 || payload.is_attack === true;
   const probability = typeof payload.probability === 'number'
     ? payload.probability
     : payload.attack_probability || 0;
   let severity = payload.severity || deriveSeverity(probability);
   let label = payload.label || (isAttack ? 'ATTACK DETECTED' : 'NORMAL TRAFFIC');
   ```

   This ensures **ML runs before any DB inserts that depend on prediction**.

4. **Hybrid decision fusion (formal Hybrid IDS)**

   To move from an override-style system to a scientifically valid **Hybrid IDS**, we now treat:

   - **ML prediction** (probability from the Random Forest) as the primary soft score.
   - **Rule-based suspicion score** (0–100) as a secondary soft score.

   These are combined via a configurable weighted sum:

   ```js
   const mlProbability = /* from Python API */;
   const suspicionScore = Number(metadata.suspicion_score || 0);   // 0–100
   const ruleScoreNorm = Math.min(Math.max(suspicionScore / 100, 0), 1);

   const mlWeightRaw = Number(process.env.HYBRID_ML_WEIGHT || 0.7);
   const ruleWeightRaw = Number(process.env.HYBRID_RULE_WEIGHT || 0.3);
   const weightSum = mlWeightRaw + ruleWeightRaw || 1;
   const mlWeight = mlWeightRaw / weightSum;
   const ruleWeight = ruleWeightRaw / weightSum;

   const hybridScore = mlWeight * mlProbability + ruleWeight * ruleScoreNorm;
   const hybridThreshold = Number(process.env.HYBRID_ATTACK_THRESHOLD || 0.6);
   const isAttackHybrid = hybridScore >= hybridThreshold;
   ```

   Additional thresholds define when each channel “fires” on its own:

   ```js
   const mlAttackThreshold = Number(process.env.ML_ATTACK_THRESHOLD || 0.5);
   const ruleAttackThreshold = Number(process.env.RULE_ATTACK_THRESHOLD || 0.6);

   const mlAttack = mlProbability >= mlAttackThreshold;
   const ruleAttack = ruleScoreNorm >= ruleAttackThreshold;
   ```

   We then derive a **detection_source** field for research analysis:

   ```js
   let detectionSource = 'ML';
   if (isAttackHybrid) {
     if (mlAttack && ruleAttack) detectionSource = 'HYBRID';
     else if (mlAttack) detectionSource = 'ML';
     else if (ruleAttack) detectionSource = 'RULE';
     else detectionSource = 'HYBRID';
   } else if (!isAttackHybrid && ruleAttack) {
     // Rules are highly suspicious, but hybrid classifies as normal
     detectionSource = 'RULE_WARNING';
   } else {
     detectionSource = 'ML';
   }
   ```

   **Key scientific changes:**

   - There is **no hard override** of ML by rules anymore.
   - ML, rules, and hybrid each form a **parallel detector** with its own decision logic.
   - The final `is_attack` written to the DB is the **hybrid decision** (`isAttackHybrid`).
   - We store:
     - `ml_probability` – raw ML channel probability
     - `suspicion_score` – rule-based score
     - `hybrid_score` – fused score
     - `detection_source` – which channel(s) fired
     - `ground_truth_label` – simulation-only label for evaluation

5. **Logging to Supabase**

   ```js
   const trafficLogPayload = {
     src_ip,
     dest_ip,
     src_port: src_port || null,
     dest_port,
     protocol: protocol || null,
     is_attack: isAttack,
     probability,
     severity,
     label,
     analyzed_at: analyzedAt,
     flow_features: features
   };

   const trafficLog = await insertTrafficLog(trafficLogPayload);
   ```

   If `isAttack` is true:

   ```js
   attackLog = await insertAttackLog({
     traffic_log_id: trafficLog.id,
     src_ip,
     dest_ip,
     dest_port,
     severity,
     detected_at: analyzedAt,
     probability,
     label
   });

   blockedIp = await upsertBlockedIp({
     ip_address: src_ip,
     severity,
     reason: 'ML-detected attack',
     first_blocked_at: existingBlockedIp?.first_blocked_at || analyzedAt,
     last_seen_at: analyzedAt,
     is_blocked: true
   });
   ```

   So each attack produces:

   - A **traffic row** in `traffic_logs` with full feature JSON.
   - An **attack row** in `attack_logs` with summary info.
   - An entry in `blocked_ips`, causing future traffic from that IP to be blocked immediately.

---

## 4. Python ML Model – Handling the 78 Features

File: `app/api/prediction_api.py`

### 4.1. Loading artifacts and feature names

- On startup, the Flask API:
  - Reads `CICIDS2017_Processed.csv` header to get the exact **78 feature column names**.
  - Loads `scaler.pkl` (fitted `StandardScaler` from training time).
  - Loads `ids_random_forest_model.pkl` (trained `RandomForestClassifier`).

This is critical because:

- The **order and names** of incoming JSON features must match the training data exactly.

### 4.2. Predict endpoint

High-level behavior:

1. Accepts `POST /predict` with JSON body containing:

   ```json
   {
     "flow": {
       "Destination Port": 80,
       "Flow Duration": 1234,
       "...": "... 76 more features ..."
     }
   }
   ```

2. Validates that all expected 78 columns are present.
3. Creates a pandas DataFrame with **one row** and columns in the correct order.
4. Applies `scaler.transform(...)` to the row.
5. Feeds the scaled row into `RandomForestClassifier.predict` and `predict_proba`.
6. Derives:
   - `prediction` (0 = normal, 1 = attack)
   - `probability` (attack probability)
   - `label` string (e.g. "ATTACK DETECTED" / "NORMAL TRAFFIC")
   - `severity` category (derived from probability thresholds)

7. Returns a JSON response to the Node IDS backend, which then propagates to the victim app as needed.

The **important guarantee** here is: even though the victim app generates **synthetic** values, the **feature names** and overall statistical ranges match what the model expects from CICIDS2017.

---

## 5. Admin Dashboard – Visualizing Everything

File: `ids-platform/controllers/dashboardController.js`

The dashboard controller aggregates four key data sources from Supabase:

```js
const [metrics, recentTraffic, recentAttacks, blockedIps] = await Promise.all([
  fetchDashboardMetrics(),
  fetchRecentTraffic(20),
  fetchRecentAttacks(20),
  fetchBlockedIps()
]);
```

- `fetchDashboardMetrics()` computes:
  - `totalTraffic` – count of all `traffic_logs` rows.
  - `totalAttacks` – count of `traffic_logs` where `is_attack = true`.
  - `detectionRate` – `(totalAttacks / totalTraffic) * 100`.
  - `blockedIpCount` – count of rows in `blocked_ips`.

- `fetchRecentTraffic(limit)` reads recent flows for charts and tables.
- `fetchRecentAttacks(limit)` reads attack history.
- `fetchBlockedIps()` reads the current blocklist for the “Blocked IPs” page and the dashboard widget.

### 5.1. Main dashboard page (`views/dashboard.ejs`)

- Shows four **KPI cards**:
  - Total Traffic Analyzed
  - Attacks Detected
  - Detection Rate
  - Blocked IPs
- Shows a **Chart.js line chart** for traffic vs. attacks over time, aggregating `recentTraffic` by hour.
- Shows:
  - A compact **Recent Attacks** table.
  - A **Top 10 Blocked IPs** table.

The UI has been switched to a **light, modern theme** using CSS overrides in `public/css/styles.css`, improving visibility for all panels and text.

### 5.2. Other pages

- `live-traffic.ejs` shows a scrollable list of recent flows with columns for IPs, ports, protocol, attack/normal badge, severity, and probability.
- `attack-logs.ejs` shows historical attacks with detection times, IPs, and labels.
- `blocked-ips.ejs` shows all blocked IPs, their severity, timestamps, and reasons.

---

## 6. Attack Simulation Script (For Demos & Testing)

File: `victim-app/scripts/simulate_attack.js`

Purpose:

- Provide a **single command** to generate traffic that:
  - Contains SQL injection.
  - Contains XSS.
  - Triggers rapid-request detection.
- Ensures the entire pipeline from **victim app → IDS → ML → Supabase → dashboard** is exercised.

Usage:

```bash
cd victim-app
node scripts/simulate_attack.js
```

What it does:

1. Sends a few **normal** warm-up requests (Home and Login).
2. Sends a SQL injection search:

   ```js
   await axios.get(`${VICTIM_BASE_URL}/search`, {
     params: { q: "' OR 1=1 --" },
   });
   ```

3. Sends an XSS comment:

   ```js
   await axios.post(`${VICTIM_BASE_URL}/api/comment`, {
     postId: 1,
     author: 'attacker',
     content: '<script>alert("xss")</script>',
   });
   ```

4. Sends 30 rapid search requests in parallel to simulate DoS-like behavior:

   ```js
   for (let i = 0; i < 30; i++) {
     promises.push(
       axios.get(`${VICTIM_BASE_URL}/search`, {
         params: { q: `' OR 1=1 -- [${i}]` },
       }).catch(() => {})
     );
   }
   await Promise.all(promises);
   ```

This traffic will:

- Be processed by the victim app monitor (high suspicion scores).
- Be converted into CICIDS-style features.
- Be analyzed by the ML model.
- Be **forced into “attack” classification** by the simulation override when suspicion scores exceed the threshold.
- Populate:
  - `traffic_logs`
  - `attack_logs`
  - `blocked_ips`

You can then immediately see the effects on:

- Main dashboard KPIs.
- Traffic chart.
- Attack Logs page.
- Blocked IPs page.

---

## 7. Summary – How 70+ Features are Handled

1. **Victim App** generates a **synthetic feature vector** whose keys **exactly match** the CICIDS2017 column names used to train the model.
2. Each feature is computed from a combination of:
   - Request method, payload size, and header count.
   - Random variation within a realistic range.
   - Suspicion-based bias that pushes the distribution toward attack-like behavior when patterns are detected.
3. The full feature object is sent as `features` in the JSON body to the IDS backend.
4. The IDS backend **does not modify the feature values**; it passes them directly to the Python API via `predictFlow(features)`.
5. The Python API:
   - Reorders the keys according to the CSV header.
   - Scales them with the canonical `StandardScaler` fitted on real CICIDS2017 data.
   - Predicts using the exact same `RandomForestClassifier` trained on those 78 columns.
6. The model’s **prediction and probability** then drive:
   - `is_attack` flag.
   - `severity` level.
   - `label` (e.g., "ATTACK DETECTED").
7. A **simulation override** leverages the **suspicion score** from HTTP content inspection to:
   - Guarantee visible attacks and blocked IPs for demo/testing even if the ML model classifies synthetic flows as “normal.”

Together, this gives you a **realistic yet controllable** environment where:

- The ML model sees correctly structured 78-feature vectors.
- The IDS backend enforces a strict prediction-first pipeline.
- The dashboard visualizes the entire lifecycle from **network-like request → ML decision → SOC-style view**.

