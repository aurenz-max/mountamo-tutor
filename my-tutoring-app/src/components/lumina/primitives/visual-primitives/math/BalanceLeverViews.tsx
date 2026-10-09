'use client';

import React from 'react';

/**
 * What balance-scale's help levers draw (`balanceScaleLevers.ts`). None of them prints the step's answer:
 * the unit squares are counted by the learner, the model scale carries a non-session weight, and the
 * part-whole bar's unknown part has no label.
 */

/** The weights again as unit squares in one row, a gap after every fifth square; blocks alternate colour. */
export function UnitCells({ values }: { values: number[] }) {
  let n = 0;
  return <div data-lever="unit-cells" aria-label="The same weights as unit squares" className="flex flex-wrap items-center justify-center gap-y-1">
    {values.flatMap((value, block) => Array.from({ length: value }, (_, i) => {
      const gap = n > 0 && n % 5 === 0;
      n++;
      return <span key={`${block}-${i}`} data-unit-cell="" aria-hidden="true" style={gap ? { marginLeft: 12 } : undefined}
        className={`mr-0.5 inline-block h-4 w-4 rounded-sm border ${block % 2 ? 'border-amber-200/70 bg-amber-300/50' : 'border-cyan-200/70 bg-cyan-400/50'}`} />;
    }))}
  </div>;
}

/** A small level model scale with the same numbered weight on each side. */
export function BalanceModel({ weight }: { weight: number }) {
  const block = <span className="flex flex-col items-center gap-1">
    <span aria-hidden="true" className="block w-6 rounded-sm border border-slate-200/60 bg-slate-300/50" style={{ height: weight * 4 }} />
    <span className="text-sm text-slate-200">{weight}</span>
  </span>;
  return <div data-lever="balance-model" aria-label={`A model scale: ${weight} on each side, level`}
    className="mx-auto w-48 rounded-xl border border-slate-400/30 bg-slate-900/40 p-3">
    <p className="mb-2 text-center text-xs text-slate-400">Model scale</p>
    <div className="flex items-end justify-around">{block}{block}</div>
    <div aria-hidden="true" className="mt-1 h-1 w-full rounded-full bg-slate-300" />
    <div aria-hidden="true" className="mx-auto h-3 w-1.5 bg-slate-500" />
  </div>;
}

/** A bar as long as the whole, split into the known part and an unlabelled part, in proportion. */
export function PartWholeBar({ whole, part }: { whole: number; part: number }) {
  const known = Math.max(0, Math.min(100, (part / Math.max(1, whole)) * 100));
  return <div data-lever="part-whole" aria-label={`A bar for ${whole}, split into ${part} and an unlabelled part`} className="mx-auto w-full max-w-md space-y-1">
    <div className="rounded-md border border-cyan-200/50 bg-cyan-400/20 py-1 text-center text-sm text-cyan-100">{whole}</div>
    <div className="flex">
      <div className="rounded-l-md border border-purple-200/60 bg-purple-400/40 py-1 text-center text-sm text-purple-100" style={{ width: `${known}%` }}>{part}</div>
      <div className="flex-1 rounded-r-md border border-dashed border-cyan-200/60 py-1 text-center text-sm text-slate-300">?</div>
    </div>
  </div>;
}
