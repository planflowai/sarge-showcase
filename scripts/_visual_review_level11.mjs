/**
 * Visual Review — Level 11 Events
 * Same pipeline as visual-review.mjs but with Level 11 page list
 */
import puppeteer from "puppeteer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";

const PROJECT_DIR = "L:/ai_builder/projects/level-11-events";
const OLLAMA_URL = "http://127.0.0.1:11434";
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const MAX_PAGE_HEIGHT = 4000;

const PAGES = [
  { name: "Home", file: "index.html" },
  { name: "Services", file: "services.html" },
  { name: "Gallery", file: "gallery.html" },
  { name: "Testimonials", file: "testimonials.html" },
  { name: "About", file: "about.html" },
  { name: "Contact", file: "contact.html" },
];

const VISION_PROMPT = `You are a professional web designer reviewing a website screenshot for "Level 11 Events" — a premium event entertainment company (DJs, photo booths, lighting). List every visual issue you see: broken layouts, overlapping text, text showing one word per line, broken columns, missing images, inconsistent spacing, elements that look wrong, excessive whitespace, unreadable text, broken alignment, color contrast problems. Be specific — describe where on the page each issue is and what needs to change. Do not say it looks good unless it is perfect.`;

async function screenshotAndCheck(browser, htmlPath, pageName) {
  const page = await browser.newPage();
  const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
  const result = { page: pageName, file: basename(htmlPath), desktopScreenshot: "", mobileScreenshot: "", pageHeight: 0, viewportHeights: 0, issues: [] };
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("body", { timeout: 5000 });
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < scrollHeight; y += 648) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await new Promise((r) => setTimeout(r, 200));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 500));
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    result.pageHeight = pageHeight;
    result.viewportHeights = pageHeight / 1080;
    const desktopPath = join(PROJECT_DIR, `${pageName.toLowerCase().replace(/\s+/g, "-")}-desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: true });
    result.desktopScreenshot = desktopPath;
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    const mScrollH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < mScrollH; y += 600) { await page.evaluate((sy) => window.scrollTo(0, sy), y); await new Promise(r => setTimeout(r, 150)); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 300));
    const mobilePath = join(PROJECT_DIR, `${pageName.toLowerCase().replace(/\s+/g, "-")}-mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: true });
    result.mobileScreenshot = mobilePath;
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    if (pageHeight > MAX_PAGE_HEIGHT) result.issues.push({ type: "HEIGHT", severity: pageHeight > MAX_PAGE_HEIGHT * 1.25 ? "critical" : "warning", message: `Page height ${pageHeight}px exceeds ${MAX_PAGE_HEIGHT}px limit` });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (hasOverflow) result.issues.push({ type: "OVERFLOW", severity: "critical", message: "Horizontal overflow detected" });
    const brokenImages = await page.evaluate(() => { const imgs = Array.from(document.querySelectorAll("img")); return imgs.filter(i => !i.complete || i.naturalWidth === 0 || i.getBoundingClientRect().width === 0).map(i => ({ src: i.src?.slice(0,100), alt: i.alt })); });
    for (const img of brokenImages) result.issues.push({ type: "BROKEN_IMAGE", severity: "warning", message: `Broken image: ${img.alt || "no alt"} (${img.src || "no src"})` });
  } catch (err) {
    result.issues.push({ type: "ERROR", severity: "critical", message: `Screenshot failed: ${err.message}` });
  } finally { await page.close(); }
  return result;
}

async function findOllamaVisionModel() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    const models = data.models.map(m => m.name);
    for (const p of ["qwen3-vl:latest", "minicpm-v:latest", "llava-phi3:latest"]) { if (models.includes(p)) return p; }
    for (const m of models) { if (m.includes("qwen3-vl") || m.includes("minicpm-v") || m.includes("llava")) return m; }
    return null;
  } catch { return null; }
}

async function reviewWithOllama(model, screenshotPath) {
  const base64 = readFileSync(screenshotPath).toString("base64");
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: VISION_PROMPT, images: [base64], stream: false, options: { num_predict: 2048 } }),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  return (await res.json()).response || "";
}

async function reviewWithGemini(screenshotPath) {
  if (!GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY");
  const base64 = readFileSync(screenshotPath).toString("base64");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: VISION_PROMPT }, { inline_data: { mime_type: "image/png", data: base64 } }] }], generationConfig: { maxOutputTokens: 2048 } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function visionReview(screenshotPath) {
  const ollamaModel = await findOllamaVisionModel();
  if (ollamaModel) {
    try { console.log(`  [VISION] Using Ollama ${ollamaModel}...`); return { model: ollamaModel, provider: "ollama", findings: await reviewWithOllama(ollamaModel, screenshotPath) }; }
    catch (err) { console.log(`  [VISION] Ollama failed: ${err.message}`); }
  }
  try { console.log(`  [VISION] Falling back to Gemini...`); return { model: "gemini-2.5-flash", provider: "gemini", findings: await reviewWithGemini(screenshotPath) }; }
  catch (err) { return { model: "none", provider: "none", findings: `Vision review unavailable: ${err.message}` }; }
}

async function main() {
  console.log(`\n${"=".repeat(70)}`);
  console.log("VISUAL REVIEW — Level 11 Events");
  console.log(`Project: ${PROJECT_DIR}`);
  console.log("=".repeat(70));
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
  const allResults = [], allVisionReviews = [], logSections = [];
  for (const pageInfo of PAGES) {
    const htmlPath = join(PROJECT_DIR, pageInfo.file);
    if (!existsSync(htmlPath)) { console.log(`[SKIP] ${pageInfo.file} not found`); continue; }
    console.log(`\n[${pageInfo.name}] Screenshotting + automated checks...`);
    const result = await screenshotAndCheck(browser, htmlPath, pageInfo.name);
    allResults.push(result);
    console.log(`  Height: ${result.pageHeight}px (${result.viewportHeights.toFixed(1)}x viewport)`);
    if (result.issues.length > 0) { for (const i of result.issues) console.log(`  ${i.severity === "critical" ? "RED" : "WARN"}: ${i.type}: ${i.message}`); }
    else console.log(`  OK — No automated issues`);
    if (existsSync(result.desktopScreenshot)) {
      const review = await visionReview(result.desktopScreenshot);
      allVisionReviews.push({ page: pageInfo.name, file: pageInfo.file, review });
      console.log(`  [VISION] Review complete (${review.findings.length} chars)`);
    }
    const logLines = [`## ${pageInfo.name} — ${pageInfo.file}`, `Height: ${result.pageHeight}px (${result.viewportHeights.toFixed(1)}x viewport)`];
    if (result.issues.length === 0) logLines.push(`- No automated issues`); else for (const i of result.issues) logLines.push(`- ${i.severity.toUpperCase()}: ${i.message}`);
    const v = allVisionReviews.find(vr => vr.page === pageInfo.name);
    if (v) { logLines.push(`\n### AI Review (${v.review.model})`, v.review.findings); }
    logLines.push(""); logSections.push(logLines.join("\n"));
  }
  await browser.close();
  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));
  for (const r of allResults) console.log(`${r.page.padEnd(20)} | ${(r.pageHeight+"px").padEnd(10)} | ${r.viewportHeights.toFixed(1).padStart(4)}x | ${r.issues.length} issues`);
  const logContent = [`# Visual Review — Level 11 Events`, `Date: ${new Date().toISOString().replace("T"," ").slice(0,19)}`, "", ...logSections].join("\n");
  writeFileSync(join(PROJECT_DIR, "VISUAL_REVIEW.md"), logContent);
  writeFileSync(join(PROJECT_DIR, "visual-review.json"), JSON.stringify({ results: allResults.map(r => ({ page: r.page, file: r.file, pageHeight: r.pageHeight, viewportHeights: r.viewportHeights, issues: r.issues })), visionReviews: allVisionReviews.map(v => ({ page: v.page, file: v.file, model: v.review.model, provider: v.review.provider, findings: v.review.findings })) }, null, 2));
  console.log(`\nLogs saved to ${PROJECT_DIR}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
