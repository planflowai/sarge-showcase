/**
 * Forge Trials — Scoring Engine
 * 100-point weighted scoring with three-tier results (pass/partial/fail).
 * Reusable across domains via customValidator hook.
 */

import type {
  ValidationCriteria,
  ScoreBreakdown,
  Tier,
} from "./runner";
import { getTier } from "./runner";

// ── Code Extraction ──────────────────────────────────────────────────

const CODE_FENCE_RE = /```(?:\w+)?\s*\n([\s\S]*?)```/g;

/**
 * Extract the best code block from a response.
 * 1. Try markdown code fences (longest block wins).
 * 2. Try finding <!DOCTYPE html>...</html> anywhere in the response.
 * 3. Try finding <html>...</html> anywhere.
 * 4. Fallback: if response starts with HTML tag, return as-is.
 */
export function extractCode(response: string): string {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  CODE_FENCE_RE.lastIndex = 0;
  while ((match = CODE_FENCE_RE.exec(response)) !== null) {
    blocks.push(match[1].trim());
  }

  if (blocks.length > 0) {
    // Prefer the longest block (most likely the full code)
    return blocks.reduce((a, b) => (a.length >= b.length ? a : b));
  }

  // Search for HTML document anywhere in the response (not just at the start)
  const lower = response.toLowerCase();
  const doctypeIdx = lower.indexOf("<!doctype html");
  const htmlOpenIdx = lower.indexOf("<html");
  const htmlCloseIdx = lower.lastIndexOf("</html>");

  // Found <!DOCTYPE html>...</html>
  if (doctypeIdx !== -1 && htmlCloseIdx > doctypeIdx) {
    return response.slice(doctypeIdx, htmlCloseIdx + 7).trim();
  }

  // Found <html>...</html>
  if (htmlOpenIdx !== -1 && htmlCloseIdx > htmlOpenIdx) {
    return response.slice(htmlOpenIdx, htmlCloseIdx + 7).trim();
  }

  // Found <!DOCTYPE html> but no closing tag — take from doctype to end
  if (doctypeIdx !== -1) {
    return response.slice(doctypeIdx).trim();
  }

  // Found <html> but no closing tag — take from html to end
  if (htmlOpenIdx !== -1) {
    return response.slice(htmlOpenIdx).trim();
  }

  // Fallback: if the response itself starts with an HTML tag
  const trimmed = response.trim();
  if (
    trimmed.startsWith("<div") ||
    trimmed.startsWith("<nav") ||
    trimmed.startsWith("<section")
  ) {
    return trimmed;
  }

  return "";
}

// ── HTML Validation ──────────────────────────────────────────────────

type ContentType =
  | "html-document"
  | "html-snippet"
  | "react-jsx"
  | "css-only"
  | "js-only"
  | "text";

function detectContentType(code: string): ContentType {
  const lower = code.toLowerCase();
  if (lower.includes("<!doctype html") || lower.includes("<html"))
    return "html-document";
  if (
    lower.includes("export default") ||
    lower.includes("import react") ||
    /function\s+\w+\s*\(.*\)\s*\{[\s\S]*return\s*\(?\s*</.test(code)
  )
    return "react-jsx";
  if (
    lower.includes("<div") ||
    lower.includes("<nav") ||
    lower.includes("<section") ||
    lower.includes("<button")
  )
    return "html-snippet";
  if (
    lower.includes("{") &&
    (lower.includes("color:") ||
      lower.includes("display:") ||
      lower.includes("margin:"))
  )
    return "css-only";
  if (
    lower.includes("function") ||
    lower.includes("const ") ||
    lower.includes("document.")
  )
    return "js-only";
  return "text";
}

// ── Scoring Functions ────────────────────────────────────────────────

function scoreCodeExtracted(code: string): number {
  // 20 points: did we extract anything?
  if (code.length === 0) return 0;
  if (code.length < 50) return 5;
  if (code.length < 150) return 10;
  return 20;
}

function scoreValidHtml(code: string): number {
  // 10 points: is it valid HTML?
  const type = detectContentType(code);
  if (type === "html-document") return 10;
  if (type === "html-snippet") return 7;
  if (type === "react-jsx") return 5;
  return 0;
}

function scoreRequiredElements(
  code: string,
  required?: string[]
): number {
  // 25 points: proportional
  if (!required || required.length === 0) return 25;
  const lower = code.toLowerCase();
  let found = 0;
  for (const el of required) {
    // Check for <element or element as class/id
    if (
      lower.includes(`<${el.toLowerCase()}`) ||
      lower.includes(el.toLowerCase())
    ) {
      found++;
    }
  }
  return Math.round((found / required.length) * 25);
}

function scoreRequiredKeywords(
  code: string,
  required?: string[]
): number {
  // 20 points: proportional, case-insensitive
  if (!required || required.length === 0) return 20;
  const lower = code.toLowerCase();
  let found = 0;
  for (const kw of required) {
    if (lower.includes(kw.toLowerCase())) found++;
  }
  return Math.round((found / required.length) * 20);
}

function scoreCssPatterns(code: string, patterns?: string[]): number {
  // 10 points
  if (!patterns || patterns.length === 0) return 10;
  const lower = code.toLowerCase();
  let found = 0;
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) found++;
  }
  return Math.round((found / patterns.length) * 10);
}

function scoreJsPatterns(code: string, patterns?: string[]): number {
  // 10 points
  if (!patterns || patterns.length === 0) return 10;
  let found = 0;
  for (const p of patterns) {
    if (code.includes(p)) found++;
  }
  return Math.round((found / patterns.length) * 10);
}

function scoreCodeLength(code: string, minLength?: number): number {
  // 5 points
  const min = minLength ?? 200;
  if (code.length >= min) return 5;
  if (code.length >= min * 0.5) return 3;
  if (code.length > 0) return 1;
  return 0;
}

// ── Main Scoring Entry Point ─────────────────────────────────────────

export function scoreResponse(
  response: string,
  criteria: ValidationCriteria
): { code: string; score: ScoreBreakdown } {
  const code = extractCode(response);

  const codeExtracted = scoreCodeExtracted(code);
  const validHtml = scoreValidHtml(code);
  const requiredElements = scoreRequiredElements(
    code,
    criteria.requiredElements
  );
  const requiredKeywords = scoreRequiredKeywords(
    code,
    criteria.requiredKeywords
  );
  const cssCriteria = scoreCssPatterns(code, criteria.cssPatterns);
  const jsCriteria = scoreJsPatterns(code, criteria.jsPatterns);
  const codeLength = scoreCodeLength(code, criteria.minLength);

  let total =
    codeExtracted +
    validHtml +
    requiredElements +
    requiredKeywords +
    cssCriteria +
    jsCriteria +
    codeLength;

  // Apply custom validator if provided (average with standard score)
  if (criteria.customValidator) {
    const customScore = criteria.customValidator(code);
    total = Math.round((total + customScore) / 2);
  }

  total = Math.min(100, Math.max(0, total));

  return {
    code,
    score: {
      codeExtracted,
      validHtml,
      requiredElements,
      requiredKeywords,
      cssCriteria,
      jsCriteria,
      codeLength,
      total,
      tier: getTier(total),
    },
  };
}
