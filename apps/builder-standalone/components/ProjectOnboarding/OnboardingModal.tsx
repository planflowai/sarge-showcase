"use client";

import { useState, useCallback } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Folder,
  User,
  Mail,
  Globe,
  Check,
  Loader2,
} from "lucide-react";
import { ToggleSelector } from "./ToggleSelector";
import {
  DEFAULT_TOGGLES,
  TOGGLE_INFO,
  type ProjectToggles,
} from "@/lib/types/project";

/* ── Template options ── */

const TEMPLATES = [
  { id: "none", name: "Blank", icon: "📄" },
  { id: "blank-html", name: "HTML5 Starter", icon: "🌐" },
  { id: "landing-page", name: "Landing Page", icon: "🚀" },
  { id: "multi-page", name: "Multi-Page Site", icon: "📚" },
  { id: "react-app", name: "React App", icon: "⚛️" },
  { id: "dashboard", name: "Dashboard", icon: "📊" },
  { id: "blog", name: "Blog", icon: "✍️" },
];

/* ── Props ── */

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectPath: string, projectName: string) => void;
}

/* ── Slugify ── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── Component ── */

export function OnboardingModal({
  isOpen,
  onClose,
  onCreated,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  // Step 1 fields
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [hasDomain, setHasDomain] = useState(false);
  const [domain, setDomain] = useState("");
  const [template, setTemplate] = useState("none");

  // Step 2 fields
  const [toggles, setToggles] = useState<ProjectToggles>({
    ...DEFAULT_TOGGLES,
  });

  // Step 3
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const slug = slugify(projectName);

  const reset = () => {
    setStep(0);
    setProjectName("");
    setClientName("");
    setClientEmail("");
    setHasDomain(false);
    setDomain("");
    setTemplate("none");
    setToggles({ ...DEFAULT_TOGGLES });
    setCreating(false);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/project/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          clientName,
          clientEmail,
          domain: hasDomain ? domain : "",
          toggles,
          template: template === "none" ? "blank-html" : template,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create project");
        setCreating(false);
        return;
      }

      onCreated(data.projectPath, data.projectName);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
      setCreating(false);
    }
  }, [
    projectName,
    clientName,
    clientEmail,
    domain,
    hasDomain,
    toggles,
    template,
    onCreated,
  ]);

  if (!isOpen) return null;

  const activeToggleCount = Object.values(toggles).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[600px] mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">New Project</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-3 border-b border-zinc-800/50">
          {["Project Info", "Features", "Confirm"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  i === step
                    ? "bg-[#FF6700] text-white"
                    : i < step
                    ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 cursor-pointer"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {i < step ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className="w-3 text-center">{i + 1}</span>
                )}
                <span>{label}</span>
              </button>
              {i < 2 && (
                <div
                  className={`w-8 h-px ${
                    i < step ? "bg-[#FF6700]" : "bg-zinc-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* ── Step 1: Project Info ── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Project name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Sarah's Bookkeeping"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF6700] focus:border-[#FF6700]"
                    autoFocus
                  />
                </div>
                {projectName && (
                  <p className="mt-1 text-xs text-zinc-300 font-mono">
                    Folder: {slug}/
                  </p>
                )}
              </div>

              {/* Client name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Client Name{" "}
                  <span className="text-zinc-300 text-xs">(optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Sarah Johnson"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                  />
                </div>
              </div>

              {/* Client email */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Client Email{" "}
                  <span className="text-zinc-300 text-xs">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="sarah@email.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                  />
                </div>
              </div>

              {/* Custom domain */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-zinc-300">
                    Custom Domain
                  </label>
                  <button
                    type="button"
                    onClick={() => setHasDomain(!hasDomain)}
                    className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                      hasDomain ? "bg-[#FF6700]" : "bg-zinc-700"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${
                        hasDomain ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {hasDomain && (
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="sarahbookkeeping.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                    />
                  </div>
                )}
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Template
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center ${
                        template === t.id
                          ? "bg-[#FF6700]/15 border-[#FF6700]/60 text-white"
                          : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-[11px] font-medium leading-tight">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Feature Toggles ── */}
          {step === 1 && (
            <ToggleSelector toggles={toggles} onChange={setToggles} />
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                Project Summary
              </h3>

              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
                {/* Name */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Project</span>
                  <span className="text-sm font-bold text-white">{slug}</span>
                </div>

                {/* Client */}
                {clientName && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300">Client</span>
                    <span className="text-sm text-zinc-300">{clientName}</span>
                  </div>
                )}

                {/* Email */}
                {clientEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300">Email</span>
                    <span className="text-sm text-zinc-300 font-mono">
                      {clientEmail}
                    </span>
                  </div>
                )}

                {/* Domain */}
                {hasDomain && domain && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300">Domain</span>
                    <span className="text-sm text-zinc-300 font-mono">
                      {domain}
                    </span>
                  </div>
                )}

                {/* Template */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Template</span>
                  <span className="text-sm text-zinc-300">
                    {TEMPLATES.find((t) => t.id === template)?.name || "Blank"}
                  </span>
                </div>

                {/* Toggles */}
                <div className="border-t border-zinc-700 pt-3">
                  <span className="text-xs text-zinc-300 block mb-2">
                    Features ({activeToggleCount})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {TOGGLE_INFO.filter((t: any) => toggles[t.key]).map((t: any) => (
                      <span
                        key={t.key}
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${t.color}20`,
                          color: t.color,
                        }}
                      >
                        {t.label}
                      </span>
                    ))}
                    {activeToggleCount === 0 && (
                      <span className="text-xs text-zinc-300">
                        No features selected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* What will happen */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-300 font-medium mb-2">
                  On create:
                </p>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500" />
                    Create project folder with template files
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500" />
                    Initialize git repository
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500" />
                    Save project.json with metadata
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500" />
                    Create GitHub repo (if token configured)
                  </li>
                  {toggles.seo && (
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-500" />
                      Generate robots.txt + sitemap.xml
                    </li>
                  )}
                  {toggles.privacy && (
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-purple-500" />
                      Generate privacy policy page
                    </li>
                  )}
                </ul>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          {/* Left: Back or Cancel */}
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Right: Next or Create */}
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !projectName.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#FF6700" }}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !projectName.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: creating ? "#b34500" : "#FF6700" }}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
