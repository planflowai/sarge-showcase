import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface PunchListReport {
  floatingButtonAdded: boolean;
  formInjected: boolean;
  navPagesDetected: number;
  submitEndpointConfigured: string;
  mailtoFallbackEmail: string;
}

// ─── Build the floating punch-list widget (inline CSS + inline JS) ───

function buildWidget(
  pages: string[],
  submitEndpoint: string,
  fallbackEmail: string
): string {
  const pageOptions = pages
    .map((p) => `<option value="${p}">${p}</option>`)
    .join("");

  return `<!-- Punch List — Client Revision Form -->
<div id="pl-widget">
<button id="pl-toggle" onclick="plToggle()" style="position:fixed;bottom:24px;right:24px;z-index:999998;background:#0ea5e9;color:#fff;border:none;padding:10px 20px;border-radius:28px;cursor:pointer;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 16px rgba(14,165,233,.4);transition:transform .2s,box-shadow .2s" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">&#9998; Request Changes</button>
<div id="pl-panel" style="display:none;position:fixed;bottom:80px;right:24px;z-index:999999;width:380px;max-height:calc(100vh - 120px);overflow-y:auto;background:#1e1e2e;color:#e5e5e5;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,.45);border:1px solid #2d2d3d">
<div style="padding:20px 20px 0">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
<h3 style="margin:0;font-size:17px;font-weight:700;color:#fff">Request a Revision</h3>
<button onclick="plToggle()" style="background:none;border:none;color:#6b7280;font-size:20px;cursor:pointer;padding:0;line-height:1">&times;</button>
</div>
<div id="pl-form-wrap">
<label style="display:block;margin-bottom:12px">
<span style="display:block;font-size:12px;font-weight:600;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Page</span>
<select id="pl-page" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #374151;background:#111827;color:#e5e5e5;font-size:14px">
<option value="General / Sitewide">General / Sitewide</option>
${pageOptions}
</select>
</label>
<label style="display:block;margin-bottom:12px">
<span style="display:block;font-size:12px;font-weight:600;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">What should change?</span>
<textarea id="pl-desc" rows="4" placeholder="Describe the change you'd like..." style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #374151;background:#111827;color:#e5e5e5;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>
</label>
<fieldset style="border:none;padding:0;margin:0 0 12px">
<legend style="font-size:12px;font-weight:600;color:#9ca3af;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Priority</legend>
<div style="display:flex;gap:12px">
<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="pl-pri" value="low" style="accent-color:#22c55e"> <span style="color:#22c55e">Low</span></label>
<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="pl-pri" value="medium" checked style="accent-color:#eab308"> <span style="color:#eab308">Medium</span></label>
<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="pl-pri" value="high" style="accent-color:#ef4444"> <span style="color:#ef4444">High</span></label>
</div>
</fieldset>
<label style="display:block;margin-bottom:16px">
<span style="display:block;font-size:12px;font-weight:600;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Screenshot <span style="font-weight:400;text-transform:none">(optional)</span></span>
<input type="file" id="pl-screenshot" accept="image/*" style="width:100%;padding:6px;border-radius:8px;border:1px solid #374151;background:#111827;color:#9ca3af;font-size:13px;box-sizing:border-box">
</label>
<button onclick="plSubmit()" id="pl-submit-btn" style="width:100%;padding:10px;border-radius:8px;border:none;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px;transition:background .2s" onmouseenter="this.style.background='#0284c7'" onmouseleave="this.style.background='#0ea5e9'">Submit Revision</button>
<p style="font-size:11px;color:#6b7280;text-align:center;margin:0 0 16px">Round <span id="pl-round">1</span></p>
</div>
<div id="pl-confirm" style="display:none;text-align:center;padding:24px 0">
<div style="font-size:36px;margin-bottom:8px">&#10003;</div>
<p style="font-size:16px;font-weight:600;color:#22c55e;margin:0 0 4px" id="pl-confirm-msg">Revision #1 submitted.</p>
<p style="font-size:13px;color:#9ca3af;margin:0 0 16px">We'll review it shortly.</p>
<button onclick="plReset()" style="padding:8px 20px;border-radius:8px;border:1px solid #374151;background:transparent;color:#9ca3af;font-size:13px;cursor:pointer">Submit Another</button>
</div>
</div>
</div>
</div>
<script data-punchlist="widget">
(function(){
  var ENDPOINT="${submitEndpoint}";
  var FALLBACK_EMAIL="${fallbackEmail}";
  var COOKIE="pl_round";
  function getCk(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
  function setCk(n,v){document.cookie=n+"="+encodeURIComponent(v)+";path=/;max-age=31536000;SameSite=Lax"}
  var round=parseInt(getCk(COOKIE))||1;
  var revCount=parseInt(getCk("pl_count"))||0;
  var rdEl=document.getElementById("pl-round");
  if(rdEl)rdEl.textContent=round;

  window.plToggle=function(){
    var p=document.getElementById("pl-panel");
    if(p)p.style.display=p.style.display==="none"?"block":"none";
  };

  window.plReset=function(){
    var fw=document.getElementById("pl-form-wrap");
    var cf=document.getElementById("pl-confirm");
    if(fw)fw.style.display="block";
    if(cf)cf.style.display="none";
    var d=document.getElementById("pl-desc");if(d)d.value="";
    var s=document.getElementById("pl-screenshot");if(s)s.value="";
  };

  window.plSubmit=function(){
    var page=document.getElementById("pl-page");
    var desc=document.getElementById("pl-desc");
    var priEls=document.querySelectorAll('input[name="pl-pri"]');
    var scr=document.getElementById("pl-screenshot");
    var pri="medium";
    priEls.forEach(function(r){if(r.checked)pri=r.value});
    if(!desc||!desc.value.trim()){desc.focus();return}

    var btn=document.getElementById("pl-submit-btn");
    if(btn){btn.textContent="Submitting...";btn.disabled=true}

    function finalize(file64){
      revCount++;
      var payload={
        page:page?page.value:"General",
        description:desc.value.trim(),
        priority:pri,
        screenshot:file64||null,
        round:round,
        timestamp:new Date().toISOString()
      };
      fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(function(r){return r.json()})
      .then(function(d){
        setCk("pl_count",revCount);
        showConfirm(d.itemNumber||revCount);
      })
      .catch(function(){
        // Fallback: mailto link
        if(FALLBACK_EMAIL){
          var subj=encodeURIComponent("Revision Request — "+payload.page);
          var body=encodeURIComponent("Page: "+payload.page+"\\nPriority: "+pri+"\\nRound: "+round+"\\n\\n"+payload.description);
          window.location.href="mailto:"+FALLBACK_EMAIL+"?subject="+subj+"&body="+body;
        }
        setCk("pl_count",revCount);
        showConfirm(revCount);
      });
    }

    // Read screenshot as base64 if provided
    if(scr&&scr.files&&scr.files[0]){
      var reader=new FileReader();
      reader.onload=function(e){finalize(e.target.result)};
      reader.readAsDataURL(scr.files[0]);
    } else { finalize(null); }
  };

  function showConfirm(num){
    var fw=document.getElementById("pl-form-wrap");
    var cf=document.getElementById("pl-confirm");
    var msg=document.getElementById("pl-confirm-msg");
    var btn=document.getElementById("pl-submit-btn");
    if(fw)fw.style.display="none";
    if(cf)cf.style.display="block";
    if(msg)msg.textContent="Revision #"+num+" submitted.";
    if(btn){btn.textContent="Submit Revision";btn.disabled=false}
  }
})();
</script>`;
}

// ─── Detect navigation pages from the HTML ───

function extractNavPages(html: string): string[] {
  const pages: string[] = [];
  const seen = new Set<string>();

  // Find links inside <nav>, <header>, or elements with nav-like classes
  const navRegions = html.match(
    /<(?:nav|header)\b[^>]*>[\s\S]*?<\/(?:nav|header)>/gi
  ) || [];

  for (const region of navRegions) {
    const linkMatches = region.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of linkMatches) {
      const href = m[1].trim();
      const text = m[2].replace(/<[^>]*>/g, "").trim();
      const label = text || href;
      if (!seen.has(label) && label.length < 80) {
        seen.add(label);
        pages.push(label);
      }
    }
  }

  // Also scan for common anchor-link sections
  const sectionIds = html.matchAll(/<(?:section|div)\b[^>]*id=["']([^"']+)["']/gi);
  for (const m of sectionIds) {
    const id = m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (!seen.has(id) && id.length < 60) {
      seen.add(id);
      pages.push(id);
    }
  }

  return pages;
}

// ─── Main injector ───

export function injectPunchList(
  html: string,
  options: {
    submitEndpoint?: string;
    developerEmail?: string;
  } = {}
): { html: string; report: PunchListReport } {
  const endpoint = options.submitEndpoint || "/api/punchlist/submit";
  const email = options.developerEmail || "";
  const pages = extractNavPages(html);

  const report: PunchListReport = {
    floatingButtonAdded: false,
    formInjected: false,
    navPagesDetected: pages.length,
    submitEndpointConfigured: endpoint,
    mailtoFallbackEmail: email,
  };

  // Skip if already injected
  if (/id=["']pl-widget["']/i.test(html)) {
    return { html, report };
  }

  const widget = buildWidget(pages, endpoint, email);

  // Inject before </body>
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${widget}\n</body>`);
    report.floatingButtonAdded = true;
    report.formInjected = true;
  }

  return { html, report };
}

/**
 * Inject punch-list widget into a project's index.html.
 */
export function injectProjectPunchList(
  projectPath: string,
  options: {
    submitEndpoint?: string;
    developerEmail?: string;
  } = {}
): PunchListReport | null {
  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) return null;

  const raw = readFileSync(indexPath, "utf-8");
  const { html: enhanced, report } = injectPunchList(raw, options);
  writeFileSync(indexPath, enhanced, "utf-8");
  return report;
}
