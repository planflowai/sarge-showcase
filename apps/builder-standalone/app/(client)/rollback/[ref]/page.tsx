"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

export default function RollbackPage() {
  const params = useParams();
  const ref = params.ref as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deployedAt, setDeployedAt] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
  const [rolling, setRolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    fetch(`/api/intake/status?ref=${encodeURIComponent(ref)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((data) => {
        setProjectName(data.project_name || "Your Project");
        setDeployedAt(data.deployed_at);

        if (data.status === "rolled_back") {
          setRolledBack(true);
        } else if (!data.deployed_at) {
          setError("This project has not been deployed yet.");
        } else {
          const deployTime = new Date(data.deployed_at).getTime();
          const elapsed = (Date.now() - deployTime) / 60000;
          if (elapsed > 60) {
            setExpired(true);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ref]);

  // Live countdown
  useEffect(() => {
    if (!deployedAt || expired || rolledBack) return;

    const update = () => {
      const deployTime = new Date(deployedAt).getTime();
      const remaining = Math.max(0, 60 - (Date.now() - deployTime) / 60000);
      setMinutesLeft(remaining);
      if (remaining <= 0) {
        setExpired(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [deployedAt, expired, rolledBack]);

  const handleRollback = useCallback(async () => {
    if (!confirm("Are you sure? This will take your site offline immediately.")) return;
    setRolling(true);
    try {
      const res = await fetch("/api/intake/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_code: ref }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Rollback failed");
      }
      setRolledBack(true);
    } catch (err: any) {
      alert(err.message || "Rollback failed. Please contact support.");
    } finally {
      setRolling(false);
    }
  }, [ref]);

  const formatTime = (mins: number) => {
    const m = Math.floor(mins);
    const s = Math.floor((mins - m) * 60);
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const deployTimeStr = deployedAt
    ? new Date(deployedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0B0E11", fontFamily: "'DM Sans', sans-serif", color: "#F0F2F5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 520, padding: "24px", textAlign: "center" }}>
          {/* Logo */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "#FF6700", borderRadius: 8, fontWeight: 700, fontSize: 18, color: "#000", marginBottom: 12 }}>S</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>SARGE <span style={{ color: "#FF6700" }}>Web Studio</span></div>
            <div style={{ color: "#9BA3AF", fontSize: 14, marginTop: 4 }}>Emergency Rollback</div>
          </div>

          {loading && <div style={{ color: "#9BA3AF", padding: 40 }}>Loading project...</div>}

          {error && (
            <div style={{ background: "#181D24", border: "1px solid #2A3340", borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#EF4444", marginBottom: 8 }}>Error</div>
              <div style={{ fontSize: 14, color: "#9BA3AF" }}>{error}</div>
            </div>
          )}

          {/* Rolled back state */}
          {rolledBack && (
            <div style={{ background: "#181D24", border: "1px solid #2A3340", borderRadius: 12, padding: 32 }}>
              <div style={{ width: 64, height: 64, background: "#10B981", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 }}>&#10003;</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Site Taken Offline</div>
              <div style={{ fontSize: 14, color: "#9BA3AF", lineHeight: 1.6 }}>
                <strong style={{ color: "#F0F2F5" }}>{projectName}</strong> has been rolled back. Your coming soon page has been restored. We&apos;ve been notified and will review this immediately.
              </div>
            </div>
          )}

          {/* Expired state */}
          {!loading && !error && !rolledBack && expired && (
            <div style={{ background: "#181D24", border: "1px solid #2A3340", borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>&#128337;</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Rollback Window Has Expired</div>
              <div style={{ fontSize: 14, color: "#9BA3AF", lineHeight: 1.6 }}>
                The 60-minute rollback window for <strong style={{ color: "#F0F2F5" }}>{projectName}</strong> has passed.
                To request changes, please use the revision form or contact us directly.
              </div>
              <div style={{ marginTop: 20 }}>
                <a href={`/revisions/${encodeURIComponent(ref)}`} style={{ display: "inline-block", padding: "12px 32px", background: "#FF6700", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                  Request Changes Instead
                </a>
              </div>
            </div>
          )}

          {/* Active rollback state */}
          {!loading && !error && !rolledBack && !expired && minutesLeft !== null && (
            <div style={{ background: "#181D24", border: "1px solid #EF4444", borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 14, color: "#9BA3AF", marginBottom: 8 }}>
                Your site was deployed at <strong style={{ color: "#F0F2F5" }}>{deployTimeStr}</strong>
              </div>
              <div style={{ fontSize: 14, color: "#9BA3AF", marginBottom: 24 }}>
                You have <strong style={{ color: "#EF4444", fontSize: 20 }}>{formatTime(minutesLeft)}</strong> to rollback
              </div>

              {/* Countdown bar */}
              <div style={{ height: 6, background: "#1E242C", borderRadius: 3, marginBottom: 24, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(minutesLeft / 60) * 100}%`, background: minutesLeft < 10 ? "#EF4444" : "#F59E0B", borderRadius: 3, transition: "width 1s linear" }} />
              </div>

              <button
                onClick={handleRollback}
                disabled={rolling}
                style={{
                  width: "100%",
                  padding: "18px 32px",
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: rolling ? "wait" : "pointer",
                  opacity: rolling ? 0.6 : 1,
                  fontFamily: "inherit",
                  letterSpacing: 0.5,
                }}
              >
                {rolling ? "Rolling Back..." : "TAKE MY SITE OFFLINE"}
              </button>

              <div style={{ marginTop: 16, fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>
                This will replace your live site with a &quot;coming soon&quot; page on all hosting providers. Our team will be notified immediately.
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 24, fontSize: 11, color: "#64748B" }}>
            Ref: {ref} &bull; Questions? Contact support@sargewebstudio.com
          </div>
        </div>
      </body>
    </html>
  );
}
