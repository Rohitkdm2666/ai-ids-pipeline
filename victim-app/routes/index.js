/**
 * Main Page Routes
 * 
 * Serves the public-facing victim web application pages.
 */

const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', {
    title: 'SecureBank - Online Banking',
    idsResult: req.idsResult || null
  });
});

// Login page
router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login - SecureBank',
    error: null
  });
});

// Login form submission
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simulated login - always shows result (victim behavior)
  console.log('[LOGIN_ATTEMPT]', { username, ip: req.ip });
  
  // Check for obvious attack patterns
  const isSuspicious = req.suspicionAnalysis && req.suspicionAnalysis.score > 50;
  
  res.render('login-result', {
    title: 'Login Result - SecureBank',
    success: !isSuspicious,
    message: isSuspicious 
      ? 'Invalid credentials. Please try again.'
      : 'Login failed. Invalid username or password.',
    username
  });
});

// Search page
router.get('/search', (req, res) => {
  const query = req.query.q || '';
  
  console.log('[SEARCH]', { query, ip: req.ip });
  
  // Simulated search results
  const results = query ? [
    { title: 'Account Statement', description: `Results for "${query}"` },
    { title: 'Transaction History', description: 'View your recent transactions' },
    { title: 'Help Center', description: 'Find answers to common questions' }
  ] : [];
  
  res.render('search', {
    title: 'Search - SecureBank',
    query,
    results
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - SecureBank',
    success: null
  });
});

// Contact form submission
router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  console.log('[CONTACT_SUBMISSION]', { name, email, messageLength: (message || '').length, ip: req.ip });
  
  res.render('contact', {
    title: 'Contact Us - SecureBank',
    success: true
  });
});

// Profile page (simulates authenticated area)
router.get('/profile', (req, res) => {
  res.render('profile', {
    title: 'My Profile - SecureBank',
    user: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      accountNumber: '****4567'
    }
  });
});

module.exports = router;
