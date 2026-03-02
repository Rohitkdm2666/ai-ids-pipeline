const supabase = require('../config/supabaseClient');

const TABLES = {
  TRAFFIC: 'traffic_logs',
  ATTACKS: 'attack_logs',
  BLOCKED_IPS: 'blocked_ips'
};

async function insertTrafficLog(payload) {
  const { data, error } = await supabase.from(TABLES.TRAFFIC).insert(payload).select().single();
  if (error) {
    console.error('Error inserting traffic log:', error);
    throw error;
  }
  return data;
}

async function fetchRecentTraffic(limit = 100) {
  const { data, error } = await supabase
    .from(TABLES.TRAFFIC)
    .select('*')
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent traffic:', error);
    throw error;
  }

  return data || [];
}

async function insertAttackLog(payload) {
  const { data, error } = await supabase.from(TABLES.ATTACKS).insert(payload).select().single();
  if (error) {
    console.error('Error inserting attack log:', error);
    throw error;
  }
  return data;
}

async function fetchRecentAttacks(limit = 100) {
  const { data, error } = await supabase
    .from(TABLES.ATTACKS)
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent attacks:', error);
    throw error;
  }

  return data || [];
}

async function upsertBlockedIp(payload) {
  const { data, error } = await supabase
    .from(TABLES.BLOCKED_IPS)
    .upsert(payload, { onConflict: 'ip_address' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting blocked IP:', error);
    throw error;
  }

  return data;
}

async function fetchBlockedIps() {
  const { data, error } = await supabase
    .from(TABLES.BLOCKED_IPS)
    .select('*')
    .order('first_blocked_at', { ascending: false });

  if (error) {
    console.error('Error fetching blocked IPs:', error);
    throw error;
  }

  return data || [];
}

async function fetchDashboardMetrics() {
  const [trafficRes, attackRes, blockedRes] = await Promise.all([
    supabase.from(TABLES.TRAFFIC).select('id', { count: 'exact', head: true }),
    supabase
      .from(TABLES.TRAFFIC)
      .select('id', { count: 'exact', head: true })
      .eq('is_attack', true),
    supabase.from(TABLES.BLOCKED_IPS).select('id', { count: 'exact', head: true })
  ]);

  const totalTraffic = trafficRes.count || 0;
  const totalAttacks = attackRes.count || 0;
  const blockedIpCount = blockedRes.count || 0;
  const detectionRate = totalTraffic > 0 ? Number(((totalAttacks / totalTraffic) * 100).toFixed(2)) : 0;

  return {
    totalTraffic,
    totalAttacks,
    detectionRate,
    blockedIpCount
  };
}

module.exports = {
  insertTrafficLog,
  fetchRecentTraffic,
  insertAttackLog,
  fetchRecentAttacks,
  upsertBlockedIp,
  fetchBlockedIps,
  fetchDashboardMetrics
};

