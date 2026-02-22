'use client';

import { TestTheme as Theme, ModelAssignment, PromptPools, SelectedPrompts } from '@/lib/types' // Test types;

interface ModelBarProps {
  theme: Theme;
  darkMode: boolean;
  source: 'local' | 'cloud';
  localModels: ModelAssignment;
  setLocalModels: (models: ModelAssignment) => void;
  cloudModels: ModelAssignment;
  setCloudModels: (models: ModelAssignment) => void;
  promptPools: PromptPools;
  selectedPrompts: SelectedPrompts;
  setSelectedPrompts: (prompts: SelectedPrompts) => void;
  availableLocalModels: string[];
  availableCloudModels: string[];
}

export function ModelBar({
  theme,
  darkMode,
  source,
  localModels,
  setLocalModels,
  cloudModels,
  setCloudModels,
  promptPools,
  selectedPrompts,
  setSelectedPrompts,
  availableLocalModels,
  availableCloudModels,
}: ModelBarProps) {
  const modelList = source === 'local' ? availableLocalModels : availableCloudModels;
  const activeModels = source === 'local' ? localModels : cloudModels;

  const handleModelChange = (role: keyof ModelAssignment, value: string) => {
    if (source === 'local') {
      setLocalModels({ ...localModels, [role]: value });
    } else {
      setCloudModels({ ...cloudModels, [role]: value });
    }
  };

  const handlePromptChange = (role: keyof SelectedPrompts, value: string) => {
    setSelectedPrompts({ ...selectedPrompts, [role]: value });
  };

  return (
    <div className={`flex items-center gap-4 px-4 py-2 border-b ${theme.borderSubtle} ${darkMode ? 'bg-zinc-900/50' : 'bg-gray-50'} overflow-x-auto`}>
      <span className={`text-xs ${theme.textMuted} uppercase tracking-wider font-medium whitespace-nowrap`}>Models</span>
      
      {(['d1', 'd2', 'd3', 'judge'] as const).map(role => (
        <div key={role} className="flex items-center gap-2">
          {/* Role Label */}
          <span className={`text-xs font-bold ${role === 'judge' ? 'text-amber-500' : theme.text}`}>
            {role.toUpperCase()}:
          </span>
          
          {/* Model Dropdown */}
          <select
            value={activeModels[role]}
            onChange={(e) => handleModelChange(role, e.target.value)}
            className={`px-2 py-1 rounded text-xs ${theme.bgSecondary} ${theme.text} border ${theme.border} focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[180px]`}
          >
            {modelList.length === 0 ? (
              <option value="">No models</option>
            ) : (
              modelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))
            )}
          </select>
          
          {/* Prompt Dropdown */}
          <select
            value={selectedPrompts[role]}
            onChange={(e) => handlePromptChange(role, e.target.value)}
            className={`px-2 py-1 rounded text-xs ${theme.bgSecondary} border ${
              role === 'judge' ? 'text-amber-500 border-amber-500/30' : `${theme.text} ${theme.border}`
            } focus:outline-none focus:ring-1 focus:ring-violet-500 max-w-[140px]`}
          >
            {promptPools[role].map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
