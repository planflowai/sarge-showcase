"use client";

import { useState, useCallback } from "react";
import { PACKAGES, TRUST_ITEMS, type PricingPackage } from "@/lib/pricing-config";

/* ─── Theme ─── */
const themes = {
  dark: {
    bg: "#0B0E11",
    cardBg: "#181D24",
    cardBorder: "#2A3340",
    text: "#F0F2F5",
    textMuted: "#9BA3AF",
    textDim: "#64748B",
    pillBg: "rgba(255,255,255,0.06)",
    pillBgOff: "rgba(255,255,255,0.03)",
    inputBg: "#0F1318",
    inputBorder: "#2A3340",
    overlayBg: "rgba(0,0,0,0.7)",
    trustBg: "#111419",
    featureCheck: "#10B981",
    featureCross: "#4B5563",
  },
  light: {
    bg: "#F1F5F9",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E8F0",
    text: "#0F172A",
    textMuted: "#64748B",
    textDim: "#94A3B8",
    pillBg: "rgba(0,0,0,0.05)",
    pillBgOff: "rgba(0,0,0,0.03)",
    inputBg: "#F8FAFC",
    inputBorder: "#CBD5E1",
    overlayBg: "rgba(0,0,0,0.4)",
    trustBg: "#E2E8F0",
    featureCheck: "#059669",
    featureCross: "#CBD5E1",
  },
};

export default function KickoffPage() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [selected, setSelected] = useState<PricingPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ refCode: string } | null>(null);
  const [error, setError] = useState("");

  // Form fields
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDomain, setClientDomain] = useState("");

  const t = themes[mode];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selected || !projectName.trim() || !clientEmail.trim()) return;

      setSubmitting(true);
      setError("");

      try {
        const res = await fetch("/api/project/kickoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            package: selected.id,
            projectName: projectName.trim(),
            clientName: clientName.trim(),
            clientEmail: clientEmail.trim(),
            clientPhone: clientPhone.trim(),
            clientDomain: clientDomain.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong");

        setSuccess({ refCode: data.ref_code });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Submission failed");
      } finally {
        setSubmitting(false);
      }
    },
    [selected, projectName, clientName, clientEmail, clientPhone, clientDomain],
  );

  const closeModal = () => {
    if (submitting) return;
    setSelected(null);
    setError("");
    if (success) {
      setSuccess(null);
      setProjectName("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientDomain("");
    }
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Start Your Project | PlanFlowAI</title>
        <meta
          name="description"
          content="Choose your package and launch your custom website with PlanFlowAI. 100% custom design, deployed to 4 platforms."
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          body { transition: background 0.3s, color 0.3s; }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: scale(0.95) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .card-hover { transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s; }
          .card-hover:hover { transform: translateY(-6px); }
          .btn-hover { transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s; }
          .btn-hover:hover { transform: translateY(-2px); }
          .btn-hover:active { transform: translateY(0); }
          input:focus { outline: none; border-color: #FF6700 !important; box-shadow: 0 0 0 3px rgba(255,103,0,0.15); }
        `,
          }}
        />
      </head>
      <body
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background: t.bg,
          color: t.text,
          minHeight: "100vh",
          transition: "background 0.3s, color 0.3s",
        }}
      >
        {/* ─── Header ─── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 32px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/assets/logo.png"
              alt="PlanFlowAI"
              height={40}
              style={{ borderRadius: 8 }}
            />
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              PlanFlow<span style={{ color: "#FF6700" }}>AI</span>
            </span>
          </div>
          <button
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: `1px solid ${t.cardBorder}`,
              background: t.cardBg,
              color: t.text,
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s, border-color 0.2s",
            }}
          >
            {mode === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
        </header>

        {/* ─── Hero ─── */}
        <section
          style={{
            textAlign: "center",
            padding: "48px 24px 24px",
            maxWidth: 720,
            margin: "0 auto",
            animation: "fadeInUp 0.6s ease-out",
          }}
        >
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Choose Your{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #14B8A6, #8B5CF6, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Package
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: t.textMuted,
              lineHeight: 1.6,
              maxWidth: 540,
              margin: "0 auto",
            }}
          >
            Pick the perfect plan for your project. Every package includes a custom
            design, deployed live to 4 platforms.
          </p>
        </section>

        {/* ─── Pricing Cards ─── */}
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            padding: "32px 24px 48px",
            maxWidth: 1100,
            margin: "0 auto",
            flexWrap: "wrap",
          }}
        >
          {PACKAGES.map((pkg, i) => (
            <div
              key={pkg.id}
              className="card-hover"
              style={{
                width: 320,
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 20,
                padding: "36px 28px 28px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animation: `fadeInUp 0.6s ease-out ${i * 0.12}s both`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Gradient accent line at top */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${pkg.buttonColor}, ${pkg.buttonColor}88)`,
                }}
              />

              {/* Icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: `${pkg.buttonColor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                  color: pkg.buttonColor,
                }}
                dangerouslySetInnerHTML={{
                  __html: pkg.iconSvg.replace(
                    "<svg",
                    '<svg width="32" height="32"',
                  ),
                }}
              />

              {/* Name & tagline */}
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 6,
                  color: t.text,
                }}
              >
                {pkg.name}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: t.textMuted,
                  marginBottom: 20,
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                {pkg.tagline}
              </p>

              {/* Price */}
              <div style={{ marginBottom: 24, textAlign: "center" }}>
                <span
                  style={{ fontSize: 36, fontWeight: 800, color: t.text }}
                >
                  ${pkg.priceMin.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    color: t.textMuted,
                    fontWeight: 500,
                  }}
                >
                  {" "}&ndash; ${pkg.priceMax.toLocaleString()}
                </span>
              </div>

              {/* Features */}
              <div
                style={{
                  width: "100%",
                  marginBottom: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {pkg.features.map((f) => (
                  <div
                    key={f.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: f.included ? t.pillBg : t.pillBgOff,
                      fontSize: 13,
                      fontWeight: 500,
                      color: f.included ? t.text : t.textDim,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                        background: f.included
                          ? `${t.featureCheck}20`
                          : `${t.featureCross}20`,
                        color: f.included ? t.featureCheck : t.featureCross,
                      }}
                    >
                      {f.included ? "\u2713" : "\u2715"}
                    </span>
                    {f.text}
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                className="btn-hover"
                onClick={() => setSelected(pkg)}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  background: pkg.buttonColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: 0.3,
                  boxShadow: `0 4px 16px ${pkg.buttonColor}40`,
                  marginTop: "auto",
                }}
              >
                Select {pkg.name}
              </button>
            </div>
          ))}
        </section>

        {/* ─── Trust Bar ─── */}
        <section
          style={{
            background: t.trustBg,
            borderTop: `1px solid ${t.cardBorder}`,
            borderBottom: `1px solid ${t.cardBorder}`,
            padding: "28px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 40,
              flexWrap: "wrap",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: t.textMuted,
                }}
              >
                <span style={{ color: "#FF6700", fontSize: 14 }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer
          style={{
            textAlign: "center",
            padding: "32px 24px",
            fontSize: 12,
            color: t.textDim,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            Built with{" "}
            <strong style={{ color: "#FF6700" }}>PlanFlowAI</strong>
          </div>
          <div>Questions? Contact support@planflowai.com</div>
        </footer>

        {/* ─── Modal Overlay ─── */}
        {selected && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: t.overlayBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 24,
              backdropFilter: "blur(4px)",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 480,
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 20,
                padding: "36px 32px",
                animation: "slideIn 0.3s ease-out",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              {/* ─── Success state ─── */}
              {success ? (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      background: "#10B981",
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      color: "#fff",
                      marginBottom: 20,
                    }}
                  >
                    &#10003;
                  </div>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      marginBottom: 8,
                      color: t.text,
                    }}
                  >
                    Project Launched!
                  </h2>
                  <p
                    style={{
                      fontSize: 14,
                      color: t.textMuted,
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    Your coming soon page is being deployed to 4 platforms.
                    Check your email for next steps and your intake form link.
                  </p>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "10px 20px",
                      background: t.pillBg,
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "monospace",
                      marginBottom: 24,
                      color: t.text,
                    }}
                  >
                    Ref: {success.refCode}
                  </div>
                  <br />
                  <button
                    className="btn-hover"
                    onClick={closeModal}
                    style={{
                      padding: "14px 32px",
                      background: "#FF6700",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* ─── Form state ─── */
                <form onSubmit={handleSubmit}>
                  {/* Header */}
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <h2
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        marginBottom: 8,
                        color: t.text,
                      }}
                    >
                      Start Your Project
                    </h2>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "6px 16px",
                        borderRadius: 8,
                        background: `${selected.buttonColor}18`,
                        border: `1px solid ${selected.buttonColor}40`,
                        fontSize: 13,
                        fontWeight: 600,
                        color: selected.buttonColor,
                      }}
                    >
                      {selected.name} &mdash; ${selected.priceMin.toLocaleString()}&ndash;${selected.priceMax.toLocaleString()}
                    </div>
                  </div>

                  {/* Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.textMuted,
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Project Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="My Awesome Website"
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          borderRadius: 10,
                          fontSize: 14,
                          color: t.text,
                          fontFamily: "inherit",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.textMuted,
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Jane Smith"
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          borderRadius: 10,
                          fontSize: 14,
                          color: t.text,
                          fontFamily: "inherit",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.textMuted,
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="jane@company.com"
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          borderRadius: 10,
                          fontSize: 14,
                          color: t.text,
                          fontFamily: "inherit",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 600,
                            color: t.textMuted,
                            marginBottom: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            background: t.inputBg,
                            border: `1px solid ${t.inputBorder}`,
                            borderRadius: 10,
                            fontSize: 14,
                            color: t.text,
                            fontFamily: "inherit",
                            transition: "border-color 0.2s, box-shadow 0.2s",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 600,
                            color: t.textMuted,
                            marginBottom: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Domain
                        </label>
                        <input
                          type="text"
                          value={clientDomain}
                          onChange={(e) => setClientDomain(e.target.value)}
                          placeholder="company.com"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            background: t.inputBg,
                            border: `1px solid ${t.inputBorder}`,
                            borderRadius: 10,
                            fontSize: 14,
                            color: t.text,
                            fontFamily: "inherit",
                            transition: "border-color 0.2s, box-shadow 0.2s",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: "10px 14px",
                        background: "#EF444420",
                        border: "1px solid #EF444440",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "#EF4444",
                        fontWeight: 500,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-hover"
                    style={{
                      width: "100%",
                      padding: "18px 24px",
                      marginTop: 24,
                      background: submitting
                        ? `${selected.buttonColor}80`
                        : selected.buttonColor,
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: submitting ? "wait" : "pointer",
                      fontFamily: "inherit",
                      letterSpacing: 0.3,
                      boxShadow: `0 4px 16px ${selected.buttonColor}40`,
                      transition: "background 0.2s",
                    }}
                  >
                    {submitting ? (
                      <span style={{ animation: "pulse 1.5s infinite" }}>
                        Launching Your Project...
                      </span>
                    ) : (
                      "Launch My Project"
                    )}
                  </button>

                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      color: t.textDim,
                      marginTop: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    We&apos;ll deploy a coming soon page immediately and send you
                    an intake form to tell us about your vision.
                  </p>

                  {/* Close */}
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      display: "block",
                      margin: "16px auto 0",
                      background: "none",
                      border: "none",
                      color: t.textMuted,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
