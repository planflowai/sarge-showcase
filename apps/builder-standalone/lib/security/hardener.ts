import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface SecurityReport {
  cspAdded: boolean;
  noopenerFixed: number;
  honeypotFormsAdded: number;
  sanitizationScriptAdded: boolean;
  nosniffAdded: boolean;
  referrerPolicyAdded: boolean;
  commentsStripped: number;
}

// ─── CSP meta tag ───

const CSP_CONTENT = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'self'",
].join("; ");

const CSP_TAG = `<meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}">`;

// ─── Honeypot field (hidden input that bots fill, humans don't) ───

const HONEYPOT_FIELD = `<div style="position:absolute;left:-9999px;top:-9999px" aria-hidden="true"><input type="text" name="_hp_guard" tabindex="-1" autocomplete="off"></div>`;

// ─── Input sanitization script ───

const SANITIZATION_SCRIPT = `<script data-security="input-sanitizer">
(function(){var e=function(s){var d=document.createElement("div");d.appendChild(document.createTextNode(s));return d.innerHTML};document.addEventListener("submit",function(ev){var f=ev.target;if(!f||!f.elements)return;var hp=f.querySelector('[name="_hp_guard"]');if(hp&&hp.value){ev.preventDefault();return}for(var i=0;i<f.elements.length;i++){var el=f.elements[i];if((el.type==="text"||el.type==="search"||el.type==="url")&&el.value){el.value=e(el.value)}}},true)})();
</script>`;

// ─── Main hardener ───

export function applySecurityHardening(
  html: string
): { html: string; report: SecurityReport } {
  const report: SecurityReport = {
    cspAdded: false,
    noopenerFixed: 0,
    honeypotFormsAdded: 0,
    sanitizationScriptAdded: false,
    nosniffAdded: false,
    referrerPolicyAdded: false,
    commentsStripped: 0,
  };

  // 1. Inject CSP meta tag if not present
  if (!/<meta[^>]*Content-Security-Policy/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n  ${CSP_TAG}`);
      report.cspAdded = true;
    }
  }

  // 2. Add X-Content-Type-Options: nosniff meta tag
  if (!/<meta[^>]*X-Content-Type-Options/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <meta http-equiv="X-Content-Type-Options" content="nosniff">`
      );
      report.nosniffAdded = true;
    }
  }

  // 3. Add Referrer-Policy meta tag
  if (!/<meta[^>]*Referrer-Policy/i.test(html) && !/<meta[^>]*name=["']referrer["']/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <meta name="referrer" content="strict-origin-when-cross-origin">`
      );
      report.referrerPolicyAdded = true;
    }
  }

  // 4. Add rel="noopener noreferrer" to all <a target="_blank"> links
  html = html.replace(/<a\b([^>]*?)target=["']_blank["']([^>]*?)>/gi, (_match, before, after) => {
    const full = before + after;
    if (/rel\s*=\s*["'][^"']*noopener[^"']*["']/i.test(full)) return _match;

    // Has rel but missing noopener
    if (/rel\s*=/i.test(full)) {
      const updated = _match.replace(
        /rel=["']([^"']*)["']/i,
        (_m: string, val: string) => `rel="${val} noopener noreferrer"`
      );
      report.noopenerFixed++;
      return updated;
    }

    // No rel attribute at all
    report.noopenerFixed++;
    return `<a${before}target="_blank" rel="noopener noreferrer"${after}>`;
  });

  // 5. Add honeypot field to all <form> elements
  html = html.replace(/<form\b([^>]*)>/gi, (_match, attrs) => {
    // Skip if honeypot already present
    if (/_hp_guard/.test(html.slice(html.indexOf(_match), html.indexOf(_match) + 500))) {
      return _match;
    }
    report.honeypotFormsAdded++;
    return `<form${attrs}>\n  ${HONEYPOT_FIELD}`;
  });

  // 6. Add input sanitization script before </body>
  if (!/<script[^>]*data-security/i.test(html)) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${SANITIZATION_SCRIPT}\n</body>`);
      report.sanitizationScriptAdded = true;
    }
  }

  // 7. Strip HTML comments (except conditional IE comments and DOCTYPE)
  html = html.replace(/<!--(?!\[if\s)[\s\S]*?-->/g, (_match) => {
    // Preserve IE conditional comments
    if (/^\[if\s/.test(_match)) return _match;
    report.commentsStripped++;
    return "";
  });

  return { html, report };
}

/**
 * Run security hardening on a project's index.html.
 * Reads, hardens, and writes back.
 */
export function hardenProjectHtml(
  projectPath: string
): SecurityReport | null {
  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) return null;

  const html = readFileSync(indexPath, "utf-8");
  const { html: hardened, report } = applySecurityHardening(html);
  writeFileSync(indexPath, hardened, "utf-8");
  return report;
}
