const { predictFlow } = require('../services/predictionService');
const {
  insertTrafficLog,
  insertAttackLog,
  upsertBlockedIp,
  fetchBlockedIpByAddress
} = require('../services/databaseService');

function deriveSeverity(probability) {
  if (probability >= 0.9) return 'critical';
  if (probability >= 0.7) return 'high';
  if (probability >= 0.4) return 'medium';
  return 'low';
}

function validateTrafficPayload(body) {
  const errors = [];

  if (!body) {
    errors.push('Request body is required');
    return errors;
  }

  if (!body.features || typeof body.features !== 'object') {
    errors.push('`features` object is required');
  }

  if (!body.src_ip) errors.push('`src_ip` is required');
  if (!body.dest_ip) errors.push('`dest_ip` is required');
  if (body.dest_port == null) errors.push('`dest_port` is required');

  return errors;
}

async function analyzeTraffic(req, res) {
  try {
    console.log('[ANALYZE_TRAFFIC_REQUEST_RECEIVED]', {
      traffic_source: req.body?.metadata?.traffic_source || 'SYNTHETIC',
      hasFeatures: !!req.body?.features,
      featureCount: req.body?.features ? Object.keys(req.body.features).length : 0
    });

    const validationErrors = validateTrafficPayload(req.body);
    if (validationErrors.length > 0) {
      console.error('[ANALYZE_TRAFFIC_VALIDATION_ERROR]', validationErrors);
      return res.status(400).json({ errors: validationErrors });
    }

    const { src_ip, dest_ip, src_port, dest_port, protocol, features } = req.body;
    const metadata = req.body.metadata || {};
    const suspicionScore = Number(metadata.suspicion_score || 0);
    const suspicionTypes = Array.isArray(metadata.suspicion_types)
      ? metadata.suspicion_types
      : [];
    const groundTruthLabel = metadata.ground_truth_label || null;
    const trafficSource = metadata.traffic_source || 'SYNTHETIC';

    // 0. Defense pre-check: reject if IP already actively blocked
    let existingBlockedIp = null;
    try {
      existingBlockedIp = await fetchBlockedIpByAddress(src_ip);
    } catch (err) {
      console.error('[DEFENSE_FETCH_BLOCKED_IP_ERROR]', err);
      // Continue; do not block traffic solely because the lookup failed
    }

    if (existingBlockedIp && existingBlockedIp.is_blocked) {
      const analyzedAt = new Date().toISOString();

      // Log blocked attempt (does not depend on prediction)
      try {
        await insertTrafficLog({
          src_ip,
          dest_ip,
          src_port: src_port || null,
          dest_port,
          protocol: protocol || null,
          is_attack: true,
          probability: null,
          severity: existingBlockedIp.severity || 'high',
          label: 'BLOCKED_IP',
          analyzed_at: analyzedAt,
          flow_features: features,
          traffic_source: trafficSource
        });
      } catch (logErr) {
        console.error('[DEFENSE_LOG_BLOCKED_ATTEMPT_ERROR]', logErr);
      }

      return res.status(403).json({
        status: 'blocked',
        reason: 'Source IP is already blocked',
        ip_address: src_ip
      });
    }

    // 1. Call ML prediction service (prediction-first)
    console.log('[ML_REQUEST_SENT]', { src_ip, featureCount: Object.keys(features || {}).length });
    const predictionResult = await predictFlow(features);

    if (predictionResult.success) {
      console.log('[ML_RESPONSE_RECEIVED]', {
        src_ip,
        probability: predictionResult.data?.probability,
        is_attack: predictionResult.data?.is_attack,
        label: predictionResult.data?.label
      });
    }

    if (!predictionResult.success) {
      console.error('[PREDICTION_FAILURE]', predictionResult);
      return res.status(502).json({
        error: 'Prediction service unavailable',
        details: predictionResult.message || 'Prediction failed'
      });
    }

    const payload = predictionResult.data || {};

    // --- ML prediction channel ----------------------------------------------
    const mlAttackFromModel = payload.prediction === 1 || payload.is_attack === true;
    const mlProbability =
      typeof payload.probability === 'number' ? payload.probability : payload.attack_probability || 0;
    let severity = payload.severity || deriveSeverity(mlProbability);
    let label = payload.label || (mlAttackFromModel ? 'ATTACK DETECTED' : 'NORMAL TRAFFIC');

    // --- Rule-based channel (suspicion score from victim-app) ---------------
    const ruleScoreNorm = Math.min(Math.max(suspicionScore / 100, 0), 1);

    // --- Hybrid decision fusion ---------------------------------------------
    const mlWeightRaw = Number(process.env.HYBRID_ML_WEIGHT || 0.7);
    const ruleWeightRaw = Number(process.env.HYBRID_RULE_WEIGHT || 0.3);
    const weightSum = mlWeightRaw + ruleWeightRaw || 1;
    const mlWeight = mlWeightRaw / weightSum;
    const ruleWeight = ruleWeightRaw / weightSum;

    const hybridScore = mlWeight * mlProbability + ruleWeight * ruleScoreNorm;
    const hybridThreshold = Number(process.env.HYBRID_ATTACK_THRESHOLD || 0.6);
    const ruleAttackThreshold = Number(process.env.RULE_ATTACK_THRESHOLD || 0.6);
    const mlAttackThreshold = Number(process.env.ML_ATTACK_THRESHOLD || 0.5);

    const mlAttack = mlProbability >= mlAttackThreshold;
    const ruleAttack = ruleScoreNorm >= ruleAttackThreshold;

    const isAttackHybrid = hybridScore >= hybridThreshold;

    // Determine which detector "fired" for research logging.
    let detectionSource = 'ML';
    if (isAttackHybrid) {
      if (mlAttack && ruleAttack) {
        detectionSource = 'HYBRID';
      } else if (mlAttack) {
        detectionSource = 'ML';
      } else if (ruleAttack) {
        detectionSource = 'RULE';
      } else {
        detectionSource = 'HYBRID';
      }
    } else if (!isAttackHybrid && ruleAttack) {
      // Rules are strongly suspicious but final hybrid decision is normal.
      // Mark this as a warning for later false-negative analysis.
      detectionSource = 'RULE_WARNING';
    } else {
      detectionSource = 'ML';
    }

    const isAttack = isAttackHybrid;

    const analyzedAt = new Date().toISOString();

    // 2. Store traffic log in Supabase
    const trafficLogPayload = {
      src_ip,
      dest_ip,
      src_port: src_port || null,
      dest_port,
      protocol: protocol || null,
      is_attack: isAttack,
      probability: mlProbability,
      severity,
      label,
      analyzed_at: analyzedAt,
      flow_features: features,
      ml_probability: mlProbability,
      suspicion_score: suspicionScore,
      hybrid_score: hybridScore,
      detection_source: detectionSource,
      ground_truth_label: groundTruthLabel,
      traffic_source: trafficSource
    };

    let trafficLog;
    try {
      trafficLog = await insertTrafficLog(trafficLogPayload);
      console.log('[DB_TRAFFIC_INSERT_SUCCESS]', { id: trafficLog?.id, traffic_source: trafficSource });
    } catch (dbErr) {
      console.error('[DB_TRAFFIC_INSERT_ERROR]', { error: dbErr.message, stack: dbErr.stack });
      throw dbErr;
    }

    let attackLog = null;
    let blockedIp = null;

    // 3. If attack, insert into attack_logs and blocked_ips
    if (isAttack) {
      attackLog = await insertAttackLog({
        traffic_log_id: trafficLog.id,
        src_ip,
        dest_ip,
        dest_port,
        severity,
        detected_at: analyzedAt,
        probability: mlProbability,
        label
      });
      console.log('[DB_ATTACK_INSERT_SUCCESS]', { id: attackLog?.id });

      blockedIp = await upsertBlockedIp({
        ip_address: src_ip,
        severity,
        reason: 'ML-detected attack',
        first_blocked_at: existingBlockedIp?.first_blocked_at || analyzedAt,
        last_seen_at: analyzedAt,
        is_blocked: true
      });
    }

    return res.status(200).json({
      status: 'ok',
      prediction: isAttack ? 1 : 0,
      label,
      probability: mlProbability,
      severity,
      is_attack: isAttack,
      blocked: !!blockedIp,
      traffic_log: trafficLog,
      attack_log: attackLog,
      blocked_ip: blockedIp
    });
  } catch (error) {
    console.error('[ANALYZE_TRAFFIC_FAILURE]', error);
    return res.status(500).json({
      error: 'Failed to analyze traffic',
      details: error.message || 'Unknown error'
    });
  }
}

module.exports = {
  analyzeTraffic
};

