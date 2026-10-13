'use client';

import React, { useMemo, useState } from 'react';
import { LuminaChoiceChip, LuminaSlider } from '../../../ui';
import { formatSig } from './drawerExpr';
import { rangeBarsProblems, rangeIsLog, rangeScale, type DrawerRangeBarsData } from './scaleSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerRangeBarsData } from './scaleSpecs';

const STEPS = 1000;

/**
 * Range bars: each thing's range on one shared scale (log when it spans powers of ten), and a
 * slider sweeping across it. The readout names who covers the current value. Ungraded.
 */
const DrawerRangeBars: React.FC<{ data: DrawerRangeBarsData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => rangeBarsProblems(data), [data]);
  const scale = useMemo(() => (problems.length ? null : rangeScale(data)), [data, problems]);
  const [t, setT] = useState(() => (scale ? scale.pos(data.value) : 0));
  if (problems.length || !scale) return <DrawerFrame kind="range-bars" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const v = scale.val(t);
  const covers = data.items.filter(x => v >= x.from && v <= x.to);
  const unit = data.unit ? ` ${data.unit}` : '';

  return (
    <DrawerFrame kind="range-bars" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-semibold text-slate-200">
          <span>{data.variable}{rangeIsLog(data) ? ' (each step ×10)' : ''}</span>
          <span className="tabular-nums text-cyan-300">{formatSig(v)}{unit}</span>
        </div>
        <LuminaSlider accent="cyan" min={0} max={STEPS} step={1} value={[Math.round(t * STEPS)]}
          onValueChange={([s]) => setT(s / STEPS)} aria-label={data.variable} />
      </div>

      <div className="flex flex-col gap-2">
        {data.items.map(x => {
          const on = v >= x.from && v <= x.to;
          return (
            <div key={x.label} className="grid grid-cols-[minmax(80px,120px)_minmax(0,1fr)] items-center gap-3 text-sm">
              <span className={on ? 'font-semibold text-slate-100' : 'text-slate-400'}>{x.label}</span>
              <div className="relative h-4 rounded bg-white/5">
                <div className={`absolute inset-y-0 rounded bg-emerald-400 transition-opacity ${on ? 'opacity-100' : 'opacity-35'}`}
                  style={{ left: `${scale.pos(x.from) * 100}%`, width: `${(scale.pos(x.to) - scale.pos(x.from)) * 100}%` }}
                  title={`${formatSig(x.from)}-${formatSig(x.to)}${unit}`} />
                <div className="absolute -inset-y-1 w-0.5 bg-white" style={{ left: `${t * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-slate-300" aria-live="polite">
        {covers.length ? `At ${formatSig(v)}${unit}: ${covers.map(c => c.label).join(', ')}.` : `Nothing here covers ${formatSig(v)}${unit}.`}
      </p>

      {data.landmarks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.landmarks.map(m => (
            <LuminaChoiceChip key={m.label} accent="cyan" selected={Math.abs(scale.pos(m.value) - t) < 0.002}
              label={`${m.label} · ${formatSig(m.value)}${unit}`} onClick={() => setT(scale.pos(m.value))} />
          ))}
        </div>
      )}
    </DrawerFrame>
  );
};

export default DrawerRangeBars;
