'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  challengeSteps, describePercentWork, percentMiss, stepCorrect, workspaceAssignment, workspaceScene,
  type PercentWork,
} from './percentBarWorkspace';
import {
  ADDED_MODEL_LEVER, BAR_LEVERS, COMPARE_MODEL_LEVER, DISCOUNT_MODEL_LEVER, FILL_NAMES_LEVER, TENTHS_LEVER, VALUE_BAR_LEVER,
  isPracticePercent, leverFacts, percentLevers, simplerPercent,
} from './percentBarLevers';

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

/**
 * Mode-aware tutor reveal clause — keeps the AI tutor in sync with the on-screen
 * support tier so it does not leak what the tier withheld (scripted path only).
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const PercentBarSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  PercentBarProps & { tutorOwned: boolean; useController: (options: ProgressOptions<PercentBarChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  const stableInstanceIdRef = useRef(instanceId || `percent-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

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
  // The bar starts empty: a start at 50% put the answer on screen whenever a step's percent was 50.
  const [currentPercent, setCurrentPercent] = useState(0);
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
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  /** Per-step results accumulated within the CURRENT challenge (cleared on advance). */
  const stepLogRef = useRef<{ attempts: number; accuracy: number }[]>([]);

  // -------------------------------------------------------------------------
  // Derived state — challenge + active step
  // -------------------------------------------------------------------------
  // In-item levers (`percentBarLevers.ts`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PercentBarChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice problem. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const challengeType = currentChallenge?.type ?? challenges[0]?.type ?? 'direct';

  const steps = useMemo(
    () => (currentChallenge ? challengeSteps(currentChallenge) : []),
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
  // Resets. A fresh challenge opens at step 1 with the bar empty; Try again keeps the steps already right and
  // clears only the current step's work.
  // -------------------------------------------------------------------------
  const resetStep = () => {
    setCurrentPercent(0);
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setIsDragging(false);
    setHoveredBenchmark(null);
    hintViewedRef.current = false;
  };
  const resetChallenge = () => {
    setCurrentStepIndex(0);
    setEstablished([]);
    setStepAttempts(0);
    stepLogRef.current = [];
    recordedRef.current = false;
    resetStep();
  };
  openItem.current = (_index, retry) => {
    // Try again on a practice problem keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) resetStep();
    else { setPractice(null); resetChallenge(); }
  };

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
    question: currentStep ? currentStep.prompt : currentChallenge?.question ?? '',
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

  // The legacy context carries the target percent; on the workspace path the tutor reads the scene instead.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'percent-bar',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 5-8',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction (fires once on connect)
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = challenges[0];
    const firstSteps = challengeSteps(first);
    const firstPrompt = firstSteps[0]?.prompt ?? first.question;
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
  // Per-challenge reset — fires whenever the challenge id changes (both paths)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setCurrentStepIndex(0);
    setEstablished([]);
    stepLogRef.current = [];
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Per-step reset — fires on challenge change AND on step change
  // -------------------------------------------------------------------------
  useEffect(() => {
    resetStep();
    setStepAttempts(0);
  }, [currentChallenge?.id, currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const getAccuracyScore = (studentPct: number, targetPct: number): number => {
    const error = Math.abs(studentPct - targetPct);
    if (error === 0) return 100;
    if (error <= 2) return 100 - (error / 2) * 10;
    return Math.max(0, 100 - error * 2);
  };

  /** Input on the bar, the slider or the options: closed once the item is done, and on the workspace path while a
   *  checked answer waits for Try again. */
  const inputClosed = allChallengesComplete || hasSubmittedEvaluation || isCurrentChallengeComplete || blocked;

  const setPercent = (value: number) => {
    if (inputClosed || learnerBlocked() || !placeStep) return;
    const rounded = Math.max(0, Math.min(maxPercent, Math.round(value)));
    if (rounded !== currentPercent) SoundManager.tick(); // slider-style increment
    setCurrentPercent(rounded);
    setFeedback('');
    setFeedbackType('');
  };

  // -------------------------------------------------------------------------
  // Bar interaction handlers
  // -------------------------------------------------------------------------
  const handleBarInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    if (inputClosed || learnerBlocked() || !placeStep) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // The bar's pixel width maps to 0..maxPercent (100 normally, more for "total" modes).
    setPercent((x / rect.width) * maxPercent);
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
  // Finalize the whole challenge once its last step is correct (the primitive's own score fields).
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
    // An easier practice problem (a simplify lever) is not the session's challenge: it records nothing.
    if (isPracticePercent(challenge)) return;
    recordResult({
      challengeId: challenge.id,
      correct: true,
      attempts: totalAttempts,
      score,
      accuracy: avgAccuracy,
    });
  }, [recordResult]);

  // -------------------------------------------------------------------------
  // Check answer (handles both place + choice steps). A right step that is not the last opens the next step and is
  // not a commit; a wrong step, and the last step right, are the checked gestures.
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || !currentStep || learnerBlocked()) return;
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
    const work: PercentWork = { stepIndex: currentStepIndex, percent: currentPercent, selected: selectedOption };
    const response = describePercentWork(currentChallenge, work);
    const correct = stepCorrect(currentChallenge, work);
    const accuracy = currentStep.kind === 'place' ? getAccuracyScore(currentPercent, currentStep.targetPercent) : correct ? 100 : 0;

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
      progress.commitCheck(response, false, percentMiss(currentChallenge, work));
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
      sendText(
        `[NEXT_STEP] Moving to step ${currentStepIndex + 2} of ${steps.length} in this problem. `
        + `Next: "${next?.prompt ?? ''}". Read it to the student.`
        + tierRevealClause(supportTier, currentChallenge.type),
        { silent: true },
      );
      setCurrentStepIndex((i) => i + 1);
      return;
    }

    // Last step done: the checked gesture (counts the attempt, records the verdict), then this primitive's own score.
    recordedRef.current = true;
    progress.commitCheck(response, true);
    finalizeChallenge(currentChallenge);
    sendText(
      `[CHALLENGE_CORRECT] Student finished all ${steps.length} step(s) of "${currentChallenge.scenario}". `
      + `Congratulate briefly and reinforce the key idea of this ${CHALLENGE_TYPE_LABEL[currentChallenge.type]} problem.`,
      { silent: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge, currentStep, currentStepIndex, steps, isMultiStep,
    currentPercent, selectedOption, stepAttempts, supportTier,
    finalizeChallenge, sendText, progress.commitCheck,
  ]);

  // -------------------------------------------------------------------------
  // Advance to next challenge (scripted path; the workspace path hides Next and the runtime advances)
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) return;
    const nextIdx = currentChallengeIndex + 1;
    const next = challenges[nextIdx];
    if (next) {
      const nextSteps = challengeSteps(next);
      const firstPrompt = nextSteps[0]?.prompt ?? next.question;
      sendText(
        `[NEXT_ITEM] Moving to challenge ${nextIdx + 1} of ${challenges.length}`
        + `${nextSteps.length > 1 ? ` (${nextSteps.length} steps)` : ''}. `
        + `Scenario: "${next.scenario}". First question: "${firstPrompt}". Read it to the student.`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session-complete (scripted path): build canonical 9-field metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned) return;

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
    challengeType, submitEvaluation, sendText, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    const metrics: PercentBarMetrics = {
      type: 'percent-bar',
      challengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

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

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation; every mode declares levers (`percentBarLevers.ts`).
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, {
      stepIndex: currentStepIndex, percent: currentPercent, selected: selectedOption, established,
      showPercentLabels, showValueLabels, showCalculation, benchmarkLines, doubleBar: doubleBar || leverOn(VALUE_BAR_LEVER),
    });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : percentLevers(sessionChallenge, pulledLevers, { valueBarShown: doubleBar });
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice problem is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (BAR_LEVERS.includes(id) && !placeStep) return 'The bar is not on screen on this step: the learner is choosing an option.';
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerPercent(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetChallenge();
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallenge(); },
    };
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The percent bar',
    solved: isCurrentChallengeComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

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

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
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

                {/* The keyboard's way onto the bar (arrow keys), and the journey's: the same percent the bar sets. */}
                <input
                  type="range"
                  className="sr-only"
                  aria-label="Percent on the bar"
                  min={0}
                  max={maxPercent}
                  step={1}
                  value={currentPercent}
                  disabled={inputClosed}
                  onChange={(e) => setPercent(Number(e.target.value))}
                />
                <div
                  className={`relative h-14 bg-slate-700/60 rounded-xl shadow-inner overflow-hidden border border-white/10 ${
                    inputClosed ? 'cursor-default' : 'cursor-pointer'}`}
                  data-pip-object="bar"
                  onClick={handleBarInteraction}
                  onMouseMove={handleMouseMove}
                  onMouseDown={() => { if (!inputClosed && !learnerBlocked()) setIsDragging(true); }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                >
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150 rounded-l-xl"
                    style={{ width: `${(currentPercent / maxPercent) * 100}%` }}
                  />

                  {/* `tenths` lever: the bar cut into ten equal parts of the whole, unlabelled. */}
                  {leverOn(TENTHS_LEVER) && Array.from({ length: Math.floor(maxPercent / 10) - 1 }, (_, i) => (i + 1) * 10)
                    .filter((p) => p !== 100 || !isExtendedBar).map((p) => (
                      <div key={`tenth-${p}`} data-lever="tenths" aria-hidden="true"
                        className="absolute top-0 h-full w-0.5 bg-cyan-300/60 z-10 pointer-events-none"
                        style={{ left: `${(p / maxPercent) * 100}%` }} />
                    ))}

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

                {/* `fill_names` lever: the filled part and the empty part named in words, following the learner's bar. */}
                {leverOn(FILL_NAMES_LEVER) && (
                  <div data-lever="fill-names" className="mt-8 flex h-6 text-[11px] font-semibold rounded overflow-hidden border border-white/10">
                    <div className="bg-emerald-500/30 text-emerald-100 flex items-center justify-center overflow-hidden whitespace-nowrap"
                      style={{ width: `${(currentPercent / maxPercent) * 100}%` }}>
                      the part
                    </div>
                    <div className="flex-1 bg-slate-700/40 text-slate-300 flex items-center justify-center overflow-hidden whitespace-nowrap">
                      the rest of the whole
                    </div>
                  </div>
                )}
              </div>

              {/* `value_bar` lever: a second bar in the whole's own units, moving with the percent bar, labelled at its ends. */}
              {leverOn(VALUE_BAR_LEVER) && !doubleBar && (
                <div className="relative mt-8" data-lever="value-bar">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                    The same bar in {/\(\$\)/.test(wholeValueLabel) ? 'dollars' : wholeValueLabel.replace(/^total\s+/i, '').toLowerCase()}
                  </div>
                  <div className="relative h-8 bg-slate-700/60 rounded-xl shadow-inner border border-white/10">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-150 rounded-l-xl"
                      style={{ width: `${(currentPercent / maxPercent) * 100}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-amber-300/70" style={{ left: `${(100 / maxPercent) * 100}%` }} />
                  </div>
                  <div className="relative h-5 text-xs text-slate-400">
                    <span className="absolute left-0">0</span>
                    <span className="absolute -translate-x-full" style={{ left: `${(100 / maxPercent) * 100}%` }}>the whole</span>
                  </div>
                </div>
              )}

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

        {/* Lever pictures outside the item: no number of the item, no digit at all. */}
        {!allChallengesComplete && (leverOn(DISCOUNT_MODEL_LEVER) || leverOn(ADDED_MODEL_LEVER) || leverOn(COMPARE_MODEL_LEVER)) && (
          <div className="flex flex-wrap justify-center gap-6 py-2">
            {leverOn(DISCOUNT_MODEL_LEVER) && (
              <figure data-lever="discount-model" className="w-56 text-center">
                <div className="flex h-6 rounded overflow-hidden border border-white/10">
                  <div className="flex-[3] bg-emerald-500/40" />
                  <div className="flex-1 bg-rose-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.15)_4px,rgba(255,255,255,0.15)_8px)]" />
                </div>
                <div className="flex text-[11px] mt-1 text-slate-300">
                  <span className="flex-[3]">still paid</span><span className="flex-1">taken off</span>
                </div>
                <figcaption className="text-[11px] text-slate-400 mt-1">The whole is the full price. The discount is taken off; the rest is still paid.</figcaption>
              </figure>
            )}
            {leverOn(ADDED_MODEL_LEVER) && (
              <figure data-lever="added-model" className="w-56 text-center">
                <div className="flex h-6">
                  <div className="flex-[4] bg-emerald-500/40 rounded-l border border-white/10" />
                  <div className="w-0.5 bg-amber-300" />
                  <div className="flex-1 bg-cyan-500/40 rounded-r border border-white/10" />
                </div>
                <div className="flex text-[11px] mt-1 text-slate-300">
                  <span className="flex-[4]">the whole</span><span className="flex-1">added on top</span>
                </div>
                <figcaption className="text-[11px] text-slate-400 mt-1">A tax, tip or fee is added on top of the whole, so the total ends past it.</figcaption>
              </figure>
            )}
            {leverOn(COMPARE_MODEL_LEVER) && (
              <figure data-lever="compare-model" className="w-64 text-center space-y-1">
                <div className="flex h-5"><div className="flex-[6] bg-emerald-500/40 rounded-l" /><div className="flex-[4] bg-rose-500/30 rounded-r" /></div>
                <div className="flex h-5 w-1/2"><div className="flex-[9] bg-emerald-500/40 rounded-l" /><div className="flex-1 bg-rose-500/30 rounded-r" /></div>
                <figcaption className="text-[11px] text-slate-400">A big piece off a long price can still leave more to pay than a small piece off a short one. Compare what is still paid.</figcaption>
              </figure>
            )}
          </div>
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
                  disabled={inputClosed}
                  aria-label={opt.sublabel ? `${opt.label} ${opt.sublabel}` : opt.label}
                  onClick={() => {
                    if (inputClosed || learnerBlocked()) return;
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

        </div>

        {/* Feedback */}
        {feedback && feedbackType && (
          <LuminaFeedbackCard status={FEEDBACK_STATUS[feedbackType]}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action Buttons. On the workspace path the shell's Try again / Next challenge replace Next. */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation || blocked}
              />
            )}
            {!tutorOwned && isCurrentChallengeComplete && (
              <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Hint (scripted path). The generated hint can name the step's percent; with the tutor, help is the tutor's. */}
        {!tutorOwned && !allChallengesComplete && currentStep && (
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

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const PercentBar = withWorkspaceController<PercentBarProps, ProgressOptions<PercentBarChallenge>, Progress>(
  'percent-bar', PercentBarSurface, useScriptedProgress, useWorkspaceProgressFor('percent-bar'));

export default PercentBar;
