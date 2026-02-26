"use client";

import { useAirGapStore } from "@/lib/stores/airGapStore";
import { Shield, XCircle, AlertTriangle, Radio, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AirGapBlockAlert() {
  const showBlockAlert = useAirGapStore((s) => s.showBlockAlert);
  const lastBlockedAttempt = useAirGapStore((s) => s.lastBlockedAttempt);
  const dismissBlockAlert = useAirGapStore((s) => s.dismissBlockAlert);
  const disableAirGap = useAirGapStore((s) => s.disableAirGap);

  if (!showBlockAlert || !lastBlockedAttempt) return null;

  const handleDisableAirGap = () => {
    disableAirGap();
    dismissBlockAlert();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-red-500/60 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header - Red warning */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <XCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Cloud Access Blocked</h2>
            <p className="text-red-100 text-sm">Air-Gap Mode is Active</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <p className="font-semibold text-amber-400 mb-1">Operation Blocked</p>
              <p>
                Attempted to access <span className="font-mono text-amber-300">{lastBlockedAttempt.provider}</span> for{" "}
                <span className="text-zinc-400">{lastBlockedAttempt.operation}</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <Plane className="h-5 w-5 text-amber-400 rotate-45" />
              <Shield className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="text-sm text-zinc-400">
              <p className="mb-2">
                <strong className="text-amber-300">Air-Gap Mode</strong> blocks all outbound network calls to cloud APIs.
              </p>
              <p>
                To use cloud providers, disable Air-Gap mode or switch to a local model (Ollama).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-800/50 flex items-center justify-end gap-3 border-t border-zinc-700">
          <Button
            variant="outline"
            onClick={handleDisableAirGap}
            className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
          >
            <Radio className="h-4 w-4 mr-2" />
            Go Online
          </Button>
          <Button
            onClick={dismissBlockAlert}
            className="bg-zinc-700 hover:bg-zinc-600"
          >
            Use Local Models
          </Button>
        </div>
      </div>
    </div>
  );
}
