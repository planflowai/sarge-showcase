import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface PrivacyReport {
  consentBannerAdded: boolean;
  privacyPolicyAdded: boolean;
  formDisclosuresAdded: number;
  scriptsTagged: number;
  manageCookiesLinkAdded: boolean;
}

// ─── Cookie Consent Banner (inline CSS + inline JS, no external deps) ───

const CONSENT_BANNER = `<!-- GDPR/CCPA Cookie Consent Banner -->
<div id="cc-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:999999;background:rgba(17,17,17,.97);color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;padding:18px 24px;box-shadow:0 -2px 12px rgba(0,0,0,.35);backdrop-filter:blur(8px)">
<div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;flex-wrap:wrap;gap:14px">
<div style="flex:1;min-width:280px;line-height:1.5">
We use cookies to enhance your experience. Essential cookies are required for site functionality. Non-essential cookies help us improve our services.
<a href="#privacy-policy-section" style="color:#60a5fa;text-decoration:underline;margin-left:4px">Privacy Policy</a>
</div>
<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
<button onclick="ccAcceptAll()" style="background:#16a34a;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap">Accept All</button>
<button onclick="ccRejectNonEssential()" style="background:#374151;color:#e5e5e5;border:1px solid #4b5563;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap">Reject Non-Essential</button>
<button onclick="ccShowCustomize()" style="background:transparent;color:#9ca3af;border:1px solid #4b5563;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap">Customize</button>
</div>
</div>
<div id="cc-customize" style="display:none;max-width:1200px;margin:12px auto 0;padding-top:12px;border-top:1px solid #374151">
<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
<label style="display:flex;align-items:center;gap:6px;cursor:default"><input type="checkbox" checked disabled style="accent-color:#16a34a"> <span>Essential <small style="color:#6b7280">(required)</small></span></label>
<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cc-analytics" style="accent-color:#16a34a"> Analytics</label>
<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cc-marketing" style="accent-color:#16a34a"> Marketing</label>
<button onclick="ccSavePrefs()" style="background:#16a34a;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;margin-left:auto">Save Preferences</button>
</div>
</div>
</div>
<script data-cookie-consent="manager">
(function(){
  var COOKIE_NAME="cc_consent",COOKIE_DAYS=365;
  function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
  function setCookie(n,v,d){var e=new Date();e.setDate(e.getDate()+d);document.cookie=n+"="+encodeURIComponent(v)+";expires="+e.toUTCString()+";path=/;SameSite=Lax"}
  function applyConsent(prefs){
    document.querySelectorAll("script[data-cookie-category]").forEach(function(s){
      var cat=s.getAttribute("data-cookie-category");
      if(prefs[cat]){
        if(s.getAttribute("type")==="text/plain"&&s.getAttribute("data-src")){
          var ns=document.createElement("script");ns.src=s.getAttribute("data-src");
          if(s.getAttribute("data-attrs")){try{var a=JSON.parse(s.getAttribute("data-attrs"));for(var k in a)ns.setAttribute(k,a[k])}catch(e){}}
          s.parentNode.replaceChild(ns,s);
        } else if(s.getAttribute("type")==="text/plain"){
          var ns2=document.createElement("script");ns2.textContent=s.textContent;s.parentNode.replaceChild(ns2,s);
        }
      }
    });
  }
  function hideB(){var b=document.getElementById("cc-banner");if(b)b.style.display="none"}
  function saveAndApply(prefs){setCookie(COOKIE_NAME,JSON.stringify(prefs),COOKIE_DAYS);applyConsent(prefs);hideB()}
  window.ccAcceptAll=function(){saveAndApply({essential:true,analytics:true,marketing:true})};
  window.ccRejectNonEssential=function(){saveAndApply({essential:true,analytics:false,marketing:false})};
  window.ccShowCustomize=function(){var c=document.getElementById("cc-customize");if(c)c.style.display=c.style.display==="none"?"block":"none"};
  window.ccSavePrefs=function(){var a=document.getElementById("cc-analytics"),m=document.getElementById("cc-marketing");saveAndApply({essential:true,analytics:a?a.checked:false,marketing:m?m.checked:false})};
  window.ccReopenBanner=function(){var b=document.getElementById("cc-banner");if(b){b.style.display="block";var c=document.getElementById("cc-customize");if(c)c.style.display="none"}};
  var existing=getCookie(COOKIE_NAME);
  if(existing){try{applyConsent(JSON.parse(existing))}catch(e){}}
  else{var b=document.getElementById("cc-banner");if(b)b.style.display="block"}
})();
</script>`;

// ─── Privacy Policy Section ───

const PRIVACY_POLICY = `<!-- Privacy Policy Section (auto-generated) -->
<section id="privacy-policy-section" style="background:#f9fafb;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:48px 24px;line-height:1.7;font-size:15px">
<div style="max-width:800px;margin:0 auto">
<h2 style="font-size:28px;font-weight:700;margin-bottom:24px;color:#111827">Privacy Policy</h2>
<p style="color:#6b7280;margin-bottom:24px"><em>Last updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</em></p>

<h3 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#111827">1. Data We Collect</h3>
<p>We may collect the following types of information:</p>
<ul style="margin:8px 0 16px 24px">
<li><strong>Information you provide</strong> — such as name, email, and any data submitted through forms on this site.</li>
<li><strong>Automatically collected data</strong> — including IP address, browser type, device information, pages visited, and referring URLs.</li>
<li><strong>Cookies and similar technologies</strong> — see the Cookies section below.</li>
</ul>

<h3 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#111827">2. Cookies Used</h3>
<p>This site uses the following categories of cookies:</p>
<ul style="margin:8px 0 16px 24px">
<li><strong>Essential cookies</strong> — required for basic site functionality (always active).</li>
<li><strong>Analytics cookies</strong> — help us understand how visitors interact with the site.</li>
<li><strong>Marketing cookies</strong> — used to deliver relevant advertisements and track campaign performance.</li>
</ul>
<p>You can manage your cookie preferences at any time using the cookie consent banner or the "Manage Cookies" link.</p>

<h3 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#111827">3. Third-Party Services</h3>
<p>We may use third-party services for analytics, advertising, or functionality. These services may collect data according to their own privacy policies. Common examples include Google Analytics, social media widgets, and embedded content providers.</p>

<h3 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#111827">4. Your Rights</h3>
<p><strong>Under GDPR (EU/EEA residents):</strong></p>
<ul style="margin:8px 0 16px 24px">
<li>Right to access your personal data</li>
<li>Right to rectification of inaccurate data</li>
<li>Right to erasure ("right to be forgotten")</li>
<li>Right to restrict processing</li>
<li>Right to data portability</li>
<li>Right to object to processing</li>
</ul>
<p><strong>Under CCPA (California residents):</strong></p>
<ul style="margin:8px 0 16px 24px">
<li>Right to know what personal information is collected</li>
<li>Right to delete personal information</li>
<li>Right to opt-out of the sale of personal information</li>
<li>Right to non-discrimination for exercising your rights</li>
</ul>

<h3 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#111827">5. Contact</h3>
<p>For privacy-related inquiries, data access requests, or to exercise your rights, please contact:</p>
<p style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0;color:#6b7280">
<strong>[Your Company Name]</strong><br>
Email: <strong>[privacy@yourdomain.com]</strong><br>
Address: <strong>[Your Business Address]</strong><br>
<em>Replace the bracketed placeholders with your actual contact information.</em>
</p>
</div>
</section>`;

// ─── Form Disclosure ───

const FORM_DISCLOSURE = `<p style="font-size:12px;color:#6b7280;margin-top:8px">By submitting this form, you agree to our <a href="#privacy-policy-section" style="color:#60a5fa;text-decoration:underline">Privacy Policy</a>.</p>`;

// ─── Manage Cookies Footer Link ───

const MANAGE_COOKIES_LINK = `<a href="javascript:void(0)" onclick="ccReopenBanner()" style="color:#9ca3af;text-decoration:underline;font-size:13px;margin-left:12px">Manage Cookies</a>`;

// ─── Analytics/Marketing script patterns ───

const ANALYTICS_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /gtag\s*\(/i,
  /ga\s*\(\s*['"]create['"]/i,
  /fbevents\.js/i,
  /facebook\.net/i,
  /connect\.facebook/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /segment\.com/i,
  /mixpanel\.com/i,
  /amplitude\.com/i,
  /plausible\.io/i,
  /matomo/i,
  /piwik/i,
];

const MARKETING_PATTERNS = [
  /doubleclick\.net/i,
  /googlesyndication/i,
  /googleadservices/i,
  /adsbygoogle/i,
  /amazon-adsystem/i,
  /adsense/i,
  /taboola/i,
  /outbrain/i,
];

function classifyScript(content: string, src: string): "analytics" | "marketing" | null {
  const combined = content + " " + src;
  for (const pat of MARKETING_PATTERNS) {
    if (pat.test(combined)) return "marketing";
  }
  for (const pat of ANALYTICS_PATTERNS) {
    if (pat.test(combined)) return "analytics";
  }
  return null;
}

// ─── Main compliance processor ───

export function applyPrivacyCompliance(
  html: string
): { html: string; report: PrivacyReport } {
  const report: PrivacyReport = {
    consentBannerAdded: false,
    privacyPolicyAdded: false,
    formDisclosuresAdded: 0,
    scriptsTagged: 0,
    manageCookiesLinkAdded: false,
  };

  // 1. Tag analytics/marketing scripts so they are blocked until consent
  html = html.replace(
    /<script\b([^>]*?)>([\s\S]*?)<\/script>/gi,
    (match, attrs: string, content: string) => {
      // Skip the consent manager itself
      if (/data-cookie-consent/i.test(attrs)) return match;
      // Skip already-tagged scripts
      if (/data-cookie-category/i.test(attrs)) return match;

      // Extract src if present
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : "";

      const category = classifyScript(content, src);
      if (!category) return match;

      report.scriptsTagged++;

      // Convert to blocked script: type=text/plain, move src to data-src
      if (src) {
        const newAttrs = attrs
          .replace(/src=["'][^"']+["']/i, `data-src="${src}"`)
          .replace(/type=["'][^"']+["']/i, "");
        return `<!-- cookie-category: ${category} -->\n<script${newAttrs} type="text/plain" data-cookie-category="${category}">${content}</script>`;
      } else {
        const newAttrs = attrs.replace(/type=["'][^"']+["']/i, "");
        return `<!-- cookie-category: ${category} -->\n<script${newAttrs} type="text/plain" data-cookie-category="${category}">${content}</script>`;
      }
    }
  );

  // 2. Add form disclosure text (skip if already present before this </form>)
  html = html.replace(/<\/form>/gi, (match, offset) => {
    // Check the 200 chars before </form> for existing disclosure
    const preceding = html.slice(Math.max(0, offset - 200), offset);
    if (/By submitting this form/i.test(preceding)) return match;
    report.formDisclosuresAdded++;
    return `${FORM_DISCLOSURE}\n${match}`;
  });

  // 3. Add 'Manage Cookies' link in footer if <footer> exists
  if (/<footer\b/i.test(html) && !/Manage Cookies/i.test(html)) {
    html = html.replace(/<\/footer>/i, `  ${MANAGE_COOKIES_LINK}\n</footer>`);
    report.manageCookiesLinkAdded = true;
  }

  // 4. Inject privacy policy before </body>
  if (!/<section[^>]*id=["']privacy-policy-section["']/i.test(html)) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${PRIVACY_POLICY}\n</body>`);
      report.privacyPolicyAdded = true;
    }
  }

  // 5. Inject cookie consent banner before </body> (after privacy policy)
  if (!/<div[^>]*id=["']cc-banner["']/i.test(html)) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${CONSENT_BANNER}\n</body>`);
      report.consentBannerAdded = true;
    }
  }

  return { html, report };
}

/**
 * Run privacy compliance on a project's index.html.
 * Reads, processes, and writes back.
 */
export function applyProjectPrivacy(
  projectPath: string
): PrivacyReport | null {
  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) return null;

  const raw = readFileSync(indexPath, "utf-8");
  const { html: compliant, report } = applyPrivacyCompliance(raw);
  writeFileSync(indexPath, compliant, "utf-8");
  return report;
}
