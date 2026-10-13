'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { formatNumber } from './drawerExpr';
import { metricSwitchProblems, rankBy, type DrawerMetricSwitchData } from './scaleSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerMetricSwitchData } from './scaleSpecs';

const ROW = 34;

/**
 * Metric switch: the same things ranked by a measure the learner picks. Rows slide to their new
 * place when the measure changes, and the followed item is highlighted in every ranking.
 * Ungraded.
 */
const DrawerMetricSwitch: React.FC<{ data: DrawerMetricSwitchData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => metricSwitchProblems(data), [data]);
  const [m, setM] = useState(0);
  if (problems.length) return <DrawerFrame kind="metric-switch" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const order = rankBy(data, m);
  const place = new Map(order.map((idx, rank) => [idx, rank]));
  const metric = data.metrics[m];
  const top = data.items[order[0]].values[m] || 1;
  const follow = data.items.findIndex(x => x.label === data.follow);

  return (
    <DrawerFrame kind="metric-switch" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        {data.metrics.map((x, i) => (
          <LuminaButton key={x.label} tone={i === m ? 'primary' : 'ghost'} onClick={() => setM(i)}>{x.label}</LuminaButton>
        ))}
      </div>

      <div className="relative" style={{ height: data.items.length * ROW }}>
        {data.items.map((x, i) => {
          const me = i === follow;
          return (
            <div key={x.label} className={`absolute inset-x-0 grid grid-cols-[28px_minmax(80px,120px)_minmax(0,1fr)_minmax(90px,130px)] items-center gap-2 rounded-md px-1 text-sm transition-transform duration-500 ${me ? 'bg-amber-400/10' : ''}`}
              style={{ height: ROW - 4, transform: `translateY(${(place.get(i) ?? 0) * ROW}px)` }}>
              <span className="font-mono text-xs text-slate-500">{(place.get(i) ?? 0) + 1}</span>
              <span className={me ? 'font-semibold text-amber-200' : 'text-slate-200'}>{x.label}</span>
              <div className="relative h-3 rounded bg-white/5">
                <div className={`absolute inset-y-0 left-0 rounded transition-[width] duration-500 ${me ? 'bg-amber-400' : 'bg-indigo-400'}`}
                  style={{ width: `${(x.values[m] / top) * 100}%`, minWidth: 2 }} />
              </div>
              <span className="text-right font-mono text-xs tabular-nums text-slate-400">{formatNumber(x.values[m], metric.digits)} {metric.unit}</span>
            </div>
          );
        })}
      </div>

      {follow >= 0 && (
        <p className="text-sm text-slate-300" aria-live="polite">
          By {metric.label.toLowerCase()}, {data.follow} is number {(place.get(follow) ?? 0) + 1} of {data.items.length}.
        </p>
      )}
    </DrawerFrame>
  );
};

export default DrawerMetricSwitch;
