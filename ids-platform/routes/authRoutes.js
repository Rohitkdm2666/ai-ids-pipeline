const express = require('express');
const router = express.Router();

const { showLogin, handleLogin, handleLogout } = require('../controllers/authController');

router.get('/login', showLogin);
router.post('/login', handleLogin);
router.post('/logout', handleLogout);

module.exports = router;

