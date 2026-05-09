'use client';

import React from 'react';
import { Card } from '../../../ui/card';
import type { MomentSet } from './types';

interface MomentReadoutProps {
  moments: MomentSet;
}

const Stat: React.FC<{ label: string; value: number; precision?: number }> = ({
  label,
  value,
  precision = 3,
}) => (
  <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-800/40">
    <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    <span className="text-lg font-mono text-slate-100">
      {Number.isFinite(value) ? value.toFixed(precision) : '—'}
    </span>
  </div>
);

/**
 * Live moment readout. Updates whenever the parent passes a new
 * `EvaluatedDistribution.moments`. Kurtosis here is the *excess* kurtosis
 * the engine reports (Binomial / Poisson formulas use that convention);
 * Normal distribution would show 0.
 */
export const MomentReadout: React.FC<MomentReadoutProps> = ({ moments }) => {
  const stdDev = Math.sqrt(moments.variance);
  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Moments
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Mean μ" value={moments.mean} />
        <Stat label="Variance σ²" value={moments.variance} />
        <Stat label="Std σ" value={stdDev} />
        <Stat label="Skewness" value={moments.skewness} />
        <div className="col-span-2">
          <Stat label="Excess Kurtosis" value={moments.kurtosis} />
        </div>
      </div>
    </Card>
  );
};
