# AI Cybersecurity Intrusion Detection & Prevention System (IDS/IPS)

## Complete Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [ML Model Details](#5-ml-model-details)
6. [Python Prediction API](#6-python-prediction-api)
7. [Node.js Backend](#7-nodejs-backend)
8. [Database Schema (Supabase)](#8-database-schema-supabase)
9. [Frontend Dashboard (EJS)](#9-frontend-dashboard-ejs)
10. [Traffic Analysis Pipeline](#10-traffic-analysis-pipeline)
11. [Defense Simulation Logic](#11-defense-simulation-logic)
12. [Authentication System](#12-authentication-system)
13. [API Endpoints](#13-api-endpoints)
14. [Error Handling & Logging](#14-error-handling--logging)
15. [Setup & Installation](#15-setup--installation)
16. [Configuration](#16-configuration)
17. [Running the Application](#17-running-the-application)
18. [Testing the System](#18-testing-the-system)

---

## 1. Project Overview

This project is an **industry-grade AI-powered Intrusion Detection & Prevention System (IDS/IPS)** that:

- Analyzes network traffic flows using a trained Machine Learning model
- Detects potential cyber attacks in real-time
- Logs all traffic and attack events to a PostgreSQL database (Supabase)
- Simulates IP blocking for detected attack sources
- Provides a Security Operations Center (SOC) style dashboard
- Supports admin authentication for protected access

### Key Features

- **ML-Powered Detection**: Random Forest classifier trained on CICIDS2017 dataset
- **Real-Time Analysis**: Traffic flows are analyzed instantly via REST API
- **Prediction-First Architecture**: ML prediction always runs before any database logic that depends on it
- **Defense Simulation**: Already-blocked IPs are rejected before ML processing
- **Severity Classification**: Attacks are classified as critical/high/medium/low based on probability
- **Comprehensive Logging**: All traffic, attacks, and blocked IPs are logged with timestamps
- **Visual Dashboard**: Bootstrap-based dark theme SOC dashboard with Chart.js visualizations

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐       │
│   │   Traffic   │───▶│  Node.js Backend │───▶│  Python ML API      │       │
│   │   Input     │    │  (Express.js)    │    │  (Flask)            │       │
│   └─────────────┘    └────────┬─────────┘    └──────────┬──────────┘       │
│                               │                         │                   │
│                               │ Prediction Result       │ predict()         │
│                               ◀─────────────────────────┘                   │
│                               │                                             │
│                               ▼                                             │
│                      ┌────────────────────┐                                 │
│                      │  Supabase          │                                 │
│                      │  (PostgreSQL)      │                                 │
│                      │  - traffic_logs    │                                 │
│                      │  - attack_logs     │                                 │
│                      │  - blocked_ips     │                                 │
│                      └────────┬───────────┘                                 │
│                               │                                             │
│                               ▼                                             │
│                      ┌────────────────────┐                                 │
│                      │  EJS Dashboard     │                                 │
│                      │  (Bootstrap UI)    │                                 │
│                      └────────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Traffic Input** → Network flow features (78 numeric features)
2. **Defense Pre-Check** → Check if source IP is already blocked
3. **ML Prediction** → Send features to Python API, receive prediction
4. **Database Storage** → Store traffic log, attack log (if attack), block IP (if attack)
5. **Response** → Return prediction result to client
6. **Dashboard Update** → Dashboard reads latest data from Supabase

---

## 3. Technology Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js v4.19 | Web application framework |
| Template Engine | EJS v3.1 | Server-side HTML rendering |
| HTTP Client | Axios v1.7 | Calls to Python ML API |
| Database Client | @supabase/supabase-js v2.49 | PostgreSQL via Supabase |
| Session Management | express-session v1.18 | Admin authentication |
| Password Hashing | bcryptjs v2.4 | Secure password storage |
| CORS | cors v2.8 | Cross-origin resource sharing |
| Environment | dotenv v16.4 | Environment variable management |

### ML API
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Python 3.10+ | ML model execution |
| Framework | Flask | REST API server |
| CORS | flask-cors | Cross-origin support |
| ML Library | scikit-learn | Random Forest model |
| Data Processing | pandas, numpy | Feature handling |
| Model Persistence | joblib | Model/scaler serialization |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| CSS Framework | Bootstrap 5.3 | Responsive dark theme UI |
| Charts | Chart.js 4.4 | Traffic/attack visualizations |
| Icons | Bootstrap Icons | UI iconography |

### Database
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL | Relational data storage |
| Platform | Supabase | Managed PostgreSQL with REST API |

### Dataset
| Dataset | Description |
|---------|-------------|
| CICIDS2017 | Canadian Institute for Cybersecurity Intrusion Detection Dataset 2017 |
| Features | 78 network flow features |
| Labels | Binary classification (0 = Normal, 1 = Attack) |

---

## 4. Project Structure

```
ids-platform/
│
├── config/
│   ├── supabaseClient.js      # Supabase connection configuration
│   └── auth.js                # Session and authentication middleware
│
├── controllers/
│   ├── trafficController.js   # Traffic analysis logic (prediction-first)
│   ├── dashboardController.js # Dashboard page rendering
│   └── authController.js      # Login/logout handling
│
├── routes/
│   ├── traffic.js             # POST /analyze-traffic
│   ├── dashboardRoutes.js     # Dashboard page routes
│   ├── simulationRoutes.js    # POST /simulate-traffic
│   └── authRoutes.js          # Login/logout routes
│
├── services/
│   ├── predictionService.js   # ML API client (calls Python)
│   ├── databaseService.js     # Supabase queries (CRUD operations)
│   └── simulationService.js   # Traffic simulation from CSV
│
├── views/
│   ├── dashboard.ejs          # Main dashboard with metrics & charts
│   ├── live-traffic.ejs       # Live traffic monitor table
│   ├── attack-logs.ejs        # Attack logs table
│   ├── blocked-ips.ejs        # Blocked IPs table
│   ├── login.ejs              # Admin login form
│   ├── 404.ejs                # Not found page
│   ├── 500.ejs                # Server error page
│   └── partials/
│       └── layout.ejs         # Shared layout template
│
├── public/
│   └── css/
│       └── styles.css         # Custom styles
│
├── server.js                  # Express app entry point
├── package.json               # Node.js dependencies
├── .env.example               # Environment variable template
├── supabase_schema.sql        # Database table definitions
└── PROJECT_DOCUMENTATION.md   # This documentation file
```

### Python ML API (in parent directory)

```
app/
└── api/
    └── prediction_api.py      # Flask prediction server

Trained Models/
└── Models/
    ├── ids_random_forest_model.pkl  # Trained RF model
    └── scaler.pkl                    # StandardScaler for features

Data/
└── Processed Data/
    └── CICIDS2017_Processed.csv     # Processed dataset (78 features + Label)
```

---

## 5. ML Model Details

### Model Type
- **Algorithm**: Random Forest Classifier
- **Library**: scikit-learn
- **Estimators**: 100 trees
- **Training**: Stratified 80/20 train/test split

### Feature Scaling
- **Scaler**: StandardScaler (z-score normalization)
- **Formula**: `x_scaled = (x - mean) / std`
- **Fit**: On training data only, saved to `scaler.pkl`

### Input Features (78 total)

The model expects all 78 features from the CICIDS2017 dataset:

| # | Feature Name | Description |
|---|--------------|-------------|
| 1 | Destination Port | Target port number |
| 2 | Flow Duration | Duration of the flow in microseconds |
| 3 | Total Fwd Packets | Total packets in forward direction |
| 4 | Total Backward Packets | Total packets in backward direction |
| 5 | Total Length of Fwd Packets | Total size of forward packets |
| 6 | Total Length of Bwd Packets | Total size of backward packets |
| 7 | Fwd Packet Length Max | Maximum forward packet size |
| 8 | Fwd Packet Length Min | Minimum forward packet size |
| 9 | Fwd Packet Length Mean | Mean forward packet size |
| 10 | Fwd Packet Length Std | Std dev of forward packet size |
| ... | ... | ... |
| 78 | Idle Min | Minimum idle time |

### Output
- **Prediction**: 0 (Normal) or 1 (Attack)
- **Probability**: Float [0.0, 1.0] representing attack confidence

### Severity Mapping
| Probability Range | Severity Level |
|-------------------|----------------|
| >= 0.9 | Critical |
| >= 0.7 | High |
| >= 0.4 | Medium |
| < 0.4 | Low |

---

## 6. Python Prediction API

### File: `app/api/prediction_api.py`

### Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

#### POST /predict
Predict whether a network flow is an attack.

**Request Body:**
```json
{
  "flow": {
    "Destination Port": 80,
    "Flow Duration": 5000,
    "Total Fwd Packets": 10,
    "Total Backward Packets": 8,
    "Total Length of Fwd Packets": 1200,
    "Total Length of Bwd Packets": 900,
    "Flow Bytes/s": 300000,
    "Flow Packets/s": 500,
    "...": "... (all 78 features)"
  }
}
```

**Response (Success):**
```json
{
  "prediction": 1,
  "is_attack": true,
  "label": "ATTACK DETECTED",
  "probability": 0.97,
  "severity": "critical"
}
```

**Response (Missing Features):**
```json
{
  "error": "Missing required features",
  "missing_features": ["Feature1", "Feature2"]
}
```

### Implementation Details

```python
def predict():
    # 1. Parse JSON request
    flow = request.get_json()["flow"]
    
    # 2. Validate all 78 features present
    missing = [col for col in FEATURE_COLUMNS if col not in flow]
    if missing:
        return error_response
    
    # 3. Build DataFrame with correct column order
    flow_df = pd.DataFrame([{col: flow[col] for col in FEATURE_COLUMNS}])
    
    # 4. Scale features using saved scaler
    flow_scaled = SCALER.transform(flow_df)
    
    # 5. Predict using trained model
    pred = MODEL.predict(flow_scaled)[0]
    prob = MODEL.predict_proba(flow_scaled)[0][1]
    
    # 6. Return structured response
    return {
        "prediction": int(pred),
        "is_attack": pred == 1,
        "label": "ATTACK DETECTED" if pred == 1 else "NORMAL TRAFFIC",
        "probability": float(prob),
        "severity": derive_severity(prob)
    }
```

---

## 7. Node.js Backend

### Entry Point: `server.js`

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { configureSession, requireAuth } = require('./config/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());
configureSession(app);

// Routes
app.use('/', authRoutes);                          // Public
app.use('/', requireAuth, dashboardRoutes);        // Protected
app.use('/', requireAuth, trafficRoutes);          // Protected
app.use('/', requireAuth, simulationRoutes);       // Protected

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT);
```

### Traffic Controller: `controllers/trafficController.js`

The core analysis function implementing **prediction-first architecture**:

```javascript
async function analyzeTraffic(req, res) {
  // 1. Validate request
  const { src_ip, dest_ip, dest_port, features } = req.body;
  
  // 2. DEFENSE PRE-CHECK: Reject if IP already blocked
  const existingBlock = await fetchBlockedIpByAddress(src_ip);
  if (existingBlock && existingBlock.is_blocked) {
    // Log blocked attempt
    await insertTrafficLog({...blocked attempt data...});
    return res.status(403).json({ status: 'blocked' });
  }
  
  // 3. PREDICTION-FIRST: Call ML API before any DB writes
  const prediction = await predictFlow(features);
  if (!prediction.success) {
    return res.status(502).json({ error: 'Prediction failed' });
  }
  
  // 4. DB WRITES (after successful prediction)
  const trafficLog = await insertTrafficLog({...});
  
  if (isAttack) {
    const attackLog = await insertAttackLog({...});
    const blockedIp = await upsertBlockedIp({...});
  }
  
  // 5. Return response
  return res.json({ prediction, trafficLog, attackLog, blockedIp });
}
```

### Prediction Service: `services/predictionService.js`

```javascript
async function predictFlow(features) {
  try {
    const response = await axios.post(PYTHON_API_URL, { flow: features }, {
      timeout: 5000
    });
    return { success: true, data: response.data };
  } catch (error) {
    // Classify error type
    let errorType = 'UNKNOWN_ERROR';
    if (error.code === 'ECONNABORTED') errorType = 'TIMEOUT';
    else if (error.response) errorType = 'HTTP_ERROR';
    else if (error.request) errorType = 'NETWORK_ERROR';
    
    console.error('[PREDICTION_SERVICE_ERROR]', { type: errorType });
    return { success: false, errorType, message: error.message };
  }
}
```

### Database Service: `services/databaseService.js`

All Supabase operations with tagged error logging:

```javascript
async function insertTrafficLog(payload) {
  try {
    const { data, error } = await supabase
      .from('traffic_logs')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('[DB_ERROR_TRAFFIC_INSERT]', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[DB_EXCEPTION_TRAFFIC_INSERT]', err);
    throw err;
  }
}

// Similar implementations for:
// - insertAttackLog
// - upsertBlockedIp
// - fetchBlockedIpByAddress
// - fetchRecentTraffic
// - fetchRecentAttacks
// - fetchBlockedIps
// - fetchDashboardMetrics
```

---

## 8. Database Schema (Supabase)

### File: `supabase_schema.sql`

```sql
-- Table: traffic_logs
-- Stores ALL analyzed traffic flows
CREATE TABLE public.traffic_logs (
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
  flow_features JSONB
);

-- Table: attack_logs
-- Stores only flows classified as attacks
CREATE TABLE public.attack_logs (
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

-- Table: blocked_ips
-- Simulated firewall block list
CREATE TABLE public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  severity TEXT,
  reason TEXT,
  first_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT true
);
```

### Entity Relationships

```
traffic_logs (1) ─────────┬───────── (*) attack_logs
     │                    │
     │                    └─── traffic_log_id FK
     │
     └── src_ip ─────────────── ip_address ─── blocked_ips
```

---

## 9. Frontend Dashboard (EJS)

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview with KPIs, charts, recent attacks |
| Live Traffic | `/live-traffic` | Real-time traffic log table |
| Attack Logs | `/attack-logs` | Detected attacks table |
| Blocked IPs | `/blocked-ips` | Blocked IP addresses table |
| Login | `/login` | Admin authentication |

### Dashboard Components

#### KPI Cards
- **Total Traffic Analyzed**: Count of all `traffic_logs` entries
- **Attacks Detected**: Count of `traffic_logs` where `is_attack = true`
- **Detection Rate**: `(attacks / total) * 100%`
- **Blocked IPs**: Count of `blocked_ips` entries

#### Traffic & Attack Trends Chart
- Line chart showing traffic volume and attack frequency over time
- Data aggregated by hour from `traffic_logs`
- Built with Chart.js

#### Recent Attacks Table
- Latest 20 attack logs
- Columns: Time, Source IP, Dest IP, Severity

#### Blocked IPs Table (Top 10)
- Most recently blocked IPs
- Columns: IP Address, Severity, First Blocked, Last Seen

### UI Design
- **Theme**: Dark mode (Bootstrap `bg-dark`, `text-light`)
- **Color Scheme**:
  - Normal traffic: Green badges
  - Attacks: Red badges/cards
  - Warnings: Yellow/amber
  - Info: Cyan
- **Responsive**: Bootstrap grid system

---

## 10. Traffic Analysis Pipeline

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRAFFIC ANALYSIS PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REQUEST RECEIVED                                                        │
│     POST /analyze-traffic                                                   │
│     Body: { src_ip, dest_ip, dest_port, features: {...78 features} }       │
│                                                                             │
│  2. VALIDATION                                                              │
│     ✓ Check required fields (src_ip, dest_ip, dest_port, features)         │
│     ✗ Return 400 if invalid                                                │
│                                                                             │
│  3. DEFENSE PRE-CHECK (Simulation)                                          │
│     Query: SELECT * FROM blocked_ips WHERE ip_address = src_ip              │
│     IF is_blocked = true:                                                   │
│       → Log blocked attempt to traffic_logs (label = 'BLOCKED_IP')         │
│       → Return 403 { status: 'blocked', reason: 'IP already blocked' }     │
│                                                                             │
│  4. ML PREDICTION (Prediction-First)                                        │
│     POST http://localhost:5000/predict { flow: features }                   │
│     IF prediction fails:                                                    │
│       → Log error [PREDICTION_FAILURE]                                      │
│       → Return 502 { error: 'Prediction service unavailable' }             │
│                                                                             │
│  5. PROCESS PREDICTION RESULT                                               │
│     Extract: prediction (0/1), probability, is_attack, label               │
│     Derive severity: critical/high/medium/low                               │
│                                                                             │
│  6. DATABASE WRITES                                                         │
│     a) INSERT INTO traffic_logs (always)                                    │
│        → src_ip, dest_ip, ports, is_attack, probability, severity,         │
│          label, analyzed_at, flow_features (JSONB)                         │
│                                                                             │
│     b) IF is_attack = true:                                                 │
│        → INSERT INTO attack_logs                                            │
│        → UPSERT INTO blocked_ips (ON CONFLICT ip_address)                  │
│                                                                             │
│  7. RESPONSE                                                                │
│     Return 200 {                                                            │
│       status: 'ok',                                                         │
│       prediction: 0/1,                                                      │
│       label: 'ATTACK DETECTED' / 'NORMAL TRAFFIC',                         │
│       probability: 0.XX,                                                    │
│       severity: 'critical/high/medium/low',                                │
│       is_attack: true/false,                                               │
│       blocked: true/false,                                                 │
│       traffic_log: {...},                                                  │
│       attack_log: {...} | null,                                            │
│       blocked_ip: {...} | null                                             │
│     }                                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Guarantees

1. **Prediction-First**: ML prediction always runs before any DB writes that depend on prediction results
2. **Defense Simulation**: Already-blocked IPs are rejected before ML processing (saves compute)
3. **No Duplicate Blocks**: `UNIQUE(ip_address)` constraint + `UPSERT` prevents duplicates
4. **Atomic Logging**: Every traffic flow is logged, including blocked attempts

---

## 11. Defense Simulation Logic

### IP Blocking Workflow

```
                    ┌─────────────────────────┐
                    │   New Traffic Request   │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Is src_ip in           │
                    │  blocked_ips table?     │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │ Yes             │                 │ No
              ▼                 │                 ▼
     ┌────────────────┐         │        ┌────────────────┐
     │ is_blocked =   │         │        │  Run ML        │
     │ true?          │         │        │  Prediction    │
     └───────┬────────┘         │        └───────┬────────┘
             │                  │                │
     ┌───────┴───────┐          │        ┌───────┴───────┐
     │ Yes           │ No       │        │ Is Attack?    │
     ▼               ▼          │        └───────┬───────┘
┌─────────┐   ┌─────────┐       │                │
│ REJECT  │   │ Run ML  │       │        ┌───────┴───────┐
│ (403)   │   │ (cont.) │       │        │ Yes           │ No
│         │   │         │       │        ▼               ▼
│ Log as  │   │         │       │   ┌─────────┐   ┌─────────┐
│ BLOCKED │   │         │       │   │ UPSERT  │   │ Log as  │
│ _IP     │   │         │       │   │ blocked │   │ normal  │
└─────────┘   └─────────┘       │   │ _ips    │   │ traffic │
                                │   └─────────┘   └─────────┘
                                │
                                └─────────────────────────────
```

### Implementation Details

```javascript
// In trafficController.js

// 1. Fetch existing block status
const existingBlockedIp = await fetchBlockedIpByAddress(src_ip);

// 2. If actively blocked, reject immediately
if (existingBlockedIp && existingBlockedIp.is_blocked) {
  // Log the blocked attempt (doesn't depend on ML prediction)
  await insertTrafficLog({
    src_ip,
    dest_ip,
    is_attack: true,
    label: 'BLOCKED_IP',
    severity: existingBlockedIp.severity || 'high',
    probability: null  // No prediction made
  });
  
  return res.status(403).json({
    status: 'blocked',
    reason: 'Source IP is already blocked',
    ip_address: src_ip
  });
}

// 3. If new attack detected, add to block list
if (isAttack) {
  await upsertBlockedIp({
    ip_address: src_ip,
    severity: derivedSeverity,
    reason: 'ML-detected attack',
    first_blocked_at: existingBlockedIp?.first_blocked_at || now,
    last_seen_at: now,
    is_blocked: true
  });
}
```

---

## 12. Authentication System

### Session-Based Authentication

```javascript
// config/auth.js

function configureSession(app) {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 3600000  // 1 hour
    }
  }));
}

function requireAuth(req, res, next) {
  if (req.session?.user?.isAdmin) {
    return next();
  }
  return res.redirect('/login');
}
```

### Admin Credentials

Configured via environment variables:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
# OR
ADMIN_PASSWORD_HASH=$2a$10$...  # bcrypt hash
```

### Login Flow

1. User visits `/login`
2. Enters username and password
3. `authController.handleLogin()`:
   - Validates credentials against env vars
   - Compares password using bcrypt
   - Sets `req.session.user = { username, isAdmin: true }`
4. Redirects to `/` (dashboard)

### Protected Routes

All dashboard and API routes are protected:

```javascript
app.use('/', requireAuth, dashboardRoutes);
app.use('/', requireAuth, trafficRoutes);
app.use('/', requireAuth, simulationRoutes);
```

---

## 13. API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/login` | Login page | No |
| POST | `/login` | Submit login | No |
| POST | `/logout` | End session | Yes |

### Traffic Analysis

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/analyze-traffic` | Analyze single flow | Yes |

**Request Body:**
```json
{
  "src_ip": "192.168.1.100",
  "dest_ip": "10.0.0.1",
  "src_port": 54321,
  "dest_port": 80,
  "protocol": "TCP",
  "features": {
    "Destination Port": 80,
    "Flow Duration": 5000,
    "...": "...78 features..."
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "prediction": 1,
  "label": "ATTACK DETECTED",
  "probability": 0.95,
  "severity": "critical",
  "is_attack": true,
  "blocked": true,
  "traffic_log": { "id": "uuid", ... },
  "attack_log": { "id": "uuid", ... },
  "blocked_ip": { "id": "uuid", "ip_address": "192.168.1.100", ... }
}
```

### Simulation

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/simulate-traffic` | Simulate traffic from CSV | Yes |

**Request Body:**
```json
{
  "limit": 200,
  "delayMs": 200
}
```

**Response:**
```json
{
  "status": "started",
  "message": "Traffic simulation started using sample dataset"
}
```

### Dashboard Pages

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Dashboard overview | Yes |
| GET | `/live-traffic` | Traffic monitor | Yes |
| GET | `/attack-logs` | Attack history | Yes |
| GET | `/blocked-ips` | Block list | Yes |

---

## 14. Error Handling & Logging

### Log Tags

| Tag | Location | Description |
|-----|----------|-------------|
| `[PREDICTION_SERVICE_ERROR]` | predictionService.js | ML API call failed |
| `[PREDICTION_FAILURE]` | trafficController.js | Controller-level prediction error |
| `[DB_ERROR_TRAFFIC_INSERT]` | databaseService.js | Traffic log insert failed |
| `[DB_ERROR_ATTACK_INSERT]` | databaseService.js | Attack log insert failed |
| `[DB_ERROR_BLOCKED_IP_UPSERT]` | databaseService.js | Blocked IP upsert failed |
| `[DB_EXCEPTION_*]` | databaseService.js | Unexpected DB exceptions |
| `[DEFENSE_FETCH_BLOCKED_IP_ERROR]` | trafficController.js | Block check failed |
| `[DEFENSE_LOG_BLOCKED_ATTEMPT_ERROR]` | trafficController.js | Logging blocked attempt failed |
| `[ANALYZE_TRAFFIC_FAILURE]` | trafficController.js | General analysis failure |

### Error Types

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| Validation Error | 400 | Missing required fields |
| Blocked IP | 403 | Source IP is blocked |
| Prediction Failure | 502 | ML API unavailable |
| Server Error | 500 | Internal error |

### Prediction Error Classification

```javascript
// In predictionService.js
if (error.code === 'ECONNABORTED') {
  errorType = 'TIMEOUT';       // Request timed out (5s)
} else if (error.response) {
  errorType = 'HTTP_ERROR';    // Non-2xx response
} else if (error.request) {
  errorType = 'NETWORK_ERROR'; // No response received
} else {
  errorType = 'UNKNOWN_ERROR'; // Other errors
}
```

---

## 15. Setup & Installation

### Prerequisites

- Node.js 18+ (LTS recommended)
- Python 3.10+
- Supabase account (free tier works)

### Step 1: Clone/Setup Workspace

```bash
cd "D:\D Drive Backup\sem 4\EDI\ML model - Copy"
```

### Step 2: Install Node.js Dependencies

```bash
cd ids-platform
npm install
```

### Step 3: Install Python Dependencies

```bash
pip install flask flask-cors joblib pandas scikit-learn numpy
```

### Step 4: Configure Supabase

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the contents of `supabase_schema.sql`
4. Copy your project URL and service role key

### Step 5: Configure Environment

```bash
copy .env.example .env
# Edit .env with your values
```

---

## 16. Configuration

### Environment Variables (.env)

```env
# Server
PORT=3000

# Python ML API
PYTHON_API_URL=http://localhost:5000/predict

# Backend URL (for simulation service)
BACKEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Session
SESSION_SECRET=your-random-secret-key

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Important Notes

- `SUPABASE_SERVICE_ROLE_KEY` has full database access - keep it secret
- `SESSION_SECRET` should be a long random string in production
- `ADMIN_PASSWORD` can be replaced with `ADMIN_PASSWORD_HASH` for bcrypt hash

---

## 17. Running the Application

### Step 1: Start Python ML API

```bash
cd "D:\D Drive Backup\sem 4\EDI\ML model - Copy"
python app/api/prediction_api.py
```

Expected output:
```
 * Serving Flask app 'prediction_api'
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
```

### Step 2: Start Node.js Backend

```bash
cd ids-platform
npm start
```

Expected output:
```
IDS Platform server running on http://localhost:3000
```

### Step 3: Access Dashboard

1. Open browser: `http://localhost:3000`
2. Login with admin credentials (default: `admin` / `admin123`)
3. View dashboard

### Step 4: Trigger Simulation (Optional)

Using curl:
```bash
curl -X POST http://localhost:3000/simulate-traffic ^
  -H "Content-Type: application/json" ^
  -d "{\"limit\": 100, \"delayMs\": 200}"
```

Or use the `/simulate-traffic` endpoint after logging in.

---

## 18. Testing the System

### Test 1: Health Check (Python API)

```bash
curl http://localhost:5000/health
```

Expected:
```json
{"status": "ok"}
```

### Test 2: Manual Traffic Analysis

```bash
curl -X POST http://localhost:3000/analyze-traffic ^
  -H "Content-Type: application/json" ^
  -d "{\"src_ip\": \"192.168.1.100\", \"dest_ip\": \"10.0.0.1\", \"dest_port\": 80, \"features\": {...78 features...}}"
```

### Test 3: Verify Dashboard Updates

1. Send a few `/analyze-traffic` requests
2. Refresh dashboard at `/`
3. Verify:
   - Total traffic count increased
   - If attacks detected, attack count increased
   - Charts show new data points
   - Recent attacks table updated (if attacks)
   - Blocked IPs table updated (if attacks)

### Test 4: Defense Simulation

1. Send an attack flow from IP `X`
2. Verify IP `X` appears in blocked_ips
3. Send another flow from IP `X`
4. Verify:
   - Response is `403 { status: 'blocked' }`
   - Traffic logged with label `BLOCKED_IP`

### Test 5: Prediction Failure Handling

1. Stop the Python ML API
2. Send a `/analyze-traffic` request
3. Verify:
   - Response is `502 { error: 'Prediction service unavailable' }`
   - No traffic_log entry created (prediction-first)

---

## Appendix A: Sample Traffic Payload

```json
{
  "src_ip": "192.168.1.100",
  "dest_ip": "10.0.0.1",
  "src_port": 54321,
  "dest_port": 80,
  "protocol": "TCP",
  "features": {
    "Destination Port": 80,
    "Flow Duration": 5000,
    "Total Fwd Packets": 10,
    "Total Backward Packets": 8,
    "Total Length of Fwd Packets": 1200,
    "Total Length of Bwd Packets": 900,
    "Fwd Packet Length Max": 150,
    "Fwd Packet Length Min": 60,
    "Fwd Packet Length Mean": 120,
    "Fwd Packet Length Std": 30,
    "Bwd Packet Length Max": 140,
    "Bwd Packet Length Min": 50,
    "Bwd Packet Length Mean": 112.5,
    "Bwd Packet Length Std": 28,
    "Flow Bytes/s": 300000,
    "Flow Packets/s": 500,
    "Flow IAT Mean": 1000,
    "Flow IAT Std": 200,
    "Flow IAT Max": 2000,
    "Flow IAT Min": 100,
    "Fwd IAT Total": 4500,
    "Fwd IAT Mean": 500,
    "Fwd IAT Std": 100,
    "Fwd IAT Max": 800,
    "Fwd IAT Min": 200,
    "Bwd IAT Total": 4000,
    "Bwd IAT Mean": 571,
    "Bwd IAT Std": 120,
    "Bwd IAT Max": 900,
    "Bwd IAT Min": 150,
    "Fwd PSH Flags": 1,
    "Bwd PSH Flags": 0,
    "Fwd URG Flags": 0,
    "Bwd URG Flags": 0,
    "Fwd Header Length": 320,
    "Bwd Header Length": 256,
    "Fwd Packets/s": 2000,
    "Bwd Packets/s": 1600,
    "Min Packet Length": 50,
    "Max Packet Length": 150,
    "Packet Length Mean": 116.67,
    "Packet Length Std": 29.5,
    "Packet Length Variance": 870.25,
    "FIN Flag Count": 0,
    "SYN Flag Count": 1,
    "RST Flag Count": 0,
    "PSH Flag Count": 1,
    "ACK Flag Count": 1,
    "URG Flag Count": 0,
    "CWE Flag Count": 0,
    "ECE Flag Count": 0,
    "Down/Up Ratio": 0.8,
    "Average Packet Size": 116.67,
    "Avg Fwd Segment Size": 120,
    "Avg Bwd Segment Size": 112.5,
    "Fwd Header Length.1": 320,
    "Fwd Avg Bytes/Bulk": 0,
    "Fwd Avg Packets/Bulk": 0,
    "Fwd Avg Bulk Rate": 0,
    "Bwd Avg Bytes/Bulk": 0,
    "Bwd Avg Packets/Bulk": 0,
    "Bwd Avg Bulk Rate": 0,
    "Subflow Fwd Packets": 10,
    "Subflow Fwd Bytes": 1200,
    "Subflow Bwd Packets": 8,
    "Subflow Bwd Bytes": 900,
    "Init_Win_bytes_forward": 8192,
    "Init_Win_bytes_backward": 65535,
    "act_data_pkt_fwd": 5,
    "min_seg_size_forward": 20,
    "Active Mean": 100,
    "Active Std": 20,
    "Active Max": 150,
    "Active Min": 50,
    "Idle Mean": 500,
    "Idle Std": 100,
    "Idle Max": 800,
    "Idle Min": 200
  }
}
```

---

## Appendix B: Troubleshooting

| Problem | Possible Cause | Solution |
|---------|----------------|----------|
| "Invalid supabaseUrl" error | Empty/invalid SUPABASE_URL | Check `.env` file |
| EJS syntax errors | Template parsing issues | Check for unmatched `<%` tags |
| 502 on /analyze-traffic | Python API not running | Start `prediction_api.py` |
| Dashboard shows 0s | Supabase tables empty | Run simulation or send traffic |
| Login fails | Wrong credentials | Check ADMIN_USERNAME/PASSWORD |
| CORS errors | Missing CORS middleware | Verify `cors()` in server.js |

---

## Appendix C: Future Enhancements

1. **WebSocket Real-Time Updates**: Push dashboard updates via Socket.io
2. **Multi-Class Attack Detection**: Classify specific attack types (DDoS, PortScan, etc.)
3. **User Management**: Multiple admin accounts with roles
4. **Email Alerts**: Notify admins of critical attacks
5. **IP Whitelist**: Allow certain IPs to bypass blocking
6. **Attack Patterns**: ML-based pattern recognition across time
7. **Export Reports**: PDF/CSV export of attack logs
8. **API Rate Limiting**: Prevent abuse of analysis endpoint
9. **Docker Deployment**: Containerized setup for easy deployment
10. **Kubernetes Scaling**: Horizontal scaling for high traffic

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Author**: AI Cybersecurity IDS Platform Team

