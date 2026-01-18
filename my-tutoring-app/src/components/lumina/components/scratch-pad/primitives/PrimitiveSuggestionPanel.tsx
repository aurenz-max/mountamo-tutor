'use client';

import React, { useState } from 'react';
import { PrimitiveSuggestion } from '../types';
import { PrimitiveSuggestionCard } from './PrimitiveSuggestionCard';

interface PrimitiveSuggestionPanelProps {
  suggestions: PrimitiveSuggestion[];
  onAccept: (suggestion: PrimitiveSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onDismissAll: () => void;
  loadingPrimitiveId: string | null;
}

const LightbulbIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const PrimitiveSuggestionPanel: React.FC<PrimitiveSuggestionPanelProps> = ({
  suggestions,
  onAccept,
  onDismiss,
  onDismissAll,
  loadingPrimitiveId
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-slate-700/50 pt-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left mb-3 group"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-400">
            <LightbulbIcon />
          </div>
          <span className="text-sm font-semibold text-white">
            Visual Tools
          </span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {suggestions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismissAll();
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Dismiss all
            </button>
          )}
          <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
            <ChevronIcon isOpen={isExpanded} />
          </span>
        </div>
      </button>

      {/* Suggestion cards */}
      {isExpanded && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-slate-400 mb-2">
            These interactive visuals can help you understand the concept better.
          </p>
          {suggestions.map((suggestion) => (
            <PrimitiveSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={onAccept}
              onDismiss={onDismiss}
              isLoading={loadingPrimitiveId === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PrimitiveSuggestionPanel;
