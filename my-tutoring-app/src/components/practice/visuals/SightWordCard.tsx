'use client';

import React from 'react';

interface SightWordCardData {
  word: string;
  fontSize?: 'small' | 'medium' | 'large';
  showInContext?: boolean;
  sentence?: string;
  highlightWord?: boolean;
}

interface SightWordCardProps {
  data: SightWordCardData;
  className?: string;
}

/**
 * SightWordCard - High-frequency word flashcards
 * Used for sight word recognition, reading fluency
 * Matches backend SIGHT_WORD_CARD_SCHEMA
 */
export const SightWordCard: React.FC<SightWordCardProps> = ({ data, className = '' }) => {
  const {
    word,
    fontSize = 'large',
    showInContext = false,
    sentence = '',
    highlightWord = true
  } = data;

  if (!word) {
    return null;
  }

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small':
        return 'text-4xl';
      case 'medium':
        return 'text-6xl';
      case 'large':
      default:
        return 'text-8xl';
    }
  };

  // Highlight the word in the sentence
  const renderSentence = () => {
    if (!sentence) return null;

    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const parts = sentence.split(regex);
    const matches = sentence.match(regex) || [];

    return (
      <p className="text-xl text-gray-800 leading-relaxed">
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {matches[index] && highlightWord ? (
              <span className="font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {matches[index]}
              </span>
            ) : (
              matches[index]
            )}
          </React.Fragment>
        ))}
      </p>
    );
  };

  return (
    <div className={`sight-word-card ${className}`}>
      {/* Main word card */}
      <div className="p-8 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg border-4 border-indigo-400 text-center shadow-lg">
        <p className={`font-bold text-indigo-900 ${getFontSizeClass()}`}>
          {word}
        </p>
      </div>

      {/* Context sentence */}
      {showInContext && sentence && (
        <div className="mt-6 p-6 bg-white rounded-lg border-2 border-blue-300">
          <p className="text-sm font-semibold text-blue-700 mb-3 uppercase tracking-wide">
            Word in Context:
          </p>
          {renderSentence()}
        </div>
      )}

      {/* Practice hint */}
      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
        <p className="text-xs text-yellow-800 text-center">
          <strong>Practice:</strong> Read this sight word quickly without sounding it out.
        </p>
      </div>
    </div>
  );
};

export default SightWordCard;
