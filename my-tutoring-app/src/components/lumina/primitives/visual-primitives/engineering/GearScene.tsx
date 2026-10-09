'use client';

import React from 'react';
import type { TrainGear } from './gearWorkspace';

/**
 * Gear-train-builder's open-build surface: an empty track with a crank on the first gear. Gears sit left to right,
 * each touching the one before (radius in proportion to teeth), so every gear meshes and turns. One svg, so the build
 * layer's picture (`svgPicture`) is exactly what the learner sees. Tooth labels, the direction arrows and the turn
 * counts are aids (`data-aid`), left out of the picture.
 */
const R_PER_TOOTH = 2.4;
const PAD = 40;
const CY = 150;
export const SCENE_H = 300;
const MIN_W = 640;

export const gearRadius = (teeth: number) => teeth * R_PER_TOOTH;
const COLORS = ['#F472B6', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#FB923C'];

/** Each gear's centre x, the first at the left. */
export function gearCentres(train: readonly TrainGear[]): number[] {
  const xs: number[] = [];
  train.forEach((g, i) => xs.push(i === 0 ? PAD + 30 + gearRadius(g.teeth) : xs[i - 1] + gearRadius(train[i - 1].teeth) + gearRadius(g.teeth)));
  return xs;
}

function gearPath(cx: number, cy: number, teeth: number): string {
  const r = gearRadius(teeth), depth = Math.max(3, r * 0.14), parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i * 2 * Math.PI) / teeth, b = ((i + 0.5) * 2 * Math.PI) / teeth, w = Math.PI / teeth * 0.35;
    const p = (ang: number, rad: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    parts.push(`${i === 0 ? 'M' : 'L'} ${p(a, r - depth)} L ${p(a + w, r + depth)} L ${p(b - w, r + depth)} L ${p(b, r - depth)}`);
  }
  return `${parts.join(' ')} Z`;
}

export const GearScene = React.forwardRef<SVGSVGElement, {
  train: readonly TrainGear[];
  /** Degrees each gear is turned (the spin), by index. */
  angles: readonly number[];
  /** Lever: an arrow on every gear for the way it turns (+1 the crank's way, -1 the other). */
  arrows: readonly (1 | -1)[] | null;
  /** Lever: turns counted on the first and last gear while the crank turns. */
  counts: { first: number; last: number } | null;
  disabled: boolean;
  onTapGear: (id: string) => void;
}>(({ train, angles, arrows, counts, disabled, onTapGear }, ref) => {
  const xs = gearCentres(train);
  const right = train.length ? xs[xs.length - 1] + gearRadius(train[train.length - 1].teeth) : 0;
  const width = Math.max(MIN_W, Math.ceil(right + PAD));
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${SCENE_H}`} width={width} height={SCENE_H}
      role="group" aria-label="Your gear train" data-build-scene="gears" className="h-auto w-full max-w-full rounded-xl">
      <rect width={width} height={SCENE_H} rx={14} fill="#1E1B4B" />
      <line x1={PAD} x2={width - PAD} y1={CY} y2={CY} stroke="#4338CA" strokeWidth={2} strokeDasharray="6 8" />
      {!train.length && (
        <text x={width / 2} y={CY + 5} textAnchor="middle" fontSize={15} fill="#a5b4fc" data-aid="empty">Your gears go here</text>
      )}
      {train.map((g, i) => {
        const cx = xs[i], r = gearRadius(g.teeth), color = COLORS[i % COLORS.length];
        return (
          <g key={g.id}>
            {i === 0 && (
              // The crank: a handle on the first gear, turned with it.
              <g transform={`rotate(${angles[0] ?? 0} ${cx} ${CY})`} style={{ pointerEvents: 'none' }}>
                <rect x={cx - 3} y={CY - r - 26} width={6} height={r + 26} fill="#e2e8f0" />
                <circle cx={cx} cy={CY - r - 28} r={8} fill="#f8fafc" />
              </g>
            )}
            <g transform={`rotate(${angles[i] ?? 0} ${cx} ${CY})`}>
              {/* The painted gear is its own hit area. */}
              <path d={gearPath(cx, CY, g.teeth)} fill={color} stroke="#0f172a" strokeWidth={2} role="button"
                aria-label={`${g.teeth}-tooth gear, number ${i + 1} in your train`} data-pip-object={`gear-${g.id}`} data-placed={g.id}
                onClick={() => { if (!disabled) onTapGear(g.id); }} style={{ cursor: disabled ? 'default' : 'pointer' }} />
              <circle cx={cx} cy={CY} r={Math.max(4, r * 0.18)} fill="#0f172a" style={{ pointerEvents: 'none' }} />
              <line x1={cx} y1={CY} x2={cx} y2={CY - r * 0.7} stroke="#0f172a" strokeWidth={3} style={{ pointerEvents: 'none' }} />
            </g>
            <text data-aid="teeth" x={cx} y={CY + r + 22} textAnchor="middle" fontSize={13} fill="#c7d2fe" style={{ pointerEvents: 'none' }}>
              {g.teeth} teeth
            </text>
            {arrows && (
              <path data-aid="arrow" data-lever="direction-arrow" data-way={arrows[i]} style={{ pointerEvents: 'none' }} fill="none"
                stroke="#fde68a" strokeWidth={3}
                d={arrows[i] === 1
                  ? `M ${cx - r * 0.55} ${CY - r * 0.55} A ${r * 0.78} ${r * 0.78} 0 0 1 ${cx + r * 0.55} ${CY - r * 0.55} l -2 -9 m 2 9 l -9 1`
                  : `M ${cx + r * 0.55} ${CY - r * 0.55} A ${r * 0.78} ${r * 0.78} 0 0 0 ${cx - r * 0.55} ${CY - r * 0.55} l 2 -9 m -2 9 l 9 1`} />
            )}
          </g>
        );
      })}
      {counts && train.length > 1 && (
        <g data-aid="counts" data-lever="turn-counts" style={{ pointerEvents: 'none' }}>
          <text x={xs[0]} y={28} textAnchor="middle" fontSize={14} fill="#fdba74">First gear: {counts.first} turns</text>
          <text x={xs[xs.length - 1]} y={28} textAnchor="middle" fontSize={14} fill="#fdba74">Last gear: {counts.last} turns</text>
        </g>
      )}
    </svg>
  );
});
GearScene.displayName = 'GearScene';
