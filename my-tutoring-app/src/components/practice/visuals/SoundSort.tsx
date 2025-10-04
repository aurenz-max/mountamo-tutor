'use client';

import React from 'react';

interface Category {
  label: string;
  words: string[];
}

interface SoundSortData {
  targetSound: string;
  categories: Category[];
  showPictures?: boolean;
}

interface SoundSortProps {
  data: SoundSortData;
  className?: string;
}

/**
 * SoundSort - Phonics categorization activity
 * Used for vowel sounds, word families, phonemic awareness
 * Matches backend SOUND_SORT_SCHEMA
 */
export const SoundSort: React.FC<SoundSortProps> = ({ data, className = '' }) => {
  const { targetSound, categories = [], showPictures = false } = data;

  if (!targetSound || !categories || categories.length === 0) {
    return null;
  }

  const colors = ['bg-green-100 border-green-400', 'bg-red-100 border-red-400', 'bg-blue-100 border-blue-400'];

  return (
    <div className={`sound-sort ${className}`}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg border-2 border-indigo-400 text-center mb-6">
        <p className="text-sm font-medium text-indigo-700 mb-1">Sorting by Sound</p>
        <p className="text-3xl font-bold text-indigo-900">{targetSound}</p>
      </div>

      {/* Category columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category, index) => {
          const colorClass = colors[index % colors.length];

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${colorClass}`}
            >
              <h4 className="text-lg font-bold text-gray-900 mb-3 text-center">
                {category.label}
              </h4>

              <div className="space-y-2">
                {category.words.map((word, wordIndex) => (
                  <div
                    key={wordIndex}
                    className="p-3 bg-white rounded border border-gray-300 text-center"
                  >
                    {showPictures && (
                      <div className="text-3xl mb-1">📝</div>
                    )}
                    <p className="text-xl font-semibold text-gray-800">{word}</p>
                  </div>
                ))}
              </div>

              {/* Count */}
              <div className="mt-3 pt-3 border-t-2 border-gray-300">
                <p className="text-sm text-gray-700 text-center font-medium">
                  {category.words.length} word{category.words.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-3 bg-purple-50 rounded border border-purple-200">
        <p className="text-sm text-purple-900 text-center">
          <strong>Total words sorted:</strong>{' '}
          {categories.reduce((sum, cat) => sum + cat.words.length, 0)}
        </p>
      </div>
    </div>
  );
};

export default SoundSort;
