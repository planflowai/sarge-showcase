import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  validatePathWithinProject,
  logForensicEvent,
} from '@sarge/core';

const MAX_CONTENT_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  // Reject oversized requests via Content-Length header before parsing body
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredBytes = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredBytes) && declaredBytes > MAX_CONTENT_BYTES) {
      logForensicEvent({
        event: 'Write file BLOCKED: payload too large (Content-Length)',
        severity: 'warning',
        category: 'file_operation',
        details: {
          operation: 'write',
          error: `Declared Content-Length ${declaredBytes} exceeds 5 MB limit`,
          clientIp,
        },
      });
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
  }

  try {
    const { path: filePath, content, projectPath } = await request.json();

    console.log('[write-file] Request received:', {
      filePath,
      projectPath,
      contentLength: content?.length,
    });

    // Reject if content exceeds 5 MB (byte-accurate check after parsing)
    if (typeof content === 'string') {
      const byteLength = Buffer.byteLength(content, 'utf-8');
      if (byteLength > MAX_CONTENT_BYTES) {
        logForensicEvent({
          event: 'Write file BLOCKED: payload too large (content)',
          severity: 'warning',
          category: 'file_operation',
          details: {
            operation: 'write',
            path: filePath,
            error: `Content size ${byteLength} bytes exceeds 5 MB limit`,
            clientIp,
          },
        });
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }
    }

    // Validate required fields
    if (!filePath) {
      logForensicEvent({
        event: 'Write file rejected: missing path',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'write', error: 'Path is required', clientIp },
      });
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    if (content === undefined) {
      logForensicEvent({
        event: 'Write file rejected: missing content',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'write', path: filePath, error: 'Content is required', clientIp },
      });
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!projectPath) {
      logForensicEvent({
        event: 'Write file rejected: missing projectPath',
        severity: 'error',
        category: 'security_violation',
        details: {
          operation: 'write',
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

    // Security validation: ensure path is within project directory
    const validation = validatePathWithinProject(filePath, projectPath);

    if (!validation.valid) {
      logForensicEvent({
        event: `Write file BLOCKED: ${validation.error}`,
        severity: validation.securityViolation ? 'critical' : 'error',
        category: 'security_violation',
        details: {
          operation: 'write',
          path: filePath,
          projectPath,
          error: validation.error,
          blocked: true,
          clientIp,
        },
      });

      return NextResponse.json(
        {
          error: 'Security violation: Path is not within project directory',
          details: validation.error,
        },
        { status: 403 }
      );
    }

    const normalizedPath = validation.normalizedPath;

    // Log successful validation
    logForensicEvent({
      event: 'Write file validated',
      severity: 'info',
      category: 'file_operation',
      details: {
        operation: 'write',
        path: normalizedPath,
        projectPath,
        clientIp,
      },
    });

    // Ensure parent directory exists
    const dir = path.dirname(normalizedPath);
    console.log('[write-file] Creating directory:', dir);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    console.log('[write-file] Writing file:', normalizedPath);
    await fs.writeFile(normalizedPath, content, 'utf-8');

    // Log successful write
    logForensicEvent({
      event: 'Write file completed',
      severity: 'info',
      category: 'file_operation',
      details: {
        operation: 'write',
        path: normalizedPath,
        projectPath,
        clientIp,
      },
    });

    console.log('[write-file] Success:', normalizedPath);
    return NextResponse.json({
      success: true,
      path: normalizedPath,
    });
  } catch (error: any) {
    logForensicEvent({
      event: 'Write file failed',
      severity: 'error',
      category: 'file_operation',
      details: {
        operation: 'write',
        error: error.message,
        clientIp,
      },
    });

    console.error('[write-file] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to write file' },
      { status: 500 }
    );
  }
}
