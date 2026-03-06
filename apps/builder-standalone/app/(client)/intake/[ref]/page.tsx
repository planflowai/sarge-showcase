"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

// Serve the intake form HTML at /intake/SARGE-XXXXX with ref code pre-filled
export default function IntakePage() {
  const params = useParams();
  const ref = params.ref as string;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Fetch the intake form HTML and inject it into an iframe with ref pre-filled
    fetch("/intake-form.html")
      .then((r) => r.text())
      .then((html) => {
        if (!iframeRef.current) return;
        // Inject a script that pre-fills the ref code after DOM loads
        const injection = `
<script>
  window.addEventListener('DOMContentLoaded', function() {
    var refInput = document.getElementById('refCode') || document.querySelector('input[name="ref"]');
    if (refInput) { refInput.value = ${JSON.stringify(ref)}; refInput.readOnly = true; }
    // Also set a hidden field if the form uses FormData
    var form = document.getElementById('intakeForm');
    if (form) {
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'ref';
      hidden.value = ${JSON.stringify(ref)};
      form.appendChild(hidden);
    }
  });
</script>`;
        const modifiedHtml = html.replace("</head>", injection + "\n</head>");
        iframeRef.current.srcdoc = modifiedHtml;
      })
      .catch(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = `<html><body style="background:#0B0E11;color:#F0F2F5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><h2>Form not available. Please contact us.</h2></body></html>`;
        }
      });
  }, [ref]);

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        background: "#0B0E11",
      }}
      title="Project Intake Form"
    />
  );
}
