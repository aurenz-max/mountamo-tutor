'use client';

import React from 'react';

interface Circle {
  segments: number;
  shaded: number;
  label: string;
}

interface FractionCirclesData {
  circles: Circle[];
  shadedColor?: string;
  unshadedColor?: string;
}

interface FractionCirclesProps {
  data: FractionCirclesData;
  className?: string;
}

/**
 * FractionCircles - Renders fraction pie charts
 * Used for teaching fractions, part-whole relationships
 * Matches backend FRACTION_CIRCLES_SCHEMA
 */
export const FractionCircles: React.FC<FractionCirclesProps> = ({ data, className = '' }) => {
  const {
    circles = [],
    shadedColor = '#3B82F6',
    unshadedColor = '#E5E7EB'
  } = data;

  if (!circles || circles.length === 0) {
    return null;
  }

  const renderCircle = (circle: Circle, index: number) => {
    const { segments, shaded, label } = circle;
    const radius = 60;
    const centerX = 80;
    const centerY = 80;
    const anglePerSegment = (2 * Math.PI) / segments;

    // Create path for each segment
    const createSegmentPath = (segmentIndex: number) => {
      const startAngle = segmentIndex * anglePerSegment - Math.PI / 2;
      const endAngle = (segmentIndex + 1) * anglePerSegment - Math.PI / 2;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArcFlag = anglePerSegment > Math.PI ? 1 : 0;

      return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    };

    return (
      <div key={index} className="flex flex-col items-center">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {/* Draw all segments */}
          {Array.from({ length: segments }).map((_, i) => {
            const isShaded = i < shaded;
            return (
              <g key={i}>
                <path
                  d={createSegmentPath(i)}
                  fill={isShaded ? shadedColor : unshadedColor}
                  stroke="white"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Outer circle border */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth="3"
          />

          {/* Center label */}
          <text
            x={centerX}
            y={centerY + 5}
            textAnchor="middle"
            className="font-bold text-sm"
            fill="#1F2937"
          >
            {label}
          </text>
        </svg>

        {/* Text label below */}
        <div className="mt-2 text-center">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-600">
            {shaded} of {segments} shaded
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`fraction-circles flex flex-wrap gap-6 justify-center ${className}`}>
      {circles.map((circle, index) => renderCircle(circle, index))}
    </div>
  );
};

export default FractionCircles;
