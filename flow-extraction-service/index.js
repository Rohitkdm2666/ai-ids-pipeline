/**
 * Flow Extraction Service
 *
 * Watches for new .pcap files, runs CICFlowMeter (Python or Java),
 * parses CSV, and sends each flow to IDS /analyze-traffic.
 *
 * Requires: Python cicflowmeter (pip install cicflowmeter)
 *   OR Java CICFlowMeter jar.
 *
 * Logs:
 *   [FLOW_EXTRACTION_COMPLETE]
 *   [FLOW_SENT_TO_IDS]
 *   [ML_PREDICTION_COMPLETE] (logged by IDS)
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const chokidar = require('chokidar');

const FEATURE_COLUMNS = require('./config/feature_columns');
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

const rawPcapDir = process.env.PCAP_DIR || path.join(__dirname, '..', 'packet-capture-service', 'pcap');
const PCAP_DIR = path.isAbsolute(rawPcapDir) ? rawPcapDir : path.resolve(__dirname, rawPcapDir);
const rawCsvDir = process.env.CSV_OUTPUT_DIR || path.join(__dirname, 'csv_output');
const CSV_OUTPUT_DIR = path.isAbsolute(rawCsvDir) ? rawCsvDir : path.resolve(__dirname, rawCsvDir);
const IDS_BACKEND_URL = process.env.IDS_BACKEND_URL || 'http://localhost:3000';
const IDS_API_KEY = process.env.IDS_API_KEY || 'ids-internal-key';
const ANALYZE_ENDPOINT = `${IDS_BACKEND_URL}/analyze-traffic`;
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS) || 50;
const USE_PYTHON_CIC = process.env.USE_PYTHON_CIC !== 'false';
const CICFLOWMETER_JAR = process.env.CICFLOWMETER_JAR || '';

const processedFiles = new Set();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKey(key) {
  return String(key).trim();
}

const COLUMN_ALIASES = {
  'Fwd Header Length.1': ['Fwd Header Length.1', 'Fwd Header Length 2', 'fwd_header_length_2']
};

function buildFeaturesFromRow(row, header) {
  const features = {};
  const headerNorm = header.map((h) => normalizeKey(h));
  const rowMap = {};
  headerNorm.forEach((h, i) => {
    rowMap[h] = row[i];
    rowMap[h.toLowerCase().replace(/\s/g, '_')] = row[i];
  });

  for (const col of FEATURE_COLUMNS) {
    let val = rowMap[col];
    if (val === undefined) {
      const aliases = COLUMN_ALIASES[col] || [col.replace(/\.1$/, ''), col.replace(/\s/g, '')];
      for (const a of aliases) {
        if (rowMap[a] !== undefined) { val = rowMap[a]; break; }
      }
    }
    features[col] = parseNum(val ?? 0);
  }
  return features;
}

function findCol(row, header, names) {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0 && row[i] !== undefined) return row[i];
  }
  return '';
}

function extractFlowIds(row, header) {
  const srcIp = findCol(row, header, ['Source IP', 'Src IP', 'SourceIP', 'src_ip']) || '';
  const destIp = findCol(row, header, ['Destination IP', 'Dst IP', 'DestinationIP', 'dst_ip', 'dest_ip']) || '';
  const srcPort = parseNum(findCol(row, header, ['Source Port', 'Src Port', 'SourcePort', 'src_port']) || 0);
  const destPort = parseNum(findCol(row, header, ['Destination Port', 'Dst Port', 'DestinationPort', 'dest_port', 'dst_port']) || 0);
  const protocol = findCol(row, header, ['Protocol', 'protocol']) || 'TCP';

  return { srcIp, destIp, srcPort, destPort, protocol };
}

function parseCsvToFlows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  // Some CICFlowMeter builds can emit malformed lines (wrong column count).
  // Allow variable-length rows and filter down to rows that match the header.
  const records = parse(raw, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_column_count_less: true
  });
  if (records.length < 2) {
    if (DEBUG_MODE) console.log('[CSV_PARSED_ROWS]', { csvPath, rows: records.length, note: 'need header+1 data row min' });
    return [];
  }

  const header = records[0].map(normalizeKey);
  const csvSet = new Set(header);
  const missingInCsv = FEATURE_COLUMNS.filter(c => !csvSet.has(c) && !csvSet.has(c.toLowerCase().replace(/\s/g, '_')));
  if (missingInCsv.length > 0) {
    console.log('[CSV_PARSED_ROWS]', { csvPath, csvHeadersCount: header.length, expectedCount: 78, missingInCsv: missingInCsv.slice(0, 10) });
  }

  const flows = [];
  let skipped = 0;
  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    // Skip malformed rows that don't match header length
    if (!row || row.length !== header.length) {
      skipped++;
      continue;
    }
    const ids = extractFlowIds(row, header);
    const features = buildFeaturesFromRow(row, header);

    flows.push({
      src_ip: ids.srcIp || '0.0.0.0',
      dest_ip: ids.destIp || '0.0.0.0',
      src_port: ids.srcPort || 0,
      dest_port: ids.destPort || 0,
      protocol: (ids.protocol || 'TCP').toString().toUpperCase(),
      features
    });
  }
  console.log('[CSV_PARSED_ROWS]', {
    csvPath,
    headerMatches78: header.length >= 78,
    flowsParsed: flows.length,
    skippedRows: skipped
  });
  return flows;
}

function isWindows() {
  return process.platform === 'win32';
}

async function runCicFlowMeter(pcapPath) {
  const csvName = path.basename(pcapPath, '.pcap') + '.csv';
  const csvPath = path.join(CSV_OUTPUT_DIR, csvName);
  ensureDir(CSV_OUTPUT_DIR);

  return new Promise((resolve, reject) => {
    let cmd, args;

    if (USE_PYTHON_CIC) {
      // On Windows, Python cicflowmeter needs tcpdump for filtering. Use patched version that reads file directly.
      if (isWindows()) {
        const wrapperPath = path.join(__dirname, 'scripts', 'cicflowmeter_patched.py');
        cmd = 'python';
        args = [wrapperPath, '-f', pcapPath, '-c', csvPath];
      } else {
        cmd = 'cicflowmeter';
        args = ['-f', pcapPath, '-c', csvPath];
      }
    } else if (CICFLOWMETER_JAR) {
      cmd = 'java';
      args = ['-jar', CICFLOWMETER_JAR, path.dirname(pcapPath), CSV_OUTPUT_DIR];
    } else {
      cmd = 'cicflowmeter';
      args = ['-f', pcapPath, '-c', csvPath];
    }

    console.log('[CICFLOWMETER_COMMAND]', { cmd, args: args.join(' '), pcapPath, csvPath });

    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      console.error('[CICFLOWMETER_ERROR]', { message: err.message, cmd, args });
      reject(new Error(`CICFlowMeter failed: ${err.message}. Install: pip install cicflowmeter`));
    });
    proc.on('exit', (code) => {
      if (code === 0) {
        if (stdout) console.log('[CICFLOWMETER_STDOUT]', stdout.trim());
        if (stderr) console.error('[CICFLOWMETER_STDERR]', stderr.trim());
        if (!fs.existsSync(csvPath)) {
          console.error('[CICFLOWMETER_ERROR]', { message: 'CSV file not created', csvPath });
          reject(new Error(`CICFlowMeter exit 0 but CSV not found: ${csvPath}`));
        } else {
          console.log('[CICFLOWMETER_CSV_CREATED]', { csvPath });
          resolve(csvPath);
        }
      } else {
        console.error('[CICFLOWMETER_ERROR]', { exitCode: code, stderr: stderr.trim(), stdout: stdout.trim() });
        reject(new Error(`CICFlowMeter exit ${code}: ${stderr}`));
      }
    });
  });
}

async function sendFlowToIds(flow) {
  const payload = {
    src_ip: flow.src_ip,
    dest_ip: flow.dest_ip,
    src_port: flow.src_port,
    dest_port: flow.dest_port,
    protocol: flow.protocol,
    features: flow.features,
    metadata: {
      traffic_source: 'REAL_PCAP',
      source: 'flow-extraction-service'
    }
  };

  console.log('[FLOW_SENT_TO_IDS]', {
    endpoint: ANALYZE_ENDPOINT,
    src_ip: flow.src_ip,
    dest_ip: flow.dest_ip,
    featureCount: Object.keys(flow.features).length,
    ...(DEBUG_MODE && { sampleFeatures: Object.fromEntries(Object.entries(flow.features).slice(0, 3)) })
  });

  try {
    const res = await axios.post(ANALYZE_ENDPOINT, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'flow-extraction-service',
        'X-API-Key': IDS_API_KEY
      }
    });
    console.log('[IDS_RESPONSE]', {
      src_ip: flow.src_ip,
      dest_ip: flow.dest_ip,
      status: res.status,
      dataKeys: res.data ? Object.keys(res.data) : []
    });
    return { success: true };
  } catch (err) {
    console.error('[IDS_POST_ERROR]', {
      src_ip: flow.src_ip,
      message: err.message,
      code: err.code,
      status: err.response?.status,
      responseData: err.response?.data,
      stack: err.stack
    });
    return { success: false };
  }
}

async function processPcap(pcapPath) {
  if (processedFiles.has(pcapPath)) return;
  processedFiles.add(pcapPath);

  console.log('[FLOW_EXTRACTION_START]', { file: pcapPath });

  try {
    const csvPath = await runCicFlowMeter(pcapPath);
    const flows = parseCsvToFlows(csvPath);

    console.log('[FLOW_EXTRACTION_COMPLETE]', {
      pcap: pcapPath,
      flows: flows.length,
      csv: csvPath
    });

    for (let i = 0; i < flows.length; i++) {
      await sendFlowToIds(flows[i]);
      if (BATCH_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    if (process.env.DELETE_PCAP_AFTER_PROCESS === 'true') {
      try {
        fs.unlinkSync(pcapPath);
      } catch (e) {
        console.error('[DELETE_PCAP_ERROR]', e.message);
      }
    }
  } catch (err) {
    console.error('[FLOW_EXTRACTION_ERROR]', { file: pcapPath, error: err.message });
  }
}

function startWatcher() {
  ensureDir(PCAP_DIR);
  ensureDir(CSV_OUTPUT_DIR);

  console.log('[FLOW_EXTRACTOR_STARTED]', {
    pcapDirAbsolute: PCAP_DIR,
    pcapDirEnv: process.env.PCAP_DIR || '(default)',
    csvOutputDir: CSV_OUTPUT_DIR,
    idsBackend: IDS_BACKEND_URL,
    idsApiKeySet: !!process.env.IDS_API_KEY,
    expectedExtension: '.pcap',
    debugMode: DEBUG_MODE,
    usePythonCic: USE_PYTHON_CIC
  });

  const watcher = chokidar.watch(PCAP_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false
  });

  watcher
    .on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      console.log('[WATCHER_FILE_ADDED]', { filePath, ext, matchesPcap: ext === '.pcap' });
      if (ext === '.pcap') {
        console.log('[PCAP_DETECTED]', { filePath, absolute: path.resolve(filePath) });
        processPcap(filePath).catch((e) => console.error('[PCAP_PROCESS_ERROR]', e));
      }
    });

  watcher.on('error', (err) => console.error('[WATCHER_ERROR]', err));
  watcher.on('ready', () => console.log('[WATCHER_READY]', { watching: PCAP_DIR }));
}

startWatcher();
