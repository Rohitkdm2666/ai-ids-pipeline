// Simulated attack generator for the victim app (SecureBank)
// Usage:
//   cd victim-app
//   node scripts/simulate_attack.js
//
// This will send a mix of normal and malicious-looking requests to
// http://localhost:4000 to exercise the full IDS pipeline.

const axios = require('axios');

const VICTIM_BASE_URL = process.env.VICTIM_BASE_URL || 'http://localhost:4000';

async function sqlInjectionSearch() {
  const query = "' OR 1=1 --";
  console.log('[SIM] SQLi search:', query);
  await axios.get(`${VICTIM_BASE_URL}/search`, {
    params: { q: query },
  });
}

async function xssComment() {
  console.log('[SIM] XSS comment');
  await axios.post(`${VICTIM_BASE_URL}/api/comment`, {
    postId: 1,
    author: 'attacker',
    content: '<script>alert(\"xss\")</script>',
  });
}

async function rapidRequests() {
  console.log('[SIM] Rapid requests (DoS-like)');
  const promises = [];
  for (let i = 0; i < 30; i++) {
    promises.push(
      axios.get(`${VICTIM_BASE_URL}/search`, {
        params: { q: `' OR 1=1 -- [${i}]` },
      }).catch(() => {})
    );
  }
  await Promise.all(promises);
}

async function runSimulation() {
  try {
    console.log('=== Starting attack simulation against victim app ===');

    // Warm-up normal traffic
    await axios.get(`${VICTIM_BASE_URL}/`);
    await axios.get(`${VICTIM_BASE_URL}/login`);

    // Attack-like patterns
    await sqlInjectionSearch();
    await xssComment();
    await rapidRequests();

    console.log('=== Simulation complete. Check IDS dashboard for new traffic/attacks. ===');
  } catch (err) {
    console.error('[SIM_ERROR]', err.message);
  }
}

runSimulation();

