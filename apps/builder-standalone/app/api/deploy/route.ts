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
    // Wrap command with Set-Location so PowerShell respects the working directory
    const wrappedCmd = `Set-Location '${cwd.replace(/'/g, "''")}'; ${cmd}`;
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", wrappedCmd], {
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
    const { stdout, code } = await runCommand(`${name} --version`, cwd, 30_000);
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

      // 1. Check GITHUB_TOKEN + CLIs
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        return NextResponse.json({
          error: "Missing GITHUB_TOKEN. Add it to .env.local:\n\nGITHUB_TOKEN=ghp_your_personal_access_token\n\nCreate one at https://github.com/settings/tokens with 'repo' scope.",
        }, { status: 400 });
      }

      // Check which optional CLIs are available (none are required — GitHub uses API)
      const [wrangler, vercel, netlify] = await Promise.all([
        checkCli("npx wrangler", projectPath),
        checkCli("npx vercel", projectPath),
        checkCli("npx netlify", projectPath),
      ]);

      // 2. Fetch GitHub user info (needed for git config + repo creation)
      const ghUserRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" },
      });
      if (!ghUserRes.ok) {
        return NextResponse.json({ error: `GitHub API error: invalid token (${ghUserRes.status})` }, { status: 400 });
      }
      const ghUser = await ghUserRes.json();
      const ghLogin = ghUser.login as string;
      const ghEmail = (ghUser.email as string) || `${ghLogin}@users.noreply.github.com`;

      // 3. Git init (skip if already a repo)
      const gitDir = path.join(projectPath, ".git");
      if (!fs.existsSync(gitDir)) {
        const initResult = await runCommand("git init", projectPath);
        if (initResult.code !== 0) {
          return NextResponse.json({ error: `git init failed: ${initResult.stderr}` }, { status: 500 });
        }
      }

      // Set git user config in this repo (required for commit)
      await runCommand(`git config user.name "${ghLogin}"`, projectPath);
      await runCommand(`git config user.email "${ghEmail}"`, projectPath);

      // 4. Initial commit (skip if already has commits)
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

      // 5. GitHub — create private repo via API and push
      let githubUrl = "";
      const remoteCheck = await runCommand("git remote get-url origin", projectPath);
      if (remoteCheck.code === 0 && remoteCheck.stdout) {
        // Remote already exists — use it
        githubUrl = remoteCheck.stdout.replace(/\.git$/, "");
        if (!githubUrl.startsWith("http")) {
          // SSH URL like git@github.com:user/repo — convert to HTTPS
          const m = githubUrl.match(/github\.com[:/](.+)/);
          githubUrl = m ? `https://github.com/${m[1]}` : githubUrl;
        }
      } else {
        // Create repo via GitHub API
        const createRes = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: projectName, private: true, auto_init: false }),
        });
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          // 422 = repo already exists under this account
          if (createRes.status === 422) {
            githubUrl = `https://github.com/${ghLogin}/${projectName}`;
          } else {
            return NextResponse.json({
              error: `GitHub API error (${createRes.status}): ${errData.message || "Failed to create repo"}`,
            }, { status: 500 });
          }
        } else {
          const repoData = await createRes.json();
          githubUrl = repoData.html_url;
        }

        // Add remote origin with token-embedded URL for push auth
        const authRemote = `https://${ghLogin}:${githubToken}@github.com/${ghLogin}/${projectName}.git`;
        await runCommand(`git remote add origin "${authRemote}"`, projectPath);

        // Push to origin
        const pushResult = await runCommand("git push -u origin main", projectPath);
        if (pushResult.code !== 0) {
          // If branch is master instead of main
          const branchResult = await runCommand("git branch --show-current", projectPath);
          const branch = branchResult.stdout || "main";
          if (branch !== "main") {
            await runCommand(`git push -u origin ${branch}`, projectPath);
          }
        }
      }

      // 6. Vercel — deploy project (skip if CLI not installed)
      let vercelUrl = "";
      if (vercel.ok) {
        // Link first (non-interactive)
        await runCommand("npx vercel link --yes", projectPath);
        // Deploy to production — captures the live URL
        const vercelDeploy = await runCommand("npx vercel --prod --yes", projectPath, 120_000);
        if (vercelDeploy.code === 0) {
          // Output has multiple URLs — grab the last .vercel.app one (the aliased production URL)
          const allUrls = vercelDeploy.stdout.match(/https:\/\/[^\s]+\.vercel\.app/g);
          vercelUrl = allUrls ? allUrls[allUrls.length - 1] : "";
        }
        // Fallback: construct from project name (standard Vercel pattern)
        if (!vercelUrl) {
          const safeName = projectName.replace(/_/g, "-").toLowerCase();
          vercelUrl = `https://${safeName}.vercel.app`;
        }
      }

      // 7. Netlify — create site and deploy files (skip if CLI not installed)
      let netlifyUrl = "";
      if (netlify.ok) {
        const safeName = projectName!.replace(/_/g, "-").toLowerCase();
        let siteId = "";

        // Check if already linked from a previous init
        const netlifyStateFile = path.join(projectPath, ".netlify", "state.json");
        if (fs.existsSync(netlifyStateFile)) {
          try {
            const state = JSON.parse(fs.readFileSync(netlifyStateFile, "utf-8"));
            if (state.siteId) siteId = state.siteId;
          } catch { /* ignore */ }
        }

        // Create a new site if not already linked
        if (!siteId) {
          // Get account slug dynamically
          const acctResult = await runCommand(
            `npx netlify api listAccountsForUser --data '{}'`,
            projectPath, 15_000
          );
          let acctSlug = "";
          try {
            const accts = JSON.parse(acctResult.stdout);
            if (Array.isArray(accts) && accts.length > 0) acctSlug = accts[0].slug;
          } catch { /* ignore */ }

          // Try creating site with preferred name
          const acctFlag = acctSlug ? ` --account-slug "${acctSlug}"` : "";
          const createResult = await runCommand(
            `npx netlify sites:create --name "${safeName}"${acctFlag}`,
            projectPath, 30_000
          );
          if (createResult.code === 0) {
            const idMatch = createResult.stdout.match(/Site ID:\s+([a-f0-9-]+)/i);
            if (idMatch) siteId = idMatch[1];
          } else {
            // Name taken — check if we already own a site with this name from earlier
            const listResult = await runCommand(
              `npx netlify sites:list --json`,
              projectPath, 30_000
            );
            try {
              const sites = JSON.parse(listResult.stdout);
              const existing = sites.find((s: any) =>
                s.name === safeName || s.name === projectName
              );
              if (existing) {
                siteId = existing.id;
                netlifyUrl = existing.ssl_url || existing.url || "";
              }
            } catch { /* ignore */ }
          }
        }

        // Link and deploy if we have a site
        if (siteId) {
          // Link by ID (non-interactive, always works)
          await runCommand(`npx netlify link --id "${siteId}"`, projectPath, 15_000);
          // Deploy files
          const deployResult = await runCommand(
            `npx netlify deploy --prod --dir "."`,
            projectPath, 120_000
          );
          // Parse production URL from deploy output
          const prodMatch = deployResult.stdout.match(/Deployed to production URL:\s+(https:\/\/[^\s]+)/);
          if (prodMatch) {
            netlifyUrl = prodMatch[1];
          } else {
            const anyUrl = deployResult.stdout.match(/https:\/\/[^\s]+\.netlify\.app/);
            if (anyUrl) netlifyUrl = anyUrl[0];
          }
        }

        if (!netlifyUrl) netlifyUrl = `https://${safeName}.netlify.app`;
      }

      // 8. Cloudflare Pages — create project (skip if CLI not installed)
      let cloudflareUrl = "";
      if (wrangler.ok) {
        const cfResult = await runCommand(
          `npx wrangler pages project create "${projectName}" --production-branch main`,
          projectPath
        );
        if (cfResult.code === 0 || cfResult.stderr.includes("already exists") || cfResult.stdout.includes("already exists")) {
          cloudflareUrl = `https://${projectName}.pages.dev`;
        }
      }

      return NextResponse.json({
        success: true,
        githubUrl,
        cloudflareUrl,
        vercelUrl,
        netlifyUrl,
        clis: { wrangler: wrangler.version, vercel: vercel.version, netlify: netlify.version },
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

      // Re-deploy to Vercel and Netlify in parallel (non-blocking — don't fail the push)
      const redeployTasks: Promise<any>[] = [];
      const vercelProjectFile = path.join(projectPath, ".vercel", "project.json");
      if (fs.existsSync(vercelProjectFile)) {
        redeployTasks.push(
          runCommand("npx vercel --prod --yes", projectPath, 120_000).catch(() => {})
        );
      }
      const netlifyStateFile = path.join(projectPath, ".netlify", "state.json");
      if (fs.existsSync(netlifyStateFile)) {
        redeployTasks.push(
          runCommand('npx netlify deploy --prod --dir "."', projectPath, 120_000).catch(() => {})
        );
      }
      if (redeployTasks.length > 0) {
        await Promise.all(redeployTasks);
      }

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
