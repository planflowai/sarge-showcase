"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Wand2, Check, X } from "lucide-react";
import {
  useModelRegistryStore,
  type SargePool,
  type ModelCategory,
  type ModelRegistryEntry
} from "@sarge/core";

const CATEGORIES: { key: ModelCategory; label: string; desc: string }[] = [
  { key: 'general', label: 'Reasoning', desc: 'For SARGE debates' },
  { key: 'vision', label: 'Vision', desc: 'Image understanding' },
  { key: 'code', label: 'Code', desc: 'Programming' },
  { key: 'image_gen', label: 'Image Gen', desc: 'Creates images' },
  { key: 'video_gen', label: 'Video Gen', desc: 'Creates video' },
  { key: 'audio', label: 'Audio', desc: 'Speech/music' },
  { key: 'embedding', label: 'Embedding', desc: 'Vectors only' },
  { key: 'toy', label: 'Toy', desc: 'Too small' },
  { key: 'unknown', label: 'Unknown', desc: 'Needs classification' },
];

const STRENGTH_LABEL: Record<string, string> = { strong: 'Strong', medium: 'Med', weak: 'Weak' };
const STRENGTH_COLOR: Record<string, string> = {
  strong: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  weak: 'text-orange-600 dark:text-orange-400',
};

export function ModelRegistry() {
  const {
    registry, hydrated, hydrate, classifying,
    registerModels, toggleExcluded, setPools, classifyWithAI, getUnclassifiedModels, clearRegistry
  } = useModelRegistryStore();

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<ModelCategory>>(new Set(['image_gen', 'video_gen', 'audio', 'embedding']));

  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated, hydrate]);

  // Classification uses DeepSeek cloud API (cheap, fast, accurate)

  const handleScan = async () => {
    setScanning(true); setError(null);
    try {
      const res = await fetch('/api/models/scan');
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed');
      const data = await res.json();
      const entries: ModelRegistryEntry[] = (data.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.provider || 'ollama',
        category: m.category || 'unknown' as ModelCategory,
        enabled: true,
        excluded: false,
        strength: 'medium' as const,
        pools: [],
        sizeMB: m.sizeMB || m.size ? Math.round((m.size || 0) / 1048576) : undefined,
      }));
      registerModels(entries);
    } catch (e: any) { setError(e.message); }
    setScanning(false);
  };

  const handleClassify = async () => {
    const list = getUnclassifiedModels();
    if (!list.length) return;
    setError(null);
    try { await classifyWithAI(list.map(m => m.id), 'deepseek-chat'); }
    catch (e: any) { setError(`Classification failed: ${e.message}`); }
  };

  const togglePool = (id: string, pool: SargePool) => {
    const m = registry[id];
    if (!m) return;
    setPools(id, m.pools.includes(pool) ? m.pools.filter(p => p !== pool) : [...m.pools, pool]);
  };

  const toggleCat = (cat: ModelCategory) => {
    const next = new Set(collapsedCats);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setCollapsedCats(next);
  };

  // Group models by category
  const byCategory: Record<ModelCategory, ModelRegistryEntry[]> = {
    general: [], vision: [], code: [], image_gen: [], video_gen: [], audio: [], embedding: [], toy: [], unknown: []
  };
  Object.values(registry).forEach(m => {
    const cat = byCategory[m.category] ? m.category : 'unknown';
    byCategory[cat].push(m);
  });
  Object.values(byCategory).forEach(arr => arr.sort((a, b) => {
    const ord: Record<string, number> = { strong: 0, medium: 1, weak: 2, none: 3 };
    return ((ord[a.strength] ?? 3) - (ord[b.strength] ?? 3)) || a.name.localeCompare(b.name);
  }));

  const unclassified = getUnclassifiedModels().length;
  const total = Object.values(registry).length;
  const ready = Object.values(registry).filter(m => !m.excluded && m.pools.length > 0).length;

  const POOL_LABELS: { key: SargePool; label: string }[] = [
    { key: 'd1', label: 'D1' }, { key: 'd2', label: 'D2' }, { key: 'd3', label: 'D3' }, { key: 'judge', label: 'Judge' }
  ];

  const ModelRow = ({ m }: { m: ModelRegistryEntry }) => {
    const size = m.sizeMB ? (m.sizeMB >= 1024 ? `${(m.sizeMB/1024).toFixed(1)}G` : `${m.sizeMB}M`) : '';

    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 text-sm ${m.excluded ? 'opacity-40' : ''}`}>
        <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200 font-medium" title={m.name}>
          {m.name.replace(':latest', '')}
        </span>
        {size && <span className="text-zinc-400 text-xs font-mono w-10 text-right">{size}</span>}
        <span className={`text-xs font-bold w-12 text-center ${STRENGTH_COLOR[m.strength] || 'text-zinc-400'}`}>
          {STRENGTH_LABEL[m.strength] || '—'}
        </span>
        <div className="flex gap-1">
          {POOL_LABELS.map(({ key, label }) => (
            <button key={key} onClick={() => togglePool(m.id, key)} disabled={m.excluded}
              title={label}
              className={`px-1.5 py-0.5 text-xs font-bold rounded-md border transition-colors ${
                m.pools.includes(key)
                  ? key === 'judge'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-zinc-800/50 text-zinc-500 border-transparent hover:border-zinc-600'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => toggleExcluded(m.id)} className="w-5 h-5 flex items-center justify-center" title={m.excluded ? 'Enable' : 'Exclude'}>
          {m.excluded ? <X className="h-4 w-4 text-red-500" /> : <Check className="h-4 w-4 text-green-500" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Model Registry</h2>
        <span className="text-sm text-zinc-400">|</span>
        <span className="text-sm text-zinc-300">{total} models</span>
        <span className="text-sm text-green-600 dark:text-green-400">{ready} ready</span>
        {unclassified > 0 && <span className="text-sm text-yellow-600 dark:text-yellow-400">{unclassified} unclassified</span>}
        <div className="flex-1" />
        <button onClick={handleScan} disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          Scan
        </button>
        {unclassified > 0 && (
          <button onClick={handleClassify} disabled={classifying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors">
            <Wand2 className={`h-4 w-4 ${classifying ? 'animate-pulse' : ''}`} />
            {classifying ? 'Classifying...' : 'Classify with DeepSeek'}
          </button>
        )}
        <button onClick={() => { if (confirm('Clear all registry data?')) clearRegistry(); }}
          className="text-sm text-red-500 hover:text-red-400 font-medium">Clear</button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}

      {total === 0 ? (
        <div className="p-8 text-center text-zinc-400 text-sm">No models in registry. Click <strong>Scan</strong> to discover local models.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {CATEGORIES.map(cat => {
            const models = byCategory[cat.key];
            if (models.length === 0) return null;
            const isCollapsed = collapsedCats.has(cat.key);
            const isSarge = cat.key === 'general' || cat.key === 'code';

            return (
              <div key={cat.key} className={`rounded-lg border ${
                isSarge ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
              }`}>
                <div
                  onClick={() => toggleCat(cat.key)}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-t-lg"
                >
                  <span className={`text-sm font-bold ${isSarge ? 'text-green-700 dark:text-green-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-zinc-400">{cat.desc}</span>
                  <span className="text-sm text-zinc-400 ml-auto">({models.length})</span>
                  <span className="text-sm text-zinc-400">{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {!isCollapsed && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {models.map(m => <ModelRow key={m.id} m={m} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
