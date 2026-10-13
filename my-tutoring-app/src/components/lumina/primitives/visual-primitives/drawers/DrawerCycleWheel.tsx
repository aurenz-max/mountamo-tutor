'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton, LuminaPanel } from '../../../ui';
import { cycleWheelProblems, type DrawerCycleWheelData } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerCycleWheelData } from './textSpecs';

const SIZE = 320, R = 112, PILL_W = 112, PILL_H = 34, PAD = 28;

/**
 * Cycle wheel: stages on a loop with no first or last step. The learner steps round it or taps
 * a stage; before each step it asks what comes next. Ungraded.
 */
const DrawerCycleWheel: React.FC<{ data: DrawerCycleWheelData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => cycleWheelProblems(data), [data]);
  const [at, setAt] = useState(0);
  const [laps, setLaps] = useState(0);
  if (problems.length) return <DrawerFrame kind="cycle-wheel" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const n = data.stages.length;
  const pos = (i: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: SIZE / 2 + R * Math.cos(a), y: SIZE / 2 + R * Math.sin(a) };
  };
  const step = () => { if (at === n - 1) setLaps(l => l + 1); setAt(i => (i + 1) % n); };
  const stage = data.stages[at];

  return (
    <DrawerFrame kind="cycle-wheel" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <svg viewBox={`${-PAD} 0 ${SIZE + PAD * 2} ${SIZE}`} className="mx-auto h-auto w-full max-w-[360px]" role="group" aria-label="Stages of the cycle">
          <defs>
            <marker id="cw-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
            </marker>
          </defs>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2} strokeDasharray="6 6" />
          {data.stages.map((_, i) => {
            const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
            const b = a + 0.12;
            return <path key={i} d={`M ${SIZE / 2 + R * Math.cos(a - 0.12)} ${SIZE / 2 + R * Math.sin(a - 0.12)} A ${R} ${R} 0 0 1 ${SIZE / 2 + R * Math.cos(b)} ${SIZE / 2 + R * Math.sin(b)}`}
              fill="none" stroke="#64748b" strokeWidth={2} markerEnd="url(#cw-arrow)" />;
          })}
          {data.stages.map((s, i) => {
            const p = pos(i), on = i === at;
            return (
              <g key={s.label} role="button" tabIndex={0} aria-pressed={on} aria-label={s.label} className="cursor-pointer outline-none"
                onClick={() => setAt(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAt(i); } }}>
                <rect x={p.x - PILL_W / 2} y={p.y - PILL_H / 2} width={PILL_W} height={PILL_H} rx={PILL_H / 2}
                  fill={on ? '#22d3ee' : 'rgba(30,41,59,0.95)'} stroke={on ? '#22d3ee' : 'rgba(255,255,255,0.2)'} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight={600} fill={on ? '#0f172a' : '#e2e8f0'} pointerEvents="none">{s.label}</text>
              </g>
            );
          })}
          <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" fontSize="20" fontWeight={700} fill="#e2e8f0">{at + 1} of {n}</text>
          <text x={SIZE / 2} y={SIZE / 2 + 18} textAnchor="middle" fontSize="11" fill="#94a3b8">{laps ? `lap ${laps + 1}` : 'no start, no end'}</text>
        </svg>

        <div className="flex flex-col gap-3">
          <LuminaPanel className="flex flex-col gap-1 p-4" aria-live="polite">
            <p className="text-lg font-semibold text-cyan-300">{stage.label}</p>
            <p className="text-sm text-slate-300">{stage.text}</p>
          </LuminaPanel>
          <p className="text-sm text-slate-400">What comes after {stage.label.toLowerCase()}? Say it, then check.</p>
          <LuminaButton tone="primary" className="self-start" onClick={step}>Next stage</LuminaButton>
        </div>
      </div>
    </DrawerFrame>
  );
};

export default DrawerCycleWheel;
