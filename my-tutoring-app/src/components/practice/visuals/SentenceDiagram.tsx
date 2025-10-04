'use client';

import React from 'react';

interface WordPart {
  word: string;
  type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'article' | 'preposition' | 'pronoun' | 'conjunction';
  color: string;
}

interface SentenceDiagramData {
  sentence: string;
  parts: WordPart[];
}

interface SentenceDiagramProps {
  data: SentenceDiagramData;
  className?: string;
}

/**
 * SentenceDiagram - Color-coded parts of speech diagram
 * Used for grammar, sentence structure, parts of speech
 * Matches backend SENTENCE_DIAGRAM_SCHEMA
 */
export const SentenceDiagram: React.FC<SentenceDiagramProps> = ({ data, className = '' }) => {
  const { sentence, parts = [] } = data;

  if (!parts || parts.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded border border-gray-300">
        <p className="text-gray-700">{sentence}</p>
      </div>
    );
  }

  // Legend of parts of speech
  const uniqueTypes = Array.from(new Set(parts.map(p => p.type)));

  return (
    <div className={`sentence-diagram space-y-4 ${className}`}>
      {/* Sentence with color-coded words */}
      <div className="p-4 bg-white rounded-lg border-2 border-gray-300 flex flex-wrap gap-2">
        {parts.map((part, index) => (
          <span
            key={index}
            className="px-3 py-1 rounded-lg font-medium border-2 transition-transform hover:scale-105"
            style={{
              backgroundColor: part.color,
              borderColor: part.color,
              color: '#1F2937'
            }}
          >
            {part.word}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">Parts of Speech:</p>
        <div className="flex flex-wrap gap-3">
          {uniqueTypes.map((type, index) => {
            const example = parts.find(p => p.type === type);
            if (!example) return null;

            return (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    backgroundColor: example.color,
                    borderColor: example.color
                  }}
                />
                <span className="text-xs font-medium text-gray-700 capitalize">
                  {type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Word analysis */}
      <div className="grid grid-cols-2 gap-2">
        {parts.map((part, index) => (
          <div
            key={index}
            className="p-2 rounded border-l-4 bg-white"
            style={{ borderLeftColor: part.color }}
          >
            <p className="font-semibold text-sm text-gray-900">{part.word}</p>
            <p className="text-xs text-gray-600 capitalize">{part.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SentenceDiagram;
