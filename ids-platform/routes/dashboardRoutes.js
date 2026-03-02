const express = require('express');
const router = express.Router();

const {
  getDashboard,
  getLiveTraffic,
  getAttackLogs,
  getBlockedIps
} = require('../controllers/dashboardController');

router.get('/', getDashboard);
router.get('/live-traffic', getLiveTraffic);
router.get('/attack-logs', getAttackLogs);
router.get('/blocked-ips', getBlockedIps);

module.exports = router;


