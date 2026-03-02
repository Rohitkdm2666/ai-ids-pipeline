const express = require('express');
const router = express.Router();

const { getEvaluationMetrics } = require('../controllers/evaluationController');

// Research evaluation endpoint
// Returns aggregate metrics for ML, rule, and hybrid detectors.
router.get('/api/evaluation-metrics', getEvaluationMetrics);

module.exports = router;

