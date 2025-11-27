'use client';

import React from 'react';
import { RhymingPairsData } from '../../types';

interface RhymingPairsProps {
  data: RhymingPairsData;
}

export const RhymingPairs: React.FC<RhymingPairsProps> = ({ data }) => {
  const { pairs = [], showConnectingLines = true } = data;

  // Handle missing or invalid data
  if (!pairs || pairs.length === 0) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Rhyming pairs data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Rhyming Words
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Match words that rhyme together
          </p>
        </div>

        {/* Pairs Display */}
        <div className="space-y-6">
          {pairs.map((pair, idx) => (
            <div
              key={idx}
              className="relative animate-fade-in"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              {/* Pair Container */}
              <div className="grid grid-cols-2 gap-4 md:gap-6 items-center">
                {/* First Word */}
                <div className="flex justify-end">
                  <div className="group flex items-center gap-3 p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border-2 border-blue-400/40 hover:border-blue-400/60 transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] max-w-xs w-full">
                    {pair.image1 && (
                      <div className="text-4xl transform transition-transform group-hover:scale-110">
                        {pair.image1}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-blue-200" style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}>
                        {pair.word1}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Second Word */}
                <div className="flex justify-start">
                  <div className="group flex items-center gap-3 p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border-2 border-purple-400/40 hover:border-purple-400/60 transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] max-w-xs w-full">
                    {pair.image2 && (
                      <div className="text-4xl transform transition-transform group-hover:scale-110">
                        {pair.image2}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-purple-200" style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}>
                        {pair.word2}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connecting Line */}
              {showConnectingLines && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                  <div className="flex items-center gap-2">
                    {/* Left arrow */}
                    <svg className="w-8 h-8 text-emerald-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>

                    {/* Rhyme indicator */}
                    <div className="px-4 py-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Rhyme</span>
                    </div>

                    {/* Right arrow */}
                    <svg className="w-8 h-8 text-emerald-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Divider between pairs (not for last pair) */}
              {idx < pairs.length - 1 && (
                <div className="mt-6 border-t border-white/5"></div>
              )}
            </div>
          ))}
        </div>

        {/* Learning tip */}
        <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-400/20">
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
              <p className="text-sm text-slate-300 font-medium mb-1">Rhyming Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Say each word out loud. Listen to how the ending sounds are the same. Rhyming words often end with the same letters!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
