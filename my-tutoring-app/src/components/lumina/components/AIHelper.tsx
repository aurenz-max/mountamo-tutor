'use client';

import React, { useState } from 'react';
import { ProblemData } from '../types';

interface AIHelperProps {
  problem: ProblemData;
  onRequestHint: (hintLevel: number) => Promise<string>;
}

type HintLevel = 1 | 2 | 3;

export const AIHelper: React.FC<AIHelperProps> = ({ problem, onRequestHint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentHintLevel, setCurrentHintLevel] = useState<HintLevel>(1);
  const [hints, setHints] = useState<Map<HintLevel, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hintLevelInfo = {
    1: {
      label: 'Small Hint',
      description: 'A gentle nudge in the right direction',
      icon: '💡',
      color: 'blue'
    },
    2: {
      label: 'Medium Hint',
      description: 'More specific guidance on the concept',
      icon: '🔍',
      color: 'yellow'
    },
    3: {
      label: 'Big Hint',
      description: 'Detailed explanation without the answer',
      icon: '🎯',
      color: 'orange'
    }
  };

  const handleGetHint = async (level: HintLevel) => {
    // Check if we already have this hint
    if (hints.has(level)) {
      setCurrentHintLevel(level);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const hint = await onRequestHint(level);
      setHints(new Map(hints.set(level, hint)));
      setCurrentHintLevel(level);
    } catch (err) {
      console.error('Failed to get hint:', err);
      setError('Failed to get hint. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentHint = hints.get(currentHintLevel);

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Helper Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center gap-3"
        >
          <span className="text-2xl">🤖</span>
          <span>Need Help?</span>
          {/* Pulse Animation */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 animate-pulse"></div>
        </button>
      )}

      {/* Helper Panel */}
      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-96 max-h-[600px] overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <div>
                <h3 className="text-white font-bold text-lg">AI Learning Assistant</h3>
                <p className="text-indigo-200 text-xs">Here to guide you</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-indigo-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[400px] overflow-y-auto">
            {/* Intro Message */}
            {hints.size === 0 && !isLoading && (
              <div className="mb-6 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
                <p className="text-slate-300 text-sm leading-relaxed">
                  👋 Hi! I'm here to help you understand this problem better.
                  I won't give you the answer, but I can guide you through the concepts.
                  Choose a hint level to get started!
                </p>
              </div>
            )}

            {/* Current Hint Display */}
            {currentHint && !isLoading && (
              <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{hintLevelInfo[currentHintLevel].icon}</span>
                  <span className="text-sm font-semibold text-white">
                    {hintLevelInfo[currentHintLevel].label}
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {currentHint}
                </p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                  <span className="text-slate-400 text-sm">Thinking...</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Hint Level Buttons */}
            <div className="space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
                Choose Hint Level
              </p>
              {([1, 2, 3] as HintLevel[]).map((level) => {
                const info = hintLevelInfo[level];
                const hasHint = hints.has(level);
                const isActive = currentHintLevel === level && hasHint;

                return (
                  <button
                    key={level}
                    onClick={() => handleGetHint(level)}
                    disabled={isLoading}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left group ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/20'
                        : hasHint
                        ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        : 'border-slate-700 bg-slate-800/30 hover:border-indigo-500/50 hover:bg-slate-800/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-semibold text-sm">
                            {info.label}
                          </span>
                          {hasHint && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Unlocked
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hint Progression Info */}
            {hints.size > 0 && hints.size < 3 && (
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-xs">
                  💪 Try to solve it with what you know so far! If you're still stuck, you can unlock the next hint level.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIHelper;
