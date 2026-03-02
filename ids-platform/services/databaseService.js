const supabase = require('../config/supabaseClient');

const TABLES = {
  TRAFFIC: 'traffic_logs',
  ATTACKS: 'attack_logs',
  BLOCKED_IPS: 'blocked_ips'
};

async function insertTrafficLog(payload) {
  try {
    const { data, error } = await supabase
      .from(TABLES.TRAFFIC)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[DB_TRAFFIC_INSERT_ERROR]', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    return data;
  } catch (err) {
    console.error('[DB_TRAFFIC_INSERT_ERROR]', { exception: err.message, stack: err.stack });
    throw err;
  }
}

async function fetchRecentTraffic(limit = 100) {
  try {
    const { data, error } = await supabase
      .from(TABLES.TRAFFIC)
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DB_ERROR_FETCH_TRAFFIC]', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('[DB_EXCEPTION_FETCH_TRAFFIC]', err);
    throw err;
  }
}

async function insertAttackLog(payload) {
  try {
    const { data, error } = await supabase
      .from(TABLES.ATTACKS)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[DB_ATTACK_INSERT_ERROR]', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    return data;
  } catch (err) {
    console.error('[DB_ATTACK_INSERT_ERROR]', { exception: err.message, stack: err.stack });
    throw err;
  }
}

async function fetchRecentAttacks(limit = 100) {
  try {
    const { data, error } = await supabase
      .from(TABLES.ATTACKS)
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DB_ERROR_FETCH_ATTACKS]', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('[DB_EXCEPTION_FETCH_ATTACKS]', err);
    throw err;
  }
}

async function upsertBlockedIp(payload) {
  try {
    const { data, error } = await supabase
      .from(TABLES.BLOCKED_IPS)
      .upsert(payload, { onConflict: 'ip_address' })
      .select()
      .single();

    if (error) {
      console.error('[DB_ERROR_BLOCKED_IP_UPSERT]', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('[DB_EXCEPTION_BLOCKED_IP_UPSERT]', err);
    throw err;
  }
}

async function fetchBlockedIps() {
  try {
    const { data, error } = await supabase
      .from(TABLES.BLOCKED_IPS)
      .select('*')
      .order('first_blocked_at', { ascending: false });

    if (error) {
      console.error('[DB_ERROR_FETCH_BLOCKED_IPS]', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('[DB_EXCEPTION_FETCH_BLOCKED_IPS]', err);
    throw err;
  }
}

async function fetchBlockedIpByAddress(ipAddress) {
  if (!ipAddress) return null;

  try {
    const { data, error } = await supabase
      .from(TABLES.BLOCKED_IPS)
      .select('*')
      .eq('ip_address', ipAddress)
      .maybeSingle();

    if (error) {
      console.error('[DB_ERROR_FETCH_BLOCKED_IP_BY_ADDRESS]', error);
      throw error;
    }

    return data || null;
  } catch (err) {
    console.error('[DB_EXCEPTION_FETCH_BLOCKED_IP_BY_ADDRESS]', err);
    throw err;
  }
}

async function fetchDashboardMetrics() {
  try {
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
    const detectionRate =
      totalTraffic > 0 ? Number(((totalAttacks / totalTraffic) * 100).toFixed(2)) : 0;

    return {
      totalTraffic,
      totalAttacks,
      detectionRate,
      blockedIpCount
    };
  } catch (err) {
    console.error('[DB_EXCEPTION_DASHBOARD_METRICS]', err);
    throw err;
  }
}

module.exports = {
  insertTrafficLog,
  fetchRecentTraffic,
  insertAttackLog,
  fetchRecentAttacks,
  upsertBlockedIp,
  fetchBlockedIps,
  fetchBlockedIpByAddress,
  fetchDashboardMetrics
};

