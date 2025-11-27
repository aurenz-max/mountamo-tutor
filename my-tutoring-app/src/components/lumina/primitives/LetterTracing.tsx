'use client';

import React from 'react';
import { LetterTracingData } from '../../types';

interface LetterTracingProps {
  data: LetterTracingData;
}

export const LetterTracing: React.FC<LetterTracingProps> = ({ data }) => {
  const { letter, case: letterCase, showDirectionArrows, showDottedGuide, strokeOrder } = data;

  // Handle missing or invalid data
  if (!letter || !letterCase) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Letter tracing data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  // Display the letter in the appropriate case
  const displayLetter = letterCase === 'uppercase' ? letter.toUpperCase() : letter.toLowerCase();

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Letter Tracing Practice
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Trace the {letterCase} letter "{displayLetter}"
          </p>
        </div>

        {/* Main Letter Display */}
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-xl border border-white/5">
          <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
            {/* Large letter for tracing */}
            <div className="relative">
              <span
                className={`text-[200px] font-bold select-none ${
                  showDottedGuide
                    ? 'text-transparent bg-clip-text bg-gradient-to-br from-blue-400/40 to-purple-400/40'
                    : 'text-gradient-to-br from-blue-400 to-purple-400'
                }`}
                style={{
                  fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
                  WebkitTextStroke: showDottedGuide ? '2px rgba(147, 197, 253, 0.6)' : '0',
                  textStroke: showDottedGuide ? '2px rgba(147, 197, 253, 0.6)' : '0',
                  WebkitTextStrokeStyle: showDottedGuide ? 'dotted' : 'solid',
                  textStrokeStyle: showDottedGuide ? 'dotted' : 'solid',
                }}
              >
                {displayLetter}
              </span>

              {/* Direction arrows overlay (if enabled) */}
              {showDirectionArrows && strokeOrder && strokeOrder.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {strokeOrder.map((stroke, idx) => (
                    <div
                      key={idx}
                      className="absolute"
                      style={{
                        animation: `pulse 2s ease-in-out ${idx * 0.3}s infinite`,
                      }}
                    >
                      {/* Stroke number indicator */}
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                          {stroke.number}
                        </div>
                        <svg
                          className="w-4 h-4 text-emerald-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stroke order information */}
          {strokeOrder && strokeOrder.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400 mb-2">Follow the stroke order:</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {strokeOrder.map((stroke, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5"
                  >
                    <span className="text-xs font-bold text-emerald-400">{stroke.number}</span>
                    <svg className="w-3 h-3 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Practice tips */}
        <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-400/20">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 mt-0.5">
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
              <p className="text-sm text-slate-300 font-medium mb-1">Tracing Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use your finger or a stylus to trace the letter. {showDirectionArrows && 'Follow the numbered arrows in order.'} {showDottedGuide && 'Stay inside the dotted outline.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
