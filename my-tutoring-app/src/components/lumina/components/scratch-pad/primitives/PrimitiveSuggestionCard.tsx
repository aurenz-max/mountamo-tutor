'use client';

import React from 'react';
import { PrimitiveSuggestion } from '../types';

interface PrimitiveSuggestionCardProps {
  suggestion: PrimitiveSuggestion;
  onAccept: (suggestion: PrimitiveSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  isLoading: boolean;
}

export const PrimitiveSuggestionCard: React.FC<PrimitiveSuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  isLoading
}) => {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-600/50 p-3 hover:border-purple-500/50 transition-all group">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-xl flex-shrink-0">
          {suggestion.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm truncate">
            {suggestion.displayName}
          </h4>
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">
            {suggestion.purpose}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Action button */}
      <button
        onClick={() => onAccept(suggestion)}
        disabled={isLoading}
        className={`w-full mt-3 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
          isLoading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20'
        }`}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Show Visual</span>
          </>
        )}
      </button>
    </div>
  );
};

export default PrimitiveSuggestionCard;
