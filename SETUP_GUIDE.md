# AI-IDS Pipeline - Complete Setup & Startup Guide

## 🚀 Quick Start Commands

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ai-ids-pipeline.git
cd ai-ids-pipeline

# 2. Install system dependencies
# Ubuntu/Debian:
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nodejs npm tcpdump curl

# CentOS/RHEL:
sudo yum update && sudo yum install -y python3 python3-pip nodejs npm tcpdump curl

# macOS:
brew install python3 node npm tcpdump

# 3. Setup Python environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 4. Install Python dependencies
pip install --upgrade pip
pip install -r ml-service/requirements.txt
pip install -r flow-extraction-service/requirements.txt

# 5. Install Node.js dependencies
npm install --prefix packet-capture-service
npm install --prefix ids-platform
npm install --prefix victim-app
npm install --prefix frontend/admin-dashboard

# 6. Setup environment files
cp packet-capture-service/.env.example packet-capture-service/.env
cp flow-extraction-service/.env.example flow-extraction-service/.env
cp ml-service/.env.example ml-service/.env
cp ids-platform/.env.example ids-platform/.env
cp victim-app/.env.example victim-app/.env

# 7. Create necessary directories
mkdir -p packet-capture-service/pcap
mkdir -p data/flows
mkdir -p data/logs
mkdir -p ml-service/model
```

## ⚙️ Environment Configuration

### 1. Packet Capture Service (packet-capture-service/.env)
```env
NETWORK_INTERFACE=eth0                    # Change to your network interface
PCAP_DIR=./pcap
CSV_OUTPUT_DIR=./csv_output
ROTATE_INTERVAL_MS=300000
PCAP_PREFIX=capture
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here
BATCH_DELAY_MS=5000
USE_PYTHON_CIC=true
DELETE_PCAP_AFTER_PROCESS=true
```

### 2. Flow Extraction Service (flow-extraction-service/.env)
```env
PCAP_DIR=../packet-capture-service/pcap
CSV_OUTPUT_DIR=../data/flows
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here
BATCH_DELAY_MS=3000
USE_PYTHON_CIC=true
DELETE_PCAP_AFTER_PROCESS=true
CICFLOWMETER_JAR=./cicflowmeter.jar
```

### 3. ML Service (ml-service/.env)
```env
FLASK_ENV=development
FLASK_DEBUG=true
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
MODEL_PATH=./model/model.pkl
SCALER_PATH=./model/scaler.pkl
FEATURES_PATH=./model/top20_features.json
```

### 4. IDS Platform (ids-platform/.env)
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
PYTHON_API_URL=http://localhost:5000
SESSION_SECRET=your-session-secret-here
IDS_API_KEY=your-secret-api-key-here
ML_WEIGHT=0.6
RULE_BASED_WEIGHT=0.4
ATTACK_THRESHOLD=0.7
HIGH_BYTES_PER_SECOND=1000000
HIGH_PACKETS_PER_SECOND=10000
SHORT_FLOW_DURATION=0.1
SUSPICIOUS_USER_AGENT_PATTERN=bot|crawler|scanner
MALICIOUS_PAYLOAD_PATTERN=<script|javascript:|union\s+select
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 5. Victim Application (victim-app/.env)
```env
PORT=4000
SERVER_IP=localhost
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here
```

## 🚀 Starting All Services

### Method 1: Manual Start (Recommended for Development)

Open 6 separate terminals:

**Terminal 1 - ML Service:**
```bash
cd ml-service
source ../venv/bin/activate
python prediction_api.py
```

**Terminal 2 - Packet Capture Service (requires sudo):**
```bash
cd packet-capture-service
sudo npm start
```

**Terminal 3 - Flow Extraction Service:**
```bash
cd flow-extraction-service
source ../venv/bin/activate
python flow_watcher.py
```

**Terminal 4 - IDS Platform:**
```bash
cd ids-platform
npm start
```

**Terminal 5 - Victim Application:**
```bash
cd victim-app
npm start
```

**Terminal 6 - Frontend Dashboard:**
```bash
cd frontend/admin-dashboard
npm run dev
```

### Method 2: PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js file (see below)
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Stop all services
pm2 stop all
```

### PM2 Configuration (ecosystem.config.js)
```javascript
module.exports = {
  apps: [
    {
      name: 'ml-service',
      cwd: './ml-service',
      script: 'prediction_api.py',
      interpreter: './../venv/bin/python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'packet-capture',
      cwd: './packet-capture-service',
      script: 'index.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'flow-extraction',
      cwd: './flow-extraction-service',
      script: 'flow_watcher.py',
      interpreter: './../venv/bin/python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'ids-platform',
      cwd: './ids-platform',
      script: 'server.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'victim-app',
      cwd: './victim-app',
      script: 'server.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'frontend',
      cwd: './frontend/admin-dashboard',
      script: 'npm',
      args: 'run dev',
      interpreter: '/usr/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

## 🧪 Testing & Verification

### 1. Check Service Status
```bash
# Test individual services
curl http://localhost:5000/health       # ML Service
curl http://localhost:3000/api/health  # IDS Platform
curl http://localhost:4000             # Victim App
curl http://localhost:5173             # Frontend

# Check running processes
ps aux | grep node
ps aux | grep python

# Check network ports
netstat -tulpn | grep -E ':(3000|4000|5000|5173)'
```

### 2. Run Attack Simulation
```bash
# Activate virtual environment
source venv/bin/activate

# Run attack simulation
python scripts/simulate_attack.py

# Add demo attack
python scripts/add_demo_attack.py
```

### 3. Access Applications
- **Dashboard**: http://localhost:5173
- **API Documentation**: http://localhost:3000/api
- **Victim App**: http://localhost:4000
- **ML Service**: http://localhost:5000

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. Permission Denied for Packet Capture**
```bash
# Error: Operation not permitted
sudo usermod -a -G wireshark $USER
# Then logout and login again
```

**2. Python Module Not Found**
```bash
# Error: ModuleNotFoundError
source venv/bin/activate
pip install -r ml-service/requirements.txt
pip install -r flow-extraction-service/requirements.txt
```

**3. Node.js Module Not Found**
```bash
# Error: Cannot find module
npm install --prefix packet-capture-service
npm install --prefix ids-platform
npm install --prefix victim-app
npm install --prefix frontend/admin-dashboard
```

**4. Port Already in Use**
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :4000
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>
```

**5. Network Interface Detection**
```bash
# Find your network interface
ip addr show
# or
ifconfig

# Update NETWORK_INTERFACE in packet-capture-service/.env
```

### Log Files Location
```bash
# Service logs
tail -f packet-capture-service/logs/app.log
tail -f ids-platform/logs/app.log
tail -f flow-extraction-service/logs/flow_watcher.log

# System logs
journalctl -u nodejs -f
journalctl -u python3 -f
```

## 📁 Project Structure Overview

```
ai-ids-pipeline/
├── packet-capture-service/          # Captures network packets
│   ├── index.js                   # Main service
│   ├── package.json               # Dependencies
│   └── .env                     # Configuration
├── flow-extraction-service/         # Extracts flow features
│   ├── flow_watcher.py           # Main service
│   ├── flow_extractor.py          # Feature extraction
│   └── .env                     # Configuration
├── ml-service/                   # ML predictions
│   ├── prediction_api.py          # Flask API
│   ├── requirements.txt           # Python deps
│   └── .env                     # Configuration
├── ids-platform/                 # Main IDS backend
│   ├── server.js                 # Express server
│   ├── package.json              # Dependencies
│   └── .env                     # Configuration
├── victim-app/                   # Target application
│   ├── server.js                 # Express server
│   ├── package.json              # Dependencies
│   └── .env                     # Configuration
├── frontend/admin-dashboard/        # React dashboard
│   ├── src/App.jsx              # Main component
│   ├── package.json              # Dependencies
│   └── vite.config.js           # Build config
├── scripts/                      # Utility scripts
│   ├── simulate_attack.py        # Attack simulation
│   └── add_demo_attack.py       # Demo attack
└── data/                        # Data storage
    ├── flows/                   # Extracted flows
    └── logs/                    # Application logs
```

## 🎯 Quick Commands Reference

```bash
# Setup commands
git clone https://github.com/your-username/ai-ids-pipeline.git
cd ai-ids-pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r ml-service/requirements.txt
pip install -r flow-extraction-service/requirements.txt
npm install --prefix packet-capture-service
npm install --prefix ids-platform
npm install --prefix victim-app
npm install --prefix frontend/admin-dashboard

# Start services (manual)
cd ml-service && source ../venv/bin/activate && python prediction_api.py &
cd packet-capture-service && sudo npm start &
cd flow-extraction-service && source ../venv/bin/activate && python flow_watcher.py &
cd ids-platform && npm start &
cd victim-app && npm start &
cd frontend/admin-dashboard && npm run dev &

# Start services (PM2)
pm2 start ecosystem.config.js

# Test services
curl http://localhost:3000/api/health
curl http://localhost:5000/health
curl http://localhost:4000
curl http://localhost:5173

# Run tests
source venv/bin/activate
python scripts/simulate_attack.py
python scripts/add_demo_attack.py

# Stop services (PM2)
pm2 stop all
```

## 📞 Support

- **Documentation**: PROJECT_OVERVIEW.md
- **Presentation**: PRESENTATION_SUMMARY.md
- **Issues**: GitHub Issues
- **Email**: support@example.com

---

**🚀 Your AI-IDS Pipeline is now ready to run!**

Follow this guide step by step to set up the complete intrusion detection system.
