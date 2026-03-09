// WARNING: The system prompt in buildOnePage() differs from the Forge Trials prompt. See PROMPT_COMPARISON.md
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  flattenIntake,
  intakeToPagePrompt,
  PAGE_DIFFICULTY,
} from "@sarge/builder/lib/intakeToPrompt";
import {
  generateSharedCss,
  generateNavSnippet,
  guardianCheck,
  checkNavConsistency,
  formatGuardianFindings,
  MIN_PAGE_SIZE,
  type BuildPageResult,
  type GuardianFinding,
} from "@sarge/builder/lib/multiPageBuilder";
import { injectPII, countPlaceholders, type PIIData } from "@sarge/builder/lib/piiInjector";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PROJECTS_DIR = process.env.PROJECTS_DIR || "L:/ai_builder/projects";
const OLLAMA_URL = "http://127.0.0.1:11434";

// ── FIX 2: Auto-Router Config Array ─────────────────────────────────────────
// Model chain per difficulty tier — tried in order, first available wins.
// Per BUILDER_RULES.md: local first, cheap cloud second, mid-tier third, expensive last.

interface ModelOption {
  provider: string;
  model: string;
  type: "local" | "cloud";
}

const MODEL_CHAINS: Record<string, ModelOption[]> = {
  easy: [
    { provider: "ollama", model: "qwen2.5-coder:14b", type: "local" },
    { provider: "ollama", model: "qwen2.5-coder:7b", type: "local" },
    { provider: "ollama", model: "codellama:7b", type: "local" },
    { provider: "deepseek", model: "deepseek-chat", type: "cloud" },
    { provider: "xai", model: "grok-4-1-fast-non-reasoning", type: "cloud" },
    { provider: "google", model: "gemini-2.5-flash", type: "cloud" },
  ],
  medium: [
    { provider: "deepseek", model: "deepseek-chat", type: "cloud" },
    { provider: "xai", model: "grok-4-1-fast-non-reasoning", type: "cloud" },
    { provider: "google", model: "gemini-2.5-flash", type: "cloud" },
    { provider: "openai", model: "gpt-4.1", type: "cloud" },
  ],
  hard: [
    { provider: "google", model: "gemini-2.5-flash", type: "cloud" },
    { provider: "openai", model: "gpt-4.1", type: "cloud" },
    { provider: "xai", model: "grok-4-0709", type: "cloud" },
    { provider: "anthropic", model: "claude-sonnet-4-5-20250514", type: "cloud" },
  ],
};

/** Check which local Ollama models are available */
async function getAvailableOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => m.name as string);
  } catch {
    return [];
  }
}

/** Pick the first available model from the chain for a difficulty tier */
async function routeModel(
  difficulty: "easy" | "medium" | "hard",
  ollamaModels: string[],
  failedModels: Set<string>,
): Promise<{ provider: string; model: string; reason: string }> {
  const chain = MODEL_CHAINS[difficulty] || MODEL_CHAINS.medium;

  for (const option of chain) {
    const key = `${option.provider}:${option.model}`;
    if (failedModels.has(key)) continue;

    if (option.type === "local") {
      // Check if this local model is actually available in Ollama
      if (ollamaModels.some((m) => m === option.model || m.startsWith(option.model.split(":")[0]))) {
        return { provider: option.provider, model: option.model, reason: `${difficulty} tier — local first (${option.model})` };
      }
      continue; // Local model not available, try next
    }

    // Cloud model — always considered available
    return { provider: option.provider, model: option.model, reason: `${difficulty} tier — ${option.model}` };
  }

  // Fallback: Gemini Flash (should never reach here)
  return { provider: "google", model: "gemini-2.5-flash", reason: `${difficulty} tier — ultimate fallback` };
}

/**
 * Multi-page build pipeline — streams progress events as NDJSON.
 *
 * POST /api/intake/build-multipage
 * Body: { ref_code: string, provider?: string, model?: string }
 *
 * Streams: { event: "progress"|"page_complete"|"guardian"|"build_log"|"done"|"error", ... }
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: any) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        const body = await req.json();
        const refCode = body.ref_code;
        const overrideProvider = body.provider;
        const overrideModel = body.model;

        if (!refCode) {
          send({ event: "error", message: "Missing ref_code" });
          controller.close();
          return;
        }

        // Fetch intake from Supabase
        if (!supabaseUrl || !supabaseKey) {
          send({ event: "error", message: "Supabase not configured" });
          controller.close();
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: intake, error: fetchErr } = await supabase
          .from("client_intake")
          .select("*")
          .eq("ref_code", refCode)
          .single();

        if (fetchErr || !intake) {
          send({ event: "error", message: "Intake not found" });
          controller.close();
          return;
        }

        const rawFormData = intake.form_data || intake;
        const flat = flattenIntake(rawFormData);
        const projectName = flat.business_name || intake.project_name || "Client Project";
        const pages: string[] = Array.isArray(flat.pages) ? flat.pages : ["home"];

        // Create project directory
        const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const projectDir = path.join(PROJECTS_DIR, projectSlug);
        fs.mkdirSync(projectDir, { recursive: true });

        send({
          event: "progress",
          phase: "init",
          message: `Starting multi-page build for ${projectName}`,
          pages,
          projectDir,
        });

        // ── FIX 2: Check Ollama availability at pipeline start ──────────
        send({ event: "progress", phase: "router", message: "Checking available models..." });
        const ollamaModels = await getAvailableOllamaModels();
        const ollamaAvailable = ollamaModels.length > 0;
        send({
          event: "progress",
          phase: "router",
          message: ollamaAvailable
            ? `Ollama online — ${ollamaModels.length} local models available: ${ollamaModels.slice(0, 5).join(", ")}${ollamaModels.length > 5 ? "..." : ""}`
            : "Ollama offline — using cloud models only",
          ollamaModels: ollamaAvailable ? ollamaModels : [],
        });

        // Step 1: Generate shared CSS
        send({ event: "progress", phase: "styles", message: "Generating shared styles..." });
        const sharedCss = generateSharedCss(flat);
        fs.writeFileSync(path.join(projectDir, "styles.css"), sharedCss);
        send({ event: "page_complete", phase: "styles", filename: "styles.css", size: sharedCss.length });

        // Step 2: Generate nav snippet
        send({ event: "progress", phase: "nav", message: "Generating navigation..." });
        const navSnippet = generateNavSnippet(pages);
        send({ event: "page_complete", phase: "nav", filename: "nav-snippet.html", size: navSnippet.length });

        // Step 3: Build each page with auto-router retry chain
        const results: BuildPageResult[] = [];
        const guardianLog: Array<{ filename: string; findings: GuardianFinding[] }> = [];
        const total = pages.length;
        const failedModels = new Set<string>(); // Track models that failed across pages

        for (let i = 0; i < pages.length; i++) {
          const pageName = pages[i];
          const pageKey = pageName.toLowerCase().replace(/\s+/g, "-");
          const filename = pageKey === "home" ? "index.html" : `${pageKey}.html`;
          const difficulty = (PAGE_DIFFICULTY[pageKey] || "medium") as "easy" | "medium" | "hard";

          // Pick model — user override or auto-router
          let provider = overrideProvider || "";
          let model = overrideModel || "";
          let reason = "User override";

          if (!provider || !model) {
            const pick = await routeModel(difficulty, ollamaModels, failedModels);
            provider = pick.provider;
            model = pick.model;
            reason = pick.reason;
          }

          send({
            event: "progress",
            phase: "page",
            message: `Building ${pageName} page...`,
            index: i + 1,
            total,
            page: pageName,
            difficulty,
            model,
            provider,
            reason,
          });

          // Build with retry chain — if model fails or page too small, try next in chain
          let result = await buildOnePage(
            rawFormData, pageName, pageKey, filename, difficulty,
            provider, model, reason, sharedCss, navSnippet, send,
          );

          // Retry loop: if failed or too small, try next model in chain
          let attempts = 1;
          const maxAttempts = 3;
          while (
            attempts < maxAttempts &&
            (result.status === "failed" || result.html.length < MIN_PAGE_SIZE)
          ) {
            const prevKey = `${provider}:${model}`;
            failedModels.add(prevKey);
            const failReason = result.html.length < MIN_PAGE_SIZE && result.status !== "failed"
              ? `too small (${result.html.length} bytes < ${MIN_PAGE_SIZE})`
              : result.error || "failed";

            send({
              event: "progress",
              phase: "page",
              message: `${pageName}: ${model} ${failReason}. Trying next model...`,
              index: i + 1,
              total,
              page: pageName,
              attempt: attempts + 1,
            });

            // Escalate difficulty for retry to get a better model
            const retryDifficulty = attempts === 1
              ? (difficulty === "easy" ? "medium" : "hard")
              : "hard";
            const next = await routeModel(retryDifficulty as "easy" | "medium" | "hard", ollamaModels, failedModels);
            provider = next.provider;
            model = next.model;
            reason = `Retry #${attempts} — ${next.reason}`;

            result = await buildOnePage(
              rawFormData, pageName, pageKey, filename, retryDifficulty as "easy" | "medium" | "hard",
              provider, model, reason, sharedCss, navSnippet, send,
            );
            attempts++;
          }

          // Final size check
          if (result.status !== "failed" && result.html.length < MIN_PAGE_SIZE) {
            result.status = "failed";
            result.error = `Page too small after ${attempts} attempts (${result.html.length} bytes < ${MIN_PAGE_SIZE})`;
          }

          // Run guardian on successful builds
          if (result.status === "complete") {
            const guard = guardianCheck(result.html, pageName, projectName, pages);
            result.html = guard.html;
            if (!guard.pass) {
              result.status = "failed";
              result.error = `Guardian failed: ${guard.issues.join(", ")}`;
            }
            if (guard.findings.length > 0) {
              guardianLog.push({ filename, findings: guard.findings });
              send({
                event: "guardian",
                page: pageName,
                pass: guard.pass,
                issues: guard.issues,
                findings: guard.findings.map((f) => `${f.type}: ${f.message} [${f.action}]`),
                navOk: guard.navOk,
                size: result.html.length,
              });
            }
          }

          results.push(result);

          // Save to disk
          if (result.html.length > 0) {
            fs.writeFileSync(path.join(projectDir, filename), result.html);
          }

          send({
            event: "page_complete",
            phase: "page",
            page: pageName,
            filename,
            difficulty: result.difficulty,
            model: result.model,
            provider: result.provider,
            reason,
            tokens: result.tokens,
            durationMs: result.durationMs,
            size: result.html.length,
            guardianPass: result.status === "complete",
            status: result.status,
            index: i + 1,
            total,
          });
        }

        // Step 4: Cross-page nav consistency check
        const pageHtmlMap = results
          .filter((r) => r.html.length > 0)
          .map((r) => ({ filename: r.filename, html: r.html }));
        const navFindings = checkNavConsistency(pageHtmlMap, pages);
        if (navFindings.length > 0) {
          send({
            event: "guardian",
            page: "ALL PAGES",
            pass: true,
            issues: [],
            findings: navFindings.map((f) => `${f.type}: ${f.message} [${f.action}]`),
            navOk: false,
          });
        }

        // Step 5: Generate BUILD_LOG.md with Guardian Findings
        const passed = results.filter((r) => r.status === "complete" && r.html.length >= MIN_PAGE_SIZE);
        const failed = results.filter((r) => r.status !== "complete" || r.html.length < MIN_PAGE_SIZE);
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);
        const totalFindings = guardianLog.reduce((n, g) => n + g.findings.length, 0) + navFindings.length;
        const logLines = [
          `# Build Log — ${projectName}`,
          `Ref: ${refCode} | Built: ${now}`,
          "",
          `## Summary`,
          `Pages: ${results.length} | Complete: ${passed.length} | Failed: ${failed.length} | Min size: ${MIN_PAGE_SIZE} bytes`,
          `Guardian findings: ${totalFindings} (${guardianLog.reduce((n, g) => n + g.findings.filter((f) => f.action === "auto-replaced").length, 0)} auto-replaced)`,
          "",
        ];

        for (const r of results) {
          const ok = r.status === "complete" && r.html.length >= MIN_PAGE_SIZE;
          logLines.push(`## ${r.filename}${r.page !== r.filename ? ` (${r.page})` : ""}`);
          logLines.push(`Model: ${r.model} | Provider: ${r.provider}`);
          logLines.push(`Tokens: ${r.tokens.input}/${r.tokens.output} | Time: ${(r.durationMs / 1000).toFixed(1)}s`);
          logLines.push(`Size: ${r.html.length} bytes | Difficulty: ${r.difficulty} | Status: ${ok ? "COMPLETE" : "FAILED"}`);
          if (r.error) logLines.push(`Error: ${r.error}`);
          logLines.push("");
        }

        // Guardian Findings per page
        if (guardianLog.length > 0 || navFindings.length > 0) {
          logLines.push("---");
          logLines.push("");
          for (const entry of guardianLog) {
            logLines.push(formatGuardianFindings(entry.filename, entry.findings));
          }
          if (navFindings.length > 0) {
            logLines.push(formatGuardianFindings("Cross-Page Navigation", navFindings));
          }
        }

        // ── FIX 1: PII Injection with correct field mapping ─────────────
        send({ event: "progress", phase: "pii", message: "Injecting client data into pages..." });

        // Parse location into city/state (e.g. "Eden Prairie, MN" → city="Eden Prairie", state="MN")
        const locationParts = (flat.location || "").split(",").map((s: string) => s.trim());

        const piiData: PIIData = {
          name: flat.business_name || projectName,
          phone: flat.site_phone || flat.business_phone || flat.phone || "",
          email: flat.site_email || flat.business_email || flat.email || "",
          address: flat.business_address || flat.address || "",
          city: locationParts[0] || flat.city || "",
          state: locationParts[1] || flat.state || "",
          clientName: flat.full_name || flat.client_name || flat.contact_name || "",
        };

        const htmlFiles = fs.readdirSync(projectDir).filter((f: string) => f.endsWith(".html"));
        let totalReplacements = 0;
        const piiLog: string[] = [];

        for (const htmlFile of htmlFiles) {
          const filePath = path.join(projectDir, htmlFile);
          const originalHtml = fs.readFileSync(filePath, "utf-8");
          const beforeCount = countPlaceholders(originalHtml);
          const injectedHtml = injectPII(originalHtml, piiData);
          const afterCount = countPlaceholders(injectedHtml);
          const replacements = beforeCount - afterCount;
          totalReplacements += replacements;

          if (replacements > 0) {
            fs.writeFileSync(filePath, injectedHtml);
          }

          piiLog.push(`- ${htmlFile}: ${replacements} replacements (${afterCount} remaining)`);
          if (afterCount > 0) {
            piiLog.push(`  ⚠ ${afterCount} unresolved placeholders remain`);
          }
        }

        logLines.push("---");
        logLines.push("");
        logLines.push("## PII Injection");
        logLines.push(`Total replacements: ${totalReplacements} across ${htmlFiles.length} files`);
        logLines.push(`PII data: name="${piiData.name}", phone="${piiData.phone}", email="${piiData.email}", address="${piiData.address}", city="${piiData.city}", state="${piiData.state}", clientName="${piiData.clientName}"`);
        for (const line of piiLog) logLines.push(line);
        logLines.push("");

        send({
          event: "progress",
          phase: "pii",
          message: `PII injection complete: ${totalReplacements} replacements across ${htmlFiles.length} files`,
          piiData: Object.fromEntries(Object.entries(piiData).filter(([, v]) => v)),
          piiLog,
        });

        // Step 7: Post-build image URL fix
        send({ event: "progress", phase: "images", message: "Fixing broken image URLs..." });
        let totalImageFixes = 0;

        for (const htmlFile of htmlFiles) {
          const filePath = path.join(projectDir, htmlFile);
          let html = fs.readFileSync(filePath, "utf-8");
          let fixes = 0;

          html = html.replace(
            /https?:\/\/source\.unsplash\.com\/(?:random\/)?(\d+)x(\d+)\/?[^"'\s)>]*/g,
            (_match, w, h) => { fixes++; return `https://picsum.photos/${w}/${h}`; },
          );
          html = html.replace(
            /https?:\/\/source\.unsplash\.com\/[^"'\s)>]*/g,
            () => { fixes++; return `https://picsum.photos/800/600`; },
          );
          html = html.replace(
            /<img([^>]*)\ssrc\s*=\s*["']\s*["']/g,
            (_match, attrs) => { fixes++; return `<img${attrs} src="https://picsum.photos/800/600"`; },
          );

          if (fixes > 0) {
            fs.writeFileSync(filePath, html);
            totalImageFixes += fixes;
          }
        }

        if (totalImageFixes > 0) {
          logLines.push("## Image URL Fixes");
          logLines.push(`Fixed ${totalImageFixes} broken image URLs (source.unsplash.com → picsum.photos)`);
          logLines.push("");
        }

        send({
          event: "progress",
          phase: "images",
          message: `Fixed ${totalImageFixes} broken image URLs`,
        });

        // Step 8: Billing — log cost for each page build
        const baseUrl = `http://localhost:${process.env.PORT || 3101}`;
        for (const r of results) {
          if (r.tokens.input > 0 || r.tokens.output > 0) {
            try {
              await fetch(`${baseUrl}/api/billing/log`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: r.model,
                  provider: r.provider,
                  app: "builder",
                  tokensIn: r.tokens.input,
                  tokensOut: r.tokens.output,
                  durationMs: r.durationMs,
                  context: `multipage-build:${r.page}`,
                }),
              });
            } catch { /* billing log failure is non-blocking */ }
          }
        }

        // ── FIX 5: Visual Review (inline, not subprocess) ───────────────
        send({ event: "progress", phase: "visual_review", message: "Running visual review..." });
        const visualLog: string[] = [];
        try {
          const reviewResults = await runVisualReview(projectDir, htmlFiles, send);
          for (const vr of reviewResults) {
            visualLog.push(`### ${vr.file}`);
            visualLog.push(`Model: ${vr.model} | Provider: ${vr.provider}`);
            if (vr.findings) visualLog.push(vr.findings);
            visualLog.push("");
          }
          logLines.push("---");
          logLines.push("");
          logLines.push("## Visual Review");
          logLines.push(`Reviewed ${reviewResults.length} pages`);
          for (const line of visualLog) logLines.push(line);
        } catch (vrErr: unknown) {
          const msg = vrErr instanceof Error ? vrErr.message : String(vrErr);
          logLines.push("## Visual Review");
          logLines.push(`Visual review failed: ${msg}`);
          logLines.push("");
          send({ event: "progress", phase: "visual_review", message: `Visual review failed: ${msg}` });
        }

        // ── FIX 3: Deploy to Vercel ─────────────────────────────────────
        send({ event: "progress", phase: "deploy", message: "Deploying to Vercel test subdomain..." });
        let deployUrl = "";
        try {
          deployUrl = await deployToVercel(projectDir, projectSlug, send);
          logLines.push("---");
          logLines.push("");
          logLines.push("## Deployment");
          logLines.push(`Deploy URL: ${deployUrl}`);
          logLines.push("");

          // Update Supabase with deploy URL
          await supabase
            .from("client_intake")
            .update({ deploy_url: deployUrl })
            .eq("ref_code", refCode)
            .then(() => {});
        } catch (deployErr: unknown) {
          const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
          logLines.push("---");
          logLines.push("");
          logLines.push("## Deployment");
          logLines.push(`Deploy failed: ${msg}`);
          logLines.push("");
          send({ event: "progress", phase: "deploy", message: `Deploy failed: ${msg}` });
        }

        // Write BUILD_LOG.md
        const buildLog = logLines.join("\n");
        fs.writeFileSync(path.join(projectDir, "BUILD_LOG.md"), buildLog);
        send({ event: "build_log", content: buildLog, projectDir });

        // Update Supabase status
        const allPassed = passed.length === results.length;
        await supabase
          .from("client_intake")
          .update({ status: allPassed ? "built" : "partial" })
          .eq("ref_code", refCode)
          .then(() => {});

        // ── FIX 4: Send site_live email if deploy succeeded ─────────────
        if (deployUrl && allPassed) {
          send({ event: "progress", phase: "email", message: "Sending build complete email..." });
          try {
            const clientEmail = flat.email || flat.business_email || intake.client_email || "";
            if (clientEmail) {
              await fetch(`${baseUrl}/api/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: clientEmail,
                  template: "site_live",
                  data: {
                    business_name: projectName,
                    project_name: projectName,
                    client_name: piiData.clientName || "there",
                    live_urls: deployUrl,
                    ref_code: refCode,
                  },
                }),
              });
              send({ event: "progress", phase: "email", message: `Build complete email sent to ${clientEmail}` });
              logLines.push("## Email");
              logLines.push(`site_live email sent to ${clientEmail}`);
              logLines.push("");
            }
          } catch (emailErr: unknown) {
            const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            send({ event: "progress", phase: "email", message: `Email failed: ${msg}` });
          }
        }

        send({
          event: "done",
          projectName,
          refCode,
          projectDir,
          pagesBuilt: passed.length,
          pagesFailed: failed.length,
          totalPages: results.length,
          allPassed,
          deployUrl,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ event: "error", message: msg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── FIX 3: Vercel Deploy ─────────────────────────────────────────────────────

async function deployToVercel(
  projectDir: string,
  projectSlug: string,
  send: (data: any) => void,
): Promise<string> {
  // Deploy using Vercel CLI — production=false for test subdomain
  const vercelToken = process.env.VERCEL_TOKEN || "";
  const tokenFlag = vercelToken ? `--token ${vercelToken}` : "";

  try {
    const output = execSync(
      `vercel deploy ${tokenFlag} --yes --name "${projectSlug}" 2>&1`,
      {
        cwd: projectDir,
        timeout: 120000,
        encoding: "utf-8",
        env: { ...process.env, VERCEL_ORG_ID: process.env.VERCEL_ORG_ID || "", VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || "" },
      },
    );

    // Extract URL from output (last line that looks like a URL)
    const lines = output.trim().split("\n");
    const urlLine = lines.reverse().find((l) => l.includes("https://"));
    const deployUrl = urlLine?.trim() || "";

    if (deployUrl) {
      send({ event: "progress", phase: "deploy", message: `Deployed: ${deployUrl}` });
      return deployUrl;
    }

    throw new Error(`No deploy URL in output: ${output.slice(0, 500)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If Vercel CLI fails, try a simpler approach
    throw new Error(`Vercel deploy failed: ${msg.slice(0, 300)}`);
  }
}

// ── FIX 5: Visual Review (inline API call to Ollama/Gemini) ──────────────────

interface VisualReviewResult {
  file: string;
  model: string;
  provider: string;
  findings: string;
}

async function runVisualReview(
  projectDir: string,
  htmlFiles: string[],
  send: (data: any) => void,
): Promise<VisualReviewResult[]> {
  const results: VisualReviewResult[] = [];
  const VISION_PROMPT = `You are a professional web designer. Review this HTML page for visual issues: broken layouts, overlapping text, text showing one word per line, broken columns, missing images, inconsistent spacing, excessive whitespace, unreadable text, broken alignment. Be specific and concise. List issues as bullet points. If it looks good, say "No visual issues found."`;

  for (const htmlFile of htmlFiles) {
    const filePath = path.join(projectDir, htmlFile);
    const html = fs.readFileSync(filePath, "utf-8");
    // Send HTML content to a text-based review (not vision — no screenshots in server context)
    // Try Ollama qwen3.5:9b first, then Gemini fallback
    let findings = "";
    let model = "";
    let provider = "";

    // Try Ollama qwen3.5:9b
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen3.5:9b",
          prompt: `${VISION_PROMPT}\n\nHTML to review:\n${html.slice(0, 12000)}`,
          stream: false,
          options: { num_predict: 1024 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        findings = data.response || "";
        model = "qwen3.5:9b";
        provider = "ollama";
      } else {
        throw new Error(`Ollama ${ollamaRes.status}`);
      }
    } catch {
      // Fallback to Gemini
      const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
      if (geminiKey) {
        try {
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${VISION_PROMPT}\n\nHTML to review:\n${html.slice(0, 12000)}` }] }],
                generationConfig: { maxOutputTokens: 1024 },
              }),
              signal: AbortSignal.timeout(30000),
            },
          );
          if (gemRes.ok) {
            const data = await gemRes.json();
            findings = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            model = "gemini-2.5-flash";
            provider = "google";
          }
        } catch { /* fallback also failed */ }
      }
    }

    if (!findings) {
      findings = "Visual review unavailable (no model responded)";
      model = "none";
      provider = "none";
    }

    results.push({ file: htmlFile, model, provider, findings });
    send({
      event: "progress",
      phase: "visual_review",
      message: `Reviewed ${htmlFile} with ${model}`,
      file: htmlFile,
      findings: findings.slice(0, 500),
    });
  }

  return results;
}

/**
 * Build a single page — calls /api/test/stream, collects HTML, saves to disk, runs guardian.
 */
async function buildOnePage(
  rawFormData: any,
  pageName: string,
  pageKey: string,
  filename: string,
  difficulty: "easy" | "medium" | "hard",
  provider: string,
  model: string,
  reason: string,
  sharedCss: string,
  navSnippet: string,
  send: (data: any) => void,
): Promise<BuildPageResult> {
  const startTime = Date.now();

  try {
    const pagePrompt = intakeToPagePrompt(rawFormData, pageName, sharedCss, navSnippet);

    // For Ollama models, call Ollama directly instead of going through /api/test/stream
    const isOllama = provider === "ollama";
    let html = "";
    let tokenInput = 0;
    let tokenOutput = 0;

    if (isOllama) {
      // Direct Ollama call
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: `You are a web developer building the "${pageName}" page for a client website.

OUTPUT RULES:
- Output ONLY the complete HTML file — no explanations, no markdown fences.
- Start with <!DOCTYPE html> and end with </html>.
- Include ALL CSS in <style> tags and ALL JavaScript in <script> tags.
- The page MUST be fully self-contained, responsive, and production-quality.
- Use the shared navigation HTML provided in the prompt — include it exactly as given.
- The page must be substantial — at least 200 lines of HTML with real content sections.
- Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{client_name}}.
- Each page must fit in 2-3 viewport heights max at 1920x1080 (under 4000px total height). Do NOT create infinitely scrolling pages.
- Use tabs, accordions, expandable sections instead of stacking everything vertically. Content-heavy sections should be collapsible.
- Do NOT use source.unsplash.com URLs — this service is deprecated and returns 404. For stock images, use https://picsum.photos/{width}/{height} (e.g. https://picsum.photos/800/600). Do NOT leave any img src empty.`,
          prompt: pagePrompt,
          stream: false,
          options: { num_predict: 16384, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(120000), // 2 min for local models
      });

      if (!ollamaRes.ok) {
        throw new Error(`Ollama returned ${ollamaRes.status}: ${await ollamaRes.text()}`);
      }

      const ollamaData = await ollamaRes.json();
      html = ollamaData.response || "";
      tokenInput = ollamaData.prompt_eval_count || 0;
      tokenOutput = ollamaData.eval_count || 0;
    } else {
      // Cloud model — use /api/test/stream
      const buildRes = await fetch(
        `http://localhost:${process.env.PORT || 3101}/api/test/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            model,
            prompt: pagePrompt,
            systemPrompt: `You are a web developer building the "${pageName}" page for a client website.

OUTPUT RULES:
- Output ONLY the complete HTML file — no explanations, no markdown fences.
- Start with <!DOCTYPE html> and end with </html>.
- Include ALL CSS in <style> tags and ALL JavaScript in <script> tags.
- The page MUST be fully self-contained, responsive, and production-quality.
- Use the shared navigation HTML provided in the prompt — include it exactly as given.
- The page must be substantial — at least 200 lines of HTML with real content sections.
- Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{client_name}}.
- Each page must fit in 2-3 viewport heights max at 1920x1080 (under 4000px total height). Do NOT create infinitely scrolling pages.
- Use tabs, accordions, expandable sections instead of stacking everything vertically. Content-heavy sections should be collapsible.
- Do NOT use source.unsplash.com URLs — this service is deprecated and returns 404. For stock images, use https://picsum.photos/{width}/{height} (e.g. https://picsum.photos/800/600). Do NOT leave any img src empty.`,
            source: "multipage-builder",
            maxOutputTokens: 16384,
          }),
          signal: AbortSignal.timeout(180000),
        },
      );

      if (!buildRes.ok || !buildRes.body) {
        throw new Error(`Build API returned ${buildRes.status}`);
      }

      const reader = buildRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.token) html += data.token;
            if (data.content) html += data.content;
            if (data.message?.content) html += data.message.content;
            if (data.usage) {
              tokenInput = data.usage.input_tokens || data.usage.prompt_tokens || 0;
              tokenOutput = data.usage.output_tokens || data.usage.completion_tokens || 0;
            }
            if (data.full_content) html = data.full_content;
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    html = extractHtml(html);

    // Quick structural check
    const guard = guardianCheck(html, pageName);
    send({
      event: "guardian",
      page: pageName,
      pass: guard.pass,
      issues: guard.issues,
      size: html.length,
    });
    html = guard.html;

    return {
      page: pageName,
      filename,
      difficulty,
      model,
      provider,
      html,
      tokens: { input: tokenInput, output: tokenOutput },
      durationMs,
      status: "complete",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;
    return {
      page: pageName,
      filename,
      difficulty,
      model,
      provider,
      html: "",
      tokens: { input: 0, output: 0 },
      durationMs,
      status: "failed",
      error: errMsg,
    };
  }
}

/** Extract HTML from response — strips markdown code fences if present */
function extractHtml(content: string): string {
  let html = content.trim();

  // Strip markdown code fence
  const fenceMatch = html.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    html = fenceMatch[1].trim();
  }

  // If it doesn't start with < after stripping, find the first < tag
  if (!html.startsWith("<")) {
    const idx = html.indexOf("<!DOCTYPE");
    if (idx === -1) {
      const idx2 = html.indexOf("<html");
      if (idx2 !== -1) html = html.slice(idx2);
    } else {
      html = html.slice(idx);
    }
  }

  return html;
}
