/**
 * Traffic Monitoring Middleware
 * 
 * Intercepts all incoming HTTP requests, generates flow features,
 * and sends them to the IDS backend for analysis.
 */

const { analyzeTraffic } = require('../services/idsClient');
const { 
  generateFlowFeatures, 
  detectSuspiciousPatterns,
  extractRequestContent 
} = require('../services/featureGenerator');

// Request rate tracking for detecting rapid requests
const requestCounts = new Map();
const RATE_WINDOW_MS = 10000;
const RAPID_REQUEST_THRESHOLD = 20;

// Skip monitoring for these paths
const SKIP_PATHS = ['/favicon.ico', '/blocked', '/public'];

/**
 * Clean client IP address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  let ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
  
  // Remove IPv6 prefix if present
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Handle localhost
  if (ip === '::1' || ip === '127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

/**
 * Check if IP is making rapid requests
 */
function checkRapidRequests(ip) {
  const now = Date.now();
  const key = ip;
  
  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  }
  
  const timestamps = requestCounts.get(key);
  
  // Remove old timestamps
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  requestCounts.set(key, recent);
  
  return recent.length > RAPID_REQUEST_THRESHOLD;
}

/**
 * Main traffic monitoring middleware
 */
async function trafficMonitor(req, res, next) {
  // Skip monitoring for certain paths
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  const startTime = Date.now();
  const srcIp = getClientIp(req);
  const destIp = req.app.get('serverIp') || '192.168.1.100';
  
  try {
    // Extract request metadata
    const requestMeta = {
      method: req.method,
      url: req.originalUrl || req.url,
      contentLength: parseInt(req.headers['content-length']) || 0,
      headerCount: Object.keys(req.headers).length,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    };
    
    // Extract and analyze request content for suspicious patterns
    const content = extractRequestContent(req);
    const suspicionAnalysis = detectSuspiciousPatterns(content);
    
    // Check for rapid requests (potential DoS)
    const isRapidRequester = checkRapidRequests(srcIp);
    if (isRapidRequester) {
      suspicionAnalysis.score = Math.min(suspicionAnalysis.score + 30, 100);
      if (!suspicionAnalysis.types.includes('rapidRequests')) {
        suspicionAnalysis.types.push('rapidRequests');
      }
    }

    // Derive a simple ground-truth label for simulation & evaluation only.
    // NOTE: This is NOT used for detection, only for offline metrics.
    let groundTruthLabel = 'normal';
    if (suspicionAnalysis.types.includes('sqlInjection')) {
      groundTruthLabel = 'sqlInjection';
    } else if (suspicionAnalysis.types.includes('xss')) {
      groundTruthLabel = 'xss';
    } else if (suspicionAnalysis.types.includes('rapidRequests')) {
      groundTruthLabel = 'rapidRequests';
    } else if (suspicionAnalysis.types.length > 0) {
      groundTruthLabel = suspicionAnalysis.types[0];
    }
    
    // Generate network flow features from HTTP metadata and suspicion context
    const flowFeatures = generateFlowFeatures(
      requestMeta,
      suspicionAnalysis.score,
      suspicionAnalysis.types
    );
    
    // Prepare traffic data for IDS
    const trafficData = {
      src_ip: srcIp,
      dest_ip: destIp,
      src_port: Math.floor(Math.random() * 50000) + 10000,
      dest_port: parseInt(process.env.PORT) || 4000,
      protocol: 'TCP',
      features: flowFeatures,
      metadata: {
        http_method: req.method,
        http_path: req.path,
        user_agent: requestMeta.userAgent,
        content_length: requestMeta.contentLength,
        suspicion_score: suspicionAnalysis.score,
        suspicion_types: suspicionAnalysis.types,
        ground_truth_label: groundTruthLabel,
        source: 'victim-app'
      }
    };
    
    // Log monitoring activity
    console.log('[MONITOR]', {
      ip: srcIp,
      method: req.method,
      path: req.path,
      suspicionScore: suspicionAnalysis.score,
      suspicionTypes: suspicionAnalysis.types
    });
    
    // Send to IDS backend for analysis
    const idsResult = await analyzeTraffic(trafficData);
    
    // Log IDS response
    console.log('[IDS_RESPONSE]', {
      ip: srcIp,
      success: idsResult.success,
      isAttack: idsResult.isAttack,
      isBlocked: idsResult.isBlocked,
      severity: idsResult.severity,
      duration: Date.now() - startTime
    });
    
    // If blocked by IDS, deny access
    if (idsResult.isBlocked) {
      console.log('[BLOCKED]', { ip: srcIp, reason: idsResult.reason || 'Attack detected' });
      
      return res.status(403).render('blocked', {
        title: 'Access Denied',
        message: 'Your request has been blocked due to suspicious activity.',
        ip: srcIp
      });
    }
    
    // Attach IDS result to request for potential use by routes
    req.idsResult = idsResult;
    req.suspicionAnalysis = suspicionAnalysis;
    
    next();
  } catch (error) {
    console.error('[MONITOR_ERROR]', { ip: srcIp, error: error.message });
    
    // Don't block on monitoring errors - fail open
    next();
  }
}

/**
 * Cleanup old request counts periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestCounts.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) {
      requestCounts.delete(key);
    } else {
      requestCounts.set(key, recent);
    }
  }
}, RATE_WINDOW_MS);

module.exports = {
  trafficMonitor,
  getClientIp
};
