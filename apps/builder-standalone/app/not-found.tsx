export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Page Not Found | PlanFlowAI</title>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0B0E11",
          fontFamily: "'DM Sans', sans-serif",
          color: "#F0F2F5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <img
            src="/assets/logo.png"
            alt="PlanFlowAI"
            height={56}
            style={{ display: "block", margin: "0 auto 24px", borderRadius: 10 }}
          />
          <div style={{ fontSize: 64, fontWeight: 800, color: "#FF6700", marginBottom: 8 }}>
            404
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
            Page Not Found
          </div>
          <div style={{ fontSize: 14, color: "#9BA3AF", lineHeight: 1.6, marginBottom: 32 }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </div>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              background: "#FF6700",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: 0.5,
            }}
          >
            Back to Home
          </a>
        </div>
      </body>
    </html>
  );
}
