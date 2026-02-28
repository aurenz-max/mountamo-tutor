'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/authApiClient';

// ---------------------------------------------------------------------------
// Types (mirror backend response schemas)
// ---------------------------------------------------------------------------

interface CheckpointBreakdown {
  checkpoint_2wk: number;
  checkpoint_4wk: number;
  checkpoint_6wk: number;
}

interface ReviewsByCheckpoint {
  checkpoint_2wk: number;
  checkpoint_4wk: number;
  checkpoint_6wk: number;
}

interface SubjectWeeklyStats {
  total_skills: number;
  closed: number;
  in_review: number;
  checkpoints?: CheckpointBreakdown;
  not_started: number;
  expected_by_now: number;
  behind_by: number;
  weekly_new_target: number;
  review_reserve: number;
  avg_ultimate: number;
}

interface WeeklyPlan {
  student_id: string;
  week_of: string;
  school_year: {
    start: string;
    end: string;
    fractionElapsed: number;
    weeksRemaining: number;
  };
  daily_session_capacity: number;
  sustainable_new_per_day: number;
  subjects: Record<string, SubjectWeeklyStats>;
  warnings: string[];
}

interface SessionItem {
  skill_id: string;
  subject: string;
  skill_name: string;
  type: 'review' | 'new';
  reason: string;
  priority: number;
  // interleaving category (PRD §8)
  session_category?: 'tight_loop' | 'interleaved' | 'tail';
  // review fields
  review_session?: number;
  estimated_ultimate?: number;
  completion_factor?: number;
  days_overdue?: number;
  // new skill fields
  prerequisites_met?: boolean;
  // enrichment fields (resolved from curriculum)
  unit_title?: string;
  skill_description?: string;
  subskill_description?: string;
}

interface SubjectWeekProgress {
  new_target: number;
  new_completed: number;
  reviews_completed: number;
}

interface DailyPlan {
  student_id: string;
  date: string;
  day_of_week: string;
  capacity: number;
  review_slots: number;
  new_slots: number;
  week_progress: Record<string, SubjectWeekProgress>;
  sessions: SessionItem[];
  warnings: string[];
}

// Monthly plan types (PRD Section 4.5)
interface ConfidenceBand {
  optimistic: number;
  bestEstimate: number;
  pessimistic: number;
}

interface WeekProjectionData {
  week: number;
  weekOf: string;
  projectedReviewsDue: number;
  projectedReviewsByCheckpoint?: ReviewsByCheckpoint;
  projectedNewIntroductions: number;
  projectedClosures: number;
  projectedOpenInventory: number;
  cumulativeMastered: ConfidenceBand;
}

interface SubjectCurrentState {
  total: number;
  closed: number;
  inReview: number;
  checkpoints?: CheckpointBreakdown;
  notStarted: number;
}

interface EndOfYearProjection {
  closed: number;
  remainingGap: number;
}

interface EndOfYearScenarios {
  optimistic: EndOfYearProjection;
  bestEstimate: EndOfYearProjection;
  pessimistic: EndOfYearProjection;
}

interface MonthlyWarning {
  type: string;
  week: number;
  message: string;
}

interface SubjectMonthlyProjection {
  currentState: SubjectCurrentState;
  weekByWeek: WeekProjectionData[];
  endOfYearProjection: EndOfYearScenarios;
  warnings: MonthlyWarning[];
}

interface MonthlyPlan {
  studentId: string;
  generatedAt: string;
  schoolYear: {
    fractionElapsed: number;
    weeksRemaining: number;
  };
  projections: Record<string, SubjectMonthlyProjection>;
}

// Velocity types (PRD Section 15)
interface VelocityDecomposition {
  introductionVelocity: number;
  passThroughVelocity: number;
  closureVelocity: number;
}

interface PrimaryDriver {
  component: string; // "introduction" | "pass_through" | "closure" | "all_healthy"
  value: number | null;
  explanation: string;
}

interface SubjectVelocity {
  totalSkills: number;
  closed: number;
  inReviewEarned: number;
  earnedMastery: number;
  adjustedExpectedMastery: number;
  velocity: number;
  trend: number[];
  decomposition: VelocityDecomposition;
  primaryDriver: PrimaryDriver;
}

interface VelocityData {
  studentId: string;
  asOfDate: string;
  schoolYear: {
    fractionElapsed: number;
    weeksCompleted: number;
    weeksRemaining: number;
  };
  aggregate: {
    earnedMastery: number;
    adjustedExpectedMastery: number;
    velocity: number;
    trend: number[];
  };
  subjects: Record<string, SubjectVelocity>;
}

// ---------------------------------------------------------------------------
// Sub-components — Weekly & Daily (unchanged)
// ---------------------------------------------------------------------------

const SubjectCard: React.FC<{ name: string; stats: SubjectWeeklyStats }> = ({ name, stats }) => {
  const progress = stats.total_skills > 0
    ? ((stats.closed + stats.in_review) / stats.total_skills) * 100
    : 0;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          {stats.behind_by > 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {Math.round(stats.behind_by)} behind
            </span>
          )}
          {stats.behind_by === 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              on track
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{stats.closed} closed / {stats.total_skills} total</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-lg font-bold text-emerald-400">{stats.closed}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Closed</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-lg font-bold text-blue-400">{stats.in_review}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">In Review</div>
            {stats.checkpoints && (stats.checkpoints.checkpoint_2wk > 0 || stats.checkpoints.checkpoint_4wk > 0 || stats.checkpoints.checkpoint_6wk > 0) && (
              <div className="mt-1.5 flex justify-center gap-1.5 text-[9px]">
                <span className="text-blue-300" title="Awaiting 2-week review">2w:{stats.checkpoints.checkpoint_2wk}</span>
                <span className="text-blue-400" title="Awaiting 4-week review">4w:{stats.checkpoints.checkpoint_4wk}</span>
                <span className="text-blue-500" title="Awaiting 6-week review">6w:{stats.checkpoints.checkpoint_6wk}</span>
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <div className="text-lg font-bold text-slate-400">{stats.not_started}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Not Started</div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-white/5">
          <span>Weekly target: <span className="text-slate-300 font-medium">{stats.weekly_new_target} new</span></span>
          <span>Reserve: <span className="text-slate-300 font-medium">{stats.review_reserve}</span></span>
          <span>Avg ult: <span className="text-slate-300 font-medium">{stats.avg_ultimate.toFixed(1)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
};

const SessionRow: React.FC<{ session: SessionItem }> = ({ session }) => {
  const isReview = session.type === 'review';

  const reasonLabels: Record<string, { label: string; color: string }> = {
    tight_loop_recovery: { label: 'Tight Loop', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
    scheduled_review: { label: 'Scheduled', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    behind_pace: { label: 'Behind Pace', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    next_in_sequence: { label: 'Next Up', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  };
  const reason = reasonLabels[session.reason] || { label: session.reason, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };

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
    </div>
  );
};

const SectionDivider: React.FC<{ category: string }> = ({ category }) => {
  const config: Record<string, { label: string; description: string; color: string; border: string }> = {
    tight_loop: {
      label: 'Priority Recovery',
      description: 'Skills needing immediate reinforcement',
      color: 'text-red-400',
      border: 'border-red-500/30',
    },
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

const WeekProgressBar: React.FC<{ subject: string; progress: SubjectWeekProgress }> = ({ subject, progress }) => {
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

// ---------------------------------------------------------------------------
// Sub-components — Monthly
// ---------------------------------------------------------------------------

const ProjectionChart: React.FC<{ weeks: WeekProjectionData[]; total: number }> = ({ weeks, total }) => {
  if (weeks.length === 0) return null;

  const maxMastered = total || Math.max(...weeks.map(w => w.cumulativeMastered.optimistic), 1);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-2">
        <span>Week-by-week mastery projection</span>
        <span>{total} total skills</span>
      </div>
      <div className="flex gap-[2px] h-32">
        {weeks.map((w) => {
          const optH = (w.cumulativeMastered.optimistic / maxMastered) * 100;
          const bestH = (w.cumulativeMastered.bestEstimate / maxMastered) * 100;
          const pessH = (w.cumulativeMastered.pessimistic / maxMastered) * 100;

          return (
            <div
              key={w.week}
              className="flex-1 h-full relative group"
              title={`Week ${w.week} (${w.weekOf})\nOpt: ${w.cumulativeMastered.optimistic}\nBest: ${w.cumulativeMastered.bestEstimate}\nPess: ${w.cumulativeMastered.pessimistic}`}
            >
              {/* Optimistic bar (lightest, background) */}
              <div
                className="w-full rounded-t-sm bg-emerald-500/15 absolute bottom-0"
                style={{ height: `${optH}%` }}
              />
              {/* Best estimate bar */}
              <div
                className="w-full rounded-t-sm bg-cyan-500/30 absolute bottom-0"
                style={{ height: `${bestH}%` }}
              />
              {/* Pessimistic bar (darkest, foreground) */}
              <div
                className="w-full rounded-t-sm bg-blue-500/50 absolute bottom-0"
                style={{ height: `${pessH}%` }}
              />
              {/* Hover tooltip */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-slate-800 border border-white/10 rounded px-2 py-1 text-[10px] text-slate-300 whitespace-nowrap shadow-lg">
                <div className="font-medium">Wk {w.week}</div>
                <div className="text-emerald-400">Opt: {w.cumulativeMastered.optimistic}</div>
                <div className="text-cyan-400">Best: {w.cumulativeMastered.bestEstimate}</div>
                <div className="text-blue-400">Pess: {w.cumulativeMastered.pessimistic}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-4 justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
          <span className="text-[10px] text-slate-500">Optimistic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-cyan-500/30 border border-cyan-500/40" />
          <span className="text-[10px] text-slate-500">Best est.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-blue-500/50 border border-blue-500/40" />
          <span className="text-[10px] text-slate-500">Pessimistic</span>
        </div>
      </div>
    </div>
  );
};

const EndOfYearCard: React.FC<{ scenarios: EndOfYearScenarios; total: number }> = ({ scenarios, total }) => {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Optimistic</div>
        <div className="text-xl font-bold text-emerald-400">{scenarios.optimistic.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.optimistic.remainingGap > 0
            ? `${scenarios.optimistic.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/60"
            style={{ width: `${total > 0 ? (scenarios.optimistic.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">Best Est.</div>
        <div className="text-xl font-bold text-cyan-400">{scenarios.bestEstimate.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.bestEstimate.remainingGap > 0
            ? `${scenarios.bestEstimate.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500/60"
            style={{ width: `${total > 0 ? (scenarios.bestEstimate.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Pessimistic</div>
        <div className="text-xl font-bold text-blue-400">{scenarios.pessimistic.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.pessimistic.remainingGap > 0
            ? `${scenarios.pessimistic.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500/60"
            style={{ width: `${total > 0 ? (scenarios.pessimistic.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const MonthlyWarningRow: React.FC<{ warning: MonthlyWarning }> = ({ warning }) => {
  const typeConfig: Record<string, { label: string; color: string }> = {
    review_overload_projected: { label: 'Overload', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
    zero_new_capacity_projected: { label: 'No Capacity', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  };
  const cfg = typeConfig[warning.type] || { label: warning.type, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs font-mono text-slate-500 w-10 text-right flex-shrink-0">Wk {warning.week}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] border flex-shrink-0 ${cfg.color}`}>
        {cfg.label}
      </span>
      <span className="text-slate-300">{warning.message}</span>
    </div>
  );
};

const SubjectProjectionCard: React.FC<{ name: string; projection: SubjectMonthlyProjection }> = ({ name, projection }) => {
  const { currentState, weekByWeek, endOfYearProjection, warnings } = projection;
  const total = currentState.total;
  const currentProgress = total > 0 ? ((currentState.closed + currentState.inReview) / total) * 100 : 0;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <span className="text-xs font-normal text-slate-500">
            {currentState.closed}/{total} closed ({Math.round(currentProgress)}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current state summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-white">{total}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-lg font-bold text-emerald-400">{currentState.closed}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Closed</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-lg font-bold text-blue-400">{currentState.inReview}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">In Review</div>
            {currentState.checkpoints && (currentState.checkpoints.checkpoint_2wk > 0 || currentState.checkpoints.checkpoint_4wk > 0 || currentState.checkpoints.checkpoint_6wk > 0) && (
              <div className="mt-1 flex justify-center gap-1.5 text-[9px]">
                <span className="text-blue-300">2w:{currentState.checkpoints.checkpoint_2wk}</span>
                <span className="text-blue-400">4w:{currentState.checkpoints.checkpoint_4wk}</span>
                <span className="text-blue-500">6w:{currentState.checkpoints.checkpoint_6wk}</span>
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <div className="text-lg font-bold text-slate-400">{currentState.notStarted}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Not Started</div>
          </div>
        </div>

        {/* Projection chart */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
          <ProjectionChart weeks={weekByWeek} total={total} />
        </div>

        {/* End of year scenarios */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">End of Year Projection</div>
          <EndOfYearCard scenarios={endOfYearProjection} total={total} />
        </div>

        {/* Week-by-week detail table (collapsible) */}
        {weekByWeek.length > 0 && (
          <WeekByWeekTable weeks={weekByWeek} />
        )}

        {/* Subject warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">Warnings</div>
            {warnings.map((w, i) => (
              <MonthlyWarningRow key={`${w.type}-${w.week}-${i}`} warning={w} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const WeekByWeekTable: React.FC<{ weeks: WeekProjectionData[] }> = ({ weeks }) => {
  const [expanded, setExpanded] = useState(false);
  const displayWeeks = expanded ? weeks : weeks.slice(0, 4);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Week-by-Week Detail</div>
        {weeks.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${weeks.length} weeks`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-white/5">
              <th className="text-left py-1.5 pr-3 font-medium">Wk</th>
              <th className="text-left py-1.5 pr-3 font-medium">Date</th>
              <th className="text-right py-1.5 pr-3 font-medium">
                Reviews
                <span className="block text-[8px] text-slate-600 font-normal">2w/4w/6w</span>
              </th>
              <th className="text-right py-1.5 pr-3 font-medium">New</th>
              <th className="text-right py-1.5 pr-3 font-medium">Closures</th>
              <th className="text-right py-1.5 pr-3 font-medium">Open Inv.</th>
              <th className="text-right py-1.5 font-medium">Mastered</th>
            </tr>
          </thead>
          <tbody>
            {displayWeeks.map((w) => (
              <tr key={w.week} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-1.5 pr-3 text-slate-400 font-mono">{w.week}</td>
                <td className="py-1.5 pr-3 text-slate-400">{w.weekOf}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {w.projectedReviewsByCheckpoint ? (
                    <>
                      <span className="text-blue-300">{w.projectedReviewsByCheckpoint.checkpoint_2wk}</span>
                      <span className="text-slate-600 mx-0.5">/</span>
                      <span className="text-blue-400">{w.projectedReviewsByCheckpoint.checkpoint_4wk}</span>
                      <span className="text-slate-600 mx-0.5">/</span>
                      <span className="text-blue-500">{w.projectedReviewsByCheckpoint.checkpoint_6wk}</span>
                    </>
                  ) : (
                    <span className="text-blue-400">{w.projectedReviewsDue}</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right text-emerald-400 font-mono">{w.projectedNewIntroductions}</td>
                <td className="py-1.5 pr-3 text-right text-cyan-400 font-mono">{w.projectedClosures}</td>
                <td className="py-1.5 pr-3 text-right text-slate-300 font-mono">{w.projectedOpenInventory}</td>
                <td className="py-1.5 text-right font-mono">
                  <span className="text-emerald-400">{w.cumulativeMastered.optimistic}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-cyan-400">{w.cumulativeMastered.bestEstimate}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-blue-400">{w.cumulativeMastered.pessimistic}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components — Velocity (PRD Section 15)
// ---------------------------------------------------------------------------

const getVelocityColor = (velocity: number): { text: string; bg: string; border: string; label: string } => {
  if (velocity >= 1.2) return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Well Ahead' };
  if (velocity >= 1.0) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'On Track' };
  if (velocity >= 0.8) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Slightly Behind' };
  if (velocity >= 0.6) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Behind' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critically Behind' };
};

const getVelocityGradient = (velocity: number): string => {
  if (velocity >= 1.2) return 'from-blue-500 to-cyan-400';
  if (velocity >= 1.0) return 'from-emerald-500 to-green-400';
  if (velocity >= 0.8) return 'from-amber-500 to-yellow-400';
  if (velocity >= 0.6) return 'from-orange-500 to-amber-400';
  return 'from-red-500 to-orange-400';
};

const VelocityGauge: React.FC<{ velocity: number; label: string; size?: 'lg' | 'sm' }> = ({ velocity, label, size = 'sm' }) => {
  const color = getVelocityColor(velocity);
  const pct = Math.min(velocity * 100, 200);
  const displayPct = Math.round(velocity * 100);
  const isLarge = size === 'lg';

  return (
    <div className={`text-center ${isLarge ? 'p-4' : 'p-3'} rounded-xl ${color.bg} border ${color.border}`}>
      <div className={`${isLarge ? 'text-4xl' : 'text-2xl'} font-bold ${color.text} font-mono`}>
        {displayPct}%
      </div>
      <div className={`${isLarge ? 'text-sm' : 'text-[10px]'} text-slate-500 uppercase tracking-wider mt-1`}>
        {label}
      </div>
      <div className={`mt-2 ${isLarge ? 'h-2' : 'h-1.5'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getVelocityGradient(velocity)} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className={`mt-1 text-[10px] ${color.text}`}>{color.label}</div>
    </div>
  );
};

const TrendSparkline: React.FC<{ trend: number[]; height?: number }> = ({ trend, height = 32 }) => {
  if (trend.length < 2) return <span className="text-[10px] text-slate-600">No trend data</span>;

  const min = Math.min(...trend) * 0.9;
  const max = Math.max(...trend) * 1.1;
  const range = max - min || 1;
  const w = 100;
  const stepX = w / (trend.length - 1);

  const points = trend.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = trend[trend.length - 1];
  const prevVal = trend[trend.length - 2];
  const trendDir = lastVal > prevVal ? 'text-emerald-400' : lastVal < prevVal ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-24 h-8" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-400"
        />
        {/* Dots at each point */}
        {trend.map((v, i) => {
          const x = i * stepX;
          const y = height - ((v - min) / range) * height;
          return <circle key={i} cx={x} cy={y} r="1.5" className="fill-cyan-400" />;
        })}
      </svg>
      <span className={`text-xs font-mono ${trendDir}`}>
        {lastVal > prevVal ? '+' : ''}{Math.round((lastVal - prevVal) * 100)}%
      </span>
    </div>
  );
};

const DecompositionBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = getVelocityColor(value);
  const pct = Math.min(value * 100, 200);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono ${color.text}`}>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getVelocityGradient(value)} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

const driverLabels: Record<string, string> = {
  introduction: 'Introduction',
  pass_through: 'Pass-through',
  closure: 'Closure',
  all_healthy: 'All healthy',
};

const SubjectVelocityCard: React.FC<{ name: string; data: SubjectVelocity }> = ({ name, data }) => {
  const color = getVelocityColor(data.velocity);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
            {color.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge + Trend row */}
        <div className="flex items-center gap-4">
          <VelocityGauge velocity={data.velocity} label="Velocity" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Earned: <span className="text-slate-200 font-mono">{data.earnedMastery}</span></span>
              <span>Expected: <span className="text-slate-200 font-mono">{data.adjustedExpectedMastery}</span></span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Closed: <span className="text-emerald-400 font-mono">{data.closed}</span></span>
              <span>Pipeline: <span className="text-blue-400 font-mono">+{data.inReviewEarned.toFixed(1)}</span></span>
              <span>Total: <span className="text-slate-200 font-mono">{data.totalSkills}</span></span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Trend</span>
              <TrendSparkline trend={data.trend} />
            </div>
          </div>
        </div>

        {/* Decomposition */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5 space-y-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Velocity Decomposition</div>
          <DecompositionBar label="Introduction" value={data.decomposition.introductionVelocity} />
          <DecompositionBar label="Pass-through" value={data.decomposition.passThroughVelocity} />
          <DecompositionBar label="Closure" value={data.decomposition.closureVelocity} />
        </div>

        {/* Primary driver callout */}
        <div className={`p-3 rounded-lg border ${
          data.primaryDriver.component === 'all_healthy'
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              data.primaryDriver.component === 'all_healthy' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              Primary Driver: {driverLabels[data.primaryDriver.component] || data.primaryDriver.component}
            </span>
            {data.primaryDriver.value !== null && (
              <span className={`text-xs font-mono ${getVelocityColor(data.primaryDriver.value).text}`}>
                ({Math.round(data.primaryDriver.value * 100)}%)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{data.primaryDriver.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

interface PlannerDashboardProps {
  onBack: () => void;
}

export const PlannerDashboard: React.FC<PlannerDashboardProps> = ({ onBack }) => {
  const [studentId, setStudentId] = useState('1');
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [velocityData, setVelocityData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState<'idle' | 'weekly' | 'daily' | 'monthly' | 'velocity' | 'all'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily' | 'monthly' | 'velocity'>('weekly');

  const fetchWeeklyPlan = async () => {
    setLoading('weekly');
    setError(null);
    try {
      const data = await authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`);
      setWeeklyPlan(data);
    } catch (e: any) {
      setError(`Weekly plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchDailyPlan = async () => {
    setLoading('daily');
    setError(null);
    try {
      const data = await authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`);
      setDailyPlan(data);
    } catch (e: any) {
      setError(`Daily plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchMonthlyPlan = async () => {
    setLoading('monthly');
    setError(null);
    try {
      const data = await authApi.get<MonthlyPlan>(`/api/weekly-planner/${studentId}/monthly`);
      setMonthlyPlan(data);
    } catch (e: any) {
      setError(`Monthly plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchVelocity = async () => {
    setLoading('velocity');
    setError(null);
    try {
      const data = await authApi.get<VelocityData>(`/api/velocity/${studentId}`);
      setVelocityData(data);
    } catch (e: any) {
      setError(`Velocity error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchAll = async () => {
    setLoading('all');
    setError(null);
    try {
      const [weekly, daily, monthly, velocity] = await Promise.allSettled([
        authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`),
        authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`),
        authApi.get<MonthlyPlan>(`/api/weekly-planner/${studentId}/monthly`),
        authApi.get<VelocityData>(`/api/velocity/${studentId}`),
      ]);

      const errors: string[] = [];
      if (weekly.status === 'fulfilled') setWeeklyPlan(weekly.value);
      else errors.push(`Weekly: ${weekly.reason?.message}`);

      if (daily.status === 'fulfilled') setDailyPlan(daily.value);
      else errors.push(`Daily: ${daily.reason?.message}`);

      if (monthly.status === 'fulfilled') setMonthlyPlan(monthly.value);
      else errors.push(`Monthly: ${monthly.reason?.message}`);

      if (velocity.status === 'fulfilled') setVelocityData(velocity.value);
      else errors.push(`Velocity: ${velocity.reason?.message}`);

      if (errors.length > 0) setError(errors.join('\n'));
    } finally {
      setLoading('idle');
    }
  };

  // ---- Render ----

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
            Planner Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Weekly pacing + daily session router + monthly projection (Firestore-native)
          </p>
        </div>
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
          onClick={onBack}
        >
          Back
        </Button>
      </div>

      {/* Controls */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Student ID</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/60 border border-white/10 rounded-lg text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                placeholder="e.g. 1"
              />
            </div>
            <Button
              variant="ghost"
              className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={fetchWeeklyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'weekly' ? 'Loading...' : 'Fetch Weekly'}
            </Button>
            <Button
              variant="ghost"
              className="bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-300"
              onClick={fetchDailyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'daily' ? 'Loading...' : 'Fetch Daily'}
            </Button>
            <Button
              variant="ghost"
              className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
              onClick={fetchMonthlyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'monthly' ? 'Loading...' : 'Fetch Monthly'}
            </Button>
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={fetchVelocity}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'velocity' ? 'Loading...' : 'Fetch Velocity'}
            </Button>
            <Button
              variant="ghost"
              className="bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300"
              onClick={fetchAll}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'all' ? 'Loading...' : 'Fetch All'}
            </Button>
            <Button
              variant="ghost"
              className={`border text-xs ${showRawJson ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
              onClick={() => setShowRawJson(!showRawJson)}
            >
              {showRawJson ? 'Hide JSON' : 'Raw JSON'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/30">
          <CardContent className="pt-6">
            <pre className="text-red-400 text-sm whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 rounded-lg border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'weekly'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Weekly Plan {weeklyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'daily'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Daily Plan {dailyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'monthly'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Monthly Projection {monthlyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('velocity')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'velocity'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Velocity {velocityData && '(loaded)'}
        </button>
      </div>

      {/* ================================================================ */}
      {/* WEEKLY TAB                                                        */}
      {/* ================================================================ */}
      {activeTab === 'weekly' && (
        <div className="space-y-6 animate-fade-in">
          {!weeklyPlan && loading !== 'weekly' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Weekly&quot; to load the weekly pacing snapshot.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'weekly' || loading === 'all') && !weeklyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading weekly plan...</div>
              </CardContent>
            </Card>
          )}

          {weeklyPlan && (
            <>
              {/* School Year Overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">School Year Pacing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">
                        {Math.round((weeklyPlan.school_year.fractionElapsed || 0) * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{weeklyPlan.school_year.weeksRemaining}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Weeks Left</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-cyan-400">{weeklyPlan.daily_session_capacity}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Daily Capacity</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-emerald-400">{weeklyPlan.sustainable_new_per_day.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Sustainable New/Day</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>Week of: {weeklyPlan.week_of}</span>
                    <span>{weeklyPlan.school_year.start} → {weeklyPlan.school_year.end}</span>
                  </div>
                  {/* Year progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${(weeklyPlan.school_year.fractionElapsed || 0) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {weeklyPlan.warnings && weeklyPlan.warnings.length > 0 && (
                <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                  <CardContent className="pt-6">
                    <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
                    <ul className="space-y-1">
                      {weeklyPlan.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-300/80">{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Subject Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(weeklyPlan.subjects).map(([name, stats]) => (
                  <SubjectCard key={name} name={name} stats={stats} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && weeklyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Weekly Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(weeklyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* DAILY TAB                                                         */}
      {/* ================================================================ */}
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-fade-in">
          {!dailyPlan && loading !== 'daily' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Daily&quot; to load today&apos;s session queue.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'daily' || loading === 'all') && !dailyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading daily plan...</div>
              </CardContent>
            </Card>
          )}

          {dailyPlan && (
            <>
              {/* Daily overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {dailyPlan.day_of_week}, {dailyPlan.date}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{dailyPlan.capacity}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Capacity</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">{dailyPlan.review_slots}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Review Slots</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-2xl font-bold text-emerald-400">{dailyPlan.new_slots}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">New Slots</div>
                    </div>
                  </div>

                  {/* Interleaving category breakdown */}
                  {dailyPlan.sessions.some(s => s.session_category) && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-white/5 text-center">
                      <div className="flex-1 p-2 rounded-lg bg-red-500/5">
                        <div className="text-sm font-bold text-red-400">
                          {dailyPlan.sessions.filter(s => s.session_category === 'tight_loop').length}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">Recovery</div>
                      </div>
                      <div className="flex-1 p-2 rounded-lg bg-cyan-500/5">
                        <div className="text-sm font-bold text-cyan-400">
                          {dailyPlan.sessions.filter(s => s.session_category === 'interleaved').length}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">Core</div>
                      </div>
                      <div className="flex-1 p-2 rounded-lg bg-slate-500/5">
                        <div className="text-sm font-bold text-slate-400">
                          {dailyPlan.sessions.filter(s => s.session_category === 'tail').length}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">Cool Down</div>
                      </div>
                    </div>
                  )}

                  {/* Week progress */}
                  {Object.keys(dailyPlan.week_progress).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Week Progress</div>
                      {Object.entries(dailyPlan.week_progress).map(([subject, progress]) => (
                        <WeekProgressBar key={subject} subject={subject} progress={progress} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Warnings */}
              {dailyPlan.warnings && dailyPlan.warnings.length > 0 && (
                <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                  <CardContent className="pt-6">
                    <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
                    <ul className="space-y-1">
                      {dailyPlan.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-300/80">{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Session Queue */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Session Queue ({dailyPlan.sessions.length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyPlan.sessions.length === 0 ? (
                    <p className="text-slate-500 text-sm py-4 text-center">No sessions scheduled.</p>
                  ) : (
                    <div className="space-y-2">
                      {dailyPlan.sessions.map((session, i) => {
                        const prevCategory = i > 0 ? dailyPlan.sessions[i - 1].session_category : null;
                        const showDivider = session.session_category && session.session_category !== prevCategory;

                        return (
                          <React.Fragment key={`${session.skill_id}-${i}`}>
                            {showDivider && <SectionDivider category={session.session_category!} />}
                            <SessionRow session={session} />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && dailyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Daily Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(dailyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* MONTHLY TAB                                                       */}
      {/* ================================================================ */}
      {activeTab === 'monthly' && (
        <div className="space-y-6 animate-fade-in">
          {!monthlyPlan && loading !== 'monthly' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Monthly&quot; to load the forward projection.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'monthly' || loading === 'all') && !monthlyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Running forward simulation...</div>
              </CardContent>
            </Card>
          )}

          {monthlyPlan && (
            <>
              {/* School Year Overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Monthly Forward Projection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">
                        {Math.round((monthlyPlan.schoolYear.fractionElapsed || 0) * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{monthlyPlan.schoolYear.weeksRemaining}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Weeks Remaining</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-amber-400">
                        {Object.keys(monthlyPlan.projections).length}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subjects Projected</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 text-right">
                    Generated: {new Date(monthlyPlan.generatedAt).toLocaleString()}
                  </div>
                  {/* Year progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${(monthlyPlan.schoolYear.fractionElapsed || 0) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Aggregate warnings across all subjects */}
              {(() => {
                const allWarnings = Object.entries(monthlyPlan.projections).flatMap(
                  ([subj, proj]) => proj.warnings.map(w => ({ ...w, subject: subj }))
                );
                if (allWarnings.length === 0) return null;
                return (
                  <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                    <CardContent className="pt-6">
                      <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                        Projected Warnings ({allWarnings.length})
                      </div>
                      <div className="space-y-2">
                        {allWarnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="text-xs text-slate-500 capitalize w-24 truncate flex-shrink-0">{w.subject}</span>
                            <MonthlyWarningRow warning={w} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Per-subject projection cards */}
              <div className="space-y-6">
                {Object.entries(monthlyPlan.projections).map(([name, projection]) => (
                  <SubjectProjectionCard key={name} name={name} projection={projection} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && monthlyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Monthly Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(monthlyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* VELOCITY TAB (PRD Section 15)                                    */}
      {/* ================================================================ */}
      {activeTab === 'velocity' && (
        <div className="space-y-6 animate-fade-in">
          {!velocityData && loading !== 'velocity' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Velocity&quot; to load the mastery velocity report.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'velocity' || loading === 'all') && !velocityData && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Computing pipeline-adjusted velocity...</div>
              </CardContent>
            </Card>
          )}

          {velocityData && (
            <>
              {/* Aggregate velocity overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Mastery Velocity — Pipeline-Adjusted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Headline gauge */}
                    <VelocityGauge velocity={velocityData.aggregate.velocity} label="Overall Velocity" size="lg" />

                    {/* Earned vs Expected */}
                    <div className="flex flex-col justify-center space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Earned Mastery</span>
                        <span className="text-white font-mono font-bold">{velocityData.aggregate.earnedMastery}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Expected Mastery</span>
                        <span className="text-white font-mono font-bold">{velocityData.aggregate.adjustedExpectedMastery}</span>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">8-Week Trend</span>
                          <TrendSparkline trend={velocityData.aggregate.trend} />
                        </div>
                      </div>
                    </div>

                    {/* School year context */}
                    <div className="flex flex-col justify-center space-y-2">
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold text-white">
                          {Math.round(velocityData.schoolYear.fractionElapsed * 100)}%
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white/5">
                          <div className="text-lg font-bold text-white">{velocityData.schoolYear.weeksCompleted}</div>
                          <div className="text-[9px] text-slate-500 uppercase">Wks Done</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/5">
                          <div className="text-lg font-bold text-white">{velocityData.schoolYear.weeksRemaining}</div>
                          <div className="text-[9px] text-slate-500 uppercase">Wks Left</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>As of: {velocityData.asOfDate}</span>
                    <span>
                      Velocity = Earned ({velocityData.aggregate.earnedMastery}) / Expected ({velocityData.aggregate.adjustedExpectedMastery})
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Per-subject velocity gauges (compact row) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(velocityData.subjects).map(([name, subj]) => (
                  <VelocityGauge key={name} velocity={subj.velocity} label={name} />
                ))}
              </div>

              {/* Per-subject detailed cards */}
              <div className="space-y-4">
                {Object.entries(velocityData.subjects).map(([name, subj]) => (
                  <SubjectVelocityCard key={name} name={name} data={subj} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && velocityData && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Velocity — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(velocityData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
