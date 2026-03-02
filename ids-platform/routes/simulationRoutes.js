const express = require('express');
const router = express.Router();

const { simulateFromSampleCsv } = require('../services/simulationService');

// Trigger a background-like simulation of traffic from the sample dataset
router.post('/simulate-traffic', async (req, res) => {
  const { limit, delayMs } = req.body || {};

  try {
    // Fire and forget: respond immediately, run simulation without blocking client
    simulateFromSampleCsv({
      limit: typeof limit === 'number' ? limit : 200,
      delayMs: typeof delayMs === 'number' ? delayMs : 200
    }).catch((err) => console.error('Simulation error:', err));

    res.status(202).json({
      status: 'started',
      message: 'Traffic simulation started using sample dataset'
    });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

module.exports = router;

