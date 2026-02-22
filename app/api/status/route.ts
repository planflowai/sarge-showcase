import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import dns from 'dns';
import { AIR_GAP_CHECK_HOST } from '@/lib/constants';

// Cache air-gap status (checked once on first request)
let airGapChecked = false;
let airGapMode = process.env.SARGE_AIR_GAP === '1';

async function checkAirGap(): Promise<boolean> {
  if (airGapChecked) return airGapMode;

  // Environment override
  if (process.env.SARGE_AIR_GAP === '1') {
    airGapChecked = true;
    airGapMode = true;
    console.log('[SARGE] AIR-GAP MODE ACTIVE: Forced by SARGE_AIR_GAP=1 environment variable.');
    return true;
  }

  // Network check
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      airGapChecked = true;
      airGapMode = true;
      console.log('[SARGE] AIR-GAP MODE ACTIVE: Network check timed out. Running fully local.');
      resolve(true);
    }, 3000);

    dns.lookup(AIR_GAP_CHECK_HOST, (err) => {
      clearTimeout(timeout);
      airGapChecked = true;
      if (err) {
        airGapMode = true;
        console.log('[SARGE] AIR-GAP MODE ACTIVE: No outbound network detected. Running fully local.');
        resolve(true);
      } else {
        airGapMode = false;
        console.log('[SARGE] NETWORK DETECTED: Cloud fallback available. Air-gap mode disabled.');
        resolve(false);
      }
    });
  });
}

/**
 * Status endpoint for daemon monitoring
 * Returns one-line status: "Truth locked: X | Last kill: YYYY-MM-DD | Recovered: Y"
 * Color: GREEN if no recent kill, RED if kill in last hour
 */
export async function GET() {
  // Check air-gap on first request
  await checkAirGap();

  const statusFile = path.join(process.cwd(), 'logs', 'sarge-status.json');

  let stats = {
    truthLockedCount: 0,
    lastKillTime: null as string | null,
    recoveredTotal: 0,
    testsRun: 0,
    startTime: null as string | null,
    airGapMode,
  };

  // Try to load status from file
  try {
    const data = await fs.readFile(statusFile, 'utf8');
    stats = { ...stats, ...JSON.parse(data) };
  } catch (e) {
    // File doesn't exist or can't be read - use defaults
  }

  // Calculate status color
  const recentKill = stats.lastKillTime &&
    (Date.now() - new Date(stats.lastKillTime).getTime()) < 3600000;

  const statusColor = recentKill ? 'RED' : 'GREEN';

  const lastKillDisplay = stats.lastKillTime
    ? new Date(stats.lastKillTime).toISOString().replace('T', ' ').slice(0, 19)
    : 'never';

  const airGapStatus = stats.airGapMode ? ' | AIR-GAP: ON' : '';

  const line = `[${statusColor}] Truth locked: ${stats.truthLockedCount} facts | Last kill: ${lastKillDisplay} | Recovered total: ${stats.recoveredTotal}${airGapStatus}`;

  return NextResponse.json({
    status: 'running',
    color: statusColor,
    line,
    truthLockedCount: stats.truthLockedCount,
    lastKillTime: stats.lastKillTime,
    recoveredTotal: stats.recoveredTotal,
    testsRun: stats.testsRun,
    startTime: stats.startTime,
    airGapMode: stats.airGapMode,
    uptime: stats.startTime
      ? Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000)
      : 0,
  });
}
