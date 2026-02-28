"use client";

import { useEffect, useState } from "react";
import { providers, getCloudProviders, getLocalProviders } from "@/lib/providers";
import { useProviderStore } from "@/lib/stores/providerStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { ProviderBadge } from "./ProviderBadge";
import {
  fetchOllamaModels,
  fetchLMStudioModels,
  type LocalModel,
} from "@/lib/providers/localModels";
import { getOllamaFriendlyName, groupOllamaModels } from "@/lib/ollamaModelGroups";

export function ProviderSelector() {
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);
  const setProvider = useProviderStore((s) => s.setProvider);
  const setModel = useProviderStore((s) => s.setModel);
  const hydrated = useProviderStore((s) => s.hydrated);
  const hydrate = useProviderStore((s) => s.hydrate);

  const modelsHydrated = useModelStore((s) => s.hydrated);
  const hydrateModels = useModelStore((s) => s.hydrate);
  const getEffectiveModels = useModelStore((s) => s.getEffectiveModels);
  const getDisplayName = useModelStore((s) => s.getDisplayName);

  useEffect(() => {
    hydrate();
    if (!modelsHydrated) hydrateModels();
  }, [hydrate, modelsHydrated, hydrateModels]);

  const cloudProviders = getCloudProviders();
  const localProviders = getLocalProviders();
  const activeProvider = providers.find((p) => p.id === currentProvider);
  const isLocal = activeProvider?.type === "local";

  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocal) {
      setLocalModels([]);
      setLocalError(null);
      return;
    }

    setLocalLoading(true);
    setLocalError(null);

    // Use correct fetcher based on provider
    const isLMStudio = currentProvider === "lmstudio";
    const fetcher = isLMStudio ? fetchLMStudioModels : fetchOllamaModels;
    const label = isLMStudio ? "LM Studio" : "Ollama";

    fetcher()
      .then((models) => {
        setLocalModels(models);
        // Only set model if current model is not in the list (or no model selected)
        if (models.length > 0) {
          const storedModel = useProviderStore.getState().currentModel;
          const currentModelExists = models.some((m) => m.id === storedModel);
          if (!storedModel || !currentModelExists) {
            setModel(models[0].id);
          }
        }
      })
      .catch(() => {
        setLocalModels([]);
        setLocalError(`Make sure ${label} is running`);
      })
      .finally(() => {
        setLocalLoading(false);
      });
  }, [currentProvider, isLocal, setModel]);

  return (
    <div className="space-y-3">
      {/* Cloud Providers */}
      <div>
        <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Cloud
        </p>
        <div className="grid grid-cols-2 gap-1 justify-items-center">
          {cloudProviders.map((provider) => (
            <ProviderBadge
              key={provider.id}
              id={provider.id}
              name={provider.name}
              color={provider.color}
              isActive={currentProvider === provider.id}
              onClick={() => setProvider(provider.id)}
            />
          ))}
        </div>
      </div>

      {/* Local Providers */}
      <div>
        <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Local
        </p>
        <div className="flex flex-wrap gap-1 justify-center">
          {localProviders.map((provider) => (
            <ProviderBadge
              key={provider.id}
              id={provider.id}
              name={provider.name}
              color={provider.color}
              isActive={currentProvider === provider.id}
              onClick={() => setProvider(provider.id)}
            />
          ))}
        </div>
      </div>

      {/* Model selector */}
      {activeProvider && (
        <div>
          <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Model
          </p>

          {isLocal ? (
            localLoading ? (
              <p className="text-center text-xs text-zinc-500">Loading models...</p>
            ) : localError ? (
              <p className="text-center text-xs text-red-400">{localError}</p>
            ) : localModels.length === 0 ? (
              <p className="text-center text-xs text-zinc-500">No models found</p>
            ) : currentProvider === "lmstudio" ? (
              // LM Studio models - simple list without grouping
              <select
                value={currentModel}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
                title={currentModel}
              >
                {localModels.map((model) => (
                  <option key={model.id} value={model.id} title={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            ) : (
              // Ollama models - grouped display
              <select
                value={currentModel}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
                title={currentModel}
              >
                {groupOllamaModels(localModels.map(m => m.id)).map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.models.map((model) => (
                      <option key={model.id} value={model.id} title={model.id}>
                        {getDisplayName(model.id, model.name)}{model.hint ? ` · ${model.hint}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )
          ) : (
            <select
              value={currentModel}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500 truncate"
              title={currentModel}
            >
              {getEffectiveModels(activeProvider.id).map((model) => (
                <option key={model.id} value={model.id} title={model.id}>
                  {getDisplayName(model.id, model.name)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
