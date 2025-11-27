'use client';

import React from 'react';
import { LetterPictureData } from '../../types';

interface LetterPictureProps {
  data: LetterPictureData;
}

export const LetterPicture: React.FC<LetterPictureProps> = ({ data }) => {
  const { letter, items = [] } = data;

  // Handle missing or invalid data - only check for existence, not quantity
  if (!letter || !items || items.length === 0) {
    console.error('LetterPicture validation failed:', { letter, itemCount: items?.length });
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-red-500/20">
          <div className="text-center">
            <div className="text-red-400 mb-2">⚠️ Data Incomplete</div>
            <p className="text-slate-400 text-sm">
              Letter picture data is incomplete.
              {!items?.length && ' No items found.'}
              {!letter && ' Missing letter.'}
            </p>
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
              Letter Sound Match
            </span>
          </div>
          <div className="mt-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
              <span className="text-5xl font-bold text-white" style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}>
                {letter.toUpperCase()}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-3">
            Find items that start with the letter "{letter.toUpperCase()}"
          </p>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`group relative p-4 rounded-xl transition-all duration-300 ${
                item.highlight
                  ? 'bg-emerald-500/20 border-2 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-800/50 border-2 border-slate-700/50 hover:border-slate-600'
              }`}
              style={{
                animationDelay: `${idx * 100}ms`,
              }}
            >
              {/* Highlight badge */}
              {item.highlight && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg animate-pulse">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Item Content */}
              <div className="flex flex-col items-center gap-3">
                {/* Image/Emoji */}
                <div className="text-6xl transform transition-transform group-hover:scale-110">
                  {item.image}
                </div>

                {/* Item Name */}
                <div className="text-center">
                  <p className={`text-lg font-semibold ${item.highlight ? 'text-emerald-300' : 'text-slate-200'}`}>
                    {item.name}
                  </p>
                  {item.highlight && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <span className="text-xs text-emerald-400 font-medium">Starts with</span>
                      <span className="text-sm font-bold text-emerald-300">{letter.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>
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
              <p className="text-sm text-slate-300 font-medium mb-1">Phonics Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Say each word out loud. Listen for the first sound. Does it match the letter "{letter.toUpperCase()}"?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
