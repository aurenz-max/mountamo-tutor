'use client';

import React, { useMemo } from 'react';
import { LuminaButton } from '../../../ui';
import { MAX_TANKS, formatDistance, type FlightPlanChallenge, type FlightRun } from './airplaneModel';

/**
 * The flight-plan surface: a route map between two airports and the fuel loader. The map draws the trip the
 * way the band reads it (K-2: one coloured stripe per hop, not numbered; 3-5: only the distance), never the
 * tanks it needs. The loader starts empty. During a flight the plane moves along the route and one tank
 * empties for each stretch it flies.
 */

const W = 320, H = 150;
const A = { x: 44, y: 104 }, B = { x: 276, y: 104 }, C = { x: 160, y: 10 };

const bez = (t: number) => ({
  x: (1 - t) ** 2 * A.x + 2 * (1 - t) * t * C.x + t ** 2 * B.x,
  y: (1 - t) ** 2 * A.y + 2 * (1 - t) * t * C.y + t ** 2 * B.y,
});

/** The arc sampled by length, so equal fractions are equal stretches of route on screen. */
function useArc() {
  return useMemo(() => {
    const N = 240;
    const pts = Array.from({ length: N + 1 }, (_, i) => bez(i / N));
    const len = [0];
    for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = len[N];
    const at = (f: number) => {
      const target = Math.max(0, Math.min(1, f)) * total;
      let i = 1;
      while (i < N && len[i] < target) i++;
      const k = (target - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
      const p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
      const angle = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) * 180 / Math.PI;
      return { ...p, angle };
    };
    const path = (f0: number, f1: number) => {
      const steps = Math.max(2, Math.ceil((f1 - f0) * 60));
      return Array.from({ length: steps + 1 }, (_, i) => at(f0 + (f1 - f0) * (i / steps)))
        .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    };
    return { at, path };
  }, []);
}

/** The name sits under the marker, kept inside the map: the left airport's name runs right, the right one's left. */
const Airport: React.FC<{ x: number; y: number; name: string; side: 'left' | 'right' }> = ({ x, y, name, side }) => (
  <g>
    <circle cx={x} cy={y} r={9} fill="#0f172a" stroke="#e2e8f0" strokeWidth={2} />
    <path d={`M${x - 4},${y + 3} L${x},${y - 5} L${x + 4},${y + 3} Z`} fill="#e2e8f0" />
    <text x={side === 'left' ? 6 : W - 6} y={y + 30} textAnchor={side === 'left' ? 'start' : 'end'} fontSize={16}
      fill="#e2e8f0" fontWeight={600}>{name}</text>
  </g>
);

export interface FlightPlanPanelProps {
  challenge: FlightPlanChallenge;
  loaded: number;
  /** How far the plane is along the route now, in the trip's units (0 at the start). */
  flownNow: number;
  /** The last flight, once landed (or null while loading or flying). */
  landed: FlightRun | null;
  flying: boolean;
  /** The loader and Fly are closed (the runtime has closed input, or the trip is done). */
  disabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onFly: () => void;
}

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  challenge: c, loaded, flownNow, landed, flying, disabled, onAdd, onRemove, onFly,
}) => {
  const arc = useArc();
  const f = Math.min(1, flownNow / c.distance);
  const plane = arc.at(f);
  const hops = c.units === 'hops' ? c.distance : 0;
  const downShort = landed && !landed.reached;
  const apex = arc.at(0.5);

  return (
    <div className="space-y-3" data-flight-plan={c.id}>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-sky-950/80 to-slate-900/80">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
          aria-label={`The route from ${c.from} to ${c.to}`}>
          {hops > 0
            ? Array.from({ length: hops }, (_, k) => (
              <path key={k} d={arc.path(k / hops, (k + 1) / hops)} fill="none" strokeLinecap="round"
                stroke={k % 2 ? '#fbbf24' : '#22d3ee'} strokeWidth={6} opacity={0.85} />
            ))
            : <path d={arc.path(0, 1)} fill="none" stroke="#94a3b8" strokeWidth={3} strokeDasharray="7 6" />}
          {hops > 0 && Array.from({ length: hops - 1 }, (_, k) => {
            const p = arc.at((k + 1) / hops);
            return <circle key={k} cx={p.x} cy={p.y} r={4} fill="#0f172a" stroke="#e2e8f0" strokeWidth={1.5} />;
          })}
          {f > 0 && <path d={arc.path(0, f)} fill="none" stroke="#f8fafc" strokeWidth={2} strokeDasharray="2 4" />}
          {c.units === 'km' && (
            <text x={apex.x} y={apex.y - 10} textAnchor="middle" fontSize={18} fill="#f8fafc" fontWeight={700}>
              {formatDistance(c, c.distance)}
            </text>
          )}
          <Airport x={A.x} y={A.y} name={c.from} side="left" />
          <Airport x={B.x} y={B.y} name={c.to} side="right" />
          <g transform={`translate(${plane.x.toFixed(1)},${plane.y.toFixed(1)}) rotate(${plane.angle.toFixed(1)})`}>
            {/* A small jet seen from above, nose to the right. */}
            <path d="M12,0 L4,-2 L-2,-10 L-5,-10 L-1,-2 L-8,-2 L-11,-6 L-13,-6 L-11,0 L-13,6 L-11,6 L-8,2 L-1,2 L-5,10 L-2,10 L4,2 Z"
              fill={downShort ? '#f87171' : '#f8fafc'} stroke="#0f172a" strokeWidth={1} />
          </g>
          {downShort && (
            <text x={plane.x} y={plane.y + 24} textAnchor="middle" fontSize={14} fill="#fca5a5" fontWeight={700}>Out of fuel</text>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-h-[40px] flex-wrap items-end gap-1.5" aria-label={`${loaded} fuel tanks loaded`}>
          {loaded === 0 && <span className="text-sm text-slate-400">No fuel loaded yet</span>}
          {Array.from({ length: loaded }, (_, i) => {
            // Tank i empties while the plane flies stretch i.
            const fill = 1 - Math.max(0, Math.min(1, flownNow / c.perTank - i));
            return (
              <div key={i} className="relative h-10 w-5 overflow-hidden rounded-md border border-amber-200/70 bg-slate-800" data-tank={i}>
                <div className="absolute inset-x-0 bottom-0 bg-amber-400 transition-[height] duration-100" style={{ height: `${fill * 100}%` }} />
              </div>
            );
          })}
        </div>
        <span className="text-sm text-slate-300">Tanks: {loaded}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <LuminaButton tone="ghost" onClick={onRemove} disabled={disabled || flying || loaded === 0}>Take out a tank</LuminaButton>
        <LuminaButton tone="ghost" onClick={onAdd} disabled={disabled || flying || loaded >= MAX_TANKS}>Add a tank</LuminaButton>
        <LuminaButton tone="primary" onClick={onFly} disabled={disabled || flying || loaded === 0}>Fly!</LuminaButton>
      </div>
    </div>
  );
};

export default FlightPlanPanel;
