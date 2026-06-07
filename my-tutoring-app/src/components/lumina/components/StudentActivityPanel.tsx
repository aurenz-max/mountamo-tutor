'use client';

/**
 * StudentActivityPanel — dev/QA view over the student activity log.
 *
 * Reads the durable attempt history + aggregate stats from the (now-live)
 * /api/evaluations/student/{id}/history and /stats routes, so you can see what
 * the engagement pipeline is actually capturing per student: which primitives
 * were used, how they scored, success rate, and XP/level/streak totals.
 *
 * Click any history row to drill into the FULL captured metadata for that
 * attempt — the per-primitive `metrics` blob (goal/efficiency/struggle signals,
 * cross-cutting aiAssistance), plus analysis/feedback/student-work — fetched
 * from the attempt's review via /attempt-detail.
 *
 * This is a dev/QA surface (frame from the Lumina UI kit), not a polished
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
  accentGlow,
  type LuminaAccent,
} from '../ui';
import {
  getEvaluationHistory,
  getEvaluationStats,
  getActivityDetail,
  type ActivityHistoryRow,
  type ActivityStatsResponse,
  type ActivityDetail,
} from '../evaluation';
import { MetricsView } from './MetricsView';

const HISTORY_LIMIT = 100;
const HISTORY_COLUMNS = ['Primitive', 'Mode', 'Score', 'Result', 'Skill', 'Source', 'When', ''];

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

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** A labelled, scrollable pretty-printed JSON block. */
function JsonBlock({ label, value, empty }: { label?: string; value: unknown; empty?: string }) {
  return (
    <div>
      {label && (
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
      )}
      {isEmptyValue(value) ? (
        <p className="text-slate-500 text-sm">{empty ?? '—'}</p>
      ) : (
        <pre className="text-xs text-slate-300 bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto max-h-72">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** The expanded per-attempt metadata detail. */
function AttemptDetail({
  loading,
  error,
  detail,
}: {
  loading: boolean;
  error: string | null;
  detail: ActivityDetail | null;
}) {
  if (loading) return <p className="text-slate-400 text-sm">Loading metadata…</p>;
  if (error) return <p className="text-rose-300 text-sm">{error}</p>;
  if (!detail) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <LuminaStat label="Primitive" value={detail.primitiveType} />
        <LuminaStat label="Eval Mode" value={detail.evalMode} accent="purple" />
        <LuminaStat
          label="Score"
          value={detail.score.toFixed(0)}
          unit="/ 100"
          accent={scoreAccent(detail.score)}
        />
        <LuminaStat
          label="Duration"
          value={detail.durationMs != null ? (detail.durationMs / 1000).toFixed(1) : '—'}
          unit="sec"
        />
      </div>
      <MetricsView
        primitiveType={detail.primitiveType}
        metrics={detail.metrics}
        studentWork={detail.studentWork}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <JsonBlock label="Feedback" value={detail.feedback} />
        <JsonBlock label="Analysis" value={detail.analysis} />
      </div>
      {!isEmptyValue(detail.studentWork) && (
        <details>
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Student Work
          </summary>
          <div className="mt-2">
            <JsonBlock value={detail.studentWork} />
          </div>
        </details>
      )}
    </div>
  );
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

  // Drill-down state
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const studentId = parseInt(studentIdInput, 10);
    if (Number.isNaN(studentId)) {
      setError('Enter a valid numeric student ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setExpandedIndex(null);
    setDetail(null);
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

  const toggleRow = useCallback(
    async (index: number, row: ActivityHistoryRow) => {
      if (expandedIndex === index) {
        setExpandedIndex(null);
        return;
      }
      setExpandedIndex(index);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      const studentId = parseInt(studentIdInput, 10);
      try {
        const d = await getActivityDetail(studentId, {
          subskillId: row.subskillId,
          timestamp: row.completedAt,
          primitiveType: row.primitiveType !== 'unknown' ? row.primitiveType : null,
        });
        setDetail(d);
      } catch (e) {
        console.error('[StudentActivityPanel] detail failed', e);
        setDetailError(e instanceof Error ? e.message : 'Failed to load metadata for this attempt.');
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedIndex, studentIdInput]
  );

  const engagement = stats?.engagement;
  const primitiveRows: React.ReactNode[][] = stats
    ? Object.entries(stats.byPrimitiveType)
        .sort((a, b) => b[1].attempts - a[1].attempts)
        .map(([name, g]) => [name, g.attempts, formatPct(g.successRate), g.averageScore.toFixed(1)])
    : [];

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
            scores, success rate, and XP/level/streak. Click a history row to inspect its full
            captured metadata.
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
                    value={<LuminaBadge accent={TREND_ACCENT[stats.recentTrend]}>{stats.recentTrend}</LuminaBadge>}
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

          {/* History — interactive, drill-down on click */}
          {rows && (
            <div>
              <LuminaSectionLabel>
                History — showing {rows.length} of {total}
                {hasMore ? ' (truncated)' : ''} · click a row for metadata
              </LuminaSectionLabel>
              {rows.length === 0 ? (
                <p className="text-slate-400 text-sm mt-2">No activity recorded for this student.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={accentGlow.purple}>
                        {HISTORY_COLUMNS.map((col, i) => (
                          <th
                            key={i}
                            className={`px-4 py-3 text-left font-medium text-xs uppercase tracking-wide border-b border-white/10 ${accentText.purple}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const isOpen = expandedIndex === i;
                        return (
                          <React.Fragment key={i}>
                            <tr
                              onClick={() => toggleRow(i, r)}
                              className={`cursor-pointer border-b border-white/5 transition-colors ${
                                isOpen ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                              }`}
                            >
                              <td className="px-4 py-3 text-slate-100 font-medium">{r.primitiveType}</td>
                              <td className="px-4 py-3">
                                <LuminaBadge accent="purple">{r.evalMode}</LuminaBadge>
                              </td>
                              <td className={`px-4 py-3 font-semibold ${accentText[scoreAccent(r.score)]}`}>
                                {r.score.toFixed(0)}
                              </td>
                              <td className="px-4 py-3">
                                <LuminaBadge accent={r.success ? 'emerald' : 'rose'}>
                                  {r.success ? 'pass' : 'fail'}
                                </LuminaBadge>
                              </td>
                              <td className="px-4 py-3 text-slate-300">{r.subskillId ?? r.skillId ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-300">{r.source ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-300">{formatWhen(r.completedAt)}</td>
                              <td className="px-4 py-3 text-slate-500">{isOpen ? '▾' : '▸'}</td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={HISTORY_COLUMNS.length} className="bg-black/20 px-4 py-4">
                                  <AttemptDetail loading={detailLoading} error={detailError} detail={detail} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
}
