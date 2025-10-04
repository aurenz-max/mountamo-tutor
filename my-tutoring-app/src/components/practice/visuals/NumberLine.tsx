'use client';

import React from 'react';

interface HighlightRange {
  start: number;
  end: number;
  color: string;
}

interface NumberLineData {
  min: number;
  max: number;
  step: number;
  markers?: number[];
  markerColors?: string[];
  markerLabels?: string[];
  highlightRange?: HighlightRange;
  showArrows?: boolean;
}

interface NumberLineProps {
  data: NumberLineData;
  className?: string;
}

/**
 * NumberLine - Visual component for displaying number lines
 * Used for teaching counting, addition, subtraction, and number comparison
 */
export const NumberLine: React.FC<NumberLineProps> = ({ data, className = '' }) => {
  const {
    min,
    max,
    step,
    markers = [],
    markerColors = [],
    markerLabels = [],
    highlightRange,
    showArrows = true
  } = data;

  if (min === undefined || max === undefined || step === undefined) {
    return null;
  }

  const range = max - min;
  const numSteps = Math.floor(range / step) + 1;

  // Calculate positions as percentages
  const getPosition = (value: number) => {
    return ((value - min) / range) * 100;
  };

  return (
    <div className={`relative w-full py-8 ${className}`}>
      {/* Highlight range background */}
      {highlightRange && (
        <div
          className="absolute h-8 rounded opacity-40 top-1/2 transform -translate-y-1/2"
          style={{
            left: `${getPosition(highlightRange.start)}%`,
            width: `${getPosition(highlightRange.end) - getPosition(highlightRange.start)}%`,
            backgroundColor: highlightRange.color
          }}
        />
      )}

      {/* Main line */}
      <svg className="w-full h-16" viewBox="0 0 1000 100" preserveAspectRatio="none">
        {/* Line */}
        <line
          x1={showArrows ? "50" : "0"}
          y1="50"
          x2={showArrows ? "950" : "1000"}
          y2="50"
          stroke="#374151"
          strokeWidth="4"
        />

        {/* Arrows */}
        {showArrows && (
          <>
            <polygon points="50,50 20,40 20,60" fill="#374151" />
            <polygon points="950,50 980,40 980,60" fill="#374151" />
          </>
        )}

        {/* Tick marks for each step */}
        {Array.from({ length: numSteps }).map((_, i) => {
          const value = min + i * step;
          const x = getPosition(value) * 10; // Convert to SVG coordinates (0-1000)
          return (
            <g key={i}>
              <line
                x1={x}
                y1="40"
                x2={x}
                y2="60"
                stroke="#6B7280"
                strokeWidth="2"
              />
              <text
                x={x}
                y="85"
                textAnchor="middle"
                fontSize="14"
                fill="#374151"
                fontWeight="500"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Markers */}
        {markers.map((markerValue, idx) => {
          const x = getPosition(markerValue) * 10;
          const color = markerColors[idx] || '#EF4444';
          return (
            <g key={`marker-${idx}`}>
              <circle cx={x} cy="50" r="8" fill={color} stroke="white" strokeWidth="2" />
              {markerLabels[idx] && (
                <text
                  x={x}
                  y="25"
                  textAnchor="middle"
                  fontSize="12"
                  fill={color}
                  fontWeight="bold"
                >
                  {markerLabels[idx]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
