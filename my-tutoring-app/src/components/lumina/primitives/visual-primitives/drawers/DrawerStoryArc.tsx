'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton, LuminaPanel } from '../../../ui';
import { STORY_STAGES, storyArcProblems, type DrawerStoryArcData } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerStoryArcData } from './textSpecs';

const W = 560, H = 200;
/** The plot mountain: up through the problem to the big moment, then down to the ending. */
const POINTS = [{ x: 50, y: 160 }, { x: 170, y: 110 }, { x: 280, y: 40 }, { x: 390, y: 110 }, { x: 510, y: 160 }];

/**
 * Story arc: one story on the plot mountain, five fixed stages. The learner steps up and down
 * and retells each part; the same shape works for every story. Ungraded.
 */
const DrawerStoryArc: React.FC<{ data: DrawerStoryArcData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => storyArcProblems(data), [data]);
  const [at, setAt] = useState(0);
  if (problems.length) return <DrawerFrame kind="story-arc" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const path = `M 20 175 L ${POINTS.map(p => `${p.x} ${p.y}`).join(' L ')} L 540 175`;
  const stage = STORY_STAGES[at];

  return (
    <DrawerFrame kind="story-arc" title={data.title} caption={data.caption} problems={problems} className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Story stages">
        <path d={path} fill="none" stroke="#818cf8" strokeWidth={3} strokeLinejoin="round" />
        {POINTS.map((p, i) => {
          const s = STORY_STAGES[i], on = i === at;
          return (
            <g key={s.key} role="button" tabIndex={0} aria-pressed={on} aria-label={s.label} className="cursor-pointer outline-none"
              onClick={() => setAt(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAt(i); } }}>
              {/* A <g> has no hit area of its own; this transparent disc is the tap target around the small dot. */}
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" style={{ pointerEvents: 'all' }} />
              <circle cx={p.x} cy={p.y} r={on ? 11 : 8} fill={on ? '#818cf8' : '#0f172a'} stroke="#818cf8" strokeWidth={3} pointerEvents="none" />
              <text x={p.x} y={i === 2 ? p.y - 18 : p.y + 28} textAnchor="middle" fontSize="12" fontWeight={on ? 700 : 400} fill={on ? '#e2e8f0' : '#94a3b8'} pointerEvents="none">{s.label}</text>
            </g>
          );
        })}
      </svg>

      <LuminaPanel className="flex min-h-[96px] flex-col gap-1 p-4" aria-live="polite">
        <p className="font-mono text-xs uppercase tracking-wider text-indigo-300">{at + 1} · {stage.label}</p>
        <p className="text-base text-slate-200">{data.events[stage.key]}</p>
      </LuminaPanel>

      <div className="flex gap-2">
        <LuminaButton tone="ghost" disabled={at === 0} onClick={() => setAt(i => i - 1)}>Back</LuminaButton>
        <LuminaButton tone="primary" disabled={at === STORY_STAGES.length - 1} onClick={() => setAt(i => i + 1)}>Next part</LuminaButton>
      </div>
    </DrawerFrame>
  );
};

export default DrawerStoryArc;
