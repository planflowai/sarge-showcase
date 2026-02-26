/**
 * Builder Asset Proxy
 *
 * Serves binary files (images, fonts, etc.) from a project folder.
 * Used by the preview iframe to load assets via absolute URLs
 * instead of broken relative paths in srcdoc.
 *
 * GET /api/builder/asset?projectPath=/path/to/project&file=assets/logo.png
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');
  const file = searchParams.get('file');

  if (!projectPath || !file) {
    return NextResponse.json(
      { error: 'projectPath and file are required' },
      { status: 400 }
    );
  }

  // Normalize and resolve the full path
  const normalizedProject = path.normalize(path.resolve(projectPath));
  const cleanFile = file.replace(/^[\/\\]+/, ''); // Strip leading slashes
  const fullPath = path.normalize(path.join(normalizedProject, cleanFile));

  // Security: ensure the resolved path is within the project directory
  if (!fullPath.startsWith(normalizedProject)) {
    return NextResponse.json(
      { error: 'Access denied: path traversal detected' },
      { status: 403 }
    );
  }

  try {
    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File not found', file },
        { status: 404 }
      );
    }
    console.error('[asset] Error serving file:', err);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}
