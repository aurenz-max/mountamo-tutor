'use client';

import React, { useMemo, useState } from 'react';
import { LuminaSlider, LuminaStat } from '../../../ui';
import { formatNumber, stepDigits } from './drawerExpr';
import { defaultInputs, evaluateModel, modelSliderProblems, type DrawerModelSliderData } from './drawerSpecs';
import { DRAWER_FILLS, DrawerFrame, niceCeiling } from './DrawerFrame';

export type { DrawerModelSliderData } from './drawerSpecs';

/**
 * Model slider drawer: move an input, watch the consequence. Gemini supplies the inputs, the
 * formulas and one known fact; code evaluates every output and drops a spec whose formula
 * contradicts its own fact. Ungraded.
 */
const DrawerModelSlider: React.FC<{ data: DrawerModelSliderData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => modelSliderProblems(data), [data]);
  const [inputs, setInputs] = useState(() => (problems.length ? {} : defaultInputs(data)));
  const out = useMemo(() => (problems.length ? {} : evaluateModel(data, inputs)), [data, inputs, problems]);

  if (problems.length) return <DrawerFrame kind="model-slider" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const barTotal = data.barParts.reduce((s, id) => s + out[id], 0);
  const barMax = niceCeiling(barTotal);
  const barUnit = data.outputs.find(o => o.id === data.barParts[0])?.unit ?? '';

  return (
    <DrawerFrame kind="model-slider" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-5">
        {data.inputs?.map(x => (
          <div key={x.id} className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold text-slate-200">
              <span>{x.label}</span>
              <span className="tabular-nums text-cyan-300">{formatNumber(inputs[x.id] ?? x.value, stepDigits(x.step))} {x.unit}</span>
            </div>
            <LuminaSlider accent="cyan" min={x.min} max={x.max} step={x.step} value={[inputs[x.id] ?? x.value]}
              onValueChange={([v]) => setInputs(s => ({ ...s, [x.id]: Number(v.toFixed(stepDigits(x.step))) }))}
              aria-label={x.label} />
            <div className="flex justify-between text-xs text-slate-500 tabular-nums">
              <span>{formatNumber(x.min, stepDigits(x.step))}</span><span>{formatNumber(x.max, stepDigits(x.step))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
        {data.outputs?.map(o => (
          <LuminaStat key={o.id} label={o.label} accent={o.primary ? 'cyan' : undefined}
            value={<span className="tabular-nums">{formatNumber(out[o.id] ?? 0, o.digits)}</span>} unit={o.unit} />
        ))}
      </div>

      {data.barParts?.length > 0 && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="flex h-7 overflow-hidden rounded-md bg-white/5">
            {data.barParts.map((id, i) => (
              <div key={id} className={`${DRAWER_FILLS[i].fill} h-full transition-[width] duration-300`}
                style={{ width: `${(out[id] / barMax) * 100}%` }} />
            ))}
          </div>
          <div className="relative h-4 text-[11px] text-slate-500 tabular-nums">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <span key={t} className="absolute whitespace-nowrap"
                style={{ left: `${t * 100}%`, transform: t === 0 ? 'none' : t === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {formatNumber(barMax * t)}{t === 1 ? ` ${barUnit}` : ''}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {data.barParts.map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${DRAWER_FILLS[i].fill}`} />
                {data.outputs.find(o => o.id === id)?.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.check?.fact && <p className="text-xs text-slate-500">Checked against: {data.check.fact}</p>}
    </DrawerFrame>
  );
};

export default DrawerModelSlider;
