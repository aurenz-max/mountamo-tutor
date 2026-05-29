'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PercentBarMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PercentBarChallengeType = 'direct' | 'subtraction' | 'addition' | 'comparison';

export interface PercentContext {
  problemType: PercentBarChallengeType;
  initialValue: number;
  changeRate: number;
  discountFactor: number;
  finalValue: number;
}

export interface PercentBarChallenge {
  id: string;
  type: PercentBarChallengeType;
  scenario: string;
  wholeValue: number;
  wholeValueLabel: string;
  question: string;
  targetPercent: number;
  hint: string;
  context: PercentContext;
}

export interface PercentBarData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. */
  challenges: PercentBarChallenge[];

  // Session-level visual config
  showPercentLabels?: boolean;
  showValueLabels?: boolean;
  benchmarkLines?: number[];
  doubleBar?: boolean;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PercentBarMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_LABEL: Record<PercentBarChallengeType, string> = {
  direct: 'Direct',
  subtraction: 'Discount',
  addition: 'Tax / Tip',
  comparison: 'Compare',
};

const PHASE_CONFIG: Record<PercentBarChallengeType, PhaseConfig> = {
  direct: { label: 'Direct', icon: '📊', accentColor: 'emerald' },
  subtraction: { label: 'Discount', icon: '🏷️', accentColor: 'purple' },
  addition: { label: 'Tax / Tip', icon: '💰', accentColor: 'cyan' },
  comparison: { label: 'Compare', icon: '⚖️', accentColor: 'amber' },
};

const TOLERANCE = 2; // ±2% for accepting answers

// ============================================================================
// Props
// ============================================================================

interface PercentBarProps {
  data: PercentBarData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const PercentBar: React.FC<PercentBarProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges,
    showPercentLabels = true,
    showValueLabels = true,
    benchmarkLines = [25, 50, 75],
    doubleBar = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared hooks for challenge progression
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress<PercentBarChallenge>({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG,
    getScore: (rs) =>
      Math.round(
        rs.reduce(
          (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
          0,
        ) / Math.max(rs.length, 1),
      ),
  });

  // -------------------------------------------------------------------------
  // Local state (per-challenge)
  // -------------------------------------------------------------------------
  const [currentPercent, setCurrentPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [hoveredBenchmark, setHoveredBenchmark] = useState<number | null>(null);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `percent-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const challengeType = currentChallenge?.type ?? challenges[0]?.type ?? 'direct';
  const wholeValue = currentChallenge?.wholeValue ?? 100;
  const wholeValueLabel = currentChallenge?.wholeValueLabel ?? 'Total';
  const currentValue = (currentPercent / 100) * wholeValue;
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<PercentBarMetrics>({
    primitiveType: 'percent-bar',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (scalar session-level + active-challenge fields)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    scenario: currentChallenge?.scenario ?? '',
    wholeValue,
    wholeValueLabel,
    question: currentChallenge?.question ?? '',
    targetPercent: currentChallenge?.targetPercent ?? 0,
    currentPercent,
    currentValue,
    attemptNumber: currentAttempts + 1,
  }), [
    challengeType, currentChallengeIndex, challenges.length, currentChallenge,
    wholeValue, wholeValueLabel, currentPercent, currentValue, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'percent-bar',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 5-8',
  });

  // Activity introduction (fires once on connect)
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = challenges[0];
    sendText(
      `[ACTIVITY_START] Percent bar session: ${challenges.length} ${CHALLENGE_TYPE_LABEL[challengeType]} problems. `
      + `Title: "${title}". First scenario: "${first.scenario}" — "${first.question}". `
      + `Introduce warmly and read the first question.`,
      { silent: true },
    );
  }, [isConnected, challenges, challengeType, title, sendText]);

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setCurrentPercent(50);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setIsDragging(false);
    setHoveredBenchmark(null);
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const isWithinTolerance = (studentPct: number, targetPct: number): boolean =>
    Math.abs(studentPct - targetPct) <= TOLERANCE;

  const getAccuracyScore = (studentPct: number, targetPct: number): number => {
    const error = Math.abs(studentPct - targetPct);
    if (error === 0) return 100;
    if (error <= TOLERANCE) return 100 - (error / TOLERANCE) * 10;
    return Math.max(0, 100 - error * 2);
  };

  // -------------------------------------------------------------------------
  // Bar interaction handlers
  // -------------------------------------------------------------------------
  const handleBarInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    if (allChallengesComplete || hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const rounded = Math.round(percentage);
    if (rounded !== currentPercent) SoundManager.tick(); // slider-style increment
    setCurrentPercent(rounded);
    setFeedback('');
    setFeedbackType('');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) handleBarInteraction(e);
  };

  const handleShowHint = () => {
    if (!currentChallenge) return;
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      hintsViewedRef.current += 1;
    }
    sendText(
      `[HINT_REQUESTED] Student requested a hint for: "${currentChallenge.question}". `
      + `Hint shown: "${currentChallenge.hint}". Current percent: ${currentPercent}%, target: ${currentChallenge.targetPercent}%. `
      + `Provide additional encouragement without revealing the answer.`,
      { silent: true },
    );
  };

  // -------------------------------------------------------------------------
  // Check answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    if (recordedRef.current) return; // stale-state guard

    incrementAttempts();
    const attempts = currentAttempts + 1;
    const target = currentChallenge.targetPercent;
    const correct = isWithinTolerance(currentPercent, target);
    const accuracy = getAccuracyScore(currentPercent, target);

    if (correct) {
      SoundManager.playCorrect();
      const partValue = ((target / 100) * currentChallenge.wholeValue).toFixed(2);
      setFeedback(`${target}% of ${currentChallenge.wholeValue} = ${partValue}.`);
      setFeedbackType('success');

      // Standard per-challenge score (PRD §5 rule 11): 100 first try, -20 per extra, floor 20.
      const score = Math.max(20, 100 - (attempts - 1) * 20);
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score,
        accuracy: Math.round(accuracy),
      });

      sendText(
        `[ANSWER_CORRECT] Student placed ${currentPercent}% (target: ${target}%). `
        + `Accuracy: ${accuracy.toFixed(0)}%. Attempts: ${attempts}. `
        + `Congratulate briefly and explain: ${target}% of ${currentChallenge.wholeValue} = ${partValue}.`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      const diff = currentPercent - target;
      if (Math.abs(diff) <= 5) {
        setFeedback(`Very close! You're at ${currentPercent}%, adjust slightly.`);
        setFeedbackType('info');
      } else if (diff > 0) {
        setFeedback(`Too high at ${currentPercent}%. Try lower.`);
        setFeedbackType('error');
      } else {
        setFeedback(`Too low at ${currentPercent}%. Try higher.`);
        setFeedbackType('error');
      }

      sendText(
        `[ANSWER_INCORRECT] Student placed ${currentPercent}% but target is ${target}%. `
        + `Difference: ${Math.abs(diff)}%. Attempt ${attempts}. `
        + `Give a directional hint without revealing the exact answer.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, currentPercent, currentAttempts,
    incrementAttempts, recordResult, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) return;
    const nextIdx = currentChallengeIndex + 1;
    const next = challenges[nextIdx];
    if (next) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${nextIdx + 1} of ${challenges.length}. `
        + `Scenario: "${next.scenario}". Question: "${next.question}". `
        + `Target: ${next.targetPercent}%. Read the question to the student.`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session-complete: build canonical 9-field metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;

    const total = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const avgScore = Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / Math.max(challengeResults.length, 1),
    );

    const metrics: PercentBarMetrics = {
      type: 'percent-bar',
      challengeType,
      totalChallenges: total,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: avgScore,
      averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };

    const goalMet = correctCount === total;
    submitEvaluation(goalMet, avgScore, metrics, { challengeResults });

    sendText(
      `[ALL_COMPLETE] All ${total} percent problems done. Correct: ${correctCount}/${total}. `
      + `First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give an encouraging summary.`,
      { silent: true },
    );
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults,
    challengeType, submitEvaluation, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Overall score (for local display when evaluation hook hasn't settled yet)
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {CHALLENGE_TYPE_LABEL[challengeType]}
            </Badge>
            {challenges.length > 0 && (
              <span className="text-slate-500 text-xs">
                {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
              </span>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scenario */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-200 text-sm italic">{currentChallenge.scenario}</p>
          </div>
        )}

        {/* Current Question */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.question}
            </p>
          </div>
        )}

        {/* Current Values Display */}
        {!allChallengesComplete && (
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Percentage</div>
              <div className="text-3xl font-bold text-emerald-400">{currentPercent}%</div>
            </div>
            {showValueLabels && (
              <>
                <div className="text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Part Value</div>
                  <div className="text-3xl font-bold text-white">{currentValue.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{wholeValueLabel}</div>
                  <div className="text-3xl font-bold text-slate-400">{wholeValue}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Percent Bar Visualization */}
        {!allChallengesComplete && (
          <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
            <div className="relative">
              {showPercentLabels && (
                <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">
                  Percentage (0% - 100%)
                </div>
              )}

              <div
                className="relative h-14 bg-slate-700/60 rounded-xl cursor-pointer shadow-inner overflow-hidden border border-white/10"
                onClick={handleBarInteraction}
                onMouseMove={handleMouseMove}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150 rounded-l-xl"
                  style={{ width: `${currentPercent}%` }}
                />

                {benchmarkLines.map((benchmark, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-slate-400/40 cursor-help z-10"
                    style={{ left: `${benchmark}%` }}
                    onMouseEnter={() => setHoveredBenchmark(benchmark)}
                    onMouseLeave={() => setHoveredBenchmark(null)}
                  >
                    {showPercentLabels && (
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs transition-all ${
                        hoveredBenchmark === benchmark ? 'text-emerald-300 font-bold' : 'text-slate-500'
                      }`}>
                        {benchmark}%
                      </div>
                    )}
                    {hoveredBenchmark === benchmark && showValueLabels && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-white text-xs rounded whitespace-nowrap pointer-events-none z-20">
                        {((benchmark / 100) * wholeValue).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}

                {showPercentLabels && (
                  <>
                    <div className="absolute -bottom-6 left-0 text-xs text-slate-500 font-mono">0%</div>
                    <div className="absolute -bottom-6 right-0 text-xs text-slate-500 font-mono">100%</div>
                  </>
                )}
              </div>
            </div>

            {/* Double bar: actual value bar */}
            {doubleBar && (
              <div className="relative mt-8">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Actual Value (0 - {wholeValue})
                </div>

                <div className="relative h-10 bg-slate-700/60 rounded-xl shadow-inner border border-white/10">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-150 rounded-l-xl"
                    style={{ width: `${currentPercent}%` }}
                  />

                  {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
                    const value = fraction * wholeValue;
                    const pct = fraction * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full w-px bg-slate-400/40"
                        style={{ left: `${pct}%` }}
                      >
                        {showValueLabels && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-500 font-mono">
                            {value % 1 === 0 ? value : value.toFixed(1)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calculation Display */}
        {!allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Calculation</div>
            <div className="text-lg font-mono">
              <span className="text-emerald-400">{currentPercent}%</span>
              {' of '}
              <span className="text-white">{wholeValue}</span>
              {' = '}
              <span className="text-emerald-300 font-bold">{currentValue.toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              ({currentPercent} &divide; 100) &times; {wholeValue} = {currentValue.toFixed(2)}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            feedbackType === 'info' ? 'text-amber-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </Button>
            )}
          </div>
        )}

        {/* Hint */}
        {!allChallengesComplete && currentChallenge && (
          <div className="flex flex-col items-center gap-2">
            {!showHint ? (
              currentAttempts >= 1 && !isCurrentChallengeComplete && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs"
                  onClick={handleShowHint}
                >
                  Show Hint
                </Button>
              )
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 max-w-md">
                <p className="text-amber-300 text-xs">
                  <span className="font-semibold">Hint:</span> {currentChallenge.hint}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Drag instruction */}
        {!allChallengesComplete && (
          <div className="text-center text-xs text-slate-600">
            Click or drag on the bar to adjust the percentage
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Session Complete!"
            celebrationMessage={`You completed all ${challenges.length} percent problems.`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PercentBar;
