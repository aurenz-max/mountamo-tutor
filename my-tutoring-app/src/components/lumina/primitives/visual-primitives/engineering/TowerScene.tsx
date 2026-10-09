'use client';

import React from 'react';
import {
  GROUND_WIDTH, MAX_HEIGHT, PIECES, type PieceKind, type TowerCut, type TowerPiece,
} from './towerWorkspace';

/**
 * Tower-stacker's open-build surface: an empty building area on the ground with a green goal line, and on a windproof
 * item wind arrows from the left. One svg, so the build layer's picture (`svgPicture`) is exactly what the learner
 * sees. The tap columns, the drop preview and the balance-point lever are aids (`data-aid`), left out of the picture.
 * A part that fell at the last check is drawn turned about the edge it fell over, until the build changes.
 */
export const UNIT = 30;
const MARGIN_X = 60;
const TOP = 20;
const GROUND_H = 50;
export const SCENE_W = GROUND_WIDTH * UNIT + MARGIN_X * 2;
export const SCENE_H = MAX_HEIGHT * UNIT + TOP + GROUND_H;
const groundY = SCENE_H - GROUND_H;
const sx = (x: number) => MARGIN_X + x * UNIT;
const sy = (y: number) => groundY - y * UNIT;

export interface FallingPart { ids: string[]; pivotX: number; pivotY: number; toRight: boolean }

export const TowerScene = React.forwardRef<SVGSVGElement, {
  pieces: readonly TowerPiece[];
  targetHeight: number;
  windy: boolean;
  /** The drop preview for the selected piece at the hovered column, if it can land there. */
  preview: TowerPiece | null;
  falling: FallingPart | null;
  /** The balance-point lever: each part's balance point, a line down, and the ends of what holds it up. */
  balance: readonly TowerCut[] | null;
  disabled: boolean;
  onTapColumn: (column: number) => void;
  onHoverColumn: (column: number | null) => void;
  onTapPiece: (id: string) => void;
}>(({ pieces, targetHeight, windy, preview, falling, balance, disabled, onTapColumn, onHoverColumn, onTapPiece }, ref) => {
  const piece = (p: TowerPiece) => (
    <rect key={p.id} x={sx(p.x) + 1} y={sy(p.y + p.h) + 1} width={p.w * UNIT - 2} height={p.h * UNIT - 2} rx={3}
      fill={PIECES[p.kind as PieceKind].color} stroke="#f8fafc" strokeWidth={1.5} role="button"
      aria-label={`${PIECES[p.kind].label} in your tower`} data-pip-object={`piece-${p.id}`} data-placed={p.id}
      onClick={() => { if (!disabled) onTapPiece(p.id); }} style={{ cursor: disabled ? 'default' : 'pointer' }} />
  );
  const fallen = new Set(falling?.ids ?? []);
  const angle = falling ? (falling.toRight ? 24 : -24) : 0;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H}
      role="group" aria-label="Your tower building area" data-build-scene="tower" className="h-auto w-full max-w-xl mx-auto rounded-xl"
      onMouseLeave={() => onHoverColumn(null)}>
      <defs>
        <linearGradient id="tower-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c4a6e" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width={SCENE_W} height={SCENE_H} rx={14} fill="url(#tower-sky)" />
      <rect x={sx(0)} y={sy(MAX_HEIGHT)} width={GROUND_WIDTH * UNIT} height={MAX_HEIGHT * UNIT} fill="#ffffff" fillOpacity={0.03}
        stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="4 6" />
      <rect x={0} y={groundY} width={SCENE_W} height={GROUND_H} fill="#57534e" />
      <rect x={sx(0)} y={groundY} width={GROUND_WIDTH * UNIT} height={6} fill="#78716c" />
      {/* The goal line is the task the ask states. */}
      <line x1={sx(0) - 14} x2={sx(GROUND_WIDTH) + 14} y1={sy(targetHeight)} y2={sy(targetHeight)} stroke="#22c55e" strokeWidth={3}
        strokeDasharray="10 6" data-goal-line={targetHeight} />
      <path d={`M ${sx(GROUND_WIDTH) + 14} ${sy(targetHeight)} l 0 -22 l 18 7 l -18 7`} fill="#22c55e" />
      {windy && [0.3, 0.55, 0.8].map(f => (
        <path key={f} d={`M 8 ${sy(MAX_HEIGHT * f)} h 34 m -10 -7 l 10 7 l -10 7`} stroke="#bae6fd" strokeWidth={3} fill="none"
          strokeLinecap="round" data-wind-arrow="" />
      ))}

      {/* Tap columns: one per grid unit across the building area. */}
      {Array.from({ length: GROUND_WIDTH }, (_, c) => (
        <rect key={c} data-aid="column" data-pip-object={`column-${c}`} x={sx(c)} y={sy(MAX_HEIGHT)} width={UNIT}
          height={MAX_HEIGHT * UNIT} fill="#000" fillOpacity={0} role="button" aria-label={`Drop a piece at column ${c + 1}`}
          onClick={() => { if (!disabled) onTapColumn(c); }} onMouseEnter={() => onHoverColumn(c)}
          style={{ cursor: disabled ? 'default' : 'crosshair' }} />
      ))}

      {pieces.filter(p => !fallen.has(p.id)).map(piece)}
      {falling && (
        <g transform={`rotate(${angle} ${sx(falling.pivotX)} ${sy(falling.pivotY)})`} opacity={0.85} data-falling="">
          {pieces.filter(p => fallen.has(p.id)).map(piece)}
        </g>
      )}

      {preview && (
        <rect data-aid="preview" x={sx(preview.x) + 1} y={sy(preview.y + preview.h) + 1} width={preview.w * UNIT - 2}
          height={preview.h * UNIT - 2} rx={3} fill={PIECES[preview.kind].color} fillOpacity={0.35} stroke="#f8fafc"
          strokeDasharray="4 4" style={{ pointerEvents: 'none' }} />
      )}

      {balance?.map(c => (
        <g key={`${c.level}-${c.ids.join(',')}`} data-aid="balance" data-lever="balance-point" style={{ pointerEvents: 'none' }}>
          <line x1={sx(c.balanceX)} x2={sx(c.balanceX)} y1={sy(c.balanceY)} y2={groundY + 30} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" />
          <circle cx={sx(c.balanceX)} cy={sy(c.balanceY)} r={8} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
          <path d={`M ${sx(c.lo)} ${sy(c.level)} v 14 M ${sx(c.hi)} ${sy(c.level)} v 14 M ${sx(c.lo)} ${sy(c.level) + 7} H ${sx(c.hi)}`}
            stroke="#fde68a" strokeWidth={3} fill="none" />
        </g>
      ))}
    </svg>
  );
});
TowerScene.displayName = 'TowerScene';
