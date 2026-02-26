"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@sarge/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HelperType,
  TriggerMode,
  HELPER_TYPES,
  TRIGGER_MODE_LABELS,
  useBuilderHelpersStore,
} from "../stores/builderHelpersStore";
import { getDefaultPrompt } from "../lib/helperPrompts";
import { useModelStore } from "@sarge/core";
import { fetchOllamaModels, type LocalModel } from "@sarge/core";
import { providers } from "@sarge/core";
import { getOllamaFriendlyName } from "@sarge/core";

interface AddHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddHelperModal({ isOpen, onClose }: AddHelperModalProps) {
  // Step 1: Select type, Step 2: Configure
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<HelperType | null>(null);

  // Configuration state
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("");
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("after_build");
  const [customPrompt, setCustomPrompt] = useState("");

  // Models
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const { getEffectiveModels } = useModelStore();
  const cloudModels = providers
    .filter((p) => p.id !== "ollama")
    .flatMap((p) =>
      getEffectiveModels(p.id).map((m: { id: string; name: string }) => ({
        ...m,
        provider: p.id,
        providerName: p.name,
      }))
    );

  // Store
  const addHelper = useBuilderHelpersStore((s) => s.addHelper);

  // Fetch Ollama models
  useEffect(() => {
    fetchOllamaModels()
      .then(setOllamaModels)
      .catch(() => setOllamaModels([]));
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedType(null);
      setName("");
      setProvider("ollama");
      setModel("");
      setTriggerMode("after_build");
      setCustomPrompt("");
    }
  }, [isOpen]);

  // When type is selected, set default name
  useEffect(() => {
    if (selectedType) {
      setName(HELPER_TYPES[selectedType].name);
      setCustomPrompt(getDefaultPrompt(selectedType));
    }
  }, [selectedType]);

  const handleSelectType = (type: HelperType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleAdd = () => {
    if (!selectedType || !model) return;

    addHelper({
      type: selectedType,
      name: name || HELPER_TYPES[selectedType].name,
      icon: HELPER_TYPES[selectedType].icon,
      provider,
      model,
      systemPrompt: customPrompt || getDefaultPrompt(selectedType),
      triggerMode,
      isActive: true,
      isPaused: false,
    });

    onClose();
  };

  const handleBack = () => {
    setStep(1);
    setSelectedType(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={handleBack}
                className="p-1 -ml-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            {step === 1 ? "Add AI Helper" : `Configure ${selectedType ? HELPER_TYPES[selectedType].name : "Helper"}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select Helper Type */}
        {step === 1 && (
          <div className="p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Choose a helper to assist you while building:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(HELPER_TYPES) as HelperType[]).map((type) => {
                const info = HELPER_TYPES[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                      "border-zinc-200 dark:border-zinc-700",
                      "hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10",
                      "focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{info.icon}</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {info.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {info.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configure Helper */}
        {step === 2 && selectedType && (
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Helper Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={HELPER_TYPES[selectedType].name}
              />
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Model
              </label>
              <div className="flex gap-2">
                {/* Provider */}
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModel("");
                  }}
                  className="w-24 px-2 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="ollama">Local</option>
                  {providers
                    .filter((p) => p.id !== "ollama")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>

                {/* Model */}
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="">Select model...</option>
                  {provider === "ollama"
                    ? ollamaModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {getOllamaFriendlyName(m.id)}
                        </option>
                      ))
                    : cloudModels
                        .filter((m: { provider: string }) => m.provider === provider)
                        .map((m: { id: string; name: string }) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                </select>
              </div>
            </div>

            {/* Trigger Mode */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                When to run
              </label>
              <div className="space-y-2">
                {(Object.keys(TRIGGER_MODE_LABELS) as TriggerMode[]).map((mode) => {
                  const info = TRIGGER_MODE_LABELS[mode];
                  return (
                    <label
                      key={mode}
                      className={cn(
                        "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                        triggerMode === mode
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      )}
                    >
                      <input
                        type="radio"
                        name="triggerMode"
                        value={mode}
                        checked={triggerMode === mode}
                        onChange={() => setTriggerMode(mode)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {info.label}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {info.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Prompt (collapsed by default, expanded for custom type) */}
            {selectedType === "custom" && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  System Prompt
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Enter the system prompt for your custom helper..."
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {step === 2 && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!model}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Add Helper
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
