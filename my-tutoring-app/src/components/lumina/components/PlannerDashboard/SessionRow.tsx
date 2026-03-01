import React from 'react';
import { Button } from '@/components/ui/button';
import type { SessionItem, SubjectWeekProgress } from './types';

export const SessionRow: React.FC<{
  session: SessionItem;
  /** Resolved mastery gate for this skill (undefined = not yet loaded) */
  gate?: number;
  onStart?: (session: SessionItem, gate: number) => void;
}> = ({ session, gate, onStart }) => {
  const isReview = session.type === 'review';

  const reasonLabels: Record<string, { label: string; color: string }> = {
    scheduled_review: { label: 'Scheduled', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    mastery_retest: { label: 'Mastery Retest', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    behind_pace: { label: 'Behind Pace', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    next_in_sequence: { label: 'Next Up', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  };
  const reason = reasonLabels[session.reason] || { label: session.reason, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };

  // Determine effective gate: use resolved mastery gate, or infer from session type
  // TODO: Replace inference with real backend gate lookup per-skill
  const effectiveGate = gate ?? (isReview ? 2 : 1);
  const isPracticeGate = effectiveGate >= 2;
  const gateBadge = isPracticeGate
    ? { label: `Gate ${effectiveGate} · Practice`, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' }
    : { label: `Gate ${effectiveGate} · Lesson`, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-white/5 hover:border-white/10 transition-colors">
      {/* Priority */}
      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs font-mono text-slate-500 flex-shrink-0">
        {session.priority}
      </div>

      {/* Type badge */}
      <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${
        isReview
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
      }`}>
        {session.type}
      </div>

      {/* Skill info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">
          {session.subskill_description || session.skill_name}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {session.unit_title && (
            <span className="text-slate-400">{session.unit_title}</span>
          )}
          {session.unit_title && session.skill_description && ' / '}
          {session.skill_description && (
            <span>{session.skill_description}</span>
          )}
          {!session.unit_title && !session.skill_description && (
            <span>{session.subject} &middot; {session.skill_id}</span>
          )}
        </div>
      </div>

      {/* Gate badge */}
      <span className={`px-2 py-0.5 rounded text-[10px] border flex-shrink-0 ${gateBadge.color}`}>
        {gateBadge.label}
      </span>

      {/* Reason badge */}
      <span className={`px-2 py-0.5 rounded text-[10px] border flex-shrink-0 ${reason.color}`}>
        {reason.label}
      </span>

      {/* Review-specific details */}
      {isReview && session.completion_factor !== undefined && (
        <div className="text-right flex-shrink-0 hidden sm:block">
          <div className="text-xs text-slate-400">
            CF: <span className="text-slate-200 font-mono">{(session.completion_factor * 100).toFixed(0)}%</span>
          </div>
          {session.days_overdue !== undefined && session.days_overdue > 0 && (
            <div className="text-[10px] text-red-400">{session.days_overdue}d overdue</div>
          )}
        </div>
      )}

      {/* Start button */}
      {onStart && (
        <Button
          variant="ghost"
          className={`px-3 py-1 text-xs font-semibold flex-shrink-0 ${
            isPracticeGate
              ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30'
              : 'bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30'
          }`}
          onClick={() => onStart(session, effectiveGate)}
        >
          {isPracticeGate ? 'Practice' : 'Learn'}
        </Button>
      )}
    </div>
  );
};

export const SectionDivider: React.FC<{ category: string }> = ({ category }) => {
  const config: Record<string, { label: string; description: string; color: string; border: string }> = {
    interleaved: {
      label: 'Core Session',
      description: 'New skills and reviews, interleaved for optimal learning',
      color: 'text-cyan-400',
      border: 'border-cyan-500/30',
    },
    tail: {
      label: 'Cool Down',
      description: 'Lighter reviews to finish the session',
      color: 'text-slate-400',
      border: 'border-slate-500/30',
    },
  };
  const cfg = config[category] || { label: category, description: '', color: 'text-slate-400', border: 'border-slate-500/30' };

  return (
    <div className={`flex items-center gap-3 py-2 border-b ${cfg.border}`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>
        {cfg.label}
      </div>
      <div className="text-[10px] text-slate-600">{cfg.description}</div>
    </div>
  );
};

export const WeekProgressBar: React.FC<{ subject: string; progress: SubjectWeekProgress }> = ({ subject, progress }) => {
  const pct = progress.new_target > 0
    ? Math.min(100, (progress.new_completed / progress.new_target) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 capitalize w-24 truncate">{subject}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums w-20 text-right">
        {progress.new_completed}/{progress.new_target} new &middot; {progress.reviews_completed} rev
      </span>
    </div>
  );
};
