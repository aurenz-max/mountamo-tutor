'use client';

import React from 'react';

interface Trait {
  trait: string;
  evidence: string;
}

interface Character {
  name: string;
  icon?: string;
}

interface CharacterWebData {
  character: Character;
  traits: Trait[];
}

interface CharacterWebProps {
  data: CharacterWebData;
  className?: string;
}

/**
 * CharacterWeb - Character trait analysis diagram
 * Used for character analysis, story elements, reading comprehension
 * Matches backend CHARACTER_WEB_SCHEMA
 */
export const CharacterWeb: React.FC<CharacterWebProps> = ({ data, className = '' }) => {
  const { character, traits = [] } = data;

  if (!character || !traits || traits.length === 0) {
    return null;
  }

  const colors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

  return (
    <div className={`character-web space-y-4 ${className}`}>
      {/* Character header */}
      <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border-2 border-purple-300 text-center">
        {character.icon && (
          <div className="text-6xl mb-2" role="img" aria-label={character.name}>
            {character.icon}
          </div>
        )}
        <h3 className="text-2xl font-bold text-purple-900">{character.name}</h3>
      </div>

      {/* Traits grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {traits.map((trait, index) => {
          const color = colors[index % colors.length];

          return (
            <div
              key={index}
              className="p-4 bg-white rounded-lg border-l-4 shadow-sm"
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                  style={{ backgroundColor: color }}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">{trait.trait}</h4>
                  <p className="text-sm text-gray-600 italic">"{trait.evidence}"</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-3 bg-purple-50 rounded border border-purple-200">
        <p className="text-sm font-semibold text-purple-900">
          {character.name} is characterized by: {traits.map(t => t.trait.toLowerCase()).join(', ')}
        </p>
      </div>
    </div>
  );
};

export default CharacterWeb;
