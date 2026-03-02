"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";
import type { Role } from "../lib/types";

const STORAGE_KEY = "ai-workbench-roles";

const DEFAULT_JUDGE_ROLE: Role = {
  id: "default-judge",
  name: "Unbiased Judge",
  systemPrompt: `You are an impartial judge in a structured research debate. Your rules:
1. You MUST NOT offer any personal opinion or take sides.
2. Summarize each participant's position objectively.
3. Identify points of 100% agreement across all participants (consensus — proven true).
4. Identify points of 100% disagreement (proven false — no chance of being true).
5. Identify debatable areas that need further research (gray zones).
6. Compile all citations and sources provided by participants.
7. Provide a confidence percentage (0-100%) for overall agreement.
8. You are blind to participant answers until all have completed.
9. Be completely unbiased — you do not care who is right.`,
  createdAt: new Date(),
  isDefault: true,
};

const DEFAULT_D1_ROLE: Role = {
  id: "default-d1-responder",
  name: "Factual Responder",
  systemPrompt: "You are a factual responder. Answer questions directly and accurately based on your knowledge. Be concise and precise.",
  createdAt: new Date(),
  isDefault: false,
};

const DEFAULT_D2_ROLE: Role = {
  id: "default-d2-checker",
  name: "Fact Checker",
  systemPrompt: "You are a fact checker. Verify the accuracy of previous responses. Point out errors, inconsistencies, or missing information. Be thorough and critical.",
  createdAt: new Date(),
  isDefault: false,
};

const DEFAULT_D3_ROLE: Role = {
  id: "default-d3-verifier",
  name: "Final Verifier",
  systemPrompt: "You are a final verifier. Review all previous responses and identify any contradictions or errors. Provide a comprehensive assessment of accuracy.",
  createdAt: new Date(),
  isDefault: false,
};

const DEFAULT_ROLES = [DEFAULT_JUDGE_ROLE, DEFAULT_D1_ROLE, DEFAULT_D2_ROLE, DEFAULT_D3_ROLE];

function loadRoles(): Role[] {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROLES;
    const parsed = JSON.parse(raw) as Role[];
    const roles = parsed.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
    }));
    // Ensure all default roles are present
    const defaultIds = new Set(DEFAULT_ROLES.map(r => r.id));
    const missingDefaults = DEFAULT_ROLES.filter(def => !roles.some(r => r.id === def.id));
    return [...missingDefaults, ...roles];
  } catch {
    return DEFAULT_ROLES;
  }
}

function saveRoles(roles: Role[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
  } catch {
    /* quota exceeded */
  }
}

interface RoleState {
  roles: Role[];
  hydrated: boolean;
  hydrate: () => void;
  addRole: (name: string, systemPrompt: string) => void;
  updateRole: (id: string, name: string, systemPrompt: string) => void;
  deleteRole: (id: string) => void;
  getRoleById: (id: string) => Role | undefined;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,
      hydrated: false,

      hydrate: () => {
        const roles = loadRoles();
        set({ roles, hydrated: true });
      },

      addRole: (name: string, systemPrompt: string) => {
        const newRole: Role = {
          id: `role-${Date.now()}`,
          name,
          systemPrompt,
          createdAt: new Date(),
          isDefault: false,
        };
        set((state) => {
          const updated = [...state.roles, newRole];
          saveRoles(updated);
          return { roles: updated };
        });
      },

      updateRole: (id: string, name: string, systemPrompt: string) => {
        set((state) => {
          const updated = state.roles.map((r) =>
            r.id === id && !r.isDefault ? { ...r, name, systemPrompt } : r
          );
          saveRoles(updated);
          return { roles: updated };
        });
      },

      deleteRole: (id: string) => {
        set((state) => {
          const updated = state.roles.filter((r) => r.id !== id || r.isDefault);
          saveRoles(updated);
          return { roles: updated };
        });
      },

      getRoleById: (id: string) => {
        return get().roles.find((r) => r.id === id);
      },
    }),
    {
      name: "role",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        roles: state.roles,
      }),
    }
  )
);
