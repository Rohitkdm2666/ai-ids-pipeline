/**
 * IDS Backend Client Service
 * 
 * Handles communication with the IDS backend for traffic analysis.
 */

const axios = require('axios');

const IDS_BACKEND_URL = process.env.IDS_BACKEND_URL || 'http://localhost:3000';
const IDS_API_KEY = process.env.IDS_API_KEY || 'ids-internal-key';
const ANALYZE_ENDPOINT = `${IDS_BACKEND_URL}/analyze-traffic`;
const TIMEOUT_MS = 5000;

/**
 * Send traffic data to IDS backend for analysis
 * 
 * @param {Object} trafficData - Traffic data containing flow features and metadata
 * @returns {Object} - { success, isAttack, isBlocked, data, error }
 */
async function analyzeTraffic(trafficData) {
  try {
    const response = await axios.post(ANALYZE_ENDPOINT, trafficData, {
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'victim-app',
        'X-API-Key': IDS_API_KEY
      }
    });
    
    const data = response.data;
    
    return {
      success: true,
      isAttack: data.is_attack || false,
      isBlocked: data.status === 'blocked',
      severity: data.severity || null,
      probability: data.probability || null,
      data
    };
  } catch (error) {
    // Handle 403 (blocked) response
    if (error.response && error.response.status === 403) {
      console.log('[IDS_CLIENT] Traffic blocked by IDS:', error.response.data);
      return {
        success: true,
        isAttack: true,
        isBlocked: true,
        reason: error.response.data.reason || 'Blocked by IDS',
        data: error.response.data
      };
    }
    
    // Handle other errors
    let errorType = 'UNKNOWN';
    let message = error.message;
    
    if (error.code === 'ECONNABORTED') {
      errorType = 'TIMEOUT';
      message = 'IDS backend request timed out';
    } else if (error.code === 'ECONNREFUSED') {
      errorType = 'CONNECTION_REFUSED';
      message = 'Could not connect to IDS backend';
    } else if (error.response) {
      errorType = 'HTTP_ERROR';
      message = `IDS returned ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    
    console.error('[IDS_CLIENT_ERROR]', { type: errorType, message });
    
    return {
      success: false,
      isAttack: false,
      isBlocked: false,
      error: { type: errorType, message }
    };
  }
}

/**
 * Check if IDS backend is healthy
 */
async function checkHealth() {
  try {
    const response = await axios.get(`${IDS_BACKEND_URL}/`, {
      timeout: 3000
    });
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

module.exports = {
  analyzeTraffic,
  checkHealth,
  IDS_BACKEND_URL
};
