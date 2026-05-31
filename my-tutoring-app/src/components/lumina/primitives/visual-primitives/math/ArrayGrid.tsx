'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type ArrayGridMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaBadge,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';

/**
 * Array Grid — multi-challenge array builder / counter / multiplier.
 *
 * Session walks the student through 3-6 distinct (rows, columns) pairs in the
 * SAME eval mode. Per PRD §6h (array-grid post-mortem), per-challenge state
 * must reset on advance; the stale-state guard lives in submit handlers
 * (§6a #8). Pool-service generator owns dimension variance — Gemini emits
 * only wrapper metadata.
 */

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type ArrayGridChallengeType = 'build_array' | 'count_array' | 'multiply_array';
export type ArrayGridIconType = 'dot' | 'square' | 'star';

export interface ArrayGridChallenge {
  id: string;
  targetRows: number;
  targetColumns: number;
}

export interface ArrayGridData {
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: ArrayGridChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: ArrayGridChallengeType;

  // Display options (session-level)
  iconType?: ArrayGridIconType;
  showLabels?: boolean;
  maxRows?: number;
  maxColumns?: number;

  // Evaluation integration (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ArrayGridMetrics>) => void;
}

interface ArrayGridProps {
  data: ArrayGridData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_array:    { label: 'Build',    icon: '🔨', accentColor: 'emerald' },
  count_array:    { label: 'Count',    icon: '🔢', accentColor: 'blue' },
  multiply_array: { label: 'Multiply', icon: '✖️', accentColor: 'purple' },
};

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

// ============================================================================
// Component
// ============================================================================

const ArrayGrid: React.FC<ArrayGridProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    iconType = 'star',
    showLabels = true,
    maxRows = 6,
    maxColumns = 8,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `array-grid-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress ─────────────────────────────────────────
  const {
    currentIndex,
    results,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<ArrayGridChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const targetRows = currentChallenge?.targetRows ?? 0;
  const targetColumns = currentChallenge?.targetColumns ?? 0;
  const targetProduct = targetRows * targetColumns;

  const isMultiplyMode = sessionChallengeType === 'multiply_array';
  const isPreBuilt = sessionChallengeType === 'count_array' || isMultiplyMode;

  // Capped button ranges (must match component caps in the catalog/generator)
  const rowButtonCount = Math.min(maxRows, 6);
  const colButtonCount = Math.min(maxColumns, 8);

  // ── Per-challenge interaction state (resets on advance) ────────
  const [currentRows, setCurrentRows] = useState(0);
  const [currentColumns, setCurrentColumns] = useState(0);
  const [totalAnswer, setTotalAnswer] = useState('');
  const [rowsAnswer, setRowsAnswer] = useState('');
  const [columnsAnswer, setColumnsAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c lesson: missing any slot leaks state from challenge N into N+1.
  useEffect(() => {
    if (!currentChallenge) return;
    // Pre-built modes show the array immediately at target dimensions.
    const startRows = isPreBuilt ? currentChallenge.targetRows : 0;
    const startCols = isPreBuilt ? currentChallenge.targetColumns : 0;
    setCurrentRows(startRows);
    setCurrentColumns(startCols);
    setTotalAnswer('');
    setRowsAnswer('');
    setColumnsAnswer('');
    setFeedback(null);
    setFeedbackType(null);
    setAttempts(0);
    setChallengeDone(false);
    recordedRef.current = false;
  }, [currentChallenge?.id, isPreBuilt]);

  // ── Evaluation hook ────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ArrayGridMetrics>({
    primitiveType: 'array-grid',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── PhaseSummaryPanel: one row, aggregated by eval mode ────────
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => sessionChallengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length),
  });

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: ArrayGridChallenge | null): boolean => {
      if (!challenge) return false;
      // For pre-built modes the array is rendered at target dims from the reset
      // effect — match against that. For build mode, the student-built dims can
      // legitimately disagree with target dims, so any state belongs to the
      // active challenge.
      if (isPreBuilt) {
        return (
          currentRows === challenge.targetRows &&
          currentColumns === challenge.targetColumns
        );
      }
      return true;
    },
    [isPreBuilt, currentRows, currentColumns],
  );

  // ── Per-challenge completion (called from submit handlers) ─────
  const completeCurrentChallenge = useCallback(
    (
      correct: boolean,
      score: number,
      attemptsCount: number,
      extras: Record<string, unknown> = {},
    ) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      setChallengeDone(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts: attemptsCount,
        score,
        ...extras,
      });
    },
    [currentChallenge, stateMatchesChallenge, recordResult],
  );

  // ── Session complete → aggregate metrics + submitEvaluation ────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => Number(r.score ?? 0) === 100).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const metrics: ArrayGridMetrics = {
      type: 'array-grid',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          pairs: challenges.map((c) => ({
            rows: c.targetRows,
            columns: c.targetColumns,
          })),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
        },
      });
    }
  }, [
    isComplete, results, challenges, sessionChallengeType,
    submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Build-mode controls ────────────────────────────────────────
  const handleRowChange = (newRows: number) => {
    if (challengeDone || isPreBuilt) return;
    SoundManager.select();
    setCurrentRows(newRows);
    setFeedback(null);
  };

  const handleColumnChange = (newColumns: number) => {
    if (challengeDone || isPreBuilt) return;
    SoundManager.select();
    setCurrentColumns(newColumns);
    setFeedback(null);
  };

  // ── Submit handlers ────────────────────────────────────────────
  const arrayBuilt =
    currentRows === targetRows && currentColumns === targetColumns;

  const handleSubmitCountOrBuild = () => {
    if (!currentChallenge) return;
    const studentTotal = parseInt(totalAnswer, 10);
    const correctArray = currentRows === targetRows && currentColumns === targetColumns;
    const correctTotal = studentTotal === targetProduct;
    const isCorrect = correctArray && correctTotal;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Correct! There are ${targetProduct} ${iconType}s in total.`
          : `Perfect! You built a ${currentRows} × ${currentColumns} array with ${studentTotal} total items.`,
      );
      setFeedbackType('success');
      const score = phaseScore(nextAttempts);
      completeCurrentChallenge(true, score, nextAttempts);
      return;
    }

    SoundManager.playIncorrect();
    if (correctArray && !correctTotal) {
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Not quite. Try counting again — skip count by rows or columns.`
          : `You built the array correctly (${currentRows} × ${currentColumns}), but your total is incorrect. Count again!`,
      );
      setFeedbackType('hint');
    } else if (!correctArray && correctTotal) {
      setFeedback(
        `Your total (${studentTotal}) would be correct for a different array. Build ${targetRows} rows × ${targetColumns} columns.`,
      );
      setFeedbackType('hint');
    } else {
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Not quite. Count the items carefully — try skip counting by rows!`
          : `Not quite. First, build a ${targetRows} × ${targetColumns} array, then count the total.`,
      );
      setFeedbackType('error');
    }
  };

  const handleSubmitMultiply = () => {
    if (!currentChallenge) return;
    const studentRows = parseInt(rowsAnswer, 10);
    const studentColumns = parseInt(columnsAnswer, 10);
    const studentTotal = parseInt(totalAnswer, 10);

    const correctRows = studentRows === targetRows;
    const correctColumns = studentColumns === targetColumns;
    const correctTotal = studentTotal === targetProduct;
    const isCorrect = correctRows && correctColumns && correctTotal;

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        `Excellent! ${targetRows} × ${targetColumns} = ${targetProduct}. You wrote the multiplication fact correctly!`,
      );
      setFeedbackType('success');
      const score = phaseScore(nextAttempts);
      completeCurrentChallenge(true, score, nextAttempts);
      return;
    }

    SoundManager.playIncorrect();
    const hints: string[] = [];
    if (!correctRows) hints.push('count the rows (horizontal groups)');
    if (!correctColumns) hints.push('count the columns (items in each row)');
    if (!correctTotal) hints.push('multiply rows × columns for the total');
    setFeedback(`Not quite. Try to ${hints.join(', ')}.`);
    setFeedbackType(hints.length === 1 ? 'hint' : 'error');
  };

  const handleSubmit = () => {
    if (challengeDone) return;
    if (isMultiplyMode) handleSubmitMultiply();
    else handleSubmitCountOrBuild();
  };

  // ── Advance to next challenge ──────────────────────────────────
  const handleNextChallenge = () => {
    advance();
  };

  // ── Can submit? ────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (challengeDone) return false;
    if (isMultiplyMode) {
      return rowsAnswer !== '' && columnsAnswer !== '' && totalAnswer !== '';
    }
    return arrayBuilt && totalAnswer !== '';
  }, [challengeDone, isMultiplyMode, rowsAnswer, columnsAnswer, totalAnswer, arrayBuilt]);

  // ── Icon renderer ──────────────────────────────────────────────
  const renderIcon = () => {
    const baseClass = 'fill-blue-400/80';
    switch (iconType) {
      case 'dot':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );
      case 'square':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" className={baseClass} />
          </svg>
        );
      case 'star':
      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              className={baseClass}
            />
          </svg>
        );
    }
  };

  // Displayed rows/columns for the grid
  const displayRows = isPreBuilt ? targetRows : currentRows;
  const displayColumns = isPreBuilt ? targetColumns : currentColumns;
  const hasNextChallenge = currentIndex + 1 < challenges.length;

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No array grid challenges available.
        </div>
      </div>
    );
  }

  // ── Session summary ────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-16 ${className || ''}`}>
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score}
          durationMs={elapsedMs}
          heading="Array Session Complete"
          celebrationMessage={
            results.every((r) => r.correct)
              ? 'Perfect! You solved every array.'
              : 'Great work — keep practicing arrays!'
          }
        />
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 6v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Array Builder</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <LuminaBadge accent="emerald" className="text-xs font-mono uppercase tracking-wider">
              {isMultiplyMode ? 'Multiply' : isPreBuilt ? 'Count' : 'Build & Multiply'}
            </LuminaBadge>
          </div>
        </div>
      </div>

      <LuminaCard className="relative overflow-hidden shadow-2xl">
        <div
          className="absolute inset-0 opacity-10 rounded-3xl"
          style={{
            backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        ></div>

        <LuminaCardHeader className="relative z-10 text-center">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaCardDescription className="text-slate-300">{description}</LuminaCardDescription>
        </LuminaCardHeader>

        <LuminaCardContent className="relative z-10">
          {/* Session progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !challengeDone;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                        ? 'bg-green-500/20 text-green-200 border-green-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Array {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* Step 1: Build (build_array mode only) */}
          {!isPreBuilt && !challengeDone && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-green-300 mb-4 text-center">
                Step 1: Build an array with {targetRows} rows and {targetColumns} columns
              </h4>

              <div className="flex flex-col items-center gap-6">
                {/* Row Controls */}
                <div className="flex items-center gap-4">
                  <span className="text-green-300 font-semibold w-24 text-right">Rows:</span>
                  <div className="flex gap-2 flex-wrap max-w-2xl">
                    {Array.from({ length: rowButtonCount }, (_, i) => i + 1).map((num) => (
                      <button
                        key={`row-${num}`}
                        onClick={() => handleRowChange(num)}
                        disabled={challengeDone}
                        className={`w-10 h-10 rounded-lg font-bold transition-all ${
                          currentRows === num
                            ? 'bg-green-500 text-white scale-110 shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column Controls */}
                <div className="flex items-center gap-4">
                  <span className="text-blue-300 font-semibold w-24 text-right">Columns:</span>
                  <div className="flex gap-2 flex-wrap max-w-2xl">
                    {Array.from({ length: colButtonCount }, (_, i) => i + 1).map((num) => (
                      <button
                        key={`col-${num}`}
                        onClick={() => handleColumnChange(num)}
                        disabled={challengeDone}
                        className={`w-10 h-10 rounded-lg font-bold transition-all ${
                          currentColumns === num
                            ? 'bg-blue-500 text-white scale-110 shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Array Grid */}
          {displayRows > 0 && displayColumns > 0 && (
            <div className="flex justify-center items-center mb-8">
              <div className="relative inline-block">
                {/* Column Labels */}
                {showLabels && (
                  <div className="flex mb-2" style={{ marginLeft: showLabels ? '40px' : '0' }}>
                    {Array.from({ length: displayColumns }).map((_, index) => (
                      <div
                        key={`col-label-${index}`}
                        className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm w-16"
                      >
                        {index + 1}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex">
                  {/* Row Labels */}
                  {showLabels && (
                    <div className="flex flex-col mr-2">
                      {Array.from({ length: displayRows }).map((_, index) => (
                        <div
                          key={`row-label-${index}`}
                          className="flex items-center justify-center text-green-300 font-mono font-bold text-sm h-16 w-10"
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grid */}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${displayColumns}, 64px)` }}
                  >
                    {Array.from({ length: displayRows }).map((_, rowIndex) =>
                      Array.from({ length: displayColumns }).map((_, colIndex) => {
                        const cellKey = `${rowIndex}-${colIndex}`;
                        return (
                          <div
                            key={cellKey}
                            className="w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-200 border-2 bg-slate-800/30 border-slate-600"
                          >
                            {renderIcon()}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Section — varies by challenge type */}

          {/* count_array */}
          {sessionChallengeType === 'count_array' && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                How many {iconType}s in total?
              </h4>
              <div className="flex justify-center items-center gap-4">
                <label className="text-slate-300 font-semibold">Total:</label>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  value={totalAnswer}
                  onChange={(e) => setTotalAnswer(e.target.value)}
                  placeholder="?"
                  className="w-32 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
                <span className="text-slate-300">{iconType}s</span>
              </div>
            </div>
          )}

          {/* multiply_array */}
          {isMultiplyMode && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                Write the multiplication sentence
              </h4>
              <div className="flex justify-center items-center gap-3 flex-wrap">
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  value={rowsAnswer}
                  onChange={(e) => setRowsAnswer(e.target.value)}
                  placeholder="rows"
                  className="w-24 text-center font-mono text-xl"
                />
                <span className="text-2xl text-slate-300 font-bold">×</span>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  value={columnsAnswer}
                  onChange={(e) => setColumnsAnswer(e.target.value)}
                  placeholder="cols"
                  className="w-24 text-center font-mono text-xl"
                />
                <span className="text-2xl text-slate-300 font-bold">=</span>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  value={totalAnswer}
                  onChange={(e) => setTotalAnswer(e.target.value)}
                  placeholder="total"
                  className="w-28 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
              </div>
            </div>
          )}

          {/* build_array */}
          {sessionChallengeType === 'build_array' && arrayBuilt && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                Step 2: How many {iconType}s in total?
              </h4>
              <div className="flex justify-center items-center gap-4">
                <label className="text-slate-300 font-semibold">Total:</label>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  value={totalAnswer}
                  onChange={(e) => setTotalAnswer(e.target.value)}
                  placeholder="?"
                  className="w-32 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
                <span className="text-slate-300">{iconType}s</span>
              </div>
            </div>
          )}

          {/* Feedback Display */}
          {feedback && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                feedbackType === 'success'
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : feedbackType === 'error'
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
              }`}
            >
              <p className="font-medium">{feedback}</p>
            </div>
          )}

          {/* Submit Control */}
          {!challengeDone && (
            <div className="flex justify-center gap-4 mb-8">
              <LuminaActionButton
                action="check"
                onClick={handleSubmit}
                disabled={!canSubmit}
              />
            </div>
          )}

          {/* Between-challenge interstitial */}
          {challengeDone && (
            <LuminaCard surface="nested" className="mt-2 border-green-500/30">
              <LuminaCardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-green-400">
                    ✓ Array {currentIndex + 1} complete!
                  </h4>
                  {hasNextChallenge ? (
                    <LuminaActionButton action="next" onClick={handleNextChallenge}>
                      Next Array →
                    </LuminaActionButton>
                  ) : (
                    <span className="text-sm text-slate-400 font-mono uppercase tracking-wider">
                      Last array
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300">
                  {targetRows} × {targetColumns} ={' '}
                  <span className="font-bold text-white">{targetProduct}</span>
                </p>
              </LuminaCardContent>
            </LuminaCard>
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default ArrayGrid;
