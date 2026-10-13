'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { formatNumber } from './drawerExpr';
import { chanceDistribution, chanceRunProblems, chanceTrial, type DrawerChanceRunData } from './growthSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerChanceRunData } from './growthSpecs';

const BATCHES = [1, 10, 100, 1000];

/**
 * Chance run: repeat a chance experiment in batches and watch the counts settle toward the
 * expected shape. The expected marks come from the exact distribution, computed in code.
 * Ungraded.
 */
const DrawerChanceRun: React.FC<{ data: DrawerChanceRunData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => chanceRunProblems(data), [data]);
  const dist = useMemo(() => (problems.length ? [] : chanceDistribution(data)), [data, problems]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [last, setLast] = useState<string | null>(null);
  if (problems.length) return <DrawerFrame kind="chance-run" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const run = (n: number) => {
    const next = { ...counts };
    let r = '';
    for (let i = 0; i < n; i++) { r = chanceTrial(data); next[r] = (next[r] ?? 0) + 1; }
    setCounts(next); setLast(n === 1 ? r : null);
  };
  const top = Math.max(1, ...dist.map(d => Math.max(counts[d.key] ?? 0, d.p * total))) * 1.05;
  const best = total ? dist.reduce((a, b) => ((counts[b.key] ?? 0) > (counts[a.key] ?? 0) ? b : a)).key : null;

  return (
    <DrawerFrame kind="chance-run" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        {BATCHES.map(n => (
          <LuminaButton key={n} tone={n === 1 ? 'primary' : 'ghost'} onClick={() => run(n)}>{n === 1 ? 'Try once' : `Try ${formatNumber(n)}`}</LuminaButton>
        ))}
        <LuminaButton tone="ghost" disabled={!total} onClick={() => { setCounts({}); setLast(null); }}>Reset</LuminaButton>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex h-40 items-end gap-1 border-b border-white/10">
          {dist.map(d => (
            <div key={d.key} className="relative flex h-full flex-1 items-end" title={`${d.key}: ${counts[d.key] ?? 0}`}>
              <div className="w-full rounded-t bg-indigo-400 transition-[height] duration-300" style={{ height: `${((counts[d.key] ?? 0) / top) * 100}%` }} />
              {total > 0 && <span className="absolute -left-px -right-px h-0.5 bg-amber-400" style={{ bottom: `${((d.p * total) / top) * 100}%` }} />}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {dist.map(d => <span key={d.key} className="flex-1 truncate text-center font-mono text-[10px] text-slate-400">{d.key}</span>)}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" />Your results</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Expected for this many tries</span>
      </div>
      <p className="text-sm text-slate-300" aria-live="polite">
        {!total ? 'No tries yet. Predict which result will come up most, then try.'
          : `${formatNumber(total)} ${total === 1 ? 'try' : 'tries'}.${last ? ` This one: ${last}.` : ''} Most common so far: ${best}.`}
      </p>
    </DrawerFrame>
  );
};

export default DrawerChanceRun;
