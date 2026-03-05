"use client";

import { useModelStore, ALL_MODEL_ROLES, type ModelRole } from "@sarge/core";

const ROLE_STYLES: Record<ModelRole, { active: string; label: string }> = {
  Builder: { active: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40", label: "B" },
  Trials:  { active: "bg-amber-500/20 text-amber-400 border-amber-500/40", label: "T" },
  Chat:    { active: "bg-sky-500/20 text-sky-400 border-sky-500/40", label: "C" },
  Image:   { active: "bg-pink-500/20 text-pink-400 border-pink-500/40", label: "I" },
  Guardian:{ active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", label: "G" },
  Code:    { active: "bg-violet-500/20 text-violet-400 border-violet-500/40", label: "X" },
};

export function ModelRoleTags({ modelId }: { modelId: string }) {
  const { modelRoles, setModelRole } = useModelStore();
  const roles = modelRoles[modelId] || [];

  return (
    <div className="flex gap-0.5">
      {ALL_MODEL_ROLES.map((role) => {
        const active = roles.includes(role);
        const style = ROLE_STYLES[role];
        return (
          <button
            key={role}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModelRole(modelId, role, !active);
            }}
            className={`text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded transition-all border ${
              active
                ? style.active
                : "bg-zinc-800/50 text-zinc-600 border-transparent hover:border-zinc-600"
            }`}
            title={`${active ? "Remove" : "Add"} ${role} role`}
          >
            {style.label}
          </button>
        );
      })}
    </div>
  );
}
