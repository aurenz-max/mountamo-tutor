'use client';

import React, { useMemo, useState } from 'react';
import { LuminaSlider } from '../../../ui';
import { compileExpr, formatNumber, formatSig, formatWords, stepDigits } from './drawerExpr';
import { defaultInputs } from './drawerSpecs';
import { unitChainProblems, unitChainValues, type DrawerUnitChainData } from './growthSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerUnitChainData } from './growthSpecs';

/** Whole numbers in full with separators; fractions to three significant figures. */
const show = (n: number) => (Number.isInteger(n) && Math.abs(n) < 1e15 ? formatNumber(n) : formatSig(n));

/**
 * Unit chain: a familiar rate multiplied step by step into a large total, each step showing
 * the multiplier and why. The learner changes the starting rate and watches every row follow.
 * Ungraded.
 */
const DrawerUnitChain: React.FC<{ data: DrawerUnitChainData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => unitChainProblems(data), [data]);
  const [env, setEnv] = useState(() => (problems.length ? {} : defaultInputs(data)));
  if (problems.length) return <DrawerFrame kind="unit-chain" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const vals = unitChainValues(data, env);
  const rows = [{ label: data.startLabel, why: '' as string, times: null as number | null }, ...data.steps.map(s => ({ label: s.label, why: s.why, times: compileExpr(s.times)(env) }))];

  return (
    <DrawerFrame kind="unit-chain" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-4">
        {data.inputs.map(x => (
          <div key={x.id} className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold text-slate-200">
              <span>{x.label}</span>
              <span className="tabular-nums text-cyan-300">{formatNumber(env[x.id] ?? x.value, stepDigits(x.step))} {x.unit}</span>
            </div>
            <LuminaSlider accent="cyan" min={x.min} max={x.max} step={x.step} value={[env[x.id] ?? x.value]}
              onValueChange={([v]) => setEnv(s => ({ ...s, [x.id]: Number(v.toFixed(stepDigits(x.step))) }))} aria-label={x.label} />
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {rows.map((r, i) => (
          <React.Fragment key={r.label}>
            {r.times !== null && (
              <p className="px-3 py-1 font-mono text-xs text-amber-300">× {show(r.times)} · {r.why}</p>
            )}
            <div className={`flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 ${i === rows.length - 1 ? 'bg-cyan-400/10' : 'bg-white/5'}`}>
              <span className="text-sm text-slate-300">{r.label}</span>
              <span className={`font-semibold tabular-nums ${i === rows.length - 1 ? 'text-2xl text-cyan-300' : 'text-lg text-slate-100'}`}>{show(vals[i])}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="text-sm text-slate-400" aria-live="polite">That is about {formatWords(vals[vals.length - 1])} {data.finalNoun}.</p>
    </DrawerFrame>
  );
};

export default DrawerUnitChain;
