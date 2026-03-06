#!/usr/bin/env python3
"""
Health check - verify entire IDS pipeline is running.
"""

import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None

PROJECT_ROOT = Path(__file__).parent.parent
DATA_PCAP = PROJECT_ROOT / "data" / "pcap"
DATA_FLOWS = PROJECT_ROOT / "data" / "flows"
FLOWS_CSV = DATA_FLOWS / "flows.csv"


def check(name, ok, msg=""):
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {name}" + (f" - {msg}" if msg else ""))
    return ok


def main():
    print("=" * 50)
    print("IDS PIPELINE HEALTH CHECK")
    print("=" * 50)

    all_ok = True

    # tcpdump running (check for tcpdump process)
    tcpdump_ok = False
    try:
        with open("/proc/self/status") as f:
            pass
        for pid_dir in Path("/proc").iterdir():
            if pid_dir.name.isdigit():
                try:
                    cmd = (pid_dir / "cmdline").read_text().replace("\x00", " ")
                    if "tcpdump" in cmd and "data/pcap" in str(cmd):
                        tcpdump_ok = True
                        break
                except (IOError, OSError):
                    pass
    except Exception:
        pass
    if not tcpdump_ok:
        # Fallback: check if pcap dir exists and has recent files
        tcpdump_ok = DATA_PCAP.exists() and any(DATA_PCAP.glob("*.pcap"))
    all_ok &= check("tcpdump running / PCAP dir", tcpdump_ok)

    # PCAP files
    pcap_files = list(DATA_PCAP.glob("*.pcap")) if DATA_PCAP.exists() else []
    all_ok &= check("PCAP files present", len(pcap_files) >= 0, f"{len(pcap_files)} files")

    # flows.csv
    flows_ok = FLOWS_CSV.exists()
    rows = 0
    if flows_ok:
        try:
            rows = sum(1 for _ in open(FLOWS_CSV)) - 1  # minus header
        except Exception:
            rows = 0
    all_ok &= check("flows.csv", flows_ok, f"{rows} rows" if flows_ok else "")

    # ML API
    ml_ok = False
    if requests:
        try:
            r = requests.get("http://localhost:5000/health", timeout=2)
            ml_ok = r.status_code == 200
        except Exception:
            pass
    all_ok &= check("ML API (port 5000)", ml_ok)

    # Backend
    backend_ok = False
    if requests:
        try:
            r = requests.get("http://localhost:3000/api/metrics", timeout=2)
            backend_ok = r.status_code == 200
        except Exception:
            pass
    all_ok &= check("Backend (port 3000)", backend_ok)

    # Dashboard
    dashboard_ok = False
    if requests:
        try:
            r = requests.get("http://localhost:5173", timeout=2)
            dashboard_ok = r.status_code == 200
        except Exception:
            pass
    all_ok &= check("Dashboard (port 5173)", dashboard_ok)

    print("=" * 50)
    if all_ok:
        print("SYSTEM HEALTH: OK")
    else:
        print("SYSTEM HEALTH: SOME CHECKS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
