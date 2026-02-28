import { NextRequest, NextResponse } from 'next/server';

/**
 * GET/POST /api/builder/dev-status
 *
 * Checks whether a local dev server is reachable.
 * Defaults to localhost:3000 — accepts optional `port` query param.
 * Returns { running: boolean, url: string }
 */

async function checkPort(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || '3000', 10);
  const running = await checkPort(port);
  return NextResponse.json({ running, url: `http://localhost:${port}` });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const port = parseInt(body.port || '3000', 10);
    const running = await checkPort(port);
    return NextResponse.json({ running, url: `http://localhost:${port}` });
  } catch {
    const running = await checkPort(3000);
    return NextResponse.json({ running, url: 'http://localhost:3000' });
  }
}
