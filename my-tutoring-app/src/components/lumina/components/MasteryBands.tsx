'use client';

/**
 * MasteryBands — a chance of getting a skill right, shown as one of five named
 * bands instead of a percentage. Shared by the profile's learner-model card and
 * the lesson review.
 *
 *   < 30%   Just starting
 *   30-50%  Learning
 *   50-75%  Getting there
 *   75-90%  Nearly there
 *   90%+    Got it
 *
 * With `before`, segments gained since then are drawn in the band color and
 * segments already held are drawn dimmer, so a jump reads at a glance.
 */

import React from 'react';

export const BANDS = [
  { min: 0, label: 'Just starting', fill: 'bg-rose-400', text: 'text-rose-300' },
  { min: 0.3, label: 'Learning', fill: 'bg-amber-400', text: 'text-amber-300' },
  { min: 0.5, label: 'Getting there', fill: 'bg-yellow-300', text: 'text-yellow-200' },
  { min: 0.75, label: 'Nearly there', fill: 'bg-cyan-400', text: 'text-cyan-300' },
  { min: 0.9, label: 'Got it', fill: 'bg-emerald-400', text: 'text-emerald-300' },
] as const;

/** 0-4: the band a probability falls in. */
export function bandIndex(p: number): number {
  let i = 0;
  BANDS.forEach((b, j) => {
    if (p >= b.min) i = j;
  });
  return i;
}

export interface MasteryBandsProps {
  /** Chance of getting the skill right now, 0-1. */
  p: number;
  /** Chance before (a lesson's start); omit for a single reading. */
  before?: number;
  /** Hide the band name (compact rows). */
  hideLabel?: boolean;
  className?: string;
}

export default function MasteryBands({ p, before, hideLabel, className = '' }: MasteryBandsProps) {
  const now = bandIndex(p);
  const was = before === undefined ? now : bandIndex(before);
  const band = BANDS[now];
  const moved = before !== undefined && now !== was;
  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}
      aria-label={`${band.label}${moved ? `, up from ${BANDS[was].label}` : ''}`}>
      <div className="flex gap-1">
        {BANDS.map((_, i) => {
          const held = i <= Math.min(now, was);
          const gained = i <= now && i > was;
          return (
            <span
              key={i}
              className={`h-2 w-5 rounded-full ${
                gained ? band.fill : held ? `${band.fill} ${before !== undefined ? 'opacity-40' : ''}` : 'bg-white/10'
              }`}
            />
          );
        })}
      </div>
      {!hideLabel && (
        <span className={`text-xs font-medium ${band.text}`}>
          {moved && <span className="text-slate-500">{BANDS[was].label} {'→'} </span>}
          {band.label}
        </span>
      )}
    </div>
  );
}
