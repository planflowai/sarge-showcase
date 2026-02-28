import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

const MAIN_FILES = ['index.html', 'src/App.tsx', 'app/page.tsx', 'main.js', 'main.ts', 'README.md'];

/**
 * GET /api/builder/list-projects
 * Lists all project folders in BUILDER_PROJECTS_DIR (L:\AI_MASTER_BUILDS).
 * Returns name, path, file count, last modified, hasGit, mainFile.
 */
export async function GET() {
  try {
    // Ensure base dir exists
    await fs.mkdir(BUILDER_PROJECTS_DIR, { recursive: true });

    const entries = await fs.readdir(BUILDER_PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(BUILDER_PROJECTS_DIR, entry.name);

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      // Count top-level files (shallow count — fast)
      let fileCount = 0;
      try {
        const files = await fs.readdir(fullPath, { withFileTypes: true });
        fileCount = files.filter(f => f.isFile()).length;
      } catch { /* empty dir */ }

      // Check for .git folder
      let hasGit = false;
      let githubRepo: string | null = null;
      try {
        await fs.stat(path.join(fullPath, '.git'));
        hasGit = true;
        // Try to extract GitHub remote URL
        const gitConfig = await fs.readFile(path.join(fullPath, '.git', 'config'), 'utf-8');
        const m = gitConfig.match(/url\s*=\s*.*github\.com[/:](.+?\/.+?)(?:\.git)?\s*$/m);
        if (m) githubRepo = m[1].trim();
      } catch { /* no .git */ }

      // Find a "main file" hint for the card
      let mainFile: string | null = null;
      for (const name of MAIN_FILES) {
        try {
          await fs.stat(path.join(fullPath, name));
          mainFile = name;
          break;
        } catch { /* not found */ }
      }

      projects.push({
        name: entry.name,
        path: fullPath,
        fileCount,
        hasGit,
        githubRepo,
        mainFile,
        lastModified: stat.mtime.toISOString(),
      });
    }

    // Sort: most recently modified first
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ success: true, projects, baseDir: BUILDER_PROJECTS_DIR });
  } catch (error: any) {
    console.error('[list-projects] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list projects' }, { status: 500 });
  }
}
