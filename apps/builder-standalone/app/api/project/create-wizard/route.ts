import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { generateHelloPage } from "@/lib/templates/helloPage";
import {
  validatePathWithinProject,
  logForensicEvent,
} from "@/lib/security/pathValidator";
import type { ProjectToggles, ProjectMeta } from "@/lib/types/project";

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");

/* ─── Shell helper (same pattern as deploy route) ─── */

function runCmd(
  cmd: string,
  cwd: string,
  timeoutMs = 60_000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const wrapped = `Set-Location '${cwd.replace(/'/g, "''")}'; ${cmd}`;
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", wrapped], {
      cwd,
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timed out: ${cmd}`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/* ─── Streaming progress helper ─── */

function createProgressStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(step: string, status: "running" | "done" | "error" | "skip", detail?: string) {
    if (!controller) return;
    const line = JSON.stringify({ step, status, detail, ts: Date.now() }) + "\n";
    controller.enqueue(encoder.encode(line));
  }

  function close(finalData?: Record<string, unknown>) {
    if (!controller) return;
    if (finalData) {
      const line = JSON.stringify({ step: "__done__", status: "done", ...finalData }) + "\n";
      controller.enqueue(encoder.encode(line));
    }
    controller.close();
  }

  function error(msg: string) {
    if (!controller) return;
    const line = JSON.stringify({ step: "__error__", status: "error", detail: msg }) + "\n";
    controller.enqueue(encoder.encode(line));
    controller.close();
  }

  return { stream, send, close, error };
}

/* ─── POST handler ─── */

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const {
    projectName,
    clientName,
    clientEmail,
    domain,
    toggles,
    packageTier,
  } = body as {
    projectName: string;
    clientName?: string;
    clientEmail?: string;
    domain?: string;
    toggles: ProjectToggles;
    packageTier?: string;
  };

  if (!projectName?.trim()) {
    return new Response(JSON.stringify({ error: "Project name is required" }), { status: 400 });
  }

  // Sanitize name → folder-safe slug
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const projectPath = path.join(BUILDER_PROJECTS_DIR, slug);

  // Security check
  const check = validatePathWithinProject(projectPath, BUILDER_PROJECTS_DIR);
  if (!check.valid) {
    logForensicEvent({
      event: `create-wizard BLOCKED: ${check.error}`,
      severity: "critical",
      category: "security_violation",
      details: { operation: "create-wizard", projectPath, clientIp },
    });
    return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
  }

  // Start streaming
  const { stream, send, close, error: streamError } = createProgressStream();

  // Run async pipeline
  (async () => {
    try {
      // ── Step 1: Create project folder ──
      send("folder", "running", `Creating ${slug}/`);
      await fs.mkdir(projectPath, { recursive: true });
      send("folder", "done", projectPath);

      // ── Step 2: Generate hello page ──
      send("hello", "running", "Generating coming soon page");
      const html = generateHelloPage({
        projectName,
        clientName: (clientName as string) || undefined,
        clientEmail: (clientEmail as string) || undefined,
        domain: (domain as string) || undefined,
      });
      await fs.writeFile(path.join(projectPath, "index.html"), html, "utf-8");
      send("hello", "done", "index.html written");

      // ── Step 3: Write project.json ──
      send("config", "running", "Writing project.json");
      const meta: ProjectMeta = {
        name: projectName,
        clientName: (clientName as string) || "",
        clientEmail: (clientEmail as string) || "",
        domain: (domain as string) || "",
        createdAt: new Date().toISOString(),
        toggles: toggles || {
          seo: true,
          accessibility: true,
          privacy: true,
          analytics: true,
          security: false,
          performance: false,
          punchList: false,
        },
        deployUrls: { github: "", vercel: "", netlify: "", cloudflare: "" },
        revisions: { round: 0, maxRounds: 3, items: [] },
        template: "coming-soon",
      };
      await fs.writeFile(
        path.join(projectPath, "project.json"),
        JSON.stringify(meta, null, 2),
        "utf-8",
      );
      send("config", "done", "project.json saved");

      // ── Step 4: Write hosting configs ──
      send("hosting", "running", "Writing deploy configs");
      const safeName = slug;

      // vercel.json
      await fs.writeFile(
        path.join(projectPath, "vercel.json"),
        JSON.stringify(
          { version: 2, buildCommand: "", outputDirectory: ".", rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
          null,
          2,
        ),
        "utf-8",
      );

      // _redirects (Netlify)
      await fs.writeFile(path.join(projectPath, "_redirects"), "/*    /index.html   200\n", "utf-8");

      // .gitignore
      await fs.writeFile(
        path.join(projectPath, ".gitignore"),
        ".vercel\n.netlify\n.wrangler\nnode_modules\nexport.zip\n",
        "utf-8",
      );

      // wrangler.toml
      const cfName = safeName.slice(0, 58);
      await fs.writeFile(
        path.join(projectPath, "wrangler.toml"),
        `name = "${cfName}"\npages_build_output_dir = "."\n`,
        "utf-8",
      );
      send("hosting", "done", "vercel.json, _redirects, .gitignore, wrangler.toml");

      // ── Step 5: Git init + initial commit ──
      send("git", "running", "Initializing git repository");
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        send("git", "error", "GITHUB_TOKEN not set — skipping deploy");
        close({
          projectPath,
          deployUrls: { github: "", vercel: "", netlify: "", cloudflare: "" },
        });
        return;
      }

      await runCmd("git init", projectPath);
      await runCmd('git config user.name "planflowai"', projectPath);
      await runCmd('git config user.email "rgallo2016@gmail.com"', projectPath);
      await runCmd("git add .", projectPath);
      await runCmd('git commit -m "Initial commit - coming soon page"', projectPath);
      await runCmd("git branch -M main", projectPath);
      send("git", "done", "Repository initialized");

      // Get GitHub login from token
      const ghRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/json" },
      });
      const ghUser = await ghRes.json();
      const ghLogin = ghUser.login as string;

      // ── Step 6: GitHub repo creation ──
      send("github", "running", "Creating GitHub repository");
      let githubUrl = "";
      try {
        const createRes = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: safeName, private: true, auto_init: false }),
        });
        const createData = await createRes.json();
        if (createRes.ok) {
          githubUrl = createData.html_url;
        } else if (createRes.status === 422) {
          // Repo already exists
          githubUrl = `https://github.com/${ghLogin}/${safeName}`;
        } else {
          throw new Error(createData.message || "GitHub API error");
        }

        const remoteUrl = `https://${ghLogin}:${githubToken}@github.com/${ghLogin}/${safeName}.git`;
        await runCmd("git remote remove origin", projectPath).catch(() => {});
        await runCmd(`git remote add origin "${remoteUrl}"`, projectPath);
        await runCmd("git push -u origin main", projectPath);
        send("github", "done", githubUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send("github", "error", msg);
      }

      // ── Step 7: Vercel deploy ──
      send("vercel", "running", "Deploying to Vercel");
      let vercelUrl = "";
      try {
        const { code: vCode } = await runCmd("npx --yes vercel --version", projectPath);
        if (vCode !== 0) throw new Error("Vercel CLI not installed");
        await runCmd("npx --yes vercel link --yes", projectPath, 90_000);
        await runCmd("npx --yes vercel --prod --yes", projectPath, 120_000);
        vercelUrl = `https://${safeName}.vercel.app`;
        send("vercel", "done", vercelUrl);
      } catch {
        send("vercel", "skip", "Vercel CLI not available");
      }

      // ── Step 8: Netlify deploy ──
      send("netlify", "running", "Deploying to Netlify");
      let netlifyUrl = "";
      try {
        const { code: nCode } = await runCmd("netlify --version", projectPath);
        if (nCode !== 0) throw new Error("Netlify CLI not installed");

        // Get account slug
        const { stdout: acctOut } = await runCmd("netlify api listAccountsForUser --data '{}'", projectPath);
        const acctMatch = acctOut.match(/"slug"\s*:\s*"([^"]+)"/);
        const acctSlug = acctMatch?.[1] || "";

        // Create site
        const { stdout: siteOut } = await runCmd(
          `netlify sites:create --name "${safeName}" --account-slug "${acctSlug}"`,
          projectPath,
          60_000,
        );
        const siteIdMatch = siteOut.match(/Site ID:\s*([a-f0-9-]+)/i);
        const siteId = siteIdMatch?.[1] || "";

        if (siteId) {
          // Ensure state file
          const netlifyDir = path.join(projectPath, ".netlify");
          await fs.mkdir(netlifyDir, { recursive: true });
          await fs.writeFile(
            path.join(netlifyDir, "state.json"),
            JSON.stringify({ siteId }),
            "utf-8",
          );
          await runCmd(`netlify link --id "${siteId}"`, projectPath);
        }

        const { stdout: deployOut } = await runCmd('netlify deploy --prod --dir "."', projectPath, 120_000);
        const urlMatch = deployOut.match(/https:\/\/[^\s]+\.netlify\.app[^\s]*/);
        netlifyUrl = urlMatch?.[0] || `https://${safeName}.netlify.app`;
        send("netlify", "done", netlifyUrl);
      } catch {
        send("netlify", "skip", "Netlify CLI not available");
      }

      // ── Step 9: Cloudflare deploy ──
      send("cloudflare", "running", "Deploying to Cloudflare Pages");
      let cloudflareUrl = "";
      try {
        const { code: cCode } = await runCmd("npx --yes wrangler --version", projectPath);
        if (cCode !== 0) throw new Error("Wrangler CLI not installed");

        await runCmd(
          `npx --yes wrangler pages project create "${cfName}" --production-branch main`,
          projectPath,
          60_000,
        ).catch(() => {}); // Ignore "already exists"

        const { stdout: cfOut } = await runCmd(
          `npx --yes wrangler pages deploy "." --project-name="${cfName}" --branch=main`,
          projectPath,
          120_000,
        );
        const cfMatch = cfOut.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
        cloudflareUrl = cfMatch?.[0] || `https://${cfName}.pages.dev`;
        send("cloudflare", "done", cloudflareUrl);
      } catch {
        send("cloudflare", "skip", "Wrangler CLI not available");
      }

      // ── Step 10: Update project.json with deploy URLs ──
      send("finalize", "running", "Saving deploy URLs");
      meta.deployUrls = {
        github: githubUrl,
        vercel: vercelUrl,
        netlify: netlifyUrl,
        cloudflare: cloudflareUrl,
      };
      await fs.writeFile(
        path.join(projectPath, "project.json"),
        JSON.stringify(meta, null, 2),
        "utf-8",
      );
      // Commit updated project.json
      await runCmd("git add project.json", projectPath);
      await runCmd('git commit -m "Update deploy URLs in project.json"', projectPath).catch(() => {});
      await runCmd("git push origin", projectPath).catch(() => {});
      send("finalize", "done", "All deploy URLs saved");

      // ── Done ──
      close({
        projectPath,
        deployUrls: meta.deployUrls,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[create-wizard] Fatal error:", msg);
      streamError(msg);
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
