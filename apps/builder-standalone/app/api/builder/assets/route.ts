import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validatePathWithinProject } from '@/lib/security/pathValidator';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

const ASSETS_DIR = path.join(BUILDER_PROJECTS_DIR, '_assets');

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv', '.json': 'application/json', '.xml': 'text/xml',
  '.txt': 'text/plain', '.md': 'text/markdown',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.zip': 'application/zip', '.rar': 'application/vnd.rar',
  '.css': 'text/css', '.js': 'application/javascript', '.ts': 'text/typescript',
  '.html': 'text/html', '.htm': 'text/html',
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif']);
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.md', '.json', '.xml', '.html', '.htm']);
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);

function getAssetType(ext: string): 'image' | 'document' | 'font' | 'other' {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (DOC_EXTS.has(ext)) return 'document';
  if (FONT_EXTS.has(ext)) return 'font';
  return 'other';
}

interface AssetItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mimeType: string;
  assetType: 'image' | 'document' | 'font' | 'other';
  isImage: boolean;
  lastModified: string;
  thumbnailUrl: string | null;
}

async function collectAssets(dir: string, basePath: string): Promise<AssetItem[]> {
  const items: AssetItem[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return items;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectories
      items.push(...await collectAssets(fullPath, basePath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const mimeType = MIME_MAP[ext] || 'application/octet-stream';
      const isImage = IMAGE_EXTS.has(ext);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      items.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        size: stat.size,
        mimeType,
        assetType: getAssetType(ext),
        isImage,
        lastModified: stat.mtime.toISOString(),
        thumbnailUrl: isImage
          ? `/api/builder/asset?projectPath=${encodeURIComponent(ASSETS_DIR)}&file=${encodeURIComponent(relativePath)}`
          : null,
      });
    }
  }
  return items;
}

/**
 * GET /api/builder/assets
 * Lists all files in the master _assets folder.
 */
export async function GET() {
  try {
    await fs.mkdir(ASSETS_DIR, { recursive: true });
    const assets = await collectAssets(ASSETS_DIR, ASSETS_DIR);
    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);

    // Sort by most recent first
    assets.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ success: true, assets, totalSize, assetsDir: ASSETS_DIR });
  } catch (error: any) {
    console.error('[assets] GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list assets' }, { status: 500 });
  }
}

/**
 * POST /api/builder/assets
 * Upload files to the master _assets folder.
 * Accepts multipart/form-data with "files" field.
 */
export async function POST(request: NextRequest) {
  try {
    await fs.mkdir(ASSETS_DIR, { recursive: true });

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const subfolder = formData.get('subfolder') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const targetDir = subfolder
      ? path.join(ASSETS_DIR, subfolder)
      : ASSETS_DIR;

    // Validate target is within _assets
    const validation = validatePathWithinProject(targetDir, ASSETS_DIR);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid subfolder path' }, { status: 403 });
    }

    await fs.mkdir(targetDir, { recursive: true });

    const uploaded: AssetItem[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      // 50 MB limit per file
      if (file.size > 50 * 1024 * 1024) {
        continue; // Skip oversized files silently
      }

      const filePath = path.join(targetDir, file.name);

      // Validate path
      const fileValidation = validatePathWithinProject(filePath, ASSETS_DIR);
      if (!fileValidation.valid) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      const ext = path.extname(file.name).toLowerCase();
      const mimeType = MIME_MAP[ext] || 'application/octet-stream';
      const isImage = IMAGE_EXTS.has(ext);
      const relativePath = path.relative(ASSETS_DIR, filePath).replace(/\\/g, '/');

      uploaded.push({
        name: file.name,
        path: filePath,
        relativePath,
        size: buffer.length,
        mimeType,
        assetType: getAssetType(ext),
        isImage,
        lastModified: new Date().toISOString(),
        thumbnailUrl: isImage
          ? `/api/builder/asset?projectPath=${encodeURIComponent(ASSETS_DIR)}&file=${encodeURIComponent(relativePath)}`
          : null,
      });
    }

    return NextResponse.json({ success: true, uploaded, count: uploaded.length });
  } catch (error: any) {
    console.error('[assets] POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload assets' }, { status: 500 });
  }
}

/**
 * DELETE /api/builder/assets
 * Delete a file from the master _assets folder.
 * Body: { relativePath: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { relativePath } = await request.json();
    if (!relativePath) {
      return NextResponse.json({ error: 'relativePath is required' }, { status: 400 });
    }

    const fullPath = path.join(ASSETS_DIR, relativePath);
    const validation = validatePathWithinProject(fullPath, ASSETS_DIR);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Access denied: path outside assets directory' }, { status: 403 });
    }

    try {
      await fs.stat(fullPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await fs.unlink(fullPath);

    return NextResponse.json({ success: true, deleted: relativePath });
  } catch (error: any) {
    console.error('[assets] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete asset' }, { status: 500 });
  }
}
