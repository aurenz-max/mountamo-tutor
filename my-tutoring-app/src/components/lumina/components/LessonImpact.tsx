'use client';

/**
 * LessonImpact — the lesson review's "what your work changed" section.
 *
 * Reads `by_cause` from the learner-model influence endpoint: for each skill
 * practised this lesson, what its answers did along the prerequisite graph.
 *
 *   Shows these are in place   prerequisites the answers made more likely
 *   Worth checking             prerequisites a miss made less likely
 *   Closer now                 next skills brought within reach ("Ready to learn"
 *                              when one crossed into the ready set)
 *   Further away for now       next skills a miss pushed back
 *
 * Every neighbour move is counted beyond the general-ability shift that moves
 * every skill a little after any answer, so a listed skill moved because of
 * THIS skill's evidence. A practised skill with no listed neighbour says so:
 * the lesson confirmed what the model already expected.
 */

import React from 'react';
import type { LearnerCause, LearnerCauseLink, LearnerInfluenceResponse } from '@/lib/studentAnalyticsAPI';
import MasteryBands from './MasteryBands';
import { LuminaBadge, LuminaSectionLabel } from '../ui';

const GROUPS: Array<{ field: keyof Pick<LearnerCause, 'foundations' | 'check' | 'next' | 'further'>; title: string; arrow: string; tone: string }> = [
  { field: 'foundations', title: 'Shows these are in place', arrow: '↑', tone: 'text-emerald-300' },
  { field: 'check', title: 'Worth checking', arrow: '↓', tone: 'text-amber-300' },
  { field: 'next', title: 'Closer now', arrow: '→', tone: 'text-cyan-300' },
  { field: 'further', title: 'Further away for now', arrow: '←', tone: 'text-slate-400' },
];

function gradeName(grade: string): string {
  return grade === 'Kindergarten' ? 'K' : `G${grade}`;
}

const LinkRow: React.FC<{ link: LearnerCauseLink; arrow: string; tone: string }> = ({ link, arrow, tone }) => (
  <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
    <span className={`text-sm font-semibold w-4 text-center flex-shrink-0 ${tone}`} aria-hidden>
      {arrow}
    </span>
    <span className="text-sm text-slate-300 leading-snug line-clamp-2 flex-1 min-w-0">{link.label}</span>
    <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">{gradeName(link.grade)}</span>
    {link.became_ready && <LuminaBadge accent="cyan">Ready to learn</LuminaBadge>}
    <MasteryBands p={link.pc[1]} before={link.pc[0]} hideLabel className="flex-shrink-0" />
  </div>
);

const CauseCard: React.FC<{ cause: LearnerCause; limit: number }> = ({ cause, limit }) => {
  const groups = GROUPS.map((g) => ({ ...g, links: cause[g.field].slice(0, limit) })).filter((g) => g.links.length > 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-100 leading-snug line-clamp-2">{cause.label}</div>
          <div className="text-xs text-slate-500 mt-1">
            {cause.answers} {cause.answers === 1 ? 'activity' : 'activities'} · {Math.round(cause.first_try * 100)}% right
            first try
          </div>
        </div>
        {cause.pc && <MasteryBands p={cause.pc[1]} before={cause.pc[0]} className="flex-shrink-0" />}
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">This matched what we already expected, so nothing else moved.</p>
      ) : (
        groups.map((g) => (
          <div key={g.field} className="space-y-1">
            <div className={`text-xs font-medium ${g.tone}`}>{g.title}</div>
            {g.links.map((l) => (
              <LinkRow key={l.key} link={l} arrow={g.arrow} tone={g.tone} />
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export interface LessonImpactProps {
  influence: LearnerInfluenceResponse;
  /** Most neighbours listed per group. */
  limit?: number;
}

export default function LessonImpact({ influence, limit = 3 }: LessonImpactProps) {
  const causes = influence.by_cause ?? [];
  const unlocked = influence.unlocked ?? [];
  if (causes.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <LuminaSectionLabel>What your work changed</LuminaSectionLabel>
        <p className="text-xs text-slate-500 mt-1">
          Each skill you practised, and what your answers showed about the skills before and after it.
        </p>
      </div>
      {unlocked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Now ready to learn:</span>
          {unlocked.map((u) => (
            <LuminaBadge key={u.key} accent="cyan">
              {u.label}
            </LuminaBadge>
          ))}
        </div>
      )}
      {causes.map((c) => (
        <CauseCard key={c.key} cause={c} limit={limit} />
      ))}
    </div>
  );
}
