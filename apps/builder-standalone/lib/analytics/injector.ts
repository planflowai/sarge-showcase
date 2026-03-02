import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface AnalyticsReport {
  snippetInjected: boolean;
  dashboardLinkAdded: boolean;
}

// ─── Build the analytics snippet (minified inline JS, <3KB) ───

function buildSnippet(endpoint: string): string {
  // The tracker script — minified, self-contained, consent-aware
  const tracker = `(function(){` +
    `var E="${endpoint}",B="__sa_buf",C="cc_consent";` +
    // Check consent cookie — only run if analytics allowed
    `function ck(){var m=document.cookie.match(new RegExp("(?:^|; )"+C+"=([^;]*)"));if(!m)return false;try{var p=JSON.parse(decodeURIComponent(m[1]));return!!p.analytics}catch(e){return false}}` +
    // If consent cookie exists but analytics not allowed, bail
    `var cc=document.cookie.indexOf(C+"=");if(cc!==-1&&!ck())return;` +
    // If no consent cookie at all, also bail (user hasn't consented yet)
    `if(cc===-1)return;` +
    // Send data via beacon or fetch, buffer to localStorage on failure
    `function send(d){` +
      `d.ts=Date.now();d.url=location.href;d.ref=document.referrer;` +
      `d.sw=screen.width;d.sh=screen.height;d.ua=navigator.userAgent;` +
      `var j=JSON.stringify(d);` +
      `try{if(navigator.sendBeacon){if(navigator.sendBeacon(E,j))return}` +
      `fetch(E,{method:"POST",body:j,keepalive:true}).catch(function(){buf(j)})}` +
      `catch(e){buf(j)}` +
    `}` +
    // localStorage buffer for offline/failed sends
    `function buf(j){try{var a=JSON.parse(localStorage.getItem(B)||"[]");a.push(j);if(a.length>100)a=a.slice(-100);localStorage.setItem(B,JSON.stringify(a))}catch(e){}}` +
    // Flush buffer on load
    `function flush(){try{var a=JSON.parse(localStorage.getItem(B)||"[]");if(!a.length)return;localStorage.removeItem(B);a.forEach(function(j){try{navigator.sendBeacon?navigator.sendBeacon(E,j):fetch(E,{method:"POST",body:j,keepalive:true})}catch(e){}})}catch(e){}}` +
    // Page view
    `send({t:"pv"});flush();` +
    // Time on page — send on unload
    `var t0=Date.now();` +
    `function onLeave(){send({t:"tp",d:Math.round((Date.now()-t0)/1000)})}` +
    `document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")onLeave()});` +
    `window.addEventListener("pagehide",onLeave);` +
    // Click tracking — links and buttons
    `document.addEventListener("click",function(e){` +
      `var el=e.target.closest("a,button");if(!el)return;` +
      `send({t:"ck",tag:el.tagName,txt:(el.textContent||"").slice(0,50).trim(),hr:el.href||""})` +
    `},true);` +
    // Scroll depth tracking — 25/50/75/100%
    `var sd={},st;` +
    `function checkScroll(){` +
      `var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight;` +
      `if(h<=0)return;` +
      `var p=Math.round(window.scrollY/h*100);` +
      `[25,50,75,100].forEach(function(m){if(p>=m&&!sd[m]){sd[m]=1;send({t:"sd",d:m})}})` +
    `}` +
    `window.addEventListener("scroll",function(){clearTimeout(st);st=setTimeout(checkScroll,200)},{ passive:true })` +
  `})()`;

  return tracker;
}

// ─── Dashboard footer link ───

const DASHBOARD_LINK = `<a href="/analytics" style="color:#9ca3af;text-decoration:underline;font-size:13px;margin-left:12px">Analytics</a>`;

// ─── Main injector ───

export function injectAnalytics(
  html: string,
  endpoint = "/api/analytics/collect"
): { html: string; report: AnalyticsReport } {
  const report: AnalyticsReport = {
    snippetInjected: false,
    dashboardLinkAdded: false,
  };

  // Skip if already injected
  if (/data-analytics="tracker"/i.test(html)) {
    return { html, report };
  }

  // 1. Inject analytics snippet before </body>
  //    Tagged as data-cookie-category="analytics" so the Privacy toggle can block it
  if (/<\/body>/i.test(html)) {
    const snippet = buildSnippet(endpoint);
    const tag = `<!-- Client Analytics -->\n<script type="text/plain" data-cookie-category="analytics" data-analytics="tracker">${snippet}</script>`;
    html = html.replace(/<\/body>/i, `${tag}\n</body>`);
    report.snippetInjected = true;
  }

  // 2. Add dashboard link in footer if <footer> exists
  if (/<footer\b/i.test(html) && !/href="\/analytics"/i.test(html)) {
    html = html.replace(/<\/footer>/i, `  ${DASHBOARD_LINK}\n</footer>`);
    report.dashboardLinkAdded = true;
  }

  return { html, report };
}

/**
 * Run analytics injection on a project's index.html.
 */
export function injectProjectAnalytics(
  projectPath: string,
  endpoint?: string
): AnalyticsReport | null {
  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) return null;

  const raw = readFileSync(indexPath, "utf-8");
  const { html: enhanced, report } = injectAnalytics(raw, endpoint);
  writeFileSync(indexPath, enhanced, "utf-8");
  return report;
}
