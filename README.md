# AI-IDS Pipeline - Real-time Network Intrusion Detection System

A comprehensive cybersecurity solution that combines machine learning and rule-based detection to identify and prevent network attacks in real-time.

## 🚀 Quick Start

```bash
git clone https://github.com/your-username/ai-ids-pipeline.git
cd ai-ids-pipeline
chmod +x setup.sh
./setup.sh
```

## 📋 Table of Contents
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Environment Configuration](#environment-configuration)
- [Running the Project](#running-the-project)
- [Service Management](#service-management)
- [Testing & Verification](#testing--verification)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## 💻 System Requirements

### Minimum Requirements
- **OS**: Ubuntu 18.04+ / CentOS 7+ / macOS 10.14+ / Windows 10+
- **CPU**: 4 cores minimum, 8 cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space
- **Network**: Administrative access for packet capture

### Software Dependencies
- **Node.js**: 16.x or higher
- **Python**: 3.8 or higher
- **npm**: 8.x or higher
- **pip**: 21.x or higher
- **tcpdump**: For packet capture
- **git**: For version control

---

## 🛠️ Installation Guide

### Step 1: Clone the Repository

```bash
# Clone the project
git clone https://github.com/your-username/ai-ids-pipeline.git
cd ai-ids-pipeline

# Make setup scripts executable
chmod +x setup.sh
chmod +x scripts/*.sh
```

### Step 2: Install System Dependencies

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm tcpdump curl
```

#### CentOS/RHEL:
```bash
sudo yum update
sudo yum install -y python3 python3-pip nodejs npm tcpdump curl
```

#### macOS:
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python3 node npm tcpdump
```

#### Windows:
```bash
# Install WSL2 for Windows
wsl --install

# Then follow Ubuntu instructions in WSL
```

### Step 3: Setup Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Verify Python version
python --version  # Should be 3.8+
```

### Step 4: Install Python Dependencies

```bash
# Install ML and data processing dependencies
pip install --upgrade pip
pip install -r ml-service/requirements.txt
pip install -r flow-extraction-service/requirements.txt

# Verify installation
python -c "import sklearn, pandas, numpy, flask, scapy; print('Python dependencies OK')"
```

### Step 5: Install Node.js Dependencies

```bash
# Install dependencies for all Node.js services
npm install --prefix packet-capture-service
npm install --prefix ids-platform
npm install --prefix victim-app
npm install --prefix frontend/admin-dashboard

# Verify Node.js version
node --version  # Should be 16.x+
npm --version   # Should be 8.x+
```

### Step 6: Verify Network Permissions

```bash
# Check if you can capture packets (requires sudo)
sudo tcpdump -i any -c 1

# If you get permission denied, add user to appropriate group:
# Ubuntu/Debian:
sudo usermod -a -G wireshark $USER
# Then logout and login again
```

---

## ⚙️ Environment Configuration

### Step 1: Copy Environment Templates

```bash
# Copy all environment files
cp packet-capture-service/.env.example packet-capture-service/.env
cp flow-extraction-service/.env.example flow-extraction-service/.env
cp ml-service/.env.example ml-service/.env
cp ids-platform/.env.example ids-platform/.env
cp victim-app/.env.example victim-app/.env
```

### Step 2: Configure Packet Capture Service

Edit `packet-capture-service/.env`:

```env
# Network Configuration
NETWORK_INTERFACE=eth0  # Change to your network interface
PCAP_DIR=./pcap
CSV_OUTPUT_DIR=./csv_output
ROTATE_INTERVAL_MS=300000
PCAP_PREFIX=capture

# IDS Backend Configuration
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here

# Processing Configuration
BATCH_DELAY_MS=5000
USE_PYTHON_CIC=true
DELETE_PCAP_AFTER_PROCESS=true
```

**To find your network interface:**
```bash
ip addr show  # Linux
ifconfig      # macOS
```

### Step 3: Configure Flow Extraction Service

Edit `flow-extraction-service/.env`:

```env
# Directory Configuration
PCAP_DIR=../packet-capture-service/pcap
CSV_OUTPUT_DIR=../data/flows

# IDS Backend Configuration
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here

# Processing Configuration
BATCH_DELAY_MS=3000
USE_PYTHON_CIC=true
DELETE_PCAP_AFTER_PROCESS=true
CICFLOWMETER_JAR=./cicflowmeter.jar
```

### Step 4: Configure ML Service

Edit `ml-service/.env`:

```env
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=true
FLASK_PORT=5000
FLASK_HOST=0.0.0.0

# Model Configuration
MODEL_PATH=./model/model.pkl
SCALER_PATH=./model/scaler.pkl
FEATURES_PATH=./model/top20_features.json
```

### Step 5: Configure IDS Platform

Edit `ids-platform/.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (Supabase)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# ML Service Configuration
PYTHON_API_URL=http://localhost:5000

# Session Configuration
SESSION_SECRET=your-session-secret-here
IDS_API_KEY=your-secret-api-key-here

# Hybrid IDS Configuration
ML_WEIGHT=0.6
RULE_BASED_WEIGHT=0.4
ATTACK_THRESHOLD=0.7

# Rule Thresholds
HIGH_BYTES_PER_SECOND=1000000
HIGH_PACKETS_PER_SECOND=10000
SHORT_FLOW_DURATION=0.1
SUSPICIOUS_USER_AGENT_PATTERN=bot|crawler|scanner
MALICIOUS_PAYLOAD_PATTERN=<script|javascript:|union\s+select

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Step 6: Configure Victim Application

Edit `victim-app/.env`:

```env
# Server Configuration
PORT=4000
SERVER_IP=localhost

# IDS Backend Configuration
IDS_BACKEND_URL=http://localhost:3000
IDS_API_KEY=your-secret-api-key-here
```

---

## 🚀 Running the Project

### Option 1: Using Setup Script (Recommended)

```bash
# Run the automated setup script
./setup.sh

# Start all services
./start-all.sh
```

### Option 2: Manual Start

#### Step 1: Start ML Service
```bash
# Terminal 1
cd ml-service
source ../venv/bin/activate
python prediction_api.py
```

#### Step 2: Start Packet Capture Service
```bash
# Terminal 2 (requires sudo)
cd packet-capture-service
sudo npm start
```

#### Step 3: Start Flow Extraction Service
```bash
# Terminal 3
cd flow-extraction-service
source ../venv/bin/activate
python flow_watcher.py
```

#### Step 4: Start IDS Platform
```bash
# Terminal 4
cd ids-platform
npm start
```

#### Step 5: Start Victim Application
```bash
# Terminal 5
cd victim-app
npm start
```

#### Step 6: Start Frontend Dashboard
```bash
# Terminal 6
cd frontend/admin-dashboard
npm run dev
```

### Option 3: Using PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start all services with PM2
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Stop all services
pm2 stop all
```

---

## 🔧 Service Management

### PM2 Configuration File

Create `ecosystem.config.js`:

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
      max_memory_restart: '1G',
      env: {
        FLASK_ENV: 'production'
      }
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

### Service Status Commands

```bash
# Check all services
curl http://localhost:3000/api/health  # IDS Platform
curl http://localhost:5000/health       # ML Service
curl http://localhost:4000             # Victim App
curl http://localhost:5173             # Frontend

# Check process status
ps aux | grep node
ps aux | grep python

# Check network ports
netstat -tulpn | grep -E ':(3000|4000|5000|5173)'
```

---

## 🧪 Testing & Verification

### Step 1: Verify All Services

```bash
# Test script
./scripts/test-services.sh
```

### Step 2: Run Attack Simulation

```bash
# Activate virtual environment
source venv/bin/activate

# Run attack simulation
python scripts/simulate_attack.py

# Or add demo attack
python scripts/add_demo_attack.py
```

### Step 3: Check Dashboard

Open your browser and navigate to:
- **Dashboard**: http://localhost:5173
- **API Documentation**: http://localhost:3000/api
- **Victim App**: http://localhost:4000

### Expected Results

1. **Dashboard should show:**
   - Real-time metrics
   - Traffic charts
   - Attack alerts
   - Blocked IPs

2. **Attack simulation should:**
   - Generate network traffic
   - Trigger ML detection
   - Show alerts in dashboard
   - Log attacks in database

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Denied for Packet Capture
```bash
# Error: Operation not permitted
sudo usermod -a -G wireshark $USER
# Then logout and login again
```

#### 2. Python Module Not Found
```bash
# Error: ModuleNotFoundError
source venv/bin/activate
pip install -r ml-service/requirements.txt
pip install -r flow-extraction-service/requirements.txt
```

#### 3. Node.js Module Not Found
```bash
# Error: Cannot find module
npm install --prefix packet-capture-service
npm install --prefix ids-platform
npm install --prefix victim-app
npm install --prefix frontend/admin-dashboard
```

#### 4. Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :4000
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>
```

#### 5. Database Connection Issues
```bash
# Check Supabase credentials in ids-platform/.env
# Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
curl -I your-supabase-url
```

#### 6. ML Model Not Loading
```bash
# Check model files exist
ls -la ml-service/model/
# Should contain: model.pkl, scaler.pkl, top20_features.json

# If missing, train model:
python ml-service/train_model.py
```

### Log Files

```bash
# Service logs
tail -f packet-capture-service/logs/app.log
tail -f ids-platform/logs/app.log
tail -f flow-extraction-service/logs/flow_watcher.log

# System logs
journalctl -u nodejs -f
journalctl -u python3 -f
```

### Performance Issues

```bash
# Check system resources
htop
df -h
free -h

# Check network interfaces
ip addr show
```

---

## 📁 Project Structure

```
ai-ids-pipeline/
├── README.md                          # This file
├── setup.sh                          # Automated setup script
├── start-all.sh                      # Start all services
├── ecosystem.config.js                # PM2 configuration
├── packet-capture-service/            # Packet capture microservice
│   ├── index.js                      # Main service file
│   ├── package.json                  # Node.js dependencies
│   ├── .env.example                  # Environment template
│   └── pcap/                        # PCAP file storage
├── flow-extraction-service/           # Flow extraction microservice
│   ├── flow_watcher.py               # Main service file
│   ├── flow_extractor.py              # Feature extraction
│   ├── requirements.txt              # Python dependencies
│   └── .env.example                 # Environment template
├── ml-service/                      # ML prediction microservice
│   ├── prediction_api.py             # Flask API
│   ├── train_model.py                # Model training script
│   ├── requirements.txt              # Python dependencies
│   ├── model/                       # Trained models
│   │   ├── model.pkl
│   │   ├── scaler.pkl
│   │   └── top20_features.json
│   └── .env.example                 # Environment template
├── ids-platform/                    # Main IDS backend
│   ├── server.js                    # Express server
│   ├── package.json                 # Node.js dependencies
│   ├── .env.example                 # Environment template
│   ├── controllers/                 # Route controllers
│   ├── routes/                      # API routes
│   └── middleware/                  # Custom middleware
├── victim-app/                      # Target application
│   ├── server.js                    # Express server
│   ├── package.json                 # Node.js dependencies
│   └── .env.example                 # Environment template
├── frontend/admin-dashboard/          # React dashboard
│   ├── src/                        # React source code
│   │   ├── App.jsx                 # Main component
│   │   ├── components/              # React components
│   │   └── App.css                 # Styling
│   ├── package.json                 # Node.js dependencies
│   └── vite.config.js              # Vite configuration
├── scripts/                        # Utility scripts
│   ├── simulate_attack.py           # Attack simulation
│   ├── add_demo_attack.py          # Demo attack creator
│   ├── test-services.sh            # Service testing
│   └── setup.sh                   # Setup helper
├── data/                          # Data storage
│   ├── flows/                      # Extracted flow data
│   └── logs/                      # Application logs
└── docs/                          # Documentation
    ├── PROJECT_OVERVIEW.md          # Detailed project docs
    └── PRESENTATION_SUMMARY.md     # Presentation slides
```

---

## 📞 Support & Contributing

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/your-username/ai-ids-pipeline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/ai-ids-pipeline/discussions)
- **Email**: support@example.com

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎯 Quick Commands Reference

```bash
# Setup
git clone https://github.com/your-username/ai-ids-pipeline.git
cd ai-ids-pipeline
chmod +x setup.sh && ./setup.sh

# Development
./start-all.sh                    # Start all services
./scripts/test-services.sh          # Test all services
./scripts/simulate_attack.py        # Run attack simulation

# Production
pm2 start ecosystem.config.js       # Start with PM2
pm2 status                        # Check status
pm2 logs                          # View logs

# Troubleshooting
sudo lsof -i :3000              # Check port usage
tail -f ids-platform/logs/app.log  # View logs
```

---

**🚀 Your AI-IDS Pipeline is now ready!**

For detailed documentation, see [PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)
For presentation materials, see [PRESENTATION_SUMMARY.md](docs/PRESENTATION_SUMMARY.md)
