import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { intakeToPrompt } from "@sarge/builder/lib/intakeToPrompt";
import { injectPII, countPlaceholders } from "@sarge/builder/lib/piiInjector";

// ── Types ───────────────────────────────────────────────────────────────
interface StepResult {
  step: number;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  duration_ms?: number;
}

interface PipelineReport {
  timestamp: string;
  duration_seconds: number;
  total_cost: string;
  steps: StepResult[];
  passed: number;
  failed: number;
  skipped: number;
  summary: string;
}

// ── Dummy data ──────────────────────────────────────────────────────────
const DUMMY_INTAKE = {
  client_name: "Pipeline Test Client",
  business_name: "Test Plumbing Co",
  email: "test@pipeline.local",
  phone: "(555) 123-4567",
  industry: "plumber",
  location: "Minneapolis, MN",
  business_description:
    "Professional plumbing services for residential and commercial clients.",
  usp: "24/7 emergency service with no overtime charges",
  target_audience: "Homeowners in the Minneapolis metro area",
  primary_cta: ["call", "book"],
  pages: ["home", "about", "services", "contact", "testimonials"],
  features: ["seo", "accessibility"],
  style_vibe: ["professional"],
  color_primary: "#1E40AF",
  color_secondary: "#1E3A5F",
  color_accent: "#10B981",
  theme: ["dark"],
  hours: "Mon-Fri 7am-7pm, Sat 8am-2pm",
  service_area: "Minneapolis, St. Paul, and surrounding suburbs",
  service_name: ["Emergency Plumbing", "Drain Cleaning", "Water Heater Install"],
  service_desc: [
    "24/7 emergency service",
    "Hydro-jetting and snake",
    "Tank and tankless options",
  ],
  testimonial_quote: ['"Fixed our burst pipe in under an hour!"'],
  testimonial_name: ["Mike T., Minneapolis"],
  site_phone: "(555) 123-4567",
  site_email: "info@testplumbing.com",
  site_address: "123 Main St, Minneapolis, MN 55401",
  ref: "SARGE-PIPELINETEST-" + Date.now().toString(36).toUpperCase(),
  submitted_at: new Date().toISOString(),
};

const DUMMY_PII = {
  phone: "(612) 555-9999",
  email: "real@testplumbing.com",
  address: "456 Oak Ave, Minneapolis, MN 55402",
  name: "Test Plumbing Co",
};

const DUMMY_REVISION = {
  ref_code: DUMMY_INTAKE.ref,
  page: "home",
  description: "Pipeline test revision — change hero background to dark blue",
  priority: "low",
};

// ── Helpers ─────────────────────────────────────────────────────────────
function getBaseUrl(request: NextRequest): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function runStep(
  stepNum: number,
  name: string,
  fn: () => Promise<string>
): Promise<StepResult> {
  const start = Date.now();
  try {
    const details = await fn();
    return {
      step: stepNum,
      name,
      status: "PASS",
      details,
      duration_ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      step: stepNum,
      name,
      status: "FAIL",
      details: err.message || String(err),
      duration_ms: Date.now() - start,
    };
  }
}

// ── Main route ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const baseUrl = getBaseUrl(request);
  const steps: StepResult[] = [];
  let totalCost = 0;

  // Shared state between steps
  let refCode = DUMMY_INTAKE.ref;
  let assembledPrompt = "";
  let generatedHtml = "";
  let projectPath = "";
  let scores: Record<string, number> = {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const hasSupabase = !!(supabaseUrl && supabaseKey);

  // Pick cheapest available model
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasGemini = !!(
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  );
  const cheapModel = hasDeepSeek
    ? { model: "deepseek-chat", provider: "deepseek" }
    : hasGemini
      ? { model: "gemini-2.0-flash-lite", provider: "google" }
      : null;

  // ── Step 1: Intake Submission ───────────────────────────────────────
  steps.push(
    await runStep(1, "Intake Submission", async () => {
      const res = await fetch(`${baseUrl}/api/intake/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DUMMY_INTAKE),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error}`);
      if (!data.ref_code)
        throw new Error("No ref_code returned");
      refCode = data.ref_code;
      return `Row created, ref ${refCode}`;
    })
  );

  // ── Step 2: Prompt Assembly ─────────────────────────────────────────
  steps.push(
    await runStep(2, "Prompt Assembly", async () => {
      assembledPrompt = intakeToPrompt(DUMMY_INTAKE);
      if (!assembledPrompt || assembledPrompt.length < 100)
        throw new Error(
          `Prompt too short: ${assembledPrompt?.length || 0} chars`
        );
      const hasPhone = assembledPrompt.includes("{{phone}}");
      const hasEmail = assembledPrompt.includes("{{email}}");
      if (!hasPhone || !hasEmail)
        throw new Error("Missing PII placeholders");

      const hasIndustry = assembledPrompt.includes("trustworthy");
      const pageCount = DUMMY_INTAKE.pages.filter((p) =>
        assembledPrompt.includes(p.charAt(0).toUpperCase() + p.slice(1))
      ).length;

      return `${assembledPrompt.length} chars, 2 PII tokens, ${pageCount} pages${hasIndustry ? ", industry keywords present" : ""}`;
    })
  );

  // ── Step 3: Project Creation ────────────────────────────────────────
  const projectsDir =
    process.env.BUILDER_PROJECTS_DIR || "L:/AI_MASTER_BUILDS";
  const testProjectName = `pipeline-test-${Date.now()}`;
  projectPath = `${projectsDir}/${testProjectName}`;

  steps.push(
    await runStep(3, "Project Creation", async () => {
      const res = await fetch(`${baseUrl}/api/builder/create-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          projectName: testProjectName,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${data.error || "Failed"}`);
      if (!data.success) throw new Error("success=false");
      return `Created at ${data.projectPath}, ${data.filesCreated} files, template: ${data.template}`;
    })
  );

  // ── Step 4: Build Execution ─────────────────────────────────────────
  steps.push(
    await runStep(4, "Build Execution", async () => {
      if (!cheapModel)
        throw new Error(
          "No cloud API key available (need DEEPSEEK_API_KEY or GOOGLE_API_KEY)"
        );

      const systemPrompt =
        "You are a code builder. Generate a single self-contained HTML file with all CSS in <style> and all JS in <script>. Output ONLY the code in a code fence.";
      // Use a trimmed prompt to save tokens
      const buildPrompt =
        assembledPrompt.length > 2000
          ? assembledPrompt.slice(0, 2000) + "\n\n[Prompt trimmed for test]"
          : assembledPrompt;

      const res = await fetch(`${baseUrl}/api/test/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cheapModel.model,
          provider: cheapModel.provider,
          prompt: buildPrompt,
          systemPrompt,
          source: "cloud",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      let fullContent = "";
      let outputTokens = 0;
      let inputTokens = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.message?.content) fullContent += data.message.content;
            if (data.usage) {
              inputTokens = data.usage.input_tokens || inputTokens;
              outputTokens = data.usage.output_tokens || outputTokens;
            }
          } catch {}
        }
      }

      // Extract HTML from code fences
      const htmlMatch = fullContent.match(
        /```(?:html)?\s*\n([\s\S]*?)```/
      );
      generatedHtml = htmlMatch ? htmlMatch[1].trim() : fullContent;

      if (generatedHtml.length < 500)
        throw new Error(
          `HTML too short: ${generatedHtml.length} chars`
        );
      if (
        !generatedHtml.toLowerCase().includes("<!doctype") &&
        !generatedHtml.toLowerCase().includes("<html")
      )
        throw new Error("No DOCTYPE or <html> tag found");

      // Estimate cost (DeepSeek: $0.28/M in, $0.42/M out; Gemini Flash Lite: ~$0.075/M in, $0.30/M out)
      const rates =
        cheapModel.provider === "deepseek"
          ? { inRate: 0.28, outRate: 0.42 }
          : { inRate: 0.075, outRate: 0.3 };
      const cost =
        (inputTokens * rates.inRate + outputTokens * rates.outRate) / 1_000_000;
      totalCost += cost;

      return `${generatedHtml.length} chars, ${inputTokens} in / ${outputTokens} out tokens, $${cost.toFixed(4)}`;
    })
  );

  // ── Step 5: Conversation History ────────────────────────────────────
  steps.push(
    await runStep(5, "Conversation History", async () => {
      if (!cheapModel) throw new Error("No cloud API key");
      if (!generatedHtml)
        throw new Error("No HTML from Step 4");

      const history = [
        {
          role: "user",
          content: "Build a plumbing website with home and services pages.",
        },
        {
          role: "assistant",
          content:
            "Here is your plumbing website:\n```html\n" +
            generatedHtml.slice(0, 200) +
            "\n... [code truncated]\n```",
        },
      ];

      const res = await fetch(`${baseUrl}/api/test/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cheapModel.model,
          provider: cheapModel.provider,
          prompt:
            "Add a testimonials section with 3 client quotes below the services section. Keep all existing content.",
          systemPrompt:
            "You are a code builder. Output the COMPLETE updated HTML file.",
          source: "cloud",
          conversationHistory: history,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      let followUpContent = "";
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.message?.content)
              followUpContent += data.message.content;
            if (data.usage) {
              const cost2 =
                ((data.usage.input_tokens || 0) * 0.28 +
                  (data.usage.output_tokens || 0) * 0.42) /
                1_000_000;
              totalCost += cost2;
            }
          } catch {}
        }
      }

      if (followUpContent.length < 200)
        throw new Error(
          `Follow-up too short: ${followUpContent.length} chars`
        );

      return `History sent (${history.length} messages), response ${followUpContent.length} chars`;
    })
  );

  // ── Step 6: Edit Mode ───────────────────────────────────────────────
  steps.push(
    await runStep(6, "Edit Mode", async () => {
      if (!cheapModel) throw new Error("No cloud API key");
      if (!generatedHtml)
        throw new Error("No HTML from Step 4");

      // Send edit-mode system prompt with current code
      const codeWithLines = generatedHtml
        .split("\n")
        .map((l, i) => `${i + 1}: ${l}`)
        .slice(0, 100) // First 100 lines only
        .join("\n");

      const editSystemPrompt = `You are in EDIT MODE. The user wants surgical changes to existing code.
RULES:
- Output ONLY the changed sections using this format:
EDIT lines N-M:
\`\`\`
replacement code
\`\`\`
- Do NOT output the full file. Only output the specific lines that need to change.
- Preserve all other code exactly as-is.`;

      const res = await fetch(`${baseUrl}/api/test/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cheapModel.model,
          provider: cheapModel.provider,
          prompt: `Here is the current code:\n\`\`\`\n${codeWithLines}\n\`\`\`\n\nChange the primary button color to #2563EB (blue).`,
          systemPrompt: editSystemPrompt,
          source: "cloud",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      let editContent = "";
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.message?.content)
              editContent += data.message.content;
            if (data.usage) {
              const cost3 =
                ((data.usage.input_tokens || 0) * 0.28 +
                  (data.usage.output_tokens || 0) * 0.42) /
                1_000_000;
              totalCost += cost3;
            }
          } catch {}
        }
      }

      const hasEditBlocks = /EDIT\s+lines?\s+\d+/i.test(editContent);
      const hasFullFile =
        editContent.toLowerCase().includes("<!doctype") ||
        editContent.toLowerCase().includes("<html");

      if (hasEditBlocks) {
        return `Model returned EDIT blocks (surgical changes) — correct behavior`;
      } else if (hasFullFile) {
        return `Model returned full file — diff enforcement would trigger approval dialog`;
      } else if (editContent.length > 50) {
        return `Model returned ${editContent.length} chars — contains code changes`;
      } else {
        throw new Error(
          `Edit response too short: ${editContent.length} chars`
        );
      }
    })
  );

  // ── Step 7: Compiler ────────────────────────────────────────────────
  steps.push(
    await runStep(7, "Compiler", async () => {
      const htmlToAudit = generatedHtml || "<html><body><h1>Test</h1></body></html>";

      const res = await fetch(`${baseUrl}/api/benchmark/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlToAudit }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const report = await res.json();

      // Extract scores — the audit package returns nested structure
      const perfScore =
        report.performance?.score ??
        report.scores?.performance ??
        0;
      const a11yScore =
        report.accessibility?.score ??
        report.scores?.accessibility ??
        0;
      const seoScore =
        report.seo?.score ?? report.scores?.seo ?? 0;
      const bpScore =
        report.bestPractices?.score ??
        report.scores?.bestPractices ??
        0;

      scores = {
        performance: perfScore,
        accessibility: a11yScore,
        seo: seoScore,
        bestPractices: bpScore,
      };

      const violations = report.violations || [];
      const allNumbers = Object.values(scores).every(
        (s) => typeof s === "number" && s >= 0 && s <= 100
      );
      if (!allNumbers)
        throw new Error(
          `Invalid scores: ${JSON.stringify(scores)}`
        );

      return `Perf: ${scores.performance}, A11y: ${scores.accessibility}, SEO: ${scores.seo}, BP: ${scores.bestPractices}, ${violations.length} violations`;
    })
  );

  // ── Step 8: Certificate Check ───────────────────────────────────────
  steps.push(
    await runStep(8, "Certificate Check", async () => {
      const allAbove80 = Object.values(scores).every(
        (s) => s >= 80
      );
      const allAbove90 = Object.values(scores).every(
        (s) => s >= 90
      );

      if (!allAbove80) {
        return `Scores below 80 — badge: NEEDS REVIEW (${Object.entries(scores).map(([k, v]) => `${k}: ${v}`).join(", ")})`;
      }

      const tier = allAbove90 ? "gold" : "silver";
      const res = await fetch(`${baseUrl}/api/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          clientName: "Pipeline Test Client",
          siteUrl: "https://test-plumbing.pipeline.local",
          scores,
          model: cheapModel?.model || "test",
          provider: cheapModel?.provider || "test",
          buildTimeMs: 5000,
          cost: totalCost,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const pdfBuffer = await res.arrayBuffer();
      if (pdfBuffer.byteLength < 100)
        throw new Error(
          `PDF too small: ${pdfBuffer.byteLength} bytes`
        );

      return `${tier.toUpperCase()} certificate generated, ${(pdfBuffer.byteLength / 1024).toFixed(1)}KB PDF`;
    })
  );

  // ── Step 9: PII Injection ───────────────────────────────────────────
  steps.push(
    await runStep(9, "PII Injection", async () => {
      // Test with HTML that has placeholders
      const testHtml = generatedHtml || `<html><body>Call {{phone}} or email {{email}} at {{address}}. Welcome to {{name}}.</body></html>`;

      const beforeCount = countPlaceholders(testHtml);
      const injected = injectPII(testHtml, DUMMY_PII);
      const afterCount = countPlaceholders(injected);

      // Check real values are present
      const hasPhone = injected.includes(DUMMY_PII.phone!);
      const hasEmail = injected.includes(DUMMY_PII.email!);

      if (beforeCount === 0 && !testHtml.includes("{{")) {
        // Generated HTML had no placeholders — test with synthetic
        const syntheticHtml = `<p>Call {{phone}} or {{email}}</p>`;
        const synInjected = injectPII(syntheticHtml, DUMMY_PII);
        const synAfter = countPlaceholders(synInjected);
        if (synAfter > 0)
          throw new Error("Placeholders remain after injection");
        return `No placeholders in generated HTML; synthetic test passed (2→0 placeholders)`;
      }

      if (afterCount > 0)
        throw new Error(
          `${afterCount} placeholders remain after injection`
        );

      return `${beforeCount}→${afterCount} placeholders, real values injected${hasPhone ? " ✓phone" : ""}${hasEmail ? " ✓email" : ""}`;
    })
  );

  // ── Step 10: Supabase Logging ───────────────────────────────────────
  steps.push(
    await runStep(10, "Supabase Logging", async () => {
      if (!hasSupabase)
        throw new Error("Supabase not configured");

      const supabase = createClient(supabaseUrl, supabaseKey);
      const fiveMinAgo = new Date(
        Date.now() - 5 * 60 * 1000
      ).toISOString();

      const [buildHist, compResults, billing] = await Promise.all([
        supabase
          .from("forge_build_history")
          .select("id")
          .gte("created_at", fiveMinAgo)
          .limit(1),
        supabase
          .from("forge_compiler_results")
          .select("id")
          .gte("created_at", fiveMinAgo)
          .limit(1),
        supabase
          .from("forge_billing")
          .select("id")
          .gte("created_at", fiveMinAgo)
          .limit(1),
      ]);

      const found: string[] = [];
      const missing: string[] = [];

      if (buildHist.data && buildHist.data.length > 0)
        found.push("build_history");
      else missing.push("build_history");

      if (compResults.data && compResults.data.length > 0)
        found.push("compiler_results");
      else missing.push("compiler_results");

      if (billing.data && billing.data.length > 0)
        found.push("billing");
      else missing.push("billing");

      // At least one table should have data from this test
      if (found.length === 0)
        throw new Error(
          `No rows in any Supabase table (checked: ${missing.join(", ")})`
        );

      return `Found rows in: ${found.join(", ")}${missing.length > 0 ? `. Missing: ${missing.join(", ")}` : ""}`;
    })
  );

  // ── Step 11: Revision Form ──────────────────────────────────────────
  steps.push(
    await runStep(11, "Revision Submission", async () => {
      const revisionPayload = { ...DUMMY_REVISION, ref_code: refCode };
      const res = await fetch(`${baseUrl}/api/intake/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revisionPayload),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${data.error}`);
      if (!data.success) throw new Error("success=false");
      return `Revision created for ref ${refCode}, page: ${revisionPayload.page}`;
    })
  );

  // ── Cleanup: delete test project directory ──────────────────────────
  if (projectPath) {
    try {
      const fs = await import("fs/promises");
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch {
      // Non-critical — cleanup failure doesn't affect report
    }
  }

  // ── Build report ────────────────────────────────────────────────────
  const passed = steps.filter((s) => s.status === "PASS").length;
  const failed = steps.filter((s) => s.status === "FAIL").length;
  const skipped = steps.filter((s) => s.status === "SKIP").length;
  const durationSeconds = (Date.now() - startTime) / 1000;

  const report: PipelineReport = {
    timestamp: new Date().toISOString(),
    duration_seconds: Math.round(durationSeconds * 10) / 10,
    total_cost: `$${totalCost.toFixed(4)}`,
    steps,
    passed,
    failed,
    skipped,
    summary:
      failed === 0
        ? `PIPELINE HEALTHY — all ${passed} steps passed`
        : `PIPELINE ISSUES — ${passed} passed, ${failed} failed`,
  };

  return NextResponse.json(report);
}
