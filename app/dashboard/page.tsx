"use client";

// ─── Constants ────────────────────────────────────────────────────────────────
const FOOTER_TAGLINE = "S.A.R.G.E. Platform Architecture · Built in 7 Weeks · One Person · Zero Prior Coding Experience";
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
/** Update these when adding new API routes or stores */
const API_ROUTES_COUNT = 28;
const STORES_COUNT = "20+";

// ─── Module data (source of truth for Modules stat) ────────────────────────
const MODULES_DATA: Array<{
  id: string; icon: string; name: string; desc: string; color: string; tags: string[]; route: string;
}> = [
  { id: "chat",        icon: "💬", name: "Chat",            desc: "Multi-model conversations with streaming, voice, Architect Mode",               color: "blue",    tags: ["ChatView", "InputArea", "VoiceButton"], route: "/" },
  { id: "builder",    icon: "🔨", name: "AI Builder",      desc: "Visual code gen, live preview, file ops, apply/reject, diff view",              color: "purple",  tags: ["Monaco", "Preview", "FileTree", "Terminal"], route: "/builder" },
  { id: "debate",     icon: "⚔️", name: "Debate Arena",    desc: "Multi-agent debates with judge, executive summaries",                           color: "orange",  tags: ["DebateView", "Judge", "Export"], route: "/" },
  { id: "batch",      icon: "📊", name: "Batch Processing",desc: "Parallel model comparison, side-by-side responses",                            color: "green",   tags: ["BatchView", "ModelBar", "Console"], route: "/" },
  { id: "test",       icon: "🧪", name: "Test Mode",       desc: "A/B testing, echo detection, poison pill, D1/D2/D3 tribunal",                  color: "red",     tags: ["Tribunal", "PoisonPill", "Echo"], route: "/" },
  { id: "journal",    icon: "📓", name: "Prompt Journal",  desc: "3-column layout, effectiveness ratings, AI analysis",                          color: "amber",   tags: ["Notepad", "Analyzer", "History"], route: "/journal" },
  { id: "optimize",   icon: "⚡", name: "Prompt Optimizer",desc: "AI refinement, logic optimization, debate templates",                          color: "pink",    tags: ["AI Opt", "Logic Opt"], route: "/optimize" },
  { id: "live-checker",icon: "🔍",name: "Live Checker",    desc: "Real-time fact verification, Tavily web search",                              color: "cyan",    tags: ["Tavily", "MultiAgent"], route: "/live-checker" },
  { id: "real-world", icon: "🏢", name: "Real World",      desc: "Business doc simulator, truth anchors, scorecard",                            color: "emerald", tags: ["Generator", "Pipeline"], route: "/real-world" },
  { id: "review",     icon: "📋", name: "Review",          desc: "Batch results analysis, verdict/evidence panels",                              color: "indigo",  tags: ["Verdict", "Evidence", "Lifecycle"], route: "/review" },
  { id: "forensic",   icon: "🔗", name: "Forensic Log",    desc: "Blockchain hash chain, timeline/investigation/replay",                        color: "rose",    tags: ["HashChain", "Replay", "Export"], route: "/" },
  { id: "library",    icon: "📚", name: "Prompt Library",  desc: "Test library, poison pills, tier organization",                               color: "teal",    tags: ["Tiers", "Search"], route: "/library" },
  { id: "diagnostics",icon: "🔧", name: "Diagnostics",     desc: "Self-healing: scan, analyze, fix, rollback with AI",                          color: "yellow",  tags: ["Scanner", "AI Fix", "Rollback"], route: "/diagnostics" },
  { id: "ai-analysis",icon: "🧠", name: "AI Analysis",     desc: "Multi-tool analysis: chat, debate, test, batch",                              color: "indigo",  tags: ["6 Sub-tabs"], route: "/ai-analysis" },
  { id: "settings",   icon: "⚙️", name: "Settings",        desc: "Providers, models, roles, vault, security PIN",                               color: "gray",    tags: ["Registry", "RollCall", "PIN"], route: "/settings" },
  { id: "vault",      icon: "🗄️", name: "Vault",           desc: "Knowledge base, file management, 50MB storage",                              color: "teal",    tags: ["Upload", "Preview", "Attach"], route: "/settings" },
];

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { providers } from "@/lib/providers";
import { useModelStore } from "@/lib/stores/modelStore";
import { supabase } from "@/lib/supabase/client";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { useAirGapStore } from "@/lib/stores/airGapStore";
import { useThreadGuardianStore } from "@/lib/stores/threadGuardianStore";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  const router = useRouter();
  const openDebate = useDebateStore((s) => s.openDebate);
  const openTestMode = useTestModeStore((s) => s.openTestMode);
  const openBatchMode = useTestModeStore((s) => s.openBatchMode);
  const openForensicLog = useForensicLogStore((s) => s.openForensicLog);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const guardianEnabled = useThreadGuardianStore((s) => s.enabled);
  const activeConversationId = useThreadGuardianStore((s) => s.activeConversationId);
  const getGuardianStats = useThreadGuardianStore((s) => s.getStats);
  const guardianStats = activeConversationId ? getGuardianStats(activeConversationId) : null;
  const { hydrated, hydrate, getEffectiveModels } = useModelStore();

  const [status, setStatus] = useState({
    supabase: null as boolean | null,
    ollama: null as boolean | null,
    ollamaModels: [] as string[],
    apiKeys: {} as Record<string, boolean>,
  });

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    const cloud = providers.filter((p) => p.type === "cloud");

    supabase.auth.getSession()
      .then(() => setStatus((s) => ({ ...s, supabase: true })))
      .catch(() => setStatus((s) => ({ ...s, supabase: false })));

    fetch(`${OLLAMA_URL}/api/tags`)
      .then((r) => r.json())
      .then((d) => setStatus((s) => ({ ...s, ollama: true, ollamaModels: (d?.models || []).map((m: any) => m.name) })))
      .catch(() => setStatus((s) => ({ ...s, ollama: false })));

    (async () => {
      const keys: Record<string, boolean> = {};
      for (const p of cloud) {
        try {
          const r = await fetch(`/api/status?provider=${p.id}`);
          const d = await r.json();
          keys[p.id] = d.hasKey ?? false;
        } catch {
          keys[p.id] = false;
        }
      }
      setStatus((s) => ({ ...s, apiKeys: keys }));
    })();
  }, []);

  const handleClick = (id: string, route: string) => {
    if (id === "debate") { router.push("/"); setTimeout(openDebate, 100); return; }
    if (id === "batch") { router.push("/"); setTimeout(openBatchMode, 100); return; }
    if (id === "test") { router.push("/"); setTimeout(openTestMode, 100); return; }
    if (id === "forensic") { router.push("/"); setTimeout(openForensicLog, 100); return; }
    router.push(route);
  };

  const cloudProviders = providers.filter((p) => p.type === "cloud");
  const getModels = (id: string) => hydrated ? getEffectiveModels(id) : [];
  const totalCloud = cloudProviders.reduce((s, p) => s + getModels(p.id).length, 0);
  const totalModels = totalCloud + status.ollamaModels.length;

  return (
    <ErrorBoundary fallbackTitle="Dashboard Error">
      <div className="h-full overflow-hidden bg-background text-foreground relative font-semibold">
        {/* Animated grid background */}
        <div
          className="absolute inset-0 z-0 animate-grid-move dark:opacity-100 opacity-30"
          style={{
            background: `
              linear-gradient(rgba(120, 80, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(120, 80, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 w-full px-4 py-2">
          {/* Run Demo Button - Upper Right */}
          <button
            onClick={() => router.push("/demo")}
            className="absolute top-2 right-4 z-20 w-24 h-16 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-300 via-slate-400 to-zinc-500 hover:from-zinc-200 hover:via-slate-300 hover:to-zinc-400 text-zinc-800 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl border border-zinc-400/50"
            title="Run Demo"
          >
            <span className="text-2xl">🎬</span>
            <span className="text-[10px] font-black tracking-wider">DEMO</span>
          </button>

          {/* Header */}
          <div className="text-center mb-4 relative">
            <h1 className="text-4xl font-black tracking-[6px] bg-gradient-to-r from-[#a78bfa] via-[#7c3aed] to-[#06b6d4] bg-clip-text text-transparent mb-1">
              S.A.R.G.E.
            </h1>
            <div className="text-sm text-muted-foreground tracking-[3px] uppercase font-bold">
              Synthetic Adversarial Reasoning & Guarding Engine
            </div>
            <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[150px] h-[2px] bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent" />
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-10 mb-4">
            <Stat value={MODULES_DATA.length} label="Modules" />
            <Stat value={totalModels} label="Models" />
            <Stat value={providers.length} label="Providers" />
            <Stat value={API_ROUTES_COUNT} label="API Routes" />
            <Stat value={STORES_COUNT} label="Stores" />
          </div>

          {/* Presentation Layer */}
          <Section title="Presentation Layer" subtitle="User Interface" color="#7c3aed" />
          <div className="grid grid-cols-4 gap-3 mb-4">
            {MODULES_DATA.map((m) => (
              <Module
                key={m.id}
                icon={m.icon}
                name={m.name}
                desc={m.desc}
                color={m.color}
                tags={m.tags}
                onClick={() => handleClick(m.id, m.route)}
              />
            ))}
          </div>

          {/* Provider Layer */}
          <Section title="Provider Layer" subtitle="AI Models" color="#f59e0b" />
          <div className="grid grid-cols-6 gap-3 mb-4">
            <Provider icon="🧠" name="Claude" color="#f97316" models="Opus 4 · Sonnet 4.5 · Haiku" active={status.apiKeys["anthropic"]} />
            <Provider icon="✨" name="GPT" color="#22c55e" models="GPT-4o · GPT-4o Mini · Turbo" active={status.apiKeys["openai"]} />
            <Provider icon="💎" name="Gemini" color="#3b82f6" models="2.0 Flash · 2.5 Pro · Flash" active={status.apiKeys["google"]} />
            <Provider icon="⚡" name="Grok" color="#ef4444" models="Grok 3 · 3 Fast · Reasoning" active={status.apiKeys["xai"]} />
            <Provider icon="🔮" name="DeepSeek" color="#8b5cf6" models="V3 Chat · V3 Reasoner" active={status.apiKeys["deepseek"]} />
            <Provider icon="🦙" name="Ollama" color="#6b7280" models={`${status.ollamaModels.length} local models`} active={status.ollama ?? false} />
          </div>

          {/* Security Layer */}
          <Section title="Security & Infrastructure" color="#f43f5e" />
          <div className="grid grid-cols-5 gap-3 mb-3">
            <Module icon="🛡️" name="Air Gap Mode" desc="Block all cloud APIs. Ollama-only operation. Full network isolation." color="red" tags={["airGapStore", "Toggle"]} />
            <Module icon="🔐" name="Path Security" desc="Builder sandboxed to project dir. No traversal. Command blocking." color="rose" tags={["pathValidator", "Forensic"]} />
            <Module icon="🔑" name="Session Security" desc="PIN lock with SHA-256. Auto-lock timeout. Encrypted storage." color="amber" tags={["pinStore", "SHA-256"]} />
            <Module icon="☁️" name="Supabase Sync" desc="Durable backend. Forensic sync. Conversation backup. Air-gap aware." color="emerald" tags={["RLS", "Realtime"]} />
            <GuardianCard enabled={guardianEnabled} stats={guardianStats ? {
              activeConversations: 1,
              totalFacts: guardianStats.factCount,
              totalContradictions: guardianStats.contradictionCount,
              totalHallucinations: guardianStats.hallucinationCount,
            } : { activeConversations: 0, totalFacts: 0, totalContradictions: 0, totalHallucinations: 0 }} onClick={() => handleClick("settings", "/settings")} />
          </div>

          {/* Footer */}
          <div className="text-center mt-2 pt-2 border-t border-border text-sm text-muted-foreground tracking-[2px] font-black">
            {FOOTER_TAGLINE}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        .animate-grid-move {
          animation: grid-move 20s linear infinite;
        }
      `}</style>
    </ErrorBoundary>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black bg-gradient-to-r from-[#a78bfa] to-[#06b6d4] bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground tracking-[2px] uppercase font-black">{label}</div>
    </div>
  );
}

function Section({ title, subtitle, color }: { title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-6 h-[2px]" style={{ backgroundColor: color }} />
      <h2 className="text-sm font-black tracking-[2px] uppercase" style={{ color }}>{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground font-bold">— {subtitle}</span>}
    </div>
  );
}

const colorMap: Record<string, { border: string; name: string }> = {
  blue: { border: "linear-gradient(90deg, #3b82f6, #1d4ed8)", name: "#60a5fa" },
  purple: { border: "linear-gradient(90deg, #8b5cf6, #6d28d9)", name: "#a78bfa" },
  orange: { border: "linear-gradient(90deg, #f97316, #ea580c)", name: "#fb923c" },
  green: { border: "linear-gradient(90deg, #22c55e, #16a34a)", name: "#4ade80" },
  red: { border: "linear-gradient(90deg, #ef4444, #dc2626)", name: "#f87171" },
  amber: { border: "linear-gradient(90deg, #f59e0b, #d97706)", name: "#fbbf24" },
  pink: { border: "linear-gradient(90deg, #ec4899, #db2777)", name: "#f472b6" },
  cyan: { border: "linear-gradient(90deg, #06b6d4, #0891b2)", name: "#22d3ee" },
  emerald: { border: "linear-gradient(90deg, #10b981, #059669)", name: "#34d399" },
  indigo: { border: "linear-gradient(90deg, #6366f1, #4f46e5)", name: "#818cf8" },
  rose: { border: "linear-gradient(90deg, #f43f5e, #e11d48)", name: "#fb7185" },
  teal: { border: "linear-gradient(90deg, #14b8a6, #0d9488)", name: "#2dd4bf" },
  yellow: { border: "linear-gradient(90deg, #eab308, #ca8a04)", name: "#facc15" },
  gray: { border: "linear-gradient(90deg, #6b7280, #4b5563)", name: "#9ca3af" },
};

function Module({ icon, name, desc, color, tags, onClick }: {
  icon: string; name: string; desc: string; color: string; tags: string[]; onClick?: () => void
}) {
  const c = colorMap[color] || colorMap.gray;
  return (
    <button
      onClick={onClick}
      className="text-left p-3.5 rounded-lg bg-card border border-border backdrop-blur-sm transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: c.border }} />
      <span className="text-2xl block mb-1.5 text-center">{icon}</span>
      <div className="text-sm font-black tracking-[1px] mb-1 text-center" style={{ color: c.name }}>{name}</div>
      <div className="text-[11px] text-muted-foreground leading-tight mb-2 line-clamp-2 font-bold">{desc}</div>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black">{t}</span>
        ))}
      </div>
    </button>
  );
}

function Provider({ icon, name, color, models, active }: {
  icon: string; name: string; color: string; models: string; active: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3.5 text-center transition-all hover:border-primary/30 hover:-translate-y-0.5">
      <div className="text-2xl mb-1.5">{icon}</div>
      <div className="text-xs font-black tracking-[1px] mb-1" style={{ color }}>
        {name}
        {active && <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
      </div>
      <div className="text-[10px] text-muted-foreground font-bold">{models}</div>
    </div>
  );
}

function GuardianCard({ enabled, stats, onClick }: {
  enabled: boolean;
  stats: { activeConversations: number; totalFacts: number; totalContradictions: number; totalHallucinations: number };
  onClick?: () => void;
}) {
  const c = colorMap.indigo;
  return (
    <button
      onClick={onClick}
      className="text-left p-3.5 rounded-lg bg-card border border-border backdrop-blur-sm transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: c.border }} />
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xl">🛡️</span>
        {enabled && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        )}
      </div>
      <div className="text-sm font-black tracking-[1px] mb-1" style={{ color: c.name }}>Thread Guardian</div>
      <div className="text-[11px] text-muted-foreground leading-tight mb-2 font-bold">
        {enabled
          ? `${stats.activeConversations} thread${stats.activeConversations !== 1 ? "s" : ""} · ${stats.totalFacts} facts · ${stats.totalContradictions + stats.totalHallucinations} flags`
          : "Background conversation maintenance. Disabled."}
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black">3-Tier</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black">Phi/Opus</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black">SavePts</span>
      </div>
    </button>
  );
}
