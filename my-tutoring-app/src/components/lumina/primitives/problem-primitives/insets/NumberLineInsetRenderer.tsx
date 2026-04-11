'use client';

import React from 'react';
import type { NumberLineInset } from '../../../types';

interface NumberLineInsetRendererProps {
  data: NumberLineInset;
}

export const NumberLineInsetRenderer: React.FC<NumberLineInsetRendererProps> = ({ data }) => {
  const { min, max, ticks, points, region } = data;
  const range = max - min;
  const toX = (val: number) => ((val - min) / range) * 100;

  const svgHeight = 60;
  const lineY = 35;
  const tickHeight = 8;

  return (
    <div className="w-full px-2">
      <svg viewBox={`0 0 100 ${svgHeight}`} className="w-full h-16" preserveAspectRatio="xMidYMid meet">
        {/* Shaded region */}
        {region && (
          <rect
            x={toX(region.from)}
            y={lineY - 12}
            width={toX(region.to) - toX(region.from)}
            height={24}
            fill="rgba(96, 165, 250, 0.15)"
            rx={2}
          />
        )}

        {/* Main line */}
        <line x1={toX(min)} y1={lineY} x2={toX(max)} y2={lineY} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />

        {/* Arrow tips */}
        <polygon points={`${toX(min)},${lineY} ${toX(min) + 1.5},${lineY - 1.5} ${toX(min) + 1.5},${lineY + 1.5}`} fill="rgba(255,255,255,0.3)" />
        <polygon points={`${toX(max)},${lineY} ${toX(max) - 1.5},${lineY - 1.5} ${toX(max) - 1.5},${lineY + 1.5}`} fill="rgba(255,255,255,0.3)" />

        {/* Tick marks */}
        {ticks.map((tick, i) => {
          const x = toX(tick);
          return (
            <g key={i}>
              <line x1={x} y1={lineY - tickHeight / 2} x2={x} y2={lineY + tickHeight / 2} stroke="rgba(255,255,255,0.4)" strokeWidth={0.4} />
              <text x={x} y={lineY + tickHeight + 4} textAnchor="middle" fill="#94a3b8" fontSize={3.2} fontFamily="monospace">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Region label */}
        {region?.label && (
          <text
            x={(toX(region.from) + toX(region.to)) / 2}
            y={lineY - 15}
            textAnchor="middle"
            fill="#60a5fa"
            fontSize={3}
            fontFamily="monospace"
          >
            {region.label}
          </text>
        )}

        {/* Points */}
        {points?.map((pt, i) => {
          const x = toX(pt.value);
          const color = pt.color ?? '#60a5fa';
          return (
            <g key={i}>
              <circle cx={x} cy={lineY} r={2} fill={color} />
              <text x={x} y={lineY - 6} textAnchor="middle" fill={color} fontSize={3.2} fontWeight="bold">
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
