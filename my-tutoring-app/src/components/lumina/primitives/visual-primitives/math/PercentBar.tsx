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

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PercentContext {
  problemType: 'addition' | 'subtraction' | 'direct' | 'comparison';
  initialValue: number;
  changeRate: number;
  discountFactor: number;
  finalValue: number;
}

export interface PracticeQuestion {
  question: string;
  targetPercent: number;
  hint: string;
  context: PercentContext;
}

export interface PercentBarData {
  title: string;
  description: string;
  scenario: string;

  wholeValue: number;
  wholeValueLabel: string;

  // Phase 1: Explore
  exploreQuestion: string;
  exploreTargetPercent: number;
  exploreHint: string;
  exploreContext: PercentContext;

  // Phase 2: Practice (2-3 questions)
  practiceQuestions: PracticeQuestion[];

  // Phase 3: Apply (main problem)
  mainQuestion: string;
  mainTargetPercent: number;
  mainHint: string;
  mainContext: PercentContext;

  // Visual configuration
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
// Internal challenge type for shared hooks
// ============================================================================

interface PercentChallenge {
  id: string;
  type: 'explore' | 'practice' | 'apply';
  question: string;
  targetPercent: number;
  hint: string;
  context: PercentContext;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  explore: { label: 'Explore', icon: '\uD83D\uDD0D', accentColor: 'cyan' },
  practice: { label: 'Practice', icon: '\uD83D\uDCDD', accentColor: 'purple' },
  apply: { label: 'Apply', icon: '\uD83C\uDFAF', accentColor: 'emerald' },
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
    scenario,
    wholeValue,
    wholeValueLabel,
    exploreQuestion,
    exploreTargetPercent,
    exploreHint,
    exploreContext,
    practiceQuestions = [],
    mainQuestion,
    mainTargetPercent,
    mainHint,
    mainContext,
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
  // Build unified challenges array
  // -------------------------------------------------------------------------
  const challenges = useMemo((): PercentChallenge[] => {
    const items: PercentChallenge[] = [
      {
        id: 'explore-0',
        type: 'explore',
        question: exploreQuestion,
        targetPercent: exploreTargetPercent,
        hint: exploreHint,
        context: exploreContext,
      },
    ];

    practiceQuestions.forEach((pq, i) => {
      items.push({
        id: `practice-${i}`,
        type: 'practice',
        question: pq.question,
        targetPercent: pq.targetPercent,
        hint: pq.hint,
        context: pq.context,
      });
    });

    items.push({
      id: 'apply-0',
      type: 'apply',
      question: mainQuestion,
      targetPercent: mainTargetPercent,
      hint: mainHint,
      context: mainContext,
    });

    return items;
  }, [
    exploreQuestion, exploreTargetPercent, exploreHint, exploreContext,
    practiceQuestions, mainQuestion, mainTargetPercent, mainHint, mainContext,
  ]);

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
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      Math.round(rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  const [currentPercent, setCurrentPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [hoveredBenchmark, setHoveredBenchmark] = useState<number | null>(null);

  // Hint tracking per phase
  const [exploreHintsUsed, setExploreHintsUsed] = useState(0);
  const [practiceHintsUsed, setPracticeHintsUsed] = useState(0);
  const [mainHintsUsed, setMainHintsUsed] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `percent-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const currentPhase = currentChallenge?.type ?? 'explore';
  const currentValue = (currentPercent / 100) * wholeValue;

  const practiceTotal = practiceQuestions.length;
  const currentPracticeIndex = currentPhase === 'practice'
    ? currentChallengeIndex - 1 // subtract explore challenge
    : 0;

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
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
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    wholeValue,
    wholeValueLabel,
    currentPercent,
    currentValue: (currentPercent / 100) * wholeValue,
    currentPhase,
    question: currentChallenge?.question ?? '',
    targetPercent: currentChallenge?.targetPercent ?? 0,
    context: currentChallenge?.context,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    attemptNumber: currentAttempts + 1,
  }), [
    wholeValue, wholeValueLabel, currentPercent, currentPhase,
    currentChallenge, challenges.length, currentChallengeIndex, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'percent-bar',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 5-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a percent bar activity about "${title}". `
      + `Scenario: "${scenario}". The whole value is ${wholeValue} (${wholeValueLabel}). `
      + `${challenges.length} challenges across 3 phases: Explore, Practice (${practiceTotal} problems), Apply. `
      + `First challenge: "${currentChallenge?.question}". `
      + `Introduce the activity warmly and read the first question.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, title, scenario, wholeValue, wholeValueLabel, practiceTotal, currentChallenge, sendText]);

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
    if (allChallengesComplete || hasSubmittedEvaluation) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setCurrentPercent(Math.round(percentage));
    setFeedback('');
    setFeedbackType('');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) handleBarInteraction(e);
  };

  const handleShowHint = () => {
    setShowHint(true);
    if (currentPhase === 'explore') setExploreHintsUsed(prev => prev + 1);
    else if (currentPhase === 'practice') setPracticeHintsUsed(prev => prev + 1);
    else if (currentPhase === 'apply') setMainHintsUsed(prev => prev + 1);

    sendText(
      `[HINT_REQUESTED] Student requested a hint for: "${currentChallenge?.question}". `
      + `Hint shown: "${currentChallenge?.hint}". Current percent: ${currentPercent}%, target: ${currentChallenge?.targetPercent}%. `
      + `Provide additional encouragement without revealing the answer.`,
      { silent: true },
    );
  };

  // -------------------------------------------------------------------------
  // Check answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    incrementAttempts();
    const target = currentChallenge.targetPercent;
    const correct = isWithinTolerance(currentPercent, target);
    const accuracy = getAccuracyScore(currentPercent, target);

    if (correct) {
      const partValue = ((target / 100) * wholeValue).toFixed(2);
      setFeedback(`${target}% of ${wholeValue} = ${partValue}!`);
      setFeedbackType('success');

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: accuracy,
      });

      sendText(
        `[ANSWER_CORRECT] Student set ${currentPercent}% (target: ${target}%). `
        + `Phase: ${currentPhase}. Accuracy: ${accuracy.toFixed(0)}%. Attempts: ${currentAttempts + 1}. `
        + `Congratulate briefly and explain: ${target}% of ${wholeValue} = ${partValue}.`,
        { silent: true },
      );
    } else {
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
        `[ANSWER_INCORRECT] Student set ${currentPercent}% but target is ${target}%. `
        + `Difference: ${Math.abs(diff)}%. Attempt ${currentAttempts + 1}. Phase: ${currentPhase}. `
        + `Give a directional hint without revealing the exact answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, currentPercent, currentAttempts, wholeValue, currentPhase,
      incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete — compute and submit evaluation
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their percent problem-solving!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const exploreResults = challengeResults.filter(r => r.challengeId.startsWith('explore'));
        const practiceResults = challengeResults.filter(r => r.challengeId.startsWith('practice'));
        const applyResults = challengeResults.filter(r => r.challengeId.startsWith('apply'));

        const exploreAccuracy = exploreResults.length > 0
          ? Math.round(exploreResults.reduce((s, r) => s + (r.score ?? 0), 0) / exploreResults.length) : 0;
        const practiceCorrect = practiceResults.filter(r => r.correct).length;
        const mainAccuracy = applyResults.length > 0
          ? Math.round(applyResults.reduce((s, r) => s + (r.score ?? 0), 0) / applyResults.length) : 0;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const totalHints = exploreHintsUsed + practiceHintsUsed + mainHintsUsed;
        const averageAccuracy = Math.round(
          challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / challenges.length,
        );

        const metrics: PercentBarMetrics = {
          type: 'percent-bar',
          allPhasesCompleted: true,
          finalSuccess: applyResults.every(r => r.correct),
          explorePhaseCompleted: exploreResults.every(r => r.correct),
          practicePhaseCompleted: practiceResults.every(r => r.correct),
          applyPhaseCompleted: applyResults.every(r => r.correct),
          exploreAccuracy,
          exploreAttempts: exploreResults.reduce((s, r) => s + r.attempts, 0),
          exploreHintsUsed,
          practiceQuestionsCorrect: practiceCorrect,
          practiceTotalQuestions: practiceTotal,
          practiceAttempts: practiceResults.reduce((s, r) => s + r.attempts, 0),
          practiceHintsUsed,
          mainProblemAccuracy: mainAccuracy,
          mainProblemAttempts: applyResults.reduce((s, r) => s + r.attempts, 0),
          mainProblemHintsUsed: mainHintsUsed,
          totalAttempts,
          totalHintsUsed: totalHints,
          averageAccuracy,
          targetPercent: mainTargetPercent,
          finalStudentPercent: currentPercent,
          percentageError: Math.abs(currentPercent - mainTargetPercent),
          solvedWithoutHints: totalHints === 0,
          firstAttemptSuccess: applyResults.length > 0 && applyResults[0].attempts === 1,
        };

        submitEvaluation(
          applyResults.every(r => r.correct),
          averageAccuracy,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset for next challenge
    setCurrentPercent(50);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
      + `Phase: ${nextChallenge.type}. Question: "${nextChallenge.question}". `
      + `Target: ${nextChallenge.targetPercent}%. Read the question to the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, currentChallengeIndex, currentPercent, mainTargetPercent,
    exploreHintsUsed, practiceHintsUsed, mainHintsUsed, practiceTotal, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Auto-submit when all challenges complete
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Overall score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

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
              Percent
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scenario */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-blue-200 text-sm italic">{scenario}</p>
        </div>

        {/* Phase Progress Tabs */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['explore', 'practice', 'apply'] as const).map((phase) => {
              const isActive = currentPhase === phase;
              const isDone = phase === 'explore'
                ? currentChallengeIndex > 0
                : phase === 'practice'
                ? currentChallengeIndex > practiceTotal
                : false;

              return (
                <Badge
                  key={phase}
                  className={`text-xs ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : isDone
                      ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-400/60'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {PHASE_TYPE_CONFIG[phase].icon}{' '}
                  {phase === 'practice'
                    ? `Practice (${Math.min(currentPracticeIndex + 1, practiceTotal)}/${practiceTotal})`
                    : PHASE_TYPE_CONFIG[phase].label}
                </Badge>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
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
            {/* Main Percent Bar */}
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
                {/* Shaded portion */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150 rounded-l-xl"
                  style={{ width: `${currentPercent}%` }}
                />

                {/* Benchmark lines */}
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

                {/* End labels */}
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
                className={`border ${
                  currentPhase === 'apply'
                    ? 'bg-emerald-500/10 border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                }`}
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation}
              >
                {currentPhase === 'apply' ? 'Submit Final Answer' : 'Check Answer'}
              </Button>
            )}
            {isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                {currentPhase === 'apply' ? 'See Results' : 'Next Challenge'}
              </Button>
            )}
          </div>
        )}

        {/* Hint */}
        {!allChallengesComplete && currentChallenge && (
          <div className="flex flex-col items-center gap-2">
            {!showHint ? (
              currentAttempts >= 1 && (
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

        {/* All complete summary */}
        {allChallengesComplete && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-1">
              All challenges complete!
            </p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all phases of this percent problem!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PercentBar;
