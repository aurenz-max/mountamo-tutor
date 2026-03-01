'use client';

import React, { useState, useCallback, useRef } from 'react';
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

// Mastery lifecycle types (PRD Section 6.2)
interface SubskillMasteryEntry {
  subskill_id: string;
  skill_id: string;
  current_gate: number;
  completion_pct: number;
  passes: number;
  fails: number;
}

interface SubjectMasterySummary {
  total: number;
  fully_mastered: number;
  average_completion_pct: number;
  by_gate: Record<string, number>;
  subskills: SubskillMasteryEntry[];
}

interface MasterySummary {
  student_id: number;
  total_subskills: number;
  by_gate: Record<string, number>;
  average_completion_pct: number;
  fully_mastered: number;
  global_practice_pass_rate: number;
  by_subject: Record<string, SubjectMasterySummary>;
  queried_at: string;
}

interface SubskillForecast {
  subskill_id: string;
  skill_id: string;
  subject: string;
  current_gate?: number;
  completion_pct?: number;
  estimated_remaining_attempts?: number;
  estimated_days: number;
  status: 'mastered' | 'in_progress';
}

interface UnitForecast {
  subject: string;
  max_eta_days: number;
  subskill_count: number;
  mastered_count: number;
}

interface MasteryForecast {
  student_id: number;
  subskill_forecasts: SubskillForecast[];
  by_unit: Record<string, UnitForecast>;
  by_subject: Record<string, { estimated_days: number }>;
  queried_at: string;
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
// Sub-components — Mastery Lifecycle (PRD Section 6.2)
// ---------------------------------------------------------------------------

const GATE_LABELS = ['Not Started', 'Initial Mastery', 'Retest 1', 'Retest 2', 'Durable Mastery'];
const GATE_COLORS = [
  'bg-slate-600',
  'bg-amber-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-emerald-500',
];

const GateProgressDots: React.FC<{ gate: number }> = ({ gate }) => (
  <div className="flex items-center gap-1">
    {[0, 1, 2, 3, 4].map((g) => (
      <div
        key={g}
        className={`w-2.5 h-2.5 rounded-full transition-colors ${
          g <= gate ? GATE_COLORS[g] : 'bg-slate-700 border border-slate-600'
        }`}
        title={`Gate ${g}: ${GATE_LABELS[g]}`}
      />
    ))}
    <span className="ml-1.5 text-[10px] text-slate-500 font-mono">{gate}/4</span>
  </div>
);

const GateDistributionBar: React.FC<{ byGate: Record<string, number>; total: number }> = ({ byGate, total }) => {
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full overflow-hidden flex">
        {[4, 3, 2, 1, 0].map((g) => {
          const count = byGate[String(g)] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={g}
              className={`h-full ${GATE_COLORS[g]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`Gate ${g} (${GATE_LABELS[g]}): ${count}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-500">
        {[0, 1, 2, 3, 4].map((g) => (
          <span key={g} className="flex items-center gap-0.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${GATE_COLORS[g]}`} />
            {byGate[String(g)] || 0}
          </span>
        ))}
      </div>
    </div>
  );
};

const SubskillMasteryRow: React.FC<{ entry: SubskillMasteryEntry; forecast?: SubskillForecast }> = ({ entry, forecast }) => {
  const completionPct = Math.round(entry.completion_pct * 100);
  const total = entry.passes + entry.fails;
  const passRate = total > 0 ? Math.round((entry.passes / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-white/5 hover:border-white/10 transition-colors">
      <GateProgressDots gate={entry.current_gate} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{entry.subskill_id}</div>
        <div className="text-[10px] text-slate-500">{entry.skill_id}</div>
      </div>

      {/* Completion bar */}
      <div className="w-24 flex-shrink-0">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 text-right mt-0.5 font-mono">{completionPct}%</div>
      </div>

      {/* Pass/fail stats */}
      <div className="text-right flex-shrink-0 hidden sm:block w-16">
        <div className="text-xs text-slate-400 font-mono">{entry.passes}P/{entry.fails}F</div>
        <div className="text-[10px] text-slate-500">{passRate}% pass</div>
      </div>

      {/* ETA */}
      {forecast && forecast.status === 'in_progress' && (
        <div className="text-right flex-shrink-0 hidden md:block w-16">
          <div className="text-xs text-amber-400 font-mono">{forecast.estimated_days}d</div>
          <div className="text-[10px] text-slate-500">{forecast.estimated_remaining_attempts} left</div>
        </div>
      )}
      {forecast && forecast.status === 'mastered' && (
        <div className="text-right flex-shrink-0 hidden md:block w-16">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Mastered
          </span>
        </div>
      )}
    </div>
  );
};

const SubjectMasteryCard: React.FC<{
  name: string;
  summary: SubjectMasterySummary;
  forecasts: SubskillForecast[];
  subjectEta?: { estimated_days: number };
}> = ({ name, summary, forecasts, subjectEta }) => {
  const completionPct = Math.round(summary.average_completion_pct * 100);
  const [expanded, setExpanded] = useState(false);

  const forecastMap = new Map(forecasts.map(f => [f.subskill_id, f]));
  const displaySubskills = expanded ? summary.subskills : summary.subskills.slice(0, 5);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <div className="flex items-center gap-2">
            {subjectEta && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ~{Math.round(subjectEta.estimated_days)}d remaining
              </span>
            )}
            <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${
              summary.fully_mastered === summary.total
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}>
              {summary.fully_mastered}/{summary.total} mastered
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Actuarial completion factor</span>
            <span className="font-mono">{completionPct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Gate distribution */}
        <GateDistributionBar byGate={summary.by_gate} total={summary.total} />

        {/* Subskill rows */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            Subskills ({summary.subskills.length})
          </div>
          {displaySubskills.map((entry) => (
            <SubskillMasteryRow
              key={entry.subskill_id}
              entry={entry}
              forecast={forecastMap.get(entry.subskill_id)}
            />
          ))}
          {summary.subskills.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors py-1"
            >
              {expanded ? 'Show less' : `Show all ${summary.subskills.length} subskills`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const UnitForecastRow: React.FC<{ unitId: string; data: UnitForecast }> = ({ unitId, data }) => {
  const masteredPct = data.subskill_count > 0
    ? Math.round((data.mastered_count / data.subskill_count) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-white/5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{unitId}</div>
        <div className="text-[10px] text-slate-500 capitalize">{data.subject}</div>
      </div>
      <div className="w-20 flex-shrink-0">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
            style={{ width: `${masteredPct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 text-right mt-0.5">
          {data.mastered_count}/{data.subskill_count}
        </div>
      </div>
      <div className="text-right flex-shrink-0 w-16">
        {data.max_eta_days > 0 ? (
          <div className="text-xs text-amber-400 font-mono">{Math.round(data.max_eta_days)}d</div>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Done
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component — Mastery Seed Panel (curriculum picker)
// ---------------------------------------------------------------------------

interface CurrSubskill {
  id: string;
  description: string;
}

interface CurrSkill {
  id: string;
  description: string;
  subskills: CurrSubskill[];
}

interface CurrUnit {
  id: string;
  title: string;
  skills: CurrSkill[];
}

interface SeedQueueItem {
  subject: string;
  skill_id: string;
  subskill_id: string;
  subskill_label: string;
  target_gate: number;
}

const MasterySeedPanel: React.FC<{
  studentId: string;
  loading: boolean;
  onSeeded: () => void;
  onError: (msg: string) => void;
  onLoadingChange: (loading: boolean) => void;
}> = ({ studentId, loading, onSeeded, onError, onLoadingChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<CurrUnit[]>([]);
  const [loadingCurr, setLoadingCurr] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [seedQueue, setSeedQueue] = useState<SeedQueueItem[]>([]);
  const [defaultGate, setDefaultGate] = useState(2);
  const [seeding, setSeeding] = useState(false);
  const currCache = useRef<Map<string, CurrUnit[]>>(new Map());

  const loadSubjects = useCallback(async () => {
    try {
      const result = await authApi.getSubjects() as (string | { subject_name: string })[];
      const names = (Array.isArray(result) ? result : []).map(s =>
        typeof s === 'string' ? s : s.subject_name
      );
      setSubjects(names);
    } catch {
      onError('Failed to load subjects');
    }
  }, [onError]);

  const loadCurriculum = useCallback(async (subject: string) => {
    const cached = currCache.current.get(subject);
    if (cached) {
      setCurriculum(cached);
      return;
    }
    setLoadingCurr(true);
    try {
      const data = await authApi.getSubjectCurriculum(subject) as { curriculum: CurrUnit[] };
      currCache.current.set(subject, data.curriculum);
      setCurriculum(data.curriculum);
    } catch {
      onError(`Failed to load ${subject} curriculum`);
    } finally {
      setLoadingCurr(false);
    }
  }, [onError]);

  const handleExpand = async () => {
    setExpanded(!expanded);
    if (!expanded && subjects.length === 0) {
      await loadSubjects();
    }
  };

  const handleSubjectClick = async (subject: string) => {
    if (subject === selectedSubject) {
      setSelectedSubject(null);
      setCurriculum([]);
      return;
    }
    setSelectedSubject(subject);
    setExpandedSkills(new Set());
    await loadCurriculum(subject);
  };

  const toggleSkill = (skillId: string) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const addToQueue = (subject: string, skill: CurrSkill, sub: CurrSubskill) => {
    if (seedQueue.some(q => q.subskill_id === sub.id)) return; // no duplicates
    setSeedQueue(prev => [...prev, {
      subject,
      skill_id: skill.id,
      subskill_id: sub.id,
      subskill_label: sub.description,
      target_gate: defaultGate,
    }]);
  };

  const removeFromQueue = (subskillId: string) => {
    setSeedQueue(prev => prev.filter(q => q.subskill_id !== subskillId));
  };

  const updateQueueGate = (subskillId: string, gate: number) => {
    setSeedQueue(prev => prev.map(q =>
      q.subskill_id === subskillId ? { ...q, target_gate: gate } : q
    ));
  };

  const seedSelected = async () => {
    if (seedQueue.length === 0) return;
    setSeeding(true);
    onLoadingChange(true);
    try {
      await authApi.post(`/api/mastery/debug/seed/${studentId}`, {
        subskills: seedQueue.map(q => ({
          subject: q.subject,
          skill_id: q.skill_id,
          subskill_id: q.subskill_id,
          target_gate: q.target_gate,
        })),
      });
      setSeedQueue([]);
      onSeeded();
    } catch (e: any) {
      onError(`Seed error: ${e.message}`);
    } finally {
      setSeeding(false);
      onLoadingChange(false);
    }
  };

  const queuedIds = new Set(seedQueue.map(q => q.subskill_id));

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <button
          onClick={handleExpand}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Custom Seed — Curriculum Picker
          </CardTitle>
          <span className={`text-slate-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Default gate selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Default target gate:</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(g => (
                <button
                  key={g}
                  onClick={() => setDefaultGate(g)}
                  className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
                    defaultGate === g
                      ? `${GATE_COLORS[g]} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">{GATE_LABELS[defaultGate]}</span>
          </div>

          {/* Subject pills */}
          {subjects.length === 0 ? (
            <div className="text-center">
              <span className="text-xs text-slate-500">Loading subjects...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map(subj => (
                <button
                  key={subj}
                  onClick={() => handleSubjectClick(subj)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    selectedSubject === subj
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                      : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}

          {/* Curriculum tree */}
          {loadingCurr && (
            <div className="text-center py-4">
              <span className="text-xs text-slate-400 animate-pulse">Loading curriculum...</span>
            </div>
          )}

          {!loadingCurr && curriculum.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {curriculum.map(unit => (
                <div key={unit.id} className="space-y-1">
                  <div className="text-xs font-semibold text-slate-300 px-2 py-1 bg-white/5 rounded">
                    {unit.title}
                  </div>
                  {unit.skills.map(skill => (
                    <div key={skill.id} className="ml-2">
                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className="w-full text-left px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <span className={`transition-transform ${expandedSkills.has(skill.id) ? 'rotate-90' : ''}`}>
                          ▸
                        </span>
                        <span className="flex-1 truncate">{skill.description}</span>
                        <span className="text-slate-600 text-[10px]">{skill.subskills.length}</span>
                      </button>
                      {expandedSkills.has(skill.id) && (
                        <div className="ml-4 space-y-0.5">
                          {skill.subskills.map(sub => {
                            const queued = queuedIds.has(sub.id);
                            return (
                              <button
                                key={sub.id}
                                onClick={() => !queued && selectedSubject && addToQueue(selectedSubject, skill, sub)}
                                disabled={queued}
                                className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-2 transition-all ${
                                  queued
                                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                                    : 'text-slate-400 hover:bg-violet-500/10 hover:text-violet-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${queued ? 'bg-violet-400' : 'bg-slate-600'}`} />
                                <span className="flex-1 truncate">{sub.description}</span>
                                {queued && <span className="text-[9px] text-violet-400">added</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Seed queue */}
          {seedQueue.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Seed Queue ({seedQueue.length} subskills)
                </span>
                <button
                  onClick={() => setSeedQueue([])}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {seedQueue.map(item => (
                  <div key={item.subskill_id} className="flex items-center gap-2 p-1.5 rounded bg-slate-800/30 border border-white/5">
                    <span className="flex-1 text-[11px] text-slate-300 truncate" title={item.subskill_id}>
                      {item.subskill_label}
                    </span>
                    <span className="text-[9px] text-slate-500 capitalize flex-shrink-0">{item.subject}</span>
                    {/* Per-item gate selector */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[0, 1, 2, 3, 4].map(g => (
                        <button
                          key={g}
                          onClick={() => updateQueueGate(item.subskill_id, g)}
                          className={`w-5 h-5 rounded text-[9px] font-mono transition-colors ${
                            item.target_gate === g
                              ? `${GATE_COLORS[g]} text-white`
                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => removeFromQueue(item.subskill_id)}
                      className="text-red-400 hover:text-red-300 text-xs flex-shrink-0 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
                onClick={seedSelected}
                disabled={seeding || loading || seedQueue.length === 0}
              >
                {seeding ? 'Seeding...' : `Seed ${seedQueue.length} Subskills`}
              </Button>
            </div>
          )}
        </CardContent>
      )}
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
  const [masterySummary, setMasterySummary] = useState<MasterySummary | null>(null);
  const [masteryForecast, setMasteryForecast] = useState<MasteryForecast | null>(null);
  const [loading, setLoading] = useState<'idle' | 'weekly' | 'daily' | 'monthly' | 'velocity' | 'mastery' | 'all'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily' | 'monthly' | 'velocity' | 'mastery'>('weekly');

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

  const fetchMastery = async () => {
    setLoading('mastery');
    setError(null);
    try {
      const [summary, forecast] = await Promise.all([
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
      ]);
      setMasterySummary(summary);
      setMasteryForecast(forecast);
    } catch (e: any) {
      setError(`Mastery error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const seedMasteryData = async () => {
    setLoading('mastery');
    setError(null);
    try {
      await authApi.post(`/api/mastery/debug/seed/${studentId}`, {});
      // Re-fetch after seeding
      const [summary, forecast] = await Promise.all([
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
      ]);
      setMasterySummary(summary);
      setMasteryForecast(forecast);
    } catch (e: any) {
      setError(`Seed error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchAll = async () => {
    setLoading('all');
    setError(null);
    try {
      const [weekly, daily, monthly, velocity, mSummary, mForecast] = await Promise.allSettled([
        authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`),
        authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`),
        authApi.get<MonthlyPlan>(`/api/weekly-planner/${studentId}/monthly`),
        authApi.get<VelocityData>(`/api/velocity/${studentId}`),
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
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

      if (mSummary.status === 'fulfilled') setMasterySummary(mSummary.value);
      else errors.push(`Mastery Summary: ${mSummary.reason?.message}`);

      if (mForecast.status === 'fulfilled') setMasteryForecast(mForecast.value);
      else errors.push(`Mastery Forecast: ${mForecast.reason?.message}`);

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
              className="bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
              onClick={fetchMastery}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'mastery' ? 'Loading...' : 'Fetch Mastery'}
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
        <button
          onClick={() => setActiveTab('mastery')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'mastery'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Mastery {masterySummary && '(loaded)'}
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

      {/* ================================================================ */}
      {/* MASTERY TAB (PRD Section 6.2 — 4-Gate Lifecycle)                */}
      {/* ================================================================ */}
      {activeTab === 'mastery' && (
        <div className="space-y-6 animate-fade-in">
          {!masterySummary && loading !== 'mastery' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center space-y-4">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Mastery&quot; to load the 4-gate mastery lifecycle.</p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="ghost"
                    className="bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
                    onClick={fetchMastery}
                    disabled={loading !== 'idle' || !studentId}
                  >
                    Fetch Mastery
                  </Button>
                  <Button
                    variant="ghost"
                    className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
                    onClick={seedMasteryData}
                    disabled={loading !== 'idle' || !studentId}
                  >
                    Seed Demo Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Curriculum seed picker — always visible when no data loaded */}
          {!masterySummary && loading !== 'mastery' && loading !== 'all' && (
            <MasterySeedPanel
              studentId={studentId}
              loading={loading !== 'idle'}
              onSeeded={fetchMastery}
              onError={(msg) => setError(msg)}
              onLoadingChange={(isLoading) => setLoading(isLoading ? 'mastery' : 'idle')}
            />
          )}

          {(loading === 'mastery' || loading === 'all') && !masterySummary && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading mastery lifecycle data...</div>
              </CardContent>
            </Card>
          )}

          {masterySummary && (
            <>
              {/* Overview card */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Mastery Lifecycle Overview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs h-7 px-3"
                    onClick={seedMasteryData}
                    disabled={loading !== 'idle'}
                  >
                    {loading === 'mastery' ? 'Seeding...' : 'Seed Demo Data'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{masterySummary.total_subskills}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subskills Tracked</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-2xl font-bold text-emerald-400">{masterySummary.fully_mastered}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Fully Mastered</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="text-2xl font-bold text-cyan-400">
                        {Math.round(masterySummary.average_completion_pct * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Avg Completion</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">
                        {Math.round(masterySummary.global_practice_pass_rate * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Global Pass Rate</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-2xl font-bold text-amber-400">
                        {Object.keys(masterySummary.by_subject).length}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subjects</div>
                    </div>
                  </div>

                  {/* Overall gate distribution */}
                  <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Gate Distribution (All Subjects)</div>
                    <GateDistributionBar byGate={masterySummary.by_gate} total={masterySummary.total_subskills} />
                  </div>

                  {/* Gate legend */}
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {GATE_LABELS.map((label, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${GATE_COLORS[i]}`} />
                        <span className="text-[10px] text-slate-500">G{i}: {label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500 text-right">
                    Queried: {masterySummary.queried_at ? new Date(masterySummary.queried_at).toLocaleString() : '—'}
                  </div>
                </CardContent>
              </Card>

              {/* Curriculum-based seed picker */}
              <MasterySeedPanel
                studentId={studentId}
                loading={loading !== 'idle'}
                onSeeded={fetchMastery}
                onError={(msg) => setError(msg)}
                onLoadingChange={(isLoading) => setLoading(isLoading ? 'mastery' : 'idle')}
              />

              {/* Forecast summary by subject */}
              {masteryForecast && Object.keys(masteryForecast.by_subject).length > 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Subject ETAs (Workload Forecast)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(masteryForecast.by_subject).map(([subj, data]) => (
                        <div key={subj} className="text-center p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 capitalize">{subj}</div>
                          <div className="text-2xl font-bold text-amber-400 font-mono">
                            {Math.round(data.estimated_days)}d
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">estimated remaining</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unit-level forecast */}
              {masteryForecast && Object.keys(masteryForecast.by_unit).length > 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Unit Forecasts ({Object.keys(masteryForecast.by_unit).length} units)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Object.entries(masteryForecast.by_unit).map(([unitId, data]) => (
                        <UnitForecastRow key={unitId} unitId={unitId} data={data} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-subject mastery cards */}
              <div className="space-y-6">
                {Object.entries(masterySummary.by_subject).map(([name, summary]) => (
                  <SubjectMasteryCard
                    key={name}
                    name={name}
                    summary={summary}
                    forecasts={masteryForecast?.subskill_forecasts.filter(f => f.subject === name) || []}
                    subjectEta={masteryForecast?.by_subject[name]}
                  />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && masterySummary && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Mastery Summary — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(masterySummary, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {showRawJson && masteryForecast && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Mastery Forecast — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(masteryForecast, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
