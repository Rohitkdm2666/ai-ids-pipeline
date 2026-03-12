#!/usr/bin/env python3
"""
Attack Simulator - generates traffic against http://localhost:8000
that produces flow patterns detectable by the IDS (CICIDS-style attacks).

Simulates:
1. HTTP flood: 200 threads, 1000+ req/s
2. Rapid connection bursts: short repeated connections
3. Large payload bursts: variable large payloads (high Packet Length Std, Average Packet Size)

Target: http://localhost:8000
Traffic is captured by tcpdump (port 8000), extracted by flow_extractor,
sent to backend, and ML predictions appear on dashboard.
"""

import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

TARGET = "http://localhost:4000"
NUM_THREADS = 200
REQUESTS_PER_THREAD = 20  # 200 * 20 = 4000 requests total; minimal delay = flood
PAYLOAD_SIZES = [0, 500, 1000, 2000, 5000, 10000, 20000]  # Large payloads for variance
BURST_CYCLES = 5


def http_flood_worker(_):
    """Single-thread worker: rapid requests to trigger high packet rates."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD):
        try:
            requests.get(f"{TARGET}/", timeout=2)
            count += 1
        except Exception:
            pass
    return count


def large_payload_worker(_):
    """Worker with large random payloads - increases Packet Length Std, Average Packet Size."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD // 2):
        try:
            size = random.choice(PAYLOAD_SIZES)
            if size > 0:
                # POST with large body to generate larger packets
                payload = "x" * min(size, 10000)
                requests.post(
                    f"{TARGET}/api/comment",
                    json={"postId": "1", "content": payload, "author": "attacker"},
                    timeout=3,
                )
            else:
                requests.get(f"{TARGET}/", timeout=2)
            count += 1
        except Exception:
            pass
    return count


def main():
    print("[ATTACK_SIMULATION_STARTED] target=%s threads=%d" % (TARGET, NUM_THREADS))
    start = time.time()
    total_sent = 0

    # Phase 1: HTTP flood - many concurrent requests (high Total Fwd Packets, Bwd Packets/s)
    with ThreadPoolExecutor(max_workers=NUM_THREADS) as ex:
        futures = [ex.submit(http_flood_worker, i) for i in range(NUM_THREADS)]
        for f in as_completed(futures):
            total_sent += f.result()

    print("[REQUESTS_SENT] phase=HTTP_flood count=%d elapsed=%.2fs" % (total_sent, time.time() - start))

    # Phase 2: Large payload bursts (high Packet Length Std, Average Packet Size)
    start2 = time.time()
    payload_sent = 0
    for _ in range(BURST_CYCLES):
        with ThreadPoolExecutor(max_workers=50) as ex:
            futures = [ex.submit(large_payload_worker, i) for i in range(50)]
            for f in as_completed(futures):
                payload_sent += f.result()
        time.sleep(0.1)

    total_sent += payload_sent
    print("[REQUESTS_SENT] phase=large_payload count=%d elapsed=%.2fs" % (payload_sent, time.time() - start2))

    elapsed = time.time() - start
    rps = total_sent / elapsed if elapsed > 0 else 0
    print("[ATTACK_SIMULATION_STARTED] total_requests=%d rps=%.0f elapsed=%.2fs" % (total_sent, rps, elapsed))
    print("[SIMULATE_ATTACK] Done. Check dashboard: http://localhost:5173")
    print("[SIMULATE_ATTACK] Ensure: victim app (8080), tcpdump (port 8000), flow_watcher, backend are running.")


if __name__ == "__main__":
    main()
