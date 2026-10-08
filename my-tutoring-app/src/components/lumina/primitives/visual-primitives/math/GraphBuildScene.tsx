'use client';

import React from 'react';
import { GRAPH_MAX } from './barModelBuild';

/**
 * Bar model's open-build surface (`make_graph`): an empty picture graph the learner fills by tapping a column (one
 * more picture on its bar) and empties by tapping a picture (one fewer). One svg, so the build layer's picture
 * (`svgPicture`) is exactly what the learner sees. No number is printed: the level line and the bar counts are levers
 * the bar model passes in, off until pulled, and both are `data-aid` so the watcher never reads them.
 */
const W = 480;
const H = 360;
const CELL = 26;
const TOP = 20;
const BASE = TOP + GRAPH_MAX * CELL;
const SIDE = 20;
const FILLS = ['#93c5fd', '#86efac', '#d8b4fe', '#fdba74'];
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface GraphBar { label: string; value: number; emoji?: string }

export const GraphBuildScene = React.forwardRef<SVGSVGElement, {
  bars: readonly GraphBar[];
  /** The level-line lever: the row whose bar top the dashed line marks. */
  lineRow: number | null;
  /** The bar-counts lever: how many pictures are in each bar, above it. */
  counts: boolean;
  disabled: boolean;
  onAdd: (row: number) => void;
  onRemove: (row: number) => void;
  /** Registers each column as Pip's row target (`row-<i>`). */
  rowRef?: (id: string) => (element: Element | null) => void;
}>(({ bars, lineRow, counts, disabled, onAdd, onRemove, rowRef }, ref) => {
  const colW = (W - 2 * SIDE) / Math.max(1, bars.length);
  const barW = Math.min(90, colW - 24);
  const cx = (i: number) => SIDE + colW * i + colW / 2;
  const lineY = lineRow != null && bars[lineRow] ? BASE - bars[lineRow].value * CELL : null;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}
      role="group" aria-label="Your graph: tap a column to put one more picture in it" data-build-scene="graph"
      className="h-auto max-w-full rounded-xl">
      <rect width={W} height={H} rx={12} fill="#f4f6f8" />
      {Array.from({ length: GRAPH_MAX + 1 }, (_, k) => (
        <line key={k} x1={SIDE} x2={W - SIDE} y1={BASE - k * CELL} y2={BASE - k * CELL} stroke={k === 0 ? '#475569' : '#dbe1e8'}
          strokeWidth={k === 0 ? 2 : 1} />
      ))}
      {bars.map((bar, i) => {
        const x = cx(i) - barW / 2;
        return (
          <g key={bar.label} data-graph-column={i}>
            {/* The column is the tap target: it paints, so a real browser hits it (a bare <g> has no hit area). */}
            <rect ref={rowRef?.(`row-${i}`)} data-pip-object={`row-${i}`} x={x - 6} y={TOP} width={barW + 12} height={GRAPH_MAX * CELL} fill="#ffffff" fillOpacity={0.55}
              role="button" aria-label={`Put one more in ${bar.label}`} aria-disabled={disabled}
              style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => { if (!disabled) onAdd(i); }} />
            {Array.from({ length: bar.value }, (_, k) => {
              const top = k === bar.value - 1;
              return (
                <g key={k} data-graph-picture={`${i}-${k}`}>
                  <rect x={x} y={BASE - (k + 1) * CELL + 1} width={barW} height={CELL - 2} rx={5} fill={FILLS[i % FILLS.length]}
                    stroke="#64748b" strokeOpacity={0.35} style={{ cursor: disabled ? 'default' : 'pointer' }}
                    {...(top ? { role: 'button', 'aria-label': `Take one out of ${bar.label}`, 'data-pip-object': `top-${i}` } : {})}
                    onClick={(e) => { e.stopPropagation(); if (!disabled) onRemove(i); }} />
                  <text x={cx(i)} y={BASE - k * CELL - CELL / 2} fontSize={17} textAnchor="middle" dominantBaseline="central"
                    pointerEvents="none" style={{ fontFamily: EMOJI_FONT }}>{bar.emoji ?? ''}</text>
                </g>
              );
            })}
            <text x={cx(i)} y={BASE + 22} fontSize={22} textAnchor="middle" dominantBaseline="central" pointerEvents="none"
              style={{ fontFamily: EMOJI_FONT }}>{bar.emoji ?? ''}</text>
            <text x={cx(i)} y={BASE + 50} fontSize={15} fontWeight={600} fill="#1e293b" textAnchor="middle" pointerEvents="none">
              {capital(bar.label)}
            </text>
            {counts && (
              <text data-aid="count" data-lever="bar-counts" x={cx(i)} y={BASE - bar.value * CELL - 10} fontSize={15} fontWeight={700}
                fill="#c2410c" textAnchor="middle" pointerEvents="none">{bar.value}</text>
            )}
          </g>
        );
      })}
      {lineY != null && (
        <line data-aid="level-line" data-lever="level-line" x1={SIDE} x2={W - SIDE} y1={lineY} y2={lineY}
          stroke="#f97316" strokeWidth={3} strokeDasharray="10 6" pointerEvents="none" />
      )}
    </svg>
  );
});
GraphBuildScene.displayName = 'GraphBuildScene';
