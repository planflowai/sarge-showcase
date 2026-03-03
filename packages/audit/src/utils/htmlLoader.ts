import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface LoadedHTML {
  raw: string;
}

/**
 * Read index.html from a project directory and return the raw HTML string.
 * Each runner creates its own JSDOM instance with the settings it needs.
 */
export function loadHTML(projectPath: string): LoadedHTML {
  const indexPath = join(projectPath, "index.html");

  if (!existsSync(indexPath)) {
    throw new Error(
      `index.html not found at ${indexPath}. Ensure the project has an index.html file.`
    );
  }

  const raw = readFileSync(indexPath, "utf-8");

  if (!raw.trim()) {
    throw new Error(`index.html at ${indexPath} is empty.`);
  }

  return { raw };
}
