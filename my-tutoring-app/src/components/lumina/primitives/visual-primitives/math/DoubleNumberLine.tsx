'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type DoubleNumberLineMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

/**
 * Double Number Line — Multi-instance proportional reasoning primitive.
 *
 * A single session walks the student through 3-6 ratio challenges that all
 * share ONE ratio relationship (same topLabel / bottomLabel / unitRate) for
 * context coherence. Each challenge highlights one target ask-point; the
 * student enters the missing value, gets feedback, and advances.
 *
 * The 3-phase explore→practice→apply walk from the previous design was
 * collapsed per PRD §5 rule 13: the IRT-pinned challengeType IS the phase.
 */

export type DoubleNumberLineChallengeType =
  | 'equivalent_ratios'
  | 'find_missing'
  | 'unit_rate';

export interface LinkedPoint {
  topValue: number;
  bottomValue: number;
  label?: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  interval: number;
}

export interface DoubleNumberLineChallenge {
  id: string;
  challengeType: DoubleNumberLineChallengeType;
  prompt: string;
  hint: string;
  givenPoints: LinkedPoint[];
  targetPoints: LinkedPoint[];
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
}

export interface DoubleNumberLineData {
  title: string;
  description: string;
  topLabel: string;
  bottomLabel: string;
  unitRate: number;
  contextQuestion: string;
  /** 3-6 challenges. Required. Walked sequentially. */
  challenges: DoubleNumberLineChallenge[];

  showVerticalGuides?: boolean;
  showUnitRate?: boolean;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult<DoubleNumberLineMetrics>
  ) => void;
}

interface DoubleNumberLineProps {
  data: DoubleNumberLineData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Number stepper input
// ---------------------------------------------------------------------------

interface LuminaNumberStepperProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  borderColor?: string;
}

const LuminaNumberStepper: React.FC<LuminaNumberStepperProps> = ({
  value,
  onChange,
  step = 1,
  placeholder = '?',
  disabled = false,
  autoFocus = false,
  borderColor = 'border-slate-600',
}) => {
  const numValue = parseFloat(value);

  const handleStep = (direction: 1 | -1) => {
    if (disabled) return;
    const current = isNaN(numValue) ? 0 : numValue;
    const next = Math.round((current + direction * step) * 100) / 100;
    onChange(String(next));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-' || /^-?\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <div className="flex items-stretch gap-0">
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={disabled}
        className="px-3 bg-slate-800/60 border-2 border-r-0 border-slate-600 rounded-l-lg text-slate-300 hover:bg-purple-500/20 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg select-none"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleTextChange}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`flex-1 min-w-0 px-4 py-2.5 bg-slate-900 border-2 ${borderColor} text-white text-base font-semibold text-center focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors`}
      />
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={disabled}
        className="px-3 bg-slate-800/60 border-2 border-l-0 border-slate-600 rounded-r-lg text-slate-300 hover:bg-purple-500/20 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg select-none"
      >
        +
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase config (one phase — every challenge in a session shares challengeType)
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  equivalent_ratios: { label: 'Equivalent Ratios', icon: '⚖️', accentColor: 'purple' },
  find_missing: { label: 'Find Missing', icon: '🔍', accentColor: 'amber' },
  unit_rate: { label: 'Unit Rate', icon: '🎯', accentColor: 'emerald' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DoubleNumberLine: React.FC<DoubleNumberLineProps> = ({ data, className }) => {
  const {
    title,
    description,
    topLabel,
    bottomLabel,
    unitRate,
    contextQuestion,
    challenges = [],
    showVerticalGuides = true,
    showUnitRate = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `double-number-line-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress (shared hooks) ──────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (c) => c.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation hook ───────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<DoubleNumberLineMetrics>({
    primitiveType: 'double-number-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentChallenge = challenges[currentIndex] ?? null;

  // ── Per-challenge interaction state ────────────────────────────────────────
  // One input string per target point in the current challenge.
  const [studentValues, setStudentValues] = useState<string[]>(
    () => (currentChallenge?.targetPoints ?? []).map(() => ''),
  );
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // Reset per-challenge state when the active challenge changes.
  useEffect(() => {
    if (!currentChallenge) return;
    setStudentValues(currentChallenge.targetPoints.map(() => ''));
    setFeedback(null);
    setShowHint(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── AI tutoring ────────────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    topLabel,
    bottomLabel,
    unitRate,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.challengeType,
    currentPrompt: currentChallenge?.prompt,
    targetTopValue: currentChallenge?.targetPoints[0]?.topValue,
    targetBottomValue: currentChallenge?.targetPoints[0]?.bottomValue,
    attemptNumber: currentAttempts,
  }), [
    title, topLabel, bottomLabel, unitRate, currentIndex,
    challenges.length, currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'double-number-line',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 6',
  });

  // Session intro — once, on the first challenge
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    if (challenges.length === 0 || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Double number line: ${topLabel} vs ${bottomLabel}. `
      + `${challenges.length} ratio challenges in this session (mode: ${currentChallenge.challengeType}). `
      + `${contextQuestion ? `Context: "${contextQuestion}". ` : ''}`
      + `First challenge: ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [
    isConnected, challenges.length, currentChallenge, topLabel, bottomLabel,
    contextQuestion, sendText,
  ]);

  // Per-challenge handoff (skips the first because intro covers it)
  const lastAnnouncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge) return;
    if (!hasIntroducedRef.current) return;
    if (lastAnnouncedIdRef.current === null) {
      lastAnnouncedIdRef.current = currentChallenge.id;
      return;
    }
    if (lastAnnouncedIdRef.current === currentChallenge.id) return;
    lastAnnouncedIdRef.current = currentChallenge.id;
    sendText(
      `[CHALLENGE_START] Challenge ${currentIndex + 1} of ${challenges.length}. ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [currentChallenge, currentIndex, challenges.length, isConnected, sendText]);

  // ── Session complete: evaluation submit ────────────────────────────────────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.attempts === 1 && r.correct).length;
    const hintsViewed = results.filter((r) => r.attempts > 1).length;
    const perChallengeScore = (r: typeof results[number]) =>
      r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + perChallengeScore(r), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const sessionMode = challenges[0].challengeType;
    const metrics: DoubleNumberLineMetrics = {
      type: 'double-number-line',
      challengeType: sessionMode,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    const phaseStr = phaseResults
      .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseStr}. Overall: ${overallAccuracy}%. `
      + `Celebrate completion of the ${challenges.length}-challenge ratio session.`,
      { silent: true },
    );

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionMode,
          prompts: challenges.map((c) => c.prompt),
          attemptsPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return r?.attempts ?? 0;
          }),
        },
      });
    }
  }, [
    isComplete, results, phaseResults, challenges,
    sendText, submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const isWithinTolerance = (student: number, target: number, tolerance = 0.1): boolean =>
    Math.abs(student - target) <= tolerance;

  const handleCheckAnswers = useCallback(() => {
    if (!currentChallenge || feedback === 'correct' || isComplete) return;

    // Stale-state guard: setStudentValues from the reset effect is async — on
    // the render immediately after advance(), `studentValues` still holds the
    // previous challenge's values while `currentChallenge` has already moved
    // on. Only proceed when the slot count matches.
    if (studentValues.length !== currentChallenge.targetPoints.length) return;

    incrementAttempts();

    let allCorrect = true;
    for (let i = 0; i < currentChallenge.targetPoints.length; i++) {
      const target = currentChallenge.targetPoints[i];
      const studentBottom = parseFloat(studentValues[i]);
      if (isNaN(studentBottom) || !isWithinTolerance(studentBottom, target.bottomValue)) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      setFeedback('correct');
      if (!recordedRef.current) {
        recordedRef.current = true;
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
        });
        sendText(
          `[PHASE_COMPLETE] Challenge ${currentIndex + 1}/${challenges.length} solved on attempt ${currentAttempts + 1}.`,
          { silent: true },
        );
      }
    } else {
      setFeedback('incorrect');
      setShowHint(true);
    }
  }, [
    currentChallenge, feedback, isComplete, studentValues,
    incrementAttempts, recordResult, currentAttempts,
    sendText, currentIndex, challenges.length,
  ]);

  const handleAdvance = () => {
    advance();
  };

  // ── Position helpers (per current challenge's scales) ──────────────────────
  const topScale = currentChallenge?.topScale;
  const bottomScale = currentChallenge?.bottomScale;

  const getTopPosition = (value: number): number => {
    if (!topScale) return 0;
    return ((value - topScale.min) / Math.max(0.0001, topScale.max - topScale.min)) * 100;
  };
  const getBottomPosition = (value: number): number => {
    if (!bottomScale) return 0;
    return ((value - bottomScale.min) / Math.max(0.0001, bottomScale.max - bottomScale.min)) * 100;
  };

  const topTicks = useMemo(() => {
    if (!topScale) return [];
    const count = Math.floor((topScale.max - topScale.min) / topScale.interval) + 1;
    return Array.from({ length: count }, (_, i) => {
      const value = topScale.min + i * topScale.interval;
      return { value: Math.round(value * 100) / 100, position: getTopPosition(value) };
    });
  }, [topScale]);

  const bottomTicks = useMemo(() => {
    if (!bottomScale) return [];
    const count = Math.floor((bottomScale.max - bottomScale.min) / bottomScale.interval) + 1;
    return Array.from({ length: count }, (_, i) => {
      const value = bottomScale.min + i * bottomScale.interval;
      return { value: Math.round(value * 100) / 100, position: getBottomPosition(value) };
    });
  }, [bottomScale]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-12 ${className || ''}`}>
        <div className="backdrop-blur-xl bg-slate-900/40 rounded-3xl border border-white/10 p-6 text-center">
          <p className="text-slate-300">No double-number-line challenges available.</p>
        </div>
      </div>
    );
  }

  const allInputsFilled =
    !!currentChallenge && studentValues.every((v) => v !== '' && !isNaN(parseFloat(v)));

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Double Number Line</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">
              {currentChallenge ? currentChallenge.challengeType.replace(/_/g, ' ') : 'Proportional Reasoning'}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="relative z-10">
          {/* Title + description */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>

            {/* Umbrella context — shared across all challenges */}
            {contextQuestion && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200 font-medium">{contextQuestion}</p>
              </div>
            )}
          </div>

          {/* Progress dots */}
          {!isComplete && challenges.length > 1 && (
            <div className="mb-8 flex items-center justify-center gap-3 text-xs text-purple-300 font-mono uppercase tracking-wider">
              <span>Challenge {Math.min(currentIndex + 1, challenges.length)} of {challenges.length}</span>
              <div className="flex gap-1.5">
                {challenges.map((ch, idx) => {
                  const done = results.some((r) => r.challengeId === ch.id);
                  const isCurrent = idx === currentIndex && !isComplete;
                  return (
                    <div
                      key={ch.id}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        done
                          ? 'bg-green-400/70 border-green-300/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : isCurrent
                          ? 'bg-purple-400/70 border-purple-300/80 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                          : 'bg-slate-700/40 border-slate-600/50'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-challenge prompt */}
          {!isComplete && currentChallenge && (
            <div className="mb-8 rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-center max-w-2xl mx-auto">
              <p className="text-purple-100 text-base font-medium">{currentChallenge.prompt}</p>
            </div>
          )}

          {/* Double Number Line Visualization */}
          {!isComplete && currentChallenge && topScale && bottomScale && (
            <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-24">
              {/* Top Number Line */}
              <div className="relative">
                <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                  {topLabel}
                </div>
                <div className="relative h-1 bg-slate-600 rounded-full">
                  {/* Ticks */}
                  {topTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                      style={{ left: `${tick.position}%` }}
                    >
                      <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                        {tick.value}
                      </span>
                    </div>
                  ))}

                  {/* Given (hint) points */}
                  {currentChallenge.givenPoints.map((point, i) => {
                    const position = getTopPosition(point.topValue);
                    const isUnitRate = showUnitRate && Math.abs(point.topValue - 1) < 0.01;
                    return (
                      <div
                        key={`given-top-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className={`w-4 h-4 rounded-full ${isUnitRate ? 'bg-yellow-500' : 'bg-purple-500'} border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)]`} />
                        {point.label && (
                          <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs rounded whitespace-nowrap ${isUnitRate ? 'bg-yellow-600 text-white' : 'bg-purple-600 text-white'}`}>
                            {isUnitRate ? 'Unit Rate' : point.label}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Target points — show top value (always given to student) */}
                  {currentChallenge.targetPoints.map((point, i) => {
                    const position = getTopPosition(point.topValue);
                    return (
                      <div
                        key={`target-top-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-300" />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                          {point.topValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vertical Alignment Guides for given points */}
              {showVerticalGuides && currentChallenge.givenPoints.map((point, i) => {
                const topPosition = getTopPosition(point.topValue);
                return (
                  <div
                    key={`guide-${i}`}
                    className="absolute h-24 w-px -mt-12 bg-purple-400/20 pointer-events-none"
                    style={{ left: `${topPosition}%`, transform: 'translateX(-50%)' }}
                  />
                );
              })}

              {/* Bottom Number Line */}
              <div className="relative">
                <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                  {bottomLabel}
                </div>
                <div className="relative h-1 bg-slate-600 rounded-full">
                  {/* Ticks */}
                  {bottomTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                      style={{ left: `${tick.position}%` }}
                    >
                      <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                        {tick.value}
                      </span>
                    </div>
                  ))}

                  {/* Given (hint) points on bottom */}
                  {currentChallenge.givenPoints.map((point, i) => {
                    const position = getBottomPosition(point.bottomValue);
                    return (
                      <div
                        key={`given-bottom-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                          {point.bottomValue}
                        </div>
                      </div>
                    );
                  })}

                  {/* Student-entered values on bottom */}
                  {currentChallenge.targetPoints.map((point, i) => {
                    const position = getBottomPosition(point.bottomValue);
                    const studentValue = parseFloat(studentValues[i] ?? '');
                    const hasValue = !isNaN(studentValue);
                    const studentPosition = hasValue ? getBottomPosition(studentValue) : position;
                    return (
                      <div
                        key={`target-bottom-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${hasValue && feedback !== 'correct' ? studentPosition : position}%` }}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          feedback === 'correct'
                            ? 'bg-green-500 border-green-300'
                            : hasValue
                            ? 'bg-blue-400 border-blue-300'
                            : 'bg-slate-700 border-slate-500'
                        }`} />
                        {hasValue && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                            {studentValue}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Input section */}
          {!isComplete && currentChallenge && (
            <div className="mt-12 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {currentChallenge.targetPoints.map((target, i) => {
                  const studentVal = parseFloat(studentValues[i] ?? '');
                  const filled = !isNaN(studentVal);
                  const correctClass = feedback === 'correct'
                    ? 'bg-green-500/10 border-green-500/50'
                    : feedback === 'incorrect' && filled
                    ? 'bg-red-500/10 border-red-500/50'
                    : filled
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-slate-800/40 border-slate-700/50';
                  return (
                    <div
                      key={i}
                      className={`p-5 rounded-xl border-2 transition-all ${correctClass}`}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                            {topLabel} = <span className="text-purple-300">{target.topValue}</span>
                          </label>
                          <div className="text-xs text-slate-500 mb-1">What is {bottomLabel}?</div>
                          <LuminaNumberStepper
                            value={studentValues[i] ?? ''}
                            onChange={(val) => {
                              if (feedback === 'correct') return;
                              setStudentValues((prev) => {
                                const next = [...prev];
                                next[i] = val;
                                return next;
                              });
                              setFeedback(null);
                            }}
                            step={1}
                            autoFocus={i === 0}
                            disabled={feedback === 'correct'}
                            borderColor={
                              feedback === 'correct'
                                ? 'border-green-500'
                                : feedback === 'incorrect' && filled
                                ? 'border-red-500'
                                : 'border-slate-600'
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`p-4 rounded-lg border max-w-2xl mx-auto ${
                  feedback === 'correct'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <p className={`text-sm ${feedback === 'correct' ? 'text-green-200' : 'text-red-200'}`}>
                    {feedback === 'correct'
                      ? `Correct! ${currentIndex + 1 < challenges.length ? 'Ready for the next one?' : 'Last challenge complete!'}`
                      : 'Not quite — check your work and try again.'}
                  </p>
                  {feedback === 'incorrect' && showHint && currentChallenge.hint && (
                    <p className="text-xs text-red-100/80 mt-2 font-light">
                      Hint: {currentChallenge.hint}
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4 justify-center flex-wrap">
                {feedback !== 'correct' && (
                  <button
                    onClick={handleCheckAnswers}
                    disabled={!allInputsFilled}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                  >
                    Check Answer
                  </button>
                )}
                {feedback === 'correct' && (
                  <button
                    onClick={handleAdvance}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    {currentIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish Session'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Session-complete summary panel */}
          {isComplete && phaseResults.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={submittedResult?.score}
              durationMs={elapsedMs}
              heading="Ratio Session Complete!"
              celebrationMessage={`You worked through ${challenges.length} proportional reasoning ${challenges.length === 1 ? 'challenge' : 'challenges'}!`}
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DoubleNumberLine;
