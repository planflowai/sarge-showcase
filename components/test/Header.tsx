'use client';

import { TestTheme as Theme, SystemStatus } from '@/lib/types' // Test types;

interface HeaderProps {
  theme: Theme;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  activeTab: 'test' | 'batch' | 'review' | 'config';
  setActiveTab: (value: 'test' | 'batch' | 'review' | 'config') => void;
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  source: 'local' | 'cloud';
  setSource: (value: 'local' | 'cloud') => void;
  status: SystemStatus;
}

export function Header({
  theme,
  darkMode,
  setDarkMode,
  activeTab,
  setActiveTab,
  demoMode,
  setDemoMode,
  source,
  setSource,
  status,
}: HeaderProps) {
  return (
    <header className={`flex items-center justify-between px-4 py-2 border-b ${theme.borderSubtle} ${theme.bgSecondary}`}>
      <div className="flex items-center gap-4">
        {/* Logo */}
        <h1 className={`text-lg font-bold ${theme.text}`}>
          ⚖️ AI TRIBUNAL
        </h1>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
            status.ollama === 'ready' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : status.ollama === 'loading'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status.ollama === 'ready' ? 'bg-emerald-400' : 
              status.ollama === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
            }`} />
            {source === 'local' ? 'Ollama' : 'Cloud'} {status.ollama === 'ready' ? 'Ready' : status.ollama === 'loading' ? '...' : 'Offline'}
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Supabase
          </div>
        </div>
        
        {/* Tabs */}
        <div className={`flex items-center ${theme.bgTertiary} rounded-lg p-0.5 border ${theme.borderSubtle}`}>
          {(['test', 'batch', 'review', 'config'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                activeTab === tab 
                  ? 'bg-indigo-600 text-white' 
                  : `${theme.textSecondary} hover:text-gray-900 dark:hover:text-white`
              }`}
            >
              {tab === 'batch' ? '📊 Batch' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Demo Mode Toggle */}
        <button
          onClick={() => setDemoMode(!demoMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
            demoMode 
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' 
              : `${theme.bgTertiary} ${theme.textSecondary} border ${theme.borderSubtle}`
          }`}
        >
          🖥️ Demo {demoMode ? 'ON' : 'OFF'}
        </button>
        
        {/* Local/Cloud Toggle */}
        <div className={`flex items-center ${theme.bgTertiary} rounded-lg p-0.5 border ${theme.borderSubtle}`}>
          <button
            onClick={() => setSource('local')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              source === 'local' ? 'bg-indigo-600 text-white' : theme.textSecondary
            }`}
          >
            🖥️ Local
          </button>
          <button
            onClick={() => setSource('cloud')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              source === 'cloud' ? 'bg-indigo-600 text-white' : theme.textSecondary
            }`}
          >
            ☁️ Cloud
          </button>
        </div>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-lg ${theme.bgTertiary} ${theme.textSecondary} border ${theme.borderSubtle} text-lg`}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        
        {/* Settings */}
        <button className={`p-2 rounded-lg ${theme.bgTertiary} ${theme.textSecondary} border ${theme.borderSubtle} text-lg`}>
          ⚙️
        </button>
      </div>
    </header>
  );
}
