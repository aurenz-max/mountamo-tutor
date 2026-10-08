'use client';

import React, { useRef } from 'react';

/**
 * angle-workshop make_angle (open build): one fixed ray from a vertex, pointing right, and one ray the learner turns
 * by dragging its end. The opening is drawn as a shaded wedge and is never written on screen. One `<svg>`: lever aids
 * (the benchmark corner, the protractor) are marked `data-aid`, so a future `svgPicture` read leaves them out.
 */

const W = 560;
const H = 340;
const VX = 280;
const VY = 300;
const RAY = 210;
const HANDLE = 14;

const toXY = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: VX + r * Math.cos(a), y: VY - r * Math.sin(a) };
};

/** A pointer position (SVG units) as an opening 0..180: below the fixed ray's line it pins to the nearer end. */
export function openingAt(x: number, y: number): number {
  const deg = (Math.atan2(VY - y, x - VX) * 180) / Math.PI;
  if (deg >= 0) return Math.round(deg);
  return deg < -90 ? 180 : 0;
}

interface AngleBuildSceneProps {
  opening: number;
  cornerMarker: boolean;
  protractor: boolean;
  disabled: boolean;
  onTurn: (deg: number) => void;
}

export function AngleBuildScene({ opening, cornerMarker, protractor, disabled, onTurn }: AngleBuildSceneProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const turnTo = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = svg.current;
    if (!el || disabled) return;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    onTurn(openingAt(((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H));
  };

  const end = toXY(opening, RAY);
  const wedgeR = 56;
  const arcEnd = toXY(opening, wedgeR);
  const wedge = opening > 0
    ? `M ${VX} ${VY} L ${VX + wedgeR} ${VY} A ${wedgeR} ${wedgeR} 0 0 0 ${arcEnd.x} ${arcEnd.y} Z` : '';

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-lg touch-none select-none"
      style={{ aspectRatio: `${W} / ${H}` }}
      data-pip-object="angle-build"
      role="img"
      aria-label="A fixed ray and a ray you can turn"
      onPointerDown={(e) => { if (disabled) return; dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); turnTo(e); }}
      onPointerMove={(e) => { if (dragging.current) turnTo(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      {protractor && (
        <g data-aid data-lever="protractor" aria-label="Protractor scale">
          <path d={`M ${VX - 170} ${VY} A 170 170 0 0 1 ${VX + 170} ${VY}`} fill="none" stroke="rgba(96,165,250,0.55)" strokeWidth={2} />
          {Array.from({ length: 37 }, (_, i) => i * 5).map((d) => {
            const major = d % 30 === 0, mid = d % 10 === 0;
            const a = toXY(d, 170), b = toXY(d, 170 - (major ? 14 : mid ? 10 : 6)), t = toXY(d, 186);
            return (
              <g key={d}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.45)'} strokeWidth={major ? 1.6 : 1} />
                {major && <text x={t.x} y={t.y} fill="#60a5fa" fontSize={12} textAnchor="middle" dominantBaseline="middle">{d}</text>}
              </g>
            );
          })}
        </g>
      )}
      {cornerMarker && (
        <g data-aid data-lever="corner-marker" aria-label="A square corner and a straight line to compare with">
          <line x1={VX} y1={VY} x2={VX} y2={VY - RAY} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 5" />
          <line x1={VX} y1={VY} x2={VX - RAY} y2={VY} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 5" />
          <path d={`M ${VX + 18} ${VY} L ${VX + 18} ${VY - 18} L ${VX} ${VY - 18}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        </g>
      )}
      {wedge && <path d={wedge} fill="rgba(168,85,247,0.22)" stroke="#a855f7" strokeWidth={2} />}
      <line x1={VX} y1={VY} x2={VX + RAY} y2={VY} stroke="#22d3ee" strokeWidth={3} strokeLinecap="round" />
      <line x1={VX} y1={VY} x2={end.x} y2={end.y} stroke="#a855f7" strokeWidth={3} strokeLinecap="round" />
      <circle cx={end.x} cy={end.y} r={HANDLE} fill="rgba(168,85,247,0.35)" stroke="#a855f7" strokeWidth={2}
        className={disabled ? '' : 'cursor-grab'} />
      <circle cx={VX} cy={VY} r={4.5} fill="#e2e8f0" />
    </svg>
  );
}
