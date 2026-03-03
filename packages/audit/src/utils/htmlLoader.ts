import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

export interface LoadedHTML {
  raw: string;
  dom: JSDOM;
  document: Document;
}

/**
 * Read index.html from a project directory and return the raw HTML + a JSDOM instance.
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

  const dom = new JSDOM(raw, {
    url: "http://localhost",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });

  return {
    raw,
    dom,
    document: dom.window.document,
  };
}
