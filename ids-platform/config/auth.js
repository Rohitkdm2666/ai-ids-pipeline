const session = require('express-session');

function configureSession(app) {
  const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret';

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // 1 hour
      }
    })
  );
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user && req.session.user.isAdmin) {
    return next();
  }
  return res.redirect('/login');
}

module.exports = {
  configureSession,
  requireAuth
};

