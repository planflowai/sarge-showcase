import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validatePathWithinProject } from '@/lib/security/pathValidator';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

const ASSETS_DIR = path.join(BUILDER_PROJECTS_DIR, '_assets');

/**
 * POST /api/builder/assets/copy-to-project
 * Copies an asset from _assets/ into a project's folder.
 * Body: { assetRelativePath: string, projectPath: string, destFolder?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { assetRelativePath, projectPath, destFolder } = await request.json();

    if (!assetRelativePath || !projectPath) {
      return NextResponse.json(
        { error: 'assetRelativePath and projectPath are required' },
        { status: 400 }
      );
    }

    // Validate asset path is within _assets
    const sourcePath = path.join(ASSETS_DIR, assetRelativePath);
    const assetValidation = validatePathWithinProject(sourcePath, ASSETS_DIR);
    if (!assetValidation.valid) {
      return NextResponse.json({ error: 'Invalid asset path' }, { status: 403 });
    }

    // Validate project path is within BUILDER_PROJECTS_DIR
    const projValidation = validatePathWithinProject(projectPath, BUILDER_PROJECTS_DIR);
    if (!projValidation.valid) {
      return NextResponse.json({ error: 'Invalid project path' }, { status: 403 });
    }

    // Don't copy into _assets itself
    const normalizedProj = path.normalize(projectPath).replace(/\\/g, '/');
    const normalizedAssets = path.normalize(ASSETS_DIR).replace(/\\/g, '/');
    if (normalizedProj.toLowerCase() === normalizedAssets.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot copy into _assets folder' }, { status: 400 });
    }

    // Verify source exists
    try {
      await fs.stat(sourcePath);
    } catch {
      return NextResponse.json({ error: 'Asset file not found' }, { status: 404 });
    }

    // Compute destination
    const folder = destFolder || 'assets';
    const destDir = path.join(projectPath, folder);
    const fileName = path.basename(assetRelativePath);
    const destPath = path.join(destDir, fileName);

    // Validate dest path
    const destValidation = validatePathWithinProject(destPath, projectPath);
    if (!destValidation.valid) {
      return NextResponse.json({ error: 'Invalid destination path' }, { status: 403 });
    }

    // Create destination directory if needed
    await fs.mkdir(destDir, { recursive: true });

    // Copy file
    await fs.copyFile(sourcePath, destPath);

    return NextResponse.json({
      success: true,
      destPath,
      destRelative: `${folder}/${fileName}`,
      fileName,
    });
  } catch (error: any) {
    console.error('[assets/copy-to-project] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to copy asset' },
      { status: 500 }
    );
  }
}
