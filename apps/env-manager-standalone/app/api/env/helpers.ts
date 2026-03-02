import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";

// Master .env.local is at the monorepo root
const ROOT = process.env.MONOREPO_ROOT || join(process.cwd(), "..", "..");
export const MASTER_ENV_PATH = join(ROOT, ".env.local");
export const ROTATION_LOG_PATH = join(ROOT, ".env-rotation-log.json");

/* ── Parse .env.local ── */

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

export function parseEnvFile(filePath: string): EnvEntry[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  const entries: EnvEntry[] = [];
  let pendingComment = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingComment = "";
      continue;
    }
    if (trimmed.startsWith("#")) {
      pendingComment = trimmed;
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    entries.push({ key, value, comment: pendingComment || undefined });
    pendingComment = "";
  }
  return entries;
}

/* ── Write .env.local ── */

export function writeEnvFile(filePath: string, entries: EnvEntry[]) {
  const lines: string[] = [];
  const grouped = groupByCategory(entries);
  const categoryHeaders: Record<string, string> = {
    "AI Providers": "# ─── Cloud AI Providers ────────────────────────────────────",
    "Local Models": "# ─── Local AI Endpoints ────────────────────────────────────",
    "Search APIs": "# ─── Search APIs ───────────────────────────────────────────",
    Deployment: "# ─── Deployment ────────────────────────────────────────────",
    Trading: "# ─── Trading APIs ──────────────────────────────────────────",
    Infrastructure: "# ─── Infrastructure ────────────────────────────────────────",
    "Other / Custom": "# ─── Other ─────────────────────────────────────────────────",
  };

  lines.push(
    "# ═══════════════════════════════════════════════════════════════",
    "# SARGE AI Builder v2 — Centralized Environment Variables",
    "# This file is the SINGLE SOURCE OF TRUTH for all API keys.",
    "# Standalone apps (chat, builder, etc.) load from here via dotenv.",
    "# ═══════════════════════════════════════════════════════════════",
    ""
  );

  for (const [category, catEntries] of Object.entries(grouped)) {
    if (categoryHeaders[category]) {
      lines.push(categoryHeaders[category]);
    } else {
      lines.push(`# ─── ${category} ────────────────────────────────────────`);
    }
    for (const entry of catEntries) {
      lines.push(`${entry.key}=${entry.value}`);
    }
    lines.push("");
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

/* ── Update single key in .env file ── */

export function updateEnvKey(
  filePath: string,
  key: string,
  value: string
): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return line;
    const lineKey = trimmed.slice(0, eqIdx).trim();
    if (lineKey === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (found) {
    writeFileSync(filePath, updated.join("\n"), "utf-8");
  }
  return found;
}

/* ── Append key to .env file ── */

export function appendEnvKey(filePath: string, key: string, value: string) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${key}=${value}\n`, "utf-8");
    return;
  }
  const content = readFileSync(filePath, "utf-8");
  const newContent = content.endsWith("\n")
    ? `${content}${key}=${value}\n`
    : `${content}\n${key}=${value}\n`;
  writeFileSync(filePath, newContent, "utf-8");
}

/* ── Delete key from .env file ── */

export function deleteEnvKey(filePath: string, key: string): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) return true;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return true;
    const lineKey = trimmed.slice(0, eqIdx).trim();
    if (lineKey === key) {
      found = true;
      return false;
    }
    return true;
  });

  if (found) {
    writeFileSync(filePath, filtered.join("\n"), "utf-8");
  }
  return found;
}

/* ── Masking ── */

export function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••" + value.slice(-4);
}

/* ── Category detection ── */

const AI_PROVIDER_KEYS = [
  "ANTHROPIC",
  "OPENAI",
  "GOOGLE_API_KEY",
  "XAI",
  "DEEPSEEK",
  "GROQ",
  "COHERE",
  "MISTRAL",
];

const LOCAL_KEYS = [
  "OLLAMA",
  "LM_STUDIO",
  "LMSTUDIO",
  "LOCAL_AI",
  "XTTS",
];

const DEPLOYMENT_KEYS = [
  "GITHUB",
  "VERCEL",
  "NETLIFY",
  "CLOUDFLARE",
  "SUPABASE",
];

const SEARCH_KEYS = ["TAVILY", "BRAVE_SEARCH", "GOOGLE_SEARCH", "SEARXNG"];

const TRADING_KEYS = ["ALPACA", "FINNHUB", "POLYGON"];

export function categorizeKey(key: string): string {
  const upper = key.toUpperCase();
  if (AI_PROVIDER_KEYS.some((p) => upper.includes(p))) return "AI Providers";
  if (LOCAL_KEYS.some((p) => upper.includes(p))) return "Local Models";
  if (SEARCH_KEYS.some((p) => upper.includes(p))) return "Search APIs";
  if (DEPLOYMENT_KEYS.some((p) => upper.includes(p))) return "Deployment";
  if (TRADING_KEYS.some((p) => upper.includes(p))) return "Trading";
  if (upper.includes("BUILDER") || upper.includes("AIR_GAP") || upper.includes("PORT"))
    return "Infrastructure";
  return "Other / Custom";
}

/* ── Group entries by category ── */

export function groupByCategory(
  entries: EnvEntry[]
): Record<string, EnvEntry[]> {
  const groups: Record<string, EnvEntry[]> = {};
  for (const entry of entries) {
    const cat = categorizeKey(entry.key);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(entry);
  }
  return groups;
}

/* ── Rotation log ── */

export interface RotationEntry {
  lastRotated: string; // ISO date
  note?: string;
}

export function readRotationLog(): Record<string, RotationEntry> {
  if (!existsSync(ROTATION_LOG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(ROTATION_LOG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export function updateRotationLog(key: string) {
  const log = readRotationLog();
  log[key] = { lastRotated: new Date().toISOString() };
  writeFileSync(ROTATION_LOG_PATH, JSON.stringify(log, null, 2), "utf-8");
}

/* ── File info ── */

export function getFileInfo(filePath: string) {
  if (!existsSync(filePath)) return null;
  const stat = statSync(filePath);
  return {
    path: filePath,
    lastModified: stat.mtime.toISOString(),
    size: stat.size,
  };
}

/* ── Find all app .env.local paths ── */

export function findAppEnvPaths(): string[] {
  const appsDir = join(ROOT, "apps");
  const paths: string[] = [];
  try {
    const { readdirSync } = require("fs");
    const dirs = readdirSync(appsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      if (d.name.includes("backup")) continue;
      const envPath = join(appsDir, d.name, ".env.local");
      paths.push(envPath);
    }
  } catch {}
  return paths;
}
