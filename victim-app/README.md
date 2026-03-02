# Victim App - IDS Testing Target

A simulated public-facing web application designed to generate realistic HTTP traffic for testing the IDS platform.

## Overview

This application simulates a banking website with various endpoints that are common attack targets:
- Login forms
- Search functionality  
- Comment/feedback forms
- File upload
- Money transfer

All incoming traffic is monitored by middleware that:
1. Extracts request metadata
2. Detects suspicious patterns (SQL injection, XSS, etc.)
3. Generates mock CICIDS2017 flow features
4. Sends data to IDS backend for ML analysis
5. Blocks requests if IDS detects an attack

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start the app
npm start
```

The app runs on `http://localhost:4000` by default.

## Requirements

- Node.js 16+
- IDS Platform running on `http://localhost:3000`
- Python ML API running on `http://localhost:5000`

## Architecture

```
victim-app/
├── server.js                 # Express app entry point
├── middleware/
│   └── monitor.js            # Traffic monitoring middleware
├── services/
│   ├── idsClient.js          # IDS backend communication
│   └── featureGenerator.js   # Mock CICIDS feature generation
├── routes/
│   ├── index.js              # Page routes
│   └── api.js                # API endpoints
├── views/                    # EJS templates
│   ├── index.ejs
│   ├── login.ejs
│   ├── search.ejs
│   ├── contact.ejs
│   ├── profile.ejs
│   ├── blocked.ejs
│   └── error.ejs
└── uploads/                  # File upload directory
```

## Testing Attack Scenarios

### SQL Injection
```bash
curl "http://localhost:4000/search?q=' OR 1=1 --"
```

### XSS Attack
```bash
curl -X POST http://localhost:4000/api/comment \
  -H "Content-Type: application/json" \
  -d '{"content": "<script>alert(1)</script>"}'
```

### Large Payload
```bash
curl -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "'$(python -c "print('A'*10000)")'"}'
```

### Rapid Requests (DoS simulation)
```bash
for i in {1..30}; do curl -s http://localhost:4000/ > /dev/null & done
```

## Feature Generation

The `featureGenerator.js` service creates mock CICIDS2017-style features based on:
- HTTP method and payload size
- Request headers
- Suspicious pattern detection score
- Request timing

Suspicious patterns increase feature values that correlate with attack traffic:
- Higher packet rates
- More urgent flags
- Larger flow durations

## IDS Integration

Every request goes through the monitoring middleware which:
1. Builds traffic metadata
2. Analyzes content for attack patterns
3. Generates 78 CICIDS features
4. POSTs to `/analyze-traffic` on IDS backend
5. If IDS returns blocked/attack: show 403 page

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Server port |
| SERVER_IP | 192.168.1.100 | Simulated server IP |
| IDS_BACKEND_URL | http://localhost:3000 | IDS platform URL |

## Future Enhancements

- Rate limiting integration
- Real network packet capture
- WebSocket for real-time blocking
- Session tracking for attack correlation
