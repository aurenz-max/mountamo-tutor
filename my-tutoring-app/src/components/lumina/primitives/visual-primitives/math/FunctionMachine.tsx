'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';
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
  evaluateRule, rulesEquivalent, makeRuleKeys, MAKE_RULE_MAX_TILES, MAKE_RULE_WAYS, judgeMakeRule, makeRuleMissWords,
  makeRuleAsk, makeRuleTarget, compareInput, showRule as ruleText, type MakeRuleMiss,
} from './functionMachineDomain';
import {
  CHECK_PAIRS_LEVER, MODEL_LEVER, OUTPUT_STEPS_LEVER, PRACTICE_NOTE, RUN_MACHINE_LEVER, SHAPES_LEVER, STEP_ORDER_LEVER,
  isPracticeMachine, leverFacts, machineLevers, machineModel, machineRun, machineShapes, outputSteps, pairMarks,
  ruleDisplay, ruleSteps, simplerMachine, substituted, type MachineLeverContext,
} from './functionMachineLevers';
import {
  describeGuess, describeMachine, describeObserve, describePrediction, guessMiss, predictMiss, workspaceAssignment,
  workspaceScene, type FunctionMachineView,
} from './functionMachineWorkspace';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type FunctionMachineChallengeType =
  | 'observe'
  | 'predict'
  | 'discover_rule'
  | 'create_rule'
  | 'make_rule';

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
  // ── make_rule (open build) — "Make a machine that turns 4 into 12", then a different one. `rule` holds one machine
  // code knows makes the pair; it is never shown. Absent on an older payload: the first queued input and its output.
  makeInput?: number;
  makeOutput?: number;
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
  make_rule:     { label: 'Make', icon: '🧰', accentColor: 'purple' },
};

const CHALLENGE_TYPE_LABEL: Record<FunctionMachineChallengeType, string> = {
  observe: 'Watch & Learn',
  predict: 'Predict the Output',
  discover_rule: 'Discover the Rule',
  create_rule: 'Write the Rule',
  make_rule: 'Make a Machine',
};

// ============================================================================
// Helpers
// ============================================================================

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
  if (challengeType === 'make_rule') {
    // Open build: many rules pass and choosing one IS the task.
    return 'REVEAL POLICY: the learner invents the rule. Never say a rule, an operation or a number that would make the pair; '
      + 'you may ask what they could do to the input, and talk about the machine they built.';
  }
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

/** A number fed into the machine: in the hopper, then (after a beat) out of the chute. Display only. */
interface Flight { input: number; output: number | null }

/** What the pulled help levers draw (`functionMachineLevers.ts`). */
interface LeverShow {
  model: ReturnType<typeof machineModel>;
  steps: [string, string] | null;
  marks: ReturnType<typeof pairMarks>;
  lastGuess: string;
  changes: ReturnType<typeof outputSteps>;
  run: string[] | null;
  lastMachine: string;
  shapes: string[] | null;
}

const FunctionMachineSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FunctionMachineProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FunctionMachineChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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
  // Challenge Progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (ch) => workspaceAssignment(ch, challengeType),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the check callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  // Levers (`functionMachineLevers.ts`), keyed by the session item they were pulled on, and the easier practice machine
  // a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FunctionMachineChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex];
  /** What is on screen: the practice machine while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice machine. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  // The last rule / machine the learner checked on this item (the check_pairs and run_machine levers work on it).
  const [lastGuess, setLastGuess] = useState('');
  const [lastMachine, setLastMachine] = useState<string[]>([]);

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
  const [flight, setFlight] = useState<Flight | null>(null);
  const flightTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
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

  // make_rule (open build): the tiles in the row, the machines already accepted on this item, the misses so far, and
  // the last check's verdict (its words stay on screen until the next check; Try again keeps the row).
  const [makeRow, setMakeRow] = useState<string[]>([]);
  const [madeMachines, setMadeMachines] = useState<Array<{ tiles: string[]; rule: string }>>([]);
  const [makeMisses, setMakeMisses] = useState(0);
  const [makeVerdict, setMakeVerdict] = useState<{ kind: 'pass' | 'way' | MakeRuleMiss; words: string; gave: number | null } | null>(null);

  const stopFlight = useCallback(() => {
    flightTimers.current.forEach(clearTimeout);
    flightTimers.current = [];
    setFlight(null);
  }, []);
  useEffect(() => () => { flightTimers.current.forEach(clearTimeout); }, []);

  // -------------------------------------------------------------------------
  // Per-challenge reset: the scripted path runs it whenever the index moves to a new challenge; the workspace path
  // runs it from `onItemOpened`, in the same render as the item change, so no stale scene is published for the item.
  // -------------------------------------------------------------------------
  const resetForChallenge = (challenge: FunctionMachineChallenge | undefined) => {
    if (!challenge) return;
    // discover_rule support tier may PRE-REVEAL some I/O pairs (easy = more, hard =
    // fewer). These are tier-derived; they MUST be seeded here so they reset per rule
    // and never leak across challenges. The rule itself stays hidden (mode identity).
    const prefill =
      challenge.showRule === false &&
      challengeType === 'discover_rule' &&
      challenge.prefilledPairCount != null
        ? Math.min(challenge.prefilledPairCount, challenge.inputQueue.length)
        : 0;
    if (prefill > 0) {
      const seeded: Array<{ input: number; output: number }> = [];
      const seededInputs = challenge.inputQueue.slice(0, prefill);
      for (const input of seededInputs) {
        const output = evaluateRule(challenge.rule, input);
        if (output !== null) seeded.push({ input, output });
      }
      setProcessedPairs(seeded);
      setAvailableInputs(
        challenge.inputQueue.filter((v) => !seededInputs.includes(v)),
      );
    } else {
      setProcessedPairs([]);
      setAvailableInputs(challenge.inputQueue);
    }
    stopFlight();
    setPrediction('');
    setPredictionFeedback(null);
    setPredictionsCorrect(0);
    setPredictionsTotal(0);
    setGuessedRule('');
    setGuessResult(null);
    setGuessAttempts(0);
    setChallengeDone(false);
    setMakeRow([]);
    setMadeMachines([]);
    setMakeMisses(0);
    setMakeVerdict(null);
    setLastGuess('');
    setLastMachine([]);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (!tutorOwned) resetForChallenge(currentChallenge);
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Workspace path. A fresh item (or the full item back after a practice machine) resets everything. Try again after
  // a checked miss clears the typed prediction or rule and keeps a practice machine; pairs already fed stay (they are
  // data, not the answer). make_rule keeps its row and verdict, so the learner revises the machine.
  openItem.current = (index, retry) => {
    if (!retry) { setPractice(null); resetForChallenge(challenges[index]); return; }
    stopFlight();
    setPrediction('');
    setPredictionFeedback(null);
    setGuessedRule('');
    setGuessResult(null);
  };

  const makeTarget = challengeType === 'make_rule' && currentChallenge ? makeRuleTarget(currentChallenge) : null;

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
  // AI Tutoring (scripted path only: its context carries the rule)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    title,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    // make_rule: the stored rule is only one of many that pass; naming it would do the task, so the tutor never gets it.
    rule: challengeType === 'make_rule' ? '' : currentChallenge?.rule ?? '',
    ...(challengeType === 'make_rule' ? {
      makeInput: makeTarget?.input ?? '',
      makeOutput: makeTarget?.output ?? '',
      machineInRow: ruleText(makeRow),
      machinesMade: madeMachines.map((m) => ruleText(m.tiles)).join(' ; '),
    } : {}),
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
    predictionsTotal, guessAttempts, guessResult, makeTarget?.input, makeTarget?.output, makeRow, madeMachines,
  ]);

  // Its context carries the rule, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'function-machine',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeLabel(gradeBand),
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

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
  // Feed a value through the machine (observe / predict / discover_rule). The pair is recorded at once; the hopper
  // and chute animation that follows is display only, so a quick second feed is never lost.
  // -------------------------------------------------------------------------
  const processValue = useCallback((input: number) => {
    if (!currentChallenge || learnerBlocked()) return;
    const output = evaluateRule(currentChallenge.rule, input);
    if (output === null) return;
    if (challengeType === 'predict' && !prediction.trim()) return;
    SoundManager.tap();           // ← tactile feed of an input into the machine

    // Predict-mode: judge the prediction BEFORE revealing the output.
    if (challengeType === 'predict') {
      const predicted = parseFloat(prediction);
      const right = !isNaN(predicted) && Math.abs(predicted - output) < 0.01;
      setPredictionFeedback(right ? 'correct' : 'incorrect');
      setPredictionsTotal((t) => t + 1);
      if (right) setPredictionsCorrect((c) => c + 1);
      if (right) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      if (tutorOwned) {
        // Workspace path: a wrong prediction is a checked miss and the output stays hidden until the learner gets
        // it; the item's success is the last input predicted right.
        if (!right) {
          commitCheck.current(describePrediction(input, prediction), false, predictMiss(currentChallenge.rule, input, prediction));
          return;
        }
        if (availableInputs.length === 1 && availableInputs[0] === input) {
          commitCheck.current(describePrediction(input, prediction), true);
        }
      } else if (right) {
        sendText(`[PREDICTION_CORRECT] Student predicted ${predicted} for input ${input}. Output ${output}. Celebrate briefly.`, { silent: true });
      } else {
        sendText(`[PREDICTION_INCORRECT] Student predicted ${predicted} for input ${input}, actual output ${output}. ${tutorRevealClause('predict', supportTier)} Encourage and hint at the pattern.`, { silent: true });
      }
    }

    setProcessedPairs((prev) => [...prev, { input, output }]);
    setAvailableInputs((prev) => prev.filter((v) => v !== input));
    setPrediction('');

    flightTimers.current.forEach(clearTimeout);
    setFlight({ input, output: null });
    flightTimers.current = [
      setTimeout(() => setFlight({ input, output }), 600),
      setTimeout(() => setFlight(null), 1400),
    ];
  }, [currentChallenge, challengeType, prediction, availableInputs, sendText, supportTier, tutorOwned]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Completion helpers — each mode has its own submit, all share stale-state guard
  // -------------------------------------------------------------------------

  /** Stale-state guard: only record when the local state belongs to the active challenge. */
  const completeCurrentChallenge = useCallback((result: ChallengeResult) => {
    if (!currentChallenge) return;
    // A practice machine (a simplify lever) is not the session's challenge: it records nothing and shows no interstitial.
    if (isPracticeMachine(currentChallenge)) return;
    if (recordedRef.current) return;
    if (result.challengeId !== currentChallenge.id) return;
    recordedRef.current = true;
    recordResult(result);
    setChallengeDone(true);
  }, [currentChallenge, recordResult]);

  /** observe: complete on "Continue" button after >=3 pairs observed. */
  const completeObserve = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    const pairsObserved = processedPairs.length;
    const allInputsUsed = availableInputs.length === 0;
    const score = allInputsUsed ? 100 : pairsObserved >= 3 ? 85 : 60;
    commitCheck.current(describeObserve(pairsObserved), true);
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
  }, [currentChallenge, processedPairs.length, availableInputs.length, completeCurrentChallenge, sendText]); // eslint-disable-line react-hooks/exhaustive-deps

  /** predict: complete when all inputs have been predicted. */
  useEffect(() => {
    if (challengeType !== 'predict') return;
    if (!currentChallenge || isPracticeMachine(currentChallenge)) return;
    if (recordedRef.current) return;
    if (availableInputs.length !== 0) return;
    if (predictionsTotal === 0) return;
    // Stale-state guard: the pairs we just produced must belong to this challenge.
    if (processedPairs.length !== currentChallenge.inputQueue.length) return;
    const score = Math.round((predictionsCorrect / predictionsTotal) * 100);
    completeCurrentChallenge({
      challengeId: currentChallenge.id,
      // Workspace path: every input was predicted right in the end (a miss reopens the same input).
      correct: tutorOwned || predictionsCorrect === predictionsTotal,
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
    predictionsCorrect, processedPairs.length, completeCurrentChallenge, sendText, tutorOwned,
  ]);

  /** discover_rule / create_rule: complete on correct rule guess. */
  const checkRuleGuess = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    if (!guessedRule.trim()) return;
    const nextAttempts = guessAttempts + 1;
    setGuessAttempts(nextAttempts);
    setLastGuess(guessedRule);

    const isCorrect = rulesEquivalent(guessedRule, currentChallenge.rule);
    setGuessResult(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    const shown = challengeType === 'create_rule' ? createRulePairs : processedPairs;
    commitCheck.current(describeGuess(guessedRule), isCorrect,
      isCorrect ? undefined : guessMiss(guessedRule, currentChallenge.rule, shown));

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
  }, [currentChallenge, guessedRule, guessAttempts, challengeType, processedPairs, createRulePairs, completeCurrentChallenge, sendText, supportTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // make_rule (open build): tap tiles into the row, tap a row tile to take it out, "I'm done!" runs the machine.
  // -------------------------------------------------------------------------
  const addMakeTile = useCallback((tile: string) => {
    if (challengeDone || learnerBlocked()) return;
    SoundManager.tap();
    setMakeRow((row) => (row.length >= MAKE_RULE_MAX_TILES ? row : [...row, tile]));
  }, [challengeDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeMakeTile = useCallback((index: number) => {
    if (challengeDone || learnerBlocked()) return;
    setMakeRow((row) => row.filter((_, i) => i !== index));
  }, [challengeDone]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * "I'm done!": the machine runs the learner's rule on the asked input. A first accepted machine is kept on screen
   * and the row opens empty for the second; a miss keeps the row (Try again revises it); the second accepted machine
   * completes the item. Only a miss and the item's last machine are checked commits: the first machine is progress.
   */
  const handleMakeDone = useCallback(() => {
    if (!currentChallenge || !makeTarget || makeRow.length === 0 || challengeDone || learnerBlocked()) return;
    const { input, output } = makeTarget;
    const verdict = judgeMakeRule(makeRow, input, output, madeMachines.map((m) => m.rule));
    const built = ruleText(makeRow);
    if (verdict.miss) {
      SoundManager.playIncorrect();
      setMakeMisses((n) => n + 1);
      setLastMachine([...makeRow]);
      setMakeVerdict({ kind: verdict.miss, words: makeRuleMissWords(verdict, input, output), gave: verdict.gave });
      commitCheck.current(describeMachine(makeRow, input, verdict.gave), false, verdict.miss);
      sendText(
        `[MACHINE_CHECKED] The learner built f(x) = ${built} and pressed I'm done. `
        + (verdict.gave === null ? 'The machine could not run it. ' : `Fed ${input}, it gave ${verdict.gave}. `)
        + `The ask: a machine that turns ${input} into ${output}${madeMachines.length ? `, working differently from their first machine (f(x) = ${ruleText(madeMachines[0].tiles)})` : ''}. `
        + `The board checked it: not right (${verdict.miss}). ${tutorRevealClause('make_rule')}`,
        { silent: true },
      );
      return;
    }
    SoundManager.playCorrect();
    const made = [...madeMachines, { tiles: [...makeRow], rule: verdict.rule }];
    setMadeMachines(made);
    setMakeRow([]);
    if (made.length < MAKE_RULE_WAYS) {
      setMakeVerdict({ kind: 'way', words: `Yes! f(x) = ${built} turns ${input} into ${output}.`, gave: verdict.gave });
      sendText(
        `[MACHINE_CHECKED] The learner built f(x) = ${built}; fed ${input}, it gave ${output}. The board checked it: right. `
        + `Next they make a different machine that also turns ${input} into ${output}. ${tutorRevealClause('make_rule')}`,
        { silent: true },
      );
      return;
    }
    setMakeVerdict({ kind: 'pass', words: `Two different machines, and both turn ${input} into ${output}!`, gave: verdict.gave });
    const attempts = makeMisses + 1;
    commitCheck.current(describeMachine(makeRow, input, verdict.gave), true);
    completeCurrentChallenge({
      challengeId: currentChallenge.id,
      correct: true,
      attempts,
      score: phaseScore(attempts),
      machines: made.map((m) => m.rule),
    });
    sendText(
      `[PHASE_COMPLETE] Make a machine: the learner built f(x) = ${ruleText(made[0].tiles)} and f(x) = ${built}; both turn ${input} into ${output}. `
      + `${makeMisses} miss(es) on the way. Celebrate that two different rules can share one input-output pair.`,
      { silent: true },
    );
  }, [currentChallenge, makeTarget, makeRow, madeMachines, makeMisses, challengeDone, completeCurrentChallenge, sendText]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Submit aggregate evaluation when all challenges complete (scripted path; the workspace submits from onFinished)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (tutorOwned) return;
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
    challengeType, submitEvaluation, sendText, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    const metrics: FunctionMachineMetrics = {
      type: 'function-machine',
      challengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // Workspace path: what the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation.
  // -------------------------------------------------------------------------
  const view: FunctionMachineView = {
    pairs: challengeType === 'create_rule' ? createRulePairs : processedPairs,
    inputsLeft: availableInputs,
    prediction,
    guess: guessedRule,
    guessOpen: processedPairs.length >= 2,
    makeRow,
    made: madeMachines.map((m) => ruleText(m.tiles)),
    lastCheck: makeVerdict?.words ?? '',
  };
  const viewRef = useRef(view);
  viewRef.current = view;
  const leverCtx: MachineLeverContext = { mode: challengeType, pairs: view.pairs, lastGuess, lastMachine };
  // What each pulled help lever draws (never on a practice machine).
  const leverShow: LeverShow = {
    model: leverOn(MODEL_LEVER) && sessionChallenge ? machineModel(sessionChallenge, challengeType) : null,
    steps: leverOn(STEP_ORDER_LEVER) && sessionChallenge ? ruleSteps(sessionChallenge.rule) : null,
    marks: leverOn(CHECK_PAIRS_LEVER) ? pairMarks(lastGuess, view.pairs) : null,
    lastGuess,
    changes: leverOn(OUTPUT_STEPS_LEVER) ? outputSteps(view.pairs) : [],
    run: leverOn(RUN_MACHINE_LEVER) && makeTarget && lastMachine.length ? machineRun(lastMachine, makeTarget.input) : null,
    lastMachine: ruleText(lastMachine),
    shapes: leverOn(SHAPES_LEVER) ? machineShapes(ruleComplexity) : null,
  };
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, challengeType, viewRef.current);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, leverCtx);
    const levers = practice ? [] : machineLevers(sessionChallenge, pulledLevers, leverCtx);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        // A help lever that would draw nothing yet is refused, so a pull is always something the learner can see.
        if (id === CHECK_PAIRS_LEVER && !pairMarks(lastGuess, viewRef.current.pairs))
          return 'No checked rule that runs yet: once the learner checks a rule, this marks it on every pair.';
        if (id === RUN_MACHINE_LEVER && !(makeTarget && lastMachine.length && machineRun(lastMachine, makeTarget.input)))
          return 'No checked machine that runs yet: once the learner checks a machine, this works it through.';
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerMachine(sessionChallenge, challengeType);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetForChallenge(easier);
          return { practice: workspaceAssignment(easier, challengeType) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetForChallenge(sessionChallenge); },
    };
  });

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

  return (
    <FunctionMachineScreen
      {...{
        title, description, challengeType, ruleComplexity, outputDisplay, showComplexityBadge, className, challenges,
        currentIndex, challengeResults, allChallengesComplete, hasSubmittedEvaluation, phaseResults, submittedResult,
        elapsedMs, currentChallenge, guessResult, guessAttempts, challengeDone, makeTarget, madeMachines, makeRow,
        makeVerdict, makeMisses, processedPairs, availableInputs, flight, prediction, predictionFeedback,
        predictionsCorrect, predictionsTotal, guessedRule, createRulePairs, tutorOwned, resolvedInstanceId,
        isAudioPlaying, activePrimitiveId, leverShow,
      }}
      isPractice={!!practice}
      blocked={tutorOwned && progress.canAttempt === false}
      onAdvance={() => advance()}
      onFeed={processValue}
      onPrediction={(v) => { if (!learnerBlocked()) { setPrediction(v); setPredictionFeedback(null); } }}
      onGuess={(v) => { if (!learnerBlocked()) { setGuessedRule(v); setGuessResult(null); } }}
      onCheckGuess={checkRuleGuess}
      onAddTile={addMakeTile}
      onRemoveTile={removeMakeTile}
      onStartOver={() => { if (!learnerBlocked()) setMakeRow([]); }}
      onMakeDone={handleMakeDone}
      onContinue={completeObserve}
    />
  );
};

// ============================================================================
// Rendering
// ============================================================================

interface FunctionMachineScreenProps {
  title: string;
  description: string;
  challengeType: FunctionMachineChallengeType;
  ruleComplexity: 'oneStep' | 'twoStep' | 'expression';
  outputDisplay: 'immediate' | 'animated' | 'hidden';
  showComplexityBadge: boolean;
  className?: string;
  challenges: FunctionMachineChallenge[];
  currentIndex: number;
  challengeResults: ChallengeResult[];
  allChallengesComplete: boolean;
  hasSubmittedEvaluation: boolean;
  phaseResults: ReturnType<typeof usePhaseResults>;
  submittedResult: { score?: number } | null | undefined;
  elapsedMs: number;
  currentChallenge: FunctionMachineChallenge;
  guessResult: 'correct' | 'incorrect' | null;
  guessAttempts: number;
  challengeDone: boolean;
  makeTarget: { input: number; output: number } | null;
  madeMachines: Array<{ tiles: string[]; rule: string }>;
  makeRow: string[];
  makeVerdict: { kind: 'pass' | 'way' | MakeRuleMiss; words: string; gave: number | null } | null;
  makeMisses: number;
  processedPairs: Array<{ input: number; output: number }>;
  availableInputs: number[];
  flight: Flight | null;
  prediction: string;
  predictionFeedback: 'correct' | 'incorrect' | null;
  predictionsCorrect: number;
  predictionsTotal: number;
  guessedRule: string;
  createRulePairs: Array<{ input: number; output: number }>;
  tutorOwned: boolean;
  resolvedInstanceId: string;
  isAudioPlaying: boolean;
  activePrimitiveId: string | null | undefined;
  leverShow: LeverShow;
  /** A practice machine (a simplify lever) is on screen in place of the item. */
  isPractice: boolean;
  /** Workspace path: a checked answer waits for Try again or Next challenge. */
  blocked: boolean;
  onAdvance: () => void;
  onFeed: (input: number) => void;
  onPrediction: (value: string) => void;
  onGuess: (value: string) => void;
  onCheckGuess: () => void;
  onAddTile: (tile: string) => void;
  onRemoveTile: (index: number) => void;
  onStartOver: () => void;
  onMakeDone: () => void;
  onContinue: () => void;
}

const FunctionMachineScreen: React.FC<FunctionMachineScreenProps> = (p) => {
  const {
    title, description, challengeType, ruleComplexity, outputDisplay, showComplexityBadge, className, challenges,
    currentIndex, challengeResults, allChallengesComplete, hasSubmittedEvaluation, phaseResults, submittedResult,
    elapsedMs, currentChallenge, guessResult, guessAttempts, challengeDone, makeTarget, madeMachines, makeRow,
    makeVerdict, makeMisses, processedPairs, availableInputs, flight, prediction, predictionFeedback,
    predictionsCorrect, predictionsTotal, guessedRule, createRulePairs, tutorOwned, blocked, leverShow,
  } = p;

  const showRule = currentChallenge.showRule || guessResult === 'correct';
  const isProcessing = flight !== null && flight.output === null;
  // The pair in flight joins the table once it leaves the chute.
  const shownPairs = isProcessing ? processedPairs.filter((pair) => pair.input !== flight!.input) : processedPairs;

  // Tier-derived UI gates (default = current behavior when no tier present).
  // hintLevel 'full' = how-it-works + early hint; 'minimal' = standard (hint after 2
  // attempts); 'none' = no scaffolding hints. NEVER affects rule visibility.
  const hintLevel = currentChallenge.hintLevel;
  const showHowItWorks = hintLevel == null ? true : hintLevel === 'full';
  // discover/create hint text: 'none' suppresses it; 'full' offers it early (after 1
  // attempt); otherwise the standard "after 2 attempts" gate.
  const ruleHintThreshold = hintLevel === 'full' ? 1 : 2;
  const showRuleHint = hintLevel !== 'none' && guessAttempts >= ruleHintThreshold;

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: p.resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The function machine',
    solved: challengeDone && challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: p.isAudioPlaying && p.activePrimitiveId === p.resolvedInstanceId,
  });

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

      {/* Pip's dock stays mounted through the interstitial so a solved machine can
          be celebrated; it outlines the active workspace below as a region. */}
      {pip.store && !allChallengesComplete && <div {...pip.dock} />}

      {/* Between-challenge interstitial */}
      {challengeDone && !allChallengesComplete && (
        <LuminaCard className="bg-emerald-500/10 border-emerald-400/40">
          <LuminaCardContent className="py-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="text-emerald-100 font-semibold text-lg mb-1">
              Function {currentIndex + 1} Complete!
            </h3>
            {challengeType === 'make_rule' && makeTarget ? (
              <div className="text-sm text-emerald-200/80 mb-4 space-y-2" data-make-compare>
                <p>Both your machines turn {makeTarget.input} into {makeTarget.output}. Feed them {compareInput(makeTarget.input)}:</p>
                {madeMachines.map((m, i) => (
                  <p key={i} className="font-mono">
                    <span className="font-bold text-white">f(x) = {ruleText(m.tiles)}</span>
                    {' '}gives {evaluateRule(m.rule, compareInput(makeTarget.input)) ?? '—'}
                  </p>
                ))}
                {!tutorOwned && <p>Ready for the next one?</p>}
              </div>
            ) : (
              <p className="text-sm text-emerald-200/80 mb-4">
                Rule was <span className="font-mono font-bold text-white">f(x) = {currentChallenge.rule}</span>.{!tutorOwned && ' Ready for the next one?'}
              </p>
            )}
            {/* The workspace's shell offers Next challenge; the runtime owns progression there. */}
            {!tutorOwned && (
              <LuminaActionButton action="next" onClick={p.onAdvance}>
                Next Function →
              </LuminaActionButton>
            )}
          </LuminaCardContent>
        </LuminaCard>
      )}

      {/* Active interaction (hidden once challenge is done or all done) */}
      {!challengeDone && !allChallengesComplete && (
        <>
          <div {...pip.workspace} className="space-y-6">
          {/* Machine Visualization */}
          <LuminaCard>
            <LuminaCardContent className="py-8">
              <div className="flex items-center justify-center gap-6 md:gap-8">
                {/* Input Hopper */}
                <div className="flex flex-col items-center">
                  <span className="text-xs text-blue-400 font-mono uppercase tracking-wider mb-2">Input</span>
                  <div className="w-20 h-28 border-2 border-blue-400/40 rounded-t-lg bg-blue-500/10 relative flex items-center justify-center">
                    {challengeType === 'make_rule' && makeTarget ? (
                      <div className="w-11 h-11 rounded-full bg-blue-500/30 border-2 border-blue-400/60 flex items-center justify-center text-white font-bold text-sm">
                        {makeTarget.input}
                      </div>
                    ) : flight !== null && (
                      <div className="w-11 h-11 rounded-full bg-blue-500/30 border-2 border-blue-400/60 flex items-center justify-center text-white font-bold animate-bounce text-sm">
                        {flight.input}
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
                    <div className="text-xs text-blue-300 font-mono mb-2 uppercase">{challengeType === 'make_rule' ? 'Your Machine' : 'Function Rule'}</div>
                    {challengeType === 'make_rule' ? (
                      <div data-make-machine className="text-lg font-bold text-white font-mono bg-slate-900/30 px-3 py-1.5 rounded-lg border border-blue-400/20 min-w-[6rem]">
                        f(x) = {makeRow.length ? ruleText(makeRow) : '…'}
                      </div>
                    ) : showRule && leverShow.steps ? (
                      // step_order lever: the rule redrawn as its two steps, with only the rule's own numbers.
                      <div data-lever="step-order" className="text-base font-bold text-white font-mono bg-slate-900/30 px-3 py-1.5 rounded-lg border border-amber-400/40 space-y-1">
                        <div>first {leverShow.steps[0]}</div>
                        <div>then {leverShow.steps[1]}</div>
                      </div>
                    ) : showRule ? (
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
                    {challengeType === 'make_rule' && makeVerdict && makeVerdict.gave !== null && (
                      <div data-make-output className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-white font-bold text-sm ${
                        makeVerdict.kind === 'pass' || makeVerdict.kind === 'way' || makeVerdict.kind === 'same_machine'
                          ? 'bg-emerald-500/30 border-emerald-400/60' : 'bg-rose-500/30 border-rose-400/60'}`}>
                        {makeVerdict.gave}
                      </div>
                    )}
                    {flight !== null && flight.output !== null && outputDisplay !== 'hidden' && (
                      <div className={`w-11 h-11 rounded-full bg-purple-500/30 border-2 border-purple-400/60 flex items-center justify-center text-white font-bold text-sm ${outputDisplay === 'animated' ? 'animate-bounce' : ''}`}>
                        {flight.output}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </LuminaCardContent>
          </LuminaCard>

          {/* A practice machine (simplify lever) is ungraded; the full item comes back after it. */}
          {p.isPractice && (
            <div data-practice className="text-center text-sm text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg py-2">
              Practice machine first. It is not graded; your machine comes back after it.
            </div>
          )}

          {/* Pulled help levers (functionMachineLevers.ts). Each draws what it names, never the item's answer. */}
          {leverShow.model && (
            <LuminaCard data-lever="model-machine" className="bg-sky-500/10 border-sky-400/30">
              <LuminaCardContent className="py-4 text-center space-y-1">
                <div className="text-xs uppercase tracking-wider text-sky-300 font-mono">A different machine</div>
                <div className="font-mono text-white font-bold">f(x) = {ruleDisplay(leverShow.model.rule)}</div>
                {leverShow.model.pairs.map((pair) => (
                  <div key={pair.input} className="font-mono text-sky-100 text-sm">
                    {substituted(leverShow.model!.rule, pair.input)} = {pair.output}
                  </div>
                ))}
              </LuminaCardContent>
            </LuminaCard>
          )}
          {leverShow.marks && (
            <LuminaCard data-lever="check-pairs" className="bg-sky-500/10 border-sky-400/30">
              <LuminaCardContent className="py-4 text-center space-y-2">
                <div className="text-sm text-sky-200">Your rule f(x) = <span className="font-mono">{leverShow.lastGuess.trim()}</span> on each pair:</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leverShow.marks.map((m) => (
                    <span key={m.input} className={`font-mono text-sm px-2 py-1 rounded border ${m.fits ? 'border-emerald-400/50 text-emerald-200' : 'border-rose-400/50 text-rose-200'}`}>
                      {m.input} → {m.output} {m.fits ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}
          {leverShow.changes.length > 0 && (
            <LuminaCard data-lever="output-steps" className="bg-sky-500/10 border-sky-400/30">
              <LuminaCardContent className="py-4 text-center space-y-2">
                <div className="text-sm text-sky-200">When the input goes up by 1, the output changes by:</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leverShow.changes.map((c) => (
                    <span key={c.from} className="font-mono text-sm px-2 py-1 rounded border border-sky-400/40 text-sky-100">
                      {c.from} to {c.to}: {c.change}
                    </span>
                  ))}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}
          {leverShow.run && (
            <LuminaCard data-lever="run-machine" className="bg-sky-500/10 border-sky-400/30">
              <LuminaCardContent className="py-4 text-center space-y-1">
                <div className="text-sm text-sky-200">Your machine f(x) = <span className="font-mono">{leverShow.lastMachine}</span>, worked through:</div>
                {leverShow.run.map((line) => <div key={line} className="font-mono text-sky-100">{line}</div>)}
              </LuminaCardContent>
            </LuminaCard>
          )}
          {leverShow.shapes && (
            <LuminaCard data-lever="machine-shapes" className="bg-sky-500/10 border-sky-400/30">
              <LuminaCardContent className="py-4 text-center space-y-2">
                <div className="text-sm text-sky-200">Machines are built like these. Each one uses x.</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leverShow.shapes.map((shape) => (
                    <span key={shape} className="font-mono px-3 py-1 rounded-lg border border-sky-400/40 text-white">{shape}</span>
                  ))}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

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
                    aria-label="My prediction"
                    value={prediction}
                    onChange={(e) => p.onPrediction(e.target.value)}
                    placeholder="?"
                    disabled={blocked}
                    className="w-24 text-center font-mono"
                  />
                  {predictionFeedback === 'correct' && (
                    <LuminaBadge accent="emerald">Correct!</LuminaBadge>
                  )}
                  {predictionFeedback === 'incorrect' && (
                    <LuminaBadge accent="rose">Not quite</LuminaBadge>
                  )}
                  {/* The workspace's observer keeps the tally there. */}
                  {!tutorOwned && predictionsTotal > 0 && hintLevel !== 'none' && (
                    <span className="text-xs text-amber-300/70 ml-auto">
                      {predictionsCorrect}/{predictionsTotal} correct
                    </span>
                  )}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Available Inputs (observe / predict / discover_rule) */}
          {challengeType !== 'create_rule' && challengeType !== 'make_rule' && (
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
                        aria-label={`Feed ${value}`}
                        disabled={blocked || (challengeType === 'predict' && !prediction.trim())}
                        onClick={() => p.onFeed(value)}
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
          {challengeType !== 'create_rule' && challengeType !== 'make_rule' && shownPairs.length > 0 && (
            <LuminaCard>
              <LuminaCardContent className="py-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400">Input → Output Pairs</h4>
                  <span className="text-xs text-purple-300/70">{shownPairs.length} so far</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {shownPairs.map((pair, idx) => (
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

          {/* make_rule (open build): the ask, the accepted machine, the learner's row, the keypad, Start over + I'm done! */}
          {challengeType === 'make_rule' && makeTarget && (
            <LuminaCard data-make-card className="bg-purple-500/10 border-purple-400/30">
              <LuminaCardContent className="py-5 space-y-4">
                <h4 data-make-ask className="text-purple-100 font-semibold text-center text-lg">
                  {makeRuleAsk(makeTarget.input, makeTarget.output, madeMachines.length + 1)}
                </h4>
                {madeMachines.length > 0 && (
                  <div className="text-center text-sm text-emerald-200/90" data-made-machines>
                    {madeMachines.map((m, i) => (
                      <span key={i} className="inline-block font-mono px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 mx-1">
                        Machine {i + 1}: f(x) = {ruleText(m.tiles)} ✓
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 flex-wrap min-h-[52px]" data-make-row aria-label="Your machine's rule">
                  <span className="text-purple-300 font-mono">f(x) =</span>
                  {makeRow.length === 0 && (
                    <span className="w-11 h-11 rounded-lg border-2 border-dashed border-purple-400/40" aria-hidden />
                  )}
                  {makeRow.map((tile, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Take out ${tile}`}
                      disabled={blocked}
                      onClick={() => p.onRemoveTile(i)}
                      className="min-w-[44px] h-11 px-2 rounded-lg bg-purple-500/25 border border-purple-400/50 text-white font-mono font-bold text-lg hover:bg-purple-500/40"
                    >
                      {tile}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2" data-make-keys>
                  {makeRuleKeys(ruleComplexity).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Add ${key}`}
                      disabled={blocked || makeRow.length >= MAKE_RULE_MAX_TILES}
                      onClick={() => p.onAddTile(key)}
                      className="min-w-[44px] h-11 px-2 rounded-lg bg-slate-800/60 border border-slate-500/40 text-white font-mono font-bold text-lg hover:bg-slate-700/60 disabled:opacity-40"
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-3">
                  {/* Always pressable: clearing an empty row does nothing. */}
                  <LuminaButton onClick={p.onStartOver} disabled={blocked}>
                    Start over
                  </LuminaButton>
                  <LuminaActionButton action="check" onClick={p.onMakeDone} disabled={blocked || makeRow.length === 0}>
                    I&apos;m done!
                  </LuminaActionButton>
                </div>
                {makeVerdict && (
                  <div
                    data-make-verdict={makeVerdict.kind}
                    className={`p-3 rounded-lg text-center text-sm ${
                      makeVerdict.kind === 'pass' || makeVerdict.kind === 'way'
                        ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-100'
                        : 'bg-red-500/15 border border-red-400/30 text-red-200'}`}
                  >
                    {makeVerdict.words}
                    {makeVerdict.kind !== 'pass' && makeVerdict.kind !== 'way' && hintLevel !== 'none'
                      && makeMisses >= (hintLevel === 'full' ? 1 : 2) && (
                      <span className="block mt-1 text-xs text-amber-200/80">
                        Hint: what could the machine do to {makeTarget.input}: add something, take something away, multiply, or divide?
                      </span>
                    )}
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
                  {/* No example rule in the placeholder: an example could be the answer. */}
                  <LuminaInput
                    type="text"
                    aria-label="Your rule"
                    value={guessedRule}
                    onChange={(e) => p.onGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && p.onCheckGuess()}
                    placeholder="use x"
                    disabled={blocked}
                    className="flex-1 max-w-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={p.onCheckGuess}
                    disabled={blocked}
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
                onClick={p.onContinue}
                disabled={blocked}
                className="bg-blue-500/20 border border-blue-400/40 hover:bg-blue-500/30 text-blue-100"
              >
                Continue →
              </LuminaButton>
            </div>
          )}

          </div>

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
                      {challengeType === 'make_rule' && (
                        <>
                          <li>Tap tiles to build your machine&apos;s rule; tap a tile in the rule to take it out</li>
                          <li>Press I&apos;m done! and the machine runs your rule on the input</li>
                          <li>Then build a different machine that does the same job</li>
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

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FunctionMachine = withWorkspaceController<FunctionMachineProps, ProgressOptions<FunctionMachineChallenge>, Progress>(
  'function-machine', FunctionMachineSurface, useScriptedProgress, useWorkspaceProgressFor('function-machine'));

export default FunctionMachine;
