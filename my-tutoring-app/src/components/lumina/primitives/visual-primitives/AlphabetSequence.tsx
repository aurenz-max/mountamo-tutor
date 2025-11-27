'use client';

import React from 'react';
import { AlphabetSequenceData } from '../../types';

interface AlphabetSequenceProps {
  data: AlphabetSequenceData;
}

export const AlphabetSequence: React.FC<AlphabetSequenceProps> = ({ data }) => {
  const { sequence = [], missing = [], highlightMissing = true, showImages = false } = data;

  // Handle missing or invalid data
  if (!sequence || sequence.length === 0) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Alphabet sequence data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  // Simple letter to emoji mapping for visual aid
  const letterToEmoji: { [key: string]: string } = {
    A: '🍎', B: '🏀', C: '🐱', D: '🐶', E: '🥚', F: '🐠', G: '🍇',
    H: '🏠', I: '🍦', J: '🤹', K: '🔑', L: '🦁', M: '🌙', N: '🥜',
    O: '🐙', P: '🍕', Q: '👸', R: '🌈', S: '⭐', T: '🌳', U: '☂️',
    V: '🎻', W: '🍉', X: '❌', Y: '💛', Z: '🦓',
  };

  const isMissing = (letter: string) => {
    return letter === '_' || missing.includes(letter);
  };

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Alphabet Sequence
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {missing.length > 0 ? `Find the missing letter${missing.length > 1 ? 's' : ''}` : 'Practice the alphabet'}
          </p>
        </div>

        {/* Sequence Display */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 p-6 bg-slate-900/50 rounded-xl border border-white/5">
          {sequence.map((letter, idx) => {
            const isEmpty = isMissing(letter);
            const isTarget = isEmpty && highlightMissing;

            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Letter Box */}
                <div
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isEmpty
                      ? isTarget
                        ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-pulse'
                        : 'bg-slate-800/80 border-2 border-dashed border-slate-600'
                      : 'bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 hover:border-slate-500 hover:shadow-lg'
                  }`}
                >
                  {isEmpty ? (
                    <div className="text-2xl text-slate-500">?</div>
                  ) : (
                    <span
                      className="text-2xl md:text-3xl font-bold text-white"
                      style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
                    >
                      {letter}
                    </span>
                  )}
                </div>

                {/* Optional Image */}
                {showImages && !isEmpty && letterToEmoji[letter.toUpperCase()] && (
                  <div className="text-xl transform transition-transform hover:scale-125">
                    {letterToEmoji[letter.toUpperCase()]}
                  </div>
                )}

                {/* Position indicator for smaller screens */}
                <div className="text-xs text-slate-500 font-mono">{idx + 1}</div>
              </div>
            );
          })}
        </div>

        {/* Missing Letters Summary */}
        {missing.length > 0 && (
          <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-400/20">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300 font-medium mb-2">Missing Letters</p>
                <div className="flex gap-2 flex-wrap">
                  {missing.map((letter, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-400/30"
                    >
                      <span className="text-sm font-bold text-blue-300">{letter}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Learning tip */}
        <div className="mt-4 p-4 bg-purple-500/10 rounded-lg border border-purple-400/20">
          <div className="flex items-start gap-3">
            <div className="text-purple-400 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-300 font-medium mb-1">Sequence Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sing the alphabet song to help remember the order. Look at the letters before and after the blank space.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
