'use client';

import React from 'react';

interface GeometricShapeData {
  shape: 'rectangle' | 'square' | 'circle' | 'triangle';
  width: number;
  height: number;
  unit?: string;
  color?: string;
  showDimensions?: boolean;
  showGrid?: boolean;
}

interface GeometricShapeProps {
  data: GeometricShapeData;
  className?: string;
}

/**
 * GeometricShape - Renders geometric shapes with dimensions
 * Used for geometry, area, perimeter calculations
 * Matches backend GEOMETRIC_SHAPE_SCHEMA
 */
export const GeometricShape: React.FC<GeometricShapeProps> = ({ data, className = '' }) => {
  const {
    shape,
    width,
    height,
    unit = 'cm',
    color = '#10B981',
    showDimensions = true,
    showGrid = false
  } = data;

  if (!shape || width === undefined || height === undefined) {
    return null;
  }

  const svgWidth = 300;
  const svgHeight = 300;
  const margin = 50;
  const scale = Math.min(
    (svgWidth - 2 * margin) / width,
    (svgHeight - 2 * margin) / height
  );

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  const renderShape = () => {
    switch (shape) {
      case 'rectangle':
      case 'square':
        return (
          <rect
            x={centerX - scaledWidth / 2}
            y={centerY - scaledHeight / 2}
            width={scaledWidth}
            height={scaledHeight}
            fill={color}
            stroke="#1F2937"
            strokeWidth="2"
          />
        );

      case 'circle':
        const radius = Math.min(scaledWidth, scaledHeight) / 2;
        return (
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill={color}
            stroke="#1F2937"
            strokeWidth="2"
          />
        );

      case 'triangle':
        const points = [
          `${centerX},${centerY - scaledHeight / 2}`,
          `${centerX - scaledWidth / 2},${centerY + scaledHeight / 2}`,
          `${centerX + scaledWidth / 2},${centerY + scaledHeight / 2}`
        ].join(' ');
        return (
          <polygon
            points={points}
            fill={color}
            stroke="#1F2937"
            strokeWidth="2"
          />
        );

      default:
        return null;
    }
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    const gridLines = [];
    const gridSize = 10; // Grid squares

    // Vertical lines
    for (let i = 0; i <= width; i++) {
      const x = centerX - scaledWidth / 2 + (i * scaledWidth) / width;
      gridLines.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={centerY - scaledHeight / 2}
          x2={x}
          y2={centerY + scaledHeight / 2}
          stroke="#9CA3AF"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i <= height; i++) {
      const y = centerY - scaledHeight / 2 + (i * scaledHeight) / height;
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={centerX - scaledWidth / 2}
          y1={y}
          x2={centerX + scaledWidth / 2}
          y2={y}
          stroke="#9CA3AF"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      );
    }

    return gridLines;
  };

  const renderDimensions = () => {
    if (!showDimensions) return null;

    return (
      <>
        {/* Width dimension */}
        <g>
          <line
            x1={centerX - scaledWidth / 2}
            y1={centerY + scaledHeight / 2 + 20}
            x2={centerX + scaledWidth / 2}
            y2={centerY + scaledHeight / 2 + 20}
            stroke="#6B7280"
            strokeWidth="2"
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <text
            x={centerX}
            y={centerY + scaledHeight / 2 + 38}
            textAnchor="middle"
            className="text-sm font-semibold"
            fill="#374151"
          >
            {width} {unit}
          </text>
        </g>

        {/* Height dimension */}
        {shape !== 'circle' && (
          <g>
            <line
              x1={centerX + scaledWidth / 2 + 20}
              y1={centerY - scaledHeight / 2}
              x2={centerX + scaledWidth / 2 + 20}
              y2={centerY + scaledHeight / 2}
              stroke="#6B7280"
              strokeWidth="2"
              markerStart="url(#arrow-start)"
              markerEnd="url(#arrow-end)"
            />
            <text
              x={centerX + scaledWidth / 2 + 35}
              y={centerY}
              textAnchor="middle"
              className="text-sm font-semibold"
              fill="#374151"
              transform={`rotate(90, ${centerX + scaledWidth / 2 + 35}, ${centerY})`}
            >
              {height} {unit}
            </text>
          </g>
        )}
      </>
    );
  };

  return (
    <div className={`geometric-shape ${className}`}>
      <svg width={svgWidth} height={svgHeight} className="mx-auto">
        <defs>
          <marker
            id="arrow-start"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
          >
            <polygon points="10 5, 0 0, 0 10" fill="#6B7280" />
          </marker>
          <marker
            id="arrow-end"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
          >
            <polygon points="0 5, 10 0, 10 10" fill="#6B7280" />
          </marker>
        </defs>

        {renderGrid()}
        {renderShape()}
        {renderDimensions()}
      </svg>

      {/* Shape info */}
      <div className="mt-4 p-3 bg-green-50 rounded border border-green-300">
        <p className="text-sm font-semibold text-green-900 capitalize">{shape}</p>
        <p className="text-xs text-green-700">
          Dimensions: {width} × {height} {unit}
        </p>
        {shape === 'rectangle' || shape === 'square' ? (
          <p className="text-xs text-green-700">
            Area: {width * height} {unit}²
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default GeometricShape;
