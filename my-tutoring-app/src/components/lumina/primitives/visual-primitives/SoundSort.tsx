'use client';

import React from 'react';
import { SoundSortData } from '../../types';

interface SoundSortProps {
  data: SoundSortData;
}

export const SoundSort: React.FC<SoundSortProps> = ({ data }) => {
  const { targetSound, categories = [], showPictures = true } = data;

  // Handle missing or invalid data
  if (!targetSound || !categories || categories.length === 0) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Sound sort data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  // Simple word to emoji mapping for visual aid
  const wordToEmoji: { [key: string]: string } = {
    // Short vowels
    cat: '🐱', hat: '🎩', bat: '🦇', rat: '🐀', mat: '🧘',
    bed: '🛏️', red: '🔴', led: '💡', fed: '🍽️',
    pig: '🐷', big: '📏', dig: '⛏️', wig: '💇',
    dog: '🐶', log: '🪵', fog: '🌫️', jog: '🏃',
    sun: '☀️', run: '🏃', fun: '🎉', bun: '🍔',
    // Long vowels
    cake: '🎂', make: '🔨', lake: '🏞️', rake: '🍂',
    tree: '🌳', bee: '🐝', see: '👀', free: '🆓',
    kite: '🪁', bite: '🦷', site: '📍', white: '⚪',
    rope: '🪢', hope: '🤞', note: '📝', vote: '🗳️',
    cube: '🧊', tube: '🧪', cute: '😊',
  };

  const getEmojiForWord = (word: string): string => {
    const lowercaseWord = word.toLowerCase();
    return wordToEmoji[lowercaseWord] || '📝';
  };

  // Color schemes for categories
  const categoryColors = [
    'from-blue-500/20 to-blue-600/20 border-blue-400/40',
    'from-purple-500/20 to-purple-600/20 border-purple-400/40',
    'from-emerald-500/20 to-emerald-600/20 border-emerald-400/40',
    'from-orange-500/20 to-orange-600/20 border-orange-400/40',
  ];

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Sound Sorting
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm text-slate-400 mb-2">Target Sound:</p>
            <div className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg">
              <span className="text-2xl font-bold text-white">{targetSound}</span>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {categories.map((category, catIdx) => (
            <div
              key={catIdx}
              className="animate-fade-in"
              style={{ animationDelay: `${catIdx * 100}ms` }}
            >
              <div className={`bg-gradient-to-br ${categoryColors[catIdx % categoryColors.length]} rounded-xl border-2 p-5`}>
                {/* Category Label */}
                <div className="mb-4 pb-3 border-b border-white/10">
                  <h3 className="text-lg font-bold text-white text-center">
                    {category.label}
                  </h3>
                </div>

                {/* Words in Category */}
                <div className="grid grid-cols-2 gap-3">
                  {category.words.map((word, wordIdx) => (
                    <div
                      key={wordIdx}
                      className="group p-3 bg-slate-900/50 rounded-lg border border-white/10 hover:border-white/20 hover:bg-slate-900/70 transition-all duration-300"
                    >
                      <div className="flex flex-col items-center gap-2">
                        {/* Emoji */}
                        {showPictures && (
                          <div className="text-3xl transform transition-transform group-hover:scale-110">
                            {getEmojiForWord(word)}
                          </div>
                        )}

                        {/* Word */}
                        <p
                          className="text-lg font-bold text-slate-200 text-center"
                          style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
                        >
                          {word}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Word count */}
                <div className="mt-3 text-center">
                  <span className="text-xs text-slate-400">
                    {category.words.length} word{category.words.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Learning tip */}
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-400/20">
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
                Say each word slowly and listen for the "{targetSound}" sound. Words with the same vowel sound go in the same category!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
