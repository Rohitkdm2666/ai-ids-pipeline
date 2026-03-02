const {
  fetchDashboardMetrics,
  fetchRecentTraffic,
  fetchRecentAttacks,
  fetchBlockedIps
} = require('../services/databaseService');
const supabase = require('../config/supabaseClient');

async function getDashboard(req, res) {
  try {
    const [metrics, recentTraffic, recentAttacks, blockedIps, sourceCounts] = await Promise.all([
      fetchDashboardMetrics(),
      fetchRecentTraffic(20),
      fetchRecentAttacks(20),
      fetchBlockedIps(),
      Promise.all([
        supabase.from('traffic_logs').select('id', { count: 'exact', head: true }).eq('traffic_source', 'REAL_PCAP'),
        supabase.from('traffic_logs').select('id', { count: 'exact', head: true }).eq('traffic_source', 'SYNTHETIC')
      ]).then(([real, syn]) => ({
        realPcap: real.count ?? 0,
        synthetic: (syn.count ?? 0)
      })).catch(() => ({ realPcap: 0, synthetic: 0 }))
    ]);

    res.render('dashboard', {
      title: 'IDS Dashboard',
      metrics,
      recentTraffic,
      recentAttacks,
      blockedIps,
      sourceCounts
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
}

async function getLiveTraffic(req, res) {
  try {
    const recentTraffic = await fetchRecentTraffic(100);
    res.render('live-traffic', {
      title: 'Live Traffic Monitor',
      recentTraffic
    });
  } catch (error) {
    console.error('Error rendering live traffic:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
}

async function getAttackLogs(req, res) {
  try {
    const recentAttacks = await fetchRecentAttacks(100);
    res.render('attack-logs', {
      title: 'Attack Logs',
      recentAttacks
    });
  } catch (error) {
    console.error('Error rendering attack logs:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
}

async function getBlockedIps(req, res) {
  try {
    const blockedIps = await fetchBlockedIps();
    res.render('blocked-ips', {
      title: 'Blocked IPs',
      blockedIps
    });
  } catch (error) {
    console.error('Error rendering blocked IPs:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
}

module.exports = {
  getDashboard,
  getLiveTraffic,
  getAttackLogs,
  getBlockedIps
};

