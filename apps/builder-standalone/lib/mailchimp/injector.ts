/**
 * Mailchimp Email Signup Form Injector
 *
 * Injects a styled email capture form using Mailchimp's public form action URL.
 * No API key required — uses the audience embed form action.
 */

export interface MailchimpReport {
  formInjected: boolean;
}

const MAILCHIMP_MARKER = "mailchimp-foundry-signup";

/**
 * Inject Mailchimp signup form into HTML.
 * Adds a styled email capture form before </footer> or </body>.
 */
export function injectMailchimpForm(
  html: string,
  actionUrl: string
): { html: string; report: MailchimpReport } {
  const report: MailchimpReport = {
    formInjected: false,
  };

  // Already injected?
  if (html.includes(MAILCHIMP_MARKER)) {
    return { html, report };
  }

  if (!actionUrl || !actionUrl.includes("list-manage.com")) {
    return { html, report };
  }

  const form = `
<!-- ${MAILCHIMP_MARKER} -->
<style>
  .foundry-mc-signup {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 24px;
    background: #111;
    border-top: 3px solid #FFE01B;
    text-align: center;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .foundry-mc-signup h3 {
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .foundry-mc-signup p {
    color: #999;
    font-size: 14px;
    margin: 0 0 20px;
  }
  .foundry-mc-signup form {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .foundry-mc-signup input[type="text"],
  .foundry-mc-signup input[type="email"] {
    flex: 1;
    min-width: 160px;
    padding: 12px 16px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .foundry-mc-signup input:focus {
    border-color: #FFE01B;
  }
  .foundry-mc-signup button {
    padding: 12px 24px;
    background: #FFE01B;
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .foundry-mc-signup button:hover {
    background: #ffd500;
    transform: translateY(-1px);
  }
  /* Honeypot — hidden from humans */
  .foundry-mc-signup .mc-hp { position: absolute; left: -5000px; }
</style>
<div class="foundry-mc-signup" id="${MAILCHIMP_MARKER}">
  <h3>Stay in the Loop</h3>
  <p>Get updates, tips, and exclusive offers — no spam, ever.</p>
  <form action="${actionUrl}" method="post" target="_blank" novalidate>
    <input type="text" name="FNAME" placeholder="First name" aria-label="First name">
    <input type="email" name="EMAIL" placeholder="Email address" required aria-label="Email address">
    <!-- Honeypot anti-spam -->
    <div class="mc-hp" aria-hidden="true"><input type="text" name="b_honeypot" tabindex="-1" value=""></div>
    <button type="submit">Subscribe</button>
  </form>
</div>
`;

  // Inject before </footer> if present, otherwise before </body>
  if (/<\/footer>/i.test(html)) {
    html = html.replace(/<\/footer>/i, form + "\n</footer>");
  } else if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, form + "\n</body>");
  } else {
    html = html + form;
  }

  report.formInjected = true;

  return { html, report };
}
