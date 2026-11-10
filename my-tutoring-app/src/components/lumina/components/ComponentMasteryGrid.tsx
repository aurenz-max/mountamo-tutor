'use client';

/**
 * ComponentMasteryGrid: one kind of component mastery as a grid (`service/componentMastery/contract.ts`).
 * For `letter_sound`, one cell per letter-sound pair in teaching order, coloured by how often the child read it
 * correctly. Two reads: the kind's components from `/api/lumina/component-evidence` (what the ids mean and their
 * order) and the child's tallies from the backend. It shows what was observed; it selects nothing.
 *
 * Renders nothing until the child has at least one observation of the kind, and fails quietly like the other
 * profile cards.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaSectionLabel } from '../ui';
import { analyticsApi, type ComponentMasteryResponse } from '@/lib/studentAnalyticsAPI';
import type { ComponentInfo } from '../service/componentMastery/contract';

export interface ComponentMasteryGridProps {
  studentId: number;
  kind: string;
}

/** Below this many observations a cell says "seen", not how well. */
export const MIN_OBSERVATIONS = 3;

export type CellState = 'none' | 'seen' | 'secure' | 'growing' | 'shaky';

export function cellState(tally: { attempts: number; correct: number } | undefined): CellState {
  if (!tally || tally.attempts <= 0) return 'none';
  if (tally.attempts < MIN_OBSERVATIONS) return 'seen';
  const rate = tally.correct / tally.attempts;
  return rate >= 0.9 ? 'secure' : rate >= 0.7 ? 'growing' : 'shaky';
}

const CELL_CLASS: Record<CellState, string> = {
  none: 'border-white/5 bg-slate-900/20 text-slate-600',
  seen: 'border-white/15 bg-slate-800/40 text-slate-300',
  secure: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  growing: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  shaky: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
};

const LEGEND: Array<[CellState, string]> = [
  ['secure', '9 in 10 or better'], ['growing', '7 in 10 or better'], ['shaky', 'under 7 in 10'], ['seen', 'fewer than 3 reads'],
];

/** The rows the grid draws: every group in order, without unobserved cells of the catch-all last group. */
export function gridRows(components: readonly ComponentInfo[], tallies: ComponentMasteryResponse['components'],
  catchAll: string | undefined): Array<{ group: string; cells: ComponentInfo[] }> {
  const rows: Array<{ group: string; cells: ComponentInfo[] }> = [];
  for (const c of components) {
    if (c.group === catchAll && !tallies[c.id]?.attempts) continue;
    const row = rows.find(r => r.group === c.group) ?? rows[rows.push({ group: c.group, cells: [] }) - 1];
    row.cells.push(c);
  }
  return rows;
}

export default function ComponentMasteryGrid({ studentId, kind }: ComponentMasteryGridProps) {
  const [catalog, setCatalog] = useState<{ title: string; components: ComponentInfo[] } | null>(null);
  const [mastery, setMastery] = useState<ComponentMasteryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCatalog(null); setMastery(null);
    Promise.all([
      fetch(`/api/lumina/component-evidence?kind=${encodeURIComponent(kind)}`).then(r => (r.ok ? r.json() : null)),
      analyticsApi.getComponentMastery(studentId, kind),
    ]).then(([c, m]) => {
      if (cancelled || !c || !Array.isArray(c.components)) return;
      setCatalog({ title: c.title, components: c.components }); setMastery(m);
    }).catch(() => { /* quiet: the rest of the profile works without this card */ });
    return () => { cancelled = true; };
  }, [studentId, kind]);

  const rows = useMemo(() => {
    if (!catalog || !mastery) return [];
    const groups = catalog.components.map(c => c.group);
    return gridRows(catalog.components, mastery.components, groups[groups.length - 1]);
  }, [catalog, mastery]);

  if (!catalog || !mastery) return null;
  const observed = Object.values(mastery.components).filter(t => t.attempts > 0);
  if (!observed.length) return null;
  const total = observed.reduce((n, t) => n + t.attempts, 0);

  return (
    <LuminaCard topAccent="emerald">
      <LuminaCardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <LuminaSectionLabel accent="emerald">{catalog.title}</LuminaSectionLabel>
          <LuminaBadge accent="emerald">{observed.length} seen</LuminaBadge>
          <span className="text-xs text-slate-400">{total.toLocaleString()} reads counted, from words read aloud</span>
        </div>
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.group} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <span className="w-44 shrink-0 pt-2 text-xs uppercase tracking-wide text-slate-500">{row.group}</span>
              <div className="flex flex-wrap gap-1.5">
                {row.cells.map(c => {
                  const tally = mastery.components[c.id];
                  const state = cellState(tally);
                  return (
                    <div key={c.id} data-component={c.id} data-state={state}
                      title={tally?.attempts ? `${c.label}: ${tally.correct} of ${tally.attempts} read correctly` : `${c.label}: not read yet`}
                      className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg border ${CELL_CLASS[state]}`}>
                      <span className="text-sm font-semibold leading-none">{c.label}</span>
                      <span className="mt-1 text-[10px] leading-none opacity-70">
                        {tally?.attempts ? `${tally.correct}/${tally.attempts}` : c.detail}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {LEGEND.map(([state, text]) => (
            <span key={state} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${CELL_CLASS[state]}`} />{text}
            </span>
          ))}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
}
