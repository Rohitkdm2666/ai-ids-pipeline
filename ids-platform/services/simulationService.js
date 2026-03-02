const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Simple CSV line parser that:
 * - splits on commas
 * - does not handle quoted commas (sufficient for this dataset)
 */
function parseCsvLine(line) {
  return line.split(',').map((v) => v.trim());
}

async function simulateFromSampleCsv({ limit = 100, delayMs = 200 } = {}) {
  const datasetPath = path.join(
    __dirname,
    '..',
    '..',
    'Data',
    'Processed Data',
    'CICIDS2017_Processed.csv'
  );

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Sample dataset not found at ${datasetPath}`);
  }

  const stream = fs.createReadStream(datasetPath);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let headers = null;
  let count = 0;

  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    if (count >= limit) break;
    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      if (idx >= values.length) return;
      const raw = values[idx];
      const num = Number(raw);
      row[h] = Number.isNaN(num) ? raw : num;
    });

    // Separate label if present
    const { Label: label, ...features } = row;

    // Basic synthetic network identifiers (not in original dataset)
    const srcIp = `10.0.${(count % 254) + 1}.${(count % 200) + 10}`;
    const destIp = `192.168.0.${(count % 200) + 1}`;

    try {
      await axios.post(`${BACKEND_URL}/analyze-traffic`, {
        src_ip: srcIp,
        dest_ip: destIp,
        src_port: 12345,
        dest_port: features['Destination Port'] || 80,
        protocol: 'TCP',
        features
      });
    } catch (error) {
      console.error('Simulation request failed:', error.message);
    }

    count += 1;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { simulated: count };
}

module.exports = {
  simulateFromSampleCsv
};

