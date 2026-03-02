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
    console.log('[DB_CONNECTION_TEST]', { status: 'ok', table: 'traffic_logs', schemaColumns: 'id,traffic_source,detection_source,ml_probability,hybrid_score,suspicion_score' });
  } catch (err) {
    console.error('[DB_CONNECTION_TEST]', { status: 'FAILED', error: err.message, hint: 'Run supabase_migration_add_columns.sql if traffic_source/detection_source missing' });
  }
}
const cors = require('cors');
const { configureSession, requireAuth } = require('./config/auth');

const app = express();

// Basic config
const PORT = process.env.PORT || 3000;

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors());

// Sessions / auth
configureSession(app);

// Routes
const dashboardRoutes = require('./routes/dashboardRoutes');
const trafficRoutes = require('./routes/traffic');
const simulationRoutes = require('./routes/simulationRoutes');
const authRoutes = require('./routes/authRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');

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

// Traffic analysis endpoint: allows API key OR session auth
app.use('/', apiKeyAuth, trafficRoutes);
// Evaluation endpoints: admin-only (research analysis)
app.use('/', requireAuth, evaluationRoutes);

// Protected routes (admin-only, session auth required)
app.use('/', requireAuth, dashboardRoutes);
app.use('/', requireAuth, simulationRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.accepts('json')) {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).render('500', { title: 'Server Error' });
  }
});

app.listen(PORT, async () => {
  console.log(`IDS Platform server running on http://localhost:${PORT}`);
  logEnv();
  await testDbConnection();
});

