const supabase = require('../config/supabaseClient');

/**
 * Evaluation controller
 *
 * Computes basic research metrics comparing:
 *  - ML-only detector
 *  - Rule-only detector (suspicion score)
 *  - Hybrid detector (stored hybrid_score)
 *
 * Ground truth is taken from traffic_logs.ground_truth_label,
 * which is ONLY set by simulation traffic from the victim app
 * and must not be used in detection decisions.
 */

function buildConfusion() {
  return {
    tp: 0,
    fp: 0,
    tn: 0,
    fn: 0
  };
}

function updateConfusion(conf, predictedAttack, actualAttack) {
  if (actualAttack) {
    if (predictedAttack) conf.tp += 1;
    else conf.fn += 1;
  } else {
    if (predictedAttack) conf.fp += 1;
    else conf.tn += 1;
  }
}

function metricsFromConfusion(conf) {
  const { tp, fp, tn, fn } = conf;
  const total = tp + fp + tn + fn || 1;
  const detectionRate = tp + fn > 0 ? tp / (tp + fn) : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0;

  return {
    total,
    tp,
    fp,
    tn,
    fn,
    detection_rate: Number(detectionRate.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    false_positive_rate: Number(falsePositiveRate.toFixed(4)),
    false_negative_rate: Number(falseNegativeRate.toFixed(4))
  };
}

async function getEvaluationMetrics(req, res) {
  try {
    const mlThreshold = Number(process.env.ML_ATTACK_THRESHOLD || 0.5);
    const ruleThreshold = Number(process.env.RULE_ATTACK_THRESHOLD || 0.6);
    const hybridThreshold = Number(process.env.HYBRID_ATTACK_THRESHOLD || 0.6);

    // Only evaluate flows that have a simulation ground truth label.
    const { data, error } = await supabase
      .from('traffic_logs')
      .select('ml_probability,suspicion_score,hybrid_score,ground_truth_label')
      .not('ground_truth_label', 'is', null);

    if (error) {
      console.error('[DB_ERROR_EVAL_FETCH_TRAFFIC]', error);
      return res.status(500).json({ error: 'Failed to fetch traffic logs for evaluation' });
    }

    const mlConf = buildConfusion();
    const ruleConf = buildConfusion();
    const hybridConf = buildConfusion();

    let sampleCount = 0;

    for (const row of data || []) {
      const gtLabel = row.ground_truth_label;
      if (!gtLabel) continue;

      const actualAttack = gtLabel && gtLabel !== 'normal';

      const mlProb = typeof row.ml_probability === 'number' ? row.ml_probability : 0;
      const suspScore = typeof row.suspicion_score === 'number' ? row.suspicion_score : 0;
      const hybridScore = typeof row.hybrid_score === 'number' ? row.hybrid_score : 0;

      const mlAttack = mlProb >= mlThreshold;
      const ruleAttack = suspScore / 100 >= ruleThreshold;
      const hybridAttack = hybridScore >= hybridThreshold;

      updateConfusion(mlConf, mlAttack, actualAttack);
      updateConfusion(ruleConf, ruleAttack, actualAttack);
      updateConfusion(hybridConf, hybridAttack, actualAttack);

      sampleCount += 1;
    }

    return res.json({
      samples_evaluated: sampleCount,
      ml: metricsFromConfusion(mlConf),
      rule: metricsFromConfusion(ruleConf),
      hybrid: metricsFromConfusion(hybridConf)
    });
  } catch (err) {
    console.error('[EVAL_METRICS_ERROR]', err);
    return res.status(500).json({
      error: 'Failed to compute evaluation metrics',
      details: err.message || 'Unknown error'
    });
  }
}

module.exports = {
  getEvaluationMetrics
};

