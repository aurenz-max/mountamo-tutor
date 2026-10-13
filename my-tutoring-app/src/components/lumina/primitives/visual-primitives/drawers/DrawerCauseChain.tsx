'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { LuminaButton, LuminaPanel } from '../../../ui';
import { causeChainProblems, propagate, type DrawerCauseChainData } from './drawerSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerCauseChainData } from './drawerSpecs';

/**
 * Cause-chain drawer: start a change at one end and reveal its effects one link at a time,
 * so the learner can predict each step before seeing it. Every node shows "?" until revealed.
 * Ungraded.
 */
const DrawerCauseChain: React.FC<{ data: DrawerCauseChainData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => causeChainProblems(data), [data]);
  const [start, setStart] = useState<1 | -1 | null>(null);
  const [revealed, setRevealed] = useState(0);
  const dirs = start && !problems.length ? propagate(data, start) : [];
  const first = data.nodes?.[0];
  const lastLink = revealed > 0 ? data.links[revealed - 1] : null;

  const begin = (d: 1 | -1) => { setStart(d); setRevealed(0); };

  if (problems.length) return <DrawerFrame kind="cause-chain" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  return (
    <DrawerFrame kind="cause-chain" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        <LuminaButton tone={start === -1 ? 'primary' : 'ghost'} onClick={() => begin(-1)}>{first?.label}: decrease</LuminaButton>
        <LuminaButton tone={start === 1 ? 'primary' : 'ghost'} onClick={() => begin(1)}>{first?.label}: increase</LuminaButton>
        <LuminaButton tone="ghost" disabled={!start || revealed >= data.links.length} onClick={() => setRevealed(r => r + 1)}>
          Show next effect
        </LuminaButton>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        {data.nodes.map((n, i) => {
          const known = start !== null && i <= revealed;
          const up = known && dirs[i] === 1;
          return (
            <React.Fragment key={n.id}>
              {i > 0 && <ArrowRight className="self-center text-slate-500 shrink-0" size={18} aria-hidden="true" />}
              <LuminaPanel className="flex min-w-[120px] flex-1 flex-col gap-2 p-3">
                <span className="text-sm font-semibold text-slate-100">{n.label}</span>
                <span className={`self-start rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                  !known ? 'bg-white/5 text-slate-400' : up ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  {!known ? '?' : up ? '↑ goes up' : '↓ goes down'}
                </span>
              </LuminaPanel>
            </React.Fragment>
          );
        })}
      </div>

      <p className="min-h-[2.5rem] border-l-2 border-cyan-400/60 pl-3 text-sm text-slate-300" aria-live="polite">
        {start === null
          ? 'Pick a starting change. Predict what happens to each part before you reveal it.'
          : lastLink
            ? `${lastLink.because}, so ${data.nodes[revealed].label.toLowerCase()} ${dirs[revealed] === 1 ? 'go up' : 'go down'}.`
            : `${first?.label} ${start === 1 ? 'increase' : 'decrease'}. What happens next?`}
      </p>
    </DrawerFrame>
  );
};

export default DrawerCauseChain;
