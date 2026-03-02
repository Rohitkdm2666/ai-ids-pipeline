require('dotenv').config();

const path = require('path');
const express = require('express');

const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');

const app = express();

const PORT = process.env.PORT || 4000;
const SERVER_IP = process.env.SERVER_IP || '192.168.1.100';

app.set('serverIp', SERVER_IP);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('trust proxy', true);

// NOTE: Synthetic feature generation removed. Traffic is now captured by
// packet-capture-service and processed by flow-extraction-service (CICFlowMeter)
// before being sent to IDS. Victim app is a pure target for packet capture.

// Routes
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

// 403 Blocked page
app.get('/blocked', (req, res) => {
  res.status(403).render('blocked', {
    title: 'Access Denied',
    message: 'Your IP has been blocked due to suspicious activity.'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[VICTIM_APP_ERROR]', err);
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: 'An internal server error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`Victim App running on http://localhost:${PORT}`);
  console.log(`Server IP configured as: ${SERVER_IP}`);
  console.log(`IDS Backend: ${process.env.IDS_BACKEND_URL || 'http://localhost:3000'}`);
});
