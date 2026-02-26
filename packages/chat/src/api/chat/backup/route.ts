import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'chat');
const BACKUP_FILE = path.join(BACKUP_DIR, 'conversations.json');

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

// POST — Save conversations + messages to disk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversations, messages } = body;

    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json({ error: 'Missing conversations array' }, { status: 400 });
    }

    await ensureDir(BACKUP_DIR);

    const backup = {
      version: 1,
      savedAt: new Date().toISOString(),
      conversationCount: conversations.length,
      conversations,
      messages: messages || {},
    };

    await fs.writeFile(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      path: BACKUP_FILE,
      conversationCount: conversations.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — Load conversations + messages from disk backup
export async function GET() {
  try {
    await ensureDir(BACKUP_DIR);

    try {
      const content = await fs.readFile(BACKUP_FILE, 'utf-8');
      const backup = JSON.parse(content);
      return NextResponse.json(backup);
    } catch {
      return NextResponse.json({ conversations: [], messages: {}, conversationCount: 0 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
