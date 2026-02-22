import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs', 'batch');

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

// POST - Save a batch log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId, pass, data } = body;

    if (!batchId || !pass || !data) {
      return NextResponse.json({ error: 'Missing batchId, pass, or data' }, { status: 400 });
    }

    const batchDir = path.join(LOGS_DIR, batchId);
    await ensureDir(batchDir);

    const filename = `${pass}.json`;
    const filepath = path.join(batchDir, filename);

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');

    // Also write/update the batch manifest
    const manifestPath = path.join(batchDir, 'manifest.json');
    let manifest: any = { batchId, createdAt: new Date().toISOString(), passes: {} };
    try {
      const existing = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(existing);
    } catch {}
    manifest.passes[pass] = {
      filename,
      savedAt: new Date().toISOString(),
      testCount: data.tests?.length || 0,
    };
    manifest.updatedAt = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return NextResponse.json({ success: true, path: filepath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - List batch logs or read a specific one
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const pass = searchParams.get('pass');

    await ensureDir(LOGS_DIR);

    // List all batches
    if (!batchId) {
      const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
      const batches = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const manifestPath = path.join(LOGS_DIR, entry.name, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            batches.push(manifest);
          } catch {
            batches.push({ batchId: entry.name, passes: {} });
          }
        }
      }
      return NextResponse.json({ batches });
    }

    // Read specific pass
    if (pass) {
      const filepath = path.join(LOGS_DIR, batchId, `${pass}.json`);
      const content = await fs.readFile(filepath, 'utf-8');
      return NextResponse.json(JSON.parse(content));
    }

    // Read manifest for a batch
    const manifestPath = path.join(LOGS_DIR, batchId, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    return NextResponse.json(manifest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
