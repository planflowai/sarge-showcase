/**
 * Calendly Booking Widget Injector
 *
 * Injects a floating "Book a Call" button + Calendly popup widget script.
 * Uses Calendly's public embed — no API key or OAuth required.
 */

export interface CalendlyReport {
  buttonInjected: boolean;
  widgetScriptInjected: boolean;
}

const CALENDLY_MARKER = "calendly-foundry-widget";

/**
 * Inject Calendly booking widget into HTML.
 * Adds a floating "Book a Call" button + Calendly popup script before </body>.
 */
export function injectCalendlyWidget(
  html: string,
  calendlyUrl: string
): { html: string; report: CalendlyReport } {
  const report: CalendlyReport = {
    buttonInjected: false,
    widgetScriptInjected: false,
  };

  // Already injected?
  if (html.includes(CALENDLY_MARKER)) {
    return { html, report };
  }

  if (!calendlyUrl || !calendlyUrl.includes("calendly.com")) {
    return { html, report };
  }

  // Ensure URL has https://
  const url = calendlyUrl.startsWith("http")
    ? calendlyUrl
    : `https://${calendlyUrl}`;

  const widget = `
<!-- ${CALENDLY_MARKER} -->
<link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
<script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async></script>
<style>
  .foundry-calendly-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px;
    background: #006BFF;
    color: #fff;
    border: none;
    border-radius: 50px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,107,255,0.4);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .foundry-calendly-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,107,255,0.5);
  }
  .foundry-calendly-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
</style>
<button class="foundry-calendly-btn" onclick="Calendly.initPopupWidget({url:'${url}'});return false;">
  <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
  Book a Call
</button>
`;

  // Inject before </body>
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, widget + "\n</body>");
  } else {
    html = html + widget;
  }

  report.buttonInjected = true;
  report.widgetScriptInjected = true;

  return { html, report };
}
