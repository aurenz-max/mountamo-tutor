'use client';

import React from 'react';

interface Pair {
  word1: string;
  image1?: string;
  word2: string;
  image2?: string;
}

interface RhymingPairsData {
  pairs: Pair[];
  showConnectingLines?: boolean;
}

interface RhymingPairsProps {
  data: RhymingPairsData;
  className?: string;
  // Interactive mode props (optional)
  interactionConfig?: {
    mode: string;
    targets: Array<{ id: string; is_correct: boolean }>;
  };
  selectedTargetId?: string | null;
  onTargetClick?: (targetId: string) => void;
  isSubmitted?: boolean;
  getTargetState?: (targetId: string) => 'default' | 'selected' | 'correct' | 'incorrect';
}

/**
 * RhymingPairs - Rhyming words with visual connections
 * Used for phonemic awareness, rhyming practice
 * Matches backend RHYMING_PAIRS_SCHEMA
 */
export const RhymingPairs: React.FC<RhymingPairsProps> = ({
  data,
  className = '',
  interactionConfig,
  onTargetClick,
  isSubmitted = false,
  getTargetState
}) => {
  const { pairs = [], showConnectingLines = true } = data;

  if (!pairs || pairs.length === 0) {
    return null;
  }

  const isInteractive = !!interactionConfig && !!onTargetClick;

  const handlePairClick = (pairIndex: number) => {
    if (!isInteractive || isSubmitted) return;
    const targetId = `pair_${String.fromCharCode(65 + pairIndex)}`; // pair_A, pair_B, etc.
    onTargetClick?.(targetId);
  };

  const getPairState = (pairIndex: number) => {
    if (!isInteractive || !getTargetState) return 'default';
    const targetId = `pair_${String.fromCharCode(65 + pairIndex)}`;
    return getTargetState(targetId);
  };

  return (
    <div className={`rhyming-pairs ${className}`}>
      <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border-2 border-pink-300">
        <h3 className="text-lg font-bold text-purple-900 text-center mb-6">
          Rhyming Word Pairs
        </h3>

        <div className="space-y-6">
          {pairs.map((pair, index) => {
            const state = getPairState(index);
            const isClickable = isInteractive && !isSubmitted;

            return (
              <div
                key={index}
                onClick={() => handlePairClick(index)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  isClickable ? 'cursor-pointer' : ''
                } ${
                  state === 'correct'
                    ? 'bg-green-50 border-green-400 shadow-lg'
                    : state === 'incorrect'
                      ? 'bg-red-50 border-red-400'
                      : state === 'selected'
                        ? 'bg-blue-100 border-blue-400 shadow-lg'
                        : 'bg-white border-purple-300'
                } ${
                  isClickable && state === 'default'
                    ? 'hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
                    : ''
                }`}
              >
                <div className="grid grid-cols-2 gap-6">
                  {/* Word 1 */}
                  <div className="flex flex-col items-center p-3 bg-pink-50 rounded-lg">
                    {pair.image1 && (
                      <div className="text-5xl mb-2" role="img" aria-label={pair.word1}>
                        {pair.image1}
                      </div>
                    )}
                    <p className="text-2xl font-bold text-pink-900">{pair.word1}</p>
                  </div>

                  {/* Word 2 */}
                  <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg">
                    {pair.image2 && (
                      <div className="text-5xl mb-2" role="img" aria-label={pair.word2}>
                        {pair.image2}
                      </div>
                    )}
                    <p className="text-2xl font-bold text-purple-900">{pair.word2}</p>
                  </div>
                </div>

                {/* Connecting indicator */}
                {showConnectingLines && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold shadow-lg">
                      🎵
                    </div>
                  </div>
                )}

                {/* Selection indicator for interactive mode */}
                {isInteractive && state !== 'default' && (
                  <div className="absolute top-2 right-2">
                    {state === 'correct' && (
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-lg">✓</span>
                      </div>
                    )}
                    {state === 'incorrect' && (
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-white text-lg">✗</span>
                      </div>
                    )}
                    {state === 'selected' && !isSubmitted && (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RhymingPairs;
