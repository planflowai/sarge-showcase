import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

// ─── Helper: run a shell command via PowerShell, capture output ───

function runCommand(
  cmd: string,
  cwd: string,
  timeoutMs = 60_000,
  extraEnv?: Record<string, string>
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Wrap command with Set-Location so PowerShell respects the working directory
    const wrappedCmd = `Set-Location '${cwd.replace(/'/g, "''")}'; ${cmd}`;
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", wrappedCmd], {
      cwd,
      env: { ...process.env, ...extraEnv },
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

// ─── Helper: read Netlify site ID from .netlify/state.json ───

function readNetlifySiteId(projectPath: string): string {
  try {
    const stateFile = path.join(projectPath, ".netlify", "state.json");
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      if (state.siteId) return state.siteId;
    }
  } catch { /* ignore */ }
  return "";
}

// ─── Helper: build extra env for Netlify CLI (skip interactive prompts) ───

function netlifyEnv(projectPath: string, siteId?: string): Record<string, string> {
  const id = siteId || readNetlifySiteId(projectPath);
  const env: Record<string, string> = {};
  if (id) env.NETLIFY_SITE_ID = id;
  return env;
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
    //  ACTION: detect — check if project is already connected
    // ════════════════════════════════════════
    if (action === "detect") {
      let githubUrl = "";
      let vercelUrl = "";
      let netlifyUrl = "";
      let cloudflareUrl = "";

      // ── Step 1: GitHub (fast — local git command) ──
      const gitDir = path.join(projectPath, ".git");
      if (fs.existsSync(gitDir)) {
        const remoteResult = await runCommand("git remote get-url origin", projectPath);
        if (remoteResult.code === 0 && remoteResult.stdout) {
          let raw = remoteResult.stdout.replace(/\.git$/, "");
          // Strip embedded credentials from URL
          raw = raw.replace(/https?:\/\/[^@]+@/, "https://");
          if (raw.includes("github.com")) {
            // Convert SSH format if needed
            const m = raw.match(/github\.com[:/](.+)/);
            githubUrl = m ? `https://github.com/${m[1]}` : raw;
          }
        }
      }

      // ── Step 2: Vercel + Netlify + Cloudflare in PARALLEL ──
      // Each check is independent — run all 3 concurrently instead of sequentially
      const detectVercel = async (): Promise<string> => {
        const vercelProjectFile = path.join(projectPath, ".vercel", "project.json");
        const vercelUrlFile = path.join(projectPath, ".vercel", "url.txt");
        if (fs.existsSync(vercelProjectFile)) {
          try {
            const vp = JSON.parse(fs.readFileSync(vercelProjectFile, "utf-8"));
            const vpName = vp.projectName || "";
            if (vpName) {
              try {
                const lsResult = await runCommand("npx --yes vercel project ls", projectPath, 30_000);
                const allOutput = (lsResult.stdout + "\n" + lsResult.stderr);
                const nameVariant = vpName.replace(/_/g, "-");
                const projLine = allOutput.split("\n").find((l: string) => {
                  const t = l.trim();
                  return (t.startsWith(vpName + " ") || t.startsWith(nameVariant + " ") ||
                          t === vpName || t === nameVariant);
                });
                if (projLine) {
                  const aliasMatch = projLine.match(/https:\/\/[^\s]+\.vercel\.app/);
                  if (aliasMatch) {
                    fs.writeFileSync(vercelUrlFile, aliasMatch[0], "utf-8");
                    return aliasMatch[0];
                  }
                }
              } catch { /* fall through to cache */ }
              // Fallback: cached url.txt
              if (fs.existsSync(vercelUrlFile)) {
                return fs.readFileSync(vercelUrlFile, "utf-8").replace(/^\uFEFF/, "").trim();
              }
              // Last resort: construct from name
              return `https://${vpName.replace(/_/g, "-").toLowerCase()}.vercel.app`;
            }
          } catch { /* ignore */ }
        } else if (fs.existsSync(vercelUrlFile)) {
          return fs.readFileSync(vercelUrlFile, "utf-8").replace(/^\uFEFF/, "").trim();
        }
        return "";
      };

      const detectNetlify = async (): Promise<string> => {
        const netlifyStateFile = path.join(projectPath, ".netlify", "state.json");
        if (fs.existsSync(netlifyStateFile)) {
          try {
            const ns = JSON.parse(fs.readFileSync(netlifyStateFile, "utf-8"));
            if (ns.siteId) {
              const listResult = await runCommand(
                `netlify sites:list --json `,
                projectPath, 30_000,
                netlifyEnv(projectPath, ns.siteId)
              );
              try {
                const sites = JSON.parse(listResult.stdout);
                const site = sites.find((s: any) => s.id === ns.siteId);
                if (site) return site.ssl_url || site.url || "";
              } catch { /* ignore */ }
              return "https://app.netlify.com (linked)";
            }
          } catch { /* ignore */ }
        }
        return "";
      };

      const detectCloudflare = async (): Promise<string> => {
        const wranglerToml = path.join(projectPath, "wrangler.toml");
        if (fs.existsSync(wranglerToml)) {
          const wranglerCfg = fs.readFileSync(wranglerToml, "utf-8");
          const cfNameMatch = wranglerCfg.match(/name\s*=\s*"([^"]+)"/);
          if (cfNameMatch) {
            try {
              const cfList = await runCommand("npx --yes wrangler pages project list", projectPath, 30_000);
              const cfAllOutput = (cfList.stdout + "\n" + cfList.stderr);
              const cfProjName = cfNameMatch[1];
              const cfLine = cfAllOutput.split("\n").find((l: string) => {
                if (!l.includes(cfProjName)) return false;
                const cols = l.split("│").map((c: string) => c.trim()).filter(Boolean);
                return cols.length > 0 && cols[0] === cfProjName;
              });
              if (cfLine) {
                const domainMatch = cfLine.match(/([a-z0-9-]+\.pages\.dev)/);
                if (domainMatch) return `https://${domainMatch[1]}`;
              }
            } catch { /* ignore */ }
            return `https://${cfNameMatch[1]}.pages.dev`;
          }
        }
        return "";
      };

      // Run all 3 in parallel — ~15s instead of ~45s
      [vercelUrl, netlifyUrl, cloudflareUrl] = await Promise.all([
        detectVercel(),
        detectNetlify(),
        detectCloudflare(),
      ]);

      return NextResponse.json({
        success: true,
        githubUrl,
        vercelUrl,
        netlifyUrl,
        cloudflareUrl,
      });
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
        checkCli("npx --yes wrangler", projectPath),
        checkCli("npx --yes vercel", projectPath),
        checkCli("netlify", projectPath),
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

      // 2b. Create hosting config files if they don't exist
      // vercel.json — tells Vercel this is a static site (no build), serve from root
      const vercelJsonPath = path.join(projectPath, "vercel.json");
      if (!fs.existsSync(vercelJsonPath)) {
        fs.writeFileSync(vercelJsonPath, JSON.stringify(
          { version: 2, buildCommand: "", outputDirectory: ".", rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
          null, 2
        ), "utf-8");
      }
      // _redirects — tells Netlify to serve index.html for all routes (SPA)
      const redirectsPath = path.join(projectPath, "_redirects");
      if (!fs.existsSync(redirectsPath)) {
        fs.writeFileSync(redirectsPath, "/*    /index.html   200\n", "utf-8");
      }
      // .gitignore — exclude deploy tool folders
      const gitignorePath = path.join(projectPath, ".gitignore");
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, ".vercel\n.netlify\n.wrangler\nnode_modules\nexport.zip\n", "utf-8");
      }
      // .netlifyignore — prevent uploading deploy metadata folders
      const netlifyIgnorePath = path.join(projectPath, ".netlifyignore");
      if (!fs.existsSync(netlifyIgnorePath)) {
        fs.writeFileSync(netlifyIgnorePath, ".git\n.vercel\n.wrangler\nnode_modules\nexport.zip\nBUILDER_LOG.md\n", "utf-8");
      }
      // .cfignore — prevent Cloudflare Pages from uploading .git/ and metadata,
      // and skip _redirects (Netlify-only, causes redirect loop on Cloudflare)
      const cfIgnorePath = path.join(projectPath, ".cfignore");
      if (!fs.existsSync(cfIgnorePath)) {
        fs.writeFileSync(cfIgnorePath, ".git\n.vercel\n.netlify\n.wrangler\nnode_modules\nexport.zip\nBUILDER_LOG.md\n_redirects\n_headers\n.netlifyignore\n", "utf-8");
      }

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
        await runCommand("npx --yes vercel link --yes", projectPath);
        // Deploy to production
        await runCommand("npx --yes vercel --prod --yes", projectPath, 120_000);
        // Get the production alias (not per-deployment URL which has auth walls)
        const vercelProjectLs = await runCommand("npx --yes vercel project ls", projectPath, 30_000);
        const vercelAllOutput = (vercelProjectLs.stdout + "\n" + vercelProjectLs.stderr);
        const nameVar = projectName.replace(/_/g, "-");
        const projLine = vercelAllOutput.split("\n").find((l: string) => {
          const t = l.trim();
          return (t.startsWith(projectName + " ") || t.startsWith(nameVar + " ") ||
                  t === projectName || t === nameVar);
        });
        if (projLine) {
          const aliasMatch = projLine.match(/https:\/\/[^\s]+\.vercel\.app/);
          if (aliasMatch) vercelUrl = aliasMatch[0];
        }
        // Fallback: construct from project name
        if (!vercelUrl) {
          const safeName = projectName.replace(/_/g, "-").toLowerCase();
          vercelUrl = `https://${safeName}.vercel.app`;
        }
        // Save the production alias so detect can find it later
        if (vercelUrl) {
          const vercelDir = path.join(projectPath, ".vercel");
          if (!fs.existsSync(vercelDir)) fs.mkdirSync(vercelDir, { recursive: true });
          fs.writeFileSync(path.join(vercelDir, "url.txt"), vercelUrl, "utf-8");
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
            `netlify api listAccountsForUser --data '{}'`,
            projectPath, 15_000,
            netlifyEnv(projectPath)
          );
          let acctSlug = "";
          try {
            const accts = JSON.parse(acctResult.stdout);
            if (Array.isArray(accts) && accts.length > 0) acctSlug = accts[0].slug;
          } catch { /* ignore */ }

          // Try creating site with preferred name
          const acctFlag = acctSlug ? ` --account-slug "${acctSlug}"` : "";
          const createResult = await runCommand(
            `netlify sites:create --name "${safeName}"${acctFlag} `,
            projectPath, 30_000,
            netlifyEnv(projectPath)
          );
          if (createResult.code === 0) {
            const idMatch = createResult.stdout.match(/Site ID:\s+([a-f0-9-]+)/i);
            if (idMatch) siteId = idMatch[1];
          } else {
            // Name taken — check if we already own a site with this name from earlier
            const listResult = await runCommand(
              `netlify sites:list --json `,
              projectPath, 30_000,
              netlifyEnv(projectPath)
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
          const siteEnv = netlifyEnv(projectPath, siteId);
          // Ensure .netlify/state.json exists (link  may skip writing it)
          const netlifyDir = path.join(projectPath, ".netlify");
          if (!fs.existsSync(netlifyDir)) fs.mkdirSync(netlifyDir, { recursive: true });
          if (!fs.existsSync(netlifyStateFile)) {
            fs.writeFileSync(netlifyStateFile, JSON.stringify({ siteId }), "utf-8");
          }
          // Link by ID (non-interactive, always works)
          await runCommand(`netlify link --id "${siteId}" `, projectPath, 15_000, siteEnv);
          // Deploy files
          const deployResult = await runCommand(
            `netlify deploy --prod --dir "." `,
            projectPath, 120_000,
            siteEnv
          );
          // Parse production URL from deploy output (check both stdout and stderr)
          const netlifyDeployOut = (deployResult.stdout + "\n" + deployResult.stderr);
          const prodMatch = netlifyDeployOut.match(/Deployed to production URL:\s+(https:\/\/[^\s]+)/);
          if (prodMatch) {
            netlifyUrl = prodMatch[1];
          } else {
            const anyUrl = netlifyDeployOut.match(/https:\/\/[^\s]+\.netlify\.app/);
            if (anyUrl) netlifyUrl = anyUrl[0];
          }
        }

        if (!netlifyUrl) netlifyUrl = `https://${safeName}.netlify.app`;
      }

      // 8. Cloudflare Pages — create project and deploy files (skip if CLI not installed)
      let cloudflareUrl = "";
      if (wrangler.ok) {
        const safeCfName = projectName.replace(/_/g, "-").toLowerCase();

        // Write wrangler.toml BEFORE deploy so wrangler CLI can find it
        const wranglerTomlPath = path.join(projectPath, "wrangler.toml");
        if (!fs.existsSync(wranglerTomlPath)) {
          fs.writeFileSync(wranglerTomlPath, `name = "${safeCfName}"\npages_build_output_dir = "."\n`, "utf-8");
        }

        // Create project (ignore "already exists" errors)
        const cfCreate = await runCommand(
          `npx --yes wrangler pages project create "${safeCfName}" --production-branch main`,
          projectPath
        );
        // Parse the actual pages.dev domain from create output (e.g. "https://name-abc.pages.dev/")
        const cfCreateOut = (cfCreate.stdout + "\n" + cfCreate.stderr);
        const createDomainMatch = cfCreateOut.match(/https:\/\/([^\s/]+\.pages\.dev)/);
        if (createDomainMatch) cloudflareUrl = `https://${createDomainMatch[1]}`;

        // Deploy files to Cloudflare Pages
        const cfDeploy = await runCommand(
          `npx --yes wrangler pages deploy "." --project-name="${safeCfName}" --branch=main`,
          projectPath, 120_000
        );
        if (cfDeploy.code === 0) {
          const cfDeployOut = (cfDeploy.stdout + "\n" + cfDeploy.stderr);
          // Parse the deployment alias URL (contains the real domain)
          const aliasMatch = cfDeployOut.match(/Deployment alias URL:\s+(https:\/\/[^\s]+\.pages\.dev)/);
          if (aliasMatch) cloudflareUrl = aliasMatch[1];
          // Fallback: any pages.dev URL from output
          if (!cloudflareUrl) {
            const cfUrlMatch = cfDeployOut.match(/https:\/\/[^\s]+\.pages\.dev/);
            if (cfUrlMatch) cloudflareUrl = cfUrlMatch[0];
          }
        }

        // Last resort: query project list to get the actual domain
        if (!cloudflareUrl) {
          const cfList = await runCommand("npx --yes wrangler pages project list", projectPath, 30_000);
          const cfAllOut = (cfList.stdout + "\n" + cfList.stderr);
          const cfLine = cfAllOut.split("\n").find((l: string) => {
            if (!l.includes(safeCfName)) return false;
            const cols = l.split("│").map((c: string) => c.trim()).filter(Boolean);
            return cols.length > 0 && cols[0] === safeCfName;
          });
          if (cfLine) {
            const domainMatch = cfLine.match(/([a-z0-9-]+\.pages\.dev)/);
            if (domainMatch) cloudflareUrl = `https://${domainMatch[1]}`;
          }
        }

        if (!cloudflareUrl) cloudflareUrl = `https://${safeCfName}.pages.dev`;
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
      // Selective targets: only redeploy to these services. Default = ["github"] (git push only)
      const targets: string[] = body.targets || ["github"];

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

      // Re-deploy to hosting services in parallel — only selected targets
      const redeployTasks: Promise<any>[] = [];
      const deployResults: Record<string, "success" | "skipped" | "failed"> = {
        github: "success", // git push already succeeded above
      };

      if (targets.includes("vercel")) {
        // Ensure vercel.json has buildCommand (fixes projects init'd before this was added)
        const vercelJsonPath = path.join(projectPath, "vercel.json");
        if (fs.existsSync(vercelJsonPath)) {
          try {
            const vj = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
            if (!("buildCommand" in vj)) {
              vj.version = 2;
              vj.buildCommand = "";
              vj.outputDirectory = ".";
              fs.writeFileSync(vercelJsonPath, JSON.stringify(vj, null, 2), "utf-8");
            }
          } catch { /* ignore */ }
        }
        const vercelProjectFile = path.join(projectPath, ".vercel", "project.json");
        if (fs.existsSync(vercelProjectFile)) {
          redeployTasks.push(
            runCommand("npx --yes vercel --prod --yes", projectPath, 120_000).then(async (r) => {
              if (r.code === 0) {
                deployResults.vercel = "success";
                // Get production alias (not per-deploy URL which has auth walls)
                try {
                  const lsResult = await runCommand("npx --yes vercel project ls", projectPath, 30_000);
                  const lsAllOutput = (lsResult.stdout + "\n" + lsResult.stderr);
                  const projFile = path.join(projectPath, ".vercel", "project.json");
                  const projName = fs.existsSync(projFile)
                    ? JSON.parse(fs.readFileSync(projFile, "utf-8")).projectName || ""
                    : "";
                  if (projName) {
                    const nameV = projName.replace(/_/g, "-");
                    const projLine = lsAllOutput.split("\n").find((l: string) => {
                      const t = l.trim();
                      return (t.startsWith(projName + " ") || t.startsWith(nameV + " ") ||
                              t === projName || t === nameV);
                    });
                    if (projLine) {
                      const aliasMatch = projLine.match(/https:\/\/[^\s]+\.vercel\.app/);
                      if (aliasMatch) {
                        const urlFile = path.join(projectPath, ".vercel", "url.txt");
                        fs.writeFileSync(urlFile, aliasMatch[0], "utf-8");
                      }
                    }
                  }
                } catch { /* ignore — deploy succeeded, URL update is best-effort */ }
              } else {
                deployResults.vercel = "failed";
              }
            }).catch(() => { deployResults.vercel = "failed"; })
          );
        } else {
          deployResults.vercel = "skipped";
        }
      }

      if (targets.includes("netlify")) {
        const netlifyStateFile = path.join(projectPath, ".netlify", "state.json");
        if (fs.existsSync(netlifyStateFile)) {
          const pushNetlifyEnv = netlifyEnv(projectPath);
          redeployTasks.push(
            runCommand('netlify deploy --prod --dir "." ', projectPath, 120_000, pushNetlifyEnv).then((r) => {
              deployResults.netlify = r.code === 0 ? "success" : "failed";
            }).catch(() => { deployResults.netlify = "failed"; })
          );
        } else {
          deployResults.netlify = "skipped";
        }
      }

      if (targets.includes("cloudflare")) {
        // Ensure .cfignore exists before every CF deploy (covers projects init'd before this was added)
        const cfIgnorePath = path.join(projectPath, ".cfignore");
        if (!fs.existsSync(cfIgnorePath)) {
          fs.writeFileSync(cfIgnorePath, ".git\n.vercel\n.netlify\n.wrangler\nnode_modules\nexport.zip\nBUILDER_LOG.md\n_redirects\n_headers\n.netlifyignore\n", "utf-8");
        }
        const wranglerToml = path.join(projectPath, "wrangler.toml");
        if (fs.existsSync(wranglerToml)) {
          let wranglerCfg = fs.readFileSync(wranglerToml, "utf-8");
          const cfNameMatch = wranglerCfg.match(/name\s*=\s*"([^"]+)"/);
          if (cfNameMatch) {
            // Ensure pages_build_output_dir exists (fixes legacy toml files missing it)
            if (!wranglerCfg.includes("pages_build_output_dir")) {
              wranglerCfg += `pages_build_output_dir = "."\n`;
              fs.writeFileSync(wranglerToml, wranglerCfg, "utf-8");
            }
            redeployTasks.push(
              runCommand(
                `npx --yes wrangler pages deploy "." --project-name="${cfNameMatch[1]}" --branch=main`,
                projectPath, 120_000
              ).then((r) => {
                deployResults.cloudflare = r.code === 0 ? "success" : "failed";
              }).catch(() => { deployResults.cloudflare = "failed"; })
            );
          } else {
            deployResults.cloudflare = "skipped";
          }
        } else {
          deployResults.cloudflare = "skipped";
        }
      }

      if (redeployTasks.length > 0) {
        await Promise.all(redeployTasks);
      }

      return NextResponse.json({
        success: true,
        commitHash: hashResult.stdout,
        deployResults,
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

      // Ensure vercel.json exists for static deploy (no build, serve from root)
      const vercelJsonPath = path.join(projectPath, "vercel.json");
      if (!fs.existsSync(vercelJsonPath)) {
        fs.writeFileSync(
          vercelJsonPath,
          JSON.stringify(
            { version: 2, buildCommand: "", outputDirectory: ".", rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
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
