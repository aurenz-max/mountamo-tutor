'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaButton,
  LuminaFeedbackCard,
  type FeedbackStatus,
} from '../../../ui';
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

/**
 * Multi-step challenges. A challenge can be a single bar placement (direct,
 * subtraction) OR an ordered sequence of sub-steps (addition: tip portion →
 * total; comparison: price A → price B → choose). Each step is either a bar
 * PLACEMENT or a tap-to-CHOOSE decision. Single-step challenges omit `steps`
 * and the component synthesises one place-step from the legacy fields.
 */
export type PercentBarStepKind = 'place' | 'choice';

export interface PercentBarPlaceStep {
  kind: 'place';
  /** Sub-question shown for this step. */
  prompt: string;
  /** Whole the percent is taken of for THIS step (goods can differ). */
  wholeValue: number;
  wholeValueLabel: string;
  targetPercent: number;
  /** Bar scale max (default 100). Tax/tip "total" steps extend past 100%. */
  maxPercent?: number;
  /** Readout label for the live value (e.g. 'Tip', 'Total', 'Sale Price'). */
  valueLabel?: string;
  /** Short identifier shown in the "established so far" recap card on later steps
   *  (e.g. 'Markup', 'Store A'). Lets a later step reference what was just found. */
  recapLabel?: string;
  hint: string;
}

export interface PercentBarChoiceOption {
  id: string;
  label: string;
  /** Optional secondary line, e.g. the computed price the student found. */
  sublabel?: string;
}

export interface PercentBarChoiceStep {
  kind: 'choice';
  prompt: string;
  options: PercentBarChoiceOption[];
  correctOptionId: string;
  hint: string;
}

export type PercentBarStep = PercentBarPlaceStep | PercentBarChoiceStep;

export interface PercentBarChallenge {
  id: string;
  type: PercentBarChallengeType;
  scenario: string;
  wholeValue: number;
  wholeValueLabel: string;
  question: string;
  targetPercent: number;
  /** Bar scale maximum (default 100). Tax/tip/markup "total" challenges extend
   *  past 100% so the total (100% + added rate) can sit above the whole. */
  maxPercent?: number;
  /** Ordered sub-steps. When present, the challenge is multi-step and the
   *  legacy question/target fields above act only as a representative summary. */
  steps?: PercentBarStep[];
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
  /** Gates the live "currentPercent% of whole = value" calculation panel.
   *  Default true. Withdrawn at the hard support tier so the panel can't be
   *  used to dial the answer value instead of placing the percent. */
  showCalculation?: boolean;
  /** Within-mode support tier (set by the generator when a tier is active).
   *  Keeps the AI tutor's reveal level in sync with the on-screen scaffold. */
  supportTier?: 'easy' | 'medium' | 'hard';

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

/** Synthesize the step list for a challenge. Single-step (direct/subtraction)
 *  challenges have no `steps` array — build one place-step from legacy fields. */
function challengeToSteps(ch: PercentBarChallenge): PercentBarStep[] {
  if (ch.steps && ch.steps.length > 0) return ch.steps;
  return [
    {
      kind: 'place',
      prompt: ch.question,
      wholeValue: ch.wholeValue,
      wholeValueLabel: ch.wholeValueLabel,
      targetPercent: ch.targetPercent,
      maxPercent: ch.maxPercent,
      hint: ch.hint,
    },
  ];
}

/**
 * Mode-aware tutor reveal clause — keeps the AI tutor in sync with the on-screen
 * support tier so it does not leak what the tier withheld.
 *  - easy: tutor may name the percent-of-whole strategy and walk the setup.
 *  - medium: nudge execution; do not solve.
 *  - hard: never gift the target percent or the answer arithmetic — ask what the
 *    student sees / reads in the scenario. (subtraction never states the 100-rate
 *    answer; comparison never names which is larger.)
 */
function tierRevealClause(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  type: PercentBarChallengeType,
): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return type === 'subtraction'
      ? ' SUPPORT TIER easy: you may name the strategy (start at 100%, subtract the discount) and walk the setup step by step.'
      : ' SUPPORT TIER easy: you may name the percent-of-whole strategy and walk the student through where the percent sits on the 0%-100% bar.';
  }
  if (tier === 'medium') {
    return ' SUPPORT TIER medium: the on-screen aids are partly withdrawn — nudge the student toward the next step, do not solve it for them.';
  }
  // hard
  return ' SUPPORT TIER hard: aids are off. Do NOT name the target percent or the arithmetic that produces it. Ask what the scenario states and where that lands on the bar; the student works unaided.';
}

// Map the local feedback channel to the kit's feedback-card status.
const FEEDBACK_STATUS: Record<'success' | 'error' | 'info', FeedbackStatus> = {
  success: 'correct',
  error: 'incorrect',
  info: 'insight',
};

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
    showCalculation = true,
    supportTier,
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
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
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
  // Local state (per-challenge / per-step)
  // -------------------------------------------------------------------------
  const [currentPercent, setCurrentPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [hoveredBenchmark, setHoveredBenchmark] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepAttempts, setStepAttempts] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  /** Values the student has locked in on earlier steps of THIS challenge, shown
   *  as a recap card on later steps (e.g. the markup found before the total). */
  const [established, setEstablished] = useState<
    { label: string; percent: number; value: number }[]
  >([]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `percent-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  /** Per-step results accumulated within the CURRENT challenge (cleared on advance). */
  const stepLogRef = useRef<{ attempts: number; accuracy: number }[]>([]);

  // -------------------------------------------------------------------------
  // Derived state — challenge + active step
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const challengeType = currentChallenge?.type ?? challenges[0]?.type ?? 'direct';

  const steps = useMemo(
    () => (currentChallenge ? challengeToSteps(currentChallenge) : []),
    [currentChallenge],
  );
  const currentStep = steps[currentStepIndex] ?? null;
  const isMultiStep = steps.length > 1;
  const placeStep = currentStep?.kind === 'place' ? currentStep : null;
  const choiceStep = currentStep?.kind === 'choice' ? currentStep : null;

  const wholeValue = placeStep?.wholeValue ?? currentChallenge?.wholeValue ?? 100;
  const wholeValueLabel = placeStep?.wholeValueLabel ?? currentChallenge?.wholeValueLabel ?? 'Total';
  const maxPercent = placeStep?.maxPercent ?? 100;
  const isExtendedBar = maxPercent > 100;
  const currentValue = (currentPercent / 100) * wholeValue;
  const partValueLabel =
    placeStep?.valueLabel ?? (challengeType === 'addition' ? 'Running Total' : 'Part Value');

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
  // AI Tutoring Integration (scalar session-level + active-step fields)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    currentStepIndex: currentStepIndex + 1,
    totalSteps: steps.length,
    scenario: currentChallenge?.scenario ?? '',
    wholeValue,
    wholeValueLabel,
    question: currentStep
      ? currentStep.kind === 'choice'
        ? currentStep.prompt
        : currentStep.prompt
      : currentChallenge?.question ?? '',
    targetPercent: placeStep?.targetPercent ?? 0,
    currentPercent,
    currentValue,
    attemptNumber: stepAttempts + 1,
    ...(supportTier ? { supportTier } : {}),
  }), [
    challengeType, currentChallengeIndex, challenges.length, currentStepIndex, steps.length,
    currentChallenge, currentStep, placeStep, wholeValue, wholeValueLabel,
    currentPercent, currentValue, stepAttempts, supportTier,
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
    const firstSteps = challengeToSteps(first);
    const firstPrompt = firstSteps[0]?.kind === 'place' ? firstSteps[0].prompt
      : firstSteps[0]?.kind === 'choice' ? firstSteps[0].prompt : first.question;
    sendText(
      `[ACTIVITY_START] Percent bar session: ${challenges.length} ${CHALLENGE_TYPE_LABEL[challengeType]} problems`
      + `${firstSteps.length > 1 ? ` (each is a ${firstSteps.length}-step problem)` : ''}. `
      + `Title: "${title}". First scenario: "${first.scenario}" — "${firstPrompt}". `
      + `Introduce warmly and read the first question.`
      + tierRevealClause(supportTier, first.type),
      { silent: true },
    );
  }, [isConnected, challenges, challengeType, title, supportTier, sendText]);

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setCurrentStepIndex(0);
    setEstablished([]);
    stepLogRef.current = [];
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]);

  // -------------------------------------------------------------------------
  // Per-step reset — fires on challenge change AND on step change
  // -------------------------------------------------------------------------
  useEffect(() => {
    setCurrentPercent(50);
    setSelectedOption(null);
    setStepAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setIsDragging(false);
    setHoveredBenchmark(null);
    hintViewedRef.current = false;
  }, [currentChallenge?.id, currentStepIndex]);

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
    if (allChallengesComplete || hasSubmittedEvaluation || isCurrentChallengeComplete || !placeStep) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // The bar's pixel width maps to 0..maxPercent (100 normally, more for "total" modes).
    const percentage = Math.max(0, Math.min(maxPercent, (x / rect.width) * maxPercent));
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
    if (!currentStep) return;
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      hintsViewedRef.current += 1;
    }
    const targetClause = currentStep.kind === 'place'
      ? ` Current percent: ${currentPercent}%, target: ${currentStep.targetPercent}%.`
      : '';
    sendText(
      `[HINT_REQUESTED] Student requested a hint for: "${currentStep.prompt}". `
      + `Hint shown: "${currentStep.hint}".${targetClause} `
      + `Provide additional encouragement without revealing the answer.`,
      { silent: true },
    );
  };

  // -------------------------------------------------------------------------
  // Finalize the whole challenge once its last step is correct.
  // -------------------------------------------------------------------------
  const finalizeChallenge = useCallback((challenge: PercentBarChallenge) => {
    const log = stepLogRef.current;
    const numSteps = Math.max(1, log.length);
    const totalAttempts = log.reduce((s, e) => s + e.attempts, 0);
    const avgAccuracy = Math.round(
      log.reduce((s, e) => s + e.accuracy, 0) / numSteps,
    );
    // Standard per-challenge score (PRD §5 rule 11): 100 first try, -20 per extra
    // attempt (summed across steps), floor 20.
    const extraAttempts = Math.max(0, totalAttempts - numSteps);
    const score = Math.max(20, 100 - extraAttempts * 20);
    recordedRef.current = true;
    recordResult({
      challengeId: challenge.id,
      correct: true,
      attempts: totalAttempts,
      score,
      accuracy: avgAccuracy,
    });
  }, [recordResult]);

  // -------------------------------------------------------------------------
  // Check answer (handles both place + choice steps)
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || !currentStep) return;
    if (recordedRef.current) return; // stale-state guard

    // Choice step needs a selection before we count an attempt.
    if (currentStep.kind === 'choice' && !selectedOption) {
      setFeedback('Choose an option, then check your answer.');
      setFeedbackType('info');
      return;
    }

    const attempts = stepAttempts + 1;
    setStepAttempts(attempts);

    const isLastStep = currentStepIndex >= steps.length - 1;
    const stepLabel = isMultiStep ? `Step ${currentStepIndex + 1}/${steps.length}: ` : '';

    // ---- Evaluate the step ----
    let correct = false;
    let accuracy = 0;

    if (currentStep.kind === 'place') {
      const target = currentStep.targetPercent;
      correct = isWithinTolerance(currentPercent, target);
      accuracy = getAccuracyScore(currentPercent, target);
    } else {
      correct = selectedOption === currentStep.correctOptionId;
      accuracy = correct ? 100 : 0;
    }

    if (!correct) {
      SoundManager.playIncorrect();
      if (currentStep.kind === 'place') {
        const diff = currentPercent - currentStep.targetPercent;
        if (Math.abs(diff) <= 5) {
          setFeedback(`${stepLabel}Very close! You're at ${currentPercent}%, adjust slightly.`);
          setFeedbackType('info');
        } else if (diff > 0) {
          setFeedback(`${stepLabel}Too high at ${currentPercent}%. Try lower.`);
          setFeedbackType('error');
        } else {
          setFeedback(`${stepLabel}Too low at ${currentPercent}%. Try higher.`);
          setFeedbackType('error');
        }
        sendText(
          `[ANSWER_INCORRECT] ${stepLabel}Student placed ${currentPercent}% but target is ${currentStep.targetPercent}%. `
          + `Difference: ${Math.abs(diff)}%. Attempt ${attempts}. `
          + `Give a directional hint without revealing the exact answer.`
          + tierRevealClause(supportTier, currentChallenge.type),
          { silent: true },
        );
      } else {
        setFeedback(`${stepLabel}Not quite — recheck the prices you found, then choose again.`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] ${stepLabel}Student chose the wrong option on the compare step. Attempt ${attempts}. `
          + `Prompt them to compare the two prices they computed, without naming the answer.`
          + tierRevealClause(supportTier, currentChallenge.type),
          { silent: true },
        );
      }
      return;
    }

    // ---- Correct ----
    SoundManager.playCorrect();
    stepLogRef.current.push({ attempts, accuracy });

    if (currentStep.kind === 'place') {
      // Record what was just established so later steps can recap it.
      const estValue = (currentStep.targetPercent / 100) * currentStep.wholeValue;
      const estLabel =
        currentStep.recapLabel ??
        (currentStep.valueLabel ? currentStep.valueLabel.replace(/\s*\(\$\)\s*$/, '') : 'Established');
      setEstablished((prev) => [
        ...prev,
        { label: estLabel, percent: currentStep.targetPercent, value: estValue },
      ]);
      const partValue = ((currentStep.targetPercent / 100) * currentStep.wholeValue).toFixed(2);
      setFeedback(
        currentChallenge.type === 'addition' && currentStep.targetPercent > 100
          ? `${stepLabel}Total = ${currentStep.targetPercent}% of ${currentStep.wholeValue} = ${partValue} (whole + added).`
          : `${stepLabel}${currentStep.targetPercent}% of ${currentStep.wholeValue} = ${partValue}.`,
      );
    } else {
      const chosen = currentStep.options.find((o) => o.id === selectedOption);
      setFeedback(`${stepLabel}Correct — ${chosen?.label ?? 'that option'}${chosen?.sublabel ? ` (${chosen.sublabel})` : ''}.`);
    }
    setFeedbackType('success');

    if (!isLastStep) {
      // Advance to the next sub-step within this challenge.
      const next = steps[currentStepIndex + 1];
      const nextPrompt = next?.kind === 'place' || next?.kind === 'choice' ? next.prompt : '';
      sendText(
        `[NEXT_STEP] Moving to step ${currentStepIndex + 2} of ${steps.length} in this problem. `
        + `Next: "${nextPrompt}". Read it to the student.`
        + tierRevealClause(supportTier, currentChallenge.type),
        { silent: true },
      );
      setCurrentStepIndex((i) => i + 1);
      return;
    }

    // Last step done — finalize the challenge.
    finalizeChallenge(currentChallenge);
    sendText(
      `[CHALLENGE_CORRECT] Student finished all ${steps.length} step(s) of "${currentChallenge.scenario}". `
      + `Congratulate briefly and reinforce the key idea of this ${CHALLENGE_TYPE_LABEL[currentChallenge.type]} problem.`,
      { silent: true },
    );
  }, [
    currentChallenge, currentStep, currentStepIndex, steps, isMultiStep,
    currentPercent, selectedOption, stepAttempts, supportTier,
    finalizeChallenge, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) return;
    const nextIdx = currentChallengeIndex + 1;
    const next = challenges[nextIdx];
    if (next) {
      const nextSteps = challengeToSteps(next);
      const firstPrompt = nextSteps[0]?.kind === 'place' || nextSteps[0]?.kind === 'choice'
        ? nextSteps[0].prompt : next.question;
      sendText(
        `[NEXT_ITEM] Moving to challenge ${nextIdx + 1} of ${challenges.length}`
        + `${nextSteps.length > 1 ? ` (${nextSteps.length} steps)` : ''}. `
        + `Scenario: "${next.scenario}". First question: "${firstPrompt}". Read it to the student.`,
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
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {CHALLENGE_TYPE_LABEL[challengeType]}
            </LuminaBadge>
            {challenges.length > 0 && (
              <LuminaChallengeCounter
                current={Math.min(currentChallengeIndex + 1, challenges.length)}
                total={challenges.length}
              />
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Scenario */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt accent="cyan">
            <span className="text-sm italic font-normal text-blue-200">{currentChallenge.scenario}</span>
          </LuminaPrompt>
        )}

        {/* Step indicator (multi-step challenges only) */}
        {currentStep && isMultiStep && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < currentStepIndex
                    ? 'w-6 bg-emerald-400'
                    : i === currentStepIndex
                    ? 'w-8 bg-cyan-400'
                    : 'w-6 bg-slate-600'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-slate-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
        )}

        {/* Current Question (active step prompt) */}
        {currentStep && !allChallengesComplete && (
          <LuminaPanel>
            <p className="text-slate-200 text-sm font-medium">
              {currentStep.prompt}
            </p>
          </LuminaPanel>
        )}

        {/* Recap card — what the student established on earlier steps of this challenge. */}
        {established.length > 0 && currentStepIndex > 0 && !allChallengesComplete && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 mb-2 text-center">
              ✓ Established so far
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {established.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5"
                >
                  <span className="text-xs font-semibold text-slate-200">{e.label}</span>
                  <span className="text-xs font-mono text-emerald-300">{e.percent}%</span>
                  <span className="text-xs font-mono text-slate-400">= ${e.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- PLACE step: values + bar + calculation ---- */}
        {placeStep && !allChallengesComplete && (
          <>
            {/* Current Values Display — bespoke readout columns (interaction surface) */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Percentage</div>
                <div className="text-3xl font-bold text-emerald-400">{currentPercent}%</div>
              </div>
              {showValueLabels && (
                <>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{partValueLabel}</div>
                    <div className="text-3xl font-bold text-white">{currentValue.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{wholeValueLabel}</div>
                    <div className="text-3xl font-bold text-slate-400">{wholeValue}</div>
                  </div>
                </>
              )}
            </div>

            {/* Percent Bar Visualization — bespoke interaction surface (painting) */}
            <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
              <div className="relative">
                {showPercentLabels && (
                  <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">
                    Percentage (0% - {maxPercent}%)
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
                    style={{ width: `${(currentPercent / maxPercent) * 100}%` }}
                  />

                  {/* Reference line at 100% (the "whole") — anchors the total on extended bars. */}
                  {isExtendedBar && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-amber-400/70 z-10"
                      style={{ left: `${(100 / maxPercent) * 100}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-amber-300 whitespace-nowrap">
                        100% · whole
                      </div>
                    </div>
                  )}

                  {benchmarkLines.map((benchmark, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full w-px bg-slate-400/40 cursor-help z-10"
                      style={{ left: `${(benchmark / maxPercent) * 100}%` }}
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
                      <div className="absolute -bottom-6 right-0 text-xs text-slate-500 font-mono">{maxPercent}%</div>
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
                      style={{ width: `${Math.min(100, (currentPercent / maxPercent) * 100)}%` }}
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

            {/* Calculation Display — gated: withdrawn at the hard support tier so it
                can't be used to dial the answer value instead of placing the percent. */}
            {showCalculation && (
              <LuminaPanel className="text-center">
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
              </LuminaPanel>
            )}
          </>
        )}

        {/* ---- CHOICE step: tap-to-choose decision ---- */}
        {choiceStep && !allChallengesComplete && (
          <div className="flex flex-col items-center gap-3 py-2">
            {choiceStep.options.map((opt) => {
              const selected = selectedOption === opt.id;
              return (
                <LuminaButton
                  key={opt.id}
                  tone={selected ? 'primary' : 'ghost'}
                  disabled={isCurrentChallengeComplete}
                  onClick={() => {
                    setSelectedOption(opt.id);
                    setFeedback('');
                    setFeedbackType('');
                  }}
                  className={`w-full max-w-sm h-auto py-3 flex items-center justify-between ${
                    selected ? 'ring-2 ring-cyan-400/60' : ''
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  {opt.sublabel && <span className="text-slate-300 font-mono text-sm">{opt.sublabel}</span>}
                </LuminaButton>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {feedback && feedbackType && (
          <LuminaFeedbackCard status={FEEDBACK_STATUS[feedbackType]}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation}
              />
            )}
            {isCurrentChallengeComplete && (
              <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Hint */}
        {!allChallengesComplete && currentStep && (
          <div className="flex flex-col items-center gap-2">
            {!showHint ? (
              stepAttempts >= 1 && !isCurrentChallengeComplete && (
                <LuminaButton
                  tone="subtle"
                  size="sm"
                  className="text-slate-400 text-xs"
                  onClick={handleShowHint}
                >
                  Show Hint
                </LuminaButton>
              )
            ) : (
              <LuminaPanel accent="amber" className="max-w-md">
                <p className="text-amber-300 text-xs">
                  <span className="font-semibold">Hint:</span> {currentStep.hint}
                </p>
              </LuminaPanel>
            )}
          </div>
        )}

        {/* Drag instruction (placement steps only) */}
        {!allChallengesComplete && placeStep && (
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PercentBar;
