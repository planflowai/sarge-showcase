"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Loader2, Trash2, ChevronDown, Shield, Plus, Pencil, X, Check } from "lucide-react";
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
import { fetchOllamaModels, type LocalModel } from "@sarge/core";
import type { ChatColumn as ChatColumnType } from "../../stores/parallelChatStore";
import type { Provider, Message } from "@sarge/core";

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

  // Local models state (Ollama only - LM Studio not supported in multi-chat due to resource constraints)
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Hydrate roles on mount
  useEffect(() => {
    if (!rolesHydrated) hydrateRoles();
  }, [rolesHydrated, hydrateRoles]);

  // Fetch Ollama models on mount
  useEffect(() => {
    setOllamaLoading(true);
    fetchOllamaModels()
      .then(models => {
        console.log('[ChatColumn] Ollama models:', models);
        setOllamaModels(models);
      })
      .catch((err) => {
        console.error('[ChatColumn] Ollama fetch error:', err);
        setOllamaModels([]);
      })
      .finally(() => setOllamaLoading(false));
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

  // Get display name for current model (LM Studio not supported in multi-chat)
  const modelDisplayName = column.provider === "ollama"
    ? getOllamaFriendlyName(column.model)
    : availableModels.find(m => m.id === column.model)?.name || column.model;

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
    if (role?.isDefault) return; // Can't delete defaults
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

  // Get cloud providers with models
  const cloudProviders = providers.filter(p => p.type === "cloud" && getEffectiveModels(p.id).length > 0);

  return (
    <div className="flex flex-col h-full border-r border-zinc-800 last:border-r-0 bg-zinc-900">
      {/* Column Header — model pill + role + clear */}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1.5 px-2 py-2">
          {/* Model pill — single dropdown with all providers */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-orange-500/50 transition-all truncate max-w-[160px]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: providerConfig?.color }}
                />
                <span className="truncate">{modelDisplayName}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 max-h-80 overflow-y-auto">
              {/* Cloud providers */}
              {cloudProviders.map(provider => (
                <div key={provider.id}>
                  <DropdownMenuLabel className="text-[10px] text-zinc-400 flex items-center gap-1 py-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: provider.color }} />
                    {provider.name}
                  </DropdownMenuLabel>
                  {getEffectiveModels(provider.id).map(model => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => onModelChange(provider.id, model.id)}
                      className={cn(
                        "text-xs pl-4",
                        column.provider === provider.id && column.model === model.id && "bg-orange-900/30"
                      )}
                    >
                      {model.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
              {/* Ollama */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-zinc-400 flex items-center gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                Ollama
                {ollamaLoading && <Loader2 className="h-2.5 w-2.5 animate-spin ml-1" />}
              </DropdownMenuLabel>
              {ollamaModels.length > 0 ? (
                ollamaModels.map(model => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange("ollama", model.id)}
                    className={cn(
                      "text-xs pl-4",
                      column.provider === "ollama" && column.model === model.id && "bg-orange-900/30"
                    )}
                  >
                    {getOllamaFriendlyName(model.id)}
                  </DropdownMenuItem>
                ))
              ) : !ollamaLoading ? (
                <DropdownMenuItem disabled className="text-xs text-zinc-500 pl-4">
                  No Ollama models
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Role pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all truncate",
                  currentRole
                    ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                    : "border-zinc-700 text-zinc-500 bg-zinc-800"
                )}
              >
                <Shield className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{currentRole ? currentRole.name : "Role"}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Assign Role</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onRoleChange(undefined)}
                className={cn("text-xs", !column.roleId && "bg-zinc-800")}
              >
                No Role (General)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {roles.map(role => (
                <DropdownMenuItem
                  key={role.id}
                  onClick={() => onRoleChange(role.id)}
                  className={cn(
                    "text-xs flex items-center justify-between",
                    column.roleId === role.id && "bg-zinc-800"
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
              <DropdownMenuItem onClick={handleStartAddRole} className="text-xs text-indigo-600 dark:text-indigo-400">
                <Plus className="h-3 w-3 mr-1" />
                Add New Role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear */}
          <button
            onClick={onClear}
            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0 ml-auto"
            title="Clear conversation"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Role Editor Modal */}
        {showRoleEditor && (
          <div className="px-3 pb-2 space-y-2 border-t border-zinc-700 pt-2 bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-zinc-400">
                {editingRoleId ? "Edit Role" : "New Role"}
              </span>
              <button onClick={handleCancelRoleEdit} className="text-zinc-400 hover:text-zinc-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={roleNameInput}
              onChange={(e) => setRoleNameInput(e.target.value)}
              placeholder="Role name..."
              className="h-7 text-xs"
            />
            <textarea
              value={rolePromptInput}
              onChange={(e) => setRolePromptInput(e.target.value)}
              placeholder="System prompt..."
              className="w-full h-16 text-xs rounded border border-zinc-600 bg-zinc-800 px-2 py-1 resize-none text-zinc-200"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={handleCancelRoleEdit} className="h-6 text-[10px]">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRole}
                disabled={!roleNameInput.trim() || !rolePromptInput.trim()}
                className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700"
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
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3 bg-zinc-900"
      >
        {column.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs">
            <p>No messages yet</p>
            <p className="text-zinc-600 mt-1">Type below to start</p>
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
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area — hidden when parent provides a unified send bar */}
      {!hideInput && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 bg-zinc-50 dark:bg-zinc-900">
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
                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
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
              className="h-9 w-9 p-0 bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
