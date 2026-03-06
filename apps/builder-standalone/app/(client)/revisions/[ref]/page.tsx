"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

export default function RevisionPage() {
  const params = useParams();
  const ref = params.ref as string;
  const [projectName, setProjectName] = useState("");
  const [revisionCount, setRevisionCount] = useState(0);
  const [maxRevisions, setMaxRevisions] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [page, setPage] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/intake/status?ref=${encodeURIComponent(ref)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((data) => {
        setProjectName(data.project_name || "Your Project");
        setRevisionCount(data.revision_count || 0);
        setMaxRevisions(data.max_revisions || 3);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ref]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!page || !description.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/intake/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_code: ref,
          page,
          description: description.trim(),
          priority,
          attachment_url: imageFile ? imageFile.name : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }

      setSubmitted(true);
      setRevisionCount((c) => c + 1);
    } catch (err: any) {
      setFormError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [ref, page, description, priority, imageFile]);

  const resetForm = useCallback(() => {
    setPage("");
    setDescription("");
    setPriority("medium");
    setImagePreview(null);
    setImageFile(null);
    setSubmitted(false);
    setFormError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const currentRevision = revisionCount + 1;
  const overLimit = revisionCount >= maxRevisions;

  const css = `
    :root { --bg:#0B0E11; --bg2:#12161B; --card:#181D24; --input:#1E242C; --border:#2A3340; --accent:#FF6700; --accent2:#CC5200; --text:#F0F2F5; --text2:#9BA3AF; --green:#10B981; --red:#EF4444; --amber:#F59E0B; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .container { width:100%; max-width:560px; }
    .logo { text-align:center; margin-bottom:24px; }
    .logo-mark { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; background:var(--accent); border-radius:8px; font-weight:700; font-size:18px; color:#000; margin-bottom:12px; }
    .logo h1 { font-size:22px; font-weight:600; }
    .logo h1 span { color:var(--accent); }
    .logo p { color:var(--text2); font-size:14px; margin-top:4px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:32px; }
    .field { margin-bottom:20px; }
    .field label { display:block; font-size:13px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
    .field input, .field textarea, .field select { width:100%; padding:10px 14px; background:var(--input); border:1px solid var(--border); border-radius:8px; color:var(--text); font-family:inherit; font-size:14px; outline:none; transition:border-color 0.2s; }
    .field input:focus, .field textarea:focus, .field select:focus { border-color:var(--accent); }
    .field textarea { min-height:120px; resize:vertical; }
    .field select { cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%239BA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; padding-right:36px; }
    .priority-group { display:flex; gap:8px; }
    .priority-btn { flex:1; padding:10px; text-align:center; border:1px solid var(--border); border-radius:8px; background:var(--input); color:var(--text2); font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; font-family:inherit; }
    .priority-btn:hover { border-color:var(--text2); }
    .priority-btn.selected { border-color:var(--accent); color:var(--accent); background:rgba(255,103,0,0.1); }
    .submit-btn { width:100%; padding:14px; background:var(--accent); color:#000; border:none; border-radius:8px; font-family:inherit; font-size:15px; font-weight:600; cursor:pointer; transition:background 0.2s; margin-top:8px; }
    .submit-btn:hover { background:var(--accent2); }
    .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
    .notice { padding:12px 16px; border-radius:8px; font-size:13px; line-height:1.6; margin-bottom:20px; }
    .notice-info { background:rgba(255,103,0,0.08); border:1px solid rgba(255,103,0,0.3); color:var(--accent); }
    .notice-warn { background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); color:var(--amber); }
    .notice-danger { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); color:var(--red); }
    .img-preview { max-width:100%; max-height:200px; border-radius:8px; border:1px solid var(--border); margin-top:8px; object-fit:contain; background:var(--input); }
    .success-screen { text-align:center; padding:48px 24px; }
    .success-icon { width:64px; height:64px; background:var(--green); border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:16px; }
    .error-msg { color:var(--red); font-size:13px; margin-top:8px; }
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="container">
          <div className="logo">
            <div className="logo-mark">S</div>
            <h1>SARGE <span>Web Studio</span></h1>
            <p>Request a Revision — {projectName || ref}</p>
          </div>

          {loading && <div style={{ textAlign: "center", color: "#9BA3AF", padding: 40 }}>Loading...</div>}
          {error && <div className="card" style={{ textAlign: "center" }}><div style={{ color: "#EF4444", fontWeight: 600 }}>Error</div><div style={{ color: "#9BA3AF", marginTop: 8 }}>{error}</div></div>}

          {!loading && !error && !submitted && (
            <div className="card">
              {/* Revision counter */}
              <div className="notice notice-info">
                This is revision <strong>{currentRevision}</strong> of <strong>{maxRevisions}</strong> included in your package.
              </div>

              {/* Over-limit charge notice */}
              {overLimit && (
                <div className="notice notice-danger">
                  <strong>Additional Charge Notice:</strong> You have used all {maxRevisions} included revision rounds. Additional revisions are <strong>$75 each</strong>. By submitting this form you agree to the additional charge.
                </div>
              )}

              {/* Ref code */}
              <div className="field">
                <label>Reference Code</label>
                <input type="text" value={ref} readOnly style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </div>

              {/* Page selector */}
              <div className="field">
                <label>Which page needs changes?</label>
                <select value={page} onChange={(e) => setPage(e.target.value)}>
                  <option value="">Select a page...</option>
                  <option value="home">Home Page</option>
                  <option value="about">About Page</option>
                  <option value="services">Services Page</option>
                  <option value="contact">Contact Page</option>
                  <option value="gallery">Gallery</option>
                  <option value="testimonials">Testimonials</option>
                  <option value="faq">FAQ</option>
                  <option value="blog">Blog</option>
                  <option value="pricing">Pricing</option>
                  <option value="booking">Booking</option>
                  <option value="shop">Shop</option>
                  <option value="header">Header / Navigation</option>
                  <option value="footer">Footer</option>
                  <option value="overall">Overall / Sitewide</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div className="field">
                <label>Describe the change</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={'Please be specific. For example:\n"Move the phone number from the footer to the header"\n"Change the hero background from blue to dark green (#1B4332)"'}
                />
              </div>

              {/* Priority */}
              <div className="field">
                <label>Priority</label>
                <div className="priority-group">
                  {(["low", "medium", "high"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`priority-btn${priority === p ? " selected" : ""}`}
                      onClick={() => setPriority(p)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div className="field">
                <label>Reference Image (optional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ fontSize: 13 }}
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="img-preview" />
                )}
              </div>

              {formError && <div className="error-msg">{formError}</div>}

              <button
                type="button"
                className="submit-btn"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting..." : overLimit ? "Submit Revision ($75)" : "Submit Revision Request"}
              </button>
            </div>
          )}

          {submitted && (
            <div className="card">
              <div className="success-screen">
                <div className="success-icon">&#10003;</div>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>Revision Submitted</h2>
                <p style={{ color: "#9BA3AF", fontSize: 14, lineHeight: 1.6 }}>
                  We&apos;ve received your revision request for <strong style={{ color: "#F0F2F5" }}>{projectName}</strong>.
                  We&apos;ll review your changes and update your preview within 2-3 business days.
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ marginTop: 20, padding: "10px 24px", background: "transparent", border: "1px solid #FF6700", borderRadius: 8, color: "#FF6700", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Submit another revision
                </button>
              </div>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#64748B" }}>
            Ref: {ref} &bull; Questions? Contact support@sargewebstudio.com
          </div>
        </div>
      </body>
    </html>
  );
}
