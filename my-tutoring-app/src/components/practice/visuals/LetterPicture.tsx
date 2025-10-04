'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

interface Item {
  name: string;
  image: string;
  highlight: boolean;
}

interface LetterPictureData {
  letter: string;
  items: Item[];
}

interface LetterPictureProps {
  data: LetterPictureData;
  className?: string;
}

/**
 * LetterPicture - Letter-sound associations with pictures
 * Used for phonics, letter recognition, beginning sounds
 * Matches backend LETTER_PICTURE_SCHEMA
 */
export const LetterPicture: React.FC<LetterPictureProps> = ({ data, className = '' }) => {
  const { letter, items = [] } = data;

  if (!letter || !items || items.length === 0) {
    return null;
  }

  return (
    <div className={`letter-picture ${className}`}>
      {/* Letter header */}
      <div className="p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border-2 border-green-400 text-center mb-4">
        <p className="text-sm font-medium text-green-800 mb-1">Letter</p>
        <p className="text-6xl font-bold text-green-900">{letter.toUpperCase()}</p>
        <p className="text-sm text-green-700 mt-1">
          Which pictures start with "{letter.toUpperCase()}"?
        </p>
      </div>

      {/* Picture grid */}
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border-2 transition-all ${
              item.highlight
                ? 'bg-green-50 border-green-400'
                : 'bg-gray-50 border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center">
              {/* Image/Emoji */}
              <div className="text-5xl mb-2" role="img" aria-label={item.name}>
                {item.image}
              </div>

              {/* Name */}
              <p className="text-sm font-semibold text-gray-900 text-center mb-2">
                {item.name}
              </p>

              {/* Indicator */}
              {item.highlight ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Check size={16} />
                  <span className="text-xs font-medium">Starts with {letter.toUpperCase()}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <X size={16} />
                  <span className="text-xs">Not {letter.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 bg-green-50 rounded border border-green-300">
        <p className="text-sm text-green-900">
          <strong className="font-semibold">
            {items.filter(i => i.highlight).length}
          </strong> of {items.length} items start with the letter <strong>{letter.toUpperCase()}</strong>
        </p>
      </div>
    </div>
  );
};

export default LetterPicture;
