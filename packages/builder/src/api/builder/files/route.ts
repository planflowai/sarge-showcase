/**
 * Builder File System API
 *
 * Provides secure file operations for the Builder:
 * - GET: List directory or read file
 * - POST: Write/create file
 * - DELETE: Delete file
 *
 * All operations are sandboxed to BUILDER_PROJECTS_DIR.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validatePathWithinProject, logForensicEvent } from '@sarge/core/index.server';

// Get the projects directory from environment
const BUILDER_PROJECTS_DIR = process.env.BUILDER_PROJECTS_DIR || 'L:/ai_builder/projects';

// Ensure projects directory exists
async function ensureProjectsDir(): Promise<void> {
  try {
    await fs.access(BUILDER_PROJECTS_DIR);
  } catch {
    await fs.mkdir(BUILDER_PROJECTS_DIR, { recursive: true });
    logForensicEvent({
      event: 'Created projects directory',
      severity: 'info',
      category: 'file_operation',
      details: {
        operation: 'mkdir',
        path: BUILDER_PROJECTS_DIR,
      },
    });
  }
}

// Validate and resolve a path within the projects directory
function validateAndResolvePath(relativePath: string): { valid: boolean; fullPath: string; error?: string } {
  // Normalize the projects dir
  const normalizedProjectsDir = path.normalize(BUILDER_PROJECTS_DIR).replace(/\\/g, '/');

  // Handle relative paths
  let targetPath: string;
  if (path.isAbsolute(relativePath)) {
    targetPath = relativePath;
  } else {
    targetPath = path.join(normalizedProjectsDir, relativePath);
  }

  // Validate the path is within projects directory
  const validation = validatePathWithinProject(targetPath, normalizedProjectsDir);

  if (!validation.valid) {
    logForensicEvent({
      event: 'Path validation failed',
      severity: validation.securityViolation ? 'critical' : 'warning',
      category: 'security_violation',
      details: {
        operation: 'validate_path',
        path: relativePath,
        projectPath: normalizedProjectsDir,
        error: validation.error,
        blocked: true,
      },
    });
    return { valid: false, fullPath: '', error: validation.error };
  }

  return { valid: true, fullPath: validation.normalizedPath };
}

// Get file/directory stats
async function getFileInfo(filePath: string): Promise<{
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
} | null> {
  try {
    const stats = await fs.stat(filePath);
    const relativePath = path.relative(BUILDER_PROJECTS_DIR, filePath).replace(/\\/g, '/');
    return {
      name: path.basename(filePath),
      path: relativePath,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

// Recursively list directory contents
async function listDirectory(dirPath: string, recursive: boolean = false): Promise<any[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(BUILDER_PROJECTS_DIR, fullPath).replace(/\\/g, '/');

    const fileInfo = {
      name: entry.name,
      path: relativePath,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: 0,
      modified: '',
      children: undefined as any[] | undefined,
    };

    try {
      const stats = await fs.stat(fullPath);
      fileInfo.size = stats.size;
      fileInfo.modified = stats.mtime.toISOString();
    } catch {
      // Skip files we can't stat
      continue;
    }

    // Recursively list subdirectories
    if (entry.isDirectory() && recursive) {
      fileInfo.children = await listDirectory(fullPath, true);
    }

    results.push(fileInfo);
  }

  // Sort: directories first, then alphabetically
  results.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * GET /api/builder/files
 *
 * Query params:
 * - path: relative path within projects dir
 * - recursive: if true and path is directory, list recursively
 *
 * Returns:
 * - If path is file: { type: 'file', content: string, ... }
 * - If path is directory: { type: 'directory', files: [...] }
 */
export async function GET(request: NextRequest) {
  await ensureProjectsDir();

  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get('path') || '';
  const recursive = searchParams.get('recursive') === 'true';

  // Validate path
  const validation = validateAndResolvePath(relativePath);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, securityViolation: true },
      { status: 403 }
    );
  }

  const fullPath = validation.fullPath;

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      // List directory contents
      const files = await listDirectory(fullPath, recursive);

      logForensicEvent({
        event: 'Directory listed',
        severity: 'info',
        category: 'file_operation',
        details: {
          operation: 'list',
          path: relativePath,
        },
      });

      return NextResponse.json({
        type: 'directory',
        path: relativePath,
        files,
      });
    } else {
      // Read file contents
      const content = await fs.readFile(fullPath, 'utf-8');
      const info = await getFileInfo(fullPath);

      logForensicEvent({
        event: 'File read',
        severity: 'info',
        category: 'file_operation',
        details: {
          operation: 'read',
          path: relativePath,
        },
      });

      return NextResponse.json({
        type: 'file',
        ...info,
        content,
      });
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File or directory not found', path: relativePath },
        { status: 404 }
      );
    }
    console.error('[Builder Files API] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to read file/directory', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builder/files
 *
 * Body:
 * - path: relative path within projects dir
 * - content: file content (for files)
 * - type: 'file' | 'directory' (default: 'file')
 *
 * Creates parent directories if needed.
 */
export async function POST(request: NextRequest) {
  await ensureProjectsDir();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { path: relativePath, content, type = 'file' } = body;

  if (!relativePath) {
    return NextResponse.json(
      { error: 'Path is required' },
      { status: 400 }
    );
  }

  // Validate path
  const validation = validateAndResolvePath(relativePath);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, securityViolation: true },
      { status: 403 }
    );
  }

  const fullPath = validation.fullPath;

  try {
    if (type === 'directory') {
      // Create directory
      await fs.mkdir(fullPath, { recursive: true });

      logForensicEvent({
        event: 'Directory created',
        severity: 'info',
        category: 'file_operation',
        details: {
          operation: 'mkdir',
          path: relativePath,
        },
      });

      return NextResponse.json({
        success: true,
        type: 'directory',
        path: relativePath,
      });
    } else {
      // Create parent directories if needed
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content || '', 'utf-8');
      const info = await getFileInfo(fullPath);

      logForensicEvent({
        event: 'File written',
        severity: 'info',
        category: 'file_operation',
        details: {
          operation: 'write',
          path: relativePath,
        },
      });

      return NextResponse.json({
        success: true,
        type: 'file',
        ...info,
      });
    }
  } catch (err: any) {
    console.error('[Builder Files API] POST error:', err);
    return NextResponse.json(
      { error: 'Failed to write file/directory', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/builder/files
 *
 * Body:
 * - path: relative path within projects dir
 *
 * Deletes file or directory (recursively).
 */
export async function DELETE(request: NextRequest) {
  await ensureProjectsDir();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { path: relativePath } = body;

  if (!relativePath) {
    return NextResponse.json(
      { error: 'Path is required' },
      { status: 400 }
    );
  }

  // Prevent deleting the root projects directory
  if (!relativePath || relativePath === '/' || relativePath === '.') {
    return NextResponse.json(
      { error: 'Cannot delete root projects directory', securityViolation: true },
      { status: 403 }
    );
  }

  // Validate path
  const validation = validateAndResolvePath(relativePath);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, securityViolation: true },
      { status: 403 }
    );
  }

  const fullPath = validation.fullPath;

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }

    logForensicEvent({
      event: stats.isDirectory() ? 'Directory deleted' : 'File deleted',
      severity: 'warning',
      category: 'file_operation',
      details: {
        operation: 'delete',
        path: relativePath,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: relativePath,
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File or directory not found', path: relativePath },
        { status: 404 }
      );
    }
    console.error('[Builder Files API] DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete file/directory', details: err.message },
      { status: 500 }
    );
  }
}
