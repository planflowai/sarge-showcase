import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

/**
 * POST /api/builder/delete-project
 * Body: { projectPath: string, deleteGithub?: boolean }
 *
 * Deletes a project folder from BUILDER_PROJECTS_DIR.
 * If deleteGithub is true AND a GitHub remote exists AND GITHUB_TOKEN env var is set,
 * also deletes the corresponding GitHub repository.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectPath, deleteGithub } = await request.json();

    if (!projectPath) {
      return NextResponse.json({ error: 'projectPath is required' }, { status: 400 });
    }

    // Security: project must be inside BUILDER_PROJECTS_DIR
    const normalizedProject = path.normalize(projectPath);
    const normalizedBase = path.normalize(BUILDER_PROJECTS_DIR);

    if (!normalizedProject.startsWith(normalizedBase + path.sep) && normalizedProject !== normalizedBase) {
      return NextResponse.json(
        { error: 'Access denied: path is outside the projects directory' },
        { status: 403 }
      );
    }

    // Verify the path exists
    try {
      const stat = await fs.stat(normalizedProject);
      if (!stat.isDirectory()) {
        return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Project folder not found' }, { status: 404 });
    }

    let githubResult: { deleted: boolean; repo?: string; error?: string } = { deleted: false };

    // Optionally delete GitHub repo
    if (deleteGithub) {
      try {
        const gitConfig = await fs.readFile(
          path.join(normalizedProject, '.git', 'config'),
          'utf-8'
        );
        const repoMatch = gitConfig.match(/url\s*=\s*.*github\.com[/:](.+?\/.+?)(?:\.git)?\s*$/m);

        if (repoMatch) {
          const repoPath = repoMatch[1].trim();
          const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

          if (!token) {
            githubResult = { deleted: false, repo: repoPath, error: 'GITHUB_TOKEN not set' };
          } else {
            const res = await fetch(`https://api.github.com/repos/${repoPath}`, {
              method: 'DELETE',
              headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });
            if (res.status === 204) {
              githubResult = { deleted: true, repo: repoPath };
            } else {
              const body = await res.json().catch(() => ({}));
              githubResult = {
                deleted: false,
                repo: repoPath,
                error: (body as any).message || `GitHub API error ${res.status}`,
              };
            }
          }
        } else {
          githubResult = { deleted: false, error: 'No GitHub remote found in .git/config' };
        }
      } catch (gitErr: any) {
        githubResult = { deleted: false, error: gitErr.message || 'Could not read .git/config' };
      }
    }

    // Delete the project folder (always)
    await fs.rm(normalizedProject, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      projectName: path.basename(normalizedProject),
      github: githubResult,
    });
  } catch (error: any) {
    console.error('[delete-project] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
