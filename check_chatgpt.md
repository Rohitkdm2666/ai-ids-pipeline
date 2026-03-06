# AI-Based Cyber Attack Prediction and Defense System

## Top 20 Feature-Optimized Pipeline Documentation

---

## 1. Project Overview

This system is an **AI-Based Cyber Attack Prediction and Defense System** that uses machine learning to detect network intrusions in real-time. It combines:

- **Flow extraction** from PCAP files (packet captures)
- **Random Forest classification** trained on CICIDS2017 dataset
- **REST API** for real-time prediction
- **Top 20 feature optimization** for improved efficiency and production readiness

The pipeline processes network flows, extracts statistical features, and classifies them as **NORMAL** or **ATTACK** with an associated probability and severity level.

---

## 2. Old Pipeline Architecture

### Before Refactoring

| Component | Behavior |
|-----------|----------|
| **Feature Schema** | Loaded all 78 columns from `CICIDS2017_Processed.csv` header |
| **Model** | RandomForest trained on full 78 features |
| **Flow Extractor** | Extracted ~27 computed features, filled remaining with 0 |
| **Prediction API** | Validated incoming flow against all 78 features |
| **Scaler** | Fitted on 78-dimensional data |

### Limitations of Old Pipeline

- **High dimensionality**: 78 features increased training/inference time
- **Redundant features**: Many features contributed little to prediction
- **Schema coupling**: Feature list hardcoded to dataset CSV
- **Extractor gaps**: Many features were always 0 (never computed from packets)

---

## 3. New Top-20 Optimized Pipeline

### Architecture After Refactoring

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  PCAP File      │────▶│ flow_extractor   │────▶│ output.csv      │
│  (packets)      │     │ (20 features)    │     │ (top 20 cols)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Prediction     │◀────│ Data/            │     │ POST /predict   │
│  API Response   │     │ top20_features   │     │ (flow JSON)     │
└─────────────────┘     │ .json            │     └────────┬────────┘
                        └──────────────────┘              │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ Trained Models/  │     │ Scaler + Model  │
                        │ Models/          │────▶│ (20 features)   │
                        │ - model.pkl      │     └─────────────────┘
                        │ - scaler.pkl     │
                        │ - top20_features │
                        │   .pkl           │
                        └──────────────────┘
```

### Key Changes

| Component | New Behavior |
|-----------|--------------|
| **Feature Schema** | Loaded from `Data/top20_features.json` (single source of truth) |
| **Model** | RandomForest trained on top 20 features only |
| **Flow Extractor** | Computes full feature set, outputs only top 20 in correct order |
| **Prediction API** | Validates flow has exactly the 20 required features |
| **Scaler** | Fitted on 20-dimensional data |

---

## 4. Feature Selection Method

### Algorithm

1. Load `CICIDS2017_Processed.csv`
2. Separate **X** (all columns except `Label`) and **y** (`Label`)
3. Split train/test (80/20, stratified)
4. Apply `StandardScaler` to training data
5. Train a temporary `RandomForestClassifier` (n_estimators=100, random_state=42)
6. Extract `feature_importances_` from the trained model
7. Rank features by importance (descending)
8. Select the **top 20** features
9. Save to `Data/top20_features.json`

### Why Random Forest Feature Importance?

- **Tree-based**: Naturally handles non-linear relationships
- **Interpretable**: Each feature gets a scalar importance score
- **Fast**: No need for iterative wrapper methods
- **Robust**: Stable across different random seeds for this dataset size

### Top 20 Features (Current Ranking)

| Rank | Feature Name              | Importance |
|------|---------------------------|------------|
| 1    | Fwd Packet Length Max     | 0.0642     |
| 2    | Average Packet Size       | 0.0583     |
| 3    | Subflow Fwd Bytes         | 0.0573     |
| 4    | Fwd Packet Length Mean    | 0.0569     |
| 5    | Bwd Packets/s             | 0.0473     |
| 6    | Avg Fwd Segment Size      | 0.0472     |
| 7    | Packet Length Std         | 0.0414     |
| 8    | Total Length of Fwd Packets | 0.0404   |
| 9    | Max Packet Length         | 0.0376     |
| 10   | Init_Win_bytes_forward    | 0.0357     |
| 11   | PSH Flag Count            | 0.0312     |
| 12   | Bwd Packet Length Max     | 0.0305     |
| 13   | Packet Length Mean        | 0.0254     |
| 14   | Fwd Header Length.1       | 0.0252     |
| 15   | Avg Bwd Segment Size      | 0.0238     |
| 16   | Subflow Bwd Bytes         | 0.0235     |
| 17   | Bwd Packet Length Mean    | 0.0228     |
| 18   | Bwd Packet Length Std     | 0.0218     |
| 19   | ACK Flag Count            | 0.0210     |
| 20   | Total Fwd Packets         | 0.0202     |

---

## 5. Model Performance Metrics

### Top 20 Random Forest (Test Set)

| Metric     | Value   |
|------------|---------|
| **Accuracy**  | 99.90%  |
| **Precision** | 99.90%  |
| **Recall**    | 99.80%  |
| **F1 Score**  | 99.85%  |

### Confusion Matrix

```
                 Predicted
                 NORMAL  ATTACK
Actual NORMAL    119144      55
       ATTACK       117   57640
```

### Interpretation

- Very high accuracy with only 20 features (vs 78)
- Minimal loss compared to full-feature model
- Low false positive and false negative rates

---

## 6. Why Top 20 is Beneficial

| Benefit | Description |
|---------|-------------|
| **Faster inference** | 20 features vs 78 → ~3.9× fewer dimensions to scale and evaluate |
| **Smaller model** | Fewer trees need to split on fewer features → smaller .pkl file |
| **Simpler flow extraction** | Extractor computes fewer unique features; many map to existing calculations |
| **Reduced overfitting risk** | Fewer dimensions → less chance of fitting noise |
| **Easier maintenance** | Single JSON file defines schema; no hardcoded column lists |
| **Production-ready** | Lower latency, less memory, clearer validation logic |

---

## 7. Future Feature Updates

### How to Change the Feature Set

1. **Modify top 20 selection**
   - Run `python scripts/select_top20_features.py` (edit `head(20)` to `head(N)` if desired)
   - New `Data/top20_features.json` is written automatically

2. **Retrain the model**
   - Run `python scripts/train_top20_model.py`
   - New model, scaler, and `top20_features.pkl` saved to `Trained Models/Models/`

3. **No code changes required**
   - `prediction_api.py` and `flow_extractor.py` load features from `top20_features.json`
   - As long as the flow extractor can compute the features (or use 0), the pipeline stays consistent

### Adding New Features to Flow Extractor

If a new top feature requires computation not yet in `flow_extractor.py`:

1. Add the feature calculation in `calculate_flow_features()`
2. Ensure the feature name matches exactly the key in `top20_features.json`
3. Re-run flow extraction and prediction tests

---

## 8. Folder Structure

```
ai-ids-pipeline/
├── Data/
│   ├── Processed Data/
│   │   └── CICIDS2017_Processed.csv    # Full dataset (78 features + Label)
│   └── top20_features.json             # Top 20 feature names (single source of truth)
│
├── Trained Models/
│   ├── Models/
│   │   ├── ids_random_forest_model.pkl # RandomForest (20 features)
│   │   ├── scaler.pkl                  # StandardScaler (20 features)
│   │   └── top20_features.pkl          # Pickled list of feature names
│   ├── train_and_evaluate_RF.py        # Legacy full-feature training
│   └── ...
│
├── app/
│   ├── api/
│   │   └── prediction_api.py           # Flask REST API (loads top20 from JSON)
│   └── ids_prediction_system.py        # Standalone prediction demo
│
├── flow-extraction-service/
│   └── flow_extractor.py               # PCAP → CSV (top 20 columns)
│
├── scripts/
│   ├── select_top20_features.py        # Feature selection → top20_features.json
│   ├── train_top20_model.py            # Train model on top 20
│   └── test_e2e.py                     # End-to-end test
│
├── check_chatgpt.md                    # This documentation
└── ...
```

---

## 9. How to Run the Full System in One Command

### Option A: Sequential (Recommended for first run)

```bash
# 1. Activate environment
cd /path/to/ai-ids-pipeline
source venv/bin/activate   # or: .\venv\Scripts\activate on Windows

# 2. Feature selection (if not already done)
python scripts/select_top20_features.py

# 3. Train model
python scripts/train_top20_model.py

# 4. Extract flows from PCAP
python flow-extraction-service/flow_extractor.py input.pcap output.csv

# 5. Start prediction API
python app/api/prediction_api.py
```

### Option B: Single Script (Bash)

```bash
cd /path/to/ai-ids-pipeline && source venv/bin/activate && \
python scripts/select_top20_features.py && \
python scripts/train_top20_model.py && \
python flow-extraction-service/flow_extractor.py test.pcap /tmp/flows.csv && \
python app/api/prediction_api.py
```

### Option C: Docker / Systemd

Integrate the above commands into your deployment pipeline. The API listens on `0.0.0.0:5000` by default.

---

## 10. Example API Request & Response

### Request

```http
POST /predict HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "flow": {
    "Fwd Packet Length Max": 1500,
    "Average Packet Size": 256.5,
    "Subflow Fwd Bytes": 12000,
    "Fwd Packet Length Mean": 512.0,
    "Bwd Packets/s": 50.0,
    "Avg Fwd Segment Size": 512.0,
    "Packet Length Std": 128.3,
    "Total Length of Fwd Packets": 12000,
    "Max Packet Length": 1500,
    "Init_Win_bytes_forward": 65535,
    "PSH Flag Count": 5,
    "Bwd Packet Length Max": 1200,
    "Packet Length Mean": 256.5,
    "Fwd Header Length.1": 100,
    "Avg Bwd Segment Size": 400.0,
    "Subflow Bwd Bytes": 8000,
    "Bwd Packet Length Mean": 400.0,
    "Bwd Packet Length Std": 80.2,
    "ACK Flag Count": 12,
    "Total Fwd Packets": 24
  }
}
```

### Response (200 OK)

```json
{
  "prediction": 0,
  "is_attack": false,
  "label": "NORMAL TRAFFIC",
  "probability": 0.03,
  "severity": "low"
}
```

### Response (400 Bad Request - Missing Features)

```json
{
  "error": "Missing required features",
  "missing_features": ["Fwd Packet Length Max", "Average Packet Size", ...]
}
```

### Severity Logic (Unchanged)

| Probability | Severity |
|-------------|----------|
| ≥ 0.9       | critical |
| ≥ 0.7       | high     |
| ≥ 0.4       | medium   |
| < 0.4       | low      |

---

## 11. Viva Explanation Section

### Q: What is the purpose of this system?

**A:** This is an AI-based Intrusion Detection System (IDS) that analyzes network flows and classifies them as normal or malicious. It uses a Random Forest model trained on the CICIDS2017 benchmark dataset to predict attacks in real time.

### Q: Why did you reduce features from 78 to 20?

**A:** We used Random Forest feature importance to rank all 78 features. The top 20 capture most of the predictive power while reducing model complexity, inference time, and the amount of data the flow extractor must produce. This makes the system faster and easier to maintain.

### Q: How does feature selection work?

**A:** We train a Random Forest on the full dataset, then use the `feature_importances_` attribute. Each feature receives an importance score based on how much it reduces impurity (Gini) across the trees. We sort by this score and take the top 20.

### Q: What is the role of StandardScaler?

**A:** StandardScaler normalizes each feature to zero mean and unit variance. Random Forest is scale-invariant, but scaling is good practice for consistency and for any future model (e.g. SVM, neural nets) that might replace it.

### Q: How does the flow extractor map packets to features?

**A:** Packets are grouped into flows by 5-tuple (src IP, dst IP, src port, dst port, protocol). For each flow we compute statistics: packet counts, byte counts, lengths, inter-arrival times, TCP flags, window sizes, etc. These map directly to CICIDS2017 feature names.

### Q: What happens if a feature is missing in the API request?

**A:** The API validates that all 20 features from `top20_features.json` are present. If any are missing, it returns HTTP 400 with a list of missing features. No prediction is performed.

### Q: How would you extend this to support new attack types?

**A:** (1) Obtain labeled data for new attack types. (2) Add new labels to the dataset. (3) Retrain the model (multi-class instead of binary if needed). (4) Optionally re-run feature selection to see if new top features emerge. (5) Update `top20_features.json` and retrain if the feature set changes.

### Q: What are the main advantages of the top-20 pipeline?

**A:** Faster inference, smaller artifacts, simpler validation, single source of truth for features (`top20_features.json`), and easier updates when the feature set needs to change.

---

*Document generated as part of the Top 20 Pipeline Refactor. Last updated: March 2025.*
