import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

// ─── Helper: run a shell command via PowerShell, capture output ───

function runCommand(
  cmd: string,
  cwd: string,
  timeoutMs = 60_000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", cmd], {
      cwd,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s: ${cmd}`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ─── Helper: check if a CLI tool is installed ───

async function checkCli(
  name: string,
  cwd: string
): Promise<{ ok: boolean; version: string }> {
  try {
    const { stdout, code } = await runCommand(`${name} --version`, cwd, 10_000);
    return { ok: code === 0 && stdout.length > 0, version: stdout.split("\n")[0] };
  } catch {
    return { ok: false, version: "" };
  }
}

// ─── Helper: recursively collect files for zip ───

function collectFiles(
  dir: string,
  base: string,
  skip: Set<string>
): { relativePath: string; absolutePath: string }[] {
  const results: { relativePath: string; absolutePath: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      results.push(...collectFiles(abs, base, skip));
    } else {
      results.push({ relativePath: rel, absolutePath: abs });
    }
  }
  return results;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectPath, projectName } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing 'action' field" }, { status: 400 });
    }
    if (!projectPath) {
      return NextResponse.json({ error: "Missing 'projectPath' field" }, { status: 400 });
    }

    // Validate project path exists
    try {
      const stats = fs.statSync(projectPath);
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: "projectPath is not a directory" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "projectPath does not exist" }, { status: 400 });
    }

    // ════════════════════════════════════════
    //  ACTION: init
    // ════════════════════════════════════════
    if (action === "init") {
      if (!projectName) {
        return NextResponse.json({ error: "Missing 'projectName' for init" }, { status: 400 });
      }

      // 1. Check all 4 CLIs
      const [gh, wrangler, vercel, netlify] = await Promise.all([
        checkCli("gh", projectPath),
        checkCli("npx wrangler", projectPath),
        checkCli("vercel", projectPath),
        checkCli("netlify", projectPath),
      ]);

      const missing: string[] = [];
      if (!gh.ok) missing.push("gh (GitHub CLI) — install from https://cli.github.com and run 'gh auth login'");
      if (!wrangler.ok) missing.push("wrangler (Cloudflare CLI) — install with 'npm i -g wrangler' and run 'wrangler login'");
      if (!vercel.ok) missing.push("vercel (Vercel CLI) — install with 'npm i -g vercel' and run 'vercel login'");
      if (!netlify.ok) missing.push("netlify (Netlify CLI) — install with 'npm i -g netlify-cli' and run 'netlify login'");

      if (missing.length > 0) {
        return NextResponse.json({
          error: `Missing required CLIs:\n${missing.join("\n")}`,
          missing,
        }, { status: 400 });
      }

      // 2. Git init (skip if already a repo)
      const gitDir = path.join(projectPath, ".git");
      if (!fs.existsSync(gitDir)) {
        const initResult = await runCommand("git init", projectPath);
        if (initResult.code !== 0) {
          return NextResponse.json({ error: `git init failed: ${initResult.stderr}` }, { status: 500 });
        }
      }

      // 3. Initial commit (skip if already has commits)
      const logCheck = await runCommand("git log --oneline -1", projectPath);
      if (logCheck.code !== 0) {
        // No commits yet — stage and commit
        const addResult = await runCommand("git add .", projectPath);
        if (addResult.code !== 0) {
          return NextResponse.json({ error: `git add failed: ${addResult.stderr}` }, { status: 500 });
        }
        const commitResult = await runCommand(
          'git commit -m "Initial commit"',
          projectPath
        );
        if (commitResult.code !== 0) {
          return NextResponse.json({ error: `git commit failed: ${commitResult.stderr}` }, { status: 500 });
        }
      }

      // 4. GitHub — create private repo and push
      let githubUrl = "";
      const ghResult = await runCommand(
        `gh repo create "${projectName}" --private --source=. --remote=origin --push`,
        projectPath
      );
      if (ghResult.code !== 0) {
        // If remote origin already exists, try to extract URL
        if (ghResult.stderr.includes("already exists")) {
          const remoteResult = await runCommand("git remote get-url origin", projectPath);
          githubUrl = remoteResult.stdout;
        } else {
          return NextResponse.json({ error: `gh repo create failed: ${ghResult.stderr}` }, { status: 500 });
        }
      } else {
        // Parse URL from gh output (typically prints the repo URL)
        const urlMatch = ghResult.stdout.match(/https:\/\/github\.com\/[^\s]+/);
        githubUrl = urlMatch ? urlMatch[0] : ghResult.stdout.split("\n")[0];
      }

      // 5. Vercel — link project
      let vercelUrl = "";
      const vercelResult = await runCommand("vercel link --yes", projectPath);
      if (vercelResult.code !== 0 && !vercelResult.stderr.includes("already linked")) {
        return NextResponse.json({ error: `vercel link failed: ${vercelResult.stderr}` }, { status: 500 });
      }
      // Try to read project URL from .vercel/project.json
      const vercelProjectFile = path.join(projectPath, ".vercel", "project.json");
      if (fs.existsSync(vercelProjectFile)) {
        try {
          const vercelProject = JSON.parse(fs.readFileSync(vercelProjectFile, "utf-8"));
          const orgId = vercelProject.orgId || "";
          const projId = vercelProject.projectId || "";
          if (projId) {
            vercelUrl = `https://vercel.com/~/projects/${projId}`;
          }
        } catch {
          // Fall back to generic URL
        }
      }
      if (!vercelUrl) {
        vercelUrl = `https://vercel.com (linked — check dashboard)`;
      }

      // 6. Netlify — create site and link
      let netlifyUrl = "";
      const netlifyResult = await runCommand(
        `netlify sites:create --name "${projectName}" --account-slug ""`,
        projectPath
      );
      if (netlifyResult.code !== 0) {
        // Site name might be taken — try without name
        if (netlifyResult.stderr.includes("already exists") || netlifyResult.stdout.includes("already exists")) {
          // Try linking to existing
          const linkResult = await runCommand("netlify link", projectPath);
          netlifyUrl = linkResult.stdout.match(/https:\/\/[^\s]+\.netlify\.app/)?.[0] || "https://netlify.com (linked)";
        } else {
          // Try create without specific name
          const retryResult = await runCommand("netlify sites:create", projectPath);
          if (retryResult.code === 0) {
            netlifyUrl = retryResult.stdout.match(/https:\/\/[^\s]+\.netlify\.app/)?.[0] || "";
          }
          if (!netlifyUrl) {
            return NextResponse.json({
              error: `netlify sites:create failed: ${netlifyResult.stderr || netlifyResult.stdout}`,
            }, { status: 500 });
          }
        }
      } else {
        netlifyUrl = netlifyResult.stdout.match(/https:\/\/[^\s]+\.netlify\.app/)?.[0] || "";
        // Link the site to the directory
        await runCommand("netlify link", projectPath);
      }

      // 7. Cloudflare Pages — create project
      let cloudflareUrl = "";
      const cfResult = await runCommand(
        `npx wrangler pages project create "${projectName}" --production-branch main`,
        projectPath
      );
      if (cfResult.code !== 0) {
        // Project may already exist
        if (cfResult.stderr.includes("already exists") || cfResult.stdout.includes("already exists")) {
          cloudflareUrl = `https://${projectName}.pages.dev`;
        } else {
          return NextResponse.json({
            error: `wrangler pages project create failed: ${cfResult.stderr || cfResult.stdout}`,
          }, { status: 500 });
        }
      } else {
        cloudflareUrl = `https://${projectName}.pages.dev`;
      }

      return NextResponse.json({
        success: true,
        githubUrl,
        cloudflareUrl,
        vercelUrl,
        netlifyUrl,
        clis: { gh: gh.version, wrangler: wrangler.version, vercel: vercel.version, netlify: netlify.version },
      });
    }

    // ════════════════════════════════════════
    //  ACTION: push
    // ════════════════════════════════════════
    if (action === "push") {
      // Stage all, commit, push
      const addResult = await runCommand("git add .", projectPath);
      if (addResult.code !== 0) {
        return NextResponse.json({ error: `git add failed: ${addResult.stderr}` }, { status: 500 });
      }

      const commitResult = await runCommand(
        'git commit -m "Update site"',
        projectPath
      );
      if (commitResult.code !== 0) {
        // "nothing to commit" is not a real error
        if (commitResult.stdout.includes("nothing to commit")) {
          const hashResult = await runCommand("git rev-parse --short HEAD", projectPath);
          return NextResponse.json({
            success: true,
            commitHash: hashResult.stdout,
            message: "No changes to commit",
          });
        }
        return NextResponse.json({ error: `git commit failed: ${commitResult.stderr}` }, { status: 500 });
      }

      const pushResult = await runCommand("git push origin main", projectPath);
      if (pushResult.code !== 0) {
        // Try pushing current branch if not on main
        const branchResult = await runCommand("git branch --show-current", projectPath);
        const branch = branchResult.stdout || "main";
        if (branch !== "main") {
          const retryPush = await runCommand(`git push origin ${branch}`, projectPath);
          if (retryPush.code !== 0) {
            return NextResponse.json({ error: `git push failed: ${retryPush.stderr}` }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: `git push failed: ${pushResult.stderr}` }, { status: 500 });
        }
      }

      const hashResult = await runCommand("git rev-parse --short HEAD", projectPath);
      return NextResponse.json({
        success: true,
        commitHash: hashResult.stdout,
      });
    }

    // ════════════════════════════════════════
    //  ACTION: export
    // ════════════════════════════════════════
    if (action === "export") {
      const SKIP_DIRS = new Set([
        ".git", "node_modules", ".vercel", ".netlify",
        ".next", "dist", "__pycache__", ".cache", "export.zip",
      ]);

      // Ensure vercel.json exists for SPA rewrite
      const vercelJsonPath = path.join(projectPath, "vercel.json");
      if (!fs.existsSync(vercelJsonPath)) {
        fs.writeFileSync(
          vercelJsonPath,
          JSON.stringify(
            { rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
            null,
            2
          ),
          "utf-8"
        );
      }

      // Collect files
      const files = collectFiles(projectPath, projectPath, SKIP_DIRS);

      // Build ZIP
      const zip = new JSZip();
      for (const file of files) {
        const content = fs.readFileSync(file.absolutePath);
        zip.file(file.relativePath, content);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const zipPath = path.join(projectPath, "export.zip");
      fs.writeFileSync(zipPath, zipBuffer);

      return NextResponse.json({
        success: true,
        zipPath,
        fileCount: files.length,
        sizeBytes: zipBuffer.length,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("[deploy] Error:", error);
    return NextResponse.json(
      { error: error.message || "Deploy action failed" },
      { status: 500 }
    );
  }
}
