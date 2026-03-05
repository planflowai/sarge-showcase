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

export function ModelRegistry() {
  const {
    registry, hydrated, hydrate, classifying,
    registerModels, toggleExcluded, setPools, classifyWithAI, getUnclassifiedModels, clearRegistry
  } = useModelRegistryStore();

  const [scanning, setScanning] = useState(false);
  const [classifierModel, setClassifierModel] = useState("deepseek-r1:8b");
  const [classifiers, setClassifiers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<ModelCategory>>(new Set(['image_gen', 'video_gen', 'audio', 'embedding']));

  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated, hydrate]);

  useEffect(() => {
    const strong = Object.values(registry).filter(m => m.strength === 'strong' && m.category === 'general').map(m => m.id);
    const defaults = ['deepseek-r1:8b', 'qwen3:8b', 'llama3.1:8b'];
    const all = [...new Set([...strong, ...defaults])];
    setClassifiers(all);
    if (!all.includes(classifierModel)) setClassifierModel(all[0] || 'deepseek-r1:8b');
  }, [registry, classifierModel]);

  const handleScan = async () => {
    setScanning(true); setError(null);
    try {
      const res = await fetch('/api/models/scan');
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed');
      registerModels((await res.json()).models);
    } catch (e: any) { setError(e.message); }
    setScanning(false);
  };

  const handleClassify = async () => {
    const list = getUnclassifiedModels();
    if (!list.length) return;
    try { await classifyWithAI(list.map(m => m.id), classifierModel); }
    catch (e: any) { alert(`Failed: ${e.message}`); }
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
  Object.values(registry).forEach(m => byCategory[m.category].push(m));
  // Sort each category by strength then name
  Object.values(byCategory).forEach(arr => arr.sort((a, b) => {
    const ord = { strong: 0, medium: 1, weak: 2, none: 3 };
    return (ord[a.strength] - ord[b.strength]) || a.name.localeCompare(b.name);
  }));

  const unclassified = getUnclassifiedModels().length;
  const total = Object.values(registry).length;
  const ready = Object.values(registry).filter(m => !m.excluded && m.pools.length > 0).length;

  const ModelRow = ({ m }: { m: ModelRegistryEntry }) => {
    const size = m.sizeMB ? (m.sizeMB >= 1024 ? `${(m.sizeMB/1024).toFixed(1)}G` : `${m.sizeMB}M`) : '';
    const str = m.strength === 'strong' ? 'S' : m.strength === 'medium' ? 'M' : m.strength === 'weak' ? 'W' : '-';
    const strColor = m.strength === 'strong' ? 'text-green-600 dark:text-green-400'
      : m.strength === 'medium' ? 'text-yellow-600 dark:text-yellow-400'
      : m.strength === 'weak' ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400';

    return (
      <div className={`flex items-center gap-1 px-1 py-px text-xs ${m.excluded ? 'opacity-40' : ''}`}>
        <span className="flex-1 truncate text-zinc-400 dark:text-zinc-300" title={m.name}>
          {m.name.replace(':latest', '')}
        </span>
        <span className="text-zinc-400 w-7 text-right">{size}</span>
        <span className={`${strColor} w-3 text-center font-bold`}>{str}</span>
        <div className="flex gap-px">
          {(['d1', 'd2', 'd3', 'judge'] as SargePool[]).map(p => (
            <button key={p} onClick={() => togglePool(m.id, p)} disabled={m.excluded}
              title={p === 'judge' ? 'Judge' : p.toUpperCase()}
              className={`w-3.5 h-3.5 text-[7px] font-bold rounded ${
                m.pools.includes(p)
                  ? p === 'judge'
                    ? 'bg-amber-200 dark:bg-amber-500/40 text-amber-700 dark:text-amber-200'
                    : 'bg-blue-200 dark:bg-blue-500/40 text-blue-700 dark:text-blue-200'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-300'
              }`}>
              {p === 'd1' ? '1' : p === 'd2' ? '2' : p === 'd3' ? '3' : 'J'}
            </button>
          ))}
        </div>
        <button onClick={() => toggleExcluded(m.id)} className="w-3.5 h-3.5 flex items-center justify-center">
          {m.excluded ? <X className="h-2.5 w-2.5 text-red-500" /> : <Check className="h-2.5 w-2.5 text-green-500" />}
        </button>
      </div>
    );
  };

  return (
    <div className="text-[11px] space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-semibold text-zinc-400 dark:text-zinc-300">Registry</span>
        <span className="text-zinc-400">|</span>
        <span className="text-zinc-300">{total}</span>
        <span className="text-green-600 dark:text-green-400">{ready} ready</span>
        {unclassified > 0 && <span className="text-yellow-600 dark:text-yellow-400">{unclassified}?</span>}
        <div className="flex-1" />
        <button onClick={handleScan} disabled={scanning}
          className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 dark:text-zinc-300 disabled:opacity-50">
          <RefreshCw className={`inline h-2.5 w-2.5 mr-0.5 ${scanning ? 'animate-spin' : ''}`} />Scan
        </button>
        {unclassified > 0 && (
          <>
            <select value={classifierModel} onChange={e => setClassifierModel(e.target.value)}
              className="h-4 px-1 text-xs rounded bg-zinc-200 dark:bg-zinc-700 border-none text-zinc-400 dark:text-zinc-300">
              {classifiers.map(m => <option key={m} value={m}>{m.split(':')[0]}</option>)}
            </select>
            <button onClick={handleClassify} disabled={classifying}
              className="px-1.5 py-0.5 rounded bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
              <Wand2 className={`inline h-2.5 w-2.5 mr-0.5 ${classifying ? 'animate-pulse' : ''}`} />AI
            </button>
          </>
        )}
        <button onClick={() => { if (confirm('Clear?')) clearRegistry(); }}
          className="text-red-500 hover:text-red-600">Clear</button>
      </div>

      {error && <div className="p-1 rounded bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs">{error}</div>}

      {total === 0 ? (
        <div className="p-3 text-center text-zinc-400 text-xs">No models. Click Scan.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map(cat => {
            const models = byCategory[cat.key];
            if (models.length === 0) return null;
            const isCollapsed = collapsedCats.has(cat.key);
            const isSarge = cat.key === 'general' || cat.key === 'code';

            return (
              <div key={cat.key} className={`rounded border ${
                isSarge ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
              }`}>
                {/* Category header */}
                <div
                  onClick={() => toggleCat(cat.key)}
                  className="flex items-center gap-1 px-1.5 py-0.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className={`font-semibold ${isSarge ? 'text-green-700 dark:text-green-400' : 'text-zinc-300 dark:text-zinc-400'}`}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-zinc-400">({models.length})</span>
                  <span className="flex-1" />
                  <span className="text-xs text-zinc-400">{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {/* Models */}
                {!isCollapsed && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700">
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
