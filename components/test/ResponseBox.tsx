'use client';

import { useState } from 'react';
import { TestTheme as Theme, ResponseData } from '@/lib/types' // Test types;

interface ResponseBoxProps {
  theme: Theme;
  darkMode: boolean;
  demoMode: boolean;
  data: ResponseData;
  section: 'unfiltered' | 'tribunal';
  isStreaming?: boolean;
  isWaiting?: boolean;
  onOpenReport?: () => void;
}

export function ResponseBox({ theme, darkMode, demoMode, data, section, isStreaming, isWaiting, onOpenReport }: ResponseBoxProps) {
  const { role, model, content, time, tokens, status, highlightText } = data;
  const [expanded, setExpanded] = useState(false);
  
  const isJudge = role === 'judge';
  const isEcho = status === 'echo';
  const isFlagged = status === 'flagged';
  const isVerified = status === 'verified';
  const isCaught = status === 'caught';
  
  // Check if content is long (for expand/collapse)
  const isLongContent = content && content.length > 500;
  const shouldShowExpand = isLongContent && !isStreaming;
  
  // Status badge
  const getStatusBadge = () => {
    if (isWaiting) return <span className={`text-xs ${theme.textMuted} animate-pulse`}>⏳ Waiting...</span>;
    if (isStreaming) return <span className="text-xs text-indigo-400 animate-pulse">● Streaming...</span>;
    if (isEcho) return <span className="text-xs text-red-400 font-medium px-2 py-0.5 bg-red-500/10 rounded">⚠️ Echoed</span>;
    if (isFlagged) return <span className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'} font-medium px-2 py-0.5 bg-amber-500/10 rounded`}>🔍 Flagged</span>;
    if (isVerified) return <span className="text-xs text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded">✓ Verified</span>;
    if (isCaught) return <span className="text-xs font-bold px-2 py-0.5 border rounded bg-emerald-500/10 text-emerald-400 border-emerald-500/30">✅ CAUGHT</span>;
    if (content && !isCaught && isJudge) return <span className="text-xs font-bold px-2 py-0.5 border rounded bg-red-500/10 text-red-400 border-red-500/30">❌ MISSED</span>;
    if (content) return <span className="text-xs text-emerald-400">✓ Done</span>;
    return null;
  };

  // Get role label
  const getRoleLabel = () => {
    if (isJudge) return 'Judge';
    return role.toUpperCase();
  };

  const getRoleSubtext = () => {
    if (isJudge) return 'Verdict';
    if (role === 'd1') return 'Worker';
    if (role === 'd2') return 'Checker';
    if (role === 'd3') return 'Auditor';
    return 'Agent';
  };

  return (
    <div className={`flex gap-3 transition-all duration-200 ${isWaiting ? 'opacity-50' : ''}`}>
      {/* Role Label */}
      {isJudge ? (
        <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 ${
          isCaught ? 'border-emerald-500' : (content && !isStreaming ? 'border-red-500' : 'border-amber-500')
        } ${theme.bgSecondary} py-3`}>
          <span className="text-2xl">⚖️</span>
          <span className={`text-[10px] font-bold ${
            isCaught ? 'text-emerald-500' : (content && !isStreaming ? 'text-red-500' : 'text-amber-500')
          }`}>Judge</span>
        </div>
      ) : (
        <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center rounded-lg ${theme.bgSecondary} border-2 py-3 ${
          isStreaming ? 'border-indigo-500' :
          isEcho ? 'border-red-500' : 
          isFlagged ? 'border-amber-500' : 
          isVerified ? 'border-emerald-500' : 
          theme.border
        }`}>
          <span className={`text-lg font-bold ${
            isStreaming ? 'text-indigo-400' :
            isEcho ? 'text-red-400' : 
            isFlagged ? (darkMode ? 'text-amber-400' : 'text-amber-600') : 
            isVerified ? 'text-emerald-400' : 
            theme.text
          }`}>
            {getRoleLabel()}
          </span>
          <span className={`text-[9px] ${theme.textMuted}`}>
            {getRoleSubtext()}
          </span>
        </div>
      )}
      
      {/* Content */}
      <div className={`flex-1 flex flex-col rounded-lg overflow-hidden border ${
        isStreaming ? 'border-indigo-500' : 
        isJudge ? (isCaught ? 'border-emerald-500' : (content ? 'border-red-500' : 'border-amber-500')) : 
        isEcho ? 'border-red-500' :
        isFlagged ? 'border-amber-500' :
        theme.border
      } ${theme.bgSecondary}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${theme.borderSubtle} ${theme.bgTertiary}`}>
          <div className={`flex items-center gap-3 text-xs ${theme.textMuted}`}>
            <span>🤖 {model}</span>
            {!isWaiting && !isStreaming && (
              <>
                <span>•</span>
                <span>⏱️ {time || '...'}</span>
                <span>•</span>
                <span># {tokens || 0} tok</span>
              </>
            )}
          </div>
          {getStatusBadge()}
        </div>
        
        {/* Body - with max-height and scroll for long content */}
        <div className={`flex-1 p-3 text-sm leading-relaxed ${theme.text} ${
          expanded ? '' : (shouldShowExpand ? 'max-h-48' : 'min-h-[50px]')
        } overflow-auto`}>
          {isWaiting ? (
            <span className={`${theme.textMuted} italic`}>Waiting for turn...</span>
          ) : isStreaming ? (
            <span className="whitespace-pre-wrap">
              {content}
              <span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
            </span>
          ) : content ? (
            <div className="whitespace-pre-wrap">
              {highlightText ? (
                <span>
                  {content.split(new RegExp(`(${highlightText})`, 'gi')).map((part, i) => (
                    <span key={i}>
                      {part.toLowerCase() === highlightText.toLowerCase() ? (
                        <span className={`px-1 py-0.5 rounded font-medium ${
                          isEcho ? 'bg-red-500/20 text-red-400' : 
                          isFlagged ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {part}
                        </span>
                      ) : part}
                    </span>
                  ))}
                </span>
              ) : content}
            </div>
          ) : (
            <span className={`${theme.textMuted} italic`}>Ready</span>
          )}
        </div>
        
        {/* Action buttons */}
        {content && !isStreaming && (
          <div className={`flex items-center border-t ${theme.borderSubtle} ${theme.bgTertiary}`}>
            {/* Expand/Collapse for long content */}
            {shouldShowExpand && (
              <button 
                onClick={() => setExpanded(!expanded)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 dark:hover:bg-zinc-700/50 transition-colors flex items-center justify-center gap-1 ${theme.textSecondary}`}
              >
                {expanded ? '▲ Collapse' : `▼ Expand (${content.length} chars)`}
              </button>
            )}
            
            {/* Open Full Report button for Judge */}
            {isJudge && onOpenReport && (
              <button 
                onClick={onOpenReport}
                className={`${shouldShowExpand ? 'border-l' : ''} ${theme.borderSubtle} flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors flex items-center justify-center gap-1`}
              >
                📄 Open Full Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
