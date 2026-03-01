"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Rocket,
  ShieldCheck,
  Zap,
  MessageSquare,
  Code2,
  Swords,
  FlaskConical,
  ArrowRight,
  Brain,
  ExternalLink,
  Mail,
  X,
  Check,
  AlertTriangle,
  Search,
  FileCode,
  Eye,
  Send,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Module icons and colors for Step 3
const MODULES = [
  { icon: "💬", name: "Chat", color: "#3b82f6" },
  { icon: "🔨", name: "AI Builder", color: "#8b5cf6" },
  { icon: "⚔️", name: "Debate Arena", color: "#f97316" },
  { icon: "📊", name: "Batch Mode", color: "#22c55e" },
  { icon: "🧪", name: "Test Mode", color: "#ef4444" },
  { icon: "📓", name: "Journal", color: "#f59e0b" },
  { icon: "⚡", name: "Optimizer", color: "#ec4899" },
  { icon: "🔍", name: "Live Checker", color: "#06b6d4" },
  { icon: "🏢", name: "Real World", color: "#10b981" },
  { icon: "📋", name: "Review", color: "#6366f1" },
  { icon: "🔗", name: "Forensic Log", color: "#f43f5e" },
  { icon: "📚", name: "Library", color: "#14b8a6" },
  { icon: "🔧", name: "Diagnostics", color: "#eab308" },
  { icon: "🧠", name: "AI Analysis", color: "#818cf8" },
  { icon: "⚙️", name: "Settings", color: "#6b7280" },
  { icon: "🗄️", name: "Vault", color: "#2dd4bf" },
];

// Provider data for Step 13
const PROVIDERS = [
  { icon: "🧠", name: "Claude", color: "#f97316", models: 5 },
  { icon: "✨", name: "GPT", color: "#22c55e", models: 4 },
  { icon: "💎", name: "Gemini", color: "#3b82f6", models: 3 },
  { icon: "⚡", name: "Grok", color: "#ef4444", models: 5 },
  { icon: "🔮", name: "DeepSeek", color: "#8b5cf6", models: 2 },
  { icon: "🦙", name: "Ollama", color: "#6b7280", models: 28 },
];

// Pipeline flows for Step 11
const PIPELINES = [
  { from: "Architect", to: "Builder", color: "#8b5cf6" },
  { from: "Debate", to: "Builder", color: "#f97316" },
  { from: "Forensic", to: "Diagnostics", color: "#f43f5e" },
  { from: "Test", to: "Review", color: "#ef4444" },
  { from: "Vault", to: "Chat", color: "#14b8a6" },
];

// Engine nodes for the radial diagram
const ENGINE_NODES = [
  { name: "Chat", angle: 0 },
  { name: "Architect", angle: 36 },
  { name: "Builder", angle: 72 },
  { name: "Debate", angle: 108 },
  { name: "Tribunal", angle: 144 },
  { name: "Batch", angle: 180 },
  { name: "Live Checker", angle: 216 },
  { name: "Diagnostics", angle: 252 },
  { name: "Forensic", angle: 288 },
  { name: "Real World", angle: 324 },
];

// Simulated slide indices (these don't auto-advance, user controls them)
const SIMULATED_SLIDES = [4, 5, 6, 7, 8, 9];

// Timing constants (in milliseconds) - NO API CALLS, all pre-scripted
// TARGET: 3:00 (180 seconds) total demo - ORIGINAL TIMING
const TIMING = {
  architect: {
    totalDuration: 15000,        // 15s
    promptTypingSpeed: 50,
    responseTypingSpeed: 20,
    promptStartDelay: 300,
    sendDelay: 400,
    responseStartDelay: 800,
  },
  builder: {
    totalDuration: 20000,        // 20s - main attraction
    codeTypingSpeed: 5,
    startDelay: 400,
    previewUpdateInterval: 100,
  },
  debate: {
    totalDuration: 20000,        // 20s
    typingSpeed: 15,
    agent1StartDelay: 500,
    agent2StartDelay: 4000,
    judgeStartDelay: 12000,
  },
  batch: {
    totalDuration: 15000,        // 15s
    claudeSpeed: 18,
    gptSpeed: 22,
    deepseekSpeed: 12,
    startDelay: 400,
  },
  tribunal: {
    totalDuration: 20000,        // 20s
    injectionDelay: 1000,
    d1Delay: 3500,
    d2Delay: 7000,
    d3Delay: 11000,
    judgeDelay: 15000,
    scoreDelay: 18500,
  },
  diagnostics: {
    totalDuration: 15000,        // 15s
    scanDuration: 3500,
    findingsPopulateDelay: 600,
    analysisFadeIn: 7000,
    fixProposalDelay: 11000,
  },
};

// Pre-written demo content for simulations
const DEMO_CONTENT = {
  architectPrompt: "Build a coffee shop landing page with hero, menu, and contact form.",
  architectResponse: `I'll create a detailed implementation plan for your coffee shop landing page.

## Architecture Plan

**Components needed:**
1. Hero section with full-width image and tagline
2. Menu grid with coffee items and prices
3. Location section with embedded map
4. Contact form with validation

\`\`\`BUILDER_PROMPT
Create a modern coffee shop landing page with:
- Dark theme with warm amber accents
- Hero: "Artisan Coffee, Crafted Daily" tagline
- Menu: 6 coffee items in a responsive grid
- Contact form: name, email, message fields
- Use Tailwind CSS, single HTML file
\`\`\``,

  builderCode: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Brew & Bean Coffee</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-900 text-white">
  <!-- Navigation -->
  <nav class="fixed w-full bg-zinc-900/95 backdrop-blur z-50">
    <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between">
      <span class="text-2xl font-bold text-amber-500">☕ Brew & Bean</span>
      <div class="flex gap-6">
        <a href="#menu" class="hover:text-amber-400">Menu</a>
        <a href="#contact" class="hover:text-amber-400">Contact</a>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-900/20">
    <div class="text-center">
      <h1 class="text-6xl font-bold mb-4">Artisan Coffee</h1>
      <p class="text-2xl text-amber-400 mb-8">Crafted Daily</p>
      <a href="#menu" class="px-8 py-3 bg-amber-600 rounded-lg font-semibold hover:bg-amber-500">
        View Menu
      </a>
    </div>
  </section>

  <!-- Menu Grid -->
  <section id="menu" class="py-20 px-4">
    <h2 class="text-4xl font-bold text-center mb-12">Our Menu</h2>
    <div class="max-w-6xl mx-auto grid grid-cols-3 gap-6">
      <div class="bg-zinc-800 rounded-xl p-6">
        <div class="text-4xl mb-3">☕</div>
        <h3 class="text-xl font-bold">Espresso</h3>
        <p class="text-zinc-400">Bold and intense</p>
        <p class="text-amber-400 mt-2">$3.50</p>
      </div>
      <div class="bg-zinc-800 rounded-xl p-6">
        <div class="text-4xl mb-3">🥛</div>
        <h3 class="text-xl font-bold">Latte</h3>
        <p class="text-zinc-400">Smooth and creamy</p>
        <p class="text-amber-400 mt-2">$4.50</p>
      </div>
      <div class="bg-zinc-800 rounded-xl p-6">
        <div class="text-4xl mb-3">🧊</div>
        <h3 class="text-xl font-bold">Cold Brew</h3>
        <p class="text-zinc-400">Smooth and refreshing</p>
        <p class="text-amber-400 mt-2">$5.00</p>
      </div>
    </div>
  </section>

  <!-- Contact Form -->
  <section id="contact" class="py-20 px-4 bg-zinc-800">
    <h2 class="text-4xl font-bold text-center mb-12">Contact Us</h2>
    <form class="max-w-md mx-auto space-y-4">
      <input type="text" placeholder="Name" class="w-full p-3 rounded bg-zinc-700 border border-zinc-600">
      <input type="email" placeholder="Email" class="w-full p-3 rounded bg-zinc-700 border border-zinc-600">
      <textarea placeholder="Message" rows="4" class="w-full p-3 rounded bg-zinc-700 border border-zinc-600"></textarea>
      <button class="w-full py-3 bg-amber-600 rounded-lg font-semibold hover:bg-amber-500">Send Message</button>
    </form>
  </section>
</body>
</html>`,

  debateFor: "AI chatbots offer 24/7 availability and instant responses. They reduce costs by 40-60% while handling routine inquiries, freeing humans for complex issues. Customer satisfaction remains high for simple queries.",
  debateAgainst: "Human support builds genuine relationships and handles nuanced situations. Chatbots frustrate customers with complex needs and damage brand perception. The cost savings don't account for lost customer loyalty.",
  debateJudge: "VERDICT: Hybrid approach recommended. Use AI chatbots for initial triage and FAQs, but ensure seamless escalation to human agents. This balances efficiency with customer satisfaction. Confidence: 89%.",

  batchClaude: "Dear [Vendor],\n\nThank you for your proposal. After careful review, we've decided to pursue a different direction. We appreciate your time and professionalism, and hope to explore opportunities together in the future.\n\nBest regards",
  batchGPT: "Hi [Vendor],\n\nWe've completed our evaluation and have chosen to go with another option. Your proposal was impressive, and this decision was difficult. We value our relationship and will keep you in mind for future projects.\n\nWarm regards",
  batchDeepSeek: "Thank you for submitting your proposal. We have decided not to proceed at this time. We appreciate your effort and look forward to potential collaboration in the future.",

  tribunalD1: "This claim appears plausible. The Great Wall underwent significant restoration in the 1990s...",
  tribunalD2: "FALSE. The Great Wall construction began in the 7th century BC. The claim is historically inaccurate misinformation.",
  tribunalD3: "Confirmed FALSE. Historical records contradict this claim. The Great Wall spans 2,000+ years of construction.",
  tribunalJudge: "VERDICT: Misinformation detected.\nConfidence: 97%\nSource: D2 and D3 consensus\nD1 was deceived by partial truth.",

  diagnosticsFindings: [
    { type: "error", file: "api/chat.ts", line: 142, msg: "Empty catch block silently swallows errors" },
    { type: "warning", file: "components/Header.tsx", line: 87, msg: "Unused import: useState" },
    { type: "warning", file: "lib/utils.ts", line: 23, msg: "Function could be simplified" },
    { type: "enhancement", file: "app/page.tsx", line: 15, msg: "Consider lazy loading this component" },
  ],
  diagnosticsFix: "Add error logging to catch block:\n\ncatch (error) {\n  console.error('API error:', error);\n  throw error;\n}",
};

// Calculate total demo duration for timer display
// Target: 3:00 (180 seconds) - ORIGINAL TIMING
const TOTAL_DEMO_DURATION = (() => {
  // Steps 0,1,2: text (6s each) = 18s
  // Step 3: engine = 12s
  // Steps 4-9: simulations = 15+20+20+15+20+15 = 105s
  // Steps 10,11,12,13: text (6s each) = 24s
  // Step 14: closing = 10s
  // Total: 18 + 12 + 105 + 24 + 10 = 169s ≈ 3:00
  return 180000; // 3 minutes exactly for clean display
})();

export default function DemoPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ modules: 0, models: 0, providers: 0 });
  const [fadeKey, setFadeKey] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalSteps = 15;

  // Fullscreen toggle for video recording
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Get step duration - TARGET: 3:00 (180 seconds) total - ORIGINAL TIMING
  // Text slides: 6s. Live simulations: 15-20s. Engine: 12s. Closing: 10s.
  const getStepDuration = (step: number) => {
    switch (step) {
      case 4: return TIMING.architect.totalDuration;   // Architect: 15s
      case 5: return TIMING.builder.totalDuration;     // Builder: 20s
      case 6: return TIMING.debate.totalDuration;      // Debate: 20s
      case 7: return TIMING.batch.totalDuration;       // Batch: 15s
      case 8: return TIMING.tribunal.totalDuration;    // Tribunal: 20s
      case 9: return TIMING.diagnostics.totalDuration; // Diagnostics: 15s
      case 3: return 12000;  // THE ENGINE slide: 12s
      case 14: return 10000; // Closing slide: 10s
      default: return 6000;  // All other text slides: 6s (slower for readability)
    }
  };

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, totalSteps - 1);
      if (next !== prev) setFadeKey((k) => k + 1);
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next !== prev) setFadeKey((k) => k + 1);
      return next;
    });
  }, []);

  const togglePlay = () => {
    if (!isPlaying && currentStep === 0) {
      setElapsedTime(0); // Reset timer when starting from beginning
    }
    setIsPlaying(!isPlaying);
  };

  // Timer that tracks elapsed time when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 100);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  // Format time as M:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (isFullscreen) {
          // Fullscreen exit handled by browser
        } else {
          router.push("/dashboard");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextStep, prevStep, router, toggleFullscreen, isFullscreen]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;
    const duration = getStepDuration(currentStep);
    const timer = setTimeout(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        setFadeKey((k) => k + 1);
        return prev + 1;
      });
    }, duration);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  // Animate stats on step 0
  useEffect(() => {
    if (currentStep === 0) {
      setAnimatedStats({ modules: 0, models: 0, providers: 0 });
      const timer = setTimeout(() => {
        const duration = 1500;
        const steps = 30;
        const interval = duration / steps;
        let step = 0;
        const counter = setInterval(() => {
          step++;
          setAnimatedStats({
            modules: Math.round((16 * step) / steps),
            models: Math.round((49 * step) / steps),
            providers: Math.round((6 * step) / steps),
          });
          if (step >= steps) clearInterval(counter);
        }, interval);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const isSimulatedSlide = SIMULATED_SLIDES.includes(currentStep);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-zinc-950 text-white overflow-hidden z-50 flex flex-col">
      {/* Progress Bar */}
      <div className="h-1 bg-zinc-800 w-full">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step indicator + Timer */}
      <div className="absolute top-4 right-4 text-zinc-500 text-sm font-mono z-20 flex items-center gap-4">
        {/* Timer */}
        <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-700">
          <span className={cn(
            "text-sm font-bold tabular-nums",
            isPlaying ? "text-emerald-400" : "text-zinc-400"
          )}>
            {formatTime(elapsedTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500 text-xs">
            {formatTime(TOTAL_DEMO_DURATION)}
          </span>
        </div>

        {isSimulatedSlide && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-bold">LIVE</span>
            <span className="text-zinc-600 text-[10px]">Simulated</span>
          </span>
        )}
        <span className="text-zinc-400">{currentStep + 1} / {totalSteps}</span>
      </div>

      {/* Close button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="absolute top-4 left-4 text-zinc-500 hover:text-white transition-colors z-20"
        title="Exit Demo (Esc)"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Fullscreen button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 left-14 text-zinc-500 hover:text-white transition-colors z-20"
        title="Fullscreen (F)"
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 overflow-hidden">
        <div key={fadeKey} className="w-full h-full max-w-7xl animate-fadeIn">
          {currentStep === 0 && <Step1TitleCard stats={animatedStats} />}
          {currentStep === 1 && <Step2Problem />}
          {currentStep === 2 && <Step3Solution />}
          {currentStep === 3 && <Step3_5Engine />}
          {currentStep === 4 && <SimulatedArchitect />}
          {currentStep === 5 && <SimulatedBuilder />}
          {currentStep === 6 && <SimulatedDebate />}
          {currentStep === 7 && <SimulatedBatch />}
          {currentStep === 8 && <SimulatedTribunal />}
          {currentStep === 9 && <SimulatedDiagnostics />}
          {currentStep === 10 && <Step9Forensic />}
          {currentStep === 11 && <Step11Pipelines />}
          {currentStep === 12 && <Step12Security />}
          {currentStep === 13 && <Step13Models />}
          {currentStep === 14 && <Step14Closing onLaunch={() => router.push("/dashboard")} />}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="h-16 flex items-center justify-center gap-6 border-t border-zinc-800">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm",
            currentStep === 0
              ? "text-zinc-600 cursor-not-allowed"
              : "text-white bg-zinc-800 hover:bg-zinc-700"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <button
          onClick={togglePlay}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm",
            isPlaying
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          )}
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Auto-Play
            </>
          )}
        </button>

        <button
          onClick={nextStep}
          disabled={currentStep === totalSteps - 1}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm",
            currentStep === totalSteps - 1
              ? "text-zinc-600 cursor-not-allowed"
              : "text-white bg-zinc-800 hover:bg-zinc-700"
          )}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-zinc-600 text-xs">
        Arrow keys to navigate • F for fullscreen • Esc to exit
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.5s ease-out forwards;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
        }
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .typewriter-cursor::after {
          content: '▌';
          animation: blink 0.8s infinite;
          color: #a855f7;
        }
        @keyframes enginePulse {
          0%, 100% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.4), 0 0 80px rgba(251, 191, 36, 0.2); transform: scale(1); }
          50% { box-shadow: 0 0 60px rgba(251, 191, 36, 0.6), 0 0 120px rgba(251, 191, 36, 0.3); transform: scale(1.05); }
        }
        .animate-enginePulse {
          animation: enginePulse 2s ease-in-out infinite;
        }
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ============================================
// TYPEWRITER HOOK FOR SIMULATIONS
// ============================================

function useTypewriter(text: string, speed: number = 15, startDelay: number = 0) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);

    const startTimer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, speed, startDelay]);

  return { displayedText, isComplete };
}

// ============================================
// SIMULATED DEMO COMPONENTS
// ============================================

function SimulatedArchitect() {
  const [phase, setPhase] = useState<"typing-prompt" | "sending" | "response" | "done">("typing-prompt");
  const [showButton, setShowButton] = useState(false);

  // 50ms per character for prompt typing (fast, visible typing)
  const promptTypewriter = useTypewriter(
    DEMO_CONTENT.architectPrompt,
    TIMING.architect.promptTypingSpeed,
    TIMING.architect.promptStartDelay
  );

  // 20ms per character for response (streaming AI feel)
  const responseTypewriter = useTypewriter(
    DEMO_CONTENT.architectResponse,
    TIMING.architect.responseTypingSpeed,
    0
  );

  useEffect(() => {
    if (promptTypewriter.isComplete && phase === "typing-prompt") {
      setTimeout(() => setPhase("sending"), TIMING.architect.sendDelay);
      setTimeout(() => setPhase("response"), TIMING.architect.responseStartDelay);
    }
  }, [promptTypewriter.isComplete, phase]);

  useEffect(() => {
    if (responseTypewriter.isComplete && phase === "response") {
      setPhase("done");
      // Button pulses to draw attention
      setTimeout(() => setShowButton(true), 200);
    }
  }, [responseTypewriter.isComplete, phase]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-indigo-600 rounded-full text-sm font-bold">ARCHITECT MODE</div>
          <span className="text-zinc-400 text-sm">Planning AI generates implementation specs</span>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 rounded-xl border border-indigo-500/30 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 p-6 overflow-auto">
          {/* User Message */}
          <div className="flex justify-end mb-6">
            <div className="bg-indigo-600 rounded-2xl rounded-br-md px-4 py-3 max-w-lg">
              <p className={phase === "typing-prompt" ? "typewriter-cursor" : ""}>
                {promptTypewriter.displayedText}
              </p>
            </div>
          </div>

          {/* Sending indicator */}
          {phase === "sending" && (
            <div className="flex justify-end mb-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                Sending to Claude Opus...
              </div>
            </div>
          )}

          {/* AI Response */}
          {(phase === "response" || phase === "done") && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3 max-w-2xl">
                <div className="text-xs text-purple-400 font-bold mb-2 flex items-center gap-2">
                  <span>🧠 Claude Opus</span>
                  {phase === "response" && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                      streaming
                    </span>
                  )}
                </div>
                <div className={cn("whitespace-pre-wrap text-sm", phase === "response" && "typewriter-cursor")}>
                  {responseTypewriter.displayedText}
                </div>
                {showButton && (
                  <button className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold flex items-center gap-2 animate-pulse shadow-lg shadow-purple-500/30">
                    <Send className="h-4 w-4" />
                    Send to Builder
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3">
            <input
              type="text"
              className="flex-1 bg-transparent text-zinc-400 placeholder-zinc-600 outline-none"
              placeholder="Describe what you want to build..."
              readOnly
            />
            <button className="p-2 bg-indigo-600 rounded-lg">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatedBuilder() {
  const [phase, setPhase] = useState<"init" | "generating" | "done">("init");
  const [previewProgress, setPreviewProgress] = useState(0);
  const [linesTyped, setLinesTyped] = useState(0);

  // 5ms per character - ultra fast code streaming
  const codeTypewriter = useTypewriter(
    DEMO_CONTENT.builderCode,
    TIMING.builder.codeTypingSpeed,
    TIMING.builder.startDelay
  );

  useEffect(() => {
    const timer = setTimeout(() => setPhase("generating"), 300);
    return () => clearTimeout(timer);
  }, []);

  // Progressive preview update tied to code progress
  useEffect(() => {
    if (phase === "generating") {
      const codeLength = DEMO_CONTENT.builderCode.length;
      const currentLength = codeTypewriter.displayedText.length;
      const progress = Math.min((currentLength / codeLength) * 100, 100);
      setPreviewProgress(progress);

      // Count lines for display
      const lines = codeTypewriter.displayedText.split('\n').length;
      setLinesTyped(lines);
    }
  }, [phase, codeTypewriter.displayedText]);

  useEffect(() => {
    if (codeTypewriter.isComplete) {
      setPhase("done");
      setPreviewProgress(100);
    }
  }, [codeTypewriter.isComplete]);

  const progressPercent = Math.round((codeTypewriter.displayedText.length / DEMO_CONTENT.builderCode.length) * 100);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-purple-600 rounded-full text-sm font-bold">AI BUILDER</div>
          <span className="text-zinc-400 text-sm">Live code generation with instant preview</span>
        </div>
        {phase !== "init" && (
          <div className="flex items-center gap-3 text-sm">
            {phase === "generating" && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-bold">LIVE</span>
              </span>
            )}
            <span className="text-zinc-500">{progressPercent}% · {linesTyped} lines</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Code Panel - narrower */}
        <div className="w-[45%] bg-zinc-900 rounded-xl border border-purple-500/30 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-800/50">
            <FileCode className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">index.html</span>
            <span className="text-xs text-zinc-500 ml-auto">{codeTypewriter.displayedText.length} chars</span>
          </div>
          <div className="flex-1 p-4 overflow-auto font-mono text-[10px] leading-tight">
            <pre className={cn("text-green-400 whitespace-pre-wrap", phase === "generating" && "typewriter-cursor")}>
              {codeTypewriter.displayedText}
            </pre>
          </div>
        </div>

        {/* Preview Panel - wider, PRIMARY */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-purple-500/30 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-800/50">
            <Eye className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">Live Preview</span>
            {phase === "generating" && (
              <span className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 font-semibold">Building...</span>
              </span>
            )}
            {phase === "done" && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="h-3 w-3" />
                Complete
              </span>
            )}
          </div>
          <div className="flex-1 relative overflow-hidden">
            {/* Simulated Progressive Preview Build-up */}
            <div className="absolute inset-0 bg-zinc-950 p-4">
              <div className="w-full h-full flex flex-col max-w-lg mx-auto">
                {/* Navbar - fades in first (0-15%) */}
                <div
                  className="h-14 bg-zinc-900/95 backdrop-blur rounded-lg flex items-center px-4 mb-4 transition-all duration-300 border border-zinc-800"
                  style={{
                    opacity: previewProgress > 8 ? 1 : 0,
                    transform: previewProgress > 8 ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <span className="text-xl font-bold text-amber-500">☕ Brew & Bean</span>
                  <div className="ml-auto flex gap-6 text-sm text-zinc-400">
                    <span className="hover:text-amber-400 cursor-pointer">Menu</span>
                    <span className="hover:text-amber-400 cursor-pointer">Contact</span>
                  </div>
                </div>

                {/* Hero section - fades in (15-35%) */}
                <div
                  className="flex-shrink-0 h-40 bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-900/30 rounded-xl flex items-center justify-center mb-4 transition-all duration-500"
                  style={{
                    opacity: previewProgress > 20 ? 1 : 0,
                    transform: previewProgress > 20 ? 'scale(1)' : 'scale(0.95)',
                  }}
                >
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">Artisan Coffee</h1>
                    <p className="text-xl text-amber-400 mb-4">Crafted Daily</p>
                    <button className="px-6 py-2 bg-amber-600 rounded-lg font-semibold hover:bg-amber-500 transition-colors">
                      View Menu
                    </button>
                  </div>
                </div>

                {/* Menu grid - cards fade in sequentially (35-60%) */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { emoji: "☕", name: "Espresso", desc: "Bold and intense", price: "$3.50", threshold: 40 },
                    { emoji: "🥛", name: "Latte", desc: "Smooth and creamy", price: "$4.50", threshold: 48 },
                    { emoji: "🧊", name: "Cold Brew", desc: "Refreshing", price: "$5.00", threshold: 56 },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="bg-zinc-800 rounded-xl p-4 text-center transition-all duration-300 border border-zinc-700"
                      style={{
                        opacity: previewProgress > item.threshold ? 1 : 0,
                        transform: previewProgress > item.threshold ? 'translateY(0)' : 'translateY(15px)',
                      }}
                    >
                      <div className="text-3xl mb-2">{item.emoji}</div>
                      <h3 className="font-bold text-sm">{item.name}</h3>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                      <p className="text-amber-400 mt-1 font-bold">{item.price}</p>
                    </div>
                  ))}
                </div>

                {/* Contact form - fades in last (60-85%) */}
                <div
                  className="flex-1 bg-zinc-800 rounded-xl p-4 transition-all duration-500 border border-zinc-700"
                  style={{
                    opacity: previewProgress > 70 ? 1 : 0,
                    transform: previewProgress > 70 ? 'translateY(0)' : 'translateY(20px)',
                  }}
                >
                  <h2 className="text-lg font-bold text-center mb-3">Contact Us</h2>
                  <div className="space-y-2 max-w-xs mx-auto">
                    <input
                      className="w-full p-2 bg-zinc-700 rounded border border-zinc-600 text-sm placeholder-zinc-500"
                      placeholder="Name"
                      readOnly
                    />
                    <input
                      className="w-full p-2 bg-zinc-700 rounded border border-zinc-600 text-sm placeholder-zinc-500"
                      placeholder="Email"
                      readOnly
                    />
                    <button className="w-full py-2 bg-amber-600 rounded font-semibold text-sm hover:bg-amber-500 transition-colors">
                      Send Message
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatedDebate() {
  const [phase, setPhase] = useState(0);

  // 15ms per character typing speed, staggered starts
  // Agent 1 starts at 500ms
  // Agent 2 starts 3 seconds later (3500ms)
  // Judge starts after both finish (~12s)
  const forTypewriter = useTypewriter(
    DEMO_CONTENT.debateFor,
    TIMING.debate.typingSpeed,
    TIMING.debate.agent1StartDelay
  );
  const againstTypewriter = useTypewriter(
    DEMO_CONTENT.debateAgainst,
    TIMING.debate.typingSpeed,
    TIMING.debate.agent2StartDelay
  );
  const judgeTypewriter = useTypewriter(
    DEMO_CONTENT.debateJudge,
    TIMING.debate.typingSpeed,
    TIMING.debate.judgeStartDelay
  );

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), TIMING.debate.agent1StartDelay),      // Agent 1 starts
      setTimeout(() => setPhase(2), TIMING.debate.agent2StartDelay),      // Agent 2 starts (3s after A1)
      setTimeout(() => setPhase(3), TIMING.debate.judgeStartDelay),       // Judge starts after both
      setTimeout(() => setPhase(4), TIMING.debate.totalDuration - 2000),  // Final state
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-orange-600 rounded-full text-sm font-bold">DEBATE ARENA</div>
          <span className="text-zinc-400 text-sm">Multiple AIs argue, a judge decides</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-600">All models:</span>
          <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">Ollama (Local)</span>
        </div>
      </div>

      {/* Topic */}
      <div className="bg-zinc-800 rounded-xl p-4 mb-4 text-center border border-orange-500/30">
        <div className="text-xs text-orange-400 uppercase tracking-wider mb-2 font-bold">Debate Topic</div>
        <div className="text-lg font-semibold">Should small businesses use AI chatbots or human-only support?</div>
      </div>

      {/* Agents - 3 columns */}
      <div className="flex-1 grid grid-cols-3 gap-4">
        {/* Agent 1 - FOR */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-300 flex flex-col",
          phase >= 1 ? "border-emerald-500 shadow-lg shadow-emerald-500/10" : "border-zinc-700"
        )}>
          <div className="bg-emerald-900/30 px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">A1</div>
              <div className="flex-1">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  FOR
                  {phase === 1 && !forTypewriter.isComplete && (
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-zinc-500">qwen2.5-coder (Local)</div>
              </div>
            </div>
          </div>
          <div className="p-4 text-sm flex-1 overflow-auto">
            {phase >= 1 && (
              <p className={cn(
                "leading-relaxed",
                phase === 1 && !forTypewriter.isComplete ? "typewriter-cursor" : ""
              )}>
                {forTypewriter.displayedText}
              </p>
            )}
          </div>
        </div>

        {/* Agent 2 - AGAINST (middle column) */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-300 flex flex-col",
          phase >= 2 ? "border-red-500 shadow-lg shadow-red-500/10" : "border-zinc-700"
        )}>
          <div className="bg-red-900/30 px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">A2</div>
              <div className="flex-1">
                <div className="font-bold text-red-400 flex items-center gap-2">
                  AGAINST
                  {phase === 2 && !againstTypewriter.isComplete && (
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-zinc-500">qwen3 (Local)</div>
              </div>
            </div>
          </div>
          <div className="p-4 text-sm flex-1 overflow-auto">
            {phase >= 2 && (
              <p className={cn(
                "leading-relaxed",
                phase === 2 && !againstTypewriter.isComplete ? "typewriter-cursor" : ""
              )}>
                {againstTypewriter.displayedText}
              </p>
            )}
          </div>
        </div>

        {/* Judge (right column) */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-300 flex flex-col",
          phase >= 3 ? "border-amber-500 shadow-lg shadow-amber-500/10" : "border-zinc-700"
        )}>
          <div className="bg-amber-900/30 px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-lg">⚖️</div>
              <div className="flex-1">
                <div className="font-bold text-amber-400 flex items-center gap-2">
                  JUDGE
                  {phase === 3 && !judgeTypewriter.isComplete && (
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-zinc-500">deepseek-coder (Local)</div>
              </div>
            </div>
          </div>
          <div className="p-4 text-sm flex-1 overflow-auto">
            {phase >= 3 && (
              <p className={cn(
                "leading-relaxed whitespace-pre-line",
                phase === 3 && !judgeTypewriter.isComplete ? "typewriter-cursor" : ""
              )}>
                {judgeTypewriter.displayedText}
              </p>
            )}
            {phase < 3 && (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                Waiting for arguments...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatedBatch() {
  const [phase, setPhase] = useState(0);
  const [showBadges, setShowBadges] = useState(false);

  // Different speeds simulate real model speed differences
  // All start simultaneously but finish at different times
  const claudeTypewriter = useTypewriter(
    DEMO_CONTENT.batchClaude,
    TIMING.batch.claudeSpeed,    // 18ms - medium
    TIMING.batch.startDelay
  );
  const gptTypewriter = useTypewriter(
    DEMO_CONTENT.batchGPT,
    TIMING.batch.gptSpeed,       // 22ms - slower (warmth takes time)
    TIMING.batch.startDelay
  );
  const deepseekTypewriter = useTypewriter(
    DEMO_CONTENT.batchDeepSeek,
    TIMING.batch.deepseekSpeed,  // 12ms - fastest (concise)
    TIMING.batch.startDelay
  );

  useEffect(() => {
    const timer = setTimeout(() => setPhase(1), TIMING.batch.startDelay);
    return () => clearTimeout(timer);
  }, []);

  // Show badges when all complete
  useEffect(() => {
    if (claudeTypewriter.isComplete && gptTypewriter.isComplete && deepseekTypewriter.isComplete) {
      setTimeout(() => setShowBadges(true), 300);
    }
  }, [claudeTypewriter.isComplete, gptTypewriter.isComplete, deepseekTypewriter.isComplete]);

  const responses = [
    {
      name: "Claude",
      color: "orange",
      speed: "2.1s",
      tokens: 89,
      style: "Formal",
      rating: 4.8,
      typewriter: claudeTypewriter,
    },
    {
      name: "GPT-4o",
      color: "green",
      speed: "2.4s",
      tokens: 95,
      style: "Warm",
      rating: 4.6,
      typewriter: gptTypewriter,
    },
    {
      name: "DeepSeek",
      color: "purple",
      speed: "1.2s",
      tokens: 52,
      style: "Concise",
      rating: 4.5,
      typewriter: deepseekTypewriter,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-green-600 rounded-full text-sm font-bold">BATCH PROCESSING</div>
          <span className="text-zinc-400 text-sm">Same prompt, multiple models, side-by-side comparison</span>
        </div>
      </div>

      {/* Prompt */}
      <div className="bg-zinc-800 rounded-xl p-4 mb-4 border border-green-500/30">
        <div className="text-xs text-green-400 uppercase tracking-wider mb-2 font-bold">Prompt</div>
        <div className="text-sm">Write a professional vendor rejection email.</div>
      </div>

      {/* Responses - 3 side by side */}
      <div className="flex-1 grid grid-cols-3 gap-4">
        {responses.map((r) => (
          <div key={r.name} className={cn(
            "bg-zinc-900 rounded-xl border-2 overflow-hidden flex flex-col transition-all duration-300",
            r.color === "orange" && "border-orange-500/50",
            r.color === "green" && "border-green-500/50",
            r.color === "purple" && "border-purple-500/50"
          )}>
            <div className={cn(
              "px-4 py-3 border-b border-zinc-800 flex items-center justify-between",
              r.color === "orange" && "bg-orange-900/20",
              r.color === "green" && "bg-green-900/20",
              r.color === "purple" && "bg-purple-900/20"
            )}>
              <span className={cn(
                "font-bold flex items-center gap-2",
                r.color === "orange" && "text-orange-400",
                r.color === "green" && "text-green-400",
                r.color === "purple" && "text-purple-400"
              )}>
                {r.name}
                {!r.typewriter.isComplete && phase >= 1 && (
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                )}
              </span>
              {r.typewriter.isComplete && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Done
                </span>
              )}
            </div>
            <div className="p-4 text-sm flex-1 overflow-auto">
              {phase >= 1 && (
                <p className={cn(
                  "whitespace-pre-wrap leading-relaxed",
                  !r.typewriter.isComplete && "typewriter-cursor"
                )}>
                  {r.typewriter.displayedText}
                </p>
              )}
            </div>

            {/* Quality badges fade in at the end */}
            {showBadges && (
              <div className={cn(
                "px-4 py-3 border-t border-zinc-800 flex items-center justify-between text-xs animate-fadeIn",
                r.color === "orange" && "bg-orange-900/10",
                r.color === "green" && "bg-green-900/10",
                r.color === "purple" && "bg-purple-900/10"
              )}>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500">{r.tokens} tokens</span>
                  <span className="text-zinc-500">{r.speed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold",
                    r.color === "orange" && "bg-orange-500/20 text-orange-300",
                    r.color === "green" && "bg-green-500/20 text-green-300",
                    r.color === "purple" && "bg-purple-500/20 text-purple-300"
                  )}>
                    {r.style}
                  </span>
                  <span className="text-amber-400">★ {r.rating}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SimulatedTribunal() {
  const [phase, setPhase] = useState(0);

  // Animated sequence with precise timing:
  // 1) Injection types out (2 sec)
  // 2) D1 lights up with X (3 sec)
  // 3) D2 lights up with CHECK (4 sec)
  // 4) D3 lights up with CHECK (4 sec)
  // 5) Judge panel glows gold (4 sec)
  // 6) Final score card animates in (3 sec)
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), TIMING.tribunal.injectionDelay),  // Injection: 1s
      setTimeout(() => setPhase(2), TIMING.tribunal.d1Delay),         // D1: 3s
      setTimeout(() => setPhase(3), TIMING.tribunal.d2Delay),         // D2: 6s
      setTimeout(() => setPhase(4), TIMING.tribunal.d3Delay),         // D3: 10s
      setTimeout(() => setPhase(5), TIMING.tribunal.judgeDelay),      // Judge: 14s
      setTimeout(() => setPhase(6), TIMING.tribunal.scoreDelay),      // Score: 18s
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Typewriter for injection text
  const injectionTypewriter = useTypewriter(
    "The Great Wall of China was built in 1995.",
    25,
    TIMING.tribunal.injectionDelay
  );

  // Typewriter for each detector with staggered delays
  const d1Typewriter = useTypewriter(DEMO_CONTENT.tribunalD1, 20, TIMING.tribunal.d1Delay);
  const d2Typewriter = useTypewriter(DEMO_CONTENT.tribunalD2, 20, TIMING.tribunal.d2Delay);
  const d3Typewriter = useTypewriter(DEMO_CONTENT.tribunalD3, 20, TIMING.tribunal.d3Delay);
  const judgeTypewriter = useTypewriter(DEMO_CONTENT.tribunalJudge, 15, TIMING.tribunal.judgeDelay);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-red-600 rounded-full text-sm font-bold">ADVERSARIAL TRIBUNAL</div>
          <span className="text-zinc-400 text-sm">Inject misinformation, watch AIs detect it</span>
        </div>
      </div>

      {/* Injection - Types out in red */}
      <div className={cn(
        "bg-red-900/20 border-2 border-red-500/50 rounded-xl p-4 mb-4 transition-all duration-500",
        phase >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}>
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-sm">INJECTING POISON PILL</span>
        </div>
        <div className={cn(
          "text-xl font-mono text-red-300",
          phase === 1 && !injectionTypewriter.isComplete && "typewriter-cursor"
        )}>
          &ldquo;{injectionTypewriter.displayedText}&rdquo;
        </div>
      </div>

      {/* Detectors - 4 columns */}
      <div className="flex-1 grid grid-cols-4 gap-3">
        {/* D1 - Fooled (RED X overlay) */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-500 flex flex-col",
          phase >= 2 ? "border-red-500 shadow-lg shadow-red-500/20" : "border-zinc-700"
        )}>
          <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <span className="font-bold text-sm">Detector 1</span>
            {phase >= 2 && (
              <div className="flex items-center gap-1 text-red-500">
                <X className="h-5 w-5" />
                <span className="text-xs font-bold">FOOLED</span>
              </div>
            )}
          </div>
          <div className="p-3 text-xs flex-1 overflow-auto relative">
            {phase >= 2 && (
              <>
                <p className={cn(
                  "text-zinc-400 leading-relaxed",
                  phase === 2 && !d1Typewriter.isComplete && "typewriter-cursor"
                )}>
                  {d1Typewriter.displayedText}
                </p>
                {d1Typewriter.isComplete && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-red-500/20 text-6xl font-black">✗</div>
                  </div>
                )}
              </>
            )}
          </div>
          {d1Typewriter.isComplete && (
            <div className="px-3 py-2 bg-red-900/30 border-t border-red-500/30">
              <span className="text-red-400 text-xs font-bold">DECEIVED BY PARTIAL TRUTH</span>
            </div>
          )}
        </div>

        {/* D2 - Caught (GREEN CHECK) */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-500 flex flex-col",
          phase >= 3 ? "border-green-500 shadow-lg shadow-green-500/20" : "border-zinc-700"
        )}>
          <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <span className="font-bold text-sm">Detector 2</span>
            {phase >= 3 && (
              <div className="flex items-center gap-1 text-green-500">
                <Check className="h-5 w-5" />
                <span className="text-xs font-bold">CAUGHT</span>
              </div>
            )}
          </div>
          <div className="p-3 text-xs flex-1 overflow-auto relative">
            {phase >= 3 && (
              <>
                <p className={cn(
                  "text-zinc-400 leading-relaxed",
                  phase === 3 && !d2Typewriter.isComplete && "typewriter-cursor"
                )}>
                  {d2Typewriter.displayedText}
                </p>
                {d2Typewriter.isComplete && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-green-500/20 text-6xl font-black">✓</div>
                  </div>
                )}
              </>
            )}
          </div>
          {d2Typewriter.isComplete && (
            <div className="px-3 py-2 bg-green-900/30 border-t border-green-500/30">
              <span className="text-green-400 text-xs font-bold">CORRECTLY IDENTIFIED FALSE</span>
            </div>
          )}
        </div>

        {/* D3 - Caught (GREEN CHECK) */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-500 flex flex-col",
          phase >= 4 ? "border-green-500 shadow-lg shadow-green-500/20" : "border-zinc-700"
        )}>
          <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <span className="font-bold text-sm">Detector 3</span>
            {phase >= 4 && (
              <div className="flex items-center gap-1 text-green-500">
                <Check className="h-5 w-5" />
                <span className="text-xs font-bold">CAUGHT</span>
              </div>
            )}
          </div>
          <div className="p-3 text-xs flex-1 overflow-auto relative">
            {phase >= 4 && (
              <>
                <p className={cn(
                  "text-zinc-400 leading-relaxed",
                  phase === 4 && !d3Typewriter.isComplete && "typewriter-cursor"
                )}>
                  {d3Typewriter.displayedText}
                </p>
                {d3Typewriter.isComplete && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-green-500/20 text-6xl font-black">✓</div>
                  </div>
                )}
              </>
            )}
          </div>
          {d3Typewriter.isComplete && (
            <div className="px-3 py-2 bg-green-900/30 border-t border-green-500/30">
              <span className="text-green-400 text-xs font-bold">HISTORICAL CONTRADICTION</span>
            </div>
          )}
        </div>

        {/* Judge - Glows gold */}
        <div className={cn(
          "bg-zinc-900 rounded-xl border-2 overflow-hidden transition-all duration-500 flex flex-col",
          phase >= 5 ? "border-amber-500 shadow-lg shadow-amber-500/30" : "border-zinc-700"
        )}>
          <div className={cn(
            "px-4 py-3 border-b border-zinc-700 flex items-center justify-between transition-colors duration-300",
            phase >= 5 ? "bg-amber-900/40" : "bg-zinc-800"
          )}>
            <span className="font-bold text-amber-400 text-sm flex items-center gap-2">
              ⚖️ JUDGE
              {phase === 5 && !judgeTypewriter.isComplete && (
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              )}
            </span>
          </div>
          <div className="p-3 text-xs flex-1 overflow-auto">
            {phase >= 5 && (
              <p className={cn(
                "text-amber-200 whitespace-pre-line leading-relaxed",
                phase === 5 && !judgeTypewriter.isComplete && "typewriter-cursor"
              )}>
                {judgeTypewriter.displayedText}
              </p>
            )}
            {phase < 5 && (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                Awaiting detector results...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Final Score Card - Animates in at end */}
      {phase >= 6 && (
        <div className="mt-3 bg-gradient-to-r from-zinc-800 via-zinc-800 to-zinc-800 rounded-xl p-4 flex items-center justify-around animate-scaleIn border border-zinc-700">
          <div className="text-center">
            <div className="text-3xl font-black text-red-400">1/3</div>
            <div className="text-xs text-zinc-500 mt-1">Agents Fooled</div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <div className="text-center">
            <div className="text-3xl font-black text-green-400">67%</div>
            <div className="text-xs text-zinc-500 mt-1">Detection Rate</div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <div className="text-center">
            <div className="text-3xl font-black text-amber-400">97%</div>
            <div className="text-xs text-zinc-500 mt-1">Confidence</div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <div className="text-center">
            <div className="text-3xl font-black text-cyan-400">LOW</div>
            <div className="text-xs text-zinc-500 mt-1">Threat Level</div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimulatedDiagnostics() {
  const [phase, setPhase] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [findingCounts, setFindingCounts] = useState({ errors: 0, warnings: 0, enhancements: 0 });
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);

  // Scan completes in exactly 3 seconds
  useEffect(() => {
    const scanDuration = TIMING.diagnostics.scanDuration;
    const interval = 30; // Update every 30ms for smooth animation
    const steps = scanDuration / interval;
    let step = 0;

    const scanInterval = setInterval(() => {
      step++;
      const progress = Math.min((step / steps) * 100, 100);
      setScanProgress(progress);

      // Rapidly count up findings as scan progresses
      if (progress > 30) {
        setFindingCounts({
          errors: Math.min(Math.floor((progress - 30) / 10), 4),
          warnings: Math.min(Math.floor((progress - 40) / 5), 12),
          enhancements: Math.min(Math.floor((progress - 50) / 6), 8),
        });
      }

      if (step >= steps) {
        clearInterval(scanInterval);
        setScanProgress(100);
        setFindingCounts({ errors: 4, warnings: 12, enhancements: 8 });
      }
    }, interval);

    // Phase timers
    const timers = [
      setTimeout(() => {
        setPhase(1);
        setSelectedFinding(0); // Auto-select first error
      }, TIMING.diagnostics.scanDuration + 500),
      setTimeout(() => setPhase(2), TIMING.diagnostics.analysisFadeIn),
      setTimeout(() => setPhase(3), TIMING.diagnostics.fixProposalDelay),
    ];

    return () => {
      clearInterval(scanInterval);
      timers.forEach(clearTimeout);
    };
  }, []);

  // Typewriter for AI analysis
  const analysisText = "Empty catch block in sarge-daemon.js line 142. This silently swallows errors and makes debugging extremely difficult. When errors occur, they disappear without any trace.";
  const analysisTypewriter = useTypewriter(analysisText, 12, TIMING.diagnostics.analysisFadeIn);

  const fixTypewriter = useTypewriter(DEMO_CONTENT.diagnosticsFix, 8, TIMING.diagnostics.fixProposalDelay);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-yellow-600 rounded-full text-sm font-bold">SELF-HEALING DIAGNOSTICS</div>
          <span className="text-zinc-400 text-sm">Scan, analyze, fix, rollback</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* Scan Panel */}
        <div className="bg-zinc-900 rounded-xl border border-yellow-500/30 overflow-hidden flex flex-col">
          <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-yellow-400" />
              <span className="font-bold">Codebase Scan</span>
            </div>
            {scanProgress >= 100 && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Complete
              </span>
            )}
          </div>
          <div className="p-4 flex-1 overflow-auto">
            {/* Progress Bar - Fills in 3 seconds */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400 flex items-center gap-2">
                  {scanProgress < 100 ? (
                    <>
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      Scanning...
                    </>
                  ) : (
                    "Scan Complete"
                  )}
                </span>
                <span className="text-yellow-400 font-mono">{Math.round(scanProgress)}%</span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-75"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {/* Finding Counts - Numbers count up rapidly */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-red-400">{findingCounts.errors}</div>
                <div className="text-xs text-red-400/70">Errors</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-yellow-400">{findingCounts.warnings}</div>
                <div className="text-xs text-yellow-400/70">Warnings</div>
              </div>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-blue-400">{findingCounts.enhancements}</div>
                <div className="text-xs text-blue-400/70">Enhancements</div>
              </div>
            </div>

            {/* Findings List - Auto-select first error */}
            {phase >= 1 && (
              <div className="space-y-2">
                {DEMO_CONTENT.diagnosticsFindings.map((f, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border text-sm animate-slideIn cursor-pointer transition-all",
                      f.type === "error" && "bg-red-900/20 border-red-500/50",
                      f.type === "warning" && "bg-yellow-900/20 border-yellow-500/50",
                      f.type === "enhancement" && "bg-blue-900/20 border-blue-500/50",
                      selectedFinding === i && "ring-2 ring-white/30"
                    )}
                    style={{ animationDelay: `${i * 100}ms` }}
                    onClick={() => setSelectedFinding(i)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-xs font-bold uppercase px-1.5 py-0.5 rounded",
                        f.type === "error" && "text-red-400 bg-red-500/20",
                        f.type === "warning" && "text-yellow-400 bg-yellow-500/20",
                        f.type === "enhancement" && "text-blue-400 bg-blue-500/20"
                      )}>{f.type}</span>
                      <span className="text-zinc-500 text-xs font-mono">{f.file}:{f.line}</span>
                    </div>
                    <div className="text-zinc-300 text-xs">{f.msg}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="bg-zinc-900 rounded-xl border border-yellow-500/30 overflow-hidden flex flex-col">
          <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="font-bold">AI Analysis</span>
            {phase >= 2 && phase < 3 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-purple-400">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                Analyzing...
              </span>
            )}
          </div>
          <div className="p-4 flex-1 overflow-auto">
            {phase >= 2 ? (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-800 rounded-lg border border-purple-500/30">
                  <div className="text-xs text-purple-400 font-bold mb-2 flex items-center gap-2">
                    <FileCode className="h-3 w-3" />
                    ANALYZING: api/chat.ts:142
                  </div>
                  <div className={cn(
                    "text-sm text-zinc-300 leading-relaxed",
                    phase === 2 && !analysisTypewriter.isComplete && "typewriter-cursor"
                  )}>
                    {analysisTypewriter.displayedText}
                  </div>
                </div>

                {phase >= 3 && (
                  <div className="p-4 bg-zinc-800 rounded-lg border border-green-500/30 animate-slideIn">
                    <div className="text-xs text-green-400 font-bold mb-2 flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      SUGGESTED FIX:
                    </div>
                    <pre className={cn(
                      "text-xs bg-zinc-900 p-3 rounded text-green-300 font-mono whitespace-pre-wrap",
                      !fixTypewriter.isComplete && "typewriter-cursor"
                    )}>
                      {fixTypewriter.displayedText}
                    </pre>

                    {fixTypewriter.isComplete && (
                      <div className="flex gap-2 mt-4">
                        <button className="px-4 py-2 bg-green-600 rounded-lg text-sm font-semibold flex items-center gap-2 animate-pulse shadow-lg shadow-green-500/20">
                          <Check className="h-4 w-4" />
                          Apply
                        </button>
                        <button className="px-4 py-2 bg-zinc-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-600 transition-colors">
                          Rollback
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p className="text-sm">Waiting for scan to complete...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STATIC STEP COMPONENTS
// ============================================

function Step1TitleCard({ stats }: { stats: { modules: number; models: number; providers: number } }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center relative">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-cyan-900/30" />
        </div>

        <div className="mb-8 animate-scaleIn">
          <div className="flex items-center justify-center gap-4 mb-4">
            <ShieldCheck className="h-16 w-16 text-indigo-400" />
            <h1 className="text-7xl font-black tracking-[12px] bg-gradient-to-r from-[#FF6700] via-orange-400 to-amber-400 bg-clip-text text-transparent">
              The Foundry
            </h1>
            <Zap className="h-12 w-12 text-amber-400" />
          </div>
        </div>

        <p className="text-2xl text-zinc-300 tracking-[4px] uppercase mb-4 animate-slideIn" style={{ animationDelay: "0.3s", opacity: 0, animationFillMode: "forwards" }}>
          AI-Powered Multi-Model Code Builder
        </p>

        <p className="text-lg text-zinc-500 mb-12 animate-slideIn" style={{ animationDelay: "0.5s", opacity: 0, animationFillMode: "forwards" }}>
          Built in 7 weeks. One person. Zero prior coding experience.
        </p>

        <div className="flex justify-center gap-16 animate-slideIn" style={{ animationDelay: "0.7s", opacity: 0, animationFillMode: "forwards" }}>
          <StatCounter value={stats.modules} label="Modules" />
          <StatCounter value={stats.models} label="Models" />
          <StatCounter value={stats.providers} label="Providers" />
        </div>
      </div>
    </div>
  );
}

function StatCounter({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-5xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-sm text-zinc-500 uppercase tracking-[3px] mt-2">{label}</div>
    </div>
  );
}

function Step2Problem() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-4xl mx-auto">
        <h2 className="text-5xl font-black mb-12 text-red-400 animate-slideIn">
          The Problem
        </h2>
        <p className="text-2xl text-zinc-300 leading-relaxed animate-slideIn" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
          AI tools are <span className="text-amber-400 font-bold">siloed</span>.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-8">
          {[
            { icon: MessageSquare, text: "ChatGPT does chat", color: "text-blue-400", delay: "0.4s" },
            { icon: Code2, text: "Cursor does code", color: "text-purple-400", delay: "0.5s" },
            { icon: Swords, text: "Nothing does everything", color: "text-orange-400", delay: "0.6s" },
          ].map((item, i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-scaleIn"
              style={{ animationDelay: item.delay, opacity: 0, animationFillMode: "forwards" }}
            >
              <item.icon className={cn("h-12 w-12 mx-auto mb-4", item.color)} />
              <p className="text-zinc-400">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="text-xl text-zinc-500 mt-12 animate-slideIn" style={{ animationDelay: "0.8s", opacity: 0, animationFillMode: "forwards" }}>
          No single platform lets you <span className="text-white">build, test, debate, audit, and fix</span> — all in one place.
        </p>
      </div>
    </div>
  );
}

function Step3Solution() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-4xl font-black mb-4 text-emerald-400 animate-slideIn">
          The Foundry is a unified AI operations platform.
        </h2>
        <p className="text-zinc-500 mb-12 animate-slideIn" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards" }}>
          16 modules. One interface. Complete AI workflow.
        </p>

        <div className="grid grid-cols-8 gap-3">
          {MODULES.map((mod, i) => (
            <div
              key={mod.name}
              className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 transition-colors animate-scaleIn"
              style={{ animationDelay: `${i * 0.05 + 0.2}s`, opacity: 0, animationFillMode: "forwards" }}
            >
              <span className="text-2xl block mb-2">{mod.icon}</span>
              <span className="text-xs font-bold" style={{ color: mod.color }}>
                {mod.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3_5Engine() {
  const [configStep, setConfigStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setConfigStep((prev) => (prev + 1) % 9);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const agentCounts = [1, 2, 3, 2, 3, 1, 2, 3, 2];
  const roles = ["Builder", "Reviewer", "Judge", "Analyst", "Builder", "Reviewer", "Judge", "Analyst", "Builder"];
  const providers = ["Claude", "GPT", "DeepSeek", "Gemini", "Claude", "GPT", "DeepSeek", "Gemini", "Claude"];
  const providerColors: Record<string, string> = {
    Claude: "#f97316",
    GPT: "#22c55e",
    DeepSeek: "#8b5cf6",
    Gemini: "#3b82f6",
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-6xl font-black mb-3 animate-slideIn">
          <span className="text-amber-400">THE ENGINE</span>
        </h2>
        <p className="text-2xl text-zinc-300 mb-8 animate-slideIn" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
          One Architecture Powers Everything
        </p>

        {/* Larger radial diagram */}
        <div className="relative w-[520px] h-[520px] mx-auto mb-8">
          {/* Center hub - bigger */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-36 h-36 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center animate-enginePulse shadow-[0_0_80px_rgba(251,191,36,0.5)]">
              <div className="text-center">
                <div className="text-sm font-black text-white leading-tight">Agent</div>
                <div className="text-sm font-black text-white leading-tight">Orchestration</div>
                <div className="text-sm font-black text-white leading-tight">Engine</div>
              </div>
            </div>
          </div>

          {ENGINE_NODES.map((node, i) => {
            const radius = 210; // Larger radius
            const angleRad = (node.angle - 90) * (Math.PI / 180);
            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;

            return (
              <div key={node.name}>
                <svg
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none"
                  style={{ opacity: 0, animation: `fadeIn 0.3s ease-out ${i * 0.1 + 0.5}s forwards` }}
                >
                  <line
                    x1="260"
                    y1="260"
                    x2={260 + x}
                    y2={260 + y}
                    stroke="rgba(251, 191, 36, 0.4)"
                    strokeWidth="2"
                  />
                </svg>

                {/* Larger node labels */}
                <div
                  className="absolute px-3 py-1.5 rounded-lg bg-zinc-800 border border-amber-500/50 flex items-center justify-center"
                  style={{
                    top: `calc(50% + ${y}px - 14px)`,
                    left: `calc(50% + ${x}px - 44px)`,
                    opacity: 0,
                    animation: `scaleIn 0.4s ease-out ${i * 0.1 + 0.5}s forwards`,
                  }}
                >
                  <span className="text-xs font-bold text-amber-400 whitespace-nowrap">{node.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Larger text */}
        <div className="space-y-2 mb-8">
          <p className="text-xl text-zinc-300 animate-slideIn" style={{ animationDelay: "2s", opacity: 0, animationFillMode: "forwards" }}>
            Every feature is the same pattern.
          </p>
          <p className="text-xl text-zinc-300 animate-slideIn" style={{ animationDelay: "2.5s", opacity: 0, animationFillMode: "forwards" }}>
            Multiple agents. Assigned roles. Structured decisions.
          </p>
          <p className="text-xl text-amber-400 font-bold animate-slideIn" style={{ animationDelay: "3s", opacity: 0, animationFillMode: "forwards" }}>
            The only difference is the configuration.
          </p>
        </div>

        {/* Larger configuration panel */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 max-w-md mx-auto animate-slideIn" style={{ animationDelay: "3.5s", opacity: 0, animationFillMode: "forwards" }}>
          <div className="text-sm text-zinc-500 mb-3 font-bold tracking-wider">CONFIGURATION</div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">Agents</span>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${(agentCounts[configStep] / 3) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-amber-400 w-4">{agentCounts[configStep]}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">Role</span>
            <div className="bg-zinc-800 px-3 py-1 rounded text-sm font-bold text-cyan-400 min-w-[80px] text-center transition-all duration-300">
              {roles[configStep]}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Provider</span>
            <div
              className="px-3 py-1 rounded text-sm font-bold min-w-[80px] text-center transition-all duration-300"
              style={{ backgroundColor: `${providerColors[providers[configStep]]}20`, color: providerColors[providers[configStep]] }}
            >
              {providers[configStep]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step9Forensic() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-black mb-4 text-center animate-slideIn">
          <span className="text-rose-400">Forensic Log</span>
        </h2>
        <p className="text-center text-zinc-500 mb-8 animate-slideIn" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards" }}>
          Every AI interaction logged with blockchain-style hash chains. Tamper-proof audit trail.
        </p>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 animate-scaleIn" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
          <div className="space-y-3">
            {[
              { time: "14:32:05", action: "User prompt sent to Claude", hash: "a7b3..." },
              { time: "14:32:08", action: "Response received (1,247 tokens)", hash: "f2c1..." },
              { time: "14:33:12", action: "User prompt sent to GPT-4", hash: "8d4e...", suspicious: true },
              { time: "14:33:15", action: "Response flagged for review", hash: "3a9f..." },
            ].map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg",
                  entry.suspicious ? "bg-red-900/20 border border-red-800/50" : "bg-zinc-800"
                )}
              >
                <div className="text-xs text-zinc-500 font-mono w-20">{entry.time}</div>
                <div className="flex-1 text-sm text-zinc-300">{entry.action}</div>
                <div className="text-xs font-mono text-zinc-600">{entry.hash}</div>
                {entry.suspicious && (
                  <button className="px-2 py-1 bg-red-600 rounded text-xs font-bold">
                    Diagnose
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step11Pipelines() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-black mb-4 text-center animate-slideIn">
          <span className="text-emerald-400">Cross-Module Pipelines</span>
        </h2>
        <p className="text-center text-zinc-500 mb-10 animate-slideIn" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards" }}>
          Every module talks to every other module.
        </p>

        <div className="space-y-4">
          {PIPELINES.map((pipeline, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-4 animate-slideIn"
              style={{ animationDelay: `${i * 0.1 + 0.2}s`, opacity: 0, animationFillMode: "forwards" }}
            >
              <div className="w-32 py-2 px-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                <span className="text-sm font-bold" style={{ color: pipeline.color }}>
                  {pipeline.from}
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-16 h-0.5" style={{ backgroundColor: pipeline.color }} />
                <ArrowRight className="h-5 w-5" style={{ color: pipeline.color }} />
              </div>
              <div className="w-32 py-2 px-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                <span className="text-sm font-bold" style={{ color: pipeline.color }}>
                  {pipeline.to}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step12Security() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-black mb-8 text-center animate-slideIn">
          <span className="text-red-400">Security</span>
        </h2>

        <div className="grid grid-cols-2 gap-6">
          {[
            { icon: "✈️", title: "Air-Gap Mode", desc: "Block all cloud APIs. Ollama-only. Full network isolation." },
            { icon: "🔑", title: "PIN Lock", desc: "SHA-256 hashed PIN. Auto-lock timeout. Encrypted storage." },
            { icon: "📁", title: "Path Sandboxing", desc: "Builder sandboxed to project directory. No traversal allowed." },
            { icon: "🚫", title: "Command Blocking", desc: "Dangerous commands blocked. All operations forensically logged." },
          ].map((item, i) => (
            <div
              key={item.title}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 animate-scaleIn"
              style={{ animationDelay: `${i * 0.1 + 0.2}s`, opacity: 0, animationFillMode: "forwards" }}
            >
              <span className="text-3xl block mb-3">{item.icon}</span>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step13Models() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-black mb-4 text-center animate-slideIn">
          <span className="text-indigo-400">Model Agnostic</span>
        </h2>
        <p className="text-center text-zinc-500 mb-10 animate-slideIn" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards" }}>
          49 models. Swap any model anywhere. Local or cloud. Your choice.
        </p>

        <div className="grid grid-cols-6 gap-4">
          {PROVIDERS.map((provider, i) => (
            <div
              key={provider.name}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center hover:border-zinc-600 transition-colors animate-scaleIn"
              style={{ animationDelay: `${i * 0.1 + 0.2}s`, opacity: 0, animationFillMode: "forwards" }}
            >
              <span className="text-3xl block mb-2">{provider.icon}</span>
              <div className="text-sm font-bold" style={{ color: provider.color }}>
                {provider.name}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{provider.models} models</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step14Closing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-3xl mx-auto">
        <div className="mb-8 animate-scaleIn">
          <h1 className="text-5xl font-black tracking-[8px] bg-gradient-to-r from-[#FF6700] via-orange-400 to-amber-400 bg-clip-text text-transparent mb-4">
            The Foundry
          </h1>
          <p className="text-xl text-zinc-400">
            One platform. Every AI capability.
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6 mb-8 animate-slideIn" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
          <p className="text-lg text-zinc-300 mb-2">
            Everything you just watched was <span className="text-emerald-400 font-bold">simulated in real-time</span>.
          </p>
          <p className="text-zinc-400">
            The same patterns. The same flows. The same architecture.
          </p>
          <p className="text-zinc-400">
            Running on your machine. With your models. Under your control.
          </p>
        </div>

        <p className="text-zinc-500 mb-8 italic animate-slideIn" style={{ animationDelay: "0.3s", opacity: 0, animationFillMode: "forwards" }}>
          &ldquo;Built by one person who wanted to know if the AI was telling the truth.&rdquo;
        </p>

        <button
          onClick={onLaunch}
          className="px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 rounded-xl text-lg font-bold flex items-center gap-3 mx-auto hover:opacity-90 transition-opacity animate-scaleIn shadow-lg shadow-indigo-500/30"
          style={{ animationDelay: "0.4s", opacity: 0, animationFillMode: "forwards" }}
        >
          <Rocket className="h-6 w-6" />
          Launch App
        </button>
      </div>
    </div>
  );
}
