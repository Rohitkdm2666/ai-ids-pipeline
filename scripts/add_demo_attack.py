#!/usr/bin/env python3
"""
Demo Attack Script - Adds a demonstration attack to the database
for IDS dashboard visualization purposes.
"""

import os
import sys
from datetime import datetime, timedelta
import random

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from supabase import create_client, Client
except ImportError:
    print("Installing supabase-py...")
    os.system("pip install supabase")
    from supabase import create_client, Client

# Configuration
SUPABASE_URL = "https://fgmhncmcjbomtydzcwry.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnbWhuY21jamJvbXR5ZHpjd3J5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2MzczMywiZXhwIjoyMDg3ODM5NzMzfQ.Z18BgmO7FrgCexJf5FdfJcEXfgV0I7eW_ckd95JG74c"

def create_demo_attack():
    """Create a demonstration attack in the database."""
    
    print("🎯 Creating Demo Attack for Dashboard Demonstration")
    print("=" * 60)
    
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Demo attack details - Use random IP to avoid duplicates
    attacker_ip = f"192.168.1.{random.randint(100, 200)}"  # Random attacker IP
    victim_ip = "192.168.1.11"    # Your server IP
    target_port = 4000
    
    # Attack characteristics
    attack_types = ["DDoS", "Port Scan", "Brute Force", "SQL Injection"]
    selected_attack = random.choice(attack_types)
    
    # Generate realistic attack features
    attack_features = {
        "Fwd Packet Length Max": random.randint(1000, 5000),
        "Average Packet Size": random.uniform(500, 3000),
        "Subflow Fwd Bytes": random.randint(50000, 500000),
        "Fwd Packet Length Mean": random.uniform(800, 2500),
        "Bwd Packets/s": random.uniform(100, 800),
        "Avg Fwd Segment Size": random.uniform(600, 2000),
        "Packet Length Std": random.uniform(200, 1500),
        "Total Length of Fwd Packets": random.randint(100000, 1000000),
        "Max Packet Length": random.randint(2000, 8000),
        "Init_Win_bytes_forward": 65535,
        "PSH Flag Count": random.randint(50, 500),
        "Bwd Packet Length Max": random.randint(500, 3000),
        "Packet Length Mean": random.uniform(400, 2000),
        "Fwd Header Length.1": 40,
        "Avg Bwd Segment Size": random.uniform(200, 1500),
        "Subflow Bwd Bytes": random.randint(20000, 200000),
        "Bwd Packet Length Mean": random.uniform(100, 1000),
        "Bwd Packet Length Std": random.uniform(50, 500),
        "ACK Flag Count": random.randint(100, 1000),
        "Total Fwd Packets": random.randint(200, 1000)
    }
    
    # Calculate ML probability (high for attack)
    ml_probability = random.uniform(0.85, 0.98)
    hybrid_score = random.uniform(0.8, 0.95)
    
    # Determine severity
    if ml_probability >= 0.95:
        severity = "critical"
    elif ml_probability >= 0.85:
        severity = "high"
    elif ml_probability >= 0.7:
        severity = "medium"
    else:
        severity = "low"
    
    attack_time = datetime.now()
    
    try:
        print(f"🎭 Attacker IP: {attacker_ip}")
        print(f"🎯 Victim IP: {victim_ip}:{target_port}")
        print(f"⚔️ Attack Type: {selected_attack}")
        print(f"🔥 Severity: {severity.upper()}")
        print(f"📊 ML Probability: {ml_probability:.2f}")
        print(f"⏰ Time: {attack_time}")
        print()
        
        # 1. Insert traffic log
        print("📝 Inserting traffic log...")
        traffic_data = {
            "src_ip": attacker_ip,
            "dest_ip": victim_ip,
            "src_port": random.randint(1024, 65535),
            "dest_port": target_port,
            "protocol": "TCP",
            "is_attack": True,
            "probability": ml_probability,
            "severity": severity,
            "label": f"{selected_attack} DETECTED",
            "analyzed_at": attack_time.isoformat(),
            "flow_features": attack_features,
            "ml_probability": ml_probability,
            "suspicion_score": 85,
            "hybrid_score": hybrid_score,
            "detection_source": "HYBRID",
            "ground_truth_label": selected_attack,
            "traffic_source": "DEMO_ATTACK"
        }
        
        traffic_result = supabase.table("traffic_logs").insert(traffic_data).execute()
        traffic_log_id = traffic_result.data[0]["id"]
        print(f"✅ Traffic log created: {traffic_log_id}")
        
        # 2. Insert attack log
        print("🚨 Inserting attack log...")
        attack_data = {
            "traffic_log_id": traffic_log_id,
            "src_ip": attacker_ip,
            "dest_ip": victim_ip,
            "dest_port": target_port,
            "severity": severity,
            "detected_at": attack_time.isoformat(),
            "probability": ml_probability,
            "label": f"{selected_attack} DETECTED"
        }
        
        attack_result = supabase.table("attack_logs").insert(attack_data).execute()
        attack_log_id = attack_result.data[0]["id"]
        print(f"✅ Attack log created: {attack_log_id}")
        
        # 3. Add IP to blocked list
        print("🚫 Adding IP to blocked list...")
        blocked_data = {
            "ip_address": attacker_ip,
            "severity": severity,
            "reason": f"Hybrid IDS detected {selected_attack} attack",
            "first_blocked_at": attack_time.isoformat(),
            "last_seen_at": attack_time.isoformat(),
            "is_blocked": True
        }
        
        blocked_result = supabase.table("blocked_ips").insert(blocked_data).execute()
        blocked_id = blocked_result.data[0]["id"]
        print(f"✅ IP blocked: {blocked_id}")
        
        # 4. Add some historical traffic for context
        print("📈 Adding historical traffic data...")
        for i in range(5):
            historical_time = attack_time - timedelta(minutes=i*10)
            is_attack = i < 2  # First 2 entries are also attacks
            
            historical_data = {
                "src_ip": attacker_ip if is_attack else f"192.168.1.{random.randint(50, 200)}",
                "dest_ip": victim_ip,
                "src_port": random.randint(1024, 65535),
                "dest_port": random.choice([80, 443, 22, 4000]),
                "protocol": random.choice(["TCP", "UDP"]),
                "is_attack": is_attack,
                "probability": random.uniform(0.8, 0.95) if is_attack else random.uniform(0.0, 0.3),
                "severity": random.choice(["medium", "high"]) if is_attack else "low",
                "label": "ATTACK DETECTED" if is_attack else "NORMAL TRAFFIC",
                "analyzed_at": historical_time.isoformat(),
                "flow_features": attack_features if is_attack else {k: random.uniform(0, 100) for k in attack_features.keys()},
                "ml_probability": random.uniform(0.8, 0.95) if is_attack else random.uniform(0.0, 0.3),
                "suspicion_score": random.randint(70, 90) if is_attack else random.randint(0, 20),
                "hybrid_score": random.uniform(0.7, 0.9) if is_attack else random.uniform(0.0, 0.4),
                "detection_source": "HYBRID" if is_attack else "ML",
                "traffic_source": "HISTORICAL"
            }
            
            supabase.table("traffic_logs").insert(historical_data).execute()
        
        print("✅ Historical data added")
        
        print()
        print("=" * 60)
        print("🎉 DEMO ATTACK SUCCESSFULLY CREATED!")
        print("=" * 60)
        print("📊 Check dashboard: http://localhost:5173")
        print("🔍 You should now see:")
        print(f"   • Attack from {attacker_ip}")
        print(f"   • {severity.upper()} severity alert")
        print(f"   • {selected_attack} detection")
        print(f"   • IP {attacker_ip} in blocked list")
        print("   • Historical traffic context")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error creating demo attack: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = create_demo_attack()
    if success:
        print("\n🚀 Demo attack ready for dashboard demonstration!")
    else:
        print("\n❌ Failed to create demo attack")
        sys.exit(1)
