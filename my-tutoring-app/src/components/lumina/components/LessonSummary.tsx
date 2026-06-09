'use client';

/**
 * LessonSummary — end-of-lesson "What you demonstrated" surface.
 *
 * Renders a CTA at the bottom of a lesson and, on click, a Lumina-native modal
 * with two layers of truth:
 *
 *   1. An achievement banner — the real shape of the work the student did this
 *      session: activities completed, accuracy, first-try rate, time on task,
 *      and the XP / level / streak they earned. Sourced from the session's raw
 *      submissions + accumulated engagement, NOT from the curriculum mapping.
 *
 *   2. Per-subject curriculum skill cards — which curriculum skills the lesson
 *      exercised, each listing every activity that contributed to it. On a
 *      free-typed lesson ("Trash Trucks") only the backend topic→curriculum
 *      mapping knows this, so we surface what it resolved.
 *
 * Why two layers: the curriculum mapping dedupes many activities down to a few
 * subskills (6 problems → 2 skills), which made the old summary read as thin.
 * The banner restores the felt volume of work; the skill cards keep the
 * curriculum meaning and now show their contributing activities so the depth is
 * visible.
 *
 * Self-contained: reads the context directly, so it must render INSIDE the
 * EvaluationProvider tree (alongside EvaluationResultsIndicator).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useEvaluationContext } from '../evaluation';
import type { DemonstratedSkill, PrimitiveEvaluationResult } from '../evaluation';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaSectionLabel,
  accentText,
  type LuminaAccent,
} from '../ui';

// ── Helpers ──────────────────────────────────────────────────────

function humanize(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreAccent(score: number): LuminaAccent {
  if (score >= 80) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Best-effort "got it on the first try" derivation from a primitive's metrics.
 * Metric shapes vary by primitive, so we probe the common aggregate fields in
 * priority order and fall back to a perfect-and-successful proxy.
 */
function isFirstTry(result?: PrimitiveEvaluationResult): boolean {
  if (!result) return false;
  const m = result.metrics as unknown as Record<string, unknown> | undefined;
  const num = (k: string): number | undefined =>
    typeof m?.[k] === 'number' ? (m[k] as number) : undefined;

  const firstTryCount = num('firstTryCount');
  const totalChallenges = num('totalChallenges');
  if (firstTryCount !== undefined && totalChallenges !== undefined && totalChallenges > 0) {
    return firstTryCount === totalChallenges;
  }
  const attempts = num('attempts');
  if (attempts !== undefined) return attempts === 1 && result.success;
  const attemptsCount = num('attemptsCount');
  if (attemptsCount !== undefined && totalChallenges !== undefined && totalChallenges > 0) {
    return attemptsCount === totalChallenges;
  }
  const attemptCount = num('attemptCount');
  if (attemptCount !== undefined) return attemptCount === 1 && result.success;
  return result.success && result.score >= 100;
}

// ── Derived shapes ───────────────────────────────────────────────

interface ActivityContribution {
  attemptId: string;
  primitiveType: string;
  score: number;
  success: boolean;
  firstTry: boolean;
}

interface SkillGroup {
  subskillId: string;
  subject: string;
  unitTitle?: string;
  skillDescription: string;
  subskillDescription: string;
  contributions: ActivityContribution[];
  avgScore: number;
  firstTryCount: number;
  demonstrated: boolean;
}

interface LessonStats {
  activities: number;
  accuracy: number; // 0–100, share of activities scored correct
  firstTryCount: number;
  totalTimeMs: number;
}

/** One row of the bottom "by activity type" rollup. */
interface PrimitiveBreakdown {
  primitiveType: string;
  attempts: number;
  avgScore: number;
  successCount: number;
}

/**
 * Aggregate the raw submissions by primitive type — the felt "what did I
 * actually play with" view, independent of the curriculum mapping. Ordered by
 * volume (most-practiced first); first-seen order breaks ties.
 */
function computePrimitiveBreakdown(results: PrimitiveEvaluationResult[]): PrimitiveBreakdown[] {
  const order: string[] = [];
  const byType = new Map<string, { scoreSum: number; attempts: number; successCount: number }>();
  for (const r of results) {
    const type = r.primitiveType;
    let agg = byType.get(type);
    if (!agg) {
      agg = { scoreSum: 0, attempts: 0, successCount: 0 };
      byType.set(type, agg);
      order.push(type);
    }
    agg.scoreSum += r.score;
    agg.attempts += 1;
    if (r.success) agg.successCount += 1;
  }
  return order
    .map((primitiveType) => {
      const agg = byType.get(primitiveType)!;
      return {
        primitiveType,
        attempts: agg.attempts,
        avgScore: agg.attempts > 0 ? Math.round(agg.scoreSum / agg.attempts) : 0,
        successCount: agg.successCount,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

/** Roll the raw submissions up into the banner's headline stats. */
function computeStats(results: PrimitiveEvaluationResult[]): LessonStats {
  const activities = results.length;
  const correct = results.filter((r) => r.success).length;
  const firstTryCount = results.filter((r) => isFirstTry(r)).length;
  const totalTimeMs = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  return {
    activities,
    accuracy: activities > 0 ? Math.round((correct / activities) * 100) : 0,
    firstTryCount,
    totalTimeMs,
  };
}

/**
 * Group the append-only skill log by subject, then by subskill, attaching each
 * contributing activity (deduped by attemptId, enriched with first-try from the
 * matching raw submission). Subjects and skills preserve first-seen order.
 */
function buildSkillGroups(
  log: DemonstratedSkill[],
  resultByAttempt: Map<string, PrimitiveEvaluationResult>,
): Array<[string, SkillGroup[]]> {
  const subjectOrder: string[] = [];
  const bySubject = new Map<string, Map<string, SkillGroup>>();

  for (const entry of log) {
    const subject = entry.subject || 'general';
    if (!bySubject.has(subject)) {
      bySubject.set(subject, new Map());
      subjectOrder.push(subject);
    }
    const skills = bySubject.get(subject)!;
    let group = skills.get(entry.subskillId);
    if (!group) {
      group = {
        subskillId: entry.subskillId,
        subject,
        unitTitle: entry.unitTitle || undefined,
        skillDescription: entry.skillDescription,
        subskillDescription: entry.subskillDescription,
        contributions: [],
        avgScore: 0,
        firstTryCount: 0,
        demonstrated: false,
      };
      skills.set(entry.subskillId, group);
    }
    if (group.contributions.some((c) => c.attemptId === entry.attemptId)) continue;
    group.contributions.push({
      attemptId: entry.attemptId,
      primitiveType: entry.primitiveType,
      score: entry.score,
      success: entry.success,
      firstTry: isFirstTry(resultByAttempt.get(entry.attemptId)),
    });
  }

  // Finalize aggregates.
  Array.from(bySubject.values()).forEach((skills) => {
    Array.from(skills.values()).forEach((group) => {
      const n = group.contributions.length;
      const sum = group.contributions.reduce((s, c) => s + c.score, 0);
      const successCount = group.contributions.filter((c) => c.success).length;
      group.avgScore = n > 0 ? Math.round(sum / n) : 0;
      group.firstTryCount = group.contributions.filter((c) => c.firstTry).length;
      group.demonstrated = n > 0 && successCount >= Math.ceil(n / 2);
    });
  });

  return subjectOrder.map(
    (subject) => [subject, Array.from(bySubject.get(subject)!.values())] as [string, SkillGroup[]],
  );
}

// ── Sub-components ────────────────────────────────────────────────

const StatTile: React.FC<{ value: React.ReactNode; label: string; accent?: LuminaAccent }> = ({
  value,
  label,
  accent,
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 px-3 py-4 text-center">
    <span className={`text-2xl font-bold ${accent ? accentText[accent] : 'text-slate-100'}`}>
      {value}
    </span>
    <span className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{label}</span>
  </div>
);

const ActivityRow: React.FC<{ activity: ActivityContribution }> = ({ activity }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
    <span className="text-sm text-slate-300 truncate">{humanize(activity.primitiveType)}</span>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {activity.firstTry && (
        <span className="text-amber-400 text-sm" title="First try!">
          {'★'}
        </span>
      )}
      <span className={`text-sm font-mono font-bold ${accentText[scoreAccent(activity.score)]}`}>
        {Math.round(activity.score)}
      </span>
    </div>
  </div>
);

const SkillCard: React.FC<{ group: SkillGroup }> = ({ group }) => {
  const n = group.contributions.length;
  const firstTryLabel =
    group.firstTryCount === n
      ? 'all first try'
      : group.firstTryCount > 0
        ? `${group.firstTryCount} of ${n} first try`
        : null;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
      {group.unitTitle && (
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-1">
          {group.unitTitle}
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-slate-100 font-semibold">{group.skillDescription}</div>
          {group.subskillDescription && (
            <div className="text-sm text-slate-400 leading-snug mt-0.5">
              {group.subskillDescription}
            </div>
          )}
          <div className="text-xs text-slate-500 mt-1.5">
            {n} {n === 1 ? 'activity' : 'activities'}
            {firstTryLabel && <span className="text-slate-600"> {'·'} {firstTryLabel}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-lg font-bold ${accentText[scoreAccent(group.avgScore)]}`}>
            {group.avgScore}
          </span>
          <LuminaBadge accent={group.demonstrated ? 'emerald' : 'amber'}>
            {group.demonstrated ? 'demonstrated' : 'practiced'}
          </LuminaBadge>
        </div>
      </div>

      {/* Contributing activities — always shown so every card names the
          primitive(s) it was demonstrated through, and multi-activity skills
          reveal the depth the curriculum dedup hides. */}
      <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
        {group.contributions.map((a) => (
          <ActivityRow key={a.attemptId} activity={a} />
        ))}
      </div>
    </div>
  );
};

const PrimitiveBreakdownRow: React.FC<{ row: PrimitiveBreakdown }> = ({ row }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
    <span className="text-sm text-slate-300 truncate">{humanize(row.primitiveType)}</span>
    <div className="flex items-center gap-3 flex-shrink-0">
      <span className="text-xs text-slate-500">
        {row.attempts} {row.attempts === 1 ? 'activity' : 'activities'}
      </span>
      <span className={`text-sm font-mono font-bold ${accentText[scoreAccent(row.avgScore)]}`}>
        {row.avgScore}
      </span>
    </div>
  </div>
);

const LessonSummaryModal: React.FC<{
  stats: LessonStats;
  groups: Array<[string, SkillGroup[]]>;
  breakdown: PrimitiveBreakdown[];
  engagement: { xpEarned: number; level: number; leveledUp: boolean; streak: number };
  topic?: string;
  onClose: () => void;
}> = ({ stats, groups, breakdown, engagement, topic, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const skillCount = groups.reduce((sum, [, skills]) => sum + skills.length, 0);
  const subjectCount = groups.length;
  const showXp = engagement.xpEarned > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-summary-title"
    >
      <LuminaCard
        className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto backdrop-blur-xl bg-slate-900/80 border-white/10 shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <LuminaCardContent className="space-y-6 p-8">
          {/* Hero */}
          <div className="text-center space-y-2">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
              Lesson Review
            </div>
            <h2 id="lesson-summary-title" className="text-3xl font-bold text-slate-100">
              What you demonstrated
            </h2>
            <p className="text-sm text-slate-400">
              {topic ? (
                <>
                  While exploring <span className="text-slate-200 font-medium">{topic}</span>, you
                </>
              ) : (
                'You'
              )}{' '}
              completed{' '}
              <span className="text-slate-200 font-medium">
                {stats.activities} {stats.activities === 1 ? 'activity' : 'activities'}
              </span>
              {skillCount > 0 && (
                <>
                  {' '}
                  across{' '}
                  <span className="text-slate-200 font-medium">
                    {skillCount} skill{skillCount === 1 ? '' : 's'}
                  </span>
                </>
              )}
              {subjectCount > 1 && (
                <>
                  {' '}
                  in <span className="text-slate-200 font-medium">{subjectCount} subjects</span>
                </>
              )}
              .
            </p>
          </div>

          {/* Achievement banner — the real shape of the work. */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/40 to-slate-900/30 p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile value={stats.activities} label="Activities" />
              <StatTile
                value={`${stats.accuracy}%`}
                label="Accuracy"
                accent={scoreAccent(stats.accuracy)}
              />
              <StatTile
                value={`${stats.firstTryCount}/${stats.activities}`}
                label="First try"
                accent={stats.firstTryCount === stats.activities ? 'emerald' : undefined}
              />
              <StatTile value={formatDuration(stats.totalTimeMs)} label="Time" />
            </div>

            {(showXp || engagement.streak > 1) && (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                {showXp && (
                  <span className="font-semibold text-cyan-300">
                    {'✦'} +{engagement.xpEarned} XP
                  </span>
                )}
                {engagement.level > 0 && (
                  <span className="text-slate-400">
                    {'·'} {engagement.leveledUp && <span className="text-emerald-300 font-medium">Level up! </span>}
                    Level {engagement.level}
                  </span>
                )}
                {engagement.streak > 1 && (
                  <span className="text-amber-300">
                    {'·'} {'🔥'} {engagement.streak} day streak
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Per-subject curriculum skill groups */}
          {groups.length > 0 && (
            <div className="space-y-5">
              {groups.map(([subject, skills]) => (
                <div key={subject}>
                  <LuminaSectionLabel>{humanize(subject)}</LuminaSectionLabel>
                  <div className="mt-2 space-y-2">
                    {skills.map((g) => (
                      <SkillCard key={g.subskillId} group={g} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* By-activity rollup — the felt "what did I play with" view, grouped
              by primitive independent of the curriculum mapping. */}
          {breakdown.length > 0 && (
            <div>
              <LuminaSectionLabel>By activity</LuminaSectionLabel>
              <div className="mt-2 space-y-1">
                {breakdown.map((row) => (
                  <PrimitiveBreakdownRow key={row.primitiveType} row={row} />
                ))}
              </div>
            </div>
          )}

          <LuminaButton tone="primary" className="w-full" onClick={onClose}>
            Done
          </LuminaButton>
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

/**
 * The bottom-of-lesson CTA + summary modal. Renders nothing until the student
 * has completed at least one activity this session.
 */
export const LessonSummary: React.FC = () => {
  const context = useEvaluationContext();
  const [open, setOpen] = useState(false);

  const results = context?.submittedResults ?? [];
  const log = context?.demonstratedSkillLog ?? [];
  const engagement = context?.sessionEngagement ?? {
    xpEarned: 0,
    level: 0,
    leveledUp: false,
    streak: 0,
  };

  const stats = useMemo(() => computeStats(results), [results]);
  const breakdown = useMemo(() => computePrimitiveBreakdown(results), [results]);
  const groups = useMemo(() => {
    const resultByAttempt = new Map(results.map((r) => [r.attemptId, r]));
    return buildSkillGroups(log, resultByAttempt);
  }, [log, results]);

  // Nothing completed yet (or a tester harness with no provider) → render nothing.
  if (stats.activities === 0 && log.length === 0) return null;

  const skillCount = groups.reduce((sum, [, skills]) => sum + skills.length, 0);
  const subjectCount = groups.length;

  return (
    <div className="mt-16 mb-8 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/40 to-slate-900/40 p-6 text-center backdrop-blur-xl">
        <p className="text-sm text-slate-400">
          You completed{' '}
          <span className="text-slate-100 font-semibold">
            {stats.activities} {stats.activities === 1 ? 'activity' : 'activities'}
          </span>
          {skillCount > 0 && (
            <>
              {' '}
              and demonstrated{' '}
              <span className="text-slate-100 font-semibold">
                {skillCount} skill{skillCount === 1 ? '' : 's'}
              </span>
            </>
          )}
          {subjectCount > 1 && (
            <>
              {' '}
              across <span className="text-slate-100 font-semibold">{subjectCount} subjects</span>
            </>
          )}{' '}
          in this lesson.
        </p>
        <LuminaButton tone="primary" className="mt-4" onClick={() => setOpen(true)}>
          Review what you learned
        </LuminaButton>
      </div>

      {open && (
        <LessonSummaryModal
          stats={stats}
          groups={groups}
          breakdown={breakdown}
          engagement={engagement}
          topic={context?.topic}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default LessonSummary;
