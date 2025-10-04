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
}

/**
 * RhymingPairs - Rhyming words with visual connections
 * Used for phonemic awareness, rhyming practice
 * Matches backend RHYMING_PAIRS_SCHEMA
 */
export const RhymingPairs: React.FC<RhymingPairsProps> = ({ data, className = '' }) => {
  const { pairs = [], showConnectingLines = true } = data;

  if (!pairs || pairs.length === 0) {
    return null;
  }

  return (
    <div className={`rhyming-pairs ${className}`}>
      <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border-2 border-pink-300">
        <h3 className="text-lg font-bold text-purple-900 text-center mb-6">
          Rhyming Word Pairs
        </h3>

        <div className="space-y-6">
          {pairs.map((pair, index) => (
            <div
              key={index}
              className="relative p-4 bg-white rounded-lg border-2 border-purple-300"
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
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold shadow-lg">
                    🎵
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 p-3 bg-purple-100 rounded border border-purple-300">
          <p className="text-sm text-purple-900 text-center">
            <strong>{pairs.length}</strong> rhyming pair{pairs.length > 1 ? 's' : ''} shown
          </p>
        </div>
      </div>
    </div>
  );
};

export default RhymingPairs;
