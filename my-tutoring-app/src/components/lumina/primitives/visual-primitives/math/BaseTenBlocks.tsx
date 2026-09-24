'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaPanel,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { BaseTenBlocksMetrics } from '../../../evaluation/types';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describePlainCheck, plainWorkspaceAssignment, plainWorkspaceScene } from './baseTenWorkspace';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import CalculatorInput from '../../input-primitives/CalculatorInput';
import { SoundManager } from '../../../utils/SoundManager';
import BaseTenBlocksDi from './BaseTenBlocksDi';
import { usesBaseTenDi } from './baseTenScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface BaseTenBlocksChallenge {
  type: 'build_number' | 'read_blocks' | 'regroup' | 'add_with_blocks' | 'subtract_with_blocks';
  instruction: string;
  targetNumber: number;
  secondNumber?: number; // For operations
  hint: string;
  // Support-tier scaffolds (set by the generator from config.difficulty).
  // Perception/self-check aids withdrawn at higher tiers; never change the answer.
  // read_blocks ignores these — its readouts are contractually off (BT-2).
  showColumnCounts?: boolean; // digit readout above each place column
  showBlocksTotal?: boolean;  // live "Blocks Total" self-check panel
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface BaseTenBlocksData {
  learningAdaptation?: LearningAdaptation<'contrast_block_count_and_worth'>;
  title: string;
  description: string;
  numberValue: number;
  interactionMode?: 'build' | 'decompose' | 'regroup' | 'operate';
  decimalMode?: boolean;
  maxPlace?: 'ones' | 'tens' | 'hundreds' | 'thousands';
  supplyTray?: boolean;
  challenges?: BaseTenBlocksChallenge[];
  gradeBand?: 'K-1' | '2-3' | '4-5';
  supportTier?: 'easy' | 'medium' | 'hard'; // within-mode scaffolding level (mirrors per-challenge scaffolds for the tutor)

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BaseTenBlocksMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type PlaceValue = 'thousands' | 'hundreds' | 'tens' | 'ones' | 'tenths' | 'hundredths';

const PLACE_CONFIG: Record<PlaceValue, { label: string; value: number; color: string; borderColor: string; bgColor: string }> = {
  thousands: { label: 'Thousands', value: 1000, color: 'text-amber-300', borderColor: 'border-amber-400', bgColor: 'bg-amber-500' },
  hundreds: { label: 'Hundreds', value: 100, color: 'text-blue-300', borderColor: 'border-blue-400', bgColor: 'bg-blue-500' },
  tens: { label: 'Tens', value: 10, color: 'text-purple-300', borderColor: 'border-purple-400', bgColor: 'bg-purple-500' },
  ones: { label: 'Ones', value: 1, color: 'text-emerald-300', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-500' },
  tenths: { label: 'Tenths', value: 0.1, color: 'text-cyan-300', borderColor: 'border-cyan-400', bgColor: 'bg-cyan-500' },
  hundredths: { label: 'Hundredths', value: 0.01, color: 'text-pink-300', borderColor: 'border-pink-400', bgColor: 'bg-pink-500' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_number:         { label: 'Build',    icon: '🧱', accentColor: 'purple' },
  read_blocks:          { label: 'Read',     icon: '👁', accentColor: 'cyan' },
  regroup:              { label: 'Regroup',  icon: '🔄', accentColor: 'amber' },
  add_with_blocks:      { label: 'Add',      icon: '➕', accentColor: 'emerald' },
  subtract_with_blocks: { label: 'Subtract', icon: '➖', accentColor: 'pink' },
};

function getActivePlaces(maxPlace: string, decimalMode: boolean): PlaceValue[] {
  const places: PlaceValue[] = [];
  if (maxPlace === 'thousands') places.push('thousands');
  places.push('hundreds', 'tens', 'ones');
  if (decimalMode) places.push('tenths', 'hundredths');
  return places;
}

function decomposeNumber(num: number, places: PlaceValue[]): Record<PlaceValue, number> {
  const result: Record<string, number> = {};
  let remaining = Math.abs(num);
  for (const place of places) {
    const pv = PLACE_CONFIG[place].value;
    result[place] = Math.floor(remaining / pv);
    remaining = Math.round((remaining - result[place] * pv) * 100) / 100;
  }
  return result as Record<PlaceValue, number>;
}

function computeTotal(columns: Record<PlaceValue, number>, places: PlaceValue[]): number {
  let total = 0;
  for (const place of places) {
    total += (columns[place] || 0) * PLACE_CONFIG[place].value;
  }
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------
// Answer channel (BT-4)
// ---------------------------------------------------------------------------
// The blocks ARE the answer whenever the target value is already stated on
// screen — typing it into a keypad is transcription, not place value:
//   build_number — the instruction names the target ("Build the number 12").
//   regroup      — trading conserves the value, so the number never changes.
// The keypad survives only where the student must produce a number the screen
// does NOT state: read_blocks (blocks are the stimulus, the value is unknown)
// and the operate modes (the sum/difference must be computed).
const BLOCK_JUDGED_TYPES = new Set(['build_number', 'regroup']);

type BuildVerdict = 'match' | 'nonstandard' | 'value-off';

/**
 * Judge a built number against the target's STANDARD form. `nonstandard` is the
 * pedagogically live case: 12 unit cubes total 12 but never show the ten, which
 * is the whole point of the manipulative — the student is sent to the trade
 * button rather than marked correct.
 */
function judgeBuild(
  columns: Record<PlaceValue, number>,
  target: number,
  places: PlaceValue[],
): BuildVerdict {
  const want = decomposeNumber(target, places);
  if (places.every(p => (columns[p] || 0) === (want[p] || 0))) return 'match';
  return Math.abs(computeTotal(columns, places) - target) < 0.01 ? 'nonstandard' : 'value-off';
}

/** "1 ten and 2 ones" — the occupied places of a decomposition, largest first. */
function describeDecomposition(columns: Record<PlaceValue, number>, places: PlaceValue[]): string {
  const parts = places
    .filter(p => (columns[p] || 0) > 0)
    .map(p => {
      const n = columns[p] || 0;
      const label = PLACE_CONFIG[p].label.toLowerCase();
      return `${n} ${n === 1 ? label.replace(/s$/, '') : label}`;
    });
  if (parts.length === 0) return 'no blocks';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Lowest place holding 10+ blocks — the trade the student still owes. */
function findTradeablePlace(
  columns: Record<PlaceValue, number>,
  places: PlaceValue[],
): PlaceValue | null {
  for (let i = places.length - 1; i > 0; i--) {
    if ((columns[places[i]] || 0) >= 10) return places[i];
  }
  return null;
}

// ============================================================================
// Component
// ============================================================================

interface BaseTenBlocksProps {
  data: BaseTenBlocksData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

type PlainChallenge = BaseTenBlocksChallenge & { id: string };

/** The teaching workspace is base-ten-blocks' only controller: the runtime owns progression. */
const useBaseTenProgress = useWorkspaceProgressFor('base-ten-blocks');

const BaseTenBlocksSurface = ({ data, className, runtimePlanItemId, runtimeEvalMode }: BaseTenBlocksProps) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  const learnerBlocked = () => workspaceClosed.current
    || (!!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status));
  const {
    title,
    description,
    numberValue,
    interactionMode = 'build',
    decimalMode = false,
    maxPlace = 'hundreds',
    supplyTray = true,
    challenges = [],
    gradeBand = '2-3',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const activePlaces = useMemo(() => getActivePlaces(maxPlace, decimalMode), [maxPlace, decimalMode]);

  // Stable challenges with IDs (BaseTenBlocksChallenge has no id field)
  const challengesWithIds = useMemo(
    () => challenges.map((ch, i) => ({ ...ch, id: `${ch.type}-${i}` })),
    [challenges],
  );

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  // BT-1/BT-3 fix: Initialize from first challenge type, not top-level interactionMode (SP-5)
  const initialColumns = useMemo(() => {
    const firstChallenge = challenges[0];
    if (firstChallenge) {
      const t = firstChallenge.type;
      if (t === 'read_blocks' || t === 'regroup') {
        return decomposeNumber(firstChallenge.targetNumber, activePlaces);
      }
      // build_number, add_with_blocks, subtract_with_blocks → start empty
      const empty: Record<string, number> = {};
      activePlaces.forEach(p => { empty[p] = 0; });
      return empty as Record<PlaceValue, number>;
    }
    // No challenges — fall back to top-level interactionMode
    if (interactionMode === 'decompose' || interactionMode === 'regroup') {
      return decomposeNumber(numberValue, activePlaces);
    }
    const empty: Record<string, number> = {};
    activePlaces.forEach(p => { empty[p] = 0; });
    return empty as Record<PlaceValue, number>;
  }, [challenges, numberValue, interactionMode, activePlaces]);

  const [columns, setColumns] = useState<Record<PlaceValue, number>>(initialColumns);
  const [regroupAnimating, setRegroupAnimating] = useState<PlaceValue | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [regroupCount, setRegroupCount] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `base-ten-blocks-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** The mat a challenge starts from: pre-placed for read/regroup, empty otherwise. */
  const startColumnsFor = (challenge: BaseTenBlocksChallenge | null | undefined): Record<PlaceValue, number> => {
    if (challenge && (challenge.type === 'read_blocks' || challenge.type === 'regroup')) {
      return decomposeNumber(challenge.targetNumber, activePlaces);
    }
    const empty: Record<string, number> = {};
    activePlaces.forEach(p => { empty[p] = 0; });
    return empty as Record<PlaceValue, number>;
  };

  // Challenge progress. The runtime moves the index.
  const progress = useBaseTenProgress<PlainChallenge>({
    challenges: challengesWithIds,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || challenges[0]?.type || interactionMode,
    workspace, assignment: plainWorkspaceAssignment,
    // A fresh challenge and Try again both start from the challenge's own mat.
    onItemOpened: (index) => {
      setColumns(startColumnsFor(challengesWithIds[index]));
      setRegroupCount(0); setFeedback(''); setFeedbackType(''); setTypedAnswer('');
    },
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
  } = progress;
  workspaceClosed.current = progress.canAttempt === false;
  // The workspace finishes without an evaluation provider, and a skipped item still ends the run.
  const showSummary = allChallengesComplete || !!progress.practiceSummary;

  const phaseResults = usePhaseResults({
    challenges: challengesWithIds,
    results: challengeResults,
    isComplete: showSummary,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challengesWithIds[currentChallengeIndex] || null;
  const currentTotal = useMemo(() => computeTotal(columns, activePlaces), [columns, activePlaces]);

  // Determine if blocks should be interactive (have +/- buttons)
  // read_blocks: blocks are pre-placed, student just reads them — no manipulation
  const blocksInteractive = currentChallenge
    ? currentChallenge.type !== 'read_blocks'
    : supplyTray;

  // BT-2: read_blocks ALWAYS hides digit counts and total — showing them leaks the answer.
  // For every other mode the support tier decides: the generator withdraws these
  // perception/self-check aids at higher tiers (counts off at medium, total off at hard).
  // Defaults (undefined) preserve the original "always shown" behavior for no-tier sessions.
  const isReadBlocks = currentChallenge?.type === 'read_blocks';
  const showColumnCounts = isReadBlocks ? false : (currentChallenge?.showColumnCounts ?? true);
  const showBlocksTotal = isReadBlocks ? false : (currentChallenge?.showBlocksTotal ?? true);

  // BT-4: which channel carries the answer for this challenge (see BLOCK_JUDGED_TYPES).
  const isBlockJudged = !!currentChallenge && BLOCK_JUDGED_TYPES.has(currentChallenge.type);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<BaseTenBlocksMetrics>({
    primitiveType: 'base-ten-blocks',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const addBlock = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    SoundManager.tick();
    setColumns(prev => ({ ...prev, [place]: (prev[place] || 0) + 1 }));
  }, [hasSubmittedEvaluation]);

  const removeBlock = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    SoundManager.tick();
    setColumns(prev => {
      if ((prev[place] || 0) <= 0) return prev;
      return { ...prev, [place]: prev[place] - 1 };
    });
  }, [hasSubmittedEvaluation]);

  // Regroup: merge 10 smaller units into 1 larger unit
  const regroupUp = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    const placeIdx = activePlaces.indexOf(place);
    if (placeIdx <= 0) return; // Can't regroup up from the largest place
    const higherPlace = activePlaces[placeIdx - 1];
    if ((columns[place] || 0) < 10) {
      setFeedback(`You need at least 10 ${PLACE_CONFIG[place].label.toLowerCase()} to regroup!`);
      setFeedbackType('error');
      return;
    }
    setRegroupAnimating(place);
    setTimeout(() => {
      SoundManager.snap();
      setColumns(prev => ({
        ...prev,
        [place]: prev[place] - 10,
        [higherPlace]: (prev[higherPlace] || 0) + 1,
      }));
      setRegroupAnimating(null);
      setRegroupCount(c => c + 1);
      setFeedback(`10 ${PLACE_CONFIG[place].label.toLowerCase()} = 1 ${PLACE_CONFIG[higherPlace].label.toLowerCase().slice(0, -1)}!`);
      setFeedbackType('success');
    }, 400);
  }, [hasSubmittedEvaluation, activePlaces, columns]);

  // Regroup: break 1 larger unit into 10 smaller units
  const regroupDown = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    const placeIdx = activePlaces.indexOf(place);
    if (placeIdx >= activePlaces.length - 1) return; // Can't break down the smallest
    const lowerPlace = activePlaces[placeIdx + 1];
    if ((columns[place] || 0) < 1) {
      setFeedback(`You need at least 1 ${PLACE_CONFIG[place].label.toLowerCase().slice(0, -1)} to break apart!`);
      setFeedbackType('error');
      return;
    }
    setRegroupAnimating(place);
    setTimeout(() => {
      SoundManager.snap();
      setColumns(prev => ({
        ...prev,
        [place]: prev[place] - 1,
        [lowerPlace]: (prev[lowerPlace] || 0) + 10,
      }));
      setRegroupAnimating(null);
      setRegroupCount(c => c + 1);
      setFeedback(`1 ${PLACE_CONFIG[place].label.toLowerCase().slice(0, -1)} = 10 ${PLACE_CONFIG[lowerPlace].label.toLowerCase()}!`);
      setFeedbackType('success');
    }, 400);
  }, [hasSubmittedEvaluation, activePlaces, columns]);

  const resetColumns = useCallback(() => {
    if (learnerBlocked()) return;
    // Reset to the CURRENT challenge's mat.
    setColumns(startColumnsFor(currentChallenge));
    setFeedback('');
    setFeedbackType('');
    setRegroupCount(0);
    setTypedAnswer('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  /** Shared success path for both answer channels. */
  /** The mat's own check is the workspace's checked gesture: the learner's work in words, never the key. */
  const commitCheck = (correct: boolean) => {
    if (!currentChallenge) return;
    progress.commitCheck?.(describePlainCheck(currentChallenge, { blocks: describeDecomposition(columns, activePlaces),
      typed: typedAnswer, trades: regroupCount }), correct);
  };

  const markCorrect = useCallback((message: string) => {
    if (!currentChallenge) return;
    commitCheck(true);
    SoundManager.playCorrect();
    setFeedback(message);
    setFeedbackType('success');
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      regroupsUsed: regroupCount,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, regroupCount, recordResult, progress, columns, typedAnswer]);

  const markWrong = useCallback((message: string) => {
    commitCheck(false);
    SoundManager.playIncorrect();
    setFeedback(message);
    setFeedbackType('error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, progress, columns, typedAnswer, regroupCount]);

  // ── Channel A: the blocks are the answer (build_number, regroup) ──
  const checkBlocks = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    const target = currentChallenge.targetNumber;
    incrementAttempts();

    // regroup: the value is conserved and already named, so the TRADE is the answer.
    if (currentChallenge.type === 'regroup') {
      const conserved = Math.abs(currentTotal - target) < 0.01;
      if (regroupCount > 0 && conserved) {
        markCorrect(`Nice trade! The blocks look different, but they still make ${target}.`);
      } else if (regroupCount === 0) {
        markWrong(`No trade yet — use a trade button under a column to swap blocks between places.`);
      } else {
        markWrong(`Trading never changes the value — you have too ${currentTotal > target ? 'many' : 'few'} blocks now. Try Reset.`);
      }
      return;
    }

    // build_number: the columns must match the target's STANDARD form.
    const verdict = judgeBuild(columns, target, activePlaces);
    if (verdict === 'match') {
      markCorrect(`Yes! ${target} is ${describeDecomposition(columns, activePlaces)}.`);
    } else if (verdict === 'nonstandard') {
      const tradeable = findTradeablePlace(columns, activePlaces);
      const nextPlace = tradeable ? activePlaces[activePlaces.indexOf(tradeable) - 1] : null;
      markWrong(
        tradeable && nextPlace
          ? `Those blocks make ${target}, but not with the fewest blocks — trade 10 ${PLACE_CONFIG[tradeable].label.toLowerCase()} for 1 ${PLACE_CONFIG[nextPlace].label.toLowerCase().slice(0, -1)}.`
          : `Those blocks make ${target}, but not with the fewest blocks. Try trading up to a bigger place.`,
      );
    } else {
      markWrong(
        showBlocksTotal
          ? `Your blocks make ${currentTotal}. You need ${target} — keep going.`
          : `Not ${target} yet — count each column again.`,
      );
    }
  }, [currentChallenge, columns, activePlaces, currentTotal, regroupCount, showBlocksTotal, incrementAttempts, markCorrect, markWrong]);

  // ── Channel B: the student types a number the screen does not state
  //    (read_blocks, add_with_blocks, subtract_with_blocks) ──
  const checkAnswer = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    const target = currentChallenge.targetNumber;
    const parsed = parseFloat(typedAnswer);
    if (isNaN(parsed)) return;
    incrementAttempts();

    if (Math.abs(parsed - target) < 0.01) {
      markCorrect(`Correct! ${parsed} is right!`);
    } else {
      // Never name the target here — unlike build_number, the answer is NOT on
      // screen for read_blocks/operate, so stating it hands over the next attempt.
      setTypedAnswer('');
      markWrong(`${parsed} isn't it — check each column and try again.`);
    }
  }, [currentChallenge, typedAnswer, incrementAttempts, markCorrect, markWrong]);

  // Auto-submit evaluation when all challenges complete
  useEffect(() => {
    // The live host has no evaluation provider; the workspace submits only under one.
    if (!allChallengesComplete || hasSubmittedEvaluation || !progress.recordsEvaluation) return;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / challengesWithIds.length) * 100);
    const totalRegroups = challengeResults.reduce((s, r) => s + ((r.regroupsUsed as number) || 0), 0);
    const metrics: BaseTenBlocksMetrics = {
      type: 'base-ten-blocks',
      evalMode: 'default',
      representationAccuracy: accuracy,
      regroupingCorrect: totalRegroups > 0,
      regroupCount: totalRegroups,
      placeValuesUsed: activePlaces,
      decimalModeUsed: decimalMode,
      challengesCompleted: correctCount,
      totalChallenges: challengesWithIds.length,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };
    submitEvaluation(correctCount === challengesWithIds.length, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, challengeResults, challengesWithIds, activePlaces, decimalMode, submitEvaluation, progress.recordsEvaluation]);
  const isCurrentComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id)
    : false;

  // ── Pip shared surface ───────────────────────────────────────────
  const { isAudioPlaying, activePrimitiveId } = useLuminaAIContext();
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: showSummary || hasSubmittedEvaluation ? null : currentChallenge?.id ?? (challengesWithIds.length === 0 ? 'explore' : null),
    label: 'The place value mat',
    solved: challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengesWithIds.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengesWithIds.length) * 100);
  }, [allChallengesComplete, challengesWithIds, challengeResults]);

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...plainWorkspaceScene(currentChallenge, { blocks: describeDecomposition(columns, activePlaces),
      typed: typedAnswer, trades: regroupCount }), demonstration: [], canDemonstrate: false, canPresent: false,
      readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
  });

  // -------------------------------------------------------------------------
  // Block Rendering Helpers
  // -------------------------------------------------------------------------
  const renderBlockVisual = (place: PlaceValue, count: number) => {
    const config = PLACE_CONFIG[place];
    const isAnimating = regroupAnimating === place;
    const maxShow = place === 'thousands' ? 3 : place === 'hundreds' ? 5 : place === 'tens' ? 12 : 15;
    const showCount = Math.min(count, maxShow);
    const overflow = count > maxShow;

    if (count === 0) {
      return <span className="text-slate-600 text-xs italic">empty</span>;
    }

    return (
      <div className={`flex flex-wrap gap-1 justify-center transition-all duration-300 ${isAnimating ? 'scale-90 opacity-50' : ''}`}>
        {Array.from({ length: showCount }).map((_, i) => (
          <div key={i} className={`${config.bgColor}/20 border ${config.borderColor}/40 rounded transition-all duration-200 hover:scale-110 ${
            place === 'thousands' ? 'w-10 h-10' :
            place === 'hundreds' ? 'w-8 h-8' :
            place === 'tens' ? 'w-2.5 h-8' :
            place === 'ones' ? 'w-3 h-3' :
            place === 'tenths' ? 'w-2 h-2' :
            'w-1.5 h-1.5'
          }`}>
            {place === 'hundreds' && (
              <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-px p-px">
                {Array.from({ length: 25 }).map((_, j) => (
                  <div key={j} className={`${config.bgColor}/30`} />
                ))}
              </div>
            )}
            {place === 'thousands' && (
              <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-px p-0.5">
                {Array.from({ length: 25 }).map((_, j) => (
                  <div key={j} className={`${config.bgColor}/40`} />
                ))}
              </div>
            )}
          </div>
        ))}
        {overflow && (
          <span className={`text-xs ${config.color} font-mono`}>+{count - maxShow}</span>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {gradeBand}
            </LuminaBadge>
            <LuminaBadge accent="blue" className="text-xs">
              {interactionMode}
            </LuminaBadge>
            {decimalMode && (
              <LuminaBadge accent="cyan" className="text-xs">
                Decimal
              </LuminaBadge>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Challenge Progress */}
        {challengesWithIds.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs">
              Challenge {Math.min(currentChallengeIndex + 1, challengesWithIds.length)} of {challengesWithIds.length}
            </span>
            <div className="flex gap-1">
              {challengesWithIds.map((ch, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${
                  challengeResults.some(r => r.challengeId === ch.id) ? 'bg-emerald-400' :
                  i === currentChallengeIndex ? 'bg-blue-400 animate-pulse' :
                  'bg-slate-700'
                }`} />
              ))}
            </div>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !showSummary && (
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </LuminaPanel>
        )}

        {/* Pip's dock sits above the place value mat, which it outlines as the
            workspace — never one column or one block. */}
        {pip.store && !showSummary && <div {...pip.dock} />}

        {/* Place Value Columns */}
        <div {...pip.workspace} data-base-ten-mat="click" className="grid gap-3" style={{ gridTemplateColumns: `repeat(${activePlaces.length}, 1fr)` }}>
          {activePlaces.map(place => {
            const config = PLACE_CONFIG[place];
            const count = columns[place] || 0;
            const placeIdx = activePlaces.indexOf(place);

            return (
              <div key={place} className="flex flex-col items-center gap-2 bg-slate-800/20 rounded-xl p-3 border border-white/5">
                {/* Column Header */}
                <div className="text-center">
                  <span className={`text-xs font-mono uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  {showColumnCounts && (
                    <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                  )}
                </div>

                {/* Block Visual */}
                <div className="min-h-[60px] flex items-center justify-center w-full">
                  {renderBlockVisual(place, count)}
                </div>

                {/* Add/Remove Buttons — only when blocks are interactive */}
                {blocksInteractive && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={() => removeBlock(place)}
                      aria-label={`Take one from ${config.label}`}
                      disabled={count <= 0 || hasSubmittedEvaluation || workspaceClosed.current}
                    >
                      -
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={() => addBlock(place)}
                      aria-label={`Add one to ${config.label}`}
                      disabled={hasSubmittedEvaluation || workspaceClosed.current}
                    >
                      +
                    </Button>
                  </div>
                )}

                {/* Regroup Buttons — only when blocks are interactive */}
                {blocksInteractive && (
                  <div className="flex flex-col gap-1 w-full">
                    {placeIdx > 0 && count >= 10 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 text-[10px] ${config.bgColor}/10 border ${config.borderColor}/30 hover:${config.bgColor}/20 ${config.color} w-full`}
                        onClick={() => regroupUp(place)}
                        disabled={hasSubmittedEvaluation || workspaceClosed.current}
                      >
                        10 &rarr; 1 {PLACE_CONFIG[activePlaces[placeIdx - 1]].label.slice(0, 4)}
                      </Button>
                    )}
                    {placeIdx < activePlaces.length - 1 && count >= 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 text-[10px] ${config.bgColor}/10 border ${config.borderColor}/30 hover:${config.bgColor}/20 ${config.color} w-full`}
                        onClick={() => regroupDown(place)}
                        disabled={hasSubmittedEvaluation || workspaceClosed.current}
                      >
                        1 &rarr; 10 {PLACE_CONFIG[activePlaces[placeIdx + 1]].label.slice(0, 4)}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Running Total from blocks (self-check aid) — off for read_blocks (BT-2) and withdrawn at the hard tier */}
        {showBlocksTotal && (
          <LuminaPanel className="flex items-center justify-center gap-4 p-3">
            <span className="text-slate-400 text-sm">Blocks Total:</span>
            <span className="text-white font-bold text-2xl font-mono">{currentTotal}</span>
          </LuminaPanel>
        )}

        {/* Answer submission — BT-4: the channel follows the challenge type.
            build_number / regroup are judged from the blocks (the target value is
            already on screen, so a keypad would just be transcription); only
            read_blocks and the operate modes ask for a typed number. */}
        {challengesWithIds.length > 0 && !showSummary && (
          isBlockJudged ? (
            <div className="flex justify-center">
              <LuminaActionButton
                action="check"
                onClick={checkBlocks}
                disabled={hasSubmittedEvaluation || isCurrentComplete || workspaceClosed.current}
              >
                {currentChallenge?.type === 'regroup' ? 'Check My Trade' : 'Check My Blocks'}
              </LuminaActionButton>
            </div>
          ) : (
            <CalculatorInput
              label="Your Answer"
              value={typedAnswer}
              onChange={setTypedAnswer}
              onSubmit={!isCurrentComplete ? checkAnswer : undefined}
              allowDecimal={decimalMode}
              allowNegative={false}
              disabled={hasSubmittedEvaluation || isCurrentComplete || workspaceClosed.current}
              showSubmitButton={!isCurrentComplete}
            />
          )
        )}

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

        {/* Reset Button */}
        <div className="flex justify-center">
          <LuminaButton
            tone="subtle"
            onClick={resetColumns}
            disabled={hasSubmittedEvaluation || workspaceClosed.current}
          >
            Reset
          </LuminaButton>
        </div>

        {/* Phase Summary Panel (replaces manual "All challenges complete!" text) */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challengesWithIds.length} challenges!`}
            className="mt-4"
          />
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {/* No-challenge mode: display info */}
        {challengesWithIds.length === 0 && (
          <p className="text-slate-500 text-xs text-center">
            Add and remove blocks to explore place value. Use regroup buttons to trade between places.
          </p>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/**
 * `read_blocks` and `regroup` run on the spoken mat (BaseTenBlocksDi); `build_number`, the operate
 * modes and any mixed payload run on the click mat above. Each surface is workspace-only: an unbound
 * mount shows the "needs the tutor" card, never a scripted fallback. The router stays a pure function
 * of the payload, so a mount never switches surface.
 */
const BaseTenBlocks = withWorkspaceOnly<BaseTenBlocksProps>('base-ten-blocks', BaseTenBlocksSurface,
  props => props.data.title);

const BaseTenBlocksRouter: React.FC<BaseTenBlocksProps> = (props) =>
  usesBaseTenDi(props.data.challenges) ? <BaseTenBlocksDi {...props} /> : <BaseTenBlocks {...props} />;

export default BaseTenBlocksRouter;
