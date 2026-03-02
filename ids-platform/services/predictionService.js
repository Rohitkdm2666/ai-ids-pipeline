const axios = require('axios');

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000/predict';

async function predictFlow(features) {
  try {
    const response = await axios.post(
      PYTHON_API_URL,
      { flow: features },
      {
        timeout: 5000
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    let errorType = 'UNKNOWN_ERROR';
    let message = error.message || 'Unknown error';

    if (error.code === 'ECONNABORTED') {
      errorType = 'TIMEOUT';
    } else if (error.response) {
      errorType = 'HTTP_ERROR';
      message = `Python API error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      errorType = 'NETWORK_ERROR';
    }

    console.error('[PREDICTION_SERVICE_ERROR]', {
      type: errorType,
      message,
      original: error.message
    });

    return {
      success: false,
      errorType,
      message
    };
  }
}

module.exports = {
  predictFlow
};

