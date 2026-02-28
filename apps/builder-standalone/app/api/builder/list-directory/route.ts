import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validatePathWithinProject, logForensicEvent } from '@/lib/security/pathValidator';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

// Supported file extensions
const SUPPORTED_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'json', 'md', 'mdx', 'yaml', 'yml', 'xml', 'svg', 'txt',
  // Images & media
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', '.cache',
  '__pycache__', '.vscode', '.idea', 'coverage', '.turbo'
]);

async function buildFileTree(dirPath: string, maxDepth: number = 5, currentDepth: number = 0): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files/folders (except specific ones)
      if (entry.name.startsWith('.') && !['src', 'public', 'app', 'components', 'lib', 'styles'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (SKIP_DIRS.has(entry.name)) continue;

        const children = await buildFileTree(fullPath, maxDepth, currentDepth + 1);
        // Only include directories that have visible children
        if (children.length > 0 || currentDepth < 2) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children,
          });
        }
      } else {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            extension: ext,
          });
        }
      }
    }

    // Sort: directories first, then files, alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  try {
    const { path: dirPath } = await request.json();

    if (!dirPath) {
      logForensicEvent({
        event: 'List directory rejected: missing path',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'list', error: 'Path is required', clientIp },
      });
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Validate path is normalized (security: prevent path traversal)
    const normalizedPath = path.normalize(path.resolve(dirPath));

    // Verify the path exists and is a directory
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const tree = await buildFileTree(normalizedPath);
    const projectName = path.basename(normalizedPath);

    return NextResponse.json({
      success: true,
      projectName,
      projectPath: normalizedPath,
      tree,
    });
  } catch (error: any) {
    console.error('Error listing directory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list directory' },
      { status: 500 }
    );
  }
}
