"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Rocket,
  Globe,
  Mail,
  User,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  TOGGLE_INFO,
  DEFAULT_TOGGLES,
  type ProjectToggles,
} from "@/lib/types/project";

/* ─── Package tiers ─── */

interface PackageTier {
  id: string;
  name: string;
  price: string;
  color: string;
  description: string;
  toggleKeys: (keyof ProjectToggles)[];
}

const PACKAGES: PackageTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$500",
    color: "#22c55e",
    description: "Clean, fast website with SEO and privacy compliance.",
    toggleKeys: ["seo", "privacy"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$750",
    color: "#667eea",
    description: "Full-featured site with accessibility, analytics, and SEO.",
    toggleKeys: ["seo", "accessibility", "privacy", "analytics"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$1,000+",
    color: "#f59e0b",
    description: "Everything — security hardening, performance tuning, and revision tracking.",
    toggleKeys: ["seo", "accessibility", "privacy", "analytics", "security", "performance", "punchList"],
  },
];

/* ─── Progress step type from streaming API ─── */

interface ProgressLine {
  step: string;
  status: "running" | "done" | "error" | "skip";
  detail?: string;
  deployUrls?: { github: string; vercel: string; netlify: string; cloudflare: string };
  projectPath?: string;
}

const STEP_LABELS: Record<string, string> = {
  folder: "Creating project folder",
  hello: "Generating coming soon page",
  config: "Writing project.json",
  hosting: "Writing deploy configs",
  git: "Initializing git repository",
  github: "Creating GitHub repository",
  vercel: "Deploying to Vercel",
  netlify: "Deploying to Netlify",
  cloudflare: "Deploying to Cloudflare Pages",
  finalize: "Saving deploy URLs",
};

/* ─── Component ─── */

export default function NewProjectWizard({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (projectPath: string, projectName: string) => void;
}) {
  // Step state
  const [step, setStep] = useState(0);

  // Step 1: Client info
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [domain, setDomain] = useState("");

  // Step 2: Package & toggles
  const [selectedPackage, setSelectedPackage] = useState<string>("professional");
  const [toggles, setToggles] = useState<ProjectToggles>({ ...DEFAULT_TOGGLES });

  // Step 3/4: Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<ProgressLine[]>([]);
  const [finalResult, setFinalResult] = useState<{
    projectPath: string;
    deployUrls: { github: string; vercel: string; netlify: string; cloudflare: string };
  } | null>(null);
  const [fatalError, setFatalError] = useState("");
  const progressRef = useRef<HTMLDivElement>(null);

  // Auto-scroll progress
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [progress]);

  // Reset on close
  const handleClose = useCallback(() => {
    if (isCreating) return; // Don't allow close during creation
    setStep(0);
    setProjectName("");
    setClientName("");
    setClientEmail("");
    setDomain("");
    setSelectedPackage("professional");
    setToggles({ ...DEFAULT_TOGGLES });
    setProgress([]);
    setFinalResult(null);
    setFatalError("");
    onClose();
  }, [isCreating, onClose]);

  // When package changes, update toggles
  const handlePackageSelect = useCallback((pkg: PackageTier) => {
    setSelectedPackage(pkg.id);
    const newToggles: ProjectToggles = {
      seo: false,
      accessibility: false,
      privacy: false,
      analytics: false,
      security: false,
      performance: false,
      punchList: false,
    };
    for (const key of pkg.toggleKeys) {
      newToggles[key] = true;
    }
    setToggles(newToggles);
  }, []);

  // Toggle individual
  const toggleOne = useCallback((key: keyof ProjectToggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setSelectedPackage("custom");
  }, []);

  // Step 4: Create project
  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    setStep(3);
    setProgress([]);
    setFinalResult(null);
    setFatalError("");

    try {
      const res = await fetch("/api/project/create-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          clientName: clientName.trim() || undefined,
          clientEmail: clientEmail.trim() || undefined,
          domain: domain.trim() || undefined,
          toggles,
          packageTier: selectedPackage,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setFatalError(err.error || `HTTP ${res.status}`);
        setIsCreating(false);
        return;
      }

      // Read streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as ProgressLine;
            if (parsed.step === "__done__") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = parsed as any;
              setFinalResult({
                projectPath: d.projectPath || "",
                deployUrls: d.deployUrls || { github: "", vercel: "", netlify: "", cloudflare: "" },
              });
            } else if (parsed.step === "__error__") {
              setFatalError(parsed.detail || "Unknown error");
            } else {
              setProgress((prev) => {
                // Replace running step or append new
                const existing = prev.findIndex((p) => p.step === parsed.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = parsed;
                  return updated;
                }
                return [...prev, parsed];
              });
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      setFatalError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsCreating(false);
    }
  }, [projectName, clientName, clientEmail, domain, toggles, selectedPackage]);

  // Open in builder after creation
  const handleOpenInBuilder = useCallback(() => {
    if (finalResult?.projectPath) {
      onCreated?.(finalResult.projectPath, projectName.trim());
    }
    handleClose();
  }, [finalResult, projectName, onCreated, handleClose]);

  if (!isOpen) return null;

  const activeToggles = Object.entries(toggles).filter(([, v]) => v).length;
  const canProceedStep0 = projectName.trim().length > 0;
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isCreating) handleClose();
      }}
    >
      <div
        className="relative w-[720px] max-w-[95vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "#12121e",
          border: "1px solid rgba(102,126,234,0.2)",
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}
            >
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">New Project</h2>
              <p className="text-xs text-zinc-500">
                {step === 0 && "Client info"}
                {step === 1 && "Package & features"}
                {step === 2 && "Review & confirm"}
                {step === 3 && (finalResult ? "Ready!" : "Creating...")}
              </p>
            </div>
          </div>
          {!isCreating && (
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 px-7 py-3 border-b border-zinc-800/60">
          {["Client Info", "Package", "Confirm", "Create"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
                style={{
                  background:
                    i < step
                      ? "#22c55e"
                      : i === step
                        ? "linear-gradient(135deg, #667eea, #764ba2)"
                        : "#27272a",
                  color: i <= step ? "#fff" : "#52525b",
                }}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className="text-xs font-medium truncate"
                style={{ color: i <= step ? "#e2e8f0" : "#52525b" }}
              >
                {label}
              </span>
              {i < 3 && (
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0"
                  style={{ color: i < step ? "#22c55e" : "#3f3f46" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* Step 0: Client Info */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  <FileText className="inline h-4 w-4 mr-1.5 text-indigo-400" />
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Sarah's Photography"
                  autoFocus
                  className="w-full px-4 py-3 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                />
                {slug && (
                  <p className="text-xs text-zinc-600 mt-1.5">
                    Folder: <span className="text-zinc-400 font-mono">{slug}/</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  <User className="inline h-4 w-4 mr-1.5 text-emerald-400" />
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sarah Brockman"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  <Mail className="inline h-4 w-4 mr-1.5 text-amber-400" />
                  Client Email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  <Globe className="inline h-4 w-4 mr-1.5 text-purple-400" />
                  Domain (optional)
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. sarahphotos.com"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          )}

          {/* Step 1: Package & Toggles */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Package cards */}
              <div>
                <p className="text-sm font-semibold text-zinc-300 mb-3">Choose a Package</p>
                <div className="grid grid-cols-3 gap-3">
                  {PACKAGES.map((pkg) => {
                    const isActive = selectedPackage === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => handlePackageSelect(pkg)}
                        className="relative flex flex-col p-5 rounded-xl border-2 text-left transition-all"
                        style={{
                          borderColor: isActive ? pkg.color : "#27272a",
                          background: isActive ? `${pkg.color}10` : "#18181b",
                        }}
                      >
                        {isActive && (
                          <div
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: pkg.color }}
                          >
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <span
                          className="text-2xl font-extrabold mb-1"
                          style={{ color: pkg.color }}
                        >
                          {pkg.price}
                        </span>
                        <span className="text-sm font-bold text-zinc-200">{pkg.name}</span>
                        <span className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          {pkg.description}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-3">
                          {pkg.toggleKeys.map((key) => {
                            const info = TOGGLE_INFO.find((t) => t.key === key);
                            return (
                              <span
                                key={key}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                                style={{
                                  color: info?.color || "#888",
                                  background: `${info?.color || "#888"}20`,
                                }}
                              >
                                {info?.label.split(" ")[0] || key}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Individual toggles */}
              <div>
                <p className="text-sm font-semibold text-zinc-300 mb-3">
                  Fine-tune Features
                  <span className="text-xs font-normal text-zinc-500 ml-2">
                    {activeToggles} of 7 active
                  </span>
                </p>
                <div className="space-y-2">
                  {TOGGLE_INFO.map((info) => {
                    const key = info.key as keyof ProjectToggles;
                    const isOn = toggles[key];
                    return (
                      <button
                        key={info.key}
                        onClick={() => toggleOne(key)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                        style={{
                          borderColor: isOn ? `${info.color}40` : "#27272a",
                          background: isOn ? `${info.color}08` : "transparent",
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors"
                          style={{
                            borderColor: isOn ? info.color : "#52525b",
                            background: isOn ? info.color : "transparent",
                          }}
                        >
                          {isOn && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: info.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-zinc-200">{info.label}</span>
                          <p className="text-xs text-zinc-500">{info.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Confirmation */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-5 space-y-4">
                <h3 className="text-base font-bold text-white">Project Summary</h3>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Project</span>
                    <p className="text-zinc-100 font-semibold">{projectName}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Folder</span>
                    <p className="text-zinc-100 font-mono text-xs">{slug}/</p>
                  </div>
                  {clientName && (
                    <div>
                      <span className="text-zinc-500">Client</span>
                      <p className="text-zinc-100">{clientName}</p>
                    </div>
                  )}
                  {clientEmail && (
                    <div>
                      <span className="text-zinc-500">Email</span>
                      <p className="text-zinc-100">{clientEmail}</p>
                    </div>
                  )}
                  {domain && (
                    <div>
                      <span className="text-zinc-500">Domain</span>
                      <p className="text-zinc-100">{domain}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">Package</span>
                    <p className="text-zinc-100 font-semibold">
                      {PACKAGES.find((p) => p.id === selectedPackage)?.name || "Custom"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-700/40 pt-3">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Active Features ({activeToggles})
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TOGGLE_INFO.filter((t) => toggles[t.key as keyof ProjectToggles]).map((info) => (
                      <span
                        key={info.key}
                        className="px-3 py-1 text-xs font-bold rounded-full"
                        style={{
                          color: info.color,
                          background: `${info.color}18`,
                          border: `1px solid ${info.color}30`,
                        }}
                      >
                        {info.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <p className="text-sm font-semibold text-indigo-300 mb-2">On Create:</p>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Create project folder at L:/AI_MASTER_BUILDS/{slug}/
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Generate professional coming soon page
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Save project.json with toggle config
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Deploy to GitHub, Vercel, Netlify, and Cloudflare
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Open project in the builder
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 3: Creating (streaming progress) */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Progress steps */}
              <div ref={progressRef} className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {progress.map((p) => (
                  <div
                    key={p.step}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border transition-all"
                    style={{
                      borderColor:
                        p.status === "done"
                          ? "rgba(34,197,94,0.2)"
                          : p.status === "error"
                            ? "rgba(239,68,68,0.2)"
                            : p.status === "skip"
                              ? "rgba(107,114,128,0.2)"
                              : "rgba(102,126,234,0.2)",
                      background:
                        p.status === "done"
                          ? "rgba(34,197,94,0.05)"
                          : p.status === "error"
                            ? "rgba(239,68,68,0.05)"
                            : p.status === "skip"
                              ? "rgba(107,114,128,0.05)"
                              : "rgba(102,126,234,0.05)",
                    }}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {p.status === "running" && (
                        <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                      )}
                      {p.status === "done" && (
                        <Check className="h-4 w-4 text-emerald-400" />
                      )}
                      {p.status === "error" && (
                        <X className="h-4 w-4 text-red-400" />
                      )}
                      {p.status === "skip" && (
                        <span className="block w-4 h-4 rounded-full bg-zinc-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200">
                        {STEP_LABELS[p.step] || p.step}
                      </p>
                      {p.detail && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.detail}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Waiting indicator */}
                {isCreating && progress.length === 0 && (
                  <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Starting...</span>
                  </div>
                )}
              </div>

              {/* Fatal error */}
              {fatalError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4">
                  <p className="text-sm font-semibold text-red-300">Error</p>
                  <p className="text-xs text-red-400 mt-1">{fatalError}</p>
                </div>
              )}

              {/* Success: Deploy URLs */}
              {finalResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-emerald-300">Project Created!</p>
                      <p className="text-xs text-zinc-500">{finalResult.projectPath}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["GitHub", finalResult.deployUrls.github, "#e2e8f0"],
                      ["Vercel", finalResult.deployUrls.vercel, "#e2e8f0"],
                      ["Netlify", finalResult.deployUrls.netlify, "#00c7b7"],
                      ["Cloudflare", finalResult.deployUrls.cloudflare, "#f6821f"],
                    ] as [string, string, string][]).map(([label, url, color]) =>
                      url ? (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-zinc-700/60 bg-zinc-900/50 hover:border-zinc-500 transition-colors group"
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5 flex-shrink-0 transition-colors"
                            style={{ color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-300">{label}</p>
                            <p className="text-[10px] text-zinc-600 truncate group-hover:text-zinc-400 transition-colors">
                              {url}
                            </p>
                          </div>
                        </a>
                      ) : (
                        <div
                          key={label}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30 opacity-50"
                        >
                          <span className="block w-3.5 h-3.5 rounded-full bg-zinc-700" />
                          <div>
                            <p className="text-xs font-bold text-zinc-500">{label}</p>
                            <p className="text-[10px] text-zinc-700">Skipped</p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-800">
          {/* Back button */}
          {step > 0 && step < 3 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Next / Create / Open */}
          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              disabled={!canProceedStep0}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canProceedStep0 ? "linear-gradient(135deg, #667eea, #764ba2)" : "#27272a" }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
            >
              <Rocket className="h-4 w-4" />
              Create & Deploy
            </button>
          )}
          {step === 3 && finalResult && (
            <button
              onClick={handleOpenInBuilder}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}
            >
              Open in Builder
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 3 && !finalResult && !fatalError && <div />}
          {step === 3 && fatalError && (
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
