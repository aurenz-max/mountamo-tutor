'use client';

import React from 'react';
import { BUILD_COLS, BUILD_ROWS, cellKey, type Cell } from './polygonAreaBuild';

/**
 * Polygon area builder's open-build surface (`build_area`): an empty grid the learner shades one square per tap and
 * clears by tapping a shaded square. One svg, so the build layer's picture (`svgPicture`) is exactly what the learner
 * sees. Nothing here counts for the learner: the square numbers and the piece tints are levers, `data-aid`, left out
 * of the picture.
 */
const CELL = 36;
const PAD = 6;
export const GRID_W = BUILD_COLS * CELL + PAD * 2;
export const GRID_H = BUILD_ROWS * CELL + PAD * 2;
const PIECE_TINTS = ['#f97316', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#3b82f6'];

export const AreaBuildGrid = React.forwardRef<SVGSVGElement, {
  cells: readonly Cell[];
  /** The square-numbers lever: each shaded square carries the number of the tap that shaded it. */
  numbers: boolean;
  /** The piece-colours lever: the piece index of each shaded square, by `cellKey`. */
  pieces: ReadonlyMap<string, number> | null;
  /** The perimeter build's edge-marks lever: a dot on each side around the shape (`outsideSides`). No number. */
  edges?: ReadonlyArray<Cell & { side: 'right' | 'left' | 'bottom' | 'top' }> | null;
  disabled: boolean;
  onToggle: (cell: Cell) => void;
}>(({ cells, numbers, pieces, edges, disabled, onToggle }, ref) => {
  const order = new Map(cells.map((x, i) => [cellKey(x), i]));
  const edgeAt = (e: Cell & { side: string }) => {
    const x = PAD + e.c * CELL, y = PAD + e.r * CELL;
    return e.side === 'right' ? [x + CELL, y + CELL / 2] : e.side === 'left' ? [x, y + CELL / 2]
      : e.side === 'bottom' ? [x + CELL / 2, y + CELL] : [x + CELL / 2, y];
  };
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${GRID_W} ${GRID_H}`} width={GRID_W} height={GRID_H}
      role="group" aria-label="Your square grid" data-build-scene="area-grid" className="h-auto max-w-full rounded-xl">
      <rect width={GRID_W} height={GRID_H} rx={10} fill="#0f172a" />
      {Array.from({ length: BUILD_ROWS }, (_, r) => Array.from({ length: BUILD_COLS }, (_, c) => {
        const k = `${c},${r}`, at = order.get(k), shaded = at !== undefined, x = PAD + c * CELL, y = PAD + r * CELL;
        const piece = shaded && pieces ? pieces.get(k) : undefined;
        return (
          <g key={k} role="button" aria-label={`${shaded ? 'Clear' : 'Shade'} square ${c + 1}, ${r + 1}`}
            data-pip-object={`cell-${c}-${r}`} data-shaded={shaded ? 'true' : undefined}
            onClick={() => { if (!disabled) onToggle({ c, r }); }} style={{ cursor: disabled ? 'default' : 'pointer' }}>
            <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3}
              fill={shaded ? '#22d3ee' : '#1e293b'} stroke={shaded ? '#0e7490' : '#334155'} strokeWidth={1.5} />
            {piece !== undefined && (
              <rect data-aid="piece" data-lever="piece-tint" x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3}
                fill={PIECE_TINTS[piece % PIECE_TINTS.length]} opacity={0.55} style={{ pointerEvents: 'none' }} />
            )}
            {numbers && shaded && (
              <text data-aid="number" data-lever="square-number" x={x + CELL / 2} y={y + CELL / 2} fontSize={13}
                fontWeight="bold" fill="#0f172a" textAnchor="middle" dominantBaseline="central"
                style={{ pointerEvents: 'none' }}>{at + 1}</text>
            )}
          </g>
        );
      }))}
      {edges?.map((e) => {
        const [cx, cy] = edgeAt(e);
        return <circle key={`${e.c},${e.r},${e.side}`} data-aid="edge" data-lever="edge-mark" cx={cx} cy={cy} r={4}
          fill="#fbbf24" stroke="#0f172a" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />;
      })}
    </svg>
  );
});
AreaBuildGrid.displayName = 'AreaBuildGrid';

/** A shape drawn small and still (the first shape, beside the grid). Not the learner's work in progress. */
export const AreaShapeThumb: React.FC<{ cells: readonly Cell[]; label: string; lever?: boolean }> = ({ cells, label, lever }) => {
  if (!cells.length) return null;
  const S = 14;
  const minC = Math.min(...cells.map(x => x.c)), minR = Math.min(...cells.map(x => x.r));
  const w = (Math.max(...cells.map(x => x.c)) - minC + 1) * S, h = (Math.max(...cells.map(x => x.r)) - minR + 1) * S;
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} width={w + 4} height={h + 4} role="img" aria-label={label}
      data-lever={lever ? 'turned-first' : undefined} data-first-shape="true">
      {cells.map(x => (
        <rect key={cellKey(x)} x={(x.c - minC) * S} y={(x.r - minR) * S} width={S - 1} height={S - 1} rx={2}
          fill="#a5b4fc" stroke="#4f46e5" strokeWidth={1} />
      ))}
    </svg>
  );
};
