'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FunctionMachineMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress, type ChallengeResult } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type FunctionMachineChallengeType =
  | 'observe'
  | 'predict'
  | 'discover_rule'
  | 'create_rule';

export interface FunctionMachineChallenge {
  id: string;
  rule: string;
  inputQueue: number[];
  showRule: boolean;
  // ── Support-tier structural fields (optional; default = current behavior) ──
  /** How many I/O pairs must be fed before observe/predict can complete.
   *  Withdrawn-scaffold lever (hard requires the whole queue). Never grows the queue. */
  pairsRequiredToComplete?: number;
  /** For discover_rule/create_rule: how many I/O pairs/rows are pre-revealed.
   *  ALWAYS ≥2 for create_rule so the rule stays uniquely determinable. */
  prefilledPairCount?: number;
  /** Hint scaffolding level: 'full' = how-it-works + early hint; 'minimal' = standard
   *  (hint after 2 attempts); 'none' = no scaffolding hints. */
  hintLevel?: 'full' | 'minimal' | 'none';
}

export interface FunctionMachineData {
  title: string;
  description: string;
  challengeType: FunctionMachineChallengeType;
  /** 3-6 function rules per session. Required. */
  challenges: FunctionMachineChallenge[];
  ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
  gradeBand?: '3-4' | '5' | 'advanced';
  outputDisplay?: 'immediate' | 'animated' | 'hidden';
  /** Within-mode support tier from the manifest. Set whenever a tier is applied.
   *  Used to keep the AI tutor's reveal level in sync with the on-screen scaffold. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Session chrome: show the rule-complexity badge. Withdrawn at hard. Default true. */
  showComplexityBadge?: boolean;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FunctionMachineMetrics>) => void;
}

// ============================================================================
// Display config for each challenge type (used by usePhaseResults)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<FunctionMachineChallengeType, PhaseConfig> = {
  observe:       { label: 'Observe', icon: '👁️', accentColor: 'blue' },
  predict:       { label: 'Predict', icon: '🔮', accentColor: 'amber' },
  discover_rule: { label: 'Discover', icon: '💡', accentColor: 'emerald' },
  create_rule:   { label: 'Create', icon: '🛠️', accentColor: 'purple' },
};

const CHALLENGE_TYPE_LABEL: Record<FunctionMachineChallengeType, string> = {
  observe: 'Watch & Learn',
  predict: 'Predict the Output',
  discover_rule: 'Discover the Rule',
  create_rule: 'Write the Rule',
};

// ============================================================================
// Helpers
// ============================================================================

/** Safely evaluate a rule string at a given x value. */
const evaluateRule = (rule: string, x: number): number | null => {
  if (!rule || !rule.trim()) return null;
  try {
    const expression = rule.replace(/x/g, `(${x})`);
    if (!/^[\d+\-*/().^\s]+$/.test(expression)) return null;
    const safeExpression = expression.replace(/\^/g, '**');
    const result = new Function('return ' + safeExpression)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
};

/** Normalize rule strings for textual comparison. */
const normalizeRule = (r: string): string => {
  if (!r) return '';
  return r.replace(/\s/g, '').toLowerCase().replace(/\*/g, '');
};

/** Functional equivalence: two rules behave the same on multiple test inputs. */
const rulesEquivalent = (a: string, b: string): boolean => {
  if (normalizeRule(a) === normalizeRule(b)) return true;
  const testInputs = [0, 1, 2, 3, 5, 10, -1];
  return testInputs.every((x) => {
    const va = evaluateRule(a, x);
    const vb = evaluateRule(b, x);
    return va !== null && vb !== null && Math.abs(va - vb) < 0.01;
  });
};

const gradeLabel = (band?: string): string => {
  switch (band) {
    case '3-4': return 'Grade 3';
    case '5': return 'Grade 5';
    case 'advanced': return 'Grade 7';
    default: return 'Grade 5';
  }
};

/** Per-attempt decay (§6a #11). */
const phaseScore = (attempts: number): number => Math.max(20, 100 - (attempts - 1) * 20);

/**
 * Tutor reveal policy — keeps the AI tutor's reveal level in sync with the on-screen
 * support tier so it never leaks what the tier withheld. For discover_rule/create_rule
 * the rule is the ANSWER: the tutor must NEVER name it at any tier (the on-screen rule
 * is hidden — that's the mode identity); the tier only dials coaching depth. For
 * observe/predict the rule is already on screen, so the tutor may reference it freely.
 */
const tutorRevealClause = (
  challengeType: FunctionMachineChallengeType,
  tier?: 'easy' | 'medium' | 'hard',
): string => {
  const ruleIsAnswer = challengeType === 'discover_rule' || challengeType === 'create_rule';
  if (ruleIsAnswer) {
    // NEVER name the rule. Tier dials how much strategy coaching is allowed.
    if (tier === 'easy') {
      return 'REVEAL POLICY: never state the rule. Coach the discovery strategy: point out how the output changes as the input grows by 1, and which pairs to compare.';
    }
    if (tier === 'hard') {
      return 'REVEAL POLICY: never state the rule and do NOT name the operation. Only ask what changes from input to output; let the student reason from the pairs.';
    }
    return 'REVEAL POLICY: never state the rule. Nudge the student toward the pattern without naming the operation.';
  }
  // observe/predict: rule is on screen; tier dials coaching depth.
  if (tier === 'hard') {
    return 'REVEAL POLICY: the rule is visible. Nudge the student to apply it themselves; do not pre-compute outputs for them.';
  }
  return 'REVEAL POLICY: the rule is visible. You may walk through how it transforms an input step by step.';
};

// ============================================================================
// Component
// ============================================================================

interface FunctionMachineProps {
  data: FunctionMachineData;
  className?: string;
}

const FunctionMachine: React.FC<FunctionMachineProps> = ({ data, className }) => {
  const {
    title,
    description,
    challengeType,
    challenges,
    ruleComplexity = 'oneStep',
    gradeBand = '3-4',
    outputDisplay = 'animated',
    supportTier,
    showComplexityBadge = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `function-machine-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Challenge Progress (shared hook)
  // -------------------------------------------------------------------------
  const {
    currentIndex,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance,
  } = useChallengeProgress<FunctionMachineChallenge>({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = challenges[currentIndex];

  // -------------------------------------------------------------------------
  // Phase Results (shared hook) — uses per-challenge `score` field via getScore
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: () => challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => {
      if (rs.length === 0) return 0;
      const total = rs.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      );
      return Math.round(total / rs.length);
    },
  });

  // -------------------------------------------------------------------------
  // State — all reset on currentChallenge.id change.
  // -------------------------------------------------------------------------
  const [processedPairs, setProcessedPairs] = useState<Array<{ input: number; output: number }>>([]);
  const [currentInput, setCurrentInput] = useState<number | null>(null);
  const [currentOutput, setCurrentOutput] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableInputs, setAvailableInputs] = useState<number[]>(currentChallenge?.inputQueue ?? []);

  // Predict-mode state
  const [prediction, setPrediction] = useState('');
  const [predictionFeedback, setPredictionFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [predictionsCorrect, setPredictionsCorrect] = useState(0);
  const [predictionsTotal, setPredictionsTotal] = useState(0);

  // Discover/Create-mode state
  const [guessedRule, setGuessedRule] = useState('');
  const [guessResult, setGuessResult] = useState<'correct' | 'incorrect' | null>(null);
  const [guessAttempts, setGuessAttempts] = useState(0);

  // Between-challenge interstitial
  const [challengeDone, setChallengeDone] = useState(false);

  // -------------------------------------------------------------------------
  // Per-challenge reset effect — runs whenever advance() flips currentChallenge.id
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    // discover_rule support tier may PRE-REVEAL some I/O pairs (easy = more, hard =
    // fewer). These are tier-derived; they MUST be seeded here so they reset per rule
    // and never leak across challenges. The rule itself stays hidden (mode identity).
    const prefill =
      currentChallenge.showRule === false &&
      challengeType === 'discover_rule' &&
      currentChallenge.prefilledPairCount != null
        ? Math.min(currentChallenge.prefilledPairCount, currentChallenge.inputQueue.length)
        : 0;
    if (prefill > 0) {
      const seeded: Array<{ input: number; output: number }> = [];
      const seededInputs = currentChallenge.inputQueue.slice(0, prefill);
      for (const input of seededInputs) {
        const output = evaluateRule(currentChallenge.rule, input);
        if (output !== null) seeded.push({ input, output });
      }
      setProcessedPairs(seeded);
      setAvailableInputs(
        currentChallenge.inputQueue.filter((v) => !seededInputs.includes(v)),
      );
    } else {
      setProcessedPairs([]);
      setAvailableInputs(currentChallenge.inputQueue);
    }
    setCurrentInput(null);
    setCurrentOutput(null);
    setIsProcessing(false);
    setPrediction('');
    setPredictionFeedback(null);
    setPredictionsCorrect(0);
    setPredictionsTotal(0);
    setGuessedRule('');
    setGuessResult(null);
    setGuessAttempts(0);
    setChallengeDone(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // -------------------------------------------------------------------------
  // For create_rule: pre-populate the I/O pair table from the rule.
  // Support tier may withhold rows (hard) — but ALWAYS ≥2 so the rule is
  // uniquely determinable. The generator already enforces ≥2; we clamp again here.
  // -------------------------------------------------------------------------
  const createRulePairs = useMemo(() => {
    if (challengeType !== 'create_rule' || !currentChallenge) return [];
    const allPairs = currentChallenge.inputQueue
      .map((input) => {
        const output = evaluateRule(currentChallenge.rule, input);
        return output === null ? null : { input, output };
      })
      .filter((p): p is { input: number; output: number } => p !== null);
    const prefill = currentChallenge.prefilledPairCount;
    if (prefill != null && prefill < allPairs.length) {
      return allPairs.slice(0, Math.max(2, prefill));
    }
    return allPairs;
  }, [challengeType, currentChallenge]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FunctionMachineMetrics>({
    primitiveType: 'function-machine',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    title,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    rule: currentChallenge?.rule ?? '',
    showRule: currentChallenge?.showRule ?? false,
    supportTier,
    processedPairs,
    guessedRule,
    gradeBand,
    ruleComplexity,
    pairsCount: processedPairs.length,
    predictionsCorrect,
    predictionsTotal,
    guessAttempts,
    ruleDiscovered: guessResult === 'correct',
  }), [
    challengeType, title, currentIndex, challenges.length, currentChallenge,
    supportTier, processedPairs, guessedRule, gradeBand, ruleComplexity, predictionsCorrect,
    predictionsTotal, guessAttempts, guessResult,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'function-machine',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeLabel(gradeBand),
  });

  // Introduction (once per session)
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Function machine session "${title}". `
      + `${challenges.length} function rules, mode: ${challengeType}. `
      + `Grade band: ${gradeBand}. Complexity: ${ruleComplexity}. `
      + `${supportTier ? `Support tier: ${supportTier}. ` : ''}`
      + `${tutorRevealClause(challengeType, supportTier)} `
      + `Introduce the activity warmly and explain the first step.`,
      { silent: true },
    );
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Process value through the machine (observe / predict / discover_rule)
  // -------------------------------------------------------------------------
  const processValue = useCallback(async (input: number) => {
    if (isProcessing || !currentChallenge) return;
    SoundManager.tap();           // ← tactile feed of an input into the machine
    setIsProcessing(true);
    setCurrentInput(input);
    setCurrentOutput(null);

    await new Promise((resolve) => setTimeout(resolve, 600));

    const output = evaluateRule(currentChallenge.rule, input);
    if (output === null) {
      setIsProcessing(false);
      setCurrentInput(null);
      return;
    }

    // Predict-mode: judge the prediction BEFORE revealing the output.
    let predictionWasCorrect: boolean | null = null;
    if (challengeType === 'predict' && prediction.trim()) {
      const predicted = parseFloat(prediction);
      predictionWasCorrect = !isNaN(predicted) && Math.abs(predicted - output) < 0.01;
      setPredictionFeedback(predictionWasCorrect ? 'correct' : 'incorrect');
      setPredictionsTotal((t) => t + 1);
      if (predictionWasCorrect) setPredictionsCorrect((c) => c + 1);
      if (predictionWasCorrect) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      if (predictionWasCorrect) {
        sendText(`[PREDICTION_CORRECT] Student predicted ${predicted} for input ${input}. Output ${output}. Celebrate briefly.`, { silent: true });
      } else {
        sendText(`[PREDICTION_INCORRECT] Student predicted ${predicted} for input ${input}, actual output ${output}. ${tutorRevealClause('predict', supportTier)} Encourage and hint at the pattern.`, { silent: true });
      }
    }

    setCurrentOutput(output);
    await new Promise((resolve) => setTimeout(resolve, 500));

    setProcessedPairs((prev) => [...prev, { input, output }]);
    setAvailableInputs((prev) => prev.filter((v) => v !== input));
    setPrediction('');

    await new Promise((resolve) => setTimeout(resolve, 300));
    setCurrentInput(null);
    setCurrentOutput(null);
    setIsProcessing(false);
  }, [isProcessing, currentChallenge, challengeType, prediction, sendText, supportTier]);

  // -------------------------------------------------------------------------
  // Completion helpers — each mode has its own submit, all share stale-state guard
  // -------------------------------------------------------------------------

  /** Stale-state guard: only record when the local state belongs to the active challenge. */
  const completeCurrentChallenge = useCallback((result: ChallengeResult) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    if (result.challengeId !== currentChallenge.id) return;
    recordedRef.current = true;
    recordResult(result);
    setChallengeDone(true);
  }, [currentChallenge, recordResult]);

  /** observe: complete on "Continue" button after >=3 pairs observed. */
  const completeObserve = useCallback(() => {
    if (!currentChallenge) return;
    const pairsObserved = processedPairs.length;
    const allInputsUsed = availableInputs.length === 0;
    const score = allInputsUsed ? 100 : pairsObserved >= 3 ? 85 : 60;
    completeCurrentChallenge({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: 1,
      score,
      pairsObserved,
    });
    sendText(
      `[PHASE_COMPLETE] Observe rule "${currentChallenge.rule}" complete with ${pairsObserved} pairs observed. Encourage moving to the next function.`,
      { silent: true },
    );
  }, [currentChallenge, processedPairs.length, availableInputs.length, completeCurrentChallenge, sendText]);

  /** predict: complete when all inputs have been predicted. */
  useEffect(() => {
    if (challengeType !== 'predict') return;
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    if (availableInputs.length !== 0) return;
    if (predictionsTotal === 0) return;
    // Stale-state guard: the pairs we just produced must belong to this challenge.
    if (processedPairs.length !== currentChallenge.inputQueue.length) return;
    const score = Math.round((predictionsCorrect / predictionsTotal) * 100);
    completeCurrentChallenge({
      challengeId: currentChallenge.id,
      correct: predictionsCorrect === predictionsTotal,
      attempts: predictionsTotal,
      score,
      predictionsCorrect,
      predictionsTotal,
    });
    sendText(
      `[PHASE_COMPLETE] Predict rule "${currentChallenge.rule}" complete: ${predictionsCorrect}/${predictionsTotal} correct.`,
      { silent: true },
    );
  }, [
    challengeType, currentChallenge, availableInputs.length, predictionsTotal,
    predictionsCorrect, processedPairs.length, completeCurrentChallenge, sendText,
  ]);

  /** discover_rule / create_rule: complete on correct rule guess. */
  const checkRuleGuess = useCallback(() => {
    if (!currentChallenge) return;
    if (!guessedRule.trim()) return;
    const nextAttempts = guessAttempts + 1;
    setGuessAttempts(nextAttempts);

    const isCorrect = rulesEquivalent(guessedRule, currentChallenge.rule);
    setGuessResult(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) SoundManager.playCorrect();
    else SoundManager.playIncorrect();

    if (isCorrect) {
      const score = phaseScore(nextAttempts);
      completeCurrentChallenge({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: nextAttempts,
        score,
        ruleDiscovered: true,
      });
      sendText(
        `[PHASE_COMPLETE] ${challengeType === 'discover_rule' ? 'Discover' : 'Create'} rule complete: student guessed "${guessedRule}" matching "${currentChallenge.rule}" in ${nextAttempts} attempt(s). Celebrate!`,
        { silent: true },
      );
    } else {
      sendText(
        `[GUESS_INCORRECT] Student guessed "${guessedRule}" but rule is "${currentChallenge.rule}". Attempt ${nextAttempts}. ${challengeType === 'discover_rule' ? `Pairs seen: ${processedPairs.map((p) => `${p.input}→${p.output}`).join(', ')}.` : ''} ${tutorRevealClause(challengeType, supportTier)} Give a targeted hint without naming the rule.`,
        { silent: true },
      );
    }
  }, [currentChallenge, guessedRule, guessAttempts, challengeType, processedPairs, completeCurrentChallenge, sendText, supportTier]);

  // -------------------------------------------------------------------------
  // Submit aggregate evaluation when all challenges complete
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete) return;
    if (hasSubmittedEvaluation) return;

    const totalChallenges = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const hintsViewed = challengeResults.filter((r) => r.attempts > 1).length;
    const overallAccuracy = totalChallenges > 0
      ? Math.round(
          challengeResults.reduce(
            (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
            0,
          ) / totalChallenges,
        )
      : 0;
    const averageAttemptsPerChallenge = totalChallenges > 0
      ? Math.round((attemptsCount / totalChallenges) * 10) / 10
      : 0;

    const goalMet = overallAccuracy >= 70;

    submitEvaluation(
      goalMet,
      overallAccuracy,
      {
        type: 'function-machine',
        challengeType,
        totalChallenges,
        correctCount,
        attemptsCount,
        firstTryCount,
        hintsViewed,
        overallAccuracy,
        averageAttemptsPerChallenge,
      },
    );

    sendText(
      `[ALL_COMPLETE] Function machine session complete. ${correctCount}/${totalChallenges} correct, overall accuracy ${overallAccuracy}%. Celebrate the session and give phase-specific feedback.`,
      { silent: true },
    );
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges.length, challengeResults,
    challengeType, submitEvaluation, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Empty / error states
  // -------------------------------------------------------------------------
  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard className={`border-red-500/20 ${className || ''}`}>
        <LuminaCardHeader>
          <LuminaCardTitle className="text-red-300">Configuration Error</LuminaCardTitle>
        </LuminaCardHeader>
        <LuminaCardContent>
          <p className="text-red-200/80">No function machine challenges provided.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  if (!currentChallenge) {
    return null;
  }

  const showRule = currentChallenge.showRule || guessResult === 'correct';

  // Tier-derived UI gates (default = current behavior when no tier present).
  // hintLevel 'full' = how-it-works + early hint; 'minimal' = standard (hint after 2
  // attempts); 'none' = no scaffolding hints. NEVER affects rule visibility.
  const hintLevel = currentChallenge.hintLevel;
  const showHowItWorks = hintLevel == null ? true : hintLevel === 'full';
  // discover/create hint text: 'none' suppresses it; 'full' offers it early (after 1
  // attempt); otherwise the standard "after 2 attempts" gate.
  const ruleHintThreshold = hintLevel === 'full' ? 1 : 2;
  const showRuleHint = hintLevel !== 'none' && guessAttempts >= ruleHintThreshold;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className={`w-full max-w-6xl mx-auto my-8 space-y-6 ${className || ''}`}>
      {/* Header Card */}
      <LuminaCard>
        <LuminaCardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center border border-blue-400/40">
                <span className="text-xl">{PHASE_TYPE_CONFIG[challengeType].icon}</span>
              </div>
              <div>
                <LuminaCardTitle>{title}</LuminaCardTitle>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LuminaBadge accent="blue" className="text-xs">
                {CHALLENGE_TYPE_LABEL[challengeType]}
              </LuminaBadge>
              {showComplexityBadge && (
                <LuminaBadge accent="purple" className="text-xs">
                  {ruleComplexity === 'oneStep' ? 'One-Step' : ruleComplexity === 'twoStep' ? 'Two-Step' : 'Expression'}
                </LuminaBadge>
              )}
            </div>
          </div>
        </LuminaCardHeader>
      </LuminaCard>

      {/* Challenge Progress Dots */}
      <LuminaCard>
        <LuminaCardContent className="py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
              Function {currentIndex + 1} of {challenges.length}
            </span>
            <div className="flex items-center gap-2">
              {challenges.map((ch, idx) => {
                const isDone = challengeResults.some((r) => r.challengeId === ch.id);
                const isActive = idx === currentIndex;
                return (
                  <div
                    key={ch.id}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isDone
                        ? 'bg-emerald-400'
                        : isActive
                        ? 'bg-blue-400 ring-2 ring-blue-400/30'
                        : 'bg-slate-600'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </LuminaCardContent>
      </LuminaCard>

      {/* Phase Summary Panel (final) */}
      {hasSubmittedEvaluation && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score}
          durationMs={elapsedMs}
          heading="Session Complete!"
          celebrationMessage={`You finished all ${challenges.length} function machines.`}
          className="mb-6"
        />
      )}

      {/* Between-challenge interstitial */}
      {challengeDone && !allChallengesComplete && (
        <LuminaCard className="bg-emerald-500/10 border-emerald-400/40">
          <LuminaCardContent className="py-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="text-emerald-100 font-semibold text-lg mb-1">
              Function {currentIndex + 1} Complete!
            </h3>
            <p className="text-sm text-emerald-200/80 mb-4">
              Rule was <span className="font-mono font-bold text-white">f(x) = {currentChallenge.rule}</span>. Ready for the next one?
            </p>
            <LuminaActionButton action="next" onClick={() => advance()}>
              Next Function →
            </LuminaActionButton>
          </LuminaCardContent>
        </LuminaCard>
      )}

      {/* Active interaction (hidden once challenge is done or all done) */}
      {!challengeDone && !allChallengesComplete && (
        <>
          {/* Machine Visualization */}
          <LuminaCard>
            <LuminaCardContent className="py-8">
              <div className="flex items-center justify-center gap-6 md:gap-8">
                {/* Input Hopper */}
                <div className="flex flex-col items-center">
                  <span className="text-xs text-blue-400 font-mono uppercase tracking-wider mb-2">Input</span>
                  <div className="w-20 h-28 border-2 border-blue-400/40 rounded-t-lg bg-blue-500/10 relative flex items-center justify-center">
                    {currentInput !== null && (
                      <div className="w-11 h-11 rounded-full bg-blue-500/30 border-2 border-blue-400/60 flex items-center justify-center text-white font-bold animate-bounce text-sm">
                        {currentInput}
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-10 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 40 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12H36M28 6L36 12L28 18" />
                </svg>

                {/* Machine Body */}
                <div className={`w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-400/40 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)] ${isProcessing ? 'border-blue-400/70' : ''}`}>
                  {isProcessing && <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />}
                  <div className="relative z-10 text-center px-3">
                    <div className="text-xs text-blue-300 font-mono mb-2 uppercase">Function Rule</div>
                    {showRule ? (
                      <div className="text-xl font-bold text-white font-mono bg-slate-900/30 px-3 py-1.5 rounded-lg border border-blue-400/20">
                        f(x) = {currentChallenge.rule}
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                    {isProcessing && (
                      <div className="text-blue-300 text-xs animate-pulse mt-2">Processing...</div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-10 h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 40 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12H36M28 6L36 12L28 18" />
                </svg>

                {/* Output Chute */}
                <div className="flex flex-col items-center">
                  <span className="text-xs text-purple-400 font-mono uppercase tracking-wider mb-2">Output</span>
                  <div className="w-20 h-28 border-2 border-purple-400/40 rounded-b-lg bg-purple-500/10 relative flex items-center justify-center">
                    {currentOutput !== null && outputDisplay !== 'hidden' && (
                      <div className={`w-11 h-11 rounded-full bg-purple-500/30 border-2 border-purple-400/60 flex items-center justify-center text-white font-bold text-sm ${outputDisplay === 'animated' ? 'animate-bounce' : ''}`}>
                        {currentOutput}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </LuminaCardContent>
          </LuminaCard>

          {/* Prediction Panel (predict mode only) */}
          {challengeType === 'predict' && (
            <LuminaCard className="bg-amber-500/10 border-amber-400/30">
              <LuminaCardContent className="py-5">
                <h4 className="text-amber-200 font-semibold mb-3">Predict the Output</h4>
                <p className="text-sm text-amber-100/80 mb-4">
                  Type your prediction first, then click an input below to feed it through the machine.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-amber-300 text-sm">My prediction:</span>
                  <LuminaInput
                    type="text"
                    inputMode="numeric"
                    value={prediction}
                    onChange={(e) => { setPrediction(e.target.value); setPredictionFeedback(null); }}
                    placeholder="?"
                    disabled={isProcessing}
                    className="w-24 text-center font-mono"
                  />
                  {predictionFeedback === 'correct' && (
                    <LuminaBadge accent="emerald">Correct!</LuminaBadge>
                  )}
                  {predictionFeedback === 'incorrect' && (
                    <LuminaBadge accent="rose">Not quite</LuminaBadge>
                  )}
                  {predictionsTotal > 0 && hintLevel !== 'none' && (
                    <span className="text-xs text-amber-300/70 ml-auto">
                      {predictionsCorrect}/{predictionsTotal} correct
                    </span>
                  )}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Available Inputs (observe / predict / discover_rule) */}
          {challengeType !== 'create_rule' && (
            <LuminaCard>
              <LuminaCardContent className="py-5">
                <div className="flex items-center gap-3 mb-4">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400">Available Inputs</h4>
                  {availableInputs.length > 0 && (
                    <LuminaBadge accent="blue" className="text-xs">
                      {availableInputs.length} remaining
                    </LuminaBadge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableInputs.length > 0 ? (
                    availableInputs.map((value, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isProcessing || (challengeType === 'predict' && !prediction.trim())}
                        onClick={() => processValue(value)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-blue-500/15 border border-blue-400/40 hover:bg-blue-500/30 text-white font-bold"
                      >
                        {value}
                      </button>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm">
                      All inputs used.{' '}
                      {challengeType === 'observe' && 'Click Continue when ready.'}
                      {challengeType === 'discover_rule' && 'Now guess the rule below.'}
                    </p>
                  )}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Processed Pairs (observe / predict / discover_rule) */}
          {challengeType !== 'create_rule' && processedPairs.length > 0 && (
            <LuminaCard>
              <LuminaCardContent className="py-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400">Input → Output Pairs</h4>
                  <span className="text-xs text-purple-300/70">{processedPairs.length} so far</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {processedPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-800/40 border border-slate-600/30 text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-blue-300 font-bold">{pair.input}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-purple-300 font-bold">{pair.output}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Pre-populated I/O Table (create_rule only) */}
          {challengeType === 'create_rule' && (
            <LuminaCard>
              <LuminaCardContent className="py-5">
                <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400 mb-4">
                  Input → Output Table
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {createRulePairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-800/40 border border-slate-600/30 text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-blue-300 font-bold">{pair.input}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-purple-300 font-bold">{pair.output}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  Look at the pattern. What rule transforms each input into its output?
                </p>
                {/* Worked-exemplar (create_rule easy only — process, NOT the rule) */}
                {hintLevel === 'full' && createRulePairs.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                    <p className="text-xs text-amber-200/90">
                      <span className="font-semibold">Worked example:</span> start with the first row
                      (input {createRulePairs[0].input} → output {createRulePairs[0].output}).
                      Try a rule on it, then check it gives the right output for the next row too.
                    </p>
                  </div>
                )}
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Rule Guess (discover_rule / create_rule) */}
          {(challengeType === 'discover_rule' || challengeType === 'create_rule')
            && (challengeType === 'create_rule' || processedPairs.length >= 2)
            && (
            <LuminaCard className="bg-amber-500/10 border-amber-400/30">
              <LuminaCardContent className="py-5">
                <h4 className="text-amber-200 font-semibold mb-3 text-center">
                  {challengeType === 'discover_rule' ? 'Can you guess the rule?' : 'Write the rule'}
                </h4>
                <div className="flex items-center gap-3 justify-center flex-wrap">
                  <span className="text-amber-300 font-mono">f(x) =</span>
                  <LuminaInput
                    type="text"
                    value={guessedRule}
                    onChange={(e) => { setGuessedRule(e.target.value); setGuessResult(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && checkRuleGuess()}
                    placeholder="e.g., x + 3"
                    className="flex-1 max-w-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={checkRuleGuess}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-amber-200"
                  >
                    Check
                  </button>
                </div>
                {guessResult === 'incorrect' && (
                  <div className="mt-3 p-3 bg-red-500/15 border border-red-400/30 rounded-lg text-center">
                    <span className="text-red-200 text-sm">
                      Not quite — try again. {showRuleHint && 'Hint: look at how the output changes as the input grows by 1.'}
                    </span>
                    <div className="mt-1 text-center text-xs text-slate-500">
                      {guessAttempts} attempt{guessAttempts !== 1 ? 's' : ''} so far
                    </div>
                  </div>
                )}
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Observe completion button — tier may require ALL inputs fed (hard). */}
          {challengeType === 'observe'
            && processedPairs.length >= (currentChallenge.pairsRequiredToComplete ?? 3)
            && (
            <div className="flex justify-center">
              <LuminaButton
                onClick={completeObserve}
                className="bg-blue-500/20 border border-blue-400/40 hover:bg-blue-500/30 text-blue-100"
              >
                Continue →
              </LuminaButton>
            </div>
          )}

          {/* How to Use (first challenge only) */}
          {currentIndex === 0 && processedPairs.length === 0 && challengeType !== 'create_rule' && showHowItWorks && (
            <LuminaCard className="bg-amber-500/5 border-amber-400/20">
              <LuminaCardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/30 flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-amber-200 font-medium text-sm mb-1">How it works</h4>
                    <ol className="text-xs text-amber-100/80 space-y-1 list-decimal list-inside">
                      {challengeType === 'observe' && (
                        <>
                          <li>Click an input number to feed it into the machine</li>
                          <li>Watch how the rule transforms it into an output</li>
                          <li>After observing a few pairs, click Continue</li>
                        </>
                      )}
                      {challengeType === 'predict' && (
                        <>
                          <li>Type your prediction for the output</li>
                          <li>Then click an input — the machine reveals the answer</li>
                          <li>Predict every input in the queue</li>
                        </>
                      )}
                      {challengeType === 'discover_rule' && (
                        <>
                          <li>The rule is hidden — feed inputs to see outputs</li>
                          <li>Study the pairs to find the pattern</li>
                          <li>Type your guess for the rule and click Check</li>
                        </>
                      )}
                    </ol>
                  </div>
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}
        </>
      )}
    </div>
  );
};

export default FunctionMachine;
