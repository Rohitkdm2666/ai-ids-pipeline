const express = require('express');
const router = express.Router();
const {
  fetchRecentTraffic,
  fetchRecentAttacks,
  fetchBlockedIps,
  fetchDashboardMetrics
} = require('../services/databaseService');

router.get('/metrics', async (req, res) => {
  try {
    const metrics = await fetchDashboardMetrics();
    res.json(metrics);
  } catch (err) {
    console.error('[API_DASHBOARD_METRICS_ERROR]', err);
    res.json({ totalTraffic: 0, totalAttacks: 0, detectionRate: 0, blockedIpCount: 0 });
  }
});

router.get('/traffic', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const traffic = await fetchRecentTraffic(limit);
    res.json(traffic);
  } catch (err) {
    console.error('[API_DASHBOARD_TRAFFIC_ERROR]', err);
    res.json([]);
  }
});

router.get('/attacks', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const attacks = await fetchRecentAttacks(limit);
    res.json(attacks);
  } catch (err) {
    console.error('[API_DASHBOARD_ATTACKS_ERROR]', err);
    res.json([]);
  }
});

router.get('/blocked-ips', async (req, res) => {
  try {
    const blocked = await fetchBlockedIps();
    res.json(blocked);
  } catch (err) {
    console.error('[API_DASHBOARD_BLOCKED_ERROR]', err);
    res.json([]);
  }
});

module.exports = router;
