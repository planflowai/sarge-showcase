"use client";

import { TOGGLE_INFO, type ProjectToggles } from "@/lib/types/project";

interface ToggleSelectorProps {
  toggles: ProjectToggles;
  onChange: (toggles: ProjectToggles) => void;
}

export function ToggleSelector({ toggles, onChange }: ToggleSelectorProps) {
  const handleToggle = (key: keyof ProjectToggles) => {
    onChange({ ...toggles, [key]: !toggles[key] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Project Features
        </h3>
        <span className="text-xs text-zinc-300">
          {Object.values(toggles).filter(Boolean).length} selected
        </span>
      </div>

      {TOGGLE_INFO.map((toggle, i) => {
        const isOn = toggles[toggle.key];
        const isProfessional = i < 4;

        return (
          <button
            key={toggle.key}
            type="button"
            onClick={() => handleToggle(toggle.key)}
            className={`w-full flex items-center gap-4 p-3 rounded-lg border transition-all text-left ${
              isOn
                ? "bg-zinc-800/80 border-zinc-600"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {/* Toggle switch */}
            <div
              className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                isOn ? "bg-opacity-100" : "bg-zinc-700"
              }`}
              style={{ backgroundColor: isOn ? toggle.color : undefined }}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${
                  isOn ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>

            {/* Label + description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold ${
                    isOn ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {toggle.label}
                </span>
                {isProfessional && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#FF6700]/20 text-[#FF6700] uppercase tracking-wider">
                    Pro
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">{toggle.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
