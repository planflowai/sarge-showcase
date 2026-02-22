#!/usr/bin/env node
/**
 * SARGE Daemon Service
 *
 * Background service for running SARGE poison pill detection.
 * Supports Windows, Linux, and Docker environments.
 *
 * Usage:
 *   node sarge-daemon.js start       - Start daemon in background
 *   node sarge-daemon.js stop        - Stop the daemon
 *   node sarge-daemon.js status      - Check daemon status (one-line)
 *   node sarge-daemon.js run-batch   - Trigger a batch test
 *   node sarge-daemon.js --silent    - Start in silent mode (no console output)
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const dns = require('dns');

// Configuration
const CONFIG = {
  pidFile: path.join(__dirname, '..', 'logs', 'sarge-daemon.pid'),
  logFile: path.join(__dirname, '..', 'logs', 'sarge.log'),
  statusFile: path.join(__dirname, '..', 'logs', 'sarge-status.json'),
  port: process.env.SARGE_PORT || 3000,
  host: process.env.SARGE_HOST || 'localhost',
  silent: process.argv.includes('--silent') || process.argv.includes('-s'),
};

// Ensure logs directory exists
const logsDir = path.dirname(CONFIG.pidFile);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================================================
// LOGGING
// ============================================================================

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  fs.appendFileSync(CONFIG.logFile, line);
  if (!CONFIG.silent && process.stdout.isTTY) {
    const colors = { INFO: '\x1b[0m', WARN: '\x1b[33m', ERROR: '\x1b[31m', SUCCESS: '\x1b[32m', AIRGAP: '\x1b[36m' };
    console.log(`${colors[level] || colors.INFO}${line.trim()}\x1b[0m`);
  }
}

// ============================================================================
// AIR-GAP COMPLIANCE
// ============================================================================

let airGapMode = false;
let lastNetworkCheck = null;

async function checkAirGap() {
  return new Promise((resolve) => {
    // Try DNS lookup to check network
    dns.lookup('api.openai.com', (err) => {
      if (err) {
        airGapMode = true;
        log('AIR-GAP MODE ACTIVE: No outbound network detected. Running fully local.', 'AIRGAP');
        resolve(true);
      } else {
        airGapMode = false;
        log('NETWORK DETECTED: Cloud fallback available. Air-gap mode disabled.', 'WARN');
        resolve(false);
      }
    });
    // Timeout after 3 seconds
    setTimeout(() => {
      if (lastNetworkCheck === null) {
        airGapMode = true;
        log('AIR-GAP MODE ACTIVE: Network check timed out. Running fully local.', 'AIRGAP');
        resolve(true);
      }
    }, 3000);
  });
}

// ============================================================================
// STATUS TRACKING
// ============================================================================

let runtimeStats = {
  truthLockedCount: 0,
  lastKillTime: null,
  recoveredTotal: 0,
  testsRun: 0,
  startTime: null,
  airGapMode: false,
};

function updateStatus(updates) {
  Object.assign(runtimeStats, updates);
  runtimeStats.airGapMode = airGapMode;

  // Write status file
  const status = {
    ...runtimeStats,
    uptime: runtimeStats.startTime ? Math.floor((Date.now() - new Date(runtimeStats.startTime).getTime()) / 1000) : 0,
    timestamp: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(CONFIG.statusFile, JSON.stringify(status, null, 2));
  } catch (e) {
    // Ignore write errors
  }
}

function getStatusLine() {
  const lastKillDisplay = runtimeStats.lastKillTime
    ? new Date(runtimeStats.lastKillTime).toISOString().replace('T', ' ').slice(0, 19)
    : 'never';

  const recentKill = runtimeStats.lastKillTime &&
    (Date.now() - new Date(runtimeStats.lastKillTime).getTime()) < 3600000; // 1 hour

  const statusColor = recentKill ? 'RED' : 'GREEN';
  const airGapStatus = airGapMode ? ' | AIR-GAP: ON' : '';

  return `[${statusColor}] Truth locked: ${runtimeStats.truthLockedCount} facts | Last kill: ${lastKillDisplay} | Recovered total: ${runtimeStats.recoveredTotal}${airGapStatus}`;
}

// ============================================================================
// PROCESS MANAGEMENT
// ============================================================================

function isRunning() {
  if (!fs.existsSync(CONFIG.pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // Process not running, clean up stale PID file
    try { fs.unlinkSync(CONFIG.pidFile); } catch (e) {}
    return false;
  }
}

async function start() {
  if (isRunning()) {
    if (!CONFIG.silent) console.log('SARGE daemon is already running');
    return;
  }

  log('Starting SARGE daemon...', 'INFO');
  runtimeStats.startTime = new Date().toISOString();

  // Check air-gap status on startup
  await checkAirGap();

  const projectDir = path.join(__dirname, '..');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: projectDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      SARGE_AIR_GAP: airGapMode ? '1' : '0',
    },
  });

  // Write PID file
  fs.writeFileSync(CONFIG.pidFile, child.pid.toString());

  // Pipe output to log file
  const logStream = fs.createWriteStream(CONFIG.logFile, { flags: 'a' });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  // Parse stdout for status updates
  child.stdout.on('data', (data) => {
    const text = data.toString();
    // Parse kill events
    if (text.includes('KILL_TRIGGERED') || text.includes('DETERMINISTIC KILL')) {
      runtimeStats.lastKillTime = new Date().toISOString();
      updateStatus({});
      log('Kill triggered - status updated', 'SUCCESS');
    }
    // Parse recovery events
    if (text.includes('RECOVERY ACTIVATED') || text.includes('recovered')) {
      runtimeStats.recoveredTotal++;
      updateStatus({});
    }
    // Parse truth locking
    if (text.includes('LOCKED TRUTH') || text.includes('truth anchor')) {
      runtimeStats.truthLockedCount++;
      updateStatus({});
    }
  });

  child.unref();

  updateStatus({});
  log(`SARGE daemon started with PID ${child.pid}`, 'SUCCESS');

  if (!CONFIG.silent) {
    console.log(`SARGE daemon started with PID ${child.pid}`);
    console.log(`Dashboard: http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`Status: http://${CONFIG.host}:${CONFIG.port}/api/status`);
    console.log(`Logs: ${CONFIG.logFile}`);
    console.log(`Air-gap mode: ${airGapMode ? 'ACTIVE' : 'OFF'}`);
  }
}

function stop() {
  if (!isRunning()) {
    if (!CONFIG.silent) console.log('SARGE daemon is not running');
    return;
  }

  const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
  log(`Stopping SARGE daemon (PID ${pid})...`, 'INFO');

  try {
    if (process.platform === 'win32') {
      exec(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGTERM');
    }
    fs.unlinkSync(CONFIG.pidFile);
    log('SARGE daemon stopped', 'SUCCESS');
    if (!CONFIG.silent) console.log('SARGE daemon stopped');
  } catch (e) {
    log(`Error stopping daemon: ${e.message}`, 'ERROR');
    if (!CONFIG.silent) console.error(`Error stopping daemon: ${e.message}`);
  }
}

function status() {
  if (isRunning()) {
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());

    // Load status from file if exists
    if (fs.existsSync(CONFIG.statusFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(CONFIG.statusFile, 'utf8'));
        Object.assign(runtimeStats, saved);
      } catch (e) {}
    }

    const statusLine = getStatusLine();
    console.log(statusLine);

    if (!CONFIG.silent) {
      console.log(`PID: ${pid} | URL: http://${CONFIG.host}:${CONFIG.port}`);
    }
  } else {
    console.log('[STOPPED] SARGE daemon is not running');
  }
}

async function runBatch() {
  if (!isRunning()) {
    console.log('SARGE daemon is not running. Start it first.');
    return;
  }

  const data = JSON.stringify({ source: 'local', testCount: 5, speedMode: 4 });
  const options = {
    hostname: CONFIG.host,
    port: CONFIG.port,
    path: '/api/test/batch',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        log('Batch test triggered', 'SUCCESS');
        if (!CONFIG.silent) console.log('Batch test triggered successfully');
      } else {
        log(`Batch trigger failed: ${res.statusCode}`, 'ERROR');
      }
    });
  });
  req.on('error', (e) => log(`Batch trigger error: ${e.message}`, 'ERROR'));
  req.write(data);
  req.end();
}

// ============================================================================
// STATUS HTTP SERVER (for /api/status endpoint proxy)
// ============================================================================

function startStatusServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/status' || req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });

      // Load latest status
      if (fs.existsSync(CONFIG.statusFile)) {
        try {
          const saved = JSON.parse(fs.readFileSync(CONFIG.statusFile, 'utf8'));
          Object.assign(runtimeStats, saved);
        } catch (e) {}
      }

      res.end(JSON.stringify({
        status: isRunning() ? 'running' : 'stopped',
        line: getStatusLine(),
        ...runtimeStats,
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const statusPort = parseInt(CONFIG.port) + 1;
  server.listen(statusPort, CONFIG.host, () => {
    log(`Status server running on http://${CONFIG.host}:${statusPort}/status`, 'INFO');
  });
}

// ============================================================================
// MAIN
// ============================================================================

const command = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) || 'status';

switch (command) {
  case 'start':
    start().then(() => {
      if (!CONFIG.silent) startStatusServer();
    });
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  case 'run-batch':
    runBatch();
    break;
  case 'restart':
    stop();
    setTimeout(() => start(), 1000);
    break;
  default:
    console.log('SARGE Daemon - Background poison pill detection service');
    console.log('');
    console.log('Usage:');
    console.log('  node sarge-daemon.js start [--silent]  Start daemon (silent: no console output)');
    console.log('  node sarge-daemon.js stop              Stop the daemon');
    console.log('  node sarge-daemon.js status            One-line status output');
    console.log('  node sarge-daemon.js restart           Restart the daemon');
    console.log('  node sarge-daemon.js run-batch         Trigger a batch test');
    console.log('');
    console.log('Status format:');
    console.log('  [GREEN/RED] Truth locked: X | Last kill: YYYY-MM-DD HH:MM | Recovered: Y');
    console.log('  (RED if kill fired in last hour, GREEN otherwise)');
    break;
}
