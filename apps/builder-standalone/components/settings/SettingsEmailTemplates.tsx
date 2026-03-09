"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Eye, Send, X, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardCls, inputCls } from "./settingsStyles";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TEMPLATES = [
  { id: "welcome", label: "Welcome", desc: "Sent when a project is created for a new client" },
  { id: "intake_received", label: "Intake Received", desc: "Confirmation after client submits intake form" },
  { id: "build_started", label: "Build Started", desc: "Notifies client that their site build has begun" },
  { id: "preview_ready", label: "Preview Ready", desc: "Sent when preview URL is available for review" },
  { id: "site_live", label: "Site Live", desc: "Sent after site is deployed to production" },
  { id: "revision_received", label: "Revision Received", desc: "Confirmation of a client revision request" },
  { id: "rollback_alert", label: "Rollback Alert", desc: "Admin alert when a client triggers a rollback" },
] as const;

type TemplateId = (typeof TEMPLATES)[number]["id"];

/* Per-template test data defaults */
const DEFAULT_TEST_DATA: Record<TemplateId, Record<string, string>> = {
  welcome: {
    client_name: "John Doe",
    business_name: "Acme Corp",
    project_name: "Acme Corp",
    coming_soon_url: "https://acme-corp.vercel.app",
    intake_form_url: "https://app.planflowai.com/intake/PF-ABC123",
    ref_code: "PF-ABC123",
    your_phone: "(555) 123-4567",
  },
  intake_received: {
    client_name: "John Doe",
    business_name: "Acme Corp",
    project_name: "Acme Corp",
    form_summary: '<tr><td style="padding:8px 12px;font-size:13px;">Business</td><td style="padding:8px 12px;font-size:14px;">Acme Corp</td></tr><tr><td style="padding:8px 12px;font-size:13px;">Industry</td><td style="padding:8px 12px;font-size:14px;">Technology</td></tr>',
    timeline: "5-7",
    ref_code: "PF-ABC123",
  },
  build_started: {
    client_name: "John Doe",
    business_name: "Acme Corp",
    project_name: "Acme Corp",
    ref_code: "PF-ABC123",
    timeline: "5-7",
  },
  preview_ready: {
    client_name: "John Doe",
    business_name: "Acme Corp",
    project_name: "Acme Corp",
    preview_url: "https://acme-corp-preview.vercel.app",
    revision_url: "https://app.planflowai.com/revision/PF-ABC123",
    revision_count: "3",
    ref_code: "PF-ABC123",
  },
  site_live: {
    client_name: "John Doe",
    business_name: "Acme Corp",
    project_name: "Acme Corp",
    live_urls: "https://acme-corp.vercel.app,https://acme-corp.netlify.app",
    live_url: "https://acme-corp.vercel.app",
    rollback_url: "https://app.planflowai.com/rollback/PF-ABC123",
    remaining_balance: "$450.00",
    payment_link: "https://pay.planflowai.com/inv/PF-ABC123",
    ref_code: "PF-ABC123",
  },
  revision_received: {
    client_name: "John Doe",
    project_name: "Acme Corp",
    page: "Home Page",
    description: "Move the hero image to the left and make the CTA button larger",
    priority: "High",
    revision_number: "2",
    timeline: "2-3",
    ref_code: "PF-ABC123",
  },
  rollback_alert: {
    client_name: "John Doe",
    project_name: "Acme Corp",
    ref_code: "PF-ABC123",
    rollback_time: new Date().toISOString(),
  },
};

const STORAGE_KEY = "pf-email-test-data";

/* ─── Component ───────────────────────────────────────────────────────────── */

export function SettingsEmailTemplates() {
  const [testData, setTestData] = useState<Record<TemplateId, Record<string, string>>>(DEFAULT_TEST_DATA);
  const [expandedTemplate, setExpandedTemplate] = useState<TemplateId | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateId | null>(null);
  const [loading, setLoading] = useState<TemplateId | null>(null);
  const [sendingTo, setSendingTo] = useState("");
  const [sendStatus, setSendStatus] = useState<Record<TemplateId, { ok: boolean; msg: string } | null>>({} as any);

  // Load saved test data from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTestData((prev) => {
          const merged = { ...prev };
          for (const key of Object.keys(merged) as TemplateId[]) {
            if (parsed[key]) merged[key] = { ...merged[key], ...parsed[key] };
          }
          return merged;
        });
      }
    } catch {}
    // Load saved send-to address
    const savedTo = localStorage.getItem("pf-email-test-to");
    if (savedTo) setSendingTo(savedTo);
  }, []);

  // Save test data to localStorage
  const saveTestData = useCallback((data: Record<TemplateId, Record<string, string>>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, []);

  const updateField = (template: TemplateId, key: string, value: string) => {
    setTestData((prev) => {
      const next = { ...prev, [template]: { ...prev[template], [key]: value } };
      saveTestData(next);
      return next;
    });
  };

  const handlePreview = async (template: TemplateId) => {
    setLoading(template);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          data: testData[template],
          render_only: true,
        }),
      });
      const json = await res.json();
      if (json.html) {
        setPreviewHtml(json.html);
        setPreviewSubject(json.subject || "");
        setPreviewTemplate(template);
      } else {
        setSendStatus((p) => ({ ...p, [template]: { ok: false, msg: json.error || "Preview failed" } }));
      }
    } catch (err: any) {
      setSendStatus((p) => ({ ...p, [template]: { ok: false, msg: err.message || "Preview failed" } }));
    } finally {
      setLoading(null);
    }
  };

  const handleSendTest = async (template: TemplateId) => {
    if (!sendingTo.trim()) return;
    localStorage.setItem("pf-email-test-to", sendingTo.trim());
    setLoading(template);
    setSendStatus((p) => ({ ...p, [template]: null }));
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendingTo.trim(),
          template,
          data: testData[template],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSendStatus((p) => ({
          ...p,
          [template]: { ok: true, msg: json.sent ? `Sent to ${sendingTo}` : "Logged (no Resend key)" },
        }));
      } else {
        setSendStatus((p) => ({ ...p, [template]: { ok: false, msg: json.error || "Send failed" } }));
      }
    } catch (err: any) {
      setSendStatus((p) => ({ ...p, [template]: { ok: false, msg: err.message || "Send failed" } }));
    } finally {
      setLoading(null);
    }
  };

  const resetToDefaults = (template: TemplateId) => {
    setTestData((prev) => {
      const next = { ...prev, [template]: { ...DEFAULT_TEST_DATA[template] } };
      saveTestData(next);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-base font-bold uppercase tracking-wider text-white">Email Templates</h2>
        <p className="mb-4 text-xs font-medium text-zinc-400">
          Preview and test all 7 PlanFlowAI lifecycle email templates. Test emails are sent via Resend.
        </p>
      </div>

      {/* Send-to address */}
      <div className={cardCls}>
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-cyan-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-white whitespace-nowrap">Test recipient:</span>
          <Input
            type="email"
            value={sendingTo}
            onChange={(e) => setSendingTo(e.target.value)}
            placeholder="you@example.com"
            className={`flex-1 ${inputCls}`}
          />
        </div>
      </div>

      {/* Template cards */}
      {TEMPLATES.map((t) => {
        const isExpanded = expandedTemplate === t.id;
        const status = sendStatus[t.id];
        const isLoading = loading === t.id;
        const data = testData[t.id];
        const fields = Object.keys(data);

        return (
          <div key={t.id} className={cardCls}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpandedTemplate(isExpanded ? null : t.id)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{t.label}</div>
                  <div className="text-xs text-zinc-400 truncate">{t.desc}</div>
                </div>
              </button>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(t.id)}
                  disabled={isLoading}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs"
                >
                  {isLoading && loading === t.id && !sendingTo ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Eye className="h-3 w-3 mr-1" />
                  )}
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSendTest(t.id)}
                  disabled={isLoading || !sendingTo.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  Send Test
                </Button>
              </div>
            </div>

            {/* Status message */}
            {status && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${status.ok ? "text-emerald-400" : "text-red-400"}`}>
                {status.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {status.msg}
              </div>
            )}

            {/* Expanded: editable test data */}
            {isExpanded && (
              <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Test Data</span>
                  <button
                    onClick={() => resetToDefaults(t.id)}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Reset to defaults
                  </button>
                </div>
                {fields.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400 w-32 flex-shrink-0 text-right font-mono">{key}</label>
                    <Input
                      value={data[key]}
                      onChange={(e) => updateField(t.id, key, e.target.value)}
                      className={`flex-1 text-xs ${inputCls}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/90">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">
                  {TEMPLATES.find((t) => t.id === previewTemplate)?.label || "Preview"}
                </div>
                <div className="text-xs text-zinc-400 truncate">{previewSubject}</div>
              </div>
              <button
                onClick={() => { setPreviewHtml(null); setPreviewTemplate(null); }}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Iframe preview */}
            <div className="flex-1 overflow-auto bg-[#1A1A2E]">
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full border-0"
                style={{ minHeight: "600px", height: "100%" }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
