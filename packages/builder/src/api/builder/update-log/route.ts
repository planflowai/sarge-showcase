import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { logForensicEvent } from '@/lib/security/pathValidator';
import {
  appendChangeEntry,
  generateNewLog,
  generateScanLog,
  generateSessionSummary,
  type ChangeEntry
} from '@/lib/builderLogger';

const LOG_FILENAME = 'BUILDER_LOG.md';

// Directories to skip during scan
const SCAN_SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.cache', 'dist', '.svelte-kit',
  '__pycache__', '.DS_Store', 'coverage', '.turbo',
]);

/**
 * Recursively walk a directory and return a flat inventory of all files/folders
 */
async function walkDirectory(
  dirPath: string,
  basePath: string,
  maxDepth = 5,
  depth = 0
): Promise<{ path: string; type: 'file' | 'directory'; size?: number }[]> {
  if (depth > maxDepth) return [];
  const results: { path: string; type: 'file' | 'directory'; size?: number }[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (SCAN_SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        results.push({ path: relativePath, type: 'directory' });
        const children = await walkDirectory(fullPath, basePath, maxDepth, depth + 1);
        results.push(...children);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          results.push({ path: relativePath, type: 'file', size: stat.size });
        } catch {
          results.push({ path: relativePath, type: 'file' });
        }
      }
    }
  } catch (err) {
    console.warn('[update-log] walkDirectory error:', err);
  }

  return results;
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  try {
    const body = await request.json();
    const {
      projectPath,
      projectName,
      action,
      entry,
      sessionSummary
    } = body;

    console.log('[update-log] Request:', { projectPath, projectName, action });

    if (!projectPath) {
      logForensicEvent({
        event: 'Update log rejected: missing projectPath',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'update-log', error: 'Project path is required', clientIp },
      });
      return NextResponse.json({ error: 'Project path is required' }, { status: 400 });
    }

    // Normalize the project path to prevent traversal
    const normalizedProjectPath = path.normalize(path.resolve(projectPath));
    const logPath = path.join(normalizedProjectPath, LOG_FILENAME);
    let existingContent = '';

    // Read existing log if it exists
    try {
      existingContent = await fs.readFile(logPath, 'utf-8');
      console.log('[update-log] Existing log found, length:', existingContent.length);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      console.log('[update-log] No existing log, will create new');
    }

    let newContent: string;

    if (action === 'append' && entry) {
      // Append a single change entry
      const changeEntry: ChangeEntry = {
        ...entry,
        timestamp: new Date(entry.timestamp || Date.now())
      };
      newContent = appendChangeEntry(existingContent, changeEntry, projectName || 'Project');
      console.log('[update-log] Appended change entry for:', entry.filePath);
    } else if (action === 'summary' && sessionSummary) {
      // Generate full session summary
      const { recentChanges, currentState, nextSteps } = sessionSummary;
      const entries: ChangeEntry[] = (recentChanges || []).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp || Date.now())
      }));
      newContent = generateSessionSummary(
        existingContent,
        projectName || 'Project',
        entries,
        currentState || '',
        nextSteps || []
      );
      console.log('[update-log] Generated session summary');
    } else if (action === 'scan') {
      // Full tree walk scan — generates comprehensive inventory log
      // Only create if log doesn't already exist
      if (existingContent.trim()) {
        return NextResponse.json({
          success: true,
          message: 'Log already exists',
          path: logPath,
          content: existingContent,
        });
      }
      const inventory = await walkDirectory(normalizedProjectPath, normalizedProjectPath);
      newContent = generateScanLog(projectName || 'Project', inventory);
      console.log('[update-log] Generated scan log with', inventory.length, 'items');
    } else if (action === 'init') {
      // Initialize new log (only if doesn't exist)
      if (existingContent.trim()) {
        return NextResponse.json({
          success: true,
          message: 'Log already exists',
          path: logPath
        });
      }
      newContent = generateNewLog(projectName || 'Project');
      console.log('[update-log] Initialized new log');
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Write the updated log
    await fs.writeFile(logPath, newContent, 'utf-8');
    console.log('[update-log] Written to:', logPath);

    return NextResponse.json({
      success: true,
      path: logPath,
      action
    });
  } catch (error: any) {
    console.error('[update-log] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update log' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('projectPath');

    if (!projectPath) {
      return NextResponse.json({ error: 'Project path is required' }, { status: 400 });
    }

    const logPath = path.join(projectPath, LOG_FILENAME);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      return NextResponse.json({
        exists: true,
        content,
        path: logPath
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return NextResponse.json({
          exists: false,
          content: null,
          path: logPath
        });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[update-log] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read log' },
      { status: 500 }
    );
  }
}
