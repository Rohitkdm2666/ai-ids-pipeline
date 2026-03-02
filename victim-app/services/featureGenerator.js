/**
 * Feature Generator Service
 *
 * Generates CICIDS2017-style network flow features from HTTP requests
 * using distribution-based sampling.
 *
 * For research realism, feature values are sampled from approximate
 * (mean, std, min, max) statistics derived from CICIDS2017_Processed.csv,
 * stored in config/cicids_feature_stats.json.
 *
 * In production, this would be replaced with real packet capture and
 * feature extraction, but the interface (feature names) would remain
 * identical to preserve ML model compatibility.
 */

const fs = require('fs');
const path = require('path');

// Suspicious patterns that indicate potential attacks (rule-based layer)
const SUSPICIOUS_PATTERNS = {
  sqlInjection: [
    /('|")\s*(or|and)\s*('|"|\d)/i,
    /union\s+select/i,
    /;\s*(drop|delete|insert|update|alter)/i,
    /'\s*--/,
    /1\s*=\s*1/,
    /'\s*or\s*''/i
  ],
  xss: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<img.*onerror/i,
    /alert\s*\(/i
  ],
  pathTraversal: [
    /\.\.\//,
    /\.\.\\/, 
    /%2e%2e/i,
    /etc\/passwd/i,
    /windows\/system32/i
  ],
  commandInjection: [
    /;\s*(ls|cat|rm|wget|curl)/i,
    /\|\s*(ls|cat|rm)/i,
    /`.*`/,
    /\$\(/
  ]
};

/**
 * Analyze request content for suspicious patterns (rule-based detector).
 *
 * This produces:
 *  - suspicion_score: 0–100
 *  - types: ['sqlInjection', 'xss', ...]
 *
 * NOTE: This is a parallel detection channel to the ML model and is
 *       not allowed to override ML predictions directly. It is used
 *       for hybrid decision fusion and research evaluation only.
 */
function detectSuspiciousPatterns(content) {
  if (!content || typeof content !== 'string') return { score: 0, types: [] };
  
  let score = 0;
  const detectedTypes = [];
  
  for (const [type, patterns] of Object.entries(SUSPICIOUS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        score += 25;
        if (!detectedTypes.includes(type)) {
          detectedTypes.push(type);
        }
      }
    }
  }
  
  // Additional heuristics (payload size, symbol density)
  if (content.length > 1000) score += 10;
  if (content.length > 5000) score += 20;
  if ((content.match(/[<>'"`;|&$]/g) || []).length > 10) score += 15;
  
  return {
    score: Math.min(score, 100),
    types: detectedTypes
  };
}

// --- Distribution-based sampling helpers -----------------------------------

// Load approximate CICIDS feature statistics (mean, std, min, max)
let FEATURE_STATS = {};
try {
  const statsPath = path.join(__dirname, '..', 'config', 'cicids_feature_stats.json');
  const raw = fs.readFileSync(statsPath, 'utf8');
  FEATURE_STATS = JSON.parse(raw);
} catch (err) {
  console.error('[FEATURE_STATS_LOAD_ERROR]', err.message);
  FEATURE_STATS = {};
}

/**
 * Sample from a standard normal distribution using Box–Muller.
 */
function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Sample a feature value using (mean, std, min, max) statistics.
 * Falls back to a simple uniform range if stats are missing.
 */
function sampleFeature(name, fallbackMin, fallbackMax) {
  const s = FEATURE_STATS[name];
  if (!s || typeof s.mean !== 'number' || typeof s.std !== 'number') {
    const min = typeof fallbackMin === 'number' ? fallbackMin : 0;
    const max = typeof fallbackMax === 'number' ? fallbackMax : 1;
    return min + Math.random() * (max - min);
  }

  const min = typeof s.min === 'number' ? s.min : fallbackMin ?? (s.mean - 3 * s.std);
  const max = typeof s.max === 'number' ? s.max : fallbackMax ?? (s.mean + 3 * s.std);

  let value = s.mean + s.std * gaussian();
  if (value < min) value = min;
  if (value > max) value = max;
  return value;
}

/**
 * Generate CICIDS2017 features from HTTP request metadata.
 *
 * IMPORTANT:
 *  - 78 feature names MUST match CICIDS2017_Processed.csv (excluding Label).
 *  - We emulate realistic distributions using dataset statistics.
 *  - Suspicion score only affects a small subset of *semantically relevant*
 *    features (e.g., packet rate, bytes/s, flags) to keep behaviour
 *    interpretable for research.
 */
function generateFlowFeatures(requestMeta, suspicionScore = 0, suspicionTypes = []) {
  const {
    method,
    contentLength,
    headerCount,
    url,
    userAgent,
    timestamp
  } = requestMeta;
  
  // Normalized suspicion score used for small, targeted adjustments only
  const suspicionBias = Math.min(Math.max(suspicionScore / 100, 0), 1);

  const isPost = method === 'POST' || method === 'PUT';
  const hasLargePayload = contentLength > 1500;
  const hasSqlInjection = suspicionTypes.includes('sqlInjection');
  const hasXss = suspicionTypes.includes('xss');
  const hasRapid = suspicionTypes.includes('rapidRequests');
  const hasCmd = suspicionTypes.includes('commandInjection');

  // Base features sampled from approximate CICIDS distributions
  const features = {
    'Destination Port': determinePort(url),
    'Flow Duration': sampleFeature('Flow Duration', 0, 65535),
    'Total Fwd Packets': sampleFeature('Total Fwd Packets', 1, 200000),
    'Total Backward Packets': sampleFeature('Total Backward Packets', 0, 200000),
    'Total Length of Fwd Packets': contentLength || sampleFeature('Total Length of Fwd Packets', 0, 10000000),
    'Total Length of Bwd Packets': sampleFeature('Total Length of Bwd Packets', 0, 10000000),
    'Fwd Packet Length Max': sampleFeature('Fwd Packet Length Max', 0, 1500),
    'Fwd Packet Length Min': sampleFeature('Fwd Packet Length Min', 0, 1500),
    'Fwd Packet Length Mean': sampleFeature('Fwd Packet Length Mean', 0, 1500),
    'Fwd Packet Length Std': sampleFeature('Fwd Packet Length Std', 0, 600),
    'Bwd Packet Length Max': sampleFeature('Bwd Packet Length Max', 0, 1500),
    'Bwd Packet Length Min': sampleFeature('Bwd Packet Length Min', 0, 1500),
    'Bwd Packet Length Mean': sampleFeature('Bwd Packet Length Mean', 0, 1500),
    'Bwd Packet Length Std': sampleFeature('Bwd Packet Length Std', 0, 600),
    'Flow Bytes/s': sampleFeature('Flow Bytes/s', 0, 10000000),
    'Flow Packets/s': sampleFeature('Flow Packets/s', 0, 100000),
    'Flow IAT Mean': sampleFeature('Flow IAT Mean', 0, 200000),
    'Flow IAT Std': sampleFeature('Flow IAT Std', 0, 200000),
    'Flow IAT Max': sampleFeature('Flow IAT Max', 0, 200000),
    'Flow IAT Min': sampleFeature('Flow IAT Min', 0, 50000),
    'Fwd IAT Total': sampleFeature('Fwd IAT Total', 0, 200000),
    'Fwd IAT Mean': sampleFeature('Fwd IAT Mean', 0, 200000),
    'Fwd IAT Std': sampleFeature('Fwd IAT Std', 0, 200000),
    'Fwd IAT Max': sampleFeature('Fwd IAT Max', 0, 200000),
    'Fwd IAT Min': sampleFeature('Fwd IAT Min', 0, 50000),
    'Bwd IAT Total': sampleFeature('Bwd IAT Total', 0, 200000),
    'Bwd IAT Mean': sampleFeature('Bwd IAT Mean', 0, 200000),
    'Bwd IAT Std': sampleFeature('Bwd IAT Std', 0, 200000),
    'Bwd IAT Max': sampleFeature('Bwd IAT Max', 0, 200000),
    'Bwd IAT Min': sampleFeature('Bwd IAT Min', 0, 50000),
    'Fwd PSH Flags': sampleFeature('Fwd PSH Flags', 0, 1),
    'Bwd PSH Flags': sampleFeature('Bwd PSH Flags', 0, 1),
    'Fwd URG Flags': sampleFeature('Fwd URG Flags', 0, 1),
    'Bwd URG Flags': sampleFeature('Bwd URG Flags', 0, 1),
    'Fwd Header Length': sampleFeature('Fwd Header Length', 0, 200),
    'Bwd Header Length': sampleFeature('Bwd Header Length', 0, 200),
    'Fwd Packets/s': sampleFeature('Fwd Packets/s', 0, 100000),
    'Bwd Packets/s': sampleFeature('Bwd Packets/s', 0, 100000),
    'Min Packet Length': sampleFeature('Min Packet Length', 0, 1500),
    'Max Packet Length': sampleFeature('Max Packet Length', 0, 1500),
    'Packet Length Mean': sampleFeature('Packet Length Mean', 0, 1500),
    'Packet Length Std': sampleFeature('Packet Length Std', 0, 600),
    'Packet Length Variance': sampleFeature('Packet Length Variance', 0, 200000),
    'FIN Flag Count': sampleFeature('FIN Flag Count', 0, 5),
    'SYN Flag Count': sampleFeature('SYN Flag Count', 0, 5),
    'RST Flag Count': sampleFeature('RST Flag Count', 0, 5),
    'PSH Flag Count': sampleFeature('PSH Flag Count', 0, 5),
    'ACK Flag Count': sampleFeature('ACK Flag Count', 0, 5),
    'URG Flag Count': sampleFeature('URG Flag Count', 0, 5),
    'CWE Flag Count': sampleFeature('CWE Flag Count', 0, 5),
    'ECE Flag Count': sampleFeature('ECE Flag Count', 0, 5),
    'Down/Up Ratio': sampleFeature('Down/Up Ratio', 0, 10),
    'Average Packet Size': sampleFeature('Average Packet Size', 0, 1500),
    'Avg Fwd Segment Size': sampleFeature('Avg Fwd Segment Size', 0, 1500),
    'Avg Bwd Segment Size': sampleFeature('Avg Bwd Segment Size', 0, 1500),
    'Fwd Header Length.1': sampleFeature('Fwd Header Length.1', 0, 200),
    'Fwd Avg Bytes/Bulk': sampleFeature('Fwd Avg Bytes/Bulk', 0, 10000),
    'Fwd Avg Packets/Bulk': sampleFeature('Fwd Avg Packets/Bulk', 0, 100),
    'Fwd Avg Bulk Rate': sampleFeature('Fwd Avg Bulk Rate', 0, 50000),
    'Bwd Avg Bytes/Bulk': sampleFeature('Bwd Avg Bytes/Bulk', 0, 10000),
    'Bwd Avg Packets/Bulk': sampleFeature('Bwd Avg Packets/Bulk', 0, 100),
    'Bwd Avg Bulk Rate': sampleFeature('Bwd Avg Bulk Rate', 0, 50000),
    'Subflow Fwd Packets': sampleFeature('Subflow Fwd Packets', 0, 200000),
    'Subflow Fwd Bytes': sampleFeature('Subflow Fwd Bytes', 0, 10000000),
    'Subflow Bwd Packets': sampleFeature('Subflow Bwd Packets', 0, 200000),
    'Subflow Bwd Bytes': sampleFeature('Subflow Bwd Bytes', 0, 10000000),
    'Init_Win_bytes_forward': sampleFeature('Init_Win_bytes_forward', 0, 65535),
    'Init_Win_bytes_backward': sampleFeature('Init_Win_bytes_backward', 0, 65535),
    'act_data_pkt_fwd': sampleFeature('act_data_pkt_fwd', 0, 1000),
    'min_seg_size_forward': sampleFeature('min_seg_size_forward', 0, 40),
    'Active Mean': sampleFeature('Active Mean', 0, 50000),
    'Active Std': sampleFeature('Active Std', 0, 50000),
    'Active Max': sampleFeature('Active Max', 0, 50000),
    'Active Min': sampleFeature('Active Min', 0, 20000),
    'Idle Mean': sampleFeature('Idle Mean', 0, 200000),
    'Idle Std': sampleFeature('Idle Std', 0, 200000),
    'Idle Max': sampleFeature('Idle Max', 0, 200000),
    'Idle Min': sampleFeature('Idle Min', 0, 100000)
  };

  // --- Targeted suspicion-based adjustments (rule layer influence) ---------
  //
  // IMPORTANT: we only adjust features that have clear semantic meaning
  // with respect to the rule triggers, to preserve interpretability.

  // Rapid request / DoS-like behaviour -> increase packet/byte rates
  if (hasRapid) {
    const factor = 1 + 2 * suspicionBias; // up to 3x
    features['Flow Bytes/s'] *= factor;
    features['Flow Packets/s'] *= factor;
    features['Fwd Packets/s'] *= factor;
    features['Bwd Packets/s'] *= factor;
  }

  // Large payloads -> increase forward bytes and packet length stats
  if (hasLargePayload || hasSqlInjection || hasXss) {
    const factor = 1 + 1.5 * suspicionBias;
    features['Total Length of Fwd Packets'] *= factor;
    features['Average Packet Size'] *= factor;
    features['Fwd Packet Length Mean'] *= factor;
  }

  // Command injection / protocol abuse -> tweak flags / reset counts
  if (hasCmd) {
    const factor = 1 + suspicionBias;
    features['RST Flag Count'] *= factor;
    features['PSH Flag Count'] *= factor;
  }
  
  return features;
}

/**
 * Determine destination port based on URL/protocol
 */
function determinePort(url) {
  if (url.includes(':443') || url.startsWith('https')) return 443;
  if (url.includes(':8080')) return 8080;
  if (url.includes(':3000')) return 3000;
  return 80;
}

/**
 * Extract all text content from request for analysis
 */
function extractRequestContent(req) {
  const parts = [];
  
  // URL and query string
  parts.push(req.originalUrl || req.url);
  
  // Body content
  if (req.body) {
    if (typeof req.body === 'string') {
      parts.push(req.body);
    } else {
      parts.push(JSON.stringify(req.body));
    }
  }
  
  // Headers of interest
  const suspiciousHeaders = ['user-agent', 'referer', 'cookie', 'x-forwarded-for'];
  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      parts.push(req.headers[header]);
    }
  }
  
  return parts.join(' ');
}

module.exports = {
  generateFlowFeatures,
  detectSuspiciousPatterns,
  extractRequestContent
};
