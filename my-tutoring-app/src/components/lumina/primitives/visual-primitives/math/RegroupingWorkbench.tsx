'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RegroupingWorkbenchMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  describeRegroupWork, operandsOf, regroupMiss, regroupingMatches, resultOf, startBlocks, typedValue,
  workspaceAssignment, workspaceScene, type RegroupView,
} from './regroupingWorkbenchWorkspace';
import {
  COLUMN_COLORS_LEVER, OPERATION_MODEL_LEVER, REGROUP_MARKS_LEVER, TRADE_MODEL_LEVER,
  leverFacts, regroupLevers, smallerProblem,
} from './regroupingWorkbenchLevers';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface RegroupingStep {
  place: 'ones' | 'tens' | 'hundreds';
  type: 'carry' | 'borrow';
  fromValue: number;
  toValue: number;
  narration: string;
}

export interface RegroupingChallenge {
  id: string;
  /** The generator's challenge type (one per eval mode). The component grades on the session `operation`. */
  type?: string;
  problem: string;
  requiresRegrouping: boolean;
  regroupCount: number;
  hint: string;
  narration: string;
  /** Per-challenge support tier (scaffolding level), stamped by the generator. */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface RegroupingWorkbenchData {
  title: string;
  description?: string;
  operation: 'addition' | 'subtraction';
  operand1: number;
  operand2: number;
  maxPlace: 'tens' | 'hundreds' | 'thousands';
  decimalMode?: boolean;
  initialState?: {
    blocksPlaced?: boolean;
    algorithmVisible?: boolean;
  };
  regroupingSteps?: RegroupingStep[];
  challenges: RegroupingChallenge[];
  showOptions?: {
    showAlgorithm?: boolean;
    showCarryBorrow?: boolean;
    showPlaceColumns?: boolean;
    animateRegrouping?: boolean;
    stepByStepMode?: boolean;
    /** Per-column "regroup needed here" hint marks (red overflow highlight + the
     *  carry-box outline above an overflowing column). Withdrawn at the hard tier. */
    showRegroupHints?: boolean;
    /** Column-count badges showing how many blocks are stacked in each column
     *  (the raw stacked count — never the final regrouped answer digit). */
    showColumnBadges?: boolean;
  };
  wordProblemContext?: {
    enabled?: boolean;
    story?: string;
    imagePrompt?: string;
  };
  gradeBand?: '1-2' | '3-4';
  /** Support tier ('easy' | 'medium' | 'hard') — calibrates the tutor's reveal level. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RegroupingWorkbenchMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'explore' | 'regroup' | 'solve' | 'connect';

const UI_PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  explore: { label: 'Explore', description: 'Combine blocks and discover' },
  regroup: { label: 'Regroup', description: 'Trade 10 ones for a ten' },
  solve: { label: 'Solve', description: 'Work through the algorithm' },
  connect: { label: 'Connect', description: 'Link blocks to algorithm' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  regroup:  { label: 'Regrouping', icon: '🔄', accentColor: 'orange' },
  standard: { label: 'Standard',   icon: '🧮', accentColor: 'blue' },
};

const PLACE_LABELS = ['Ones', 'Tens', 'Hundreds', 'Thousands'];
/** Each place's block colour, carried onto its written column by the column_colors lever. */
const PLACE_TEXT = ['text-blue-300', 'text-orange-300', 'text-emerald-300', 'text-purple-300'];
const PLACE_BORDER = ['border-blue-400/70', 'border-orange-400/70', 'border-emerald-400/70', 'border-purple-400/70'];

// Lever pictures (`regroupingWorkbenchLevers.ts`). Each is drawn only while its lever is pulled; none uses a digit or
// the item's numbers.
function TradeModel({ addition }: { addition: boolean }) {
  const cubes = (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="w-2.5 h-2.5 rounded-sm bg-blue-400/70" />)}
    </div>
  );
  const rod = <div className="w-2.5 h-[48px] rounded-sm bg-orange-400/70" />;
  return (
    <div data-lever="trade-model" className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-4 justify-center">
      <div aria-hidden className="flex items-center gap-3">
        {addition ? cubes : rod}
        <span className="text-slate-400 text-lg">→</span>
        {addition ? rod : cubes}
      </div>
      <p className="text-slate-300 text-sm">{addition ? 'ten ones make one ten' : 'one ten makes ten ones, and the tens have one less'}</p>
    </div>
  );
}

function OperationModel({ addition }: { addition: boolean }) {
  const dot = (key: string, crossed = false) => (
    <span key={key} className={`relative inline-block w-3 h-3 rounded-full bg-cyan-300/70 ${crossed ? 'opacity-50' : ''}`}>
      {crossed && <span className="absolute inset-0 flex items-center justify-center text-red-400 text-xs leading-none">✕</span>}
    </span>
  );
  return (
    <div data-lever="operation-model" className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-4 justify-center">
      <div aria-hidden className="flex items-center gap-2">
        {addition ? (
          <>
            <span className="flex gap-1">{['a', 'b', 'c'].map(k => dot(k))}</span>
            <span className="text-slate-400">and</span>
            <span className="flex gap-1">{['d', 'e'].map(k => dot(k))}</span>
            <span className="text-slate-400 text-lg">→</span>
            <span className="flex gap-1 p-1 rounded-md border border-white/15">{['a', 'b', 'c', 'd', 'e'].map(k => dot(k))}</span>
          </>
        ) : (
          <span className="flex gap-1 p-1 rounded-md border border-white/15">
            {['a', 'b', 'c', 'd', 'e'].map((k, i) => dot(k, i >= 3))}
          </span>
        )}
      </div>
      <p className="text-slate-300 text-sm">{addition ? 'put together' : 'take away'}</p>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getPlaceCount(maxPlace: string): number {
  return maxPlace === 'thousands' ? 4 : maxPlace === 'hundreds' ? 3 : 2;
}

function getDigits(num: number, maxPlace: string, overridePlaces?: number): number[] {
  const digits: number[] = [];
  const places = overridePlaces ?? getPlaceCount(maxPlace);
  let n = Math.abs(Math.floor(num));
  for (let i = 0; i < places; i++) {
    digits.push(n % 10);
    n = Math.floor(n / 10);
  }
  return digits; // [ones, tens, hundreds, ...]
}

// ============================================================================
// Props
// ============================================================================

interface RegroupingWorkbenchProps {
  data: RegroupingWorkbenchData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const RegroupingWorkbenchSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  RegroupingWorkbenchProps & { tutorOwned: boolean; useController: (options: ProgressOptions<RegroupingChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    operation,
    operand1: initialOperand1,
    operand2: initialOperand2,
    maxPlace = 'tens',
    challenges = [],
    showOptions = {},
    wordProblemContext,
    gradeBand = '1-2',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showAlgorithm = true,
    showCarryBorrow = true,
    showPlaceColumns = true,
    stepByStepMode = false,
    // Default ON so any non-tier (no-difficulty) generation is byte-identical to
    // before — these only withdraw when the generator explicitly sets them false.
    showRegroupHints = true,
    showColumnBadges = false,
  } = showOptions;

  const fallback = useMemo(() => ({ operand1: initialOperand1, operand2: initialOperand2 }), [initialOperand1, initialOperand2]);

  // Compute places from maxPlace, but expand if any answer needs more digits
  // (e.g., 67+85=152 needs 3 digit slots even when maxPlace='tens')
  const basePlaces = getPlaceCount(maxPlace);
  const places = useMemo(() => {
    let maxDigits = basePlaces;
    for (const [a, b] of [[initialOperand1, initialOperand2], ...challenges.map(ch => operandsOf(ch, fallback))]) {
      const ans = Math.abs(resultOf(operation, a, b));
      const d = ans > 0 ? Math.floor(Math.log10(ans)) + 1 : 1;
      if (d > maxDigits) maxDigits = d;
    }
    return maxDigits;
  }, [basePlaces, operation, initialOperand1, initialOperand2, challenges, fallback]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `regrouping-workbench-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls it only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (ch) => workspaceAssignment(ch, operation, fallback),
    onItemOpened: (index, retry) => openItem.current(index, retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
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
    getChallengeType: (ch) => ch.requiresRegrouping ? 'regroup' : 'standard',
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const [currentPhase, setCurrentPhase] = useState<Phase>('explore');

  // Levers (`regroupingWorkbenchLevers.ts`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place. The tier's regroup marks and place labels are starting positions.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<RegroupingChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] || null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const marksOn = showRegroupHints || leverOn(REGROUP_MARKS_LEVER);
  const colorsOn = leverOn(COLUMN_COLORS_LEVER);
  const [operand1, operand2] = operandsOf(currentChallenge, fallback);
  const correctAnswer = resultOf(operation, operand1, operand2);

  // Block counts per place value [ones, tens, hundreds, thousands]. They start as the problem's own blocks (both
  // numbers together for addition, the top number for subtraction) and change only by the learner's trades.
  const [blocks, setBlocks] = useState<number[]>(() => startBlocks(operation, operand1, operand2, places));

  // Carry/borrow state per place
  const [carries, setCarries] = useState<number[]>(new Array(places).fill(0));

  // Student's answer digits [ones, tens, hundreds, ...]
  const [answerDigits, setAnswerDigits] = useState<(number | null)[]>(new Array(places).fill(null));

  // Which places have been regrouped
  const [regroupedPlaces, setRegroupedPlaces] = useState<Set<number>>(new Set());

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Tracking
  const [incorrectRegroupAttempts, setIncorrectRegroupAttempts] = useState(0);
  const [algorithmConnectionMade, setAlgorithmConnectionMade] = useState(false);
  const [stepByStepUsed] = useState(stepByStepMode);
  const [challengeStartTime, setChallengeStartTime] = useState(Date.now());

  /** A challenge's board, blank: its own blocks, no trades, no digits. */
  const resetBoard = (ch: RegroupingChallenge | null) => {
    const [a, b] = operandsOf(ch, fallback);
    setBlocks(startBlocks(operation, a, b, places));
    setCarries(new Array(places).fill(0));
    setRegroupedPlaces(new Set());
    setAnswerDigits(new Array(places).fill(null));
    setFeedback('');
    setFeedbackType('');
    setChallengeStartTime(Date.now());
  };
  // Workspace path. A fresh challenge opens blank. Try again clears the checked digits and keeps the trades: the
  // typed number is what was checked, and the blocks are the learner's own tool. Try again on a practice problem keeps
  // it; only a fresh item (or the return from practice) ends it.
  openItem.current = (index, retry) => {
    if (retry) {
      setAnswerDigits(new Array(places).fill(null));
      setFeedback('');
      setFeedbackType('');
      return;
    }
    setPractice(null);
    resetBoard(challenges[index] ?? null);
    setCurrentPhase('explore');
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<RegroupingWorkbenchMetrics>({
    primitiveType: 'regrouping-workbench',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (the scripted path; off on the workspace path, whose packet carries no answer)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    operation,
    operand1,
    operand2,
    correctAnswer,
    maxPlace,
    gradeBand,
    blocks: blocks.map((b, i) => `${PLACE_LABELS[i]}: ${b}`).join(', '),
    carries: carries.join(', '),
    currentPhase,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.problem ?? `${operand1} ${operation === 'addition' ? '+' : '−'} ${operand2}`,
    attemptNumber: currentAttempts + 1,
    requiresRegrouping: currentChallenge?.requiresRegrouping ?? false,
    wordProblem: wordProblemContext?.story ?? '',
    supportTier: currentChallenge?.supportTier ?? supportTier ?? '',
  }), [
    operation, operand1, operand2, correctAnswer, maxPlace, gradeBand,
    blocks, carries, currentPhase, challenges.length, currentChallengeIndex,
    currentChallenge, currentAttempts, wordProblemContext, supportTier,
  ]);

  // Tutor reveal level — keep the AI tutor in sync with what each tier hides.
  // hard: never name WHEN/HOW to regroup; ask what the student sees in each
  // column; never reveal the answer. easy: name the strategy and walk the setup.
  const tutorRevealClause = useMemo(() => {
    const tier = currentChallenge?.supportTier ?? supportTier;
    if (tier === 'hard') {
      return ' [TIER hard: the on-screen regroup hints and place-value labels are WITHDRAWN. '
        + 'Do NOT name which column to carry/borrow or when to regroup. Ask the student what they see in each column '
        + 'and let them decide. Never reveal the final answer.]';
    }
    if (tier === 'medium') {
      return ' [TIER medium: place labels are shown but regroup hints are off. Nudge the student to check each column '
        + 'themselves; only confirm once they notice an overflow. Do not pre-name the column to regroup.]';
    }
    if (tier === 'easy') {
      return ' [TIER easy: maximum scaffolding is on. You may name the strategy and walk through the setup column by column.]';
    }
    return '';
  }, [currentChallenge, supportTier]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'regrouping-workbench',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'Grade 1-2' : 'Grade 3-4',
    enabled: !tutorOwned,
  });
  // Its cues carry the answer, so on the workspace path they send nothing.
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const opWord = operation === 'addition' ? 'adding' : 'subtracting';
    sendText(
      `[ACTIVITY_START] This is a regrouping workbench for ${gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 3-4'}. `
      + `Operation: ${operation}. First problem: ${currentChallenge?.problem || `${operand1} ${operation === 'addition' ? '+' : '−'} ${operand2}`}. `
      + `${currentChallenge?.requiresRegrouping ? 'This problem requires regrouping!' : 'No regrouping needed.'} `
      + `${wordProblemContext?.story ? `Story context: "${wordProblemContext.story}". ` : ''}`
      + `Introduce warmly: "Today we're going to practice ${opWord} with blocks! Let's see what happens when we combine numbers." `
      + `Then read the first problem.`
      + tutorRevealClause,
      { silent: true }
    );
  }, [isConnected, challenges.length, operation, operand1, operand2, gradeBand, currentChallenge, wordProblemContext, sendText, tutorRevealClause]);

  // -------------------------------------------------------------------------
  // Submit the evaluation when all challenges complete
  // -------------------------------------------------------------------------
  /** Once per session: the evaluation hook's own flag lands a render later. */
  const submittedRef = useRef(false);
  const submitAll = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const totalRegroups = challengeResults.reduce((s, r) => s + ((r.regroupingTotal as number) ?? 0), 0);
    const correctRegroups = challengeResults.reduce((s, r) => s + ((r.regroupingCorrect as number) ?? 0), 0);
    const avgTime = challengeResults.length > 0
      ? challengeResults.reduce((s, r) => s + ((r.timeMs as number) ?? 0), 0) / challengeResults.length
      : 0;
    const score = challenges.length > 0
      ? Math.round((totalCorrect / challenges.length) * 100)
      : 0;

    const metrics: RegroupingWorkbenchMetrics = {
      type: 'regrouping-workbench',
      problemsCompleted: totalCorrect,
      problemsTotal: challenges.length,
      regroupingCorrect: correctRegroups,
      regroupingTotal: totalRegroups,
      algorithmConnectionMade,
      incorrectRegroupAttempts,
      stepByStepUsed,
      wordProblemContextEngaged: !!(wordProblemContext?.enabled && wordProblemContext.story),
      averageTimePerProblem: Math.round(avgTime),
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    submitEvaluation(totalCorrect === challenges.length, score, metrics, { challengeResults });

    const phaseScoreStr = phaseResults
      .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${score}%. `
      + `Student completed all ${challenges.length} regrouping problems! `
      + `Celebrate and give encouraging phase-specific feedback about ${operation} with regrouping.`,
      { silent: true },
    );
  }, [
    challenges, challengeResults, phaseResults, algorithmConnectionMade, incorrectRegroupAttempts, stepByStepUsed,
    wordProblemContext, submitEvaluation, sendText, operation,
  ]);

  // The "Next Problem" button is hidden when allChallengesComplete is true,
  // so advanceToNextChallenge is never called for the last challenge.
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    submitAll();
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges.length, progress.recordsEvaluation, submitAll]);

  // -------------------------------------------------------------------------
  // Regrouping Logic
  // -------------------------------------------------------------------------
  const handleRegroup = useCallback((placeIndex: number) => {
    if (hasSubmittedEvaluation || workspaceClosed.current) return;

    if (operation === 'addition') {
      // Carry: if blocks at this place >= 10, trade 10 for 1 at next place
      if (blocks[placeIndex] >= 10 && placeIndex < places - 1) {
        setBlocks(prev => {
          const next = [...prev];
          next[placeIndex] -= 10;
          next[placeIndex + 1] += 1;
          return next;
        });
        setCarries(prev => {
          const next = [...prev];
          next[placeIndex + 1] += 1;
          return next;
        });
        setRegroupedPlaces(prev => new Set(prev).add(placeIndex));
        setCurrentPhase('regroup');
        SoundManager.snap();
        setFeedback(`Traded 10 ${PLACE_LABELS[placeIndex].toLowerCase()} for 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()}!`);
        setFeedbackType('success');

        sendText(
          `[REGROUP_CARRY] Student traded 10 ${PLACE_LABELS[placeIndex].toLowerCase()} for 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()}. `
          + `This is carrying! The carry digit "${carries[placeIndex + 1] + 1}" appears above the ${PLACE_LABELS[placeIndex + 1].toLowerCase()} column. `
          + `Celebrate: "Great trade! 10 ones become 1 ten. See the 1 carry above?"`,
          { silent: true }
        );
      } else if (blocks[placeIndex] < 10) {
        setIncorrectRegroupAttempts(c => c + 1);
        SoundManager.invalid();
        setFeedback(`You only have ${blocks[placeIndex]} ${PLACE_LABELS[placeIndex].toLowerCase()}. You need 10 to regroup!`);
        setFeedbackType('error');
        sendText(
          `[REGROUP_NOT_NEEDED] Student tried to regroup ${PLACE_LABELS[placeIndex].toLowerCase()} but only has ${blocks[placeIndex]}. `
          + `Guide: "You only have ${blocks[placeIndex]} ${PLACE_LABELS[placeIndex].toLowerCase()}. You need at least 10 to trade for a ${PLACE_LABELS[placeIndex + 1].toLowerCase()}."`,
          { silent: true }
        );
      }
    } else {
      // Borrow: if blocks at this place < operand2's digit, borrow from next place
      const d2 = getDigits(operand2, maxPlace, places);
      if (blocks[placeIndex] < d2[placeIndex] && placeIndex < places - 1 && blocks[placeIndex + 1] > 0) {
        setBlocks(prev => {
          const next = [...prev];
          next[placeIndex + 1] -= 1;
          next[placeIndex] += 10;
          return next;
        });
        setCarries(prev => {
          const next = [...prev];
          next[placeIndex] = 1; // mark as borrowed
          return next;
        });
        setRegroupedPlaces(prev => new Set(prev).add(placeIndex));
        setCurrentPhase('regroup');
        SoundManager.snap();
        setFeedback(`Borrowed 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} = 10 ${PLACE_LABELS[placeIndex].toLowerCase()}!`);
        setFeedbackType('success');

        sendText(
          `[REGROUP_BORROW] Student borrowed 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} to get 10 more ${PLACE_LABELS[placeIndex].toLowerCase()}. `
          + `Now ${PLACE_LABELS[placeIndex].toLowerCase()} has ${blocks[placeIndex] + 10}. `
          + `Explain: "We traded 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} for 10 ${PLACE_LABELS[placeIndex].toLowerCase()} so we have enough to subtract."`,
          { silent: true }
        );
      } else if (blocks[placeIndex] < d2[placeIndex]) {
        // Nothing in the next column to break yet (a borrow across a zero starts one column further up).
        SoundManager.invalid();
        setFeedback(`There are no ${PLACE_LABELS[placeIndex + 1]?.toLowerCase() ?? 'blocks'} to break yet. Look at the next column first.`);
        setFeedbackType('error');
      } else {
        setIncorrectRegroupAttempts(c => c + 1);
        SoundManager.invalid();
        setFeedback(`You have enough ${PLACE_LABELS[placeIndex].toLowerCase()} already. No need to borrow!`);
        setFeedbackType('error');
      }
    }
  }, [operation, blocks, carries, places, maxPlace, operand2, hasSubmittedEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Answer Submission
  // -------------------------------------------------------------------------
  const handleDigitChange = useCallback((placeIndex: number, value: string) => {
    if (hasSubmittedEvaluation || workspaceClosed.current) return;
    const last = value.slice(-1);
    const num = last === '' ? null : /^\d$/.test(last) ? parseInt(last, 10) : undefined;
    if (num === undefined) return;
    setAnswerDigits(prev => {
      const next = [...prev];
      next[placeIndex] = num;
      return next;
    });
  }, [hasSubmittedEvaluation]);

  /** The learner's work, as the check and the tutor read it. */
  const view = (over: Partial<RegroupView> = {}): RegroupView => ({
    operation, a: operand1, b: operand2, places, digits: answerDigits, blocks, trades: regroupedPlaces.size,
    regroupMarks: marksOn, placeLabels: showPlaceColumns, carryRow: showCarryBorrow,
    columnBadges: showColumnBadges, algorithmShown: showAlgorithm,
    story: wordProblemContext?.enabled ? wordProblemContext.story : undefined,
    ...over,
  });

  const handleCheckAnswer = () => {
    if (!currentChallenge || learnerBlocked()) return;
    const work = view();
    const studentAnswer = typedValue(answerDigits);
    const correct = regroupingMatches(work);
    const timeMs = Date.now() - challengeStartTime;

    // Count correct regroups
    const expectedRegroups = currentChallenge.regroupCount || 0;
    const regroupingCorrect = Math.min(regroupedPlaces.size, expectedRegroups);

    if (correct) {
      SoundManager.playCorrect();
      setAlgorithmConnectionMade(true);
      setCurrentPhase('connect');
      setFeedback(`Correct! ${currentChallenge.problem} = ${correctAnswer}`);
      setFeedbackType('success');
      sendText(
        `[SOLVE_CORRECT] Student got ${currentChallenge.problem} = ${correctAnswer}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Regroups: ${regroupedPlaces.size}/${expectedRegroups}. Time: ${Math.round(timeMs / 1000)}s. `
        + `Celebrate and connect to the algorithm: "See how the blocks match the numbers? Each trade is a carry!"`,
        { silent: true }
      );
      // The primitive's own fields; the commit below adds the verdict and the attempt count on both paths. A practice
      // problem (a simplify lever) is not the session's challenge and records nothing.
      if (!practice) recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        regroupingCorrect,
        regroupingTotal: expectedRegroups,
        timeMs,
      });
    } else {
      SoundManager.playIncorrect();
      // Never the right number: the learner looks at the columns again.
      setFeedback(`Your answer is ${studentAnswer}. Not quite. Check each column again.`);
      setFeedbackType('error');
      setCurrentPhase('solve');
      sendText(
        `[SOLVE_INCORRECT] Student answered ${studentAnswer} but correct is ${correctAnswer}. `
        + `Problem: ${currentChallenge.problem}. Attempt ${currentAttempts + 1}. `
        + `${regroupedPlaces.size < expectedRegroups ? `Needs ${expectedRegroups - regroupedPlaces.size} more regroup(s). ` : ''}`
        + `Guide: "Let's check each column. Start with the ${PLACE_LABELS[0].toLowerCase()}: what do you get?"`
        + tutorRevealClause,
        { silent: true }
      );
    }
    progress.commitCheck(describeRegroupWork(work), correct, correct ? undefined : regroupMiss(work));
  };

  // -------------------------------------------------------------------------
  // Challenge Navigation (scripted path; the workspace path hides Next and the runtime advances)
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      if (!hasSubmittedEvaluation && progress.recordsEvaluation !== false) submitAll();
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    const nextIndex = currentChallengeIndex + 1;
    const nextChallenge = challenges[nextIndex];
    resetBoard(nextChallenge ?? null);
    setCurrentPhase('explore');

    sendText(
      `[PHASE_TRANSITION] Moving to problem ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.problem}". ${nextChallenge.requiresRegrouping ? 'Regrouping needed!' : 'No regrouping.'} `
      + `Read the problem and encourage them.`,
      { silent: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceProgress, challenges, sendText, hasSubmittedEvaluation, progress.recordsEvaluation, submitAll, currentChallengeIndex]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // Digits for display — use expanded `places` so answer row has enough slots
  const d1Display = getDigits(operand1, maxPlace, places);
  const d2Display = getDigits(operand2, maxPlace, places);
  const answerDisplay = getDigits(correctAnswer, maxPlace, places);

  // Does the current place need regrouping?
  const needsRegroup = useCallback((placeIndex: number): boolean => {
    if (operation === 'addition') {
      return blocks[placeIndex] >= 10;
    } else {
      const d2 = getDigits(operand2, maxPlace, places);
      return blocks[placeIndex] < d2[placeIndex];
    }
  }, [operation, blocks, operand2, maxPlace, places]);

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation; every mode declares levers (`regroupingWorkbenchLevers.ts`).
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view());
    const ctx = { operation, fallback, marksShown: showRegroupHints };
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, operation);
    const levers = practice ? [] : regroupLevers(sessionChallenge, pulledLevers, ctx);
    const tradeNeededNow = blocks.some((_, i) => i < places - 1 && needsRegroup(i));
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === REGROUP_MARKS_LEVER && !tradeNeededNow) {
          return 'No column needs a trade now: the learner has made the trades. Ask what each column shows.';
        }
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = smallerProblem(sessionChallenge, operation, fallback);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetBoard(easier);
          return { practice: workspaceAssignment(easier, operation, fallback) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetBoard(sessionChallenge); },
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
    label: 'The blocks and the written problem',
    solved: isCurrentChallengeComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const inputClosed = allChallengesComplete || blocked;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 3-4'}
            </LuminaBadge>
            <LuminaBadge accent="emerald" className="text-xs capitalize">
              {operation}
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(UI_PHASE_CONFIG).map(([phase, config]) => (
              <LuminaBadge
                key={phase}
                accent={currentPhase === phase ? 'orange' : undefined}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </LuminaBadge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Problem {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Word Problem Context */}
        {wordProblemContext?.enabled && wordProblemContext.story && (
          <LuminaPanel className="p-3">
            <p className="text-slate-300 text-sm italic">{wordProblemContext.story}</p>
          </LuminaPanel>
        )}

        {/* Problem Display */}
        {practice && (
          <p className="text-center text-cyan-300 text-xs">An easier one first.</p>
        )}
        <div className="text-center">
          <span className="text-2xl font-bold text-slate-100 font-mono">
            {operand1} {operation === 'addition' ? '+' : '−'} {operand2} = ?
          </span>
        </div>

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* Main Split View */}
        <div className={`grid ${showAlgorithm ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {/* Left: Base-Ten Blocks */}
          <LuminaPanel>
            <p className="text-slate-500 text-xs mb-3 text-center font-medium">Base-Ten Blocks</p>

            {showPlaceColumns && (
              <div className="flex justify-center gap-3 mb-2">
                {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                  <div key={placeIdx} className="text-center min-w-[70px]">
                    <p className="text-slate-500 text-[10px] mb-1">{PLACE_LABELS[placeIdx]}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Block visualization */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                <div key={placeIdx} className="text-center min-w-[70px]">
                  {/* Block count */}
                  <div className="bg-slate-800/40 rounded-lg p-2 border border-white/10 min-h-[80px] flex flex-col items-center justify-center">
                    {/* Visual blocks */}
                    <div className="flex flex-wrap gap-0.5 justify-center mb-1">
                      {Array.from({ length: Math.min(blocks[placeIdx], 15) }, (_, j) => (
                        <div
                          key={j}
                          className={`rounded-sm ${
                            placeIdx === 0 ? 'w-2.5 h-2.5 bg-blue-400/60' :
                            placeIdx === 1 ? 'w-2.5 h-6 bg-orange-400/60' :
                            placeIdx === 2 ? 'w-6 h-6 bg-emerald-400/60' :
                            'w-6 h-6 bg-purple-400/60'
                          }`}
                        />
                      ))}
                      {blocks[placeIdx] > 15 && (
                        <span className="text-slate-500 text-[9px]">+{blocks[placeIdx] - 15}</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold font-mono ${
                      // Red "regroup needed" overflow cue is a HINT MARK — withdrawn at hard.
                      marksOn && needsRegroup(placeIdx) ? 'text-red-400' : 'text-slate-200'
                    }`}>
                      {blocks[placeIdx]}
                    </span>
                    {/* Column-count badge: raw stacked count per column (easy tier only).
                        Never the final answer digit — just how many blocks are here. */}
                    {showColumnBadges && (
                      <span className="mt-0.5 text-[9px] px-1.5 rounded-full bg-white/5 border border-white/15 text-slate-400">
                        {blocks[placeIdx]} {PLACE_LABELS[placeIdx].toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Regroup button. When hint marks are shown (easy/medium) it only
                      appears on the column that actually needs regrouping (a cue).
                      At hard (showRegroupHints=false) it is available on EVERY
                      regroupable column — the student must decide WHEN to use it. */}
                  {!isCurrentChallengeComplete && !allChallengesComplete && placeIdx < places - 1
                    && (marksOn ? needsRegroup(placeIdx) : true) && (
                    <button
                      type="button"
                      aria-label={operation === 'addition'
                        ? `Carry from the ${PLACE_LABELS[placeIdx].toLowerCase()}`
                        : `Borrow for the ${PLACE_LABELS[placeIdx].toLowerCase()}`}
                      disabled={blocked}
                      className="mt-1 text-[10px] px-2 py-0.5 h-auto rounded-md bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300 transition-colors disabled:opacity-50"
                      onClick={() => handleRegroup(placeIdx)}
                    >
                      {operation === 'addition' ? '↑ Carry' : '↓ Borrow'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Block legend */}
            <div className="flex justify-center gap-3 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-400/60" /> Ones
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-4 rounded-sm bg-orange-400/60" /> Tens
              </span>
              {places >= 3 && (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-emerald-400/60" /> Hundreds
                </span>
              )}
            </div>
          </LuminaPanel>

          {/* Right: Written Algorithm */}
          {showAlgorithm && (
            <LuminaPanel>
              <p className="text-slate-500 text-xs mb-3 text-center font-medium">Written Algorithm</p>

              <div className="flex flex-col items-center gap-1 font-mono">
                {/* column_colors lever: the place names over the written columns */}
                {colorsOn && (
                  <div data-lever="column-names" className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                    <span className="w-6" />
                    {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                      <span key={`name-${placeIdx}`} className={`w-8 text-center text-[9px] font-sans ${PLACE_TEXT[placeIdx]}`}>
                        {PLACE_LABELS[placeIdx]}
                      </span>
                    ))}
                  </div>
                )}
                {/* Carry digits row */}
                {showCarryBorrow && operation === 'addition' && (
                  <div className="flex justify-end gap-0" style={{ width: `${places * 32 + 24}px` }}>
                    <span className="w-6" /> {/* space for operator */}
                    {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                      <span
                        key={`carry-${placeIdx}`}
                        className="w-8 text-center text-orange-400 text-xs"
                      >
                        {carries[placeIdx] > 0 ? carries[placeIdx] : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Operand 1 */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6" />
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <span key={`d1-${placeIdx}`} className={`w-8 text-center text-lg ${colorsOn ? PLACE_TEXT[placeIdx] : 'text-slate-200'}`}>
                      {d1Display[placeIdx]}
                    </span>
                  ))}
                </div>

                {/* Operator + Operand 2 */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6 text-slate-400 text-lg">
                    {operation === 'addition' ? '+' : '−'}
                  </span>
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <span key={`d2-${placeIdx}`} className={`w-8 text-center text-lg ${colorsOn ? PLACE_TEXT[placeIdx] : 'text-slate-200'}`}>
                      {d2Display[placeIdx]}
                    </span>
                  ))}
                </div>

                {/* Line */}
                <div
                  className="border-b-2 border-slate-400"
                  style={{ width: `${places * 32 + 24}px` }}
                />

                {/* Answer inputs */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6" />
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <div key={`ans-${placeIdx}`} className="w-8 flex justify-center">
                      {isCurrentChallengeComplete || allChallengesComplete ? (
                        <span className="text-emerald-400 text-lg font-bold">{answerDisplay[placeIdx]}</span>
                      ) : (
                        <LuminaInput
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          aria-label={`${PLACE_LABELS[placeIdx]} digit`}
                          value={answerDigits[placeIdx] !== null ? String(answerDigits[placeIdx]) : ''}
                          onChange={e => handleDigitChange(placeIdx, e.target.value)}
                          disabled={inputClosed}
                          className={`w-7 h-8 text-center text-lg font-bold ${colorsOn ? `border-2 ${PLACE_BORDER[placeIdx]}` : ''}`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Borrow indicators for subtraction */}
                {showCarryBorrow && operation === 'subtraction' && (
                  <div className="flex justify-end gap-0" style={{ width: `${places * 32 + 24}px` }}>
                    <span className="w-6" />
                    {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                      <span
                        key={`borrow-${placeIdx}`}
                        className="w-8 text-center text-purple-400 text-xs"
                      >
                        {carries[placeIdx] > 0 ? '↓' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </LuminaPanel>
          )}
        </div>

        {leverOn(TRADE_MODEL_LEVER) && <TradeModel addition={operation === 'addition'} />}
        {leverOn(OPERATION_MODEL_LEVER) && <OperationModel addition={operation === 'addition'} />}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation || blocked || answerDigits.every(d => d === null)}
              />
            )}
            {/* Scripted path only: on the workspace the runtime advances. */}
            {!tutorOwned && isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="next"
                onClick={advanceToNextChallenge}
              >
                Next Problem
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Hint (scripted path; on the workspace the tutor teaches) */}
        {!tutorOwned && currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} regrouping problems!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const RegroupingWorkbench = withWorkspaceController<RegroupingWorkbenchProps, ProgressOptions<RegroupingChallenge>, Progress>(
  'regrouping-workbench', RegroupingWorkbenchSurface, useScriptedProgress, useWorkspaceProgressFor('regrouping-workbench'));

export default RegroupingWorkbench;
