'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatrixDisplayMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types — re-exported from the generator's canonical interface
// ============================================================================

export type MatrixChallengeType =
  | 'transpose'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'determinant'
  | 'inverse';

export interface MatrixDisplayChallenge {
  id: string;
  challengeType: MatrixChallengeType;
  instruction: string;
  rows: number;
  columns: number;
  values: number[][];
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label?: string;
  };
  expectedScalar?: number;
  expectedMatrix?: number[][];
  hint: string;
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  challenges: MatrixDisplayChallenge[];
  challengeType: MatrixChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'algebra2' | 'precalculus' | 'advanced';

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MatrixDisplayMetrics>) => void;
}

// ============================================================================
// Phase config (one row per challenge type)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  transpose:   { label: 'Transpose',   icon: '🔄', accentColor: 'cyan' },
  add:         { label: 'Add',         icon: '➕', accentColor: 'emerald' },
  subtract:    { label: 'Subtract',    icon: '➖', accentColor: 'amber' },
  multiply:    { label: 'Multiply',    icon: '✖️', accentColor: 'purple' },
  determinant: { label: 'Determinant', icon: '◊',  accentColor: 'pink' },
  inverse:     { label: 'Inverse',     icon: '⁻¹', accentColor: 'blue' },
};

// ============================================================================
// Helpers
// ============================================================================

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Display fractions cleanly for inverse mode (det = ±1 means integers, so this is a safety net).
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

function numbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

/** §6a #11 standard per-challenge score formula. */
function phaseScore(attempts: number): number {
  return Math.max(20, 100 - (Math.max(0, attempts - 1) * 20));
}

// ============================================================================
// Matrix Renderer (read-only display of a number matrix)
// ============================================================================

interface MatrixRendererProps {
  values: number[][];
  label?: string;
  accent?: 'purple' | 'blue' | 'emerald';
  /** Optional per-cell mask. Cells where revealMask[ri][ci] is false render a "?" placeholder instead of the value. Default: all cells revealed. */
  revealMask?: boolean[][];
}

const MatrixRenderer: React.FC<MatrixRendererProps> = ({ values, label, accent = 'purple', revealMask }) => {
  const rows = values.length;
  const accentColor = accent === 'blue' ? '#60a5fa' : accent === 'emerald' ? '#34d399' : '#a78bfa';

  return (
    <div className="flex flex-col items-center">
      {label && (
        <div className="text-xs font-mono text-slate-400 mb-2 font-semibold">{label}</div>
      )}
      <div className="relative inline-flex items-center">
        <div
          className="font-thin leading-none select-none"
          style={{ fontSize: `${rows * 2.2}rem`, color: accentColor }}
        >
          [
        </div>
        <div className="mx-2 py-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values[0]?.length ?? 0}, minmax(0, 1fr))` }}>
            {values.flatMap((row, ri) =>
              row.map((v, ci) => {
                const revealed = revealMask ? revealMask[ri]?.[ci] !== false : true;
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={`w-14 h-12 flex items-center justify-center text-base font-mono rounded-lg border font-semibold ${
                      revealed
                        ? 'bg-slate-900/40 border-slate-700/40 text-white'
                        : 'bg-slate-900/20 border-slate-700/30 text-slate-600'
                    }`}
                  >
                    {revealed ? formatNumber(v) : '?'}
                  </div>
                );
              }),
            )}
          </div>
        </div>
        <div
          className="font-thin leading-none select-none"
          style={{ fontSize: `${rows * 2.2}rem`, color: accentColor }}
        >
          ]
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Matrix Input (editable result matrix)
// ============================================================================

interface MatrixInputProps {
  rows: number;
  columns: number;
  values: string[][];
  onChange: (row: number, col: number, value: string) => void;
  disabled?: boolean;
  highlightCorrect?: boolean[][];   // per-cell correctness for post-submit feedback
}

const MatrixInput: React.FC<MatrixInputProps> = ({ rows, columns, values, onChange, disabled, highlightCorrect }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-mono text-emerald-300 mb-2 font-semibold">Your Answer</div>
      <div className="relative inline-flex items-center">
        <div className="font-thin leading-none select-none text-emerald-400" style={{ fontSize: `${rows * 2.2}rem` }}>
          [
        </div>
        <div className="mx-2 py-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows }).flatMap((_, ri) =>
              Array.from({ length: columns }).map((_, ci) => {
                const correct = highlightCorrect?.[ri]?.[ci];
                const borderClass =
                  correct === true ? 'border-emerald-400' :
                  correct === false ? 'border-rose-400' :
                  'border-slate-600/60 focus:border-emerald-400';
                return (
                  <input
                    key={`${ri}-${ci}`}
                    type="text"
                    inputMode="numeric"
                    value={values[ri]?.[ci] ?? ''}
                    onChange={(e) => onChange(ri, ci, e.target.value)}
                    disabled={disabled}
                    className={`w-14 h-12 text-center text-base font-mono rounded-lg bg-slate-800/60 border-2 ${borderClass} focus:ring-2 focus:ring-emerald-500/30 text-white outline-none font-semibold disabled:opacity-70`}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="font-thin leading-none select-none text-emerald-400" style={{ fontSize: `${rows * 2.2}rem` }}>
          ]
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Steps Reveal — lightweight per-operation explanation
// ============================================================================

const StepsReveal: React.FC<{ challenge: MatrixDisplayChallenge }> = ({ challenge }) => {
  const { challengeType, values, secondMatrix, expectedMatrix, expectedScalar } = challenge;

  if (challengeType === 'determinant' && values.length === 2) {
    const a = values[0][0], b = values[0][1], c = values[1][0], d = values[1][1];
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono text-slate-200">det = ad − bc</div>
        <div className="font-mono text-slate-300">= ({a})({d}) − ({b})({c})</div>
        <div className="font-mono text-slate-300">= {a * d} − {b * c}</div>
        <div className="font-mono text-emerald-300 font-bold">= {expectedScalar}</div>
      </div>
    );
  }

  if (challengeType === 'determinant' && values.length === 3) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">det = a₁₁(a₂₂a₃₃ − a₂₃a₃₂) − a₁₂(a₂₁a₃₃ − a₂₃a₃₁) + a₁₃(a₂₁a₃₂ − a₂₂a₃₁)</div>
        <div className="font-mono text-emerald-300 font-bold">= {expectedScalar}</div>
      </div>
    );
  }

  if (challengeType === 'transpose' && expectedMatrix) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div>Each entry at A[i][j] moves to position Aᵀ[j][i].</div>
        <MatrixRenderer values={expectedMatrix} label="Aᵀ" accent="emerald" />
      </div>
    );
  }

  if ((challengeType === 'add' || challengeType === 'subtract') && expectedMatrix) {
    const sym = challengeType === 'add' ? '+' : '−';
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">result[i][j] = A[i][j] {sym} B[i][j]</div>
        <MatrixRenderer values={expectedMatrix} label="Result" accent="emerald" />
      </div>
    );
  }

  if (challengeType === 'multiply' && expectedMatrix && secondMatrix) {
    // Walk through result[0][0] as the worked example so students see the dot product
    // mechanic (row 0 of A · column 0 of B) before generalizing to the rest. Mask the
    // remaining cells of the Result matrix so the walkthrough doesn't give away the
    // answers the student still has to compute.
    const aRow0 = values[0];
    const bCol0 = secondMatrix.values.map((row) => row[0]);
    const products = aRow0.map((a, k) => a * bCol0[k]);
    const r00 = expectedMatrix[0][0];
    const revealMask: boolean[][] = expectedMatrix.map((row, ri) =>
      row.map((_, ci) => ri === 0 && ci === 0),
    );
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono text-slate-200">result[i][j] = Σ A[i][k] × B[k][j]</div>
        <div className="pt-1 text-xs uppercase tracking-wider text-slate-400">Worked example: result[0][0]</div>
        <div className="font-mono text-slate-300">
          = {aRow0.map((_, k) => `A[0][${k}] × B[${k}][0]`).join(' + ')}
        </div>
        <div className="font-mono text-slate-300">
          = {aRow0.map((a, k) => `(${a})(${bCol0[k]})`).join(' + ')}
        </div>
        <div className="font-mono text-slate-300">
          = {products.join(' + ')}
        </div>
        <div className="font-mono text-emerald-300 font-bold">= {r00}</div>
        <div className="pt-1 text-xs text-slate-400">Repeat for each row of A and column of B to fill the rest.</div>
        <MatrixRenderer values={expectedMatrix} label="Result" accent="emerald" revealMask={revealMask} />
      </div>
    );
  }

  if (challengeType === 'inverse' && expectedMatrix) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">A⁻¹ = (1/det) · [[d, −b], [−c, a]]</div>
        <MatrixRenderer values={expectedMatrix} label="A⁻¹" accent="emerald" />
      </div>
    );
  }

  return null;
};

// ============================================================================
// Component
// ============================================================================

interface MatrixDisplayProps {
  data: MatrixDisplayData;
  className?: string;
}

const MatrixDisplay: React.FC<MatrixDisplayProps> = ({ data, className }) => {
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

  // ── Evaluation ──────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `matrix-display-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<MatrixDisplayMetrics>({
    primitiveType: 'matrix-display',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Challenge progress ──────────────────────────────────────────
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

  // ── Per-challenge state ─────────────────────────────────────────
  const [scalarInput, setScalarInput] = useState<string>('');
  const [matrixInput, setMatrixInput] = useState<string[][]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [cellCorrectness, setCellCorrectness] = useState<boolean[][] | undefined>(undefined);

  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const submittedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // ── Reset per-challenge state on advance ────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    setScalarInput('');
    // Initialize matrix-input grid with blanks of the result shape.
    const expected = currentChallenge.expectedMatrix;
    if (expected) {
      const rows = expected.length;
      const cols = expected[0]?.length ?? 0;
      setMatrixInput(Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')));
    } else {
      setMatrixInput([]);
    }
    setFeedback(null);
    setShowSteps(false);
    setCellCorrectness(undefined);
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aggregate score (live preview) ──────────────────────────────
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const sum = challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
    return Math.round(sum / challengeResults.length);
  }, [challengeResults]);

  // ── Phase results for the summary panel ─────────────────────────
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

  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<MatrixDisplayMetrics> | null>(null);

  // ── Session-complete: submit aggregate evaluation exactly once ──
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

    const metrics: MatrixDisplayMetrics = {
      type: 'matrix-display',
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

  // ── Handle matrix-input cell change ─────────────────────────────
  const handleMatrixInputChange = useCallback((row: number, col: number, value: string) => {
    setMatrixInput((prev) => {
      const next = prev.map((r) => [...r]);
      if (!next[row]) next[row] = [];
      next[row][col] = value;
      return next;
    });
  }, []);

  // ── Check answer ────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;          // stale-state guard
    if (feedback?.correct) return;

    const attempts = currentAttempts + 1;
    incrementAttempts();

    let correct = false;
    let perCellCorrect: boolean[][] | undefined;

    if (currentChallenge.expectedScalar !== undefined) {
      // Scalar input (determinant).
      const value = parseFloat(scalarInput.trim());
      correct = Number.isFinite(value) && numbersEqual(value, currentChallenge.expectedScalar);
    } else if (currentChallenge.expectedMatrix) {
      const expected = currentChallenge.expectedMatrix;
      const rows = expected.length;
      const cols = expected[0]?.length ?? 0;
      perCellCorrect = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
      let allOk = true;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const raw = (matrixInput[i]?.[j] ?? '').trim();
          const v = parseFloat(raw);
          const ok = Number.isFinite(v) && numbersEqual(v, expected[i][j]);
          perCellCorrect[i][j] = ok;
          if (!ok) allOk = false;
        }
      }
      correct = allOk;
    }

    setCellCorrectness(perCellCorrect);

    if (correct) {
      SoundManager.playCorrect();
      const score = phaseScore(attempts);
      setFeedback({ correct: true, message: `Correct! +${score} points` });
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
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: attempts === 1
          ? 'Not quite — check each entry and try again.'
          : 'Still off. Open "Show steps" for a walkthrough.',
      });
    }
  }, [currentChallenge, currentAttempts, feedback, scalarInput, matrixInput, incrementAttempts, recordResult]);

  // ── Reveal hint / steps ─────────────────────────────────────────
  const handleShowSteps = useCallback(() => {
    SoundManager.pop();
    setShowSteps(true);
    hintViewedRef.current = true;
  }, []);

  // ── Advance to next challenge ───────────────────────────────────
  const handleNext = useCallback(() => {
    if (!currentChallenge) return;
    // If user hasn't gotten it right after multiple attempts, record as incorrect and move on.
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

  // ── Early return ────────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-6">
          <p className="text-slate-400">No matrix challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const canSubmit = currentChallenge?.expectedScalar !== undefined
    ? scalarInput.trim().length > 0
    : (currentChallenge?.expectedMatrix?.every((row, i) => row.every((_, j) => (matrixInput[i]?.[j] ?? '').trim().length > 0)) ?? false);

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
            heading="Matrix Session Complete!"
            celebrationMessage="You worked through every problem!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Instruction */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-slate-100 text-sm font-medium">{currentChallenge.instruction}</p>
            </div>

            {/* Source matrices */}
            <div className="flex flex-wrap items-center justify-center gap-6 p-4 bg-slate-950/30 rounded-lg border border-white/10">
              <MatrixRenderer
                values={currentChallenge.values}
                label={currentChallenge.secondMatrix ? 'Matrix A' : 'Matrix'}
                accent="purple"
              />
              {currentChallenge.secondMatrix && (
                <>
                  <div className="text-3xl text-slate-400 font-bold">
                    {currentChallenge.challengeType === 'add' ? '+' :
                     currentChallenge.challengeType === 'subtract' ? '−' :
                     currentChallenge.challengeType === 'multiply' ? '×' : ''}
                  </div>
                  <MatrixRenderer
                    values={currentChallenge.secondMatrix.values}
                    label={currentChallenge.secondMatrix.label ?? 'Matrix B'}
                    accent="blue"
                  />
                </>
              )}
              <div className="text-3xl text-slate-400 font-bold">=</div>

              {/* Student input */}
              {currentChallenge.expectedScalar !== undefined ? (
                <div className="flex flex-col items-center">
                  <div className="text-xs font-mono text-emerald-300 mb-2 font-semibold">Your Answer</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={scalarInput}
                    onChange={(e) => setScalarInput(e.target.value)}
                    disabled={!!feedback?.correct}
                    placeholder="det = ?"
                    className="w-32 h-14 text-center text-lg font-mono rounded-lg bg-slate-800/60 border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 text-white outline-none font-semibold disabled:opacity-70"
                  />
                </div>
              ) : currentChallenge.expectedMatrix ? (
                <MatrixInput
                  rows={currentChallenge.expectedMatrix.length}
                  columns={currentChallenge.expectedMatrix[0]?.length ?? 0}
                  values={matrixInput}
                  onChange={handleMatrixInputChange}
                  disabled={!!feedback?.correct}
                  highlightCorrect={cellCorrectness}
                />
              ) : null}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`p-3 rounded-lg border text-sm ${
                feedback.correct
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Hint panel (challenge-specific hint, always available) */}
            <div className="text-xs text-slate-400 italic">{currentChallenge.hint}</div>

            {/* Show steps reveal */}
            {showSteps && (
              <div className="p-4 bg-slate-950/40 rounded-lg border border-purple-500/30">
                <div className="text-xs font-mono uppercase tracking-wider text-purple-400 mb-2">Walkthrough</div>
                <StepsReveal challenge={currentChallenge} />
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
              {!showSteps && !feedback?.correct && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleShowSteps}
                >
                  Show steps
                </Button>
              )}
              {feedback?.correct && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleNext}
                >
                  {currentIndex + 1 < challenges.length ? 'Next Matrix →' : 'Finish'}
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

export default MatrixDisplay;
