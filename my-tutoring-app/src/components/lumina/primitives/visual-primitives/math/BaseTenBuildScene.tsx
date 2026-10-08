'use client';

import React from 'react';

/**
 * Base-ten blocks' open-build surface (`build_two_ways`): an empty place value mat the learner fills by tapping a
 * column (one block of that size per tap) and empties by tapping a block. One svg, so the build layer's picture
 * (`svgPicture`) is exactly what the learner sees. The mat prints no count and no total: the column counts are a
 * lever, drawn as `data-aid` so the picture a model reads never carries them. `small` draws a read-only copy (the
 * first way, kept above the mat while the learner makes the second). A row of + and - buttons under the mat does the
 * same as the taps, for the keyboard and for screen readers.
 */
export const MAT_W = 480;
export const MAT_H = 300;
const LABEL_H = 30;
const PAD = 8;

export type MatPlace = 'thousands' | 'hundreds' | 'tens' | 'ones';

/** Block size and spacing per place: a cube, a stick of ten, a flat of a hundred, a big cube of a thousand. */
const PIECE: Record<MatPlace, { w: number; h: number; dx: number; dy: number; fill: string; stroke: string; noun: string }> = {
  thousands: { w: 44, h: 44, dx: 50, dy: 50, fill: '#fbbf24', stroke: '#b45309', noun: 'thousand-cube' },
  hundreds: { w: 46, h: 46, dx: 50, dy: 50, fill: '#60a5fa', stroke: '#1d4ed8', noun: 'hundred-flat' },
  tens: { w: 11, h: 76, dx: 14, dy: 84, fill: '#c084fc', stroke: '#7e22ce', noun: 'ten-stick' },
  ones: { w: 13, h: 13, dx: 17, dy: 17, fill: '#34d399', stroke: '#047857', noun: 'ones cube' },
};
const LABEL: Record<MatPlace, string> = { thousands: 'Thousands', hundreds: 'Hundreds', tens: 'Tens', ones: 'Ones' };

/** Blocks per row in a column: ones cubes in rows of five and ten-sticks in rows of ten, so a ten of either reads as full rows. */
const perRowFor = (place: MatPlace, colW: number) =>
  Math.min(place === 'ones' ? 5 : 10, Math.max(1, Math.floor((colW - 2 * PAD) / PIECE[place].dx)));

/** How many blocks of a place fit in its column without overlapping: the most a tap can put in. */
export function columnCapacity(place: MatPlace, columnCount: number): number {
  const colW = MAT_W / columnCount;
  return perRowFor(place, colW) * Math.max(1, Math.floor((MAT_H - LABEL_H - PAD) / PIECE[place].dy));
}

const Piece: React.FC<{ place: MatPlace; x: number; y: number }> = ({ place, x, y }) => {
  const p = PIECE[place];
  return <>
    <rect x={x} y={y} width={p.w} height={p.h} rx={2} fill={p.fill} stroke={p.stroke} strokeWidth={1.2} />
    {place === 'tens' && Array.from({ length: 9 }, (_, i) =>
      <line key={i} x1={x} x2={x + p.w} y1={y + (p.h / 10) * (i + 1)} y2={y + (p.h / 10) * (i + 1)} stroke={p.stroke} strokeWidth={0.6} />)}
    {(place === 'hundreds' || place === 'thousands') && Array.from({ length: 9 }, (_, i) => <React.Fragment key={i}>
      <line x1={x + (p.w / 10) * (i + 1)} x2={x + (p.w / 10) * (i + 1)} y1={y} y2={y + p.h} stroke={p.stroke} strokeWidth={0.5} />
      <line x1={x} x2={x + p.w} y1={y + (p.h / 10) * (i + 1)} y2={y + (p.h / 10) * (i + 1)} stroke={p.stroke} strokeWidth={0.5} />
    </React.Fragment>)}
  </>;
};

export const BaseTenBuildScene = React.forwardRef<SVGSVGElement, {
  places: readonly MatPlace[];
  columns: Readonly<Record<string, number>>;
  /** The column-counts lever: each column's count of the learner's blocks, as a building aid. */
  counts?: boolean;
  disabled?: boolean;
  /** A read-only copy at half size (the first way). */
  small?: boolean;
  onAdd?: (place: MatPlace) => void;
  onRemove?: (place: MatPlace) => void;
}>(({ places, columns, counts = false, disabled = false, small = false, onAdd, onRemove }, ref) => {
  const colW = MAT_W / places.length;
  const live = !small && !disabled;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${MAT_W} ${MAT_H}`} width={small ? MAT_W / 2 : MAT_W}
      height={small ? MAT_H / 2 : MAT_H} role="group" aria-label={small ? 'Your first way' : 'Place value mat: tap a column to put a block in'}
      data-build-scene={small ? 'first-way' : 'base-ten'} className="h-auto max-w-full rounded-xl">
      <rect width={MAT_W} height={MAT_H} rx={14} fill="#1e293b" />
      {places.map((place, c) => {
        const x0 = c * colW, p = PIECE[place], n = columns[place] ?? 0;
        const perRow = perRowFor(place, colW);
        return (
          <g key={place} data-column={place}>
            {/* The column itself: tapping it puts one block of this size in. */}
            <rect x={x0 + 3} y={3} width={colW - 6} height={MAT_H - 6} rx={10} fill="#0f172a" stroke="#334155"
              {...(live ? { style: { cursor: 'pointer' }, onClick: () => onAdd?.(place) } : {})} />
            <text x={x0 + colW / 2} y={20} textAnchor="middle" fontSize={13} fill="#cbd5e1" fontFamily="sans-serif"
              style={{ pointerEvents: 'none' }}>{LABEL[place]}</text>
            {counts && !small && (
              <text data-aid="count" x={x0 + colW - 14} y={20} textAnchor="end" fontSize={15} fontWeight="bold" fill="#fdba74"
                fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>{n}</text>
            )}
            {Array.from({ length: n }, (_, i) => {
              const x = x0 + PAD + (i % perRow) * p.dx, y = LABEL_H + Math.floor(i / perRow) * p.dy;
              return (
                <g key={i} data-block={place}
                  {...(live ? { style: { cursor: 'pointer' },
                    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRemove?.(place); } } : {})}>
                  <Piece place={place} x={x} y={y} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});
BaseTenBuildScene.displayName = 'BaseTenBuildScene';

/** The mat's keyboard row: one + and one - per column, named as the click mat's buttons are. */
export const MatButtons: React.FC<{ places: readonly MatPlace[]; columns: Readonly<Record<string, number>>; disabled: boolean;
  onAdd: (place: MatPlace) => void; onRemove: (place: MatPlace) => void }> = ({ places, columns, disabled, onAdd, onRemove }) => (
  <div className="grid w-full max-w-[480px] gap-2" style={{ gridTemplateColumns: `repeat(${places.length}, 1fr)` }}>
    {places.map(place => (
      <div key={place} className="flex justify-center gap-1">
        <button type="button" aria-label={`Take one from ${LABEL[place]}`} disabled={disabled || !(columns[place] ?? 0)}
          onClick={() => onRemove(place)}
          className="h-7 w-7 rounded border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40">-</button>
        <button type="button" aria-label={`Add one to ${LABEL[place]}`} disabled={disabled} onClick={() => onAdd(place)}
          className="h-7 w-7 rounded border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40">+</button>
      </div>
    ))}
  </div>
);

/** The `ten_model` lever: a bigger block next to the ten smaller blocks it is worth. No count, no number. */
export const TenModel: React.FC<{ withHundred: boolean }> = ({ withHundred }) => (
  <svg data-lever="ten-model" viewBox={`0 0 ${withHundred ? 390 : 180} 96`} width={withHundred ? 390 : 180} height={96}
    className="h-auto max-w-full" role="img" aria-label="A ten-stick next to the ones cubes it is worth">
    <Piece place="tens" x={10} y={10} />
    <text x={36} y={52} fontSize={20} fill="#e2e8f0" fontFamily="sans-serif">=</text>
    {Array.from({ length: 10 }, (_, i) => <Piece key={i} place="ones" x={56 + (i % 5) * 17} y={30 + Math.floor(i / 5) * 17} />)}
    {withHundred && <>
      <Piece place="hundreds" x={190} y={20} />
      <text x={244} y={52} fontSize={20} fill="#e2e8f0" fontFamily="sans-serif">=</text>
      {Array.from({ length: 10 }, (_, i) => <Piece key={i} place="tens" x={262 + i * 12} y={10} />)}
    </>}
  </svg>
);
