'use client';

import React, { useMemo, useState } from 'react';
import { LuminaSlider } from '../../../ui';
import { formatNumber, stepDigits } from './drawerExpr';
import { formatAmount, ratioScalerProblems, scaleFactor, type DrawerRatioScalerData } from './growthSpecs';
import { DRAWER_FILLS, DrawerFrame } from './DrawerFrame';

export type { DrawerRatioScalerData } from './growthSpecs';

/**
 * Ratio scaler: a recipe whose every amount is multiplied by the same factor as the learner
 * changes how much to make. The factor is shown as a fraction, and a bar of the proportions
 * stays the same shape at every setting, which is the point. Ungraded.
 */
const DrawerRatioScaler: React.FC<{ data: DrawerRatioScalerData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => ratioScalerProblems(data), [data]);
  const [n, setN] = useState(data.value);
  if (problems.length) return <DrawerFrame kind="ratio-scaler" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const k = n / data.base;
  const digits = stepDigits(data.step);
  const total = data.ingredients.reduce((s, x) => s + x.amount, 0);
  // Amounts only add up to a meaningful bar when they share a unit.
  const oneUnit = new Set(data.ingredients.map(x => x.unit.trim().toLowerCase())).size === 1;

  return (
    <DrawerFrame kind="ratio-scaler" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-semibold text-slate-200">
          <span>Make</span>
          <span className="tabular-nums text-cyan-300">{formatNumber(n, digits)} {data.unitLabel}</span>
        </div>
        <LuminaSlider accent="cyan" min={data.min} max={data.max} step={data.step} value={[n]}
          onValueChange={([v]) => setN(Number(v.toFixed(digits)))} aria-label={`How many ${data.unitLabel}`} />
        <p className="text-xs text-slate-500">
          The recipe makes {formatNumber(data.base, digits)}. Every amount × <span className="font-mono text-amber-300">{scaleFactor(n, data.base)}</span>
        </p>
      </div>

      <div className="flex flex-col">
        {data.ingredients.map((x, i) => (
          <div key={x.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-white/10 py-2 text-sm">
            <span className="inline-flex items-center gap-2 text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-sm ${DRAWER_FILLS[i % DRAWER_FILLS.length].fill}`} />{x.label}
            </span>
            <span><b className="text-lg tabular-nums text-slate-100">{formatAmount(x.amount * k)}</b> <span className="text-slate-400">{x.unit}</span></span>
          </div>
        ))}
      </div>

      {oneUnit && (
      <div className="flex h-5 overflow-hidden rounded-md" aria-hidden="true">
        {data.ingredients.map((x, i) => (
          <div key={x.label} className={`${DRAWER_FILLS[i % DRAWER_FILLS.length].fill} h-full`} style={{ width: `${(x.amount / total) * 100}%` }} />
        ))}
      </div>
      )}
    </DrawerFrame>
  );
};

export default DrawerRatioScaler;
