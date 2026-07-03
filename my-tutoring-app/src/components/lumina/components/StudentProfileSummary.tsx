'use client';

/**
 * StudentProfileSummary — the at-a-glance header card for the student profile
 * view (MyProgressPanel), fed by ONE call to the canonical profile endpoint
 * (GET /api/analytics/student/{id}/profile via analyticsApi.getStudentProfile).
 *
 * Renders:
 *   - Level / XP / streak from the stored engagement values (the single
 *     source — null when viewing another student, tiles hide gracefully)
 *   - This week's activity from the daily-rollups window
 *   - Per-subject lifetime totals + mastery progress from the skill state
 */

import React, { useEffect, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaStat,
  LuminaProgress,
  LuminaSectionLabel,
  LuminaBadge,
  type LuminaAccent,
} from '../ui';
import { analyticsApi, type StudentProfileResponse } from '@/lib/studentAnalyticsAPI';

export interface StudentProfileSummaryProps {
  /** The signed-in student to load. */
  studentId: number;
  /** Window for the "this week" block, in days. */
  days?: number;
}

/** "LANGUAGE_ARTS" → "Language Arts" (subject keys are canonical uppercase). */
const prettySubject = (key: string, name?: string): string => {
  const source = name && name === name.toLowerCase() ? key : (name ?? key);
  return source
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
};

const scoreAccent = (avg: number): LuminaAccent =>
  avg >= 8 ? 'emerald' : avg >= 5 ? 'amber' : 'rose';

export default function StudentProfileSummary({ studentId, days = 7 }: StudentProfileSummaryProps) {
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyticsApi
      .getStudentProfile(studentId, { days })
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, days]);

  if (loading) {
    return <div className="h-44 w-full animate-pulse rounded-2xl border border-white/10 bg-slate-900/40" />;
  }
  if (error || !profile) {
    // Quiet failure — the panels below still work without the summary.
    return null;
  }

  const { engagement, totals, recent, skill_state } = profile;

  // Join lifetime totals with skill state by canonical subject key.
  const stateByKey = new Map(skill_state.subjects.map((s) => [s.key, s]));
  const subjects = totals.subjects
    .filter((s) => s.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts);

  return (
    <LuminaCard topAccent="cyan">
      <LuminaCardContent className="pt-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <LuminaSectionLabel accent="cyan">Snapshot</LuminaSectionLabel>
          {engagement && (
            <LuminaBadge accent="purple">Level {engagement.current_level}</LuminaBadge>
          )}
          {engagement && engagement.current_streak > 1 && (
            <LuminaBadge accent="amber">{engagement.current_streak}-day streak</LuminaBadge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {engagement ? (
            <LuminaStat label="Total XP" value={engagement.total_xp.toLocaleString()} accent="purple" />
          ) : (
            <LuminaStat label="Problems solved" value={totals.total_attempts.toLocaleString()} accent="purple" />
          )}
          <LuminaStat
            label="Avg score"
            value={totals.avg_score.toFixed(1)}
            unit="out of 10"
            accent={scoreAccent(totals.avg_score)}
          />
          <LuminaStat
            label="This week"
            value={recent.total_attempts}
            unit={`problems · ${recent.total_active_days} active day${recent.total_active_days === 1 ? '' : 's'}`}
            accent="emerald"
          />
          <LuminaStat
            label="Skills explored"
            value={skill_state.subjects.reduce((n, s) => n + s.subskills, 0)}
            unit={`${skill_state.subjects.reduce((n, s) => n + (s.states['mastered'] ?? 0), 0)} mastered`}
            accent="cyan"
          />
        </div>

        {subjects.length > 0 && (
          <div className="space-y-2.5">
            {subjects.map((s) => {
              const state = stateByKey.get(s.key);
              const touched = state?.subskills ?? 0;
              const mastered = state?.states['mastered'] ?? 0;
              const pct = touched > 0 ? Math.round((mastered / touched) * 100) : 0;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm text-slate-100">
                    {prettySubject(s.key, s.name)}
                  </span>
                  <LuminaProgress value={pct} accent={pct >= 50 ? 'emerald' : 'cyan'} className="flex-1" />
                  <span className="w-40 shrink-0 text-right text-xs text-slate-400">
                    {touched > 0 ? `${mastered} of ${touched} skills mastered` : `${s.attempts} problems`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
