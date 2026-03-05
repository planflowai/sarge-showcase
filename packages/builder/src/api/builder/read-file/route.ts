import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  validatePathWithinProject,
  logForensicEvent,
} from '@sarge/core/index.server';

// Filenames that are always blocked regardless of project path
const BLOCKED_FILENAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.staging',
];

function isBlockedFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  // Block any file whose name is exactly ".env" or starts with ".env."
  return BLOCKED_FILENAMES.includes(basename) || /^\.env(\..+)?$/.test(basename);
}

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const { path: filePath, projectPath, binary } = await request.json();

    // Require filePath
    if (!filePath) {
      logForensicEvent({
        event: 'Read file rejected: missing path',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'read', error: 'Path is required', clientIp },
      });
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Require projectPath — no reads without a sandbox boundary
    if (!projectPath) {
      logForensicEvent({
        event: 'Read file rejected: missing projectPath',
        severity: 'error',
        category: 'security_violation',
        details: {
          operation: 'read',
          path: filePath,
          error: 'projectPath is required for security validation',
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'projectPath is required for security validation' },
        { status: 400 }
      );
    }

    // Block .env files unconditionally
    if (isBlockedFile(filePath)) {
      logForensicEvent({
        event: `Read file BLOCKED: attempt to read sensitive file "${path.basename(filePath)}"`,
        severity: 'critical',
        category: 'security_violation',
        details: {
          operation: 'read',
          path: filePath,
          projectPath,
          error: 'Sensitive file access denied',
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'Access denied: path outside sandbox' },
        { status: 403 }
      );
    }

    // Validate the file path is within the project sandbox
    const validation = validatePathWithinProject(filePath, projectPath);

    if (!validation.valid) {
      logForensicEvent({
        event: `Read file BLOCKED: ${validation.error}`,
        severity: validation.securityViolation ? 'critical' : 'error',
        category: 'security_violation',
        details: {
          operation: 'read',
          path: filePath,
          projectPath,
          error: validation.error,
          blocked: true,
          clientIp,
        },
      });
      return NextResponse.json(
        { error: 'Access denied: path outside sandbox' },
        { status: 403 }
      );
    }

    const normalizedPath = validation.normalizedPath;

    // Log successful read
    logForensicEvent({
      event: 'Read file validated and executing',
      severity: 'info',
      category: 'file_operation',
      details: {
        operation: 'read',
        path: normalizedPath,
        projectPath,
        clientIp,
      },
    });

    // Binary mode: return base64 data URL (for images)
    if (binary) {
      const buffer = await fs.readFile(normalizedPath);
      const ext = path.extname(normalizedPath).slice(1).toLowerCase();
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        content: dataUrl,
        path: normalizedPath,
        binary: true,
      });
    }

    const content = await fs.readFile(normalizedPath, 'utf-8');

    return NextResponse.json({
      success: true,
      content,
      path: normalizedPath,
    });
  } catch (error: any) {
    logForensicEvent({
      event: 'Read file failed',
      severity: 'error',
      category: 'file_operation',
      details: {
        operation: 'read',
        error: error.message,
        clientIp,
      },
    });

    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read file' },
      { status: 500 }
    );
  }
}
