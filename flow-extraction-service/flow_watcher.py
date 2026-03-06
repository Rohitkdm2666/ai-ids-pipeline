#!/usr/bin/env python3
"""
Flow Extraction Daemon - watches data/pcap/, runs flow_extractor.py on stable files.
Processes PCAP only after file size is stable for several seconds.
Outputs to data/flows/flows.csv (appends or overwrites per run).
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
PCAP_DIR = PROJECT_ROOT / "data" / "pcap"
FLOWS_DIR = PROJECT_ROOT / "data" / "flows"
FLOWS_CSV = FLOWS_DIR / "flows.csv"
STABILITY_SECONDS = float(os.environ.get("PCAP_STABILITY_SECONDS", "3"))
CHECK_INTERVAL = float(os.environ.get("PCAP_CHECK_INTERVAL", "1"))

processed = set()
pending = {}  # path -> (mtime, size, stable_since)


def load_top20():
    path = PROJECT_ROOT / "Data" / "top20_features.json"
    with open(path) as f:
        return json.load(f)


def run_flow_extractor(pcap_path: Path) -> Path:
    """Run flow_extractor.py on pcap, return output CSV path."""
    csv_path = FLOWS_DIR / (pcap_path.stem + ".csv")
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)
    import subprocess
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "flow_extractor.py"), str(pcap_path), str(csv_path)],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        logger.error("[FLOW_EXTRACTION_ERROR] %s: %s", pcap_path, result.stderr)
        raise RuntimeError(f"flow_extractor failed: {result.stderr}")
    return csv_path


ID_COLS = ["src_ip", "dest_ip", "src_port", "dest_port", "protocol"]


def merge_flows_into_main(csv_path: Path) -> "pd.DataFrame":
    """Merge extracted flows into flows.csv. Returns the new rows df."""
    import pandas as pd
    FEATURES = load_top20()
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        logger.warning("[FLOW_MERGE_SKIP] %s: %s", csv_path, e)
        return pd.DataFrame()
    if df.empty:
        return pd.DataFrame()
    # Ensure feature columns
    missing = [c for c in FEATURES if c not in df.columns]
    for c in missing:
        df[c] = 0
    all_cols = [c for c in (ID_COLS + FEATURES) if c in df.columns]
    df = df[all_cols]
    if FLOWS_CSV.exists():
        existing = pd.read_csv(FLOWS_CSV)
        combined = pd.concat([existing, df], ignore_index=True)
    else:
        combined = df
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)
    combined.to_csv(FLOWS_CSV, index=False)
    logger.info("[FLOW_EXTRACTION_COMPLETE] pcap=%s flows=%d total_rows=%d", csv_path.stem, len(df), len(combined))
    return df


def send_flow_to_backend(row: "pd.Series") -> bool:
    """POST flow to backend /analyze-traffic."""
    import requests
    backend_url = os.environ.get("IDS_BACKEND_URL", "http://localhost:3000")
    url = f"{backend_url}/analyze-traffic"
    FEATURES = load_top20()
    features = {c: float(row.get(c, 0)) for c in FEATURES}
    payload = {
        "src_ip": str(row.get("src_ip", "0.0.0.0")),
        "dest_ip": str(row.get("dest_ip", "0.0.0.0")),
        "src_port": int(row.get("src_port", 0)),
        "dest_port": int(row.get("dest_port", 0)),
        "protocol": str(row.get("protocol", "TCP")),
        "features": features,
        "metadata": {"traffic_source": "PCAP_FLOW", "source": "flow-extraction-service"},
    }
    try:
        logger.info("[FLOW_SENT_TO_BACKEND] src_ip=%s dest_ip=%s dest_port=%s", payload["src_ip"], payload["dest_ip"], payload["dest_port"])
        r = requests.post(url, json=payload, timeout=10, headers={"X-API-Key": os.environ.get("IDS_API_KEY", "ids-internal-key")})
        if r.status_code in (200, 201, 403):
            if r.status_code == 200 and r.json().get("is_attack"):
                logger.info("[ALERT_CREATED] src=%s dest=%s prediction=%s", payload["src_ip"], payload["dest_ip"], r.json().get("label"))
            return True
        logger.warning("[BACKEND_POST_FAIL] status=%s %s", r.status_code, r.text[:200])
        return False
    except Exception as e:
        logger.warning("[BACKEND_POST_ERROR] %s", e)
        return False


def process_pcap(path: Path):
    if str(path) in processed:
        return
    try:
        if path.stat().st_size == 0:
            logger.warning("[PCAP_EMPTY] %s", path)
            processed.add(str(path))
            return
        csv_path = run_flow_extractor(path)
        df = merge_flows_into_main(csv_path)
        processed.add(str(path))
        if df is not None and not df.empty:
            for _, row in df.iterrows():
                try:
                    send_flow_to_backend(row)
                except Exception as e:
                    logger.warning("[BACKEND_SEND_ERROR] %s", e)
    except Exception as e:
        logger.exception("[FLOW_EXTRACTION_ERROR] %s: %s", path, e)


def watch():
    PCAP_DIR.mkdir(parents=True, exist_ok=True)
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("[FLOW_WATCHER_STARTED] pcap_dir=%s flows_csv=%s stability_sec=%.1f", PCAP_DIR, FLOWS_CSV, STABILITY_SECONDS)

    while True:
        try:
            if not PCAP_DIR.exists():
                time.sleep(CHECK_INTERVAL)
                continue
            for f in sorted(PCAP_DIR.glob("*.pcap")):
                fp = str(f)
                if fp in processed:
                    continue
                try:
                    stat = f.stat()
                    mtime, size = stat.st_mtime, stat.st_size
                except OSError:
                    continue
                key = fp
                if key not in pending:
                    pending[key] = (mtime, size, time.time())
                else:
                    old_mtime, old_size, stable_since = pending[key]
                    if mtime == old_mtime and size == old_size and size > 0:
                        if time.time() - stable_since >= STABILITY_SECONDS:
                            process_pcap(f)
                            del pending[key]
                    else:
                        pending[key] = (mtime, size, time.time())
        except Exception as e:
            logger.exception("[WATCHER_ERROR] %s", e)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    watch()
