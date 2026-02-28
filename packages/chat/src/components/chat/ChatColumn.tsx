"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Loader2, Trash2, ChevronDown, Shield, Plus, Pencil, X, Check, Cloud, Cpu, FlaskConical, Monitor } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@sarge/core";
import { providers } from "@sarge/core";
import { useModelStore } from "@sarge/core";
import { useRoleStore } from "@sarge/core";
import { getOllamaFriendlyName } from "@sarge/core";
import { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from "@sarge/core";
import type { ChatColumn as ChatColumnType } from "../../stores/parallelChatStore";
import type { Provider, Message } from "@sarge/core";

// Provider group definitions with colors/icons
const PROVIDER_GROUPS = [
  { id: "cloud" as const, label: "Cloud", icon: Cloud, color: "text-cyan-400", bgActive: "bg-cyan-500/15 border-cyan-500/40", bgHover: "hover:bg-cyan-500/10" },
  { id: "ollama" as const, label: "Ollama", icon: Cpu, color: "text-amber-400", bgActive: "bg-amber-500/15 border-amber-500/40", bgHover: "hover:bg-amber-500/10" },
  { id: "huggingface" as const, label: "HF", icon: FlaskConical, color: "text-yellow-400", bgActive: "bg-yellow-500/15 border-yellow-500/40", bgHover: "hover:bg-yellow-500/10" },
  { id: "lmstudio" as const, label: "LM Studio", icon: Monitor, color: "text-emerald-400", bgActive: "bg-emerald-500/15 border-emerald-500/40", bgHover: "hover:bg-emerald-500/10" },
] as const;

type ProviderGroupId = typeof PROVIDER_GROUPS[number]["id"];

interface ChatColumnProps {
  column: ChatColumnType;
  onModelChange: (provider: Provider, model: string) => void;
  onRoleChange: (roleId: string | undefined) => void;
  onSend: (content: string) => void;
  onClear: () => void;
  onShare?: (message: Message, targetColumnId: string) => void;
  onShareToAll?: (message: Message) => void;
  otherColumns: ChatColumnType[];
  isParallelMode: boolean;
  hideInput?: boolean;
}

export function ChatColumn({
  column,
  onModelChange,
  onRoleChange,
  onSend,
  onClear,
  onShare,
  onShareToAll,
  otherColumns,
  isParallelMode,
  hideInput,
}: ChatColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const { getEffectiveModels } = useModelStore();

  // Role state
  const { roles, hydrated: rolesHydrated, hydrate: hydrateRoles, addRole, updateRole, deleteRole, getRoleById } = useRoleStore();
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleNameInput, setRoleNameInput] = useState("");
  const [rolePromptInput, setRolePromptInput] = useState("");

  // Local models state
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [lmStudioModels, setLmStudioModels] = useState<LocalModel[]>([]);
  const [lmStudioLoading, setLmStudioLoading] = useState(false);

  // Hydrate roles on mount
  useEffect(() => {
    if (!rolesHydrated) hydrateRoles();
  }, [rolesHydrated, hydrateRoles]);

  // Fetch local models on mount
  useEffect(() => {
    setOllamaLoading(true);
    fetchOllamaModels()
      .then(models => setOllamaModels(models))
      .catch(() => setOllamaModels([]))
      .finally(() => setOllamaLoading(false));

    setLmStudioLoading(true);
    fetchLMStudioModels()
      .then(models => setLmStudioModels(models))
      .catch(() => setLmStudioModels([]))
      .finally(() => setLmStudioLoading(false));
  }, []);

  // Get current role
  const currentRole = column.roleId ? getRoleById(column.roleId) : null;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [column.messages]);

  const handleSend = () => {
    if (!input.trim() || column.sending) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const providerConfig = providers.find(p => p.id === column.provider);
  const availableModels = getEffectiveModels(column.provider);

  // Get display name for current model
  const modelDisplayName = column.provider === "ollama"
    ? getOllamaFriendlyName(column.model)
    : column.provider === "lmstudio"
    ? column.model
    : availableModels.find(m => m.id === column.model)?.name || column.model;

  // Determine which provider group is active
  const getActiveGroup = (): ProviderGroupId | null => {
    if (!column.provider) return null;
    if (column.provider === "ollama") return "ollama";
    if (column.provider === "lmstudio") return "lmstudio";
    return "cloud";
  };
  const activeGroup = getActiveGroup();

  // Get cloud providers with models
  const cloudProviders = providers.filter(p => p.type === "cloud" && getEffectiveModels(p.id).length > 0);

  // Role CRUD handlers
  const handleStartAddRole = () => {
    setEditingRoleId(null);
    setRoleNameInput("");
    setRolePromptInput("");
    setShowRoleEditor(true);
  };

  const handleStartEditRole = (roleId: string) => {
    const role = getRoleById(roleId);
    if (role) {
      setEditingRoleId(roleId);
      setRoleNameInput(role.name);
      setRolePromptInput(role.systemPrompt);
      setShowRoleEditor(true);
    }
  };

  const handleSaveRole = () => {
    if (!roleNameInput.trim() || !rolePromptInput.trim()) return;
    if (editingRoleId) {
      updateRole(editingRoleId, roleNameInput.trim(), rolePromptInput.trim());
    } else {
      addRole(roleNameInput.trim(), rolePromptInput.trim());
    }
    setShowRoleEditor(false);
    setEditingRoleId(null);
    setRoleNameInput("");
    setRolePromptInput("");
  };

  const handleDeleteRole = (roleId: string) => {
    const role = getRoleById(roleId);
    if (role?.isDefault) return;
    deleteRole(roleId);
    if (column.roleId === roleId) {
      onRoleChange(undefined);
    }
  };

  const handleCancelRoleEdit = () => {
    setShowRoleEditor(false);
    setEditingRoleId(null);
    setRoleNameInput("");
    setRolePromptInput("");
  };

  return (
    <div className="flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 bg-white dark:bg-zinc-900">
      {/* Column Header — provider icons + model name */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80">
        {/* Provider group buttons */}
        <div className="flex items-center gap-1 px-2 pt-2 pb-1">
          {PROVIDER_GROUPS.map(group => {
            const Icon = group.icon;
            const isActive = activeGroup === group.id;
            const isHF = group.id === "huggingface";

            if (isHF) {
              // Hugging Face — coming soon, no dropdown
              return (
                <button
                  key={group.id}
                  disabled
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all opacity-40 cursor-not-allowed",
                    "border-zinc-300 dark:border-zinc-700 text-zinc-500"
                  )}
                  title="Hugging Face — Coming Soon"
                >
                  <Icon className={cn("h-4 w-4", group.color)} />
                  <span className="hidden xl:inline">{group.label}</span>
                </button>
              );
            }

            return (
              <DropdownMenu key={group.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all",
                      isActive
                        ? `${group.bgActive} border`
                        : `border-transparent text-zinc-500 dark:text-zinc-400 ${group.bgHover}`
                    )}
                  >
                    <Icon className={cn("h-4 w-4", group.color)} />
                    <span className="hidden xl:inline">{group.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                  {group.id === "cloud" && (
                    <>
                      {cloudProviders.map(provider => (
                        <div key={provider.id}>
                          <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 py-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: provider.color }} />
                            {provider.name}
                          </DropdownMenuLabel>
                          {getEffectiveModels(provider.id).map(model => (
                            <DropdownMenuItem
                              key={model.id}
                              onClick={() => onModelChange(provider.id, model.id)}
                              className={cn(
                                "text-sm pl-5",
                                column.provider === provider.id && column.model === model.id && "bg-cyan-500/10 text-cyan-400 dark:text-cyan-300"
                              )}
                            >
                              {model.name}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      ))}
                      {cloudProviders.length === 0 && (
                        <DropdownMenuItem disabled className="text-sm text-zinc-500">
                          No cloud models configured
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  {group.id === "ollama" && (
                    <>
                      <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 py-1">
                        <Cpu className="h-3 w-3 text-amber-400" />
                        Local Ollama Models
                        {ollamaLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                      </DropdownMenuLabel>
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map(model => (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => onModelChange("ollama", model.id)}
                            className={cn(
                              "text-sm pl-5",
                              column.provider === "ollama" && column.model === model.id && "bg-amber-500/10 text-amber-400 dark:text-amber-300"
                            )}
                          >
                            {getOllamaFriendlyName(model.id)}
                          </DropdownMenuItem>
                        ))
                      ) : !ollamaLoading ? (
                        <DropdownMenuItem disabled className="text-sm text-zinc-500">
                          No Ollama models found
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  )}

                  {group.id === "lmstudio" && (
                    <>
                      <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 py-1">
                        <Monitor className="h-3 w-3 text-emerald-400" />
                        LM Studio Models
                        {lmStudioLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                      </DropdownMenuLabel>
                      {lmStudioModels.length > 0 ? (
                        lmStudioModels.map(model => (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => onModelChange("lmstudio", model.id)}
                            className={cn(
                              "text-sm pl-5",
                              column.provider === "lmstudio" && column.model === model.id && "bg-emerald-500/10 text-emerald-400 dark:text-emerald-300"
                            )}
                          >
                            {model.name}
                          </DropdownMenuItem>
                        ))
                      ) : !lmStudioLoading ? (
                        <DropdownMenuItem disabled className="text-sm text-zinc-500">
                          No LM Studio models found
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}

          {/* Clear button — far right */}
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-auto"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Active model name + role */}
        <div className="flex items-center gap-2 px-3 pb-2">
          {/* Model name — big and bold */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {providerConfig && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: providerConfig.color }}
              />
            )}
            <span className={cn(
              "text-sm font-bold truncate",
              activeGroup === "cloud" ? "text-cyan-400" :
              activeGroup === "ollama" ? "text-amber-400" :
              activeGroup === "lmstudio" ? "text-emerald-400" :
              "text-zinc-500"
            )}>
              {column.model ? modelDisplayName : "Select a model"}
            </span>
          </div>

          {/* Role pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-all truncate",
                  currentRole
                    ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 bg-gray-200 dark:bg-zinc-800"
                )}
              >
                <Shield className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{currentRole ? currentRole.name : "Role"}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Assign Role</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onRoleChange(undefined)}
                className={cn("text-sm", !column.roleId && "bg-gray-200 dark:bg-zinc-800")}
              >
                No Role (General)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {roles.map(role => (
                <DropdownMenuItem
                  key={role.id}
                  onClick={() => onRoleChange(role.id)}
                  className={cn(
                    "text-sm flex items-center justify-between",
                    column.roleId === role.id && "bg-gray-200 dark:bg-zinc-800"
                  )}
                >
                  <span className="truncate">{role.name}{role.isDefault ? " (Default)" : ""}</span>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEditRole(role.id); }}
                      className="p-0.5 hover:text-indigo-500"
                      title="Edit role"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {!role.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                        className="p-0.5 hover:text-red-500"
                        title="Delete role"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleStartAddRole} className="text-sm text-indigo-600 dark:text-indigo-400">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add New Role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Role Editor Modal */}
        {showRoleEditor && (
          <div className="px-3 pb-2 space-y-2 border-t border-zinc-300 dark:border-zinc-700 pt-2 bg-gray-200/50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {editingRoleId ? "Edit Role" : "New Role"}
              </span>
              <button onClick={handleCancelRoleEdit} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={roleNameInput}
              onChange={(e) => setRoleNameInput(e.target.value)}
              placeholder="Role name..."
              className="h-8 text-sm"
            />
            <textarea
              value={rolePromptInput}
              onChange={(e) => setRolePromptInput(e.target.value)}
              placeholder="System prompt..."
              className="w-full h-16 text-sm rounded border border-zinc-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 px-2 py-1 resize-none text-zinc-800 dark:text-zinc-200"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={handleCancelRoleEdit} className="h-7 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRole}
                disabled={!roleNameInput.trim() || !rolePromptInput.trim()}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 bg-white dark:bg-zinc-900"
      >
        {column.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-sm gap-1">
            <p className="font-medium">No messages yet</p>
            <p className="text-zinc-500 dark:text-zinc-600 text-xs">Select a model and start typing</p>
          </div>
        ) : (
          column.messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              parallelMode={isParallelMode}
              columnId={column.id}
              otherColumns={otherColumns}
              onShare={onShare}
              onShareToAll={onShareToAll}
            />
          ))
        )}

        {/* Sending indicator */}
        {column.sending && (
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-column Input Area */}
      {!hideInput && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={column.sending}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-lg px-3 py-2 text-sm",
                "bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200",
                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "min-h-[36px] max-h-[120px]"
              )}
              style={{
                height: "36px",
                overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
              }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || column.sending}
              className="h-9 w-9 p-0 bg-orange-600 hover:bg-orange-500 transition-all hover:shadow-[0_0_10px_rgba(249,115,22,0.3)]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
