'use client';

import React from 'react';
import { DIRECTIONS, type Direction } from './mapGeo';

const LETTER: Record<Direction, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };
const NAME: Record<Direction, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };

export interface CompassRoseProps {
  /** SVG centre and radius (the rose draws itself inside an existing <svg>). */
  cx: number;
  cy: number;
  r: number;
  /** Degrees clockwise: where north points on screen. */
  rotation: number;
  /** Supported practice: the rose glows so the learner reads it first. */
  glow?: boolean;
  /** name_direction: the four arms are the answer buttons. */
  onArm?: (dir: Direction) => void;
  disabled?: boolean;
  /** After a check: the arm the learner chose and whether it was right. */
  chosen?: { dir: Direction; correct: boolean } | null;
}

/**
 * A compass rose. The arms turn with the map; the letters stay upright so a turned map still reads. As answer
 * buttons, each arm is a real button named by its direction (the letter is on screen anyway).
 */
export function CompassRose({ cx, cy, r, rotation, glow, onArm, disabled, chosen }: CompassRoseProps) {
  const interactive = !!onArm;
  return (
    <g transform={`translate(${cx} ${cy})`} data-compass-rose="" style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
      {glow && <circle r={r * 1.18} fill="rgba(250,204,21,0.16)" stroke="rgba(250,204,21,0.75)" strokeWidth={2.5}
        className="animate-pulse" />}
      <circle r={r * 0.98} fill="rgba(15,23,42,0.72)" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      <circle r={r * 0.62} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <g transform={`rotate(${rotation})`}>
        {/* Diagonal ticks: decoration only; a four-direction rose never asks about them. */}
        {[45, 135, 225, 315].map(a => (
          <polygon key={a} transform={`rotate(${a})`} points={`0,${-r * 0.55} ${r * 0.07},0 0,${r * 0.12} ${-r * 0.07},0`}
            fill="rgba(148,163,184,0.45)" />
        ))}
        {DIRECTIONS.map((dir, i) => {
          const isNorth = dir === 'north';
          const state = chosen?.dir === dir ? (chosen.correct ? 'correct' : 'incorrect') : null;
          const fill = state === 'correct' ? '#22c55e' : state === 'incorrect' ? '#f43f5e' : isNorth ? '#ef4444' : '#e2e8f0';
          const arm = (
            <polygon points={`0,${-r * 0.82} ${r * 0.14},${-r * 0.12} 0,0 ${-r * 0.14},${-r * 0.12}`} fill={fill}
              stroke="rgba(15,23,42,0.6)" strokeWidth={1} />
          );
          const letter = (
            <g transform={`translate(0 ${-r * 0.82 - r * 0.2}) rotate(${-rotation - i * 90})`}>
              <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.3} fontWeight={800}
                fill={isNorth ? '#fca5a5' : '#f8fafc'} style={{ userSelect: 'none' }}>{LETTER[dir]}</text>
            </g>
          );
          return (
            <g key={dir} transform={`rotate(${i * 90})`}>
              {interactive ? (
                <g role="button" tabIndex={disabled ? -1 : 0} aria-label={NAME[dir]} aria-disabled={disabled || undefined}
                  data-pip-object={`arm-${dir}`} className={disabled ? '' : 'cursor-pointer hover:opacity-80 focus:outline-none'}
                  onClick={() => { if (!disabled) onArm!(dir); }}
                  onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onArm!(dir); } }}>
                  {/* A generous invisible hit area along the arm. */}
                  <rect x={-r * 0.24} y={-r * 1.2} width={r * 0.48} height={r * 1.15} fill="transparent" />
                  {arm}{letter}
                </g>
              ) : <>{arm}{letter}</>}
            </g>
          );
        })}
      </g>
      <circle r={r * 0.08} fill="#f8fafc" />
    </g>
  );
}

export default CompassRose;
