'use client';

import React from 'react';

interface Point {
  x: number;
  y: number;
}

interface LineGraphData {
  title: string;
  xLabel: string;
  yLabel: string;
  points: Point[];
}

interface LineGraphProps {
  data: LineGraphData;
  className?: string;
}

/**
 * LineGraph - Renders line graphs for plotting data
 * Used for showing trends, experiments, data visualization
 * Matches backend LINE_GRAPH_SCHEMA
 */
export const LineGraph: React.FC<LineGraphProps> = ({ data, className = '' }) => {
  const { title, xLabel, yLabel, points = [] } = data;

  if (!points || points.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">No data points provided for graph</p>
      </div>
    );
  }

  // Calculate ranges
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues);

  // Add padding to ranges
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xPadding = xRange * 0.1;
  const yPadding = yRange * 0.1;

  const plotXMin = xMin - xPadding;
  const plotXMax = xMax + xPadding;
  const plotYMin = yMin - yPadding;
  const plotYMax = yMax + yPadding;

  // SVG dimensions
  const width = 400;
  const height = 300;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Scale functions
  const scaleX = (x: number) =>
    margin.left + ((x - plotXMin) / (plotXMax - plotXMin)) * plotWidth;
  const scaleY = (y: number) =>
    margin.top + plotHeight - ((y - plotYMin) / (plotYMax - plotYMin)) * plotHeight;

  // Create path for line
  const linePath = points
    .map((point, i) => {
      const x = scaleX(point.x);
      const y = scaleY(point.y);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate tick marks
  const numXTicks = Math.min(points.length, 10);
  const numYTicks = 5;

  return (
    <div className={`line-graph ${className}`}>
      <svg width={width} height={height} className="mx-auto border border-gray-200 rounded-lg bg-white">
        {/* Title */}
        <text
          x={width / 2}
          y={20}
          textAnchor="middle"
          className="font-bold text-sm"
          fill="#1F2937"
        >
          {title}
        </text>

        {/* Y-axis */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={height - margin.bottom}
          stroke="#6B7280"
          strokeWidth="2"
        />

        {/* X-axis */}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          stroke="#6B7280"
          strokeWidth="2"
        />

        {/* Y-axis label */}
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90, 15, ${height / 2})`}
          className="text-xs font-medium"
          fill="#374151"
        >
          {yLabel}
        </text>

        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          className="text-xs font-medium"
          fill="#374151"
        >
          {xLabel}
        </text>

        {/* Y-axis ticks and labels */}
        {Array.from({ length: numYTicks + 1 }).map((_, i) => {
          const value = plotYMin + (i / numYTicks) * (plotYMax - plotYMin);
          const y = scaleY(value);
          return (
            <g key={`y-tick-${i}`}>
              <line
                x1={margin.left - 5}
                y1={y}
                x2={margin.left}
                y2={y}
                stroke="#6B7280"
                strokeWidth="1"
              />
              <text
                x={margin.left - 10}
                y={y + 4}
                textAnchor="end"
                className="text-xs"
                fill="#6B7280"
              >
                {value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks and labels */}
        {points.map((point, i) => {
          if (points.length > 10 && i % Math.ceil(points.length / 10) !== 0) return null;
          const x = scaleX(point.x);
          return (
            <g key={`x-tick-${i}`}>
              <line
                x1={x}
                y1={height - margin.bottom}
                x2={x}
                y2={height - margin.bottom + 5}
                stroke="#6B7280"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - margin.bottom + 18}
                textAnchor="middle"
                className="text-xs"
                fill="#6B7280"
              >
                {point.x}
              </text>
            </g>
          );
        })}

        {/* Grid lines (optional) */}
        {Array.from({ length: numYTicks + 1 }).map((_, i) => {
          const value = plotYMin + (i / numYTicks) * (plotYMax - plotYMin);
          const y = scaleY(value);
          return (
            <line
              key={`grid-${i}`}
              x1={margin.left}
              y1={y}
              x2={width - margin.right}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="5"
            fill="#1E40AF"
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Data table below graph */}
      <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">Data Points:</p>
        <div className="flex flex-wrap gap-2">
          {points.map((point, i) => (
            <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-gray-300">
              ({point.x}, {point.y})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LineGraph;
