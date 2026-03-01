import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { ProjectMeta, ProjectToggles } from "@/lib/types/project";

const execAsync = promisify(exec);

const PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      clientName = "",
      clientEmail = "",
      domain = "",
      toggles,
      template = "blank-html",
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name required" }, { status: 400 });
    }

    const slug = slugify(name);
    const projectPath = join(PROJECTS_DIR, slug).replace(/\\/g, "/");

    if (existsSync(projectPath)) {
      return NextResponse.json(
        { error: `Project folder already exists: ${slug}` },
        { status: 409 }
      );
    }

    // Create project directory
    await mkdir(projectPath, { recursive: true });

    // Build project.json
    const projectMeta: ProjectMeta = {
      name: slug,
      clientName,
      clientEmail,
      domain,
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
      template,
    };

    await writeFile(
      join(projectPath, "project.json"),
      JSON.stringify(projectMeta, null, 2),
      "utf-8"
    );

    // Create placeholder index.html
    const seoMeta = projectMeta.toggles.seo
      ? `  <meta name="description" content="${name} — Built with The Foundry">\n  <meta name="robots" content="index, follow">\n`
      : "";

    const analyticsScript = projectMeta.toggles.analytics
      ? `\n  <script defer data-domain="${domain || slug}" src="https://plausible.io/js/script.js"></script>`
      : "";

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${seoMeta}  <title>${name}</title>${analyticsScript}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      color: #fafafa;
    }
    .welcome {
      text-align: center;
      padding: 2rem;
    }
    .welcome h1 {
      font-size: 2.5rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #FF6700, #ff9a44);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .welcome p { color: #888; font-size: 1.1rem; }
  </style>
</head>
<body>
  <div class="welcome">
    <h1>${name}</h1>
    <p>Built with The Foundry</p>
  </div>
</body>
</html>`;

    await writeFile(join(projectPath, "index.html"), indexHtml, "utf-8");

    // SEO files
    if (projectMeta.toggles.seo) {
      await writeFile(
        join(projectPath, "robots.txt"),
        `User-agent: *\nAllow: /\nSitemap: https://${domain || slug + ".vercel.app"}/sitemap.xml\n`,
        "utf-8"
      );
      await writeFile(
        join(projectPath, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://${domain || slug + ".vercel.app"}/</loc></url>\n</urlset>\n`,
        "utf-8"
      );
    }

    // Privacy page
    if (projectMeta.toggles.privacy) {
      await writeFile(
        join(projectPath, "privacy.html"),
        `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Privacy Policy — ${name}</title></head>\n<body>\n<h1>Privacy Policy</h1>\n<p>Last updated: ${new Date().toLocaleDateString()}</p>\n<p>This privacy policy outlines how we collect, use, and protect your information.</p>\n</body>\n</html>\n`,
        "utf-8"
      );
    }

    // BUILDER_LOG.md
    const toggleLabels = Object.entries(projectMeta.toggles)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");

    await writeFile(
      join(projectPath, "BUILDER_LOG.md"),
      `# Builder Log — ${name}\nLast updated: ${new Date().toISOString()}\n\n## Current State\nProject created via Onboarding Modal.\nClient: ${clientName || "N/A"}\nDomain: ${domain || "N/A"}\nToggles: ${toggleLabels}\n\n## Session: ${new Date().toLocaleDateString()}\n### Changes Made\n- Created project from onboarding flow\n- Template: ${template}\n- Generated index.html${projectMeta.toggles.seo ? ", robots.txt, sitemap.xml" : ""}${projectMeta.toggles.privacy ? ", privacy.html" : ""}\n\n### Next Steps\n- [ ] Customize the design\n- [ ] Add content\n- [ ] Deploy to hosting\n`,
      "utf-8"
    );

    // Try git init + GitHub deploy
    let githubUrl = "";
    try {
      await execAsync("git init", { cwd: projectPath, timeout: 10000 });
      await execAsync("git add -A", { cwd: projectPath, timeout: 10000 });
      await execAsync('git commit -m "Initial project — created via The Foundry"', {
        cwd: projectPath,
        timeout: 10000,
      });

      // Create GitHub repo if token available
      const ghToken = process.env.GITHUB_TOKEN;
      if (ghToken) {
        try {
          // Get username
          const userRes = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${ghToken}` },
          });
          const user = await userRes.json();

          // Create repo
          const repoRes = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: slug,
              private: true,
              description: `${name} — Built with The Foundry`,
            }),
          });

          if (repoRes.ok) {
            const repo = await repoRes.json();
            githubUrl = repo.html_url;
            await execAsync(
              `git remote add origin ${repo.clone_url}`,
              { cwd: projectPath, timeout: 10000 }
            );
            await execAsync("git push -u origin main", {
              cwd: projectPath,
              timeout: 30000,
              env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
            });

            // Update project.json with GitHub URL
            projectMeta.deployUrls.github = githubUrl;
            await writeFile(
              join(projectPath, "project.json"),
              JSON.stringify(projectMeta, null, 2),
              "utf-8"
            );
          }
        } catch {
          // GitHub deploy failed — continue without it
        }
      }
    } catch {
      // Git not available — continue without it
    }

    return NextResponse.json({
      success: true,
      projectPath,
      projectName: slug,
      deployUrls: projectMeta.deployUrls,
      projectJson: projectMeta,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
