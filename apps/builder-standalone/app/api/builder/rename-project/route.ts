import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

/**
 * POST /api/builder/rename-project
 * Body: { projectPath: string, newName: string }
 *
 * Renames a project folder on disk. Does NOT rename GitHub repos or hosting.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectPath, newName } = await request.json();

    if (!projectPath || !newName) {
      return NextResponse.json(
        { error: 'projectPath and newName are required' },
        { status: 400 }
      );
    }

    // Validate newName — no path separators or special chars
    if (/[/\\:*?"<>|]/.test(newName) || newName.startsWith('.')) {
      return NextResponse.json(
        { error: 'Invalid project name — no special characters or leading dots' },
        { status: 400 }
      );
    }

    // Security: project must be inside BUILDER_PROJECTS_DIR
    const normalizedProject = path.normalize(projectPath);
    const normalizedBase = path.normalize(BUILDER_PROJECTS_DIR);

    if (
      !normalizedProject.startsWith(normalizedBase + path.sep) &&
      normalizedProject !== normalizedBase
    ) {
      return NextResponse.json(
        { error: 'Access denied: path is outside the projects directory' },
        { status: 403 }
      );
    }

    // Verify the source exists
    try {
      const stat = await fs.stat(normalizedProject);
      if (!stat.isDirectory()) {
        return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Project folder not found' }, { status: 404 });
    }

    // Compute new path (sibling of old path)
    const newPath = path.join(path.dirname(normalizedProject), newName);

    // Verify the new path is also inside the sandbox
    const normalizedNew = path.normalize(newPath);
    if (
      !normalizedNew.startsWith(normalizedBase + path.sep) &&
      normalizedNew !== normalizedBase
    ) {
      return NextResponse.json(
        { error: 'Access denied: new path is outside the projects directory' },
        { status: 403 }
      );
    }

    // Check new path does not already exist
    try {
      await fs.stat(newPath);
      return NextResponse.json(
        { error: `A project named "${newName}" already exists` },
        { status: 409 }
      );
    } catch {
      // Good — does not exist
    }

    const oldName = path.basename(normalizedProject);
    await fs.rename(normalizedProject, newPath);

    return NextResponse.json({
      success: true,
      oldName,
      newName,
      newPath,
    });
  } catch (error: any) {
    console.error('[rename-project] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rename project' },
      { status: 500 }
    );
  }
}
