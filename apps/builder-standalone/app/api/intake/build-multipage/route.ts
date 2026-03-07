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
  pickModelForDifficulty,
  type BuildPageResult,
} from "@sarge/builder/lib/multiPageBuilder";
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

        // Step 3: Build each page
        const results: BuildPageResult[] = [];
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

          const startTime = Date.now();

          try {
            // Generate per-page prompt
            const pagePrompt = intakeToPagePrompt(rawFormData, pageName, sharedCss, navSnippet);

            // Call the streaming API to build this page
            const buildRes = await fetch(
              `http://localhost:${process.env.PORT || 3101}/api/test/stream`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider,
                  model,
                  prompt: pagePrompt,
                  systemPrompt: `You are a web developer building the ${pageName} page for a client website. Output ONLY the complete HTML file. No explanations, no markdown. Start with <!DOCTYPE html> and end with </html>. Include all CSS in <style> tags and all JS in <script> tags. The page must be fully self-contained and responsive.`,
                  source: "multipage-builder",
                  maxOutputTokens: 8192,
                }),
                signal: AbortSignal.timeout(120000),
              },
            );

            if (!buildRes.ok || !buildRes.body) {
              throw new Error(`Build API returned ${buildRes.status}`);
            }

            // Read the streaming response and collect the HTML
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

            // Extract just the HTML from the response (strip markdown fences if present)
            html = extractHtml(html);

            // Save to disk IMMEDIATELY
            fs.writeFileSync(path.join(projectDir, filename), html);

            const result: BuildPageResult = {
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

            // Guardian check
            const guard = guardianCheck(html, pageName);
            send({
              event: "guardian",
              page: pageName,
              pass: guard.pass,
              issues: guard.issues,
            });

            results.push(result);
            send({
              event: "page_complete",
              phase: "page",
              page: pageName,
              filename,
              difficulty,
              model,
              provider,
              reason,
              tokens: result.tokens,
              durationMs,
              size: html.length,
              guardianPass: guard.pass,
              index: i + 1,
              total,
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const durationMs = Date.now() - startTime;

            results.push({
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
            });

            send({
              event: "page_complete",
              phase: "page",
              page: pageName,
              filename,
              status: "failed",
              error: errMsg,
              index: i + 1,
              total,
            });
          }
        }

        // Step 4: Generate BUILD_LOG.md
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);
        const logLines = [
          `# Build Log — ${projectName}`,
          `Ref: ${refCode} | Built: ${now}`,
          "",
          `## Summary`,
          `Pages: ${results.length} | Complete: ${results.filter((r) => r.status === "complete").length} | Failed: ${results.filter((r) => r.status === "failed").length}`,
          "",
        ];

        for (const r of results) {
          logLines.push(`## ${r.filename}${r.page !== r.filename ? ` (${r.page})` : ""}`);
          logLines.push(`Model: ${r.model} | Provider: ${r.provider}`);
          logLines.push(`Tokens: ${r.tokens.input}/${r.tokens.output} | Time: ${(r.durationMs / 1000).toFixed(1)}s`);
          logLines.push(`Difficulty: ${r.difficulty} | Status: ${r.status.toUpperCase()}`);
          if (r.error) logLines.push(`Error: ${r.error}`);
          logLines.push("");
        }

        const buildLog = logLines.join("\n");
        fs.writeFileSync(path.join(projectDir, "BUILD_LOG.md"), buildLog);
        send({ event: "build_log", content: buildLog, projectDir });

        // Update Supabase status
        await supabase
          .from("client_intake")
          .update({ status: "built" })
          .eq("ref_code", refCode)
          .then(() => {});

        send({
          event: "done",
          projectName,
          refCode,
          projectDir,
          pagesBuilt: results.filter((r) => r.status === "complete").length,
          pagesFailed: results.filter((r) => r.status === "failed").length,
          totalPages: results.length,
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
