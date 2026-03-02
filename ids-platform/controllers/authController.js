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

async function showLogin(req, res) {
  if (req.session && req.session.user && req.session.user.isAdmin) {
    return res.redirect('/');
  }
  res.render('login', { title: 'Admin Login', error: null });
}

async function handleLogin(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).render('login', {
      title: 'Admin Login',
      error: 'Username and password are required'
    });
  }

  if (username !== ADMIN_USERNAME) {
    return res.status(401).render('login', {
      title: 'Admin Login',
      error: 'Invalid credentials'
    });
  }

  const hash = await getPasswordHash();
  const valid = await verifyPassword(password, hash);

  if (!valid) {
    return res.status(401).render('login', {
      title: 'Admin Login',
      error: 'Invalid credentials'
    });
  }

  req.session.user = {
    username,
    isAdmin: true
  };

  return res.redirect('/');
}

function handleLogout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = {
  showLogin,
  handleLogin,
  handleLogout
};

