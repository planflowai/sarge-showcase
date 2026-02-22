import { NextResponse } from 'next/server';

/**
 * Health check endpoint for daemon/service monitoring
 * Returns system status and basic diagnostics
 */
export async function GET() {
  const now = new Date().toISOString();

  // Check air-gap mode from environment
  const airGapMode = process.env.SARGE_AIR_GAP === '1';

  // Basic health check
  const health = {
    status: 'ok',
    timestamp: now,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    environment: process.env.NODE_ENV || 'development',
    airGapMode,
  };

  return NextResponse.json(health, { status: 200 });
}
