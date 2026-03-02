const express = require('express');
const router = express.Router();

const { analyzeTraffic } = require('../controllers/trafficController');

// POST /analyze-traffic
router.post('/analyze-traffic', analyzeTraffic);

module.exports = router;

