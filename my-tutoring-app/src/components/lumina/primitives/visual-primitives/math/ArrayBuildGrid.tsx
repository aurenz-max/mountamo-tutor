'use client';

import React from 'react';
import { cellKey } from './arrayGridWorkspace';

/**
 * Array-grid's open-build surface (`make_array`): an empty grid of cells the learner fills by tapping, one square per
 * tap, and empties by tapping a square again. One svg, so the build layer's picture (`svgPicture`) is exactly what
 * the learner sees. No row, column or square is numbered: the row counts are a lever, drawn `data-aid` in the right
 * margin, which stays empty until it is pulled so the grid never moves.
 */
const CELL = 34;
const PAD = 8;
const MARGIN = 34;

export const ArrayBuildGrid = React.forwardRef<SVGSVGElement, {
  rows: number;
  columns: number;
  cells: readonly string[];
  /** The row-counts lever: beside each row, how many squares are in it. */
  rowCounts: boolean;
  disabled: boolean;
  onToggle: (key: string) => void;
}>(({ rows, columns, cells, rowCounts, disabled, onToggle }, ref) => {
  const w = PAD * 2 + columns * CELL + MARGIN, h = PAD * 2 + rows * CELL;
  const filled = new Set(cells);
  const lengths = new Map<number, number>();
  if (rowCounts) cells.forEach(k => { const r = Number(k.split('-')[0]); lengths.set(r, (lengths.get(r) ?? 0) + 1); });
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h}
      role="group" aria-label="Your array grid" data-build-scene="array-grid" className="h-auto max-w-full rounded-xl">
      <rect width={w - MARGIN} height={h} rx={10} fill="#1e293b" />
      {Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => {
        const key = cellKey(r, c), on = filled.has(key);
        // The painted cell is its own hit area.
        return (
          <rect key={key} x={PAD + c * CELL + 2} y={PAD + r * CELL + 2} width={CELL - 4} height={CELL - 4} rx={5}
            fill={on ? '#34d399' : '#0f172a'} stroke={on ? '#059669' : '#475569'} strokeWidth={on ? 2 : 1}
            role="button" aria-label={`${on ? 'Take out' : 'Put in'} row ${r + 1}, column ${c + 1}`} aria-pressed={on}
            data-pip-object={`cell-${r}-${c}`} data-filled={on || undefined}
            onClick={() => { if (!disabled) onToggle(key); }} style={{ cursor: disabled ? 'default' : 'pointer' }} />
        );
      }))}
      {rowCounts && Array.from(lengths, ([r, n]) => (
        <text key={r} data-aid="row-count" data-lever="row-count" x={w - MARGIN / 2} y={PAD + r * CELL + CELL / 2}
          fontSize={14} fontWeight="bold" fill="#fb923c" textAnchor="middle" dominantBaseline="central">{n}</text>
      ))}
    </svg>
  );
});
ArrayBuildGrid.displayName = 'ArrayBuildGrid';

/** The first array on a two-ways item, drawn small beside the grid: the learner's own work, so "different" has a referent. */
export const FirstArray: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => {
  const s = 10, w = columns * s + 4, h = rows * s + 4;
  return (
    <div className="flex flex-col items-center gap-1" data-first-array={`${rows}x${columns}`}>
      <span className="text-xs text-slate-400">Your first array</span>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label="Your first array">
        {Array.from({ length: rows * columns }, (_, i) => (
          <rect key={i} x={2 + (i % columns) * s} y={2 + Math.floor(i / columns) * s} width={s - 2} height={s - 2} rx={1} fill="#34d399" opacity={0.8} />
        ))}
      </svg>
    </div>
  );
};
