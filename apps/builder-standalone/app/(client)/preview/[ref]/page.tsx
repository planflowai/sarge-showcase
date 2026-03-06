"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface ProjectData {
  ref_code: string;
  project_name: string;
  client_name: string;
  status: string;
  preview_sent_at: string | null;
  approved_at: string | null;
  deployed_at: string | null;
  revision_count: number;
  max_revisions: number;
  form_data: Record<string, unknown> | null;
}

export default function PreviewPage() {
  const params = useParams();
  const ref = params.ref as string;
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    fetch(`/api/intake/status?ref=${encodeURIComponent(ref)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((data) => {
        setProject(data);
        if (data.status === "approved" || data.status === "deployed") {
          setApproved(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ref]);

  const handleApprove = useCallback(async () => {
    if (!confirm("Are you sure you want to approve this site? It will go live shortly.")) return;
    setApproving(true);
    try {
      const res = await fetch("/api/intake/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_code: ref }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Approval failed");
      }
      setApproved(true);
    } catch (err: any) {
      alert(err.message || "Failed to approve. Please try again.");
    } finally {
      setApproving(false);
    }
  }, [ref]);

  // Calculate auto-approval countdown
  const getAutoApprovalDays = () => {
    if (!project?.preview_sent_at) return null;
    const sent = new Date(project.preview_sent_at).getTime();
    const deadline = sent + 14 * 24 * 60 * 60 * 1000; // 14 days
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000)));
    return remaining;
  };

  const autoApprovalDays = project ? getAutoApprovalDays() : null;
  const remainingRevisions = project ? Math.max(0, project.max_revisions - project.revision_count) : 0;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0B0E11", fontFamily: "'DM Sans', sans-serif", color: "#F0F2F5", minHeight: "100vh" }}>
        {/* Header */}
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(11,14,17,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid #2A3340", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#FF6700", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#000" }}>S</div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>SARGE <span style={{ color: "#FF6700" }}>Web Studio</span></span>
          </div>
          <div style={{ fontSize: 12, color: "#9BA3AF" }}>
            Site Preview {project ? `— ${project.project_name}` : ""}
          </div>
        </header>

        {/* Loading / Error states */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#9BA3AF" }}>
            Loading project...
          </div>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#EF4444", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Project Not Found</div>
            <div style={{ fontSize: 14, color: "#9BA3AF" }}>Reference code: {ref}</div>
          </div>
        )}

        {/* Main content */}
        {project && !loading && !error && (
          <>
            {/* Site Info Bar */}
            <div style={{ position: "fixed", top: 61, left: 0, right: 0, zIndex: 99, background: "#12161B", borderBottom: "1px solid #2A3340", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#9BA3AF" }}>
                <span><strong style={{ color: "#F0F2F5" }}>{project.project_name}</strong></span>
                {project.client_name && <span>Client: <strong style={{ color: "#F0F2F5" }}>{project.client_name}</strong></span>}
                <span>Ref: <strong style={{ color: "#FF6700" }}>{ref}</strong></span>
              </div>
              <div style={{ fontSize: 12, color: "#9BA3AF" }}>
                {remainingRevisions > 0
                  ? `${remainingRevisions} revision round${remainingRevisions !== 1 ? "s" : ""} remaining`
                  : "No revision rounds remaining"}
              </div>
            </div>

            {/* Preview iframe */}
            <iframe
              src={`/api/builder/preview?ref=${encodeURIComponent(ref)}`}
              style={{
                position: "fixed",
                top: 105,
                left: 0,
                right: 0,
                bottom: approved ? 0 : 180,
                width: "100%",
                height: approved ? "calc(100vh - 105px)" : "calc(100vh - 285px)",
                border: "none",
                background: "#fff",
              }}
              title="Site Preview"
            />

            {/* Action bar — only if not yet approved */}
            {!approved && (
              <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#12161B", borderTop: "1px solid #2A3340", padding: "20px 24px" }}>
                {/* Auto-approval notice */}
                {autoApprovalDays !== null && autoApprovalDays > 0 && (
                  <div style={{ textAlign: "center", marginBottom: 16, padding: "10px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, fontSize: 13, color: "#F59E0B" }}>
                    This preview will auto-approve in <strong>{autoApprovalDays} day{autoApprovalDays !== 1 ? "s" : ""}</strong> if no action is taken.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    style={{
                      padding: "16px 48px",
                      background: "#10B981",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: approving ? "wait" : "pointer",
                      opacity: approving ? 0.6 : 1,
                      fontFamily: "inherit",
                      letterSpacing: 0.5,
                      minWidth: 200,
                    }}
                  >
                    {approving ? "Approving..." : "APPROVE MY SITE"}
                  </button>
                  <a
                    href={`/revisions/${encodeURIComponent(ref)}`}
                    style={{
                      padding: "16px 48px",
                      background: "transparent",
                      color: "#F59E0B",
                      border: "2px solid #F59E0B",
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 700,
                      textDecoration: "none",
                      textAlign: "center",
                      fontFamily: "inherit",
                      letterSpacing: 0.5,
                      minWidth: 200,
                      display: "inline-block",
                    }}
                  >
                    REQUEST CHANGES
                  </a>
                </div>

                {/* Revision counter */}
                <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#64748B" }}>
                  You have <strong style={{ color: "#9BA3AF" }}>{remainingRevisions}</strong> revision round{remainingRevisions !== 1 ? "s" : ""} remaining in your package.
                </div>
              </div>
            )}

            {/* Approved state */}
            {approved && (
              <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#12161B", borderTop: "1px solid #2A3340", padding: "16px 24px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8 }}>
                  <span style={{ fontSize: 18 }}>&#10003;</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#10B981" }}>
                    Site Approved — Your site will be live shortly!
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ position: "fixed", bottom: approved ? 56 : 180, left: 0, right: 0, background: "#0B0E11", borderTop: "1px solid #1E2128", padding: "8px 24px", textAlign: "center", fontSize: 11, color: "#64748B", display: approved ? "none" : "block" }}>
              <a href="#" style={{ color: "#64748B", textDecoration: "underline" }}>Terms of Service</a>
              {" "}&bull;{" "}
              <a href="#" style={{ color: "#64748B", textDecoration: "underline" }}>Privacy Policy</a>
              {" "}&bull;{" "}
              <span>Questions? Email us at support@sargewebstudio.com</span>
            </div>
          </>
        )}
      </body>
    </html>
  );
}
