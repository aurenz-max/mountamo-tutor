'use client';

import React from 'react';
import { SightWordCardData } from '../../types';

interface SightWordCardProps {
  data: SightWordCardData;
}

export const SightWordCard: React.FC<SightWordCardProps> = ({ data }) => {
  const { word, fontSize = 'large', showInContext = false, sentence, highlightWord = true } = data;

  // Handle missing or invalid data
  if (!word) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Sight word data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  const fontSizeClasses = {
    small: 'text-4xl md:text-5xl',
    medium: 'text-6xl md:text-7xl',
    large: 'text-7xl md:text-8xl',
  };

  // Helper to highlight the word in a sentence
  const renderSentenceWithHighlight = (text: string, targetWord: string) => {
    if (!highlightWord) {
      return <span className="text-slate-200">{text}</span>;
    }

    const regex = new RegExp(`\\b(${targetWord})\\b`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, idx) => {
          if (part.toLowerCase() === targetWord.toLowerCase()) {
            return (
              <span
                key={idx}
                className="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/50 mx-1"
              >
                {part}
              </span>
            );
          }
          return <span key={idx} className="text-slate-200">{part}</span>;
        })}
      </>
    );
  };

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Sight Word Practice
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Learn to recognize this common word
          </p>
        </div>

        {/* Main Word Card */}
        <div className="flex justify-center p-8 md:p-12 bg-slate-900/50 rounded-xl border border-white/5 mb-6">
          <div className="relative">
            {/* Decorative elements */}
            <div className="absolute -top-4 -left-4 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl"></div>
            <div className="absolute -top-4 -right-4 w-8 h-8 border-t-4 border-r-4 border-purple-400 rounded-tr-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b-4 border-l-4 border-purple-400 rounded-bl-xl"></div>
            <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl"></div>

            {/* The Sight Word */}
            <div className="px-8 py-6">
              <span
                className={`${fontSizeClasses[fontSize]} font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-gradient-x`}
                style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
              >
                {word}
              </span>
            </div>
          </div>
        </div>

        {/* Context Sentence */}
        {showInContext && sentence && (
          <div className="p-6 bg-blue-500/10 rounded-xl border border-blue-400/20 mb-4">
            <div className="mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-blue-300">
                See it in context
              </span>
            </div>
            <p className="text-xl md:text-2xl leading-relaxed font-light">
              {renderSentenceWithHighlight(sentence, word)}
            </p>
          </div>
        )}

        {/* Practice Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 text-center hover:border-slate-600 transition-all"
            >
              <p className="text-xs text-slate-500 mb-1">Practice #{num}</p>
              <p
                className="text-xl font-bold text-slate-300"
                style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
              >
                {word}
              </p>
            </div>
          ))}
        </div>

        {/* Learning tip */}
        <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-400/20">
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
              <p className="text-sm text-slate-300 font-medium mb-1">Sight Word Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sight words are high-frequency words that appear often in reading. Practice recognizing them instantly without sounding them out!
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        .animate-gradient-x {
          background-size: 200% auto;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
};
