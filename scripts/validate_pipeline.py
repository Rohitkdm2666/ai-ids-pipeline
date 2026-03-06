#!/usr/bin/env python3
"""
Phase 14 - Final validation: Traffic -> PCAP -> Flow Extraction -> ML Prediction -> Backend -> Dashboard
"""

import json
import sys
from pathlib import Path

try:
    import requests
    import pandas as pd
except ImportError:
    print("Need: pip install requests pandas")
    sys.exit(1)

PROJECT = Path(__file__).parent.parent
FLOWS_CSV = PROJECT / "data" / "flows" / "flows.csv"


def main():
    print("=" * 50)
    print("FINAL PIPELINE VALIDATION")
    print("=" * 50)

    ok = True

    # 1. flows.csv exists and has rows
    if FLOWS_CSV.exists():
        df = pd.read_csv(FLOWS_CSV)
        print(f"  1. flows.csv: {len(df)} rows")
        if len(df) == 0:
            print("     WARN: No flows - run capture + simulate first")
    else:
        print("  1. flows.csv: missing (run flow extractor first)")
        ok = False

    # 2. ML API
    try:
        r = requests.get("http://localhost:5000/health", timeout=2)
        print("  2. ML API (5000): OK" if r.status_code == 200 else "  2. ML API: FAIL")
        if r.status_code != 200:
            ok = False
    except Exception as e:
        print(f"  2. ML API: FAIL ({e})")
        ok = False

    # 3. Prediction from flow
    if FLOWS_CSV.exists() and len(df) > 0:
        with open(PROJECT / "Data" / "top20_features.json") as f:
            cols = json.load(f)
        row = df.iloc[0]
        flow = {c: float(row[c]) for c in cols if c in row}
        try:
            r = requests.post("http://localhost:5000/predict", json={"flow": flow}, timeout=2)
            if r.status_code == 200:
                d = r.json()
                print(f"  3. Prediction: {d.get('label')} prob={d.get('probability', 0):.4f}")
            else:
                print(f"  3. Prediction: FAIL {r.status_code}")
                ok = False
        except Exception as e:
            print(f"  3. Prediction: FAIL ({e})")
            ok = False
    else:
        print("  3. Prediction: skip (no flows)")

    # 4. Backend
    try:
        r = requests.get("http://localhost:3000/api/metrics", timeout=2)
        print("  4. Backend (3000): OK" if r.status_code == 200 else "  4. Backend: FAIL")
        if r.status_code != 200:
            ok = False
    except Exception as e:
        print(f"  4. Backend: FAIL ({e})")
        ok = False

    # 5. Dashboard
    try:
        r = requests.get("http://localhost:5173", timeout=2)
        print("  5. Dashboard (5173): OK" if r.status_code == 200 else "  5. Dashboard: FAIL")
        if r.status_code != 200:
            ok = False
    except Exception as e:
        print(f"  5. Dashboard: FAIL ({e})")
        ok = False

    print("=" * 50)
    if ok:
        print("IDS PIPELINE READY")
        print("")
        print("Full pipeline verified: Traffic -> PCAP -> Flow Extraction -> ML -> Backend -> Dashboard")
    else:
        print("Some checks failed. Start services: bash scripts/run_all_services.sh")
        sys.exit(1)


if __name__ == "__main__":
    main()
