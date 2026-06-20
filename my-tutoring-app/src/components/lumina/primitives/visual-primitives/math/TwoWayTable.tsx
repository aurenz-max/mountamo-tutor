'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaButton,
  LuminaCallout,
  LuminaChallengeCounter,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TwoWayTableMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types — canonical interface re-exported from the generator
// ============================================================================

export type TwoWayTableChallengeType =
  | 'joint_probability'
  | 'marginal_distribution'
  | 'conditional_probability'
  | 'independence_test';

export type TwoWayTableSupportTier = 'easy' | 'medium' | 'hard';

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
  /** Legacy single switch — default source when no support tier present. */
  showTotals: boolean;
  hint: string;

  // ── Support-tier scaffolds (set by generator when config.difficulty present) ──
  supportTier?: TwoWayTableSupportTier;
  /** Render the per-row total column. When undefined, falls back to showTotals. */
  showRowTotals?: boolean;
  /** Render the per-column total row. When undefined, falls back to showTotals. */
  showColTotals?: boolean;
  /** Render the grand-total corner cell. When undefined, falls back to showTotals. */
  showGrandTotal?: boolean;
  /** Easy-tier worked "sum reminder" anchor line (never states the answer total). */
  sumReminder?: string;
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

/**
 * Resolve which totals the table renders. Support tiers set the fine-grained
 * show* flags; when none is present we fall back to the legacy mode-fixed
 * showTotals switch (every total on, or every total off, as before).
 */
function resolveTotalsVisibility(challenge: TwoWayTableChallenge): {
  showRow: boolean;
  showCol: boolean;
  showGrand: boolean;
  anyTotals: boolean;
} {
  const tiered = challenge.supportTier != null;
  const showRow = tiered ? !!challenge.showRowTotals : challenge.showTotals;
  const showCol = tiered ? !!challenge.showColTotals : challenge.showTotals;
  const showGrand = tiered ? !!challenge.showGrandTotal : challenge.showTotals;
  return { showRow, showCol, showGrand, anyTotals: showRow || showCol || showGrand };
}

// ============================================================================
// Frequency Table Renderer (read-only with tier-gated totals)
//
// BESPOKE PAINTING: this is the primitive's core visual surface — a
// pedagogically color-coded contingency table (purple columns, blue rows,
// amber totals) the student reads counts out of. Support tiers withdraw the
// amber total scaffolds independently (row / column / grand) so a hard tier
// makes the student compute every sum; the cell counts never change.
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
    sumReminder,
  } = challenge;

  const { showRow, showCol, showGrand, anyTotals } = resolveTotalsVisibility(challenge);

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
            {showRow && (
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
              {showRow && (
                <td className="p-2 text-center font-mono text-amber-200 font-bold border-l-2 border-l-white/20">
                  {rowTotals[ri]}
                </td>
              )}
            </tr>
          ))}
          {(showCol || showGrand) && (
            <tr className="border-t-2 border-t-white/20 bg-slate-900/50">
              <td className="p-2 font-semibold text-amber-300 border-r border-white/10">
                Total
              </td>
              {columnTotals.map((t, ci) => (
                <td
                  key={ci}
                  className="p-2 text-center font-mono text-amber-200 font-bold"
                >
                  {showCol ? t : ''}
                </td>
              ))}
              {/* Grand-total corner cell — shown independently of the column row. */}
              <td className="p-2 text-center font-mono text-purple-200 font-bold text-lg border-l-2 border-l-white/20">
                {showGrand ? grandTotal : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Easy-tier worked "sum reminder" — a safe (non-answer) total demonstrated. */}
      {sumReminder && (
        <p className="mt-2 text-xs text-emerald-300/90 italic">
          {sumReminder}
        </p>
      )}

      {!anyTotals && (
        <p className="mt-2 text-xs text-slate-500 italic">
          Row, column, and grand totals are hidden for this challenge — compute the totals you need from the cells.
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Tutor reveal policy — keep the AI tutor in sync with the on-screen scaffold so
// a hard tier (every total hidden) isn't undone by the tutor naming a total or
// the answer. The task identity (joint / marginal / conditional / independence)
// is the SAME at every tier; the tier only dials how much the tutor may pre-sum.
// In every mode the relationship to compute IS the assessed skill, so the tutor
// never states the final probability at any tier.
// ============================================================================
function tutorRevealClause(tier?: TwoWayTableSupportTier): string {
  switch (tier) {
    case 'easy':
      return ' [TIER:easy] Max scaffolding — the non-answer totals are pre-summed on screen. You may name which cell and which total to divide, and walk the setup step by step. Never state the final probability.';
    case 'medium':
      return ' [TIER:medium] Only the grand total is shown. Nudge which row or column the student must add up themselves; do not pre-sum it for them and do not give the answer.';
    case 'hard':
      return ' [TIER:hard] EVERY total is hidden — do NOT state any row, column, or grand total, and do NOT name the answer. Ask the student WHICH counts they need to add for this question, and let them compute each sum.';
    default:
      return '';
  }
}

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
    gradeBand = '7-8',
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

  // ── AI Tutoring ───────────────────────────────────────────────────
  // The tutor reads supportTier so it can calibrate reveal: at hard it must NOT
  // name any total it hid, nor the answer (see tutorRevealClause).
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: currentChallenge?.challengeType ?? sessionChallengeType,
    scenario: currentChallenge?.scenario ?? '',
    question: currentChallenge?.question ?? '',
    rowLabel: currentChallenge?.rowLabel ?? '',
    columnLabel: currentChallenge?.columnLabel ?? '',
    supportTier: currentChallenge?.supportTier ?? null,
    // Answer for the tutor's internal reasoning ONLY — the reveal clause forbids
    // naming it; the tutor coaches toward it without stating it.
    correctAnswer: currentChallenge ? formatProbability(currentChallenge.expectedProbability) : '',
    totalChallenges: challenges.length,
    currentChallengeIndex: currentIndex + 1,
    attemptNumber: currentAttempts + 1,
    gradeBand,
  }), [
    title, currentChallenge, sessionChallengeType, challenges.length,
    currentIndex, currentAttempts, gradeBand,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'two-way-table',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'statistics' ? 'Statistics' : 'Grade 7-8',
  });

  // Activity introduction (once, when connected)
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Two-Way Table probability session. Concept: ${sessionChallengeType}. `
      + `${challenges.length} contingency-table problems, surfaced one at a time. `
      + `First table: "${currentChallenge?.scenario}" — "${currentChallenge?.question}". `
      + `Introduce warmly and orient the student to reading the table.`
      + tutorRevealClause(currentChallenge?.supportTier),
      { silent: true },
    );
  }, [isConnected, challenges.length, sessionChallengeType, currentChallenge, sendText]);

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

    // Tutor wrap-up
    sendText(
      `[ALL_COMPLETE] Session done. Overall accuracy ${overallAccuracy}% across ${totalChallenges} tables. `
      + `Give brief encouraging feedback about their two-way-table reasoning.`,
      { silent: true },
    );
  }, [allChallengesComplete, challengeResults, hasSubmitted, sessionChallengeType, submitResult, sendText]);

  // ── Check answer ──────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    if (feedback?.correct) return;

    const parsed = parseProbabilityInput(answerInput);
    if (parsed === null) {
      SoundManager.invalid();
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
      SoundManager.playCorrect();
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
      sendText(
        `[ANSWER_CORRECT] Student correctly answered the ${currentChallenge.challengeType} table `
        + `("${currentChallenge.scenario}"). Congratulate briefly and, if more tables remain, encourage them onward.`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: attempts === 1
          ? 'Not quite — re-check which counts go into the numerator and denominator.'
          : `Still off. Try the hint, or check your division.`,
      });
      sendText(
        `[ANSWER_INCORRECT] Student answered "${answerInput}" on the ${currentChallenge.challengeType} table `
        + `("${currentChallenge.scenario}", question: "${currentChallenge.question}"). `
        + `Point them at the specific cell or sum to re-examine for THIS concept — do not just repeat the formula.`
        + tutorRevealClause(currentChallenge.supportTier),
        { silent: true },
      );
    }
  }, [
    currentChallenge,
    currentAttempts,
    feedback,
    answerInput,
    incrementAttempts,
    recordResult,
    sendText,
  ]);

  const handleShowHint = useCallback(() => {
    SoundManager.pop();
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
    const advanced = advanceProgress();
    if (advanced) {
      const nextChallenge = challenges[currentIndex + 1];
      sendText(
        `[NEXT_ITEM] Moving to table ${currentIndex + 2} of ${challenges.length}: `
        + `"${nextChallenge?.scenario}" — "${nextChallenge?.question}". Introduce it briefly.`
        + tutorRevealClause(nextChallenge?.supportTier),
        { silent: true },
      );
    }
  }, [advanceProgress, currentAttempts, currentChallenge, recordResult, challenges, currentIndex, sendText]);

  // ── Early return ──────────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400">No two-way table challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const canSubmit = answerInput.trim().length > 0;
  const phaseLabel = currentChallenge
    ? PHASE_TYPE_CONFIG[currentChallenge.challengeType]?.label ?? currentChallenge.challengeType
    : '';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaChallengeCounter
            current={Math.min(currentIndex + 1, challenges.length)}
            total={challenges.length}
          />
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
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
            <LuminaPrompt>
              <div className="flex items-center gap-2 mb-2">
                <LuminaBadge accent="purple" className="text-[10px] uppercase tracking-wider">
                  {phaseLabel}
                </LuminaBadge>
                <span className="text-xs text-slate-400">{currentChallenge.scenario}</span>
              </div>
              <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>
            </LuminaPrompt>

            {/* Frequency table (tier-gated totals) — bespoke painting */}
            <FrequencyTable challenge={currentChallenge} />

            {/* Answer input */}
            <div className="flex items-center gap-3 p-4 bg-slate-950/30 rounded-lg border border-white/10">
              <label
                htmlFor="twt-answer"
                className="text-sm font-mono text-emerald-300 font-semibold"
              >
                P =
              </label>
              <LuminaInput
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
                className="w-40 h-12 text-center text-lg font-mono font-semibold border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-emerald-500/30"
              />
              <span className="text-xs text-slate-500 italic">
                Decimal 0-1 (e.g., 0.25). Percentages accepted with %.
              </span>
            </div>

            {/* Feedback */}
            {feedback && (
              <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'}>
                {feedback.message}
              </LuminaFeedbackCard>
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
                <LuminaActionButton
                  action="check"
                  onClick={handleCheck}
                  disabled={!canSubmit}
                />
              )}
              {!showHint && !feedback?.correct && (
                <LuminaButton tone="ghost" onClick={handleShowHint}>
                  Show hint
                </LuminaButton>
              )}
              {feedback?.correct && (
                <LuminaActionButton action="next" onClick={handleNext}>
                  {currentIndex + 1 < challenges.length ? 'Next Table →' : 'Finish'}
                </LuminaActionButton>
              )}
              {!feedback?.correct && currentAttempts >= 3 && (
                <LuminaButton tone="subtle" onClick={handleNext}>
                  Skip →
                </LuminaButton>
              )}
            </div>
          </>
        )}

        {/* Educational context (session-level) */}
        {educationalContext && !allChallengesComplete && (
          <LuminaCallout accent="purple" label="In Context">
            {educationalContext}
          </LuminaCallout>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default TwoWayTable;
