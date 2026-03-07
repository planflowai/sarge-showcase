/**
 * Visual Review Pipeline — THING 1 + THING 3
 *
 * 1. Screenshots each page at desktop + mobile via Puppeteer
 * 2. Free automated checks (height, overflow, broken images)
 * 3. Sends screenshot to vision model (Ollama qwen3-vl → Gemini fallback)
 * 4. Logs findings
 *
 * Usage: node scripts/visual-review.mjs [projectDir]
 */
import puppeteer from "puppeteer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";

const PROJECT_DIR = process.argv[2] || "L:/ai_builder/projects/planflowai";
const OLLAMA_URL = "http://127.0.0.1:11434";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MAX_PAGE_HEIGHT = 4000;
const MAX_PASSES = 3;

const PAGES = [
  { name: "Home", file: "index.html" },
  { name: "Showroom", file: "showroom.html" },
  { name: "Pricing", file: "pricing.html" },
  { name: "Services", file: "services.html" },
  { name: "How It Works", file: "how-it-works.html" },
  { name: "About", file: "about.html" },
  { name: "Contact", file: "contact.html" },
];

const VISION_PROMPT = `You are a professional web designer reviewing a website screenshot. List every visual issue you see: broken layouts, overlapping text, text showing one word per line, broken columns, missing images, inconsistent spacing, elements that look wrong, excessive whitespace, unreadable text, broken alignment. Be specific — describe where on the page each issue is and what needs to change. Do not say it looks good unless it's perfect.`;

// ── Puppeteer screenshots + automated checks ──────────────────────

async function screenshotAndCheck(browser, htmlPath, pageName) {
  const page = await browser.newPage();
  const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;

  const result = {
    page: pageName,
    file: basename(htmlPath),
    desktopScreenshot: "",
    mobileScreenshot: "",
    pageHeight: 0,
    viewportHeights: 0,
    issues: [],
  };

  try {
    // Desktop screenshot (1920px)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("body", { timeout: 5000 });

    // Scroll through entire page to trigger IntersectionObserver animations
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportH = 1080;
    for (let y = 0; y < scrollHeight; y += viewportH * 0.6) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await new Promise((r) => setTimeout(r, 200));
    }
    // Scroll back to top and wait for animations to complete
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 500));

    // Get page height (after animations)
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    result.pageHeight = pageHeight;
    result.viewportHeights = pageHeight / 1080;

    // Desktop screenshot (full page with all animations triggered)
    const desktopPath = join(PROJECT_DIR, `${pageName.toLowerCase().replace(/\s+/g, "-")}-desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: true });
    result.desktopScreenshot = desktopPath;

    // Mobile screenshot (375px)
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("body", { timeout: 5000 });
    // Scroll mobile too
    const mScrollH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < mScrollH; y += 600) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await new Promise((r) => setTimeout(r, 150));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));
    const mobilePath = join(PROJECT_DIR, `${pageName.toLowerCase().replace(/\s+/g, "-")}-mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: true });
    result.mobileScreenshot = mobilePath;

    // ── Automated checks (desktop) ──
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    // Scroll to trigger animations for checks
    const checkH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < checkH; y += viewportH) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await new Promise((r) => setTimeout(r, 100));
    }

    // 1. Page height check
    if (pageHeight > MAX_PAGE_HEIGHT) {
      result.issues.push({
        type: "HEIGHT",
        severity: "warning",
        message: `Page height ${pageHeight}px exceeds ${MAX_PAGE_HEIGHT}px limit (${(pageHeight / 1080).toFixed(1)}x viewport)`,
      });
    }
    if (pageHeight > MAX_PAGE_HEIGHT * 1.25) {
      result.issues[result.issues.length - 1].severity = "critical";
      result.issues[result.issues.length - 1].message += " — excessive scrolling";
    }

    // 2. Horizontal overflow check
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasOverflow) {
      result.issues.push({
        type: "OVERFLOW",
        severity: "critical",
        message: "Horizontal overflow detected — content wider than viewport",
      });
    }

    // 3. Broken image detection
    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const broken = [];
      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          broken.push({ src: img.src?.slice(0, 100), alt: img.alt });
        }
        if (!img.complete || img.naturalWidth === 0) {
          broken.push({ src: img.src?.slice(0, 100), alt: img.alt, reason: "failed to load" });
        }
      }
      return broken;
    });
    if (brokenImages.length > 0) {
      for (const img of brokenImages) {
        result.issues.push({
          type: "BROKEN_IMAGE",
          severity: "warning",
          message: `Broken image: ${img.alt || "no alt"} (${img.src || "no src"})${img.reason ? ` — ${img.reason}` : ""}`,
        });
      }
    }
  } catch (err) {
    result.issues.push({
      type: "VISION_MODEL",
      severity: "critical",
      message: `Screenshot failed: ${err.message}`,
    });
  } finally {
    await page.close();
  }

  return result;
}

// ── Vision model review ──────────────────────────────────────────

async function findOllamaVisionModel() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    const models = data.models.map((m) => m.name);
    // Prefer qwen3-vl, then minicpm-v, then llava-phi3
    for (const preferred of ["qwen3-vl:latest", "minicpm-v:latest", "llava-phi3:latest"]) {
      if (models.includes(preferred)) return preferred;
    }
    // Try partial matches
    for (const m of models) {
      if (m.includes("qwen3-vl") || m.includes("minicpm-v") || m.includes("llava")) return m;
    }
    return null;
  } catch {
    return null;
  }
}

async function reviewWithOllama(model, screenshotPath) {
  const imageBuffer = readFileSync(screenshotPath);
  const base64 = imageBuffer.toString("base64");

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: VISION_PROMPT,
      images: [base64],
      stream: false,
      options: { num_predict: 2048 },
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.response || "";
}

async function reviewWithGemini(screenshotPath) {
  if (!GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY");

  const imageBuffer = readFileSync(screenshotPath);
  const base64 = imageBuffer.toString("base64");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VISION_PROMPT },
              { inline_data: { mime_type: "image/png", data: base64 } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function visionReview(screenshotPath) {
  // Try Ollama vision model first
  const ollamaModel = await findOllamaVisionModel();
  if (ollamaModel) {
    try {
      console.log(`  [VISION] Using Ollama ${ollamaModel}...`);
      const findings = await reviewWithOllama(ollamaModel, screenshotPath);
      return { model: ollamaModel, provider: "ollama", findings };
    } catch (err) {
      console.log(`  [VISION] Ollama failed: ${err.message}`);
    }
  }

  // Fallback to Gemini
  try {
    console.log(`  [VISION] Falling back to Gemini 2.5 Flash...`);
    const findings = await reviewWithGemini(screenshotPath);
    return { model: "gemini-2.5-flash", provider: "gemini", findings };
  } catch (err) {
    console.log(`  [VISION] Gemini failed: ${err.message}`);
    return { model: "none", provider: "ollama", findings: `Vision review unavailable: ${err.message}` };
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"=".repeat(70)}`);
  console.log("VISUAL REVIEW PIPELINE");
  console.log(`Project: ${PROJECT_DIR}`);
  console.log("=".repeat(70));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const allResults = [];
  const allVisionReviews = [];
  const logSections = [];

  for (const pageInfo of PAGES) {
    const htmlPath = join(PROJECT_DIR, pageInfo.file);
    if (!existsSync(htmlPath)) {
      console.log(`[SKIP] ${pageInfo.file} not found`);
      continue;
    }

    console.log(`\n[${pageInfo.name}] Screenshotting + automated checks...`);
    const result = await screenshotAndCheck(browser, htmlPath, pageInfo.name);
    allResults.push(result);

    console.log(`  Height: ${result.pageHeight}px (${result.viewportHeights.toFixed(1)}x viewport)`);
    console.log(`  Desktop: ${result.desktopScreenshot}`);
    console.log(`  Mobile: ${result.mobileScreenshot}`);

    if (result.issues.length > 0) {
      for (const issue of result.issues) {
        const icon = issue.severity === "critical" ? "🔴" : "🟡";
        console.log(`  ${icon} ${issue.type}: ${issue.message}`);
      }
    } else {
      console.log(`  ✅ No automated issues`);
    }

    // Vision model review (desktop screenshot)
    if (existsSync(result.desktopScreenshot)) {
      const review = await visionReview(result.desktopScreenshot);
      allVisionReviews.push({ page: pageInfo.name, file: pageInfo.file, review });
      console.log(`  [VISION] ${review.model} review complete (${review.findings.length} chars)`);
    }

    // Build log section
    const logLines = [`## Visual Review — ${pageInfo.file}`];
    logLines.push(`Page height: ${result.pageHeight}px (${result.viewportHeights.toFixed(1)}x viewport)`);
    if (result.issues.length === 0) {
      logLines.push(`- No automated issues found`);
    } else {
      for (const issue of result.issues) {
        logLines.push(`- ${issue.severity.toUpperCase()}: ${issue.type} — ${issue.message}`);
      }
    }
    const vision = allVisionReviews.find((v) => v.page === pageInfo.name);
    if (vision) {
      logLines.push(`\n### AI Visual Review (${vision.review.model})`);
      logLines.push(vision.review.findings);
    }
    logLines.push("");
    logSections.push(logLines.join("\n"));
  }

  await browser.close();

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("VISUAL REVIEW SUMMARY");
  console.log("=".repeat(70));
  console.log(`${"Page".padEnd(20)} | ${"Height".padEnd(10)} | ${"VH".padEnd(6)} | Issues`);
  console.log("-".repeat(70));
  for (const r of allResults) {
    const heightFlag = r.pageHeight > MAX_PAGE_HEIGHT ? " ⚠️" : "";
    console.log(
      `${r.page.padEnd(20)} | ${(r.pageHeight + "px").padEnd(10)} | ${r.viewportHeights.toFixed(1).padStart(4)}x | ${r.issues.length} issues${heightFlag}`,
    );
  }

  // Save visual review log
  const logContent = [
    `# Visual Review Log — ${basename(PROJECT_DIR)}`,
    `Date: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`,
    "",
    ...logSections,
  ].join("\n");

  const logPath = join(PROJECT_DIR, "VISUAL_REVIEW.md");
  writeFileSync(logPath, logContent);
  console.log(`\nVisual review log saved: ${logPath}`);

  // Output JSON for programmatic use
  const outputPath = join(PROJECT_DIR, "visual-review.json");
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        results: allResults.map((r) => ({
          page: r.page,
          file: r.file,
          pageHeight: r.pageHeight,
          viewportHeights: r.viewportHeights,
          issueCount: r.issues.length,
          issues: r.issues,
        })),
        visionReviews: allVisionReviews.map((v) => ({
          page: v.page,
          file: v.file,
          model: v.review.model,
          provider: v.review.provider,
          findings: v.review.findings,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`JSON output saved: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
