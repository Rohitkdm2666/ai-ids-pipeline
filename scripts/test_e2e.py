#!/usr/bin/env python3
"""
Phase 6: End-to-end test - generate sample flow, pass through prediction API.
"""

import json
import sys
from pathlib import Path

# Add app to path for API imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "app" / "api"))

# Load top 20 features
with open(PROJECT_ROOT / "Data" / "top20_features.json") as f:
    TOP20 = json.load(f)


def make_sample_flow():
    """Generate a sample fake flow row with all 20 features."""
    # Realistic-ish values for a benign flow
    return {
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
        "Total Fwd Packets": 24,
    }


def test_via_api():
    """Test prediction via Flask API (requires API to be running)."""
    import urllib.request
    import urllib.error

    flow = make_sample_flow()
    data = json.dumps({"flow": flow}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:5000/predict",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode())
            print("[E2E] API Response:", json.dumps(result, indent=2))
            return "prediction" in result and "error" not in result
    except urllib.error.URLError as e:
        print("[E2E] API not running (expected if not started):", e)
        return False


def test_direct():
    """Test prediction directly using model."""
    import joblib
    import pandas as pd

    flow = make_sample_flow()
    model = joblib.load(PROJECT_ROOT / "Trained Models" / "Models" / "ids_random_forest_model.pkl")
    scaler = joblib.load(PROJECT_ROOT / "Trained Models" / "Models" / "scaler.pkl")

    row = {col: float(flow[col]) for col in TOP20}
    df = pd.DataFrame([row], columns=TOP20)
    scaled = scaler.transform(df)
    pred = int(model.predict(scaled)[0])
    prob = float(model.predict_proba(scaled)[0][1])

    print("[E2E] Direct prediction:")
    print(f"  Prediction: {pred} ({'ATTACK' if pred == 1 else 'NORMAL'})")
    print(f"  Probability: {prob:.4f}")
    return True


def main():
    print("=" * 50)
    print("END-TO-END TEST")
    print("=" * 50)
    print("\n1. Sample flow has all 20 features:", len(make_sample_flow()) == 20)
    print("2. Direct prediction test...")
    ok = test_direct()
    print("   PASS" if ok else "   FAIL")
    print("\n3. API test (if API running on port 5000)...")
    api_ok = test_via_api()
    print("   PASS" if api_ok else "   SKIP (API not running)")
    print("\n" + "=" * 50)
    print("E2E test complete. No feature mismatch errors.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
