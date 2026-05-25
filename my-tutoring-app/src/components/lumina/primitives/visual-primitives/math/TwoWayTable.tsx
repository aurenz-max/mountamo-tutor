'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TwoWayTableMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types — canonical interface re-exported from the generator
// ============================================================================

export type TwoWayTableChallengeType =
  | 'joint_probability'
  | 'marginal_distribution'
  | 'conditional_probability'
  | 'independence_test';

export interface TwoWayTableChallenge {
  id: string;
  challengeType: TwoWayTableChallengeType;
  scenario: string;
  rowLabel: string;
  columnLabel: string;
  rowCategories: string[];
  columnCategories: string[];
  frequencies: number[][];
  question: string;
  expectedProbability: number;
  tolerance: number;
  showTotals: boolean;
  hint: string;
}

export interface TwoWayTableData {
  title: string;
  description: string;
  challenges: TwoWayTableChallenge[];
  challengeType: TwoWayTableChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'statistics';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TwoWayTableMetrics>) => void;
}

// ============================================================================
// Phase config (one row per challenge type)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  joint_probability:       { label: 'Joint',       icon: '∩', accentColor: 'purple' },
  marginal_distribution:   { label: 'Marginal',    icon: 'Σ', accentColor: 'amber' },
  conditional_probability: { label: 'Conditional', icon: '|', accentColor: 'blue' },
  independence_test:       { label: 'Independence', icon: '⊥', accentColor: 'emerald' },
};

// ============================================================================
// Helpers
// ============================================================================

function phaseScore(attempts: number): number {
  return Math.max(20, 100 - (Math.max(0, attempts - 1) * 20));
}

function parseProbabilityInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // Accept percentage form ("25%" or "25") if input ends with %.
  if (s.endsWith('%')) {
    const v = parseFloat(s.slice(0, -1));
    return Number.isFinite(v) ? v / 100 : null;
  }
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return null;
  // If value is > 1, treat as a percentage entered without the %.
  return v > 1 ? v / 100 : v;
}

function formatProbability(p: number): string {
  return p.toFixed(2);
}

// ============================================================================
// Frequency Table Renderer (read-only with mode-gated totals)
// ============================================================================

interface FrequencyTableProps {
  challenge: TwoWayTableChallenge;
}

const FrequencyTable: React.FC<FrequencyTableProps> = ({ challenge }) => {
  const {
    rowLabel,
    columnLabel,
    rowCategories,
    columnCategories,
    frequencies,
    showTotals,
  } = challenge;

  const rowTotals = useMemo(
    () => frequencies.map((row) => row.reduce((s, v) => s + v, 0)),
    [frequencies],
  );

  const columnTotals = useMemo(
    () =>
      columnCategories.map((_, c) =>
        frequencies.reduce((s, row) => s + (row[c] ?? 0), 0),
      ),
    [frequencies, columnCategories],
  );

  const grandTotal = useMemo(
    () => rowTotals.reduce((s, v) => s + v, 0),
    [rowTotals],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs uppercase tracking-wider text-slate-500">
              <span className="font-mono text-slate-400">{rowLabel}</span>
              <span className="px-2 text-slate-600">/</span>
              <span className="font-mono text-slate-400">{columnLabel}</span>
            </th>
            {columnCategories.map((col, ci) => (
              <th
                key={ci}
                className="p-2 text-center font-semibold text-purple-200 border-b border-white/10"
              >
                {col}
              </th>
            ))}
            {showTotals && (
              <th className="p-2 text-center font-semibold text-amber-300 border-b border-white/10 border-l-2 border-l-white/20">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {frequencies.map((row, ri) => (
            <tr key={ri} className="border-t border-white/5">
              <td className="p-2 font-semibold text-blue-200 border-r border-white/10">
                {rowCategories[ri]}
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="p-2 text-center font-mono text-base text-white border border-white/5"
                >
                  {cell}
                </td>
              ))}
              {showTotals && (
                <td className="p-2 text-center font-mono text-amber-200 font-bold border-l-2 border-l-white/20">
                  {rowTotals[ri]}
                </td>
              )}
            </tr>
          ))}
          {showTotals && (
            <tr className="border-t-2 border-t-white/20 bg-slate-900/50">
              <td className="p-2 font-semibold text-amber-300 border-r border-white/10">
                Total
              </td>
              {columnTotals.map((t, ci) => (
                <td
                  key={ci}
                  className="p-2 text-center font-mono text-amber-200 font-bold"
                >
                  {t}
                </td>
              ))}
              <td className="p-2 text-center font-mono text-purple-200 font-bold text-lg border-l-2 border-l-white/20">
                {grandTotal}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!showTotals && (
        <p className="mt-2 text-xs text-slate-500 italic">
          Row, column, and grand totals are hidden for this challenge — compute the totals you need from the cells.
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Component
// ============================================================================

interface TwoWayTableProps {
  data: TwoWayTableData;
  className?: string;
}

const TwoWayTable: React.FC<TwoWayTableProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges,
    challengeType: sessionChallengeType,
    educationalContext,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `two-way-table-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<TwoWayTableMetrics>({
    primitiveType: 'two-way-table',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Challenge progression ─────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const currentChallenge = challenges[currentIndex];

  // ── Per-challenge state ───────────────────────────────────────────
  const [answerInput, setAnswerInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);

  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const submittedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // ── Reset per-challenge state on advance ──────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aggregate score (live preview) ────────────────────────────────
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const sum = challengeResults.reduce(
      (s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)),
      0,
    );
    return Math.round(sum / challengeResults.length);
  }, [challengeResults]);

  // ── Phase results for the summary panel ───────────────────────────
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => {
      if (rs.length === 0) return 0;
      const sum = rs.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
      return Math.round(sum / rs.length);
    },
  });

  const [submittedResult, setSubmittedResult] =
    useState<PrimitiveEvaluationResult<TwoWayTableMetrics> | null>(null);

  // ── Session-complete: submit aggregate evaluation exactly once ────
  useEffect(() => {
    if (!allChallengesComplete) return;
    if (submittedRef.current) return;
    if (hasSubmitted) return;
    submittedRef.current = true;

    const totalChallenges = challengeResults.length;
    const overallAccuracy = totalChallenges > 0
      ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / totalChallenges)
      : 0;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const hintsViewed = challengeResults.filter((r) => Boolean(r.hintViewed)).length;
    const averageAttemptsPerChallenge = totalChallenges > 0
      ? Math.round((attemptsCount / totalChallenges) * 10) / 10
      : 0;

    const metrics: TwoWayTableMetrics = {
      type: 'two-way-table',
      challengeType: sessionChallengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    const result = submitResult(overallAccuracy >= 60, overallAccuracy, metrics);
    setSubmittedResult(result);
  }, [allChallengesComplete, challengeResults, hasSubmitted, sessionChallengeType, submitResult]);

  // ── Check answer ──────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    if (feedback?.correct) return;

    const parsed = parseProbabilityInput(answerInput);
    if (parsed === null) {
      setFeedback({
        correct: false,
        message: 'Please enter a decimal between 0 and 1 (e.g., 0.25).',
      });
      return;
    }

    const attempts = currentAttempts + 1;
    incrementAttempts();

    const correct = Math.abs(parsed - currentChallenge.expectedProbability) <= currentChallenge.tolerance;

    if (correct) {
      const score = phaseScore(attempts);
      setFeedback({
        correct: true,
        message: `Correct! P = ${formatProbability(currentChallenge.expectedProbability)} (+${score} points)`,
      });
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score,
        challengeType: currentChallenge.challengeType,
        hintViewed: hintViewedRef.current,
      });
    } else {
      setFeedback({
        correct: false,
        message: attempts === 1
          ? 'Not quite — re-check which counts go into the numerator and denominator.'
          : `Still off. Try the hint, or check your division.`,
      });
    }
  }, [
    currentChallenge,
    currentAttempts,
    feedback,
    answerInput,
    incrementAttempts,
    recordResult,
  ]);

  const handleShowHint = useCallback(() => {
    setShowHint(true);
    hintViewedRef.current = true;
  }, []);

  // ── Advance to next challenge ─────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!currentChallenge) return;
    if (!recordedRef.current) {
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts: Math.max(1, currentAttempts),
        score: 0,
        challengeType: currentChallenge.challengeType,
        hintViewed: hintViewedRef.current,
      });
    }
    advanceProgress();
  }, [advanceProgress, currentAttempts, currentChallenge, recordResult]);

  // ── Early return ──────────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400">No two-way table challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const canSubmit = answerInput.trim().length > 0;
  const phaseLabel = currentChallenge
    ? PHASE_TYPE_CONFIG[currentChallenge.challengeType]?.label ?? currentChallenge.challengeType
    : '';

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <Badge variant="outline" className="border-white/20 text-slate-300">
            {Math.min(currentIndex + 1, challenges.length)} / {challenges.length}
          </Badge>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary panel (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Probability Session Complete!"
            celebrationMessage="You worked through every table!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Scenario + question */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="border-purple-400/40 text-purple-200 text-[10px] uppercase tracking-wider"
                >
                  {phaseLabel}
                </Badge>
                <span className="text-xs text-slate-400">{currentChallenge.scenario}</span>
              </div>
              <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>
            </div>

            {/* Frequency table (mode-gated totals) */}
            <FrequencyTable challenge={currentChallenge} />

            {/* Answer input */}
            <div className="flex items-center gap-3 p-4 bg-slate-950/30 rounded-lg border border-white/10">
              <label
                htmlFor="twt-answer"
                className="text-sm font-mono text-emerald-300 font-semibold"
              >
                P =
              </label>
              <input
                id="twt-answer"
                type="text"
                inputMode="decimal"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit && !feedback?.correct) handleCheck();
                }}
                disabled={!!feedback?.correct}
                placeholder="0.25"
                className="w-40 h-12 text-center text-lg font-mono rounded-lg bg-slate-800/60 border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 text-white outline-none font-semibold disabled:opacity-70"
              />
              <span className="text-xs text-slate-500 italic">
                Decimal 0-1 (e.g., 0.25). Percentages accepted with %.
              </span>
            </div>

            {/* Feedback */}
            {feedback && (
              <div
                className={`p-3 rounded-lg border text-sm ${
                  feedback.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* Hint reveal */}
            {showHint && (
              <div className="p-3 bg-slate-950/40 rounded-lg border border-purple-500/30 text-xs text-slate-300">
                <span className="font-mono uppercase tracking-wider text-purple-400 mr-2">Hint:</span>
                {currentChallenge.hint}
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {!feedback?.correct && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-100"
                  onClick={handleCheck}
                  disabled={!canSubmit}
                >
                  Check Answer
                </Button>
              )}
              {!showHint && !feedback?.correct && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleShowHint}
                >
                  Show hint
                </Button>
              )}
              {feedback?.correct && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleNext}
                >
                  {currentIndex + 1 < challenges.length ? 'Next Table →' : 'Finish'}
                </Button>
              )}
              {!feedback?.correct && currentAttempts >= 3 && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                  onClick={handleNext}
                >
                  Skip →
                </Button>
              )}
            </div>
          </>
        )}

        {/* Educational context (session-level) */}
        {educationalContext && !allChallengesComplete && (
          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-xs text-slate-300 leading-relaxed">{educationalContext}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoWayTable;
