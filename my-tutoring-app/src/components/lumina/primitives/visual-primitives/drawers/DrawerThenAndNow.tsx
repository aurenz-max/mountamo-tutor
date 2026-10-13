'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { thenAndNowProblems, type DrawerThenAndNowData } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerThenAndNowData } from './textSpecs';

type View = 'then' | 'now' | 'both';

/**
 * Then and now: one place or activity at two times, aspect by aspect. The learner looks at
 * each time alone, then side by side; aspects that did not change are marked, since what stayed
 * the same is part of the lesson. Ungraded.
 */
const DrawerThenAndNow: React.FC<{ data: DrawerThenAndNowData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => thenAndNowProblems(data), [data]);
  const [view, setView] = useState<View>('then');
  if (problems.length) return <DrawerFrame kind="then-and-now" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const cols: Array<'then' | 'now'> = view === 'both' ? ['then', 'now'] : [view];
  const label = (c: 'then' | 'now') => (c === 'then' ? data.thenLabel : data.nowLabel);

  return (
    <DrawerFrame kind="then-and-now" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        <LuminaButton tone={view === 'then' ? 'primary' : 'ghost'} onClick={() => setView('then')}>{data.thenLabel}</LuminaButton>
        <LuminaButton tone={view === 'now' ? 'primary' : 'ghost'} onClick={() => setView('now')}>{data.nowLabel}</LuminaButton>
        <LuminaButton tone={view === 'both' ? 'primary' : 'ghost'} onClick={() => setView('both')}>Side by side</LuminaButton>
      </div>

      <div className="flex flex-col">
        <div className={`hidden gap-3 border-b border-white/10 pb-2 font-mono text-xs uppercase tracking-wider text-slate-500 sm:grid ${view === 'both' ? 'sm:grid-cols-[150px_1fr_1fr]' : 'sm:grid-cols-[150px_1fr]'}`}>
          <span />{cols.map(c => <span key={c}>{label(c)}</span>)}
        </div>
        {data.rows.map(r => (
          <div key={r.aspect} className={`grid gap-1 border-b border-white/10 py-3 text-sm sm:gap-3 ${view === 'both' ? 'sm:grid-cols-[150px_1fr_1fr]' : 'sm:grid-cols-[150px_1fr]'}`}>
            <span className="font-semibold text-slate-100">
              {r.aspect}
              {view === 'both' && r.same && <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">same</span>}
            </span>
            {cols.map(c => (
              <span key={c} className="text-slate-300">
                <span className="mr-1 font-mono text-[10px] uppercase text-slate-500 sm:hidden">{label(c)}:</span>{r[c]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </DrawerFrame>
  );
};

export default DrawerThenAndNow;
