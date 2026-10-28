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
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  blocksModelled, columnSettled, describeRegroupWork, operandsOf, regroupMiss, regroupingMatches, resultOf, startBlocks, typedValue,
  workspaceScene, type RegroupView,
} from './regroupingWorkbenchWorkspace';
import {
  COLUMN_COLORS_LEVER, OPERATION_MODEL_LEVER, REGROUP_LEVERS, REGROUP_MARKS_LEVER, TRADE_MODEL_LEVER,
} from './regroupingWorkbenchLevers';
import { regroupingWorkbenchBoss } from './regroupingWorkbench.boss';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** Item-space calibration stamp (add-sub-100 / add-sub-1000): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
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
  /** Support tier ('easy' | 'medium' | 'hard'), the session's; each challenge carries its own. */
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
const BLOCK_SHAPE = ['w-2.5 h-2.5 bg-blue-400/60', 'w-2.5 h-6 bg-orange-400/60', 'w-6 h-6 bg-emerald-400/60', 'w-6 h-6 bg-purple-400/60'];

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

const useRegroupProgress = useWorkspaceProgressFor('regrouping-workbench');
const PRACTICE_NOTE = 'An easier practice problem is on screen in place of the item. It is not graded; the full item comes back after it.';

// ============================================================================
// Component
// ============================================================================

const RegroupingWorkbenchSurface = ({ data, className, runtimePlanItemId }: RegroupingWorkbenchProps) => {
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
  // Challenge progress: the teaching workspace owns it.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls it only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const progress = useRegroupProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: regroupingWorkbenchBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
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

  // Levers (`REGROUP_LEVERS`), keyed by the session item they were pulled on, and the easier problem a simplify lever
  // put on screen in its place. The tier's regroup marks and place labels are starting positions.
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

  // Block counts per place value [ones, tens, hundreds, thousands]. They start as the top number's blocks, with the
  // bottom number's beside them (`pending`); they change only by the learner's own work: Put together / Take away per
  // column, and Carry / Borrow trades. `removed` is what Take away crossed out, drawn faded.
  const [blocks, setBlocks] = useState<number[]>(() => startBlocks(operand1, operand2, places).blocks);
  const [pending, setPending] = useState<number[]>(() => startBlocks(operand1, operand2, places).pending);
  const [removed, setRemoved] = useState<number[]>(() => new Array(places).fill(0));

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
    const start = startBlocks(a, b, places);
    setBlocks(start.blocks);
    setPending(start.pending);
    setRemoved(new Array(places).fill(0));
    setCarries(new Array(places).fill(0));
    setRegroupedPlaces(new Set());
    setAnswerDigits(new Array(places).fill(null));
    setFeedback('');
    setFeedbackType('');
    setChallengeStartTime(Date.now());
  };
  // A fresh challenge opens blank. Try again clears the checked digits and keeps the trades: the typed number is what
  // was checked, and the blocks are the learner's own tool. Try again on a practice problem keeps it; only a fresh item
  // (or the return from practice) ends it.
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
  // Submit the evaluation when all challenges complete (under a lesson's evaluation provider only)
  // -------------------------------------------------------------------------
  /** Once per session: the evaluation hook's own flag lands a render later. */
  const submittedRef = useRef(false);
  const submitAll = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const modelledCorrect = challengeResults.filter(r => r.correct && r.blocksModelled === true).length;
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
      modelledCorrect,
    };

    submitEvaluation(totalCorrect === challenges.length, score, metrics, { challengeResults });
  }, [
    challenges, challengeResults, algorithmConnectionMade, incorrectRegroupAttempts, stepByStepUsed,
    wordProblemContext, submitEvaluation,
  ]);

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
      } else if (blocks[placeIndex] < 10) {
        setIncorrectRegroupAttempts(c => c + 1);
        SoundManager.invalid();
        setFeedback(`You only have ${blocks[placeIndex]} ${PLACE_LABELS[placeIndex].toLowerCase()}. You need 10 to regroup!`);
        setFeedbackType('error');
      }
    } else {
      // Borrow: if this column holds fewer blocks than are still to be taken away, break one of the next place
      if (blocks[placeIndex] < pending[placeIndex] && placeIndex < places - 1 && blocks[placeIndex + 1] > 0) {
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
      } else if (blocks[placeIndex] < pending[placeIndex]) {
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
  }, [operation, blocks, pending, places, hasSubmittedEvaluation]);

  /** Put together (addition) or Take away (subtraction) the bottom number's blocks in one column. */
  const handleColumnWork = useCallback((placeIndex: number) => {
    if (hasSubmittedEvaluation || workspaceClosed.current || pending[placeIndex] === 0) return;
    const place = PLACE_LABELS[placeIndex].toLowerCase();
    const n = pending[placeIndex];
    if (operation === 'subtraction' && blocks[placeIndex] < n) {
      SoundManager.invalid();
      setFeedback(`You can't take ${n} ${place} from ${blocks[placeIndex]} ${place}.`);
      setFeedbackType('error');
      return;
    }
    setBlocks(prev => {
      const next = [...prev];
      next[placeIndex] += operation === 'addition' ? n : -n;
      return next;
    });
    if (operation === 'subtraction') setRemoved(prev => { const next = [...prev]; next[placeIndex] = n; return next; });
    setPending(prev => { const next = [...prev]; next[placeIndex] = 0; return next; });
    SoundManager.snap();
    setFeedback(operation === 'addition' ? `Put the ${place} together.` : `Took away ${n} ${n === 1 ? place.replace(/s$/, '') : place}.`);
    setFeedbackType('info');
  }, [operation, blocks, pending, hasSubmittedEvaluation]);

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
    operation, a: operand1, b: operand2, places, digits: answerDigits, blocks, pending, trades: regroupedPlaces.size,
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
    // Recorded beside the verdict, never gating it: a typed answer the blocks did not reach is not modelled work.
    const modelled = blocksModelled(work);
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
      // The primitive's own fields; the commit below adds the verdict and the attempt count. A practice problem (a
      // simplify lever) is not the session's challenge and records nothing.
      if (!practice) recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        regroupingCorrect,
        regroupingTotal: expectedRegroups,
        blocksModelled: modelled,
        timeMs,
      });
    } else {
      SoundManager.playIncorrect();
      // Never the right number: the learner looks at the columns again.
      setFeedback(`Your answer is ${studentAnswer}. Not quite. Check each column again.`);
      setFeedbackType('error');
      setCurrentPhase('solve');
    }
    progress.commitCheck(describeRegroupWork(work), correct, correct ? undefined : regroupMiss(work));
  };

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
    // Addition counts the blocks still beside the column: a column that will make ten or more once put together needs
    // a trade (the mark can show before the learner joins them).
    if (operation === 'addition') {
      return blocks[placeIndex] + pending[placeIndex] >= 10;
    } else {
      return blocks[placeIndex] < pending[placeIndex];
    }
  }, [operation, blocks, pending]);

  // What the tutor and the observer are shown, republished every render. No demonstration, no presentation; every
  // mode declares levers (`REGROUP_LEVERS`).
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view());
    const ctx = { operation, fallback, marksShown: showRegroupHints,
      tradeNeeded: blocks.some((_, i) => i < places - 1 && needsRegroup(i)) };
    const levers = practice ? [] : REGROUP_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : REGROUP_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : REGROUP_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = REGROUP_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetBoard(easier);
          return { practice: regroupingWorkbenchBoss.assignment!(easier) };
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
        <div className="flex items-center justify-center gap-2">
          {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
          <span className="text-2xl font-bold text-slate-100 font-mono">
            {operand1} {operation === 'addition' ? '+' : '−'} {operand2} = ?
          </span>
        </div>

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the blocks and the written
            problem as one region. */}
        {!allChallengesComplete && <PipDock />}
        <PipWorkspace className="space-y-4">
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
                  <div className={`bg-slate-800/40 rounded-lg p-2 border min-h-[80px] flex flex-col items-center justify-center ${
                    // Red "regroup needed" cue is a HINT MARK — withdrawn at hard.
                    marksOn && needsRegroup(placeIdx) ? 'border-red-400/60' : 'border-white/10'
                  }`}>
                    {/* Visual blocks: the column's own, then (subtraction) the ones taken away, faded */}
                    <div data-testid={`blocks-${placeIdx}`} className="flex flex-wrap gap-0.5 justify-center mb-1 max-w-[70px]">
                      {Array.from({ length: Math.min(blocks[placeIdx], 20) }, (_, j) => (
                        <div key={j} className={`rounded-sm ${BLOCK_SHAPE[placeIdx]}`} />
                      ))}
                      {Array.from({ length: removed[placeIdx] }, (_, j) => (
                        <div key={`x${j}`} aria-hidden className={`rounded-sm opacity-25 ${BLOCK_SHAPE[placeIdx]}`} />
                      ))}
                    </div>
                    {/* The count is shown while the column still has work; a settled column's count would be the
                        answer's digit, so the learner counts the blocks there (easy's badge is the tier's aid). */}
                    {!columnSettled(operation, blocks, pending, placeIdx, places) && (
                      <span className={`text-lg font-bold font-mono ${
                        marksOn && needsRegroup(placeIdx) ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {blocks[placeIdx]}
                      </span>
                    )}
                    {/* Addition: the bottom number's blocks wait beside the column until put together */}
                    {operation === 'addition' && pending[placeIdx] > 0 && (
                      <div className="mt-1 pt-1 border-t border-dashed border-white/20 w-full flex flex-col items-center">
                        <div className="flex flex-wrap gap-0.5 justify-center max-w-[70px]">
                          {Array.from({ length: pending[placeIdx] }, (_, j) => (
                            <div key={j} className={`rounded-sm opacity-60 ${BLOCK_SHAPE[placeIdx]}`} />
                          ))}
                        </div>
                        <span className="text-xs font-mono text-slate-400">{pending[placeIdx]}</span>
                      </div>
                    )}
                    {/* Column-count badge: raw stacked count per column (easy tier only).
                        Never the final answer digit — just how many blocks are here. */}
                    {showColumnBadges && (
                      <span className="mt-0.5 text-[9px] px-1.5 rounded-full bg-white/5 border border-white/15 text-slate-400">
                        {blocks[placeIdx]} {PLACE_LABELS[placeIdx].toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* The column's own work: join the bottom number's blocks, or take them away. */}
                  {!isCurrentChallengeComplete && !allChallengesComplete && pending[placeIdx] > 0 && (
                    <button
                      type="button"
                      aria-label={operation === 'addition'
                        ? `Put together the ${PLACE_LABELS[placeIdx].toLowerCase()}`
                        : `Take away the ${PLACE_LABELS[placeIdx].toLowerCase()}`}
                      disabled={blocked}
                      className="mt-1 block mx-auto text-[10px] px-2 py-0.5 h-auto rounded-md bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-300 transition-colors disabled:opacity-50"
                      onClick={() => handleColumnWork(placeIdx)}
                    >
                      {operation === 'addition' ? 'Put together' : `Take away ${pending[placeIdx]}`}
                    </button>
                  )}

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
        </PipWorkspace>

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

        {/* Check; the runtime retries and advances. */}
        {challenges.length > 0 && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            <LuminaActionButton
              action="check"
              onClick={handleCheckAnswer}
              disabled={hasSubmittedEvaluation || blocked || answerDigits.every(d => d === null)}
            />
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
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

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const RegroupingWorkbench = withWorkspaceOnly<RegroupingWorkbenchProps>('regrouping-workbench', RegroupingWorkbenchSurface,
  props => props.data.title);

export default RegroupingWorkbench;
