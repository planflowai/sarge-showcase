import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { generateHelloPage } from "@/lib/templates/helloPage";
import {
  validatePathWithinProject,
  logForensicEvent,
} from "@/lib/security/pathValidator";
import type { ProjectMeta } from "@/lib/types/project";
// pricing-config.ts is the fallback for the kickoff page UI only;
// this route accepts package name + revisionRounds directly from the client

const BUILDER_PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/* ─── Shell helper (same pattern as create-wizard) ─── */

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
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    package: packageName,
    revisionRounds,
    projectName,
    clientName,
    clientEmail,
    clientPhone,
    clientDomain,
  } = body as {
    package: string;
    revisionRounds?: number;
    projectName: string;
    clientName?: string;
    clientEmail: string;
    clientPhone?: string;
    clientDomain?: string;
  };

  // Validate required fields
  if (!projectName?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  if (!clientEmail?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!packageName?.trim()) {
    return NextResponse.json({ error: "Package is required" }, { status: 400 });
  }

  const maxRevisions = revisionRounds ?? 1;

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
      event: `kickoff BLOCKED: ${check.error}`,
      severity: "critical",
      category: "security_violation",
      details: { operation: "kickoff", projectPath, clientIp },
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Generate ref code
  const refCode = "SARGE-" + Date.now().toString(36).toUpperCase();

  try {
    // ── Step 1: Create project folder ──
    await fs.mkdir(projectPath, { recursive: true });

    // ── Step 2: Generate coming soon page ──
    const html = generateHelloPage({
      projectName,
      clientName: (clientName as string) || undefined,
      clientEmail: (clientEmail as string) || undefined,
      domain: (clientDomain as string) || undefined,
    });
    await fs.writeFile(path.join(projectPath, "index.html"), html, "utf-8");

    // ── Step 3: Write project.json ──
    const meta: ProjectMeta = {
      name: projectName,
      clientName: (clientName as string) || "",
      clientEmail: (clientEmail as string) || "",
      domain: (clientDomain as string) || "",
      createdAt: new Date().toISOString(),
      toggles: {
        seo: true,
        accessibility: true,
        privacy: true,
        analytics: true,
        security: false,
        performance: false,
        punchList: false,
        calendly: false,
        mailchimp: false,
      },
      deployUrls: { github: "", vercel: "", netlify: "", cloudflare: "" },
      revisions: { round: 0, maxRounds: maxRevisions, items: [] },
      template: "coming-soon",
    };
    await fs.writeFile(
      path.join(projectPath, "project.json"),
      JSON.stringify(meta, null, 2),
      "utf-8",
    );

    // ── Step 4: Write hosting configs ──
    const safeName = slug;
    await fs.writeFile(
      path.join(projectPath, "vercel.json"),
      JSON.stringify(
        { version: 2, buildCommand: "", outputDirectory: ".", rewrites: [{ source: "/(.*)", destination: "/index.html" }] },
        null,
        2,
      ),
      "utf-8",
    );
    await fs.writeFile(path.join(projectPath, "_redirects"), "/*    /index.html   200\n", "utf-8");
    await fs.writeFile(
      path.join(projectPath, ".gitignore"),
      ".vercel\n.netlify\n.wrangler\nnode_modules\nexport.zip\n",
      "utf-8",
    );
    const cfName = safeName.slice(0, 58);
    await fs.writeFile(
      path.join(projectPath, "wrangler.toml"),
      `name = "${cfName}"\npages_build_output_dir = "."\n`,
      "utf-8",
    );

    // ── Step 5: Write to Supabase ──
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: dbError } = await supabase.from("client_intake").insert({
        form_data: {
          package: packageName,
          package_name: packageName,
          business_name: projectName,
          contact_name: clientName || "",
          email: clientEmail,
          phone: clientPhone || "",
          domain: clientDomain || "",
          source: "kickoff",
        },
        status: "new",
        ref_code: refCode,
        project_name: projectName,
        client_name: clientName || projectName,
        client_email: clientEmail,
        intake_submitted_at: new Date().toISOString(),
      });
      if (dbError) {
        console.error("[kickoff] Supabase error:", dbError.message);
      }
    } else {
      console.warn("[kickoff] Supabase not configured — skipping DB write");
    }

    // ── Fire-and-forget: Deploy to 4 platforms + send email ──
    runDeployPipeline(
      projectPath,
      safeName,
      cfName,
      meta,
      refCode,
      clientEmail,
      clientName || projectName,
      projectName,
      request.url,
    ).catch((err) =>
      console.error("[kickoff] Background deploy error:", err),
    );

    // ── Return immediately with ref code ──
    return NextResponse.json({
      success: true,
      ref_code: refCode,
      project_path: projectPath,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kickoff] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ─── Background deploy pipeline (non-blocking) ─── */

async function runDeployPipeline(
  projectPath: string,
  safeName: string,
  cfName: string,
  meta: ProjectMeta,
  refCode: string,
  clientEmail: string,
  clientName: string,
  projectName: string,
  requestUrl: string,
) {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.warn("[kickoff] GITHUB_TOKEN not set — skipping deploy pipeline");
    return;
  }

  try {
    // Git init
    await runCmd("git init", projectPath);
    await runCmd('git config user.name "planflowai"', projectPath);
    await runCmd('git config user.email "rgallo2016@gmail.com"', projectPath);
    await runCmd("git add .", projectPath);
    await runCmd('git commit -m "Initial commit - coming soon page"', projectPath);
    await runCmd("git branch -M main", projectPath);

    // Get GitHub login
    const ghRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/json" },
    });
    const ghUser = await ghRes.json();
    const ghLogin = ghUser.login as string;

    // Create GitHub repo
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
        githubUrl = `https://github.com/${ghLogin}/${safeName}`;
      } else {
        throw new Error(createData.message || "GitHub API error");
      }
      const remoteUrl = `https://${ghLogin}:${githubToken}@github.com/${ghLogin}/${safeName}.git`;
      await runCmd("git remote remove origin", projectPath).catch(() => {});
      await runCmd(`git remote add origin "${remoteUrl}"`, projectPath);
      await runCmd("git push -u origin main", projectPath);
    } catch (err) {
      console.warn("[kickoff] GitHub deploy failed:", err);
    }

    // Vercel deploy
    let vercelUrl = "";
    try {
      const { code: vCode } = await runCmd("npx --yes vercel --version", projectPath);
      if (vCode !== 0) throw new Error("Vercel CLI not installed");
      await runCmd("npx --yes vercel link --yes", projectPath, 90_000);
      await runCmd("npx --yes vercel --prod --yes", projectPath, 120_000);
      vercelUrl = `https://${safeName}.vercel.app`;
    } catch {
      console.warn("[kickoff] Vercel deploy skipped");
    }

    // Netlify deploy
    let netlifyUrl = "";
    try {
      const { code: nCode } = await runCmd("netlify --version", projectPath);
      if (nCode !== 0) throw new Error("Netlify CLI not installed");
      const { stdout: acctOut } = await runCmd("netlify api listAccountsForUser --data '{}'", projectPath);
      const acctMatch = acctOut.match(/"slug"\s*:\s*"([^"]+)"/);
      const acctSlug = acctMatch?.[1] || "";
      const { stdout: siteOut } = await runCmd(
        `netlify sites:create --name "${safeName}" --account-slug "${acctSlug}"`,
        projectPath,
        60_000,
      );
      const siteIdMatch = siteOut.match(/Site ID:\s*([a-f0-9-]+)/i);
      const siteId = siteIdMatch?.[1] || "";
      if (siteId) {
        const netlifyDir = path.join(projectPath, ".netlify");
        await fs.mkdir(netlifyDir, { recursive: true });
        await fs.writeFile(path.join(netlifyDir, "state.json"), JSON.stringify({ siteId }), "utf-8");
        await runCmd(`netlify link --id "${siteId}"`, projectPath);
      }
      const { stdout: deployOut } = await runCmd('netlify deploy --prod --dir "."', projectPath, 120_000);
      const urlMatch = deployOut.match(/https:\/\/[^\s]+\.netlify\.app[^\s]*/);
      netlifyUrl = urlMatch?.[0] || `https://${safeName}.netlify.app`;
    } catch {
      console.warn("[kickoff] Netlify deploy skipped");
    }

    // Cloudflare deploy
    let cloudflareUrl = "";
    try {
      const { code: cCode } = await runCmd("npx --yes wrangler --version", projectPath);
      if (cCode !== 0) throw new Error("Wrangler CLI not installed");
      await runCmd(
        `npx --yes wrangler pages project create "${cfName}" --production-branch main`,
        projectPath,
        60_000,
      ).catch(() => {});
      const { stdout: cfOut } = await runCmd(
        `npx --yes wrangler pages deploy "." --project-name="${cfName}" --branch=main`,
        projectPath,
        120_000,
      );
      const cfMatch = cfOut.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
      cloudflareUrl = cfMatch?.[0] || `https://${cfName}.pages.dev`;
    } catch {
      console.warn("[kickoff] Cloudflare deploy skipped");
    }

    // Update project.json with deploy URLs
    meta.deployUrls = { github: githubUrl, vercel: vercelUrl, netlify: netlifyUrl, cloudflare: cloudflareUrl };
    await fs.writeFile(
      path.join(projectPath, "project.json"),
      JSON.stringify(meta, null, 2),
      "utf-8",
    );
    await runCmd("git add project.json", projectPath);
    await runCmd('git commit -m "Update deploy URLs in project.json"', projectPath).catch(() => {});
    await runCmd("git push origin", projectPath).catch(() => {});

    // Send welcome email — intake form link points to builder-standalone, NOT deploy URL
    const comingSoonUrl = vercelUrl || netlifyUrl || cloudflareUrl || githubUrl;
    const builderOrigin = new URL(requestUrl).origin;
    const intakeFormUrl = `${builderOrigin}/intake/${encodeURIComponent(refCode)}`;
    try {
      const emailEndpoint = new URL("/api/email/send", requestUrl).toString();
      await fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          template: "welcome",
          data: {
            client_name: clientName,
            project_name: projectName,
            coming_soon_url: comingSoonUrl,
            intake_form_url: intakeFormUrl,
            ref_code: refCode,
            your_phone: "",
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[kickoff] Welcome email sent to ${clientEmail}`);
    } catch (err) {
      console.warn("[kickoff] Welcome email failed:", err);
    }

    console.log(`[kickoff] Deploy pipeline complete for ${safeName}:`, meta.deployUrls);
  } catch (err) {
    console.error("[kickoff] Deploy pipeline error:", err);
  }
}
