/**
 * Generates a professional "Coming Soon" landing page.
 * Used by the New Project Wizard as the initial hello page
 * that gets deployed to all 4 targets immediately.
 */

interface HelloPageOptions {
  projectName: string;
  clientName?: string;
  clientEmail?: string;
  domain?: string;
}

export function generateHelloPage(opts: HelloPageOptions): string {
  const { projectName, clientName, clientEmail, domain } = opts;
  const displayDomain = domain || "yoursite.com";
  const contactLine = clientEmail
    ? `<a href="mailto:${esc(clientEmail)}" class="contact-link">${esc(clientEmail)}</a>`
    : "";
  const builtFor = clientName
    ? `<p class="built-for">A project for <strong>${esc(clientName)}</strong></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(projectName)} — Coming Soon</title>
  <meta name="description" content="${esc(projectName)} is launching soon. Stay tuned for something amazing.">
  <meta name="robots" content="noindex, nofollow">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      color: #e2e8f0;
      padding: 2rem;
      overflow: hidden;
    }

    /* Animated background orbs */
    body::before, body::after {
      content: '';
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.3;
      z-index: 0;
      animation: float 8s ease-in-out infinite alternate;
    }
    body::before {
      width: 400px; height: 400px;
      background: #667eea;
      top: -100px; left: -100px;
    }
    body::after {
      width: 350px; height: 350px;
      background: #764ba2;
      bottom: -100px; right: -100px;
      animation-delay: -4s;
    }

    @keyframes float {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(30px, 20px) scale(1.1); }
    }

    .card {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 560px;
      width: 100%;
      padding: 3.5rem 3rem;
      background: rgba(15, 12, 41, 0.7);
      border: 1px solid rgba(102, 126, 234, 0.2);
      border-radius: 24px;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
    }

    .logo-ring {
      width: 80px; height: 80px;
      margin: 0 auto 1rem;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
    }
    .logo-ring img {
      width: 80px; height: 80px;
      border-radius: 16px;
      object-fit: contain;
    }
    .powered-by {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 1.5rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-weight: 600;
    }

    h1 {
      font-size: 2.25rem;
      font-weight: 800;
      background: linear-gradient(135deg, #e2e8f0, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
      line-height: 1.2;
    }

    .tagline {
      font-size: 1.125rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
      font-weight: 400;
    }

    .built-for {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 1.5rem;
    }
    .built-for strong {
      color: #a78bfa;
    }

    .divider {
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 3px;
      margin: 0 auto 1.5rem;
    }

    .domain-badge {
      display: inline-block;
      padding: 0.5rem 1.25rem;
      background: rgba(102, 126, 234, 0.15);
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #a78bfa;
      letter-spacing: 0.02em;
      margin-bottom: 1.5rem;
    }

    .contact-link {
      display: inline-block;
      margin-top: 1rem;
      color: #667eea;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    .contact-link:hover { color: #a78bfa; }

    .footer {
      position: relative;
      z-index: 1;
      margin-top: 2.5rem;
      font-size: 0.75rem;
      color: #475569;
    }

    @media (max-width: 480px) {
      .card { padding: 2.5rem 1.5rem; }
      h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-ring"><img src="/assets/logo.png" alt="PlanFlowAI"></div>
    <p class="powered-by">Powered by PlanFlowAI</p>
    <h1>${esc(projectName)}</h1>
    <p class="tagline">Something amazing is on the way.</p>
    ${builtFor}
    <div class="divider"></div>
    <span class="domain-badge">${esc(displayDomain)}</span>
    ${contactLine}
  </div>
  <p class="footer">Built with <strong style="color:#FF6700;">PlanFlowAI</strong></p>
</body>
</html>`;
}

/** HTML-escape helper */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
