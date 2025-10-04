'use client';

import React from 'react';

interface StrokeOrder {
  path: string;
  number: number;
}

interface LetterTracingData {
  letter: string;
  case: 'uppercase' | 'lowercase';
  showDirectionArrows?: boolean;
  showDottedGuide?: boolean;
  strokeOrder?: StrokeOrder[];
}

interface LetterTracingProps {
  data: LetterTracingData;
  className?: string;
}

/**
 * LetterTracing - Letter formation with stroke order
 * Used for handwriting practice, letter formation
 * Matches backend LETTER_TRACING_SCHEMA
 */
export const LetterTracing: React.FC<LetterTracingProps> = ({ data, className = '' }) => {
  const {
    letter,
    case: letterCase,
    showDirectionArrows = true,
    showDottedGuide = true,
    strokeOrder = []
  } = data;

  if (!letter) {
    return null;
  }

  const displayLetter = letterCase === 'uppercase' ? letter.toUpperCase() : letter.toLowerCase();

  return (
    <div className={`letter-tracing ${className}`}>
      <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300">
        {/* Large letter display */}
        <div className="text-center mb-4">
          <div className="inline-block p-8 bg-white rounded-lg border-4 border-dashed border-blue-300 relative">
            <span className={`font-bold ${showDottedGuide ? 'text-gray-300' : 'text-blue-600'}`} style={{ fontSize: '120px', lineHeight: '120px' }}>
              {displayLetter}
            </span>

            {/* Stroke order visualization (if provided) */}
            {strokeOrder.length > 0 && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                {strokeOrder.map((stroke, index) => (
                  <g key={index}>
                    <path
                      d={stroke.path}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={showDottedGuide ? "4 4" : "none"}
                    />
                    <circle
                      cx={stroke.path.split(' ')[1].split(',')[0]}
                      cy={stroke.path.split(' ')[1].split(',')[1]}
                      r="3"
                      fill="#EF4444"
                    />
                    <text
                      x={stroke.path.split(' ')[1].split(',')[0]}
                      y={stroke.path.split(' ')[1].split(',')[1]}
                      className="text-xs font-bold"
                      fill="#EF4444"
                      dy="-5"
                    >
                      {stroke.number}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Letter info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded border border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Letter</p>
            <p className="text-2xl font-bold text-blue-900">{displayLetter}</p>
          </div>
          <div className="p-3 bg-white rounded border border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Case</p>
            <p className="text-lg font-semibold text-blue-900 capitalize">{letterCase}</p>
          </div>
        </div>

        {/* Instructions */}
        {strokeOrder.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-300">
            <p className="text-sm font-semibold text-yellow-900 mb-1">Writing Instructions:</p>
            <p className="text-xs text-yellow-800">
              Follow the numbered strokes ({strokeOrder.length} stroke{strokeOrder.length > 1 ? 's' : ''}) to write the letter correctly.
              Start at the red dot for each stroke.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LetterTracing;
