'use client';

import React from 'react';

interface AlphabetSequenceData {
  sequence: string[];
  missing: string[];
  highlightMissing?: boolean;
  showImages?: boolean;
}

interface AlphabetSequenceProps {
  data: AlphabetSequenceData;
  className?: string;
}

/**
 * AlphabetSequence - Missing letter sequences
 * Used for alphabetical order, letter recognition
 * Matches backend ALPHABET_SEQUENCE_SCHEMA
 */
export const AlphabetSequence: React.FC<AlphabetSequenceProps> = ({ data, className = '' }) => {
  const {
    sequence = [],
    missing = [],
    highlightMissing = true,
    showImages = false
  } = data;

  if (!sequence || sequence.length === 0) {
    return null;
  }

  const isMissing = (letter: string) => letter === '_';

  return (
    <div className={`alphabet-sequence ${className}`}>
      <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-400">
        {/* Sequence display */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {sequence.map((letter, index) => {
            const isBlank = isMissing(letter);

            return (
              <div
                key={index}
                className={`w-16 h-16 flex items-center justify-center text-3xl font-bold rounded-lg border-2 transition-all ${
                  isBlank && highlightMissing
                    ? 'bg-yellow-200 border-yellow-500 border-dashed'
                    : 'bg-white border-gray-300'
                }`}
              >
                {isBlank ? (
                  <span className="text-yellow-600">?</span>
                ) : (
                  <span className="text-gray-800">{letter}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Missing letters hint */}
        {missing.length > 0 && (
          <div className="p-4 bg-orange-100 rounded-lg border border-orange-300">
            <p className="text-sm font-semibold text-orange-900 mb-2">
              Missing Letter{missing.length > 1 ? 's' : ''}:
            </p>
            <div className="flex gap-2 flex-wrap">
              {missing.map((letter, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-white rounded border-2 border-orange-400 text-xl font-bold text-orange-900"
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Helper text */}
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Fill in the blanks to complete the alphabet sequence.
            The missing letter{missing.length > 1 ? 's are' : ' is'} shown above.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlphabetSequence;
