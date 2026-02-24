/**
 * Codebase Scanner
 *
 * Scans the project directory for source files and detects issues.
 */

import * as fs from "fs";
import * as path from "path";
import type { Finding, ScanDepth } from "@/lib/stores/diagnosticsStore";

// File extensions to scan by depth
const FILE_EXTENSIONS: Record<ScanDepth, string[]> = {
  quick: [".ts", ".tsx"],
  standard: [".ts", ".tsx", ".js", ".jsx", ".css"],
  deep: [".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md"],
};

// Directories to skip
const SKIP_DIRS = [
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "vendor",
  ".sarge-snapshots",
];

// Files to skip (patterns)
const SKIP_FILE_PATTERNS = [
  /\.min\.js$/,
  /\.min\.css$/,
  /\.bundle\.js$/,
  /\.production\./,
];

// Patterns that indicate issues
const ISSUE_PATTERNS = [
  // TypeScript/JavaScript errors
  {
    pattern: /console\.error\s*\(/g,
    type: "warning" as const,
    severity: "low" as const,
    message: "Console error statement found",
  },
  {
    pattern: /\/\/\s*TODO:/gi,
    type: "enhancement" as const,
    severity: "low" as const,
    message: "TODO comment found",
  },
  {
    pattern: /\/\/\s*FIXME:/gi,
    type: "warning" as const,
    severity: "medium" as const,
    message: "FIXME comment found",
  },
  {
    pattern: /\/\/\s*HACK:/gi,
    type: "warning" as const,
    severity: "medium" as const,
    message: "HACK comment found",
  },
  {
    pattern: /any(?:\s|;|,|\))/g,
    type: "warning" as const,
    severity: "low" as const,
    message: "TypeScript 'any' type used",
  },
  {
    pattern: /eslint-disable/g,
    type: "warning" as const,
    severity: "low" as const,
    message: "ESLint rule disabled",
  },
  {
    pattern: /@ts-ignore/g,
    type: "warning" as const,
    severity: "medium" as const,
    message: "TypeScript error ignored with @ts-ignore",
  },
  {
    pattern: /@ts-expect-error/g,
    type: "warning" as const,
    severity: "low" as const,
    message: "TypeScript error suppressed with @ts-expect-error",
  },
  // Security issues
  {
    pattern: /dangerouslySetInnerHTML/g,
    type: "security" as const,
    severity: "high" as const,
    message: "dangerouslySetInnerHTML used - potential XSS vulnerability",
  },
  {
    pattern: /eval\s*\(/g,
    type: "security" as const,
    severity: "critical" as const,
    message: "eval() used - security risk",
  },
  {
    pattern: /innerHTML\s*=/g,
    type: "security" as const,
    severity: "high" as const,
    message: "innerHTML assignment - potential XSS vulnerability",
  },
  {
    pattern: /document\.write/g,
    type: "security" as const,
    severity: "high" as const,
    message: "document.write used - security and performance issue",
  },
  // Error handling
  {
    pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    type: "error" as const,
    severity: "medium" as const,
    message: "Empty catch block - errors silently swallowed",
  },
  {
    pattern: /catch\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/gi,
    type: "warning" as const,
    severity: "low" as const,
    message: "Intentionally ignored error - consider logging",
  },
  // React issues
  {
    pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*\)/g,
    type: "warning" as const,
    severity: "low" as const,
    message: "useEffect without dependency array",
  },
  // Performance
  {
    pattern: /JSON\.parse\(JSON\.stringify/g,
    type: "enhancement" as const,
    severity: "low" as const,
    message: "Deep clone via JSON - consider structuredClone or lodash",
  },
];

export interface ScanResult {
  files: string[];
  findings: Finding[];
  totalFiles: number;
  scannedFiles: number;
}

export interface ScanProgress {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  findings: Finding[];
}

/**
 * Get all files to scan in the project
 */
export function collectFiles(rootDir: string, depth: ScanDepth): string[] {
  const extensions = FILE_EXTENSIONS[depth];
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          // Skip minified/production files
          const shouldSkip = SKIP_FILE_PATTERNS.some((pattern) =>
            pattern.test(entry.name)
          );
          if (extensions.includes(ext) && !shouldSkip) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`[scanner] Error reading directory ${dir}:`, error);
    }
  }

  walk(rootDir);
  return files;
}

/**
 * Scan a single file for issues
 */
export function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const { pattern, type, severity, message } of ISSUE_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split("\n").length;
        const column = match.index - beforeMatch.lastIndexOf("\n");

        // Get code snippet (the line containing the match)
        const codeLine = lines[lineNumber - 1] || "";

        findings.push({
          id: crypto.randomUUID(),
          type,
          severity,
          file: filePath,
          line: lineNumber,
          column,
          message,
          code: codeLine.trim(),
        });
      }
    }
  } catch (error) {
    console.error(`[scanner] Error scanning file ${filePath}:`, error);
  }

  return findings;
}

/**
 * Full codebase scan
 */
export function scanCodebase(
  rootDir: string,
  depth: ScanDepth,
  onProgress?: (progress: ScanProgress) => void
): ScanResult {
  console.log(`[scanner] Starting ${depth} scan of ${rootDir}`);

  const files = collectFiles(rootDir, depth);
  const allFindings: Finding[] = [];

  console.log(`[scanner] Found ${files.length} files to scan`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const findings = scanFile(file);
    allFindings.push(...findings);

    if (onProgress) {
      onProgress({
        currentFile: file,
        currentIndex: i + 1,
        totalFiles: files.length,
        findings: allFindings,
      });
    }
  }

  console.log(`[scanner] Scan complete. Found ${allFindings.length} issues.`);

  return {
    files,
    findings: allFindings,
    totalFiles: files.length,
    scannedFiles: files.length,
  };
}

/**
 * Read file content for analysis
 */
export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write file content (for applying fixes)
 */
export function writeFileContent(filePath: string, content: string): boolean {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch (error) {
    console.error(`[scanner] Error writing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create a backup of files before modification
 */
export function backupFiles(files: string[]): Map<string, string> {
  const backups = new Map<string, string>();

  for (const file of files) {
    const content = readFileContent(file);
    if (content !== null) {
      backups.set(file, content);
    }
  }

  return backups;
}
