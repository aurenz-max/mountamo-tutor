'use client';

import React from 'react';

interface Branch {
  word: string;
  color?: string;
}

interface Center {
  word: string;
  size?: 'small' | 'medium' | 'large';
}

interface WordWebData {
  center: Center;
  branches: Branch[];
}

interface WordWebProps {
  data: WordWebData;
  className?: string;
}

/**
 * WordWeb - Renders vocabulary mind maps
 * Used for synonyms, word relationships, vocabulary expansion
 * Matches backend WORD_WEB_SCHEMA
 */
export const WordWeb: React.FC<WordWebProps> = ({ data, className = '' }) => {
  const { center, branches = [] } = data;

  if (!center || !branches || branches.length === 0) {
    return null;
  }

  const getSizeClass = (size: string | undefined) => {
    switch (size) {
      case 'large':
        return 'text-3xl px-8 py-4';
      case 'small':
        return 'text-base px-4 py-2';
      default:
        return 'text-xl px-6 py-3';
    }
  };

  const angleStep = (2 * Math.PI) / branches.length;
  const radius = 120;
  const centerX = 200;
  const centerY = 200;

  return (
    <div className={`word-web ${className}`}>
      <svg width="400" height="400" viewBox="0 0 400 400" className="mx-auto">
        {/* Connection lines from center to branches */}
        {branches.map((branch, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          return (
            <line
              key={`line-${index}`}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke={branch.color || '#FBBF24'}
              strokeWidth="3"
            />
          );
        })}

        {/* Branch circles */}
        {branches.map((branch, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          return (
            <g key={`branch-${index}`}>
              <circle
                cx={x}
                cy={y}
                r="40"
                fill={branch.color || '#FBBF24'}
                stroke="white"
                strokeWidth="3"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                className="font-semibold text-sm"
                fill="white"
              >
                {branch.word}
              </text>
            </g>
          );
        })}

        {/* Center circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r="50"
          fill="#F59E0B"
          stroke="white"
          strokeWidth="4"
        />
        <text
          x={centerX}
          y={centerY + 6}
          textAnchor="middle"
          className="font-bold text-lg"
          fill="white"
        >
          {center.word}
        </text>
      </svg>

      {/* Word list */}
      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
        <p className="text-sm font-semibold text-yellow-900 mb-2">
          Related words for "{center.word}":
        </p>
        <div className="flex flex-wrap gap-2">
          {branches.map((branch, index) => (
            <span
              key={index}
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: branch.color || '#FBBF24' }}
            >
              {branch.word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WordWeb;
