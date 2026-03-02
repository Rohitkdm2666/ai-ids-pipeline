# AI Intrusion Detection & Prevention System (IDS/IPS)

An industry-grade AI-powered cybersecurity platform that detects network intrusions using Machine Learning.

## Quick Start

### 1. Start Python ML API
```bash
cd "D:\D Drive Backup\sem 4\EDI\ML model - Copy"
python app/api/prediction_api.py
```

### 2. Start Node.js Backend
```bash
cd ids-platform
npm install
copy .env.example .env  # Edit with your Supabase credentials
npm start
```

### 3. Access Dashboard
- Open: http://localhost:3000
- Login: `admin` / `admin123`

## Features

- ML-powered attack detection (Random Forest on CICIDS2017)
- Real-time traffic analysis via REST API
- Prediction-first architecture
- Defense simulation (IP blocking)
- SOC-style dark theme dashboard
- Admin authentication

## Tech Stack

- **Backend**: Node.js, Express.js, EJS
- **ML API**: Python, Flask, scikit-learn
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Bootstrap 5, Chart.js

## Documentation

See `PROJECT_DOCUMENTATION.md` for complete details.
