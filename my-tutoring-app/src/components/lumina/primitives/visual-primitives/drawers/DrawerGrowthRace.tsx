'use client';

import React, { useMemo, useState } from 'react';
import { LuminaSlider, LuminaStat } from '../../../ui';
import { formatSig } from './drawerExpr';
import { crossingX, growthAt, growthRaceProblems, type DrawerGrowthRaceData } from './growthSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerGrowthRaceData } from './growthSpecs';

const W = 520, H = 220, PAD = 36;
const COLORS = ['#34d399', '#f472b6'];

/**
 * Growth race: adding against multiplying. The chart runs from the start to the current x and
 * rescales to the larger value, so the crossing stays visible however big the numbers get.
 * Ungraded.
 */
const DrawerGrowthRace: React.FC<{ data: DrawerGrowthRaceData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => growthRaceProblems(data), [data]);
  const [x, setX] = useState(data.value);
  if (problems.length) return <DrawerFrame kind="growth-race" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const xs = Array.from({ length: x - data.min + 1 }, (_, i) => data.min + i);
  const ys = [0, 1].map(s => xs.map(v => growthAt(data, s, v)));
  const top = Math.max(...ys[0], ...ys[1]) || 1;
  const px = (v: number) => PAD + ((v - data.min) / Math.max(x - data.min, 1)) * (W - PAD * 2);
  const py = (v: number) => H - PAD - (v / top) * (H - PAD * 2);
  const cross = crossingX(data);
  const now = [growthAt(data, 0, x), growthAt(data, 1, x)];
  const leader = now[0] === now[1] ? null : now[0] > now[1] ? 0 : 1;

  return (
    <DrawerFrame kind="growth-race" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-semibold text-slate-200">
          <span>{data.xLabel}</span><span className="tabular-nums text-cyan-300">{x}</span>
        </div>
        <LuminaSlider accent="cyan" min={data.min} max={data.max} step={1} value={[x]} onValueChange={([v]) => setX(Math.round(v))} aria-label={data.xLabel} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${data.series[0].label} and ${data.series[1].label} up to ${data.xLabel.toLowerCase()} ${x}`}>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={PAD} x2={W - PAD} y1={py(top * t)} y2={py(top * t)} stroke="rgba(255,255,255,0.08)" />
            <text x={PAD - 6} y={py(top * t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{formatSig(top * t)}</text>
          </g>
        ))}
        <text x={PAD} y={H - 12} fontSize="10" fill="#94a3b8">{data.min}</text>
        <text x={W - PAD} y={H - 12} textAnchor="end" fontSize="10" fill="#94a3b8">{x}</text>
        {cross !== null && cross <= x && (
          <line x1={px(cross)} x2={px(cross)} y1={PAD / 2} y2={H - PAD} stroke="#fbbf24" strokeDasharray="4 4" />
        )}
        {ys.map((series, s) => (
          <polyline key={s} fill="none" stroke={COLORS[s]} strokeWidth={3} strokeLinejoin="round"
            points={series.map((v, i) => `${px(xs[i])},${py(v)}`).join(' ')} />
        ))}
      </svg>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.series.map((s, i) => (
          <LuminaStat key={s.label} label={s.label} accent={leader === i ? 'cyan' : undefined}
            value={<span className="tabular-nums" style={{ color: COLORS[i] }}>{formatSig(now[i])}</span>} unit={data.unit} />
        ))}
      </div>
      <p className="text-sm text-slate-300" aria-live="polite">
        {cross !== null && x >= cross
          ? `${data.series[1].label} took the lead at ${data.xLabel.toLowerCase()} ${cross}.`
          : leader === null ? 'They are level.' : `${data.series[leader].label} is ahead so far. Keep going.`}
      </p>
    </DrawerFrame>
  );
};

export default DrawerGrowthRace;
