'use client';

import React, { useMemo, useState } from 'react';
import { LuminaChoiceChip, LuminaSlider } from '../../../ui';
import { formatNumber, formatSig, stepDigits } from './drawerExpr';
import { bandAt, bandScaleProblems, bandText, type DrawerBandScaleData } from './scaleSpecs';
import { DRAWER_FILLS, DrawerFrame } from './DrawerFrame';

export type { DrawerBandScaleData } from './scaleSpecs';

/**
 * Band scale: one variable on a slider, divided into named zones, with familiar examples
 * marked. The readout names the zone and evaluates its text's formulas at the current value.
 * Ungraded.
 */
const DrawerBandScale: React.FC<{ data: DrawerBandScaleData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => bandScaleProblems(data), [data]);
  const [x, setX] = useState(data.value);
  if (problems.length) return <DrawerFrame kind="band-scale" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const pct = (v: number) => ((v - data.min) / (data.max - data.min)) * 100;
  const band = bandAt(data, x);
  const digits = stepDigits(data.step);
  const unit = data.unit ? ` ${data.unit}` : '';

  return (
    <DrawerFrame kind="band-scale" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-semibold text-slate-200">
          <span>{data.variable}</span>
          <span className="tabular-nums text-cyan-300">{formatNumber(x, digits)}{unit}</span>
        </div>
        <div className="relative flex h-7 overflow-hidden rounded-md" aria-hidden="true">
          {data.bands.map((b, i) => (
            <div key={b.label} className={`${DRAWER_FILLS[i % DRAWER_FILLS.length].fill} flex items-center justify-center overflow-hidden text-[11px] font-semibold text-slate-900 transition-opacity`}
              style={{ width: `${pct(b.to) - pct(b.from)}%`, opacity: b === band ? 1 : 0.45 }}>
              <span className="truncate px-1">{b.label}</span>
            </div>
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pct(x)}%` }} />
        </div>
        <LuminaSlider accent="cyan" min={data.min} max={data.max} step={data.step} value={[x]}
          onValueChange={([v]) => setX(Number(v.toFixed(digits)))} aria-label={data.variable} />
        <div className="flex justify-between text-xs tabular-nums text-slate-500">
          <span>{formatNumber(data.min, digits)}</span><span>{formatNumber(data.max, digits)}</span>
        </div>
      </div>

      <div aria-live="polite">
        <p className="text-xl font-semibold text-slate-100">{band.label}</p>
        <p className="text-sm text-slate-300">{bandText(band, x, formatSig)}</p>
      </div>

      {data.markers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.markers.map(m => (
            <LuminaChoiceChip key={m.label} accent="cyan" selected={Math.abs(m.value - x) < data.step / 2}
              label={`${m.label} · ${formatNumber(m.value, digits)}`} onClick={() => setX(m.value)} />
          ))}
        </div>
      )}
    </DrawerFrame>
  );
};

export default DrawerBandScale;
