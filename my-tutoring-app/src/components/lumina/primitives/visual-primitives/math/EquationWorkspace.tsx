'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaPanel,
  LuminaPrompt,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EquationWorkspaceMetrics } from '../../../evaluation/types';
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
  currentEquation, describeEquationWork, equationMiss, expectedOperationId, mergeCommutingSteps, operationCorrect, workspaceAssignment,
  workspaceScene,
} from './equationWorkspaceDomain';
import {
  FEWER_LEVER, INVERSE_LEVER, INVERSE_TEXT, MODEL_LEVER, ORDER_LEVER, SIDES_LEVER, orderText, equationLevers,
  fewerSteps, isPracticeEquation, leverFacts, markedSides, modelLines, workedModel,
} from './equationWorkspaceLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EquationWorkspaceSolutionStep {
  operation: string;
  operationId: string;
  resultLatex: string;
}

export interface EquationWorkspaceOperation {
  id: string;
  label: string;
  category: 'arithmetic' | 'algebraic' | 'trigonometric' | 'logarithmic' | 'radical';
}

export interface EquationWorkspaceChallenge {
  id: string;
  type: 'guided-solve' | 'solve' | 'multi-step' | 'identify-operation';
  instruction: string;
  equation: string;
  targetVariable: string;
  solutionSteps: EquationWorkspaceSolutionStep[];
  availableOperations: EquationWorkspaceOperation[];
  /** For identify-operation: the correct next operation ID */
  correctOperationId?: string;
  knownValues?: Record<string, number>;

  // ── Within-mode support tier scaffolds (set by the generator from config.difficulty).
  //    Each WITHDRAWS solving help; none changes the equation, steps, or answer.
  //    The checker never reads these — they are display-only. ──
  /** Highlight the correct next operation in the menu (easy, solving modes only). */
  showNextStepHint?: boolean;
  /** Show the "undo what's attached to the variable — use the inverse operation" reminder. */
  showInverseReminder?: boolean;
  /** Show the balanced-state PROCESS indicator (both sides stay equal). Never shows the answer. */
  showBalanceIndicator?: boolean;
}

export interface EquationWorkspaceData {
  title: string;
  description?: string;
  context?: string;
  variableDefinitions?: Array<{
    symbol: string;
    name: string;
    unit?: string;
  }>;
  /** Within-mode support tier ('easy' | 'medium' | 'hard') — calibrates tutor reveal. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: EquationWorkspaceChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationWorkspaceMetrics>) => void;
}

interface EquationWorkspaceProps {
  data: EquationWorkspaceData;
  index?: number;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'guided-solve': { label: 'Guided Solve', icon: '💡', accentColor: 'blue' },
  'solve': { label: 'Solve', icon: '🧩', accentColor: 'purple' },
  'multi-step': { label: 'Multi-Step', icon: '🔗', accentColor: 'emerald' },
  'identify-operation': { label: 'Identify Operation', icon: '🎯', accentColor: 'amber' },
};

const CATEGORY_ACCENTS: Record<string, LuminaAccent> = {
  arithmetic: 'blue',
  algebraic: 'purple',
  trigonometric: 'emerald',
  logarithmic: 'amber',
  radical: 'rose',
};

/** A solved item's own score: 15 off per wrong operation, 10 per hint. */
const itemScore = (incorrectOps: number, hintsUsed: number) => Math.max(0, Math.round(100 - incorrectOps * 15 - hintsUsed * 10));

function sessionMetrics(challenges: EquationWorkspaceChallenge[], results: ChallengeResult[], solved: boolean, elapsedMs: number): EquationWorkspaceMetrics {
  const sum = (key: string) => results.reduce((s, r) => s + ((r[key] as number) ?? 0), 0);
  return {
    type: 'equation-workspace',
    stepsCompleted: sum('stepsCompleted'),
    stepsRequired: challenges.reduce((s, c) => s + (c.type === 'identify-operation' ? 1 : c.solutionSteps.length), 0),
    incorrectOperations: sum('incorrectOps'),
    hintsUsed: sum('hintsUsed'),
    solved,
    solveTime: Math.round(elapsedMs / 1000),
  };
}

// ============================================================================
// MathDisplay — inline KaTeX renderer
// ============================================================================

function MathDisplay({ latex, display = false, className = '' }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: false, trust: true });
    } catch {
      return `<span style="color:#f87171">${latex}</span>`;
    }
  }, [latex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ============================================================================
// Tutor reveal policy (scripted path) — calibrate how much the live tutor reveals per tier.
// INVARIANT: never reveal the final solution at any tier. For identify-operation the next
// operation IS the answer, so the tutor never names it at any tier.
// ============================================================================

function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  challengeType: EquationWorkspaceChallenge['type'],
): string {
  if (!tier) return '';
  const common = `Never reveal the final solution (the solved value of the target variable).`;

  if (challengeType === 'identify-operation') {
    switch (tier) {
      case 'easy':
        return `SUPPORT TIER easy: remind the student to think about the inverse operation that undoes what is attached to the variable, WITHOUT naming which operation is correct here. ${common}`;
      case 'medium':
        return `SUPPORT TIER medium: nudge them to look at what is currently applied to the variable; do not name the operation. ${common}`;
      default:
        return `SUPPORT TIER hard: minimal coaching — ask what is keeping the variable from being alone and let them choose unaided. Do not name the operation. ${common}`;
    }
  }

  switch (tier) {
    case 'easy':
      return `SUPPORT TIER easy: maximum scaffolding. You may name the inverse operation and the first step to apply, and walk through the order of operations. ${common}`;
    case 'medium':
      return `SUPPORT TIER medium: the balanced-state indicator is on screen but step hints are withdrawn. Nudge which side or term to address next; do not name the operation or pre-set the first step. ${common}`;
    default:
      return `SUPPORT TIER hard: the workspace is bare — deciding each step is the task. Do NOT name the inverse operation or the first move; ask what is keeping the variable from being alone. ${common}`;
  }
}

// ============================================================================
// Component
// ============================================================================

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
const EquationWorkspaceSurface = ({ data: props, runtimePlanItemId, tutorOwned, useController }:
  EquationWorkspaceProps & { tutorOwned: boolean; useController: (options: ProgressOptions<EquationWorkspaceChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    context,
    variableDefinitions,
    supportTier,
    challenges: rawChallenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = props;

  // Adjacent combine steps commute: merged into one, so either order the learner thinks of is credited.
  const challenges = useMemo(() => (rawChallenges ?? []).map(mergeCommutingSteps), [rawChallenges]);
  const resolvedInstanceId = instanceId ?? 'equation-workspace-default';
  const startTimeRef = useRef(Date.now());

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
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
    mergeResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked operation stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const { submitResult, hasSubmitted, submittedResult } = usePrimitiveEvaluation<EquationWorkspaceMetrics>({
    primitiveType: 'equation-workspace',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI tutoring (scripted path). Its context and cues carry the solution path, so it is off on the workspace path. ──
  const gradeLevel = '9-12';
  const aiPrimitiveData = useMemo(() => ({
    title,
    context,
    challengeCount: challenges.length,
    challengeTypes: Array.from(new Set(challenges.map(c => c.type))),
    supportTier: supportTier ?? null,
  }), [title, context, challenges, supportTier]);

  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'equation-workspace',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // In-item levers (`equationWorkspaceLevers.ts`), keyed by the session item they were pulled on, and the practice
  // equation a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<EquationWorkspaceChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the practice equation while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice equation. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-challenge state ──
  /** Solution steps applied so far (solving modes). */
  const [done, setDone] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [incorrectOps, setIncorrectOps] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  /** The wrong operation on screen (the workspace's learner work); cleared by Try again or the next tap. */
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [challengeSolved, setChallengeSolved] = useState(false);

  /** Try again keeps the steps already applied and clears only the operation that was checked wrong. */
  const clearWrong = () => {
    setFeedback(null);
    setSelectedAnswer(null);
    setLastWrong(null);
    setShowHint(false);
  };
  const resetChallenge = () => {
    clearWrong();
    setDone(0);
    setIncorrectOps(0);
    setHintsUsed(0);
    setChallengeSolved(false);
  };
  // `index` is the item opening: this render's challenge is still the one before it.
  openItem.current = (index, retry) => {
    // Try again on a practice equation keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) clearWrong();
    else if (challenges[index]) { setPractice(null); resetChallenge(); }
  };

  // Reset per-challenge state when the challenge on screen changes (both paths). Keyed by id, not object identity.
  useEffect(() => {
    if (currentChallenge) resetChallenge();
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send intro message for first challenge (scripted path)
  useEffect(() => {
    if (currentChallengeIndex === 0 && sessionChallenge) {
      sendText(
        `[NEXT_ITEM] Challenge 1 of ${challenges.length}. Type: ${sessionChallenge.type}. ` +
        `Student must solve "${sessionChallenge.equation}" for ${sessionChallenge.targetVariable}. ` +
        `Introduce the challenge briefly. ${tutorRevealPolicy(supportTier, sessionChallenge.type)}`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expectedStep = currentChallenge && currentChallenge.type !== 'identify-operation'
    ? currentChallenge.solutionSteps[done] : undefined;

  /** The solved item's own fields (score, steps, wrong operations), merged beside the verdict `commitCheck` records. */
  const recordSolved = (c: EquationWorkspaceChallenge, stepsCompleted: number) => {
    if (isPracticeEquation(c)) return;
    mergeResult({
      challengeId: c.id, correct: true, attempts: 1, score: itemScore(incorrectOps, hintsUsed),
      stepsCompleted, stepsRequired: c.type === 'identify-operation' ? 1 : c.solutionSteps.length, incorrectOps, hintsUsed,
    });
  };

  // ── Handlers ──

  // Solving modes: every tap is checked. A right step that leaves the variable attached is a step of the item and
  // commits nothing; a wrong operation, and the step that leaves the variable alone, are the checked gestures.
  const handleSelectOperation = (opId: string) => {
    const c = currentChallenge;
    if (!c || challengeSolved || learnerBlocked()) return;

    if (c.type === 'identify-operation') {
      SoundManager.select();
      setSelectedAnswer(opId);
      setFeedback(null);
      setLastWrong(null);
      return;
    }

    if (operationCorrect(c, done, opId)) {
      const step = c.solutionSteps[done];
      const next = done + 1;
      setDone(next);
      setFeedback({ message: 'Correct!', correct: true });
      setShowHint(false);
      setLastWrong(null);
      if (next === c.solutionSteps.length) {
        SoundManager.playCorrect();
        setChallengeSolved(true);
        sendText(
          `[ANSWER_CORRECT] Student solved the equation in ${next} steps ` +
          `with ${incorrectOps} incorrect attempts and ${hintsUsed} hints. Congratulate them!`,
          { silent: true },
        );
        recordSolved(c, next);
        commitCheck.current(describeEquationWork(c, next, null, true), true);
      } else {
        SoundManager.snap();
        sendText(
          `[STEP_CORRECT] Student applied "${step.operation}" correctly. ` +
          `${c.solutionSteps.length - next} steps remaining. Briefly encourage.`,
          { silent: true },
        );
      }
      return;
    }

    SoundManager.playIncorrect();
    setIncorrectOps(prev => prev + 1);
    setLastWrong(opId);
    const opLabel = c.availableOperations.find(o => o.id === opId)?.label ?? opId;
    setFeedback({
      message: `"${opLabel}" isn't the right step here. Think about what isolates ${c.targetVariable}.`,
      correct: false,
    });
    sendText(
      `[ANSWER_INCORRECT] Student chose "${opLabel}" but the correct next step is "${expectedStep?.operation}". ` +
      `They have made ${incorrectOps + 1} incorrect attempts. Give a gentle hint without revealing the answer.`,
      { silent: true },
    );
    commitCheck.current(describeEquationWork(c, done, opId), false, equationMiss(c, done, opId));
  };

  const handleCheckIdentify = () => {
    const c = currentChallenge;
    if (!c || !selectedAnswer || challengeSolved || learnerBlocked()) return;
    const correct = operationCorrect(c, 0, selectedAnswer);
    const opLabel = c.availableOperations.find(o => o.id === selectedAnswer)?.label ?? selectedAnswer;

    if (correct) {
      SoundManager.playCorrect();
      setChallengeSolved(true);
      setFeedback({ message: 'Correct! That\'s the right next step.', correct: true });
      sendText(`[ANSWER_CORRECT] Student correctly identified "${opLabel}" as the next operation. Congratulate briefly.`, { silent: true });
      recordSolved(c, 1);
      commitCheck.current(describeEquationWork(c, 0, selectedAnswer), true);
      return;
    }
    SoundManager.playIncorrect();
    setIncorrectOps(prev => prev + 1);
    const correctLabel = c.availableOperations.find(o => o.id === expectedOperationId(c, 0))?.label ?? '';
    setFeedback({ message: `Not quite. "${opLabel}" isn't the best next step here.`, correct: false });
    setLastWrong(selectedAnswer);
    setSelectedAnswer(null);
    sendText(
      `[ANSWER_INCORRECT] Student chose "${opLabel}" but correct is "${correctLabel}". ` +
      `Give a hint about why the correct operation helps isolate the variable.`,
      { silent: true },
    );
    commitCheck.current(describeEquationWork(c, 0, selectedAnswer), false, equationMiss(c, 0, selectedAnswer));
  };

  const handleUseHint = () => {
    if (!currentChallenge || challengeSolved || learnerBlocked()) return;
    setHintsUsed(prev => prev + 1);
    setShowHint(true);
  };

  // Scripted path only: the workspace hides Next and the runtime moves the index.
  const handleAdvance = () => {
    if (!advanceProgress()) return;
    const nextIdx = currentChallengeIndex + 1;
    const next = challenges[nextIdx];
    if (next) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${nextIdx + 1} of ${challenges.length}. ` +
        `Type: ${next.type}. Equation: "${next.equation}", solve for ${next.targetVariable}. ` +
        `Introduce briefly. ${tutorRevealPolicy(supportTier, next.type)}`,
        { silent: true },
      );
    }
  };

  // ── Compute overall score for summary ──
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length);
  }, [allChallengesComplete, challengeResults]);

  const elapsedMs = Date.now() - startTimeRef.current;

  // Scripted path: submit the session's own tally once every challenge is solved.
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || tutorOwned || hasSubmitted || hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
    submitResult(true, localOverallScore, sessionMetrics(challenges, challengeResults, true, Date.now() - startTimeRef.current));
  }, [allChallengesComplete, tutorOwned, hasSubmitted, submitResult, localOverallScore, challenges, challengeResults]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong operation's named miss.
  finish.current = (result) => {
    if (hasSubmitted || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submitResult(result.passed, result.accuracy,
      sessionMetrics(challenges, challengeResults, result.passed, Date.now() - startTimeRef.current),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Send ALL_COMPLETE message (scripted path)
  useEffect(() => {
    if (allChallengesComplete && phaseResults.length > 0) {
      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${localOverallScore}%. ` +
        `Give encouraging phase-specific feedback.`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChallengesComplete]);

  const isIdentifyMode = currentChallenge?.type === 'identify-operation';
  // Whether to highlight the correct next operation. When a support tier set the field, it governs (easy → on,
  // medium/hard → off); otherwise fall back to the guided-solve eval-mode default. Identify-operation never
  // highlights (the highlight would reveal the MC answer); neither does a practice equation.
  const showNextStepHint = !!currentChallenge && !isIdentifyMode && !practice &&
    (currentChallenge.showNextStepHint !== undefined ? currentChallenge.showNextStepHint : currentChallenge.type === 'guided-solve');
  const hintOperationId = showNextStepHint && expectedStep ? expectedStep.operationId : null;
  const reminderShown = !practice && !!sessionChallenge?.showInverseReminder;
  const leverContext = { reminderShown, done };
  const equationNow = currentChallenge ? currentEquation(currentChallenge, isIdentifyMode ? 0 : done) : '';
  const sides = leverOn(SIDES_LEVER) && currentChallenge ? markedSides(equationNow, currentChallenge.targetVariable) : null;
  const model = leverOn(MODEL_LEVER) && sessionChallenge ? workedModel(sessionChallenge) : null;

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, {
      done, selected: selectedAnswer, lastWrong, highlighted: showNextStepHint,
      inverseReminder: reminderShown || leverOn(INVERSE_LEVER), balanceShown: !practice && !!currentChallenge.showBalanceIndicator,
      solved: challengeSolved,
    });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, leverContext);
    const levers = practice ? [] : equationLevers(sessionChallenge, pulledLevers, leverContext);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'A practice equation is on screen in place of the item. It is not graded; the full item comes back after it, blank.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === SIDES_LEVER && !markedSides(equationNow, sessionChallenge.targetVariable))
          return 'The current line has no single side holding the variable to mark; try another lever.';
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = fewerSteps(sessionChallenge);
          if (!easier) return 'This equation has no shorter practice equation; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetChallenge();
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallenge(); },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete ? null : currentChallenge?.id ?? null,
    label: 'The equation workspace',
    solved: challengeSolved,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!currentChallenge) {
    return (
      <LuminaCard>
        <LuminaCardHeader>
          <LuminaCardTitle>{title}</LuminaCardTitle>
        </LuminaCardHeader>
        <LuminaCardContent>
          <p className="text-slate-400">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const completedSteps = isIdentifyMode ? [] : currentChallenge.solutionSteps.slice(0, done);

  return (
    <LuminaCard>
      <LuminaCardHeader>
        <div className="flex items-center justify-between">
          <div>
            <LuminaCardTitle>{title}</LuminaCardTitle>
            {context && <p className="text-slate-400 text-sm mt-1">{context}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LuminaChallengeCounter current={currentChallengeIndex + 1} total={challenges.length} />
            <LuminaBadge>
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
            </LuminaBadge>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6">
        {/* Summary panel when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Workspace Complete!"
            celebrationMessage="You solved all the equations!"
            className="mb-6"
          />
        )}

        {/* Don't show workspace UI after completion */}
        {!allChallengesComplete && (
          <>
            {/* Instruction */}
            <LuminaPrompt>
              {practice && (
                <p className="text-xs text-cyan-300 uppercase tracking-wider mb-1">Practice equation (not graded)</p>
              )}
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
              {variableDefinitions && variableDefinitions.length > 0 && !practice && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {variableDefinitions.map((v) => (
                    <span key={v.symbol} className="text-xs text-slate-400">
                      <MathDisplay latex={v.symbol} /> = {v.name}{v.unit ? ` (${v.unit})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </LuminaPrompt>

            {/* Inverse-operation reminder: the easy tier's starting position, or the `inverse_reminder` lever. Process
                guidance in words, never names the answer. */}
            {(reminderShown || leverOn(INVERSE_LEVER)) && !challengeSolved && (
              <LuminaPanel accent="blue" className="p-3 text-sm text-blue-200" data-lever="inverse-reminder">
                {INVERSE_TEXT}
              </LuminaPanel>
            )}
            {/* `layer_order` lever: reverse order, in words. */}
            {leverOn(ORDER_LEVER) && !challengeSolved && (
              <LuminaPanel accent="purple" className="p-3 text-sm text-purple-200" data-lever="layer-order">
                {sessionChallenge ? orderText(sessionChallenge) : null}
              </LuminaPanel>
            )}

            {/* Pip's dock sits above the workspace, which it outlines as a region. */}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-6">
            {/* Equation display / Step history — bespoke KaTeX readout surface */}
            <LuminaPanel className="p-6 space-y-3">
              {/* Support tier (easy/medium): balanced-state PROCESS indicator. Never shows the solved value. */}
              {currentChallenge.showBalanceIndicator && !practice && (
                <div className="flex items-center gap-2 pb-1">
                  <LuminaBadge accent="emerald" className="text-xs">
                    ⚖ Balanced
                  </LuminaBadge>
                  <span className="text-xs text-slate-400">
                    {completedSteps.length > 0
                      ? 'Each operation was applied to both sides — the equation stays equal.'
                      : 'Apply every operation to both sides to keep the equation balanced.'}
                  </span>
                </div>
              )}
              {/* Original equation */}
              <div className="flex items-center gap-3">
                <LuminaBadge className="text-slate-500 text-xs shrink-0">
                  Start
                </LuminaBadge>
                <div className={completedSteps.length > 0 ? 'text-slate-500' : 'text-slate-100'}>
                  <MathDisplay latex={currentChallenge.equation} display />
                </div>
              </div>

              {/* Completed steps */}
              {completedSteps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-xs text-emerald-400 italic">{step.operation}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LuminaBadge accent="emerald" className="text-xs shrink-0">
                      Step {idx + 1}
                    </LuminaBadge>
                    <div className={idx === completedSteps.length - 1 && !challengeSolved ? 'text-slate-100' : 'text-slate-400'}>
                      <MathDisplay latex={step.resultLatex} display />
                    </div>
                  </div>
                </div>
              ))}

              {/* `sides_marked` lever: the current line's two sides, boxed. Only what the line already shows. */}
              {sides && !challengeSolved && (
                <div data-lever="sides-marked" className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-center">
                    <p className="text-xs text-amber-300 mb-1">
                      <MathDisplay latex={currentChallenge.targetVariable} />&apos;s side
                    </p>
                    <MathDisplay latex={sides.variableSide} />
                  </div>
                  <div className="rounded-lg border border-slate-400/30 bg-slate-500/10 p-2 text-center">
                    <p className="text-xs text-slate-300 mb-1">The other side</p>
                    <MathDisplay latex={sides.otherSide} />
                  </div>
                </div>
              )}

              {/* Solved indicator */}
              {challengeSolved && !isIdentifyMode && (
                <div className="flex items-center gap-3 mt-2">
                  <LuminaBadge accent="emerald" className="text-xs">
                    Solved!
                  </LuminaBadge>
                  <span className="text-emerald-300 text-sm">
                    <MathDisplay latex={`${currentChallenge.targetVariable}`} /> is isolated
                  </span>
                </div>
              )}

              {/* Target variable reminder */}
              {!challengeSolved && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-slate-500">Goal: Solve for</span>
                  <MathDisplay latex={currentChallenge.targetVariable} className="text-amber-300 text-sm" />
                </div>
              )}
            </LuminaPanel>

            {/* `worked_model` lever: every line of a different equation with the same kinds of steps. */}
            {model && !challengeSolved && (
              <LuminaPanel accent="emerald" className="p-3 text-sm" data-lever="worked-model">
                <p className="text-xs text-emerald-300 uppercase tracking-wider mb-2">Worked example (a different equation)</p>
                <div className="space-y-1">
                  <div className="text-slate-100"><MathDisplay latex={model.equation} /></div>
                  {model.steps.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-emerald-400 italic">{s.operation}</span>
                      <span className="text-slate-200"><MathDisplay latex={s.resultLatex} /></span>
                    </div>
                  ))}
                </div>
                <span className="sr-only">{modelLines(model).join('. ')}</span>
              </LuminaPanel>
            )}

            {/* Feedback */}
            {feedback && (
              <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'}>
                {feedback.message}
              </LuminaFeedbackCard>
            )}

            {/* Identify-operation mode: MC */}
            {isIdentifyMode && !challengeSolved && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  What operation should be applied next?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentChallenge.availableOperations.map((op) => (
                    <LuminaAnswerChoice
                      key={op.id}
                      aria-label={op.label}
                      disabled={blocked}
                      state={selectedAnswer === op.id ? 'selected' : 'idle'}
                      className="flex items-center !p-3"
                      onClick={() => handleSelectOperation(op.id)}
                    >
                      <LuminaBadge accent={CATEGORY_ACCENTS[op.category]} className="mr-2 text-xs">
                        {op.category}
                      </LuminaBadge>
                      {op.label}
                    </LuminaAnswerChoice>
                  ))}
                </div>
                <div className="flex gap-2">
                  <LuminaActionButton
                    action="check"
                    disabled={!selectedAnswer || blocked}
                    onClick={handleCheckIdentify}
                  />
                </div>
              </div>
            )}

            {/* Solve / guided-solve / multi-step: operation menu */}
            {!isIdentifyMode && !challengeSolved && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">
                    Select the next operation:
                  </p>
                  {/* Manual step-hint button (scripted path): available unless the next-step hint is already
                      highlighted (easy) or the hard tier withdraws step hints. With the tutor, its levers do this. */}
                  {!tutorOwned && !showNextStepHint && supportTier !== 'hard' && (
                    <LuminaButton
                      tone="subtle"
                      className="text-xs"
                      onClick={handleUseHint}
                    >
                      Hint ({hintsUsed})
                    </LuminaButton>
                  )}
                </div>

                {/* Show hint */}
                {showHint && expectedStep && !tutorOwned && (
                  <LuminaPanel accent="amber" className="p-3 text-sm text-amber-200">
                    Think about: what operation would help move terms away from <MathDisplay latex={currentChallenge.targetVariable} />?
                    <br />
                    <span className="text-xs text-amber-400">Category: {expectedStep.operationId.split('_')[0]}</span>
                  </LuminaPanel>
                )}

                {/* Operation buttons — applying an op is a direct action, not a gradeable answer choice. Guided
                    mode highlights the expected op via the shared "selected" grading-color token. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentChallenge.availableOperations.map((op) => {
                    const isHinted = hintOperationId === op.id;
                    return (
                      <LuminaButton
                        key={op.id}
                        aria-label={op.label}
                        disabled={blocked}
                        className={`justify-start text-left h-auto py-3 px-4 ${
                          isHinted ? answerStateClass('selected') : ''
                        }`}
                        onClick={() => handleSelectOperation(op.id)}
                      >
                        <LuminaBadge accent={CATEGORY_ACCENTS[op.category]} className="mr-2 text-xs">
                          {op.category}
                        </LuminaBadge>
                        {op.label}
                      </LuminaButton>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advance button when solved (scripted path; the workspace's shell owns Next challenge). */}
            {challengeSolved && !tutorOwned && currentChallengeIndex < challenges.length - 1 && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={handleAdvance}>
                  Next Challenge
                </LuminaActionButton>
              </div>
            )}

            </div>

            {/* Known values reference */}
            {currentChallenge.knownValues && Object.keys(currentChallenge.knownValues).length > 0 && (
              <LuminaPanel className="p-3">
                <p className="text-xs text-slate-500 mb-1">Known values:</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(currentChallenge.knownValues).map(([sym, val]) => (
                    <span key={sym} className="text-sm text-slate-300">
                      <MathDisplay latex={`${sym} = ${val}`} />
                    </span>
                  ))}
                </div>
              </LuminaPanel>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const EquationWorkspace = withWorkspaceController<EquationWorkspaceProps, ProgressOptions<EquationWorkspaceChallenge>, Progress>(
  'equation-workspace', EquationWorkspaceSurface, useScriptedProgress, useWorkspaceProgressFor('equation-workspace'));

export default EquationWorkspace;
