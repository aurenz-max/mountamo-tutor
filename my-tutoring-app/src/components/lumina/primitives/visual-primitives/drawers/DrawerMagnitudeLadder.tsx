'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { formatSig, powerOfTen } from './drawerExpr';
import { ladderItems, magnitudeLadderProblems, type DrawerMagnitudeLadderData } from './scaleSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerMagnitudeLadderData } from './scaleSpecs';

/**
 * Magnitude ladder: things of very different sizes as bars, first on one ordinary scale (where
 * all but the largest shrink to slivers), then on a powers-of-ten scale. Ungraded.
 */
const DrawerMagnitudeLadder: React.FC<{ data: DrawerMagnitudeLadderData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => magnitudeLadderProblems(data), [data]);
  const [log, setLog] = useState(false);
  if (problems.length) return <DrawerFrame kind="magnitude-ladder" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const items = ladderItems(data);
  const max = items[items.length - 1].value;
  const lo = Math.floor(Math.log10(items[0].value)), hi = Math.ceil(Math.log10(max));
  const width = (v: number) => (log ? ((Math.log10(v) - lo) / (hi - lo || 1)) : v / max) * 100;

  return (
    <DrawerFrame kind="magnitude-ladder" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        <LuminaButton tone={!log ? 'primary' : 'ghost'} onClick={() => setLog(false)}>Same scale</LuminaButton>
        <LuminaButton tone={log ? 'primary' : 'ghost'} onClick={() => setLog(true)}>Each step ×10</LuminaButton>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((x, i) => (
          <div key={x.label} className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_minmax(80px,110px)] items-center gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-slate-200">{x.label}</span>
              {log && i > 0 && <span className="text-[11px] text-amber-300">×{formatSig(x.value / items[i - 1].value)} the one above</span>}
            </div>
            <div className="relative h-3.5 rounded bg-white/5">
              <div className="absolute inset-y-0 left-0 rounded bg-emerald-400 transition-[width] duration-500" style={{ width: `${width(x.value)}%`, minWidth: 2 }} />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-slate-400">{formatSig(x.value)} {data.unit}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">
        {log
          ? `Each step along the bar is 10 times more, from ${powerOfTen(lo)} to ${powerOfTen(hi)} ${data.unit}.`
          : 'On one ordinary scale, everything except the largest shrinks to a sliver.'}
      </p>
    </DrawerFrame>
  );
};

export default DrawerMagnitudeLadder;
