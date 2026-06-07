'use client';

/**
 * StudentActivityPanel — dev/QA view over the student activity log.
 *
 * Reads the durable attempt history + aggregate stats from the (now-live)
 * /api/evaluations/student/{id}/history and /stats routes, so you can see what
 * the engagement pipeline is actually capturing per student: which primitives
 * were used, how they scored, success rate, and XP/level/streak totals.
 *
 * This is a dev/QA surface (frame from the Lumina UI kit) — not a polished
 * student-facing view. It's the input to the eventual activity-log PRD.
 */

import React, { useCallback, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaButton,
  LuminaInput,
  LuminaBadge,
  LuminaStat,
  LuminaTable,
  LuminaSectionLabel,
  accentText,
  type LuminaAccent,
} from '../ui';
import {
  getEvaluationHistory,
  getEvaluationStats,
  type ActivityHistoryRow,
  type ActivityStatsResponse,
} from '../evaluation';

const HISTORY_LIMIT = 100;

const TREND_ACCENT: Record<ActivityStatsResponse['recentTrend'], LuminaAccent> = {
  improving: 'emerald',
  stable: 'cyan',
  declining: 'rose',
};

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function scoreAccent(score: number): LuminaAccent {
  if (score >= 80) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

export interface StudentActivityPanelProps {
  /** Pre-fill the student ID input. */
  defaultStudentId?: number;
  /** Return to the dev launcher. When omitted, the back link is hidden. */
  onBack?: () => void;
}

export default function StudentActivityPanel({ defaultStudentId, onBack }: StudentActivityPanelProps) {
  const [studentIdInput, setStudentIdInput] = useState(
    defaultStudentId != null ? String(defaultStudentId) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityHistoryRow[] | null>(null);
  const [stats, setStats] = useState<ActivityStatsResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    const studentId = parseInt(studentIdInput, 10);
    if (Number.isNaN(studentId)) {
      setError('Enter a valid numeric student ID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [history, statsResp] = await Promise.all([
        getEvaluationHistory(studentId, { limit: HISTORY_LIMIT }),
        getEvaluationStats(studentId),
      ]);
      setRows(history.evaluations);
      setTotal(history.total);
      setHasMore(history.hasMore);
      setStats(statsResp);
    } catch (e) {
      console.error('[StudentActivityPanel] load failed', e);
      setError(e instanceof Error ? e.message : 'Failed to load student activity.');
      setRows(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [studentIdInput]);

  const engagement = stats?.engagement;
  const primitiveRows: React.ReactNode[][] = stats
    ? Object.entries(stats.byPrimitiveType)
        .sort((a, b) => b[1].attempts - a[1].attempts)
        .map(([name, g]) => [
          name,
          g.attempts,
          formatPct(g.successRate),
          g.averageScore.toFixed(1),
        ])
    : [];

  const historyRows: React.ReactNode[][] = (rows ?? []).map((r) => [
    r.primitiveType,
    <LuminaBadge key="mode" accent="purple">{r.evalMode}</LuminaBadge>,
    <span key="score" className={`font-semibold ${accentText[scoreAccent(r.score)]}`}>
      {r.score.toFixed(0)}
    </span>,
    <LuminaBadge key="ok" accent={r.success ? 'emerald' : 'rose'}>
      {r.success ? 'pass' : 'fail'}
    </LuminaBadge>,
    r.subskillId ?? r.skillId ?? '—',
    r.source ?? '—',
    formatWhen(r.completedAt),
  ]);

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back
        </button>
      )}
      <LuminaCard className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-5xl">
      <LuminaCardHeader>
        <LuminaCardTitle>Student Activity Log</LuminaCardTitle>
        <LuminaCardDescription>
          Dev/QA view of what the engagement pipeline captures per student — primitives used,
          scores, success rate, and XP/level/streak.
        </LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6">
        {/* Controls */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Student ID
            </label>
            <LuminaInput
              type="number"
              inputMode="numeric"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
              placeholder="e.g. 1001"
              className="w-40"
            />
          </div>
          <LuminaButton tone="primary" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Load activity'}
          </LuminaButton>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Engagement totals */}
            <div>
              <LuminaSectionLabel>Engagement</LuminaSectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                <LuminaStat label="Total XP" value={engagement?.totalXp ?? '—'} accent="cyan" />
                <LuminaStat label="Level" value={engagement?.currentLevel ?? '—'} accent="purple" />
                <LuminaStat label="Streak" value={engagement?.currentStreak ?? '—'} unit="days" accent="amber" />
              </div>
            </div>

            {/* Activity aggregates */}
            <div>
              <LuminaSectionLabel>Activity</LuminaSectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <LuminaStat label="Attempts" value={stats.totalAttempts} />
                <LuminaStat label="Success Rate" value={formatPct(stats.successRate)} accent="emerald" />
                <LuminaStat label="Avg Score" value={stats.averageScore.toFixed(1)} unit="/ 100" />
                <LuminaStat
                  label="Recent Trend"
                  value={
                    <LuminaBadge accent={TREND_ACCENT[stats.recentTrend]}>
                      {stats.recentTrend}
                    </LuminaBadge>
                  }
                />
              </div>
            </div>

            {/* Per-primitive breakdown */}
            {primitiveRows.length > 0 && (
              <div>
                <LuminaSectionLabel>By Primitive</LuminaSectionLabel>
                <LuminaTable
                  className="mt-2"
                  accent="cyan"
                  columns={['Primitive', 'Attempts', 'Success Rate', 'Avg Score']}
                  rows={primitiveRows}
                />
              </div>
            )}
          </>
        )}

        {/* History */}
        {rows && (
          <div>
            <LuminaSectionLabel>
              History — showing {rows.length} of {total}
              {hasMore ? ' (truncated)' : ''}
            </LuminaSectionLabel>
            {rows.length === 0 ? (
              <p className="text-slate-400 text-sm mt-2">No activity recorded for this student.</p>
            ) : (
              <LuminaTable
                className="mt-2"
                accent="purple"
                columns={['Primitive', 'Mode', 'Score', 'Result', 'Skill', 'Source', 'When']}
                rows={historyRows}
              />
            )}
          </div>
        )}
      </LuminaCardContent>
      </LuminaCard>
    </div>
  );
}
