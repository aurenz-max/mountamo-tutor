'use client';

import React from 'react';
import { LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader, LuminaCardTitle } from '../../../ui';
import type { LuminaAccent } from '../../../ui/tokens';

/** Fill colours for parts and segments, in order. Paired so text labels can use the same accent. */
export const DRAWER_FILLS: Array<{ fill: string; text: string; accent: LuminaAccent }> = [
  { fill: 'bg-cyan-400', text: 'text-cyan-300', accent: 'cyan' },
  { fill: 'bg-amber-400', text: 'text-amber-300', accent: 'amber' },
  { fill: 'bg-emerald-400', text: 'text-emerald-300', accent: 'emerald' },
  { fill: 'bg-pink-400', text: 'text-pink-300', accent: 'pink' },
  { fill: 'bg-indigo-400', text: 'text-indigo-300', accent: 'indigo' },
  { fill: 'bg-rose-400', text: 'text-rose-300', accent: 'rose' },
];

/**
 * The shared frame for every drawer. When the spec fails its code checks the drawer shows
 * nothing a learner could misread: the generator retries before this, so reaching it means
 * generation failed outright.
 */
export function DrawerFrame({ title, caption, problems, kind, children, className }: {
  title: string;
  caption: string;
  problems: string[];
  kind: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (problems.length) {
    console.warn(`[drawer:${kind}] spec rejected:`, problems);
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader>
          <LuminaCardTitle>{title || 'Display unavailable'}</LuminaCardTitle>
          <LuminaCardDescription>This display could not be built correctly, so it is hidden.</LuminaCardDescription>
        </LuminaCardHeader>
      </LuminaCard>
    );
  }
  return (
    <LuminaCard className={className} data-drawer={kind}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        <LuminaCardDescription>{caption}</LuminaCardDescription>
      </LuminaCardHeader>
      <LuminaCardContent className="flex flex-col gap-6">{children}</LuminaCardContent>
    </LuminaCard>
  );
}

/** A ceiling for a scale that reads well: 10, 25, 50, 100, 250, … */
export function niceCeiling(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}
