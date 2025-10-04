'use client';

import React from 'react';

interface Circle {
  label: string;
  color?: string;
  items: string[];
}

interface VennDiagramData {
  circles: Circle[];
  overlap: string[];
}

interface VennDiagramProps {
  data: VennDiagramData;
  className?: string;
}

/**
 * VennDiagram - Compare/contrast circles diagram
 * Used for similarities/differences, compare/contrast analysis
 * Matches backend VENN_DIAGRAM_SCHEMA
 */
export const VennDiagram: React.FC<VennDiagramProps> = ({ data, className = '' }) => {
  const { circles = [], overlap = [] } = data;

  if (!circles || circles.length < 2) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">Venn diagram requires at least 2 circles</p>
      </div>
    );
  }

  const circle1 = circles[0];
  const circle2 = circles[1];
  const color1 = circle1.color || '#93C5FD';
  const color2 = circle2.color || '#FCA5A5';

  return (
    <div className={`venn-diagram ${className}`}>
      {/* SVG diagram */}
      <svg width="400" height="300" viewBox="0 0 400 300" className="mx-auto">
        {/* Left circle */}
        <circle
          cx="140"
          cy="150"
          r="80"
          fill={color1}
          fillOpacity="0.5"
          stroke={color1}
          strokeWidth="3"
        />

        {/* Right circle */}
        <circle
          cx="260"
          cy="150"
          r="80"
          fill={color2}
          fillOpacity="0.5"
          stroke={color2}
          strokeWidth="3"
        />

        {/* Labels */}
        <text
          x="140"
          y="80"
          textAnchor="middle"
          className="font-bold text-base"
          fill="#1F2937"
        >
          {circle1.label}
        </text>

        <text
          x="260"
          y="80"
          textAnchor="middle"
          className="font-bold text-base"
          fill="#1F2937"
        >
          {circle2.label}
        </text>

        <text
          x="200"
          y="100"
          textAnchor="middle"
          className="font-semibold text-sm"
          fill="#6B7280"
        >
          Both
        </text>
      </svg>

      {/* Item lists */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {/* Left circle items */}
        <div className="p-3 rounded-lg border-2" style={{ borderColor: color1, backgroundColor: `${color1}20` }}>
          <h4 className="font-bold text-sm mb-2 text-gray-900">{circle1.label} Only</h4>
          <ul className="space-y-1">
            {circle1.items.map((item, index) => (
              <li key={index} className="text-xs text-gray-700 flex items-start gap-1">
                <span className="text-blue-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Overlap items */}
        <div className="p-3 rounded-lg border-2 border-purple-400 bg-purple-50">
          <h4 className="font-bold text-sm mb-2 text-gray-900">Both Share</h4>
          <ul className="space-y-1">
            {overlap.map((item, index) => (
              <li key={index} className="text-xs text-gray-700 flex items-start gap-1">
                <span className="text-purple-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right circle items */}
        <div className="p-3 rounded-lg border-2" style={{ borderColor: color2, backgroundColor: `${color2}20` }}>
          <h4 className="font-bold text-sm mb-2 text-gray-900">{circle2.label} Only</h4>
          <ul className="space-y-1">
            {circle2.items.map((item, index) => (
              <li key={index} className="text-xs text-gray-700 flex items-start gap-1">
                <span className="text-red-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VennDiagram;
