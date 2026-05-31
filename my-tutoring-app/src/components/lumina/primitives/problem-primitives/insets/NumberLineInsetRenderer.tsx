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

  // Wide, short strip: the viewBox aspect (100:24 ≈ 4:1) matches a number line,
  // and `w-full h-auto` lets the SVG fill the figure width with a proportional
  // height — instead of being pinned tiny by a fixed pixel height + square box.
  const lineY = 13;
  const tickHeight = 6;

  return (
    <div className="w-full px-2">
      <svg viewBox="0 0 100 24" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Shaded region */}
        {region && (
          <rect
            x={toX(region.from)}
            y={lineY - 6}
            width={toX(region.to) - toX(region.from)}
            height={12}
            fill="rgba(96, 165, 250, 0.15)"
            rx={2}
          />
        )}

        {/* Main line */}
        <line x1={toX(min)} y1={lineY} x2={toX(max)} y2={lineY} stroke="rgba(255,255,255,0.3)" strokeWidth={0.3} />

        {/* Arrow tips */}
        <polygon points={`${toX(min)},${lineY} ${toX(min) + 1.5},${lineY - 1.5} ${toX(min) + 1.5},${lineY + 1.5}`} fill="rgba(255,255,255,0.3)" />
        <polygon points={`${toX(max)},${lineY} ${toX(max) - 1.5},${lineY - 1.5} ${toX(max) - 1.5},${lineY + 1.5}`} fill="rgba(255,255,255,0.3)" />

        {/* Tick marks */}
        {ticks.map((tick, i) => {
          const x = toX(tick);
          return (
            <g key={i}>
              <line x1={x} y1={lineY - tickHeight / 2} x2={x} y2={lineY + tickHeight / 2} stroke="rgba(255,255,255,0.4)" strokeWidth={0.3} />
              <text x={x} y={lineY + tickHeight / 2 + 3.5} textAnchor="middle" fill="#94a3b8" fontSize={2.6} fontFamily="monospace">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Region label */}
        {region?.label && (
          <text
            x={(toX(region.from) + toX(region.to)) / 2}
            y={lineY - 8}
            textAnchor="middle"
            fill="#60a5fa"
            fontSize={2.6}
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
              <circle cx={x} cy={lineY} r={1.5} fill={color} />
              <text x={x} y={lineY - 4} textAnchor="middle" fill={color} fontSize={2.8} fontWeight="bold">
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
