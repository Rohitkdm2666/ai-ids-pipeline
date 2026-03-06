const bcrypt = require('bcryptjs');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || null;

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function getPasswordHash() {
  if (ADMIN_PASSWORD_HASH) {
    return ADMIN_PASSWORD_HASH;
  }
  if (ADMIN_PASSWORD_PLAIN) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(ADMIN_PASSWORD_PLAIN, salt);
  }
  // Default very weak password if nothing is set; for demo only
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash('admin123', salt);
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';

async function showLogin(req, res) {
  return res.redirect(DASHBOARD_URL);
}

async function handleLogin(req, res) {
  return res.redirect(DASHBOARD_URL);
}

function handleLogout(req, res) {
  req.session.destroy(() => {
    res.redirect(DASHBOARD_URL);
  });
}

module.exports = {
  showLogin,
  handleLogin,
  handleLogout
};

