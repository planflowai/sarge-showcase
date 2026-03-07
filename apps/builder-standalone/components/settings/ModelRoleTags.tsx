"use client";

import { useModelStore, ALL_MODEL_ROLES, type ModelRole } from "@sarge/core";

const ROLE_STYLES: Record<ModelRole, { active: string; label: string }> = {
  Builder: { active: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40", label: "Builder" },
  Trials:  { active: "bg-amber-500/20 text-amber-400 border-amber-500/40", label: "Trials" },
  Chat:    { active: "bg-sky-500/20 text-sky-400 border-sky-500/40", label: "Chat" },
  Image:   { active: "bg-pink-500/20 text-pink-400 border-pink-500/40", label: "Image" },
  Guardian:{ active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", label: "Guard" },
  Code:    { active: "bg-violet-500/20 text-violet-400 border-violet-500/40", label: "Code" },
};

// Only show roles that have actual consumers — currently only "Trials"
const VISIBLE_ROLES: ModelRole[] = ["Trials"];

export function ModelRoleTags({ modelId }: { modelId: string }) {
  const { modelRoles, setModelRole } = useModelStore();
  const roles = modelRoles[modelId] || [];

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {VISIBLE_ROLES.map((role) => {
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
            className={`text-xs font-medium px-2 py-0.5 rounded-md transition-all border ${
              active
                ? style.active
                : "bg-zinc-800/50 text-zinc-200 border-transparent hover:border-zinc-600 hover:text-zinc-300"
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
