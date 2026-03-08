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
  pickModelForDifficulty,
  MIN_PAGE_SIZE,
  type BuildPageResult,
  type GuardianFinding,
} from "@sarge/builder/lib/multiPageBuilder";
import { injectPII, countPlaceholders, type PIIData } from "@sarge/builder/lib/piiInjector";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PROJECTS_DIR = process.env.PROJECTS_DIR || "L:/ai_builder/projects";

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

        // Step 1: Generate shared CSS
        send({ event: "progress", phase: "styles", message: "Generating shared styles..." });
        const sharedCss = generateSharedCss(flat);
        fs.writeFileSync(path.join(projectDir, "styles.css"), sharedCss);
        send({ event: "page_complete", phase: "styles", filename: "styles.css", size: sharedCss.length });

        // Step 2: Generate nav snippet
        send({ event: "progress", phase: "nav", message: "Generating navigation..." });
        const navSnippet = generateNavSnippet(pages);
        send({ event: "page_complete", phase: "nav", filename: "nav-snippet.html", size: navSnippet.length });

        // Retry escalation: if a page fails or is too small, retry with next tier
        const ESCALATION: Record<string, "medium" | "hard"> = { easy: "medium", medium: "hard" };

        // Step 3: Build each page
        const results: BuildPageResult[] = [];
        const guardianLog: Array<{ filename: string; findings: GuardianFinding[] }> = [];
        const total = pages.length;

        for (let i = 0; i < pages.length; i++) {
          const pageName = pages[i];
          const pageKey = pageName.toLowerCase().replace(/\s+/g, "-");
          const filename = pageKey === "home" ? "index.html" : `${pageKey}.html`;
          const difficulty = (PAGE_DIFFICULTY[pageKey] || "medium") as "easy" | "medium" | "hard";

          // Pick model
          let provider = overrideProvider || "";
          let model = overrideModel || "";
          let reason = "User override";

          if (!provider || !model) {
            const pick = pickModelForDifficulty(difficulty);
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

          const result = await buildOnePage(
            rawFormData, pageName, pageKey, filename, difficulty,
            provider, model, reason, sharedCss, navSnippet, send,
          );

          // Check size threshold — retry with escalated model if too small
          if (result.status === "complete" && result.html.length < MIN_PAGE_SIZE && ESCALATION[difficulty as string]) {
            const nextTier = ESCALATION[difficulty as string];
            const escalated = pickModelForDifficulty(nextTier);
            send({
              event: "progress",
              phase: "page",
              message: `${pageName} too small (${result.html.length} bytes < ${MIN_PAGE_SIZE}). Retrying with ${escalated.model}...`,
              index: i + 1,
              total,
              page: pageName,
              difficulty: nextTier,
              model: escalated.model,
              provider: escalated.provider,
              reason: `Retry — original ${result.html.length} bytes < ${MIN_PAGE_SIZE} threshold`,
            });

            const retry = await buildOnePage(
              rawFormData, pageName, pageKey, filename, nextTier,
              escalated.provider, escalated.model, `Retry escalation from ${difficulty} to ${nextTier}`,
              sharedCss, navSnippet, send,
            );
            const retryGuard = guardianCheck(retry.html, pageName, projectName, pages);
            retry.html = retryGuard.html; // use cleaned HTML
            retry.status = retry.html.length >= MIN_PAGE_SIZE && retryGuard.pass ? "complete" : "failed";
            if (retry.status === "failed") {
              retry.error = retry.html.length < MIN_PAGE_SIZE
                ? `Page too small after retry (${retry.html.length} bytes)`
                : `Guardian check failed after retry: ${retryGuard.issues.join(", ")}`;
            }
            if (retryGuard.findings.length > 0) {
              guardianLog.push({ filename, findings: retryGuard.findings });
            }
            results.push(retry);
          } else if (result.status === "complete" && result.html.length < MIN_PAGE_SIZE) {
            // Already at hard tier, can't escalate — mark failed
            result.status = "failed";
            result.error = `Page too small (${result.html.length} bytes < ${MIN_PAGE_SIZE} threshold)`;
            results.push(result);
          } else {
            // Run enhanced guardian — structural check + hallucination scan + auto-replace
            if (result.status === "complete") {
              const guard = guardianCheck(result.html, pageName, projectName, pages);
              result.html = guard.html; // use cleaned HTML with auto-replacements
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
          }

          // Save to disk (even partial pages — overwrite previous attempts)
          const final = results[results.length - 1];
          if (final.html.length > 0) {
            fs.writeFileSync(path.join(projectDir, filename), final.html);
          }

          send({
            event: "page_complete",
            phase: "page",
            page: pageName,
            filename,
            difficulty: final.difficulty,
            model: final.model,
            provider: final.provider,
            reason,
            tokens: final.tokens,
            durationMs: final.durationMs,
            size: final.html.length,
            guardianPass: final.status === "complete",
            status: final.status,
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

        // Step 6: PII Injection — replace all {{placeholder}} tokens with real client data
        send({ event: "progress", phase: "pii", message: "Injecting client data into pages..." });

        const piiData: PIIData = {
          name: flat.business_name || projectName,
          phone: flat.phone || flat.step6_contact?.phone || "",
          email: flat.email || flat.step6_contact?.email || "",
          address: flat.address || flat.step6_contact?.address || "",
          city: flat.city || flat.step6_contact?.city || "",
          state: flat.state || flat.step6_contact?.state || "",
          clientName: flat.client_name || flat.contact_name || flat.owner_name || "",
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
        for (const line of piiLog) logLines.push(line);
        logLines.push("");

        send({
          event: "progress",
          phase: "pii",
          message: `PII injection complete: ${totalReplacements} replacements across ${htmlFiles.length} files`,
          piiData: Object.fromEntries(Object.entries(piiData).filter(([, v]) => v)),
          piiLog,
        });

        // Step 7: Post-build image URL fix — replace deprecated source.unsplash.com URLs
        send({ event: "progress", phase: "images", message: "Fixing broken image URLs..." });
        let totalImageFixes = 0;

        for (const htmlFile of htmlFiles) {
          const filePath = path.join(projectDir, htmlFile);
          let html = fs.readFileSync(filePath, "utf-8");
          let fixes = 0;

          // Replace source.unsplash.com URLs with picsum.photos
          html = html.replace(
            /https?:\/\/source\.unsplash\.com\/(?:random\/)?(\d+)x(\d+)\/?[^"'\s)>]*/g,
            (_match, w, h) => { fixes++; return `https://picsum.photos/${w}/${h}`; },
          );
          // Handle source.unsplash.com without dimensions
          html = html.replace(
            /https?:\/\/source\.unsplash\.com\/[^"'\s)>]*/g,
            () => { fixes++; return `https://picsum.photos/800/600`; },
          );
          // Fix empty src attributes
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

        const buildLog = logLines.join("\n");
        fs.writeFileSync(path.join(projectDir, "BUILD_LOG.md"), buildLog);
        send({ event: "build_log", content: buildLog, projectDir });

        // Update Supabase status — only mark "built" if all pages pass
        const allPassed = passed.length === results.length;
        await supabase
          .from("client_intake")
          .update({ status: allPassed ? "built" : "partial" })
          .eq("ref_code", refCode)
          .then(() => {});

        send({
          event: "done",
          projectName,
          refCode,
          projectDir,
          pagesBuilt: passed.length,
          pagesFailed: failed.length,
          totalPages: results.length,
          allPassed,
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

    let html = "";
    let tokenInput = 0;
    let tokenOutput = 0;
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

    const durationMs = Date.now() - startTime;
    html = extractHtml(html);

    // Quick structural check (hallucination scan happens in the route after buildOnePage)
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
