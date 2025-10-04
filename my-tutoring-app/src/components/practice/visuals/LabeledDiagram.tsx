'use client';

import React from 'react';

interface Label {
  text: string;
  x: number;
  y: number;
  lineToX?: number;
  lineToY?: number;
}

interface LabeledDiagramData {
  imageUrl: string;
  labels: Label[];
}

interface LabeledDiagramProps {
  data: LabeledDiagramData;
  className?: string;
}

/**
 * LabeledDiagram - Renders scientific diagrams with labels and pointer lines
 * Used for anatomy, plant parts, scientific equipment, etc.
 * Matches backend LABELED_DIAGRAM_SCHEMA
 */
export const LabeledDiagram: React.FC<LabeledDiagramProps> = ({ data, className = '' }) => {
  const { imageUrl, labels = [] } = data;

  if (!imageUrl) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">No image URL provided for diagram</p>
      </div>
    );
  }

  return (
    <div className={`labeled-diagram relative inline-block ${className}`}>
      <div className="relative w-full max-w-lg mx-auto">
        {/* Main diagram image */}
        <img
          src={imageUrl}
          alt="Labeled diagram"
          className="w-full h-auto rounded-lg border-2 border-gray-200"
        />

        {/* SVG overlay for labels and pointer lines */}
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <marker
              id="arrowhead-label"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" />
            </marker>
          </defs>

          {labels.map((label, index) => {
            const hasPointer = label.lineToX !== undefined && label.lineToY !== undefined;

            return (
              <g key={index}>
                {/* Pointer line from label to target */}
                {hasPointer && (
                  <line
                    x1={label.x}
                    y1={label.y}
                    x2={label.lineToX}
                    y2={label.lineToY}
                    stroke="#3B82F6"
                    strokeWidth="0.5"
                    markerEnd="url(#arrowhead-label)"
                  />
                )}

                {/* Label background box */}
                <rect
                  x={label.x - 8}
                  y={label.y - 3}
                  width={label.text.length * 1.5 + 2}
                  height="4"
                  fill="white"
                  stroke="#3B82F6"
                  strokeWidth="0.3"
                  rx="0.5"
                />

                {/* Label text */}
                <text
                  x={label.x}
                  y={label.y}
                  className="text-xs font-semibold"
                  fill="#1E40AF"
                  fontSize="3"
                  textAnchor="start"
                >
                  {label.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Labels list for accessibility */}
      {labels.length > 0 && (
        <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-800 font-medium mb-1">Parts labeled:</p>
          <p className="text-xs text-blue-700">
            {labels.map(l => l.text).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default LabeledDiagram;
