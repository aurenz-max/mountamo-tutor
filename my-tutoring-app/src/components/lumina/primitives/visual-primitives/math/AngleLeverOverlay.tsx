'use client';

import React from 'react';
import type { AngleWorkshopChallenge } from './AngleWorkshop';
import {
  BENCHMARK_LEVER, CORNERS_LEVER, EXTERIOR_LEVER, SLIDE_LEVER, STRAIGHT_ARCS_LEVER, TENS_LEVER, WHOLE_LEVER,
  markedPlace, tensLabels, wholeArcs, type CrossingPlace,
} from './angleWorkshopLevers';

/**
 * The classic modes' help pictures (`angleWorkshopLevers.ts`), drawn as one SVG over the figure canvas in the canvas's
 * own coordinates (560 × 380). The geometry below repeats the canvas's figure constants in AngleWorkshop.tsx; change
 * both together. Each picture carries `data-lever`, and none writes a measure the item asks for.
 */

const W = 560;
const H = 380;
const AID = '#fde68a';
const DASH = '6 5';

/** A point at `deg` (counter-clockwise from the bottom ray, as the canvas draws) and radius `r` from (cx, cy). */
const at = (cx: number, cy: number, deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
};
/** An arc from d0 to d1 degrees as polyline points. */
const arcPoints = (cx: number, cy: number, r: number, d0: number, d1: number) =>
  Array.from({ length: 49 }, (_, i) => at(cx, cy, d0 + ((d1 - d0) * i) / 48, r)).map(p => `${p.x},${p.y}`).join(' ');

const Arc = ({ cx, cy, r, d0, d1 }: { cx: number; cy: number; r: number; d0: number; d1: number }) => (
  <polyline points={arcPoints(cx, cy, r, d0, d1)} fill="none" stroke={AID} strokeWidth={2} strokeDasharray={DASH} />
);
const Ray = ({ cx, cy, deg, len }: { cx: number; cy: number; deg: number; len: number }) => {
  const p = at(cx, cy, deg, len);
  return <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={AID} strokeWidth={2} strokeDasharray={DASH} />;
};

// ── transversal geometry (screen radians, y down, as the canvas's vertexAngle) ──
const A = { x: 200, y: 70 }, B = { x: 360, y: 290 };
const crossing = (y: number) => ({ x: A.x + ((y - A.y) / (B.y - A.y)) * (B.x - A.x), y });
const I1 = crossing(110), I2 = crossing(250);
const DOWN_T = Math.atan2(B.y - A.y, B.x - A.x);
const DIRS: Record<CrossingPlace, [number, number]> = {
  lower_right: [0, DOWN_T], upper_left: [Math.PI, DOWN_T - Math.PI],
  upper_right: [0, DOWN_T - Math.PI], lower_left: [Math.PI, DOWN_T],
};
/** The minor wedge between two screen directions at V, as a closed dashed path. */
function wedgePath(V: { x: number; y: number }, a1: number, a2: number, r: number): string {
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const pts = Array.from({ length: 25 }, (_, i) => a1 + (d * i) / 24).map(a => `${V.x + r * Math.cos(a)},${V.y + r * Math.sin(a)}`);
  return `M${V.x},${V.y} L${pts.join(' L')} Z`;
}

export function AngleLeverOverlay({ challenge: c, pulled }: { challenge: AngleWorkshopChallenge; pulled: readonly string[] }) {
  const on = (id: string) => pulled.includes(id);
  const parts: React.ReactNode[] = [];

  if (c.type === 'measure' && on(TENS_LEVER)) {
    const cx = W / 2, cy = H * 0.7, PR = 158;
    parts.push(<g key="tens" data-lever="tens-labels">
      {tensLabels(c).filter(t => t % 30 !== 0).map(t => {
        const p = at(cx, cy, t, PR + 16);
        return <text key={t} data-ten={t} x={p.x} y={p.y} fill={AID} fontSize={11} textAnchor="middle" dominantBaseline="middle">{t}</text>;
      })}
      {(() => { const p = at(cx, cy, 0, PR); return <circle cx={p.x} cy={p.y} r={5} fill="none" stroke={AID} strokeWidth={2} />; })()}
    </g>);
  }

  if (c.type === 'classify_pairs' && on(BENCHMARK_LEVER)) {
    const cx = W / 2, cy = H / 2;
    parts.push(<g key="bench" data-lever="benchmarks">
      <Ray cx={cx} cy={cy} deg={90} len={175} />
      <Ray cx={cx} cy={cy} deg={180} len={175} />
      <polyline points={[at(cx, cy, 0, 22), { x: cx + 22, y: cy - 22 }, at(cx, cy, 90, 22)].map(p => `${p.x},${p.y}`).join(' ')}
        fill="none" stroke={AID} strokeWidth={1.5} strokeDasharray="3 3" />
    </g>);
  }

  if ((c.type === 'solve_unknown' || c.type === 'solve_algebraic') && on(WHOLE_LEVER)) {
    const cx = W / 2, cy = H / 2 + 10;
    parts.push(<g key="whole" data-lever="whole-angle">
      {wholeArcs(c).map(([d0, d1], i) => <Arc key={i} cx={cx} cy={cy} r={105 + i * 18} d0={d0} d1={d1} />)}
    </g>);
  }

  if (c.type === 'transversal') {
    const rel = c.transRelation ?? 'corresponding';
    if (on(SLIDE_LEVER)) {
      const [a1, a2] = DIRS[markedPlace(rel)];
      parts.push(<path key="slide" data-lever="slide-copy" d={wedgePath(I2, a1, a2, 26)} fill="rgba(253,230,138,0.12)"
        stroke={AID} strokeWidth={2} strokeDasharray={DASH} />);
    }
    if (on(STRAIGHT_ARCS_LEVER)) {
      parts.push(<g key="straight" data-lever="straight-arcs">
        {[I1, I2].map((I, i) => <Arc key={i} cx={I.x} cy={I.y} r={40} d0={0} d1={-180} />)}
      </g>);
    }
    if (on(CORNERS_LEVER)) {
      const cx = 280, cy = 352, g1 = c.givenAngle ?? 0, g2 = c.givenAngle2 ?? 0, r = 22;
      const wedge = (d0: number, d1: number) => `M${cx},${cy} L${arcPoints(cx, cy, r, d0, d1).split(' ').join(' L')} Z`;
      const lbl = (d: number, txt: string) => { const p = at(cx, cy, d, r + 14); return <text x={p.x} y={p.y} fill={AID} fontSize={11} textAnchor="middle" dominantBaseline="middle">{txt}</text>; };
      parts.push(<g key="corners" data-lever="corners-on-line">
        <line x1={cx - 120} y1={cy} x2={cx + 120} y2={cy} stroke={AID} strokeWidth={2} strokeDasharray={DASH} />
        <path data-corner={g1} d={wedge(180 - g1, 180)} fill="rgba(251,191,36,0.25)" stroke={AID} strokeWidth={1.5} />
        <path data-corner={g2} d={wedge(180 - g1 - g2, 180 - g1)} fill="rgba(251,191,36,0.25)" stroke={AID} strokeWidth={1.5} />
        {lbl(180 - g1 / 2, `${g1}°`)}
        {lbl(180 - g1 - g2 / 2, `${g2}°`)}
      </g>);
    }
    if (on(EXTERIOR_LEVER)) {
      const Vr = { x: 415, y: 300 }, Vt = { x: 285, y: 80 }, Vl = { x: 150, y: 300 };
      parts.push(<g key="exterior" data-lever="straight-at-corner">
        <Arc cx={Vr.x} cy={Vr.y} r={40} d0={0} d1={180} />
        <path d={wedgePath(Vr, Math.atan2(Vt.y - Vr.y, Vt.x - Vr.x), Math.atan2(Vl.y - Vr.y, Vl.x - Vr.x), 30)} fill="none"
          stroke={AID} strokeWidth={1.5} strokeDasharray="3 3" />
      </g>);
    }
  }

  if (!parts.length) return null;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-aid>
      {parts}
    </svg>
  );
}
