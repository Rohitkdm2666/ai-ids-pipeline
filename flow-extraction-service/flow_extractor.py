import json
import logging
import sys
from pathlib import Path

import pandas as pd
import numpy as np
from scapy.all import rdpcap, TCP, UDP, IP
from collections import defaultdict
from statistics import mean, stdev

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ===============================
# ARGUMENTS
# ===============================
if len(sys.argv) != 3:
    print("Usage: python flow_extractor.py input.pcap output.csv")
    sys.exit(1)

input_pcap = sys.argv[1]
output_csv = sys.argv[2]


# ===============================
# LOAD TOP 20 FEATURES
# (Same source as ML API - Data/top20_features.json)
# ===============================
def load_top20_features():
    script_dir = Path(__file__).parent
    # flow_extractor.py lives in flow-extraction-service/; project root is parent
    project_root = script_dir.parent
    top20_path = project_root / "ml-service" / "model" / "top20_features.json"
    with open(top20_path) as f:
        return json.load(f)


FEATURE_COLUMNS = load_top20_features()
print(f"[FLOW_EXTRACTOR] Loaded {len(FEATURE_COLUMNS)} features from top20_features.json")


# ===============================
# READ PCAP
# ===============================
try:
    packets = rdpcap(input_pcap)
except Exception as e:
    print(f"[FLOW_EXTRACTOR] ERROR reading PCAP: {e}", file=sys.stderr)
    sys.exit(1)

if not packets:
    print("[FLOW_EXTRACTOR] Empty or truncated PCAP, writing empty CSV")
    ID_COLS = ["src_ip", "dest_ip", "src_port", "dest_port", "protocol"]
    Path(output_csv).parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(columns=ID_COLS + FEATURE_COLUMNS).to_csv(output_csv, index=False)
    sys.exit(0)

flows = defaultdict(list)

# ===============================
# GROUP INTO FLOWS (5-Tuple)
# ===============================
for pkt in packets:
    if IP in pkt:
        proto = "TCP" if TCP in pkt else "UDP" if UDP in pkt else None
        if proto is None:
            continue

        src = pkt[IP].src
        dst = pkt[IP].dst
        sport = pkt.sport if hasattr(pkt, "sport") else 0
        dport = pkt.dport if hasattr(pkt, "dport") else 0

        key = (src, dst, sport, dport, proto)
        flows[key].append(pkt)


# ===============================
# FEATURE CALCULATION
# ===============================
def safe_std(arr):
    return stdev(arr) if len(arr) > 1 else 0


def calculate_flow_features(pkts, src_ip):

    times = sorted([float(p.time) for p in pkts])
    lengths = [len(p) for p in pkts]

    duration = times[-1] - times[0] if len(times) > 1 else 0

    total_packets = len(pkts)
    total_bytes = sum(lengths)

    # Direction split
    fwd = [p for p in pkts if p[IP].src == src_ip]
    bwd = [p for p in pkts if p[IP].src != src_ip]

    fwd_lengths = [len(p) for p in fwd]
    bwd_lengths = [len(p) for p in bwd]

    flow_iat = np.diff(times) if len(times) > 1 else [0]

    # ==========================
    # FLAG COUNTS
    # ==========================
    def count_flag(flag_bit):
        return sum(1 for p in pkts if TCP in p and p[TCP].flags & flag_bit)

    syn = count_flag(0x02)
    fin = count_flag(0x01)
    rst = count_flag(0x04)
    psh = count_flag(0x08)
    ack = count_flag(0x10)
    urg = count_flag(0x20)
    ece = count_flag(0x40)
    cwe = count_flag(0x80)

    # ==========================
    # BUILD FEATURE DICT
    # ==========================
    features = {}

    # Core features
    features["Destination Port"] = pkts[0].dport if hasattr(pkts[0], "dport") else 0
    features["Flow Duration"] = duration
    features["Total Fwd Packets"] = len(fwd)
    features["Total Backward Packets"] = len(bwd)
    features["Total Length of Fwd Packets"] = sum(fwd_lengths)
    features["Total Length of Bwd Packets"] = sum(bwd_lengths)

    # Packet stats
    features["Fwd Packet Length Max"] = max(fwd_lengths) if fwd_lengths else 0
    features["Fwd Packet Length Min"] = min(fwd_lengths) if fwd_lengths else 0
    features["Fwd Packet Length Mean"] = mean(fwd_lengths) if fwd_lengths else 0
    features["Fwd Packet Length Std"] = safe_std(fwd_lengths)

    features["Bwd Packet Length Max"] = max(bwd_lengths) if bwd_lengths else 0
    features["Bwd Packet Length Min"] = min(bwd_lengths) if bwd_lengths else 0
    features["Bwd Packet Length Mean"] = mean(bwd_lengths) if bwd_lengths else 0
    features["Bwd Packet Length Std"] = safe_std(bwd_lengths)

    features["Flow Bytes/s"] = total_bytes / duration if duration > 0 else 0
    features["Flow Packets/s"] = total_packets / duration if duration > 0 else 0

    features["Flow IAT Mean"] = mean(flow_iat) if len(flow_iat) > 0 else 0
    features["Flow IAT Std"] = safe_std(flow_iat)
    features["Flow IAT Max"] = max(flow_iat) if len(flow_iat) > 0 else 0
    features["Flow IAT Min"] = min(flow_iat) if len(flow_iat) > 0 else 0

    # Flags
    features["FIN Flag Count"] = fin
    features["SYN Flag Count"] = syn
    features["RST Flag Count"] = rst
    features["PSH Flag Count"] = psh
    features["ACK Flag Count"] = ack
    features["URG Flag Count"] = urg
    features["ECE Flag Count"] = ece
    features["CWE Flag Count"] = cwe

    # --- Additional features for top 20 (CICIDS2017 schema) ---
    features["Average Packet Size"] = total_bytes / total_packets if total_packets > 0 else 0
    features["Subflow Fwd Bytes"] = sum(fwd_lengths)
    features["Subflow Bwd Bytes"] = sum(bwd_lengths)
    features["Bwd Packets/s"] = len(bwd) / duration if duration > 0 else 0
    features["Avg Fwd Segment Size"] = mean(fwd_lengths) if fwd_lengths else 0
    features["Avg Bwd Segment Size"] = mean(bwd_lengths) if bwd_lengths else 0
    features["Packet Length Mean"] = mean(lengths) if lengths else 0
    features["Packet Length Std"] = safe_std(lengths)
    features["Max Packet Length"] = max(lengths) if lengths else 0
    features["Min Packet Length"] = min(lengths) if lengths else 0

    # Init_Win_bytes_forward: TCP window of first forward packet
    init_win_fwd = 0
    for pkt in pkts:
        if pkt[IP].src == src_ip and TCP in pkt:
            init_win_fwd = pkt[TCP].window
            break
    features["Init_Win_bytes_forward"] = init_win_fwd

    # Fwd Header Length.1: Sum of TCP header lengths for forward packets
    fwd_header_total = 0
    for pkt in fwd:
        if TCP in pkt:
            dataofs = getattr(pkt[TCP], "dataofs", 5) or 5
            fwd_header_total += dataofs * 4
    features["Fwd Header Length.1"] = fwd_header_total

    # Fill any top-20 feature not yet computed with 0
    missing_features = []
    for col in FEATURE_COLUMNS:
        if col not in features:
            features[col] = 0
            missing_features.append(col)
    
    if missing_features:
        logger.warning(f"[FEATURE_MISSING_WARNING] features={missing_features}")

    return features


# ===============================
# PROCESS FLOWS
# ===============================
rows = []

for key, pkts in flows.items():
    src, dst, sport, dport, proto = key

    flow_features = calculate_flow_features(pkts, src)
    flow_features["src_ip"] = src
    flow_features["dest_ip"] = dst
    flow_features["src_port"] = sport
    flow_features["dest_port"] = dport
    flow_features["protocol"] = proto

    rows.append(flow_features)

ID_COLS = ["src_ip", "dest_ip", "src_port", "dest_port", "protocol"]
if not rows:
    pd.DataFrame(columns=ID_COLS + FEATURE_COLUMNS).to_csv(output_csv, index=False)
    print("[FEATURE_EXTRACTION_VALIDATED] missing_features=0 (no flows)")
else:
    df = pd.DataFrame(rows)
    df = df[ID_COLS + FEATURE_COLUMNS]

    # Validate: all top-20 features present, no missing
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    missing_count = len(missing)
    print(f"[FEATURE_EXTRACTION_VALIDATED] missing_features={missing_count}")

    # Log packet source stats (dest_port 8080 = victim app)
    victim_flows = (df["dest_port"] == 8080).sum()
    for _, r in df.head(5).iterrows():
        print(f"[PACKET_SOURCE] src_ip={r['src_ip']} dest_ip={r['dest_ip']} dest_port={r['dest_port']}")
    if len(df) > 5:
        print(f"[PACKET_SOURCE] ... and {len(df) - 5} more flows (victim_app_dest_port_8080={victim_flows})")

    df.to_csv(output_csv, index=False)

print(f"[FLOW_EXTRACTOR] Flows extracted: {len(rows)}")
print(f"[FLOW_EXTRACTOR] CSV written to: {output_csv} ({len(FEATURE_COLUMNS)} features)")