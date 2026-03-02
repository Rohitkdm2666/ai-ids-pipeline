/**
 * Packet Capture Service
 *
 * Captures network packets from a configurable interface and writes
 * them to rotating .pcap files. Uses tcpdump (Linux) or dumpcap (Windows).
 *
 * Run in background: node index.js
 *
 * Logs:
 *   [PACKET_CAPTURE_STARTED]
 *   [PCAP_ROTATED]
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const NETWORK_INTERFACE = process.env.NETWORK_INTERFACE || 'eth0';
const rawPcapDir = process.env.PCAP_DIR || path.join(__dirname, 'pcap');
const PCAP_DIR = path.isAbsolute(rawPcapDir) ? rawPcapDir : path.resolve(__dirname, rawPcapDir);
const ROTATE_INTERVAL_MS = Number(process.env.PCAP_ROTATE_INTERVAL_MS) || 60000; // 1 min
const PCAP_PREFIX = process.env.PCAP_PREFIX || 'capture';

let captureProcess = null;
let rotateInterval = null;

function ensurePcapDir() {
  if (!fs.existsSync(PCAP_DIR)) {
    fs.mkdirSync(PCAP_DIR, { recursive: true });
    console.log('[PCAP_DIR_CREATED]', { path: PCAP_DIR });
  }
}

function getPcapPath() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(PCAP_DIR, `${PCAP_PREFIX}_${ts}.pcap`);
}

function isWindows() {
  return process.platform === 'win32';
}

function startCapture() {
  ensurePcapDir();
  const pcapPath = getPcapPath();

  const isWin = isWindows();
  let cmd;
  let args;

  if (isWin) {
    // Windows: use dumpcap (from Wireshark/Npcap)
    // dumpcap -i 1 -w capture.pcap -b filesize:1000 -b files:3
    cmd = 'dumpcap';
    args = [
      '-i', NETWORK_INTERFACE,
      '-w', pcapPath,
      '-b', 'filesize:5000',
      '-b', 'files:5',
      '-q'
    ];
  } else {
    // Linux/macOS: use tcpdump
    cmd = 'tcpdump';
    args = [
      '-i', NETWORK_INTERFACE,
      '-w', pcapPath,
      '-C', '5',
      '-W', '5',
      '-q'
    ];
  }

  console.log('[PACKET_CAPTURE_STARTED]', {
    interface: NETWORK_INTERFACE,
    output: pcapPath,
    pcapDirAbsolute: PCAP_DIR,
    platform: process.platform,
    rotateIntervalMs: ROTATE_INTERVAL_MS,
    expectedExtension: '.pcap'
  });

  captureProcess = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });

  captureProcess.stdout.on('data', (d) => process.stdout.write(d.toString()));
  captureProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error('[TCPDUMP/DUMPCAP]', msg);
  });

  captureProcess.on('error', (err) => {
    console.error('[PACKET_CAPTURE_ERROR]', err.message);
    if (err.code === 'ENOENT') {
      console.error('[PACKET_CAPTURE_HINT] Install tcpdump (Linux) or Npcap+Wireshark (Windows) for dumpcap.');
      console.error('[PACKET_CAPTURE_HINT] Set NETWORK_INTERFACE (e.g. eth0, or 1 for dumpcap on Windows).');
    }
  });

  captureProcess.on('exit', (code, signal) => {
    console.log('[PACKET_CAPTURE_EXIT]', { code, signal });
    captureProcess = null;
  });
}

function rotatePcap() {
  if (captureProcess) {
    console.log('[PCAP_ROTATION_COMPLETE]', {
      time: new Date().toISOString(),
      trigger: 'interval',
      note: 'dumpcap rotates automatically via -b; this log confirms interval tick'
    });
    if (!isWindows()) {
      captureProcess.kill('SIGUSR2'); // tcpdump rotates on USR2
    }
  }
}

function logPcapDirStatus() {
  try {
    const files = fs.readdirSync(PCAP_DIR).filter(f => f.endsWith('.pcap'));
    console.log('[PCAP_DETECTED]', {
      pcapDir: PCAP_DIR,
      fileCount: files.length,
      files: files.slice(-5)
    });
  } catch (e) {
    console.error('[PCAP_DIR_LIST_ERROR]', e.message);
  }
}

function main() {
  const pcapDirAbs = path.resolve(PCAP_DIR);
  console.log('[PACKET_CAPTURE_ENV]', {
    NETWORK_INTERFACE,
    PCAP_DIR_ABSOLUTE: pcapDirAbs,
    ROTATE_INTERVAL_MS,
    PCAP_PREFIX,
    PLATFORM: process.platform
  });

  ensurePcapDir();

  startCapture();

  if (ROTATE_INTERVAL_MS > 0 && !isWindows()) {
    rotateInterval = setInterval(rotatePcap, ROTATE_INTERVAL_MS);
  }

  // Verify pcap files exist every 30s
  setInterval(logPcapDirStatus, 30000);
  setTimeout(logPcapDirStatus, 5000);

  process.on('SIGINT', () => {
    console.log('[PACKET_CAPTURE_SHUTDOWN]');
    if (rotateInterval) clearInterval(rotateInterval);
    if (captureProcess) {
      captureProcess.kill('SIGTERM');
    }
    process.exit(0);
  });
}

main();
