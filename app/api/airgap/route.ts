import { NextResponse } from 'next/server';
import dns from 'dns';

/**
 * Air-gap detection endpoint
 * Checks if the system has outbound network access
 * Returns air-gap status for the dashboard
 */
export async function GET() {
  // Check environment override first
  if (process.env.SARGE_AIR_GAP === '1') {
    return NextResponse.json({
      airGapMode: true,
      reason: 'environment',
      message: 'AIR-GAP MODE ACTIVE: Forced by SARGE_AIR_GAP=1 environment variable.',
    });
  }

  // Try DNS lookup to check network
  const networkAvailable = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 3000);

    dns.lookup('api.openai.com', (err) => {
      clearTimeout(timeout);
      resolve(!err);
    });
  });

  if (!networkAvailable) {
    return NextResponse.json({
      airGapMode: true,
      reason: 'network',
      message: 'AIR-GAP MODE ACTIVE: No outbound network detected. Running fully local.',
    });
  }

  return NextResponse.json({
    airGapMode: false,
    reason: 'none',
    message: 'NETWORK DETECTED: Cloud fallback available. Air-gap mode disabled.',
  });
}
