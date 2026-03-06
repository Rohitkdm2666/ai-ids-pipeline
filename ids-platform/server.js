require('dotenv').config();

const path = require('path');
const express = require('express');

// Startup: log env (mask secrets) and test DB
function logEnv() {
  const mask = (s) => (s ? `${String(s).slice(0, 8)}...` : '(not set)');
  console.log('[IDS_STARTUP_ENV]', {
    PORT: process.env.PORT || 3000,
    SUPABASE_URL: process.env.SUPABASE_URL ? mask(process.env.SUPABASE_URL) : '(not set)',
    SUPABASE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PYTHON_API_URL: process.env.PYTHON_API_URL || 'http://localhost:5000/predict',
    IDS_API_KEY_SET: !!process.env.IDS_API_KEY
  });
}

async function testDbConnection() {
  try {
    const supabase = require('./config/supabaseClient');
    const { data, error } = await supabase.from('traffic_logs').select('id, traffic_source, detection_source, ml_probability, hybrid_score, suspicion_score').limit(1);
    if (error) throw error;
    console.log('[DB_CONNECTION_SUCCESS]', { table: 'traffic_logs', schemaColumns: 'id,traffic_source,detection_source,ml_probability,hybrid_score,suspicion_score' });
  } catch (err) {
    console.error('[DB_CONNECTION_ERROR]', { error: err.message, hint: 'Run supabase_migration_add_columns.sql if traffic_source/detection_source missing' });
  }
}
const cors = require('cors');
const { configureSession, requireAuth } = require('./config/auth');

const app = express();

// Basic config
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors());

// Sessions / auth
configureSession(app);

// Routes
const apiDashboardRoutes = require('./routes/apiDashboard');
const trafficRoutes = require('./routes/traffic');
const authRoutes = require('./routes/authRoutes');

// API key auth for internal services (victim-app, simulation scripts)
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.IDS_API_KEY || 'ids-internal-key';
  
  if (apiKey === validKey) {
    return next();
  }
  
  // Fall back to session auth
  return requireAuth(req, res, next);
};

// Public auth routes
app.use('/', authRoutes);

// JSON API for React dashboard (no auth for localhost)
app.use('/api', apiDashboardRoutes);

// Traffic analysis endpoint: API key auth (flow_watcher, etc.)
app.use('/', apiKeyAuth, trafficRoutes);

// 404 handler (JSON - React dashboard is on port 5173)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', hint: 'Dashboard: http://localhost:5173' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`IDS Platform server running on http://localhost:${PORT}`);
  logEnv();
  await testDbConnection();
});

