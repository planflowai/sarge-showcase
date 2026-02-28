import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === 'win32' ? 'L:/AI_MASTER_BUILDS' : '/AI_MASTER_BUILDS');

const MAIN_FILES = ['index.html', 'src/App.tsx', 'app/page.tsx', 'main.js', 'main.ts', 'README.md'];

/** Skip these folders — they are not projects */
const SKIP_FOLDERS = new Set(['_assets', 'node_modules', '.cache']);

/**
 * Fast, local-only deploy URL detection for a project.
 * Reads config files on disk — no CLI calls, no network requests.
 */
async function detectDeployUrls(projectPath: string) {
  let githubUrl: string | null = null;
  let vercelUrl: string | null = null;
  let netlifyUrl: string | null = null;
  let cloudflareUrl: string | null = null;

  // GitHub — read .git/config for remote URL
  try {
    const gitConfig = await fs.readFile(path.join(projectPath, '.git', 'config'), 'utf-8');
    const m = gitConfig.match(/url\s*=\s*.*github\.com[/:](.+?\/.+?)(?:\.git)?\s*$/m);
    if (m) {
      // Strip embedded credentials if present
      const repoPath = m[1].trim();
      githubUrl = `https://github.com/${repoPath}`;
    }
  } catch { /* no .git or no github remote */ }

  // Vercel — check .vercel/url.txt first, fallback to project.json
  try {
    const urlFile = path.join(projectPath, '.vercel', 'url.txt');
    vercelUrl = (await fs.readFile(urlFile, 'utf-8')).replace(/^\uFEFF/, '').trim();
  } catch {
    try {
      const projFile = path.join(projectPath, '.vercel', 'project.json');
      const vp = JSON.parse(await fs.readFile(projFile, 'utf-8'));
      if (vp.projectName) {
        const safeName = vp.projectName.replace(/_/g, '-').toLowerCase();
        vercelUrl = `https://${safeName}.vercel.app`;
      }
    } catch { /* no vercel */ }
  }

  // Netlify — check .netlify/state.json
  try {
    const stateFile = path.join(projectPath, '.netlify', 'state.json');
    const ns = JSON.parse(await fs.readFile(stateFile, 'utf-8'));
    if (ns.siteId) {
      // Infer URL from project folder name (Netlify normalizes to lowercase-kebab)
      const projName = path.basename(projectPath).replace(/_/g, '-').toLowerCase();
      netlifyUrl = `https://${projName}.netlify.app`;
    }
  } catch { /* no netlify */ }

  // Cloudflare — check wrangler.toml
  try {
    const toml = await fs.readFile(path.join(projectPath, 'wrangler.toml'), 'utf-8');
    const cfMatch = toml.match(/name\s*=\s*"([^"]+)"/);
    if (cfMatch) {
      cloudflareUrl = `https://${cfMatch[1]}.pages.dev`;
    }
  } catch { /* no wrangler */ }

  return { githubUrl, vercelUrl, netlifyUrl, cloudflareUrl };
}

/**
 * GET /api/builder/list-projects
 * Lists all project folders in BUILDER_PROJECTS_DIR.
 * Returns name, path, file count, last modified, hasGit, mainFile, deploy URLs.
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
      if (SKIP_FOLDERS.has(entry.name)) continue;

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

      // Fast local-only deploy URL detection
      const deployUrls = await detectDeployUrls(fullPath);

      projects.push({
        name: entry.name,
        path: fullPath,
        fileCount,
        hasGit,
        githubRepo,
        mainFile,
        lastModified: stat.mtime.toISOString(),
        ...deployUrls,
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
