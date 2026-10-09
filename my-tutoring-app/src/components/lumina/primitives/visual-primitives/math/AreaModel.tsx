'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type AreaModelMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  areaCheckCorrect, areaMiss, describeAreaCheck, workspaceAssignmentFor, workspaceScene, type AreaCheck, type AreaView,
} from './areaModelWorkspace';
import {
  ALL_SIDES_LEVER, CELL_DOTS_LEVER, CELL_LABELS_LEVER, PRACTICE_NOTE, SHARED_PARTS_LEVER, SIDE_SUM_LEVER, STACK_LEVER,
  START_CELL_LEVER, TENS_SPLIT_LEVER, areaModelLevers, leverFacts, practiceItem, tensSplits,
} from './areaModelLevers';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaButton,
  LuminaInput,
  LuminaFeedbackCard,
} from '../../../ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SoundManager } from '../../../utils/SoundManager';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { areaModelDiagnosisEvidence, type AreaModelResponse } from './areaModelEvidence';

/**
 * Area Model — multi-challenge multiplication / area / perimeter / factoring.
 *
 * Session walks the student through 3-6 distinct factor pairs in the SAME eval
 * mode. Per PRD §6e (area-model post-mortem), per-challenge state must reset
 * on advance; the stale-state guard lives in submit handlers (§6a #8), not in
 * a completion effect.
 */

// ============================================================================
// Sizing helpers
// ============================================================================

// Log-scaled cell dimensions: proportional (300-part visibly wider than 8-part)
// but bounded so 3-digit factors don't overflow the max-w-6xl (~1152px) container.
// At part=1 → floor (100/80). At part=300 → ~258px wide / ~198px tall.
const cellWidthForPart = (part: number) =>
  Math.max(100, Math.log10(Math.max(1, part)) * 80 + 60);
const cellHeightForPart = (part: number) =>
  Math.max(80, Math.log10(Math.max(1, part)) * 60 + 50);

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type AreaModelChallengeType =
  | 'build_model'
  | 'find_area'
  | 'perimeter'
  | 'multiply'
  | 'factor';

export interface AreaModelChallenge {
  id: string;
  factor1Parts: number[];
  factor2Parts: number[];
  showPartialProducts: boolean;
  showDimensions: boolean;
  algebraicMode: boolean;
  highlightCell: [number, number] | null;
  /**
   * Support-tier levers (config.difficulty). Default true = max scaffolding.
   * - showCellEquations (forward modes): pre-label each cell with its two
   *   factors + name them in the input panel. Withdraw (hard) → student reads
   *   the row/column headers to identify the factors. Numbers are unchanged.
   * - showPerimeterExpansion (perimeter): write out L + W + L + W. Withdraw
   *   (hard) → recall Perimeter = 2 × (L + W).
   */
  showCellEquations?: boolean;
  showPerimeterExpansion?: boolean;
  labels?: {
    factor1?: string[];
    factor2?: string[];
  };
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface AreaModelData {
  /** Safe adaptation metadata; `source` is stamped only by the observation delivery server. */
  learningAdaptation?: LearningAdaptation<'contrast_same_fact_across_places' | 'contrast_equal_area_perimeters'>;
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: AreaModelChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: AreaModelChallengeType;
  gradeLevel?: string;
  /**
   * Within-mode support tier (config.difficulty). Surfaced to the live tutor so
   * its reveal level matches the on-screen scaffold — at 'hard' the tutor must
   * not supply the cell pre-labeling / side-sum the on-screen UI withheld.
   */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation integration (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AreaModelMetrics>) => void;
}

interface AreaModelProps {
  data: AreaModelData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

interface CellState {
  row: number;
  col: number;
  studentAnswer: string;
  isCorrect: boolean | null;
  attempts: number;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_model: { label: 'Build Model', icon: '🔨', accentColor: 'blue' },
  find_area:   { label: 'Find Area',   icon: '📐', accentColor: 'blue' },
  perimeter:   { label: 'Perimeter',   icon: '🔲', accentColor: 'emerald' },
  multiply:    { label: 'Multiply',    icon: '✖️', accentColor: 'purple' },
  factor:      { label: 'Factor',      icon: '🔍', accentColor: 'pink' },
};

/** `shared_parts` lever: one colour per column part and per row part, matching its cells. */
const COLUMN_COLOURS = ['#38bdf8', '#f472b6', '#a3e635', '#fb923c'];
const ROW_COLOURS = ['#facc15', '#c084fc', '#2dd4bf', '#f87171'];

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

/**
 * How much the live tutor may reveal, calibrated to the on-screen support tier
 * and the eval mode. Keeps the tutor (a second information channel) consistent
 * with the on-screen scaffold: at 'hard' the UI withholds the cell pre-labeling
 * (or the side-sum), so the tutor must not supply it either. The final numbers
 * (partial products, total, perimeter, or — in factor mode — the dimensions)
 * are the answer and are never stated at any tier.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  mode: AreaModelChallengeType,
): string {
  if (!tier) return '';
  const common =
    mode === 'perimeter'
      ? 'Never state the perimeter value or add the four sides for the student.'
      : mode === 'factor'
        ? 'Never state the dimension numbers — discovering the factors IS the task.'
        : 'Never state a partial product or the total product for the student.';
  const method =
    mode === 'perimeter'
      ? 'add all four sides, or use Perimeter = 2 × (length + width)'
      : mode === 'factor'
        ? 'each cell equals its column header × its row header, so one cell pins down a dimension'
        : 'multiply the column header by the row header for each cell, then add the partial products';
  switch (tier) {
    case 'easy':
      return `SUPPORT TIER easy: maximum scaffolding. You may name the method (${method}) and walk the setup step by step. ${common}`;
    case 'medium':
      return `SUPPORT TIER medium: the method is shown on screen; nudge the next step and let the student do the arithmetic. ${common}`;
    default:
      return `SUPPORT TIER hard: the on-screen scaffold is withdrawn (cells are NOT pre-labeled, or the side-sum is not written out). Do NOT supply that withheld step — ask the student to read the row and column headers (or the labeled sides) and map it themselves. ${common}`;
  }
}

// ============================================================================
// Component
// ============================================================================

const AreaModelSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  AreaModelProps & { tutorOwned: boolean; useController: (options: ProgressOptions<AreaModelChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    gradeLevel,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `area-model-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignmentFor(sessionChallengeType),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, results, isComplete, mergeResult, advance } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the memoized callbacks read the latest.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const sessionChallenge = challenges[currentIndex] ?? null;
  // In-item levers (`areaModelLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<AreaModelChallenge | null>(null);
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const factor1Parts = currentChallenge?.factor1Parts ?? [10, 2];
  const factor2Parts = currentChallenge?.factor2Parts ?? [10, 3];
  const showPartialProducts = currentChallenge?.showPartialProducts ?? true;
  const showDimensions = currentChallenge?.showDimensions ?? true;
  const algebraicMode = currentChallenge?.algebraicMode ?? false;
  const labels = currentChallenge?.labels;
  // Support-tier starting positions (default true = max scaffolding when unset); a runtime lever turns one on.
  const tierCellEquations = currentChallenge?.showCellEquations ?? true;
  const tierPerimeterExpansion = currentChallenge?.showPerimeterExpansion ?? true;
  const showCellEquations = tierCellEquations || leverOn(CELL_LABELS_LEVER);
  const showPerimeterExpansion = tierPerimeterExpansion || leverOn(SIDE_SUM_LEVER);
  const highlightCell: [number, number] | null = currentChallenge?.highlightCell ?? (leverOn(START_CELL_LEVER) ? [0, 0] : null);
  const showTensSplit = leverOn(TENS_SPLIT_LEVER);
  const showCellDots = leverOn(CELL_DOTS_LEVER);
  const showStack = leverOn(STACK_LEVER);
  const showAllSides = leverOn(ALL_SIDES_LEVER);
  const showSharedParts = leverOn(SHARED_PARTS_LEVER);

  const isFactorMode = sessionChallengeType === 'factor';
  const isPerimeterMode = sessionChallengeType === 'perimeter';

  // ── Derived values for current challenge ───────────────────────
  const factor1Total = useMemo(() => factor1Parts.reduce((s, v) => s + v, 0), [factor1Parts]);
  const factor2Total = useMemo(() => factor2Parts.reduce((s, v) => s + v, 0), [factor2Parts]);
  const totalProduct = factor1Total * factor2Total;
  const totalCells = factor1Parts.length * factor2Parts.length;
  const totalPerimeter = 2 * (factor1Total + factor2Total);

  const partialProducts = useMemo(() => {
    const products: number[][] = [];
    for (let row = 0; row < factor2Parts.length; row++) {
      products[row] = [];
      for (let col = 0; col < factor1Parts.length; col++) {
        products[row][col] = factor1Parts[col] * factor2Parts[row];
      }
    }
    return products;
  }, [factor1Parts, factor2Parts]);

  /** `tens_split` lever: each tens cell's parts split into a one-digit fact and its tens, leak-checked. */
  const splits = useMemo(() => (currentChallenge ? tensSplits(currentChallenge) : {}), [currentChallenge]);

  // ── Per-challenge interaction state (resets on advance) ────────
  // Forward mode (build_model / find_area / multiply)
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [sumInput, setSumInput] = useState('');
  const [sumAttempted, setSumAttempted] = useState(false);
  const [sumCorrect, setSumCorrect] = useState<boolean | null>(null);
  const [sumAttempts, setSumAttempts] = useState(0);

  // Factor mode
  const [factorTopInputs, setFactorTopInputs] = useState<string[]>([]);
  const [factorLeftInputs, setFactorLeftInputs] = useState<string[]>([]);
  const [factorChecked, setFactorChecked] = useState(false);
  const [factorTopCorrect, setFactorTopCorrect] = useState<(boolean | null)[]>([]);
  const [factorLeftCorrect, setFactorLeftCorrect] = useState<(boolean | null)[]>([]);
  const [factorAttempts, setFactorAttempts] = useState(0);

  // Perimeter mode
  const [perimeterInput, setPerimeterInput] = useState('');
  const [perimeterAttempts, setPerimeterAttempts] = useState(0);
  const [perimeterCorrect, setPerimeterCorrect] = useState<boolean | null>(null);

  // Shared per-challenge
  const [challengeHintCount, setChallengeHintCount] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);
  /** A wrong check still on screen, in the learner's terms (workspace scene), until Try again or the next check. */
  const [lastWrong, setLastWrong] = useState<string | null>(null);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);
  // Every checked entry, including tries later corrected. Evidence only; grading is unchanged.
  const responsesRef = useRef<AreaModelResponse[]>([]);
  const recordResponse = (entry: Omit<AreaModelResponse, 'challengeId' | 'factor1Parts' | 'factor2Parts' | 'hintsBefore'>) => {
    // An easier practice item is ungraded: it is not evidence about the session's items.
    if (!currentChallenge || practice) return;
    responsesRef.current.push({ challengeId: currentChallenge.id, factor1Parts: [...factor1Parts], factor2Parts: [...factor2Parts],
      hintsBefore: challengeHintCount, ...entry });
  };

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c: missing any slot leaks state from challenge N into challenge N+1.
  const resetWork = (challenge: AreaModelChallenge) => {
    setCellStates(new Map());
    setSelectedCell(null);
    setCurrentInput('');
    setSumInput('');
    setSumAttempted(false);
    setSumCorrect(null);
    setSumAttempts(0);
    setFactorTopInputs(challenge.factor1Parts.map(() => ''));
    setFactorLeftInputs(challenge.factor2Parts.map(() => ''));
    setFactorChecked(false);
    setFactorTopCorrect(challenge.factor1Parts.map(() => null));
    setFactorLeftCorrect(challenge.factor2Parts.map(() => null));
    setFactorAttempts(0);
    setPerimeterInput('');
    setPerimeterAttempts(0);
    setPerimeterCorrect(null);
    setChallengeHintCount(0);
    setChallengeDone(false);
    setLastWrong(null);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (currentChallenge) resetWork(currentChallenge);
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Workspace Try again: the wrong entry comes off the screen and the right work stays (right cells, right parts).
   * The attempt counters stay the item's.
   */
  const clearWrong = () => {
    setCellStates(prev => new Map(Array.from(prev).filter(([, s]) => s.isCorrect)));
    setSelectedCell(null);
    setCurrentInput('');
    setSumInput('');
    setSumAttempted(false);
    setSumCorrect(null);
    setPerimeterInput('');
    setPerimeterCorrect(null);
    setFactorTopInputs(prev => prev.map((v, i) => (factorTopCorrect[i] === true ? v : '')));
    setFactorLeftInputs(prev => prev.map((v, i) => (factorLeftCorrect[i] === true ? v : '')));
    setFactorChecked(false);
    setFactorTopCorrect(factor1Parts.map(() => null));
    setFactorLeftCorrect(factor2Parts.map(() => null));
    setLastWrong(null);
  };
  // A fresh item opens blank; Try again clears only the wrong entry.
  openItem.current = (index, retry) => {
    const opened = challenges[index];
    // Try again on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) clearWrong();
    else { setPractice(null); if (opened) resetWork(opened); }
  };

  // ── Evaluation hook ────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<AreaModelMetrics>({
    primitiveType: 'area-model',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── PhaseSummaryPanel: one row, aggregated by eval mode ────────
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => sessionChallengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length),
  });

  // ── AI tutoring ────────────────────────────────────────────────
  // aiPrimitiveData carries the current problem + tier so the tutor's reveal
  // level matches the on-screen scaffold. Mode is session-level (all challenges
  // share sessionChallengeType), so the reveal policy is resolved once.
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: sessionChallengeType,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    factor1Parts,
    factor2Parts,
    factor1Total,
    factor2Total,
    algebraicMode,
    supportTier: supportTier ?? null,
  }), [
    title, sessionChallengeType, currentIndex, challenges.length,
    factor1Parts, factor2Parts, factor1Total, factor2Total, algebraicMode, supportTier,
  ]);

  // The legacy context carries the factors and totals; on the workspace path the tutor reads the scene instead.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'area-model',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: isComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The area model',
    solved: challengeDone && results.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const revealPolicy = tutorRevealPolicy(supportTier, sessionChallengeType);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Area-model session: ${challenges.length} problems, mode "${sessionChallengeType}". `
      + `Introduce briefly: the area model breaks a multiplication (or a rectangle) into parts so each piece is easy, `
      + `then we combine the pieces. Then read the first task.`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true },
    );
  }, [isConnected, challenges.length, sessionChallengeType, revealPolicy, sendText]);

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: AreaModelChallenge | null): boolean => {
      if (!challenge) return false;
      // Match on the active challenge's factor totals against what derived
      // state thinks they are. If reset is still pending, these diverge.
      const expectedF1 = challenge.factor1Parts.reduce((s, v) => s + v, 0);
      const expectedF2 = challenge.factor2Parts.reduce((s, v) => s + v, 0);
      return expectedF1 === factor1Total && expectedF2 === factor2Total;
    },
    [factor1Total, factor2Total],
  );

  // ── Per-challenge completion (called from submit handlers) ─────
  const completeCurrentChallenge = useCallback(
    (
      correct: boolean,
      score: number,
      attempts: number,
      extras: Record<string, unknown> = {},
      response = '',
    ) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      setChallengeDone(true);
      // The checked gesture (counts the attempt, records the base result), then this primitive's own fields.
      commitCheck.current(response, correct);
      if (practice) return;
      mergeResult({
        challengeId: currentChallenge.id,
        correct,
        attempts,
        score,
        hintsUsed: challengeHintCount,
        ...extras,
      });
      sendText(
        `[CHALLENGE_CORRECT] Student finished problem ${currentIndex + 1} of ${challenges.length} `
        + `(${sessionChallengeType}) in ${attempts} attempt${attempts === 1 ? '' : 's'}. `
        + `Celebrate briefly and reinforce the area-model idea they just used.`,
        { silent: true },
      );
    },
    [
      currentChallenge, stateMatchesChallenge, mergeResult, challengeHintCount, practice,
      sendText, currentIndex, challenges.length, sessionChallengeType,
    ],
  );

  // ── Session complete → aggregate metrics + submitEvaluation ────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => Number(r.score ?? 0) === 100).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (!hasSubmittedEvaluation && !tutorOwned) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          pairs: challenges.map((c) => ({
            factor1: c.factor1Parts,
            factor2: c.factor2Parts,
          })),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
          responses: responsesRef.current.map(({ challengeId, step, cell, expected, entered, attempt }) =>
            ({ challengeId, step, cell, expected, entered, attempt })),
        },
        // Entries retry until correct and one wrong cell can still score 100, so the
        // first-response score inside the evidence is what lets the shared gate see errors.
      }, undefined, areaModelDiagnosisEvidence(challenges.map((c) => c.id), responsesRef.current, sessionChallengeType, supportTier));
    }

    sendText(
      `[ALL_COMPLETE] All ${challenges.length} ${sessionChallengeType} problems done. `
      + `Correct: ${correctCount}/${challenges.length}. First-try: ${firstTryCount}. Accuracy: ${overallAccuracy}%. `
      + `Give an encouraging, area-model-focused summary.`,
      { silent: true },
    );
  }, [
    isComplete, results, challenges, sessionChallengeType, supportTier,
    submitEvaluation, hasSubmittedEvaluation, sendText, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session (item scores count corrections).
  // The evidence is this primitive's own per-entry record, right cells included, with each wrong entry's named miss;
  // its first-response score is the session's, so an item worked with a lever pulled is not read as first try.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    const metrics: AreaModelMetrics = {
      type: 'area-model',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    const own = areaModelDiagnosisEvidence(challenges.map((c) => c.id), responsesRef.current, sessionChallengeType, supportTier);
    submitEvaluation(result.passed, result.accuracy, metrics, {
      studentWork: {
        challengeCount: challenges.length,
        challengeType: sessionChallengeType,
        pairs: challenges.map((c) => ({ factor1: c.factor1Parts, factor2: c.factor2Parts })),
        responses: responsesRef.current.map(({ challengeId, step, cell, expected, entered, attempt, miss }) =>
          ({ challengeId, step, cell, expected, entered, attempt, miss })),
      },
      challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance,
    }, undefined, own ? { ...own, firstResponseScore: result.diagnosisEvidence.firstResponseScore } : result.diagnosisEvidence);
  };

  // ── Helpers ────────────────────────────────────────────────────
  const getCellKey = (row: number, col: number): string => `${row},${col}`;

  const getCellState = (row: number, col: number): CellState | undefined =>
    cellStates.get(getCellKey(row, col));

  const allCellsComplete = (): boolean => {
    for (let row = 0; row < factor2Parts.length; row++) {
      for (let col = 0; col < factor1Parts.length; col++) {
        if (!getCellState(row, col)?.isCorrect) return false;
      }
    }
    return true;
  };

  // ── Forward-mode handlers (build_model / find_area / multiply) ──
  const handleCellClick = (row: number, col: number) => {
    if (challengeDone || isFactorMode || isPerimeterMode || learnerBlocked()) return;
    const cellState = getCellState(row, col);
    if (cellState?.isCorrect) return;
    SoundManager.tap();
    setSelectedCell([row, col]);
    setCurrentInput(cellState?.studentAnswer || '');
  };

  /** A wrong entry is a checked miss: it reaches the tutor and closes the item until Try again. */
  const commitWrong = (check: AreaCheck, labelled: boolean) => {
    if (!currentChallenge) return;
    const response = describeAreaCheck(currentChallenge, check, labelled);
    setLastWrong(response);
    commitCheck.current(response, false, areaMiss(currentChallenge, check));
  };

  // A right cell is kept and is not a commit: the item's answer is the whole model. A wrong cell commits.
  const handleCellSubmit = () => {
    if (!selectedCell || challengeDone || !currentChallenge || learnerBlocked()) return;
    const [row, col] = selectedCell;
    const cellKey = getCellKey(row, col);
    const correctAnswer = factor1Parts[col] * factor2Parts[row];
    const check: AreaCheck = { step: 'cell', row, col, entered: currentInput };
    const isCorrect = areaCheckCorrect(currentChallenge, check);

    const existingState = getCellState(row, col);
    const newState: CellState = {
      row,
      col,
      studentAnswer: currentInput,
      isCorrect,
      attempts: (existingState?.attempts || 0) + 1,
    };

    const next = new Map(cellStates);
    next.set(cellKey, newState);
    setCellStates(next);
    recordResponse({ step: 'cell', attempt: newState.attempts, cell: [row, col], expected: String(correctAnswer),
      entered: currentInput, correct: isCorrect, scaffoldShown: showCellEquations, miss: areaMiss(currentChallenge, check) });

    if (isCorrect) {
      SoundManager.playCorrect();
      setSelectedCell(null);
      setCurrentInput('');
      setLastWrong(null);
    } else {
      SoundManager.playIncorrect();
      commitWrong(check, showCellEquations);
      sendText(
        `[CELL_INCORRECT] Student entered "${currentInput}" for the cell ${formatCellEquation(row, col)} `
        + `(attempt ${newState.attempts}). Give a brief hint about this one cell without giving the product.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
    }
  };

  const handleSumSubmit = () => {
    if (challengeDone || !currentChallenge || learnerBlocked()) return;
    if (!sumInput) return;

    const check: AreaCheck = { step: 'sum', entered: sumInput };
    const correctSum = totalProduct;
    const isCorrect = areaCheckCorrect(currentChallenge, check);

    const nextSumAttempts = sumAttempts + 1;
    setSumAttempts(nextSumAttempts);
    setSumAttempted(true);
    setSumCorrect(isCorrect);
    recordResponse({ step: 'sum', attempt: nextSumAttempts, expected: String(correctSum), entered: sumInput,
      correct: isCorrect, scaffoldShown: true, miss: areaMiss(currentChallenge, check) });

    if (!isCorrect) {
      SoundManager.playIncorrect();
      commitWrong(check, showCellEquations);
      sendText(
        `[SUM_INCORRECT] Student summed the partial products to "${sumInput}" but that is wrong `
        + `(attempt ${nextSumAttempts}). All cell products are already correct. `
        + `Nudge them to re-add the partial products carefully; do NOT give the total.`,
        { silent: true },
      );
      return; // let the student try again
    }
    SoundManager.playCorrect();

    // All cells were already correct (sum button is only enabled then).
    let cellAttempts = 0;
    let correctCells = 0;
    cellStates.forEach((s) => {
      cellAttempts += s.attempts;
      if (s.isCorrect) correctCells++;
    });

    const partialAccuracy = totalCells > 0 ? correctCells / totalCells : 0;
    const cellsFirstTry =
      correctCells === totalCells && cellAttempts === totalCells;
    const sumFirstTry = nextSumAttempts === 1;
    const isPerfect = cellsFirstTry && sumFirstTry;

    // Score: weighted 70% partials × cell-attempt decay + 30% sum-attempt decay.
    const avgCellAttempts = totalCells > 0 ? cellAttempts / totalCells : 1;
    const cellComponent = partialAccuracy * phaseScore(Math.round(avgCellAttempts));
    const sumComponent = phaseScore(nextSumAttempts);
    const score = Math.round((cellComponent * 0.7) + (sumComponent * 0.3));

    completeCurrentChallenge(true, isPerfect ? 100 : score, cellAttempts + nextSumAttempts, {
      cellAttempts,
      sumAttempts: nextSumAttempts,
    }, describeAreaCheck(currentChallenge, check, showCellEquations));
  };

  // ── Perimeter handler ──────────────────────────────────────────
  const handlePerimeterSubmit = () => {
    if (challengeDone || !currentChallenge || learnerBlocked()) return;
    if (!perimeterInput) return;

    const check: AreaCheck = { step: 'perimeter', entered: perimeterInput };
    const isCorrect = areaCheckCorrect(currentChallenge, check);
    const nextAttempts = perimeterAttempts + 1;

    setPerimeterCorrect(isCorrect);
    setPerimeterAttempts(nextAttempts);
    recordResponse({ step: 'perimeter', attempt: nextAttempts, expected: String(totalPerimeter), entered: perimeterInput,
      correct: isCorrect, scaffoldShown: showPerimeterExpansion, miss: areaMiss(currentChallenge, check) });

    if (!isCorrect) {
      SoundManager.playIncorrect();
      commitWrong(check, false);
      sendText(
        `[PERIMETER_INCORRECT] Student answered "${perimeterInput}" for the perimeter of a `
        + `${factor1Total} × ${factor2Total} rectangle (attempt ${nextAttempts}). `
        + `Give a brief hint without giving the value.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
      return;
    }
    SoundManager.playCorrect();

    const score = phaseScore(nextAttempts);
    completeCurrentChallenge(true, score, nextAttempts, {
      perimeterAttempts: nextAttempts,
    }, describeAreaCheck(currentChallenge, check, false));
  };

  // ── Factor handlers ────────────────────────────────────────────
  const handleFactorTopChange = (index: number, value: string) => {
    if (learnerBlocked()) return;
    const next = [...factorTopInputs];
    next[index] = value;
    setFactorTopInputs(next);
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorLeftChange = (index: number, value: string) => {
    if (learnerBlocked()) return;
    const next = [...factorLeftInputs];
    next[index] = value;
    setFactorLeftInputs(next);
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorCheck = () => {
    if (challengeDone || !currentChallenge || learnerBlocked()) return;
    const nextAttempts = factorAttempts + 1;
    setFactorAttempts(nextAttempts);

    const check: AreaCheck = { step: 'dimensions', top: factorTopInputs, left: factorLeftInputs };
    // Any parts that make every cell are right, not only the generator's split.
    const allCorrect = areaCheckCorrect(currentChallenge, check);
    const topNums = factorTopInputs.map((v) => parseInt(v, 10));
    const leftNums = factorLeftInputs.map((v) => parseInt(v, 10));
    setFactorTopCorrect(allCorrect ? topNums.map(() => true) : topNums.map((n, i) => n === factor1Parts[i]));
    setFactorLeftCorrect(allCorrect ? leftNums.map(() => true) : leftNums.map((n, i) => n === factor2Parts[i]));
    setFactorChecked(true);

    recordResponse({ step: 'dimensions', attempt: nextAttempts, correct: allCorrect, scaffoldShown: highlightCell !== null,
      expected: `columns ${factor1Parts.join(', ')}; rows ${factor2Parts.join(', ')}`,
      entered: `columns ${factorTopInputs.join(', ')}; rows ${factorLeftInputs.join(', ')}`, miss: areaMiss(currentChallenge, check) });
    if (!allCorrect) {
      SoundManager.playIncorrect();
      commitWrong(check, false);
      sendText(
        `[FACTOR_INCORRECT] Student's dimension guesses are wrong (attempt ${nextAttempts}). `
        + `They entered top: [${factorTopInputs.join(', ')}], left: [${factorLeftInputs.join(', ')}]. `
        + `Point them at a corner cell to deduce one dimension; do NOT give the factors.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
      return;
    }
    SoundManager.playCorrect();

    const score = phaseScore(nextAttempts);
    completeCurrentChallenge(true, score, nextAttempts, {
      factorAttempts: nextAttempts,
    }, describeAreaCheck(currentChallenge, check, false));
  };

  // ── Hints (per-challenge counter) ──────────────────────────────
  const handleShowHint = () => {
    if (challengeDone) return;
    setChallengeHintCount((c) => c + 1);
  };

  // ── Advance to next challenge ──────────────────────────────────
  // Send exactly one end_of_turn message carrying the NEXT problem's data, so
  // the tutor introduces the real problem (the auto context update is silent).
  const handleNextChallenge = () => {
    const next = challenges[currentIndex + 1];
    if (next) {
      const nf1 = next.factor1Parts.reduce((s, v) => s + v, 0);
      const nf2 = next.factor2Parts.reduce((s, v) => s + v, 0);
      sendText(
        `[NEXT_ITEM] Problem ${currentIndex + 2} of ${challenges.length} (${sessionChallengeType}): `
        + `a ${nf1} × ${nf2} model. Introduce it briefly — same strategy, new numbers.`,
        { silent: true },
      );
    }
    advance();
  };

  // ── UI helpers ─────────────────────────────────────────────────
  const formatLabel = (value: number, labelArray?: string[], index?: number): string => {
    if (labelArray && index !== undefined) return labelArray[index];
    return String(value);
  };

  const formatCellEquation = (row: number, col: number): string => {
    const f1 = formatLabel(factor1Parts[col], labels?.factor1, col);
    const f2 = formatLabel(factor2Parts[row], labels?.factor2, row);
    return `${f1} × ${f2}`;
  };

  const getCellColor = (row: number, col: number): string => {
    if (isFactorMode) {
      if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
        return 'bg-yellow-500/40 border-yellow-400';
      }
      const colorIndex = (row + col) % 4;
      const colors = [
        'bg-slate-500/20 border-slate-400/50',
        'bg-purple-500/20 border-purple-400/50',
        'bg-pink-500/20 border-pink-400/50',
        'bg-indigo-500/20 border-indigo-400/50',
      ];
      return colors[colorIndex];
    }

    const state = getCellState(row, col);
    if (state?.isCorrect) return 'bg-green-500/30 border-green-400';
    if (state && !state.isCorrect) return 'bg-red-500/30 border-red-400';
    if (selectedCell && selectedCell[0] === row && selectedCell[1] === col) {
      return 'bg-blue-500/40 border-blue-400 ring-2 ring-blue-400';
    }
    if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
      return 'bg-yellow-500/40 border-yellow-400';
    }
    const colorIndex = (row + col) % 4;
    const colors = [
      'bg-slate-500/20 border-slate-400/50',
      'bg-purple-500/20 border-purple-400/50',
      'bg-pink-500/20 border-pink-400/50',
      'bg-indigo-500/20 border-indigo-400/50',
    ];
    return colors[colorIndex];
  };

  const getFactorInputStyle = (isCorrect: boolean | null): string => {
    if (isCorrect === null) return 'border-slate-600 focus:border-blue-400';
    if (isCorrect) return 'border-green-400 bg-green-500/10';
    return 'border-red-400 bg-red-500/10';
  };

  // Auto-focus input when cell selected
  useEffect(() => {
    if (selectedCell) {
      const input = document.getElementById('cell-input');
      input?.focus();
    }
  }, [selectedCell]);

  // ── Derived UI state ───────────────────────────────────────────
  const correctCells = Array.from(cellStates.values()).filter((s) => s.isCorrect).length;
  const showSumSection = !isFactorMode && !isPerimeterMode && allCellsComplete();
  const allFactorInputsFilled =
    factorTopInputs.every((v) => v.trim() !== '') &&
    factorLeftInputs.every((v) => v.trim() !== '');
  const factorAllCorrect =
    factorChecked &&
    factorTopCorrect.every((v) => v === true) &&
    factorLeftCorrect.every((v) => v === true);
  const hasNextChallenge = currentIndex + 1 < challenges.length;
  /** Workspace path: the learner's input is closed while a checked answer waits for Try again. */
  const closed = tutorOwned && progress.canAttempt === false;

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  const areaView: AreaView = {
    cells: Object.fromEntries(Array.from(cellStates, ([key, s]) => [key, { entered: s.studentAnswer, correct: !!s.isCorrect }])),
    sumInput, perimeterInput, factorTop: factorTopInputs, factorLeft: factorLeftInputs,
    cellsLabelled: showCellEquations, sideSumShown: showPerimeterExpansion, lastWrong,
  };
  // Every mode declares its levers; a tier aid already on screen counts as pulled.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, sessionChallengeType, areaView);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, sessionChallengeType);
    const levers = practice ? [] : areaModelLevers(sessionChallenge, pulledLevers, { mode: sessionChallengeType,
      cellsLabelled: tierCellEquations, sideSumShown: tierPerimeterExpansion, startCellShown: !!sessionChallenge.highlightCell });
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        if (id === STACK_LEVER && !allCellsComplete())
          return 'The products stand in a column only once every cell is right; first help with the cell, with another lever.';
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge, sessionChallengeType);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); resetWork(easier); setPractice(easier);
          return { practice: workspaceAssignmentFor(sessionChallengeType)(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetWork(sessionChallenge); setPractice(null); },
    };
  });

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No area model challenges available.
        </div>
      </div>
    );
  }

  // ── Session summary ────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-16 ${className || ''}`}>
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score}
          durationMs={elapsedMs}
          heading="Area Model Session Complete"
          celebrationMessage={
            results.every((r) => r.correct)
              ? 'Perfect! You solved every problem.'
              : 'Great work — review where you struggled and try again next time.'
          }
        />
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Area Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <LuminaBadge accent="blue" className="text-xs font-mono uppercase tracking-wider">
              {isFactorMode
                ? 'Factor Discovery'
                : isPerimeterMode
                  ? 'Perimeter Practice'
                  : algebraicMode
                    ? 'Algebraic Multiplication'
                    : 'Interactive Multiplication'}
            </LuminaBadge>
          </div>
        </div>
      </div>

      <LuminaCard className="shadow-2xl">
        <div
          className="absolute inset-0 opacity-10 rounded-3xl"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <LuminaCardHeader className="relative z-10 text-center">
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          {practice ? <div className="text-center text-xs text-amber-300" data-practice>Practice</div> : null}
          <LuminaCardDescription className="text-slate-300">{description}</LuminaCardDescription>
        </LuminaCardHeader>

        <LuminaCardContent className="relative z-10">
          {/* Session progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !challengeDone;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                        ? 'bg-blue-500/20 text-blue-200 border-blue-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Problem {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* Forward mode progress */}
          {!isFactorMode && !isPerimeterMode && !challengeDone && (
            <LuminaPanel className="mb-6 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Progress</span>
                <span className="text-sm font-mono text-blue-400">
                  {correctCells} / {totalCells} cells complete
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(correctCells / totalCells) * 100}%` }}
                ></div>
              </div>
            </LuminaPanel>
          )}

          {/* Perimeter mode progress */}
          {isPerimeterMode && !challengeDone && (
            <LuminaPanel className="mb-6 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the perimeter of this rectangle
                </span>
                <span className="text-sm font-mono text-emerald-400">
                  {factor1Total} × {factor2Total}
                </span>
              </div>
              {perimeterAttempts > 0 && !tutorOwned && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {perimeterAttempts}
                </div>
              )}
            </LuminaPanel>
          )}

          {/* Factor mode progress */}
          {isFactorMode && !challengeDone && (
            <LuminaPanel className="mb-6 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the dimensions that produce these partial products
                </span>
                <span className="text-sm font-mono text-purple-400">
                  Total area = {totalProduct}
                </span>
              </div>
              {factorAttempts > 0 && !tutorOwned && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {factorAttempts}
                </div>
              )}
            </LuminaPanel>
          )}

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              {isFactorMode ? (
                <>
                  <span className="text-blue-300">?</span>
                  <span className="text-slate-500">&times;</span>
                  <span className="text-purple-300">?</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-pink-300">{totalProduct}</span>
                </>
              ) : isPerimeterMode ? (
                <>
                  <span className="text-slate-400 text-lg">Perimeter =</span>
                  <span className="text-slate-500">2 &times; (</span>
                  <span className="text-blue-300">{factor1Total}</span>
                  <span className="text-slate-500">+</span>
                  <span className="text-purple-300">{factor2Total}</span>
                  <span className="text-slate-500">) =</span>
                  <span className="text-pink-300">?</span>
                </>
              ) : (
                <>
                  {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">(</span>}
                  <span className="text-blue-300">
                    {labels?.factor1
                      ? labels.factor1.join(' + ')
                      : factor1Parts.length > 1
                        ? factor1Parts.join(' + ')
                        : factor1Parts[0]}
                  </span>
                  {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">)</span>}
                  <span className="text-slate-500">&times;</span>
                  {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">(</span>}
                  <span className="text-purple-300">
                    {labels?.factor2
                      ? labels.factor2.join(' + ')
                      : factor2Parts.length > 1
                        ? factor2Parts.join(' + ')
                        : factor2Parts[0]}
                  </span>
                  {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">)</span>}
                  <span className="text-slate-500">=</span>
                  <span className="text-pink-300">?</span>
                </>
              )}
            </div>
          </div>

          {pip.store && <div {...pip.dock} />}
          <div {...pip.workspace}>
          {/* Area Model Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Top dimension labels / inputs */}
              {isFactorMode ? (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-input-${index}`}
                      className="flex items-center justify-center"
                      style={{ width: `${cellWidthForPart(part)}px` }}
                    >
                      <LuminaInput
                        type="number"
                        inputMode="numeric"
                        value={factorTopInputs[index] ?? ''}
                        onChange={(e) => handleFactorTopChange(index, e.target.value)}
                        disabled={challengeDone || factorAllCorrect || closed}
                        aria-label={`Column part ${index + 1}`}
                        style={showSharedParts ? { boxShadow: `0 0 0 3px ${COLUMN_COLOURS[index % COLUMN_COLOURS.length]}` } : undefined}
                        className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm bg-slate-700/80 text-blue-300 ${getFactorInputStyle(factorTopCorrect[index] ?? null)}`}
                        placeholder="?"
                      />
                    </div>
                  ))}
                </div>
              ) : showDimensions ? (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-${index}`}
                      className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm"
                      style={{ width: `${cellWidthForPart(part)}px` }}
                    >
                      {formatLabel(part, labels?.factor1, index)}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex">
                {/* Left dimension labels / inputs */}
                {isFactorMode ? (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-input-${index}`}
                        className="flex items-center justify-center"
                        style={{ height: `${cellHeightForPart(part)}px` }}
                      >
                        <LuminaInput
                          type="number"
                          inputMode="numeric"
                          value={factorLeftInputs[index] ?? ''}
                          onChange={(e) => handleFactorLeftChange(index, e.target.value)}
                          disabled={challengeDone || factorAllCorrect || closed}
                          aria-label={`Row part ${index + 1}`}
                          style={showSharedParts ? { boxShadow: `0 0 0 3px ${ROW_COLOURS[index % ROW_COLOURS.length]}` } : undefined}
                          className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm bg-slate-700/80 text-purple-300 ${getFactorInputStyle(factorLeftCorrect[index] ?? null)}`}
                          placeholder="?"
                        />
                      </div>
                    ))}
                  </div>
                ) : showDimensions ? (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-${index}`}
                        className="flex items-center justify-center text-purple-300 font-mono font-bold text-sm"
                        style={{ height: `${cellHeightForPart(part)}px` }}
                      >
                        {formatLabel(part, labels?.factor2, index)}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Grid */}
                <div
                  className="grid gap-2 transition-all duration-500"
                  style={{
                    gridTemplateColumns: `repeat(${factor1Parts.length}, minmax(100px, 1fr))`,
                  }}
                >
                  {factor2Parts.map((_, rowIndex) =>
                    factor1Parts.map((_, colIndex) => {
                      const cellState = getCellState(rowIndex, colIndex);
                      const isSelected =
                        selectedCell &&
                        selectedCell[0] === rowIndex &&
                        selectedCell[1] === colIndex;

                      const forwardCell = !isFactorMode && !isPerimeterMode;
                      const CellTag = forwardCell ? 'button' : 'div';
                      return (
                        <CellTag
                          key={`cell-${rowIndex}-${colIndex}`}
                          {...(forwardCell ? { type: 'button' as const, 'aria-label': `Cell row ${rowIndex + 1} column ${colIndex + 1}` } : {})}
                          className={`
                            border-2 rounded-lg flex flex-col items-center justify-center p-4
                            transition-all duration-300
                            ${isFactorMode || isPerimeterMode ? '' : 'cursor-pointer'}
                            ${getCellColor(rowIndex, colIndex)}
                            ${!isFactorMode && !isPerimeterMode && !cellState?.isCorrect && !challengeDone ? 'hover:scale-105' : ''}
                          `}
                          style={{
                            minHeight: `${cellHeightForPart(factor2Parts[rowIndex])}px`,
                            minWidth: `${cellWidthForPart(factor1Parts[colIndex])}px`,
                            ...(isFactorMode && showSharedParts ? {
                              borderTopColor: COLUMN_COLOURS[colIndex % COLUMN_COLOURS.length], borderTopWidth: 5,
                              borderLeftColor: ROW_COLOURS[rowIndex % ROW_COLOURS.length], borderLeftWidth: 5,
                            } : {}),
                          }}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                          {isPerimeterMode ? null : isFactorMode ? (
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg">
                                {partialProducts[rowIndex][colIndex]}
                              </div>
                            </div>
                          ) : (
                            <>
                              {showCellEquations && (
                                <div className="text-xs text-slate-400 mb-2">
                                  {formatCellEquation(rowIndex, colIndex)}
                                </div>
                              )}
                              {showTensSplit && splits[`${rowIndex},${colIndex}`] && (
                                <div className="text-xs text-amber-300 mb-2 font-mono" data-lever="tens_split">
                                  {splits[`${rowIndex},${colIndex}`]}
                                </div>
                              )}
                              {showCellDots && factor2Parts[rowIndex] <= 10 && factor1Parts[colIndex] <= 10 && (
                                <div className="flex flex-col gap-0.5 mb-2" data-lever="cell_dots" aria-hidden="true">
                                  {Array.from({ length: factor2Parts[rowIndex] }, (_, r) => (
                                    <div key={r} className="flex gap-0.5">
                                      {Array.from({ length: factor1Parts[colIndex] }, (_, k) => (
                                        <span key={k} className="block w-1.5 h-1.5 rounded-full bg-sky-300/80" />
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {cellState?.isCorrect && (
                                <div className="text-center">
                                  <div className="text-white font-mono font-bold text-lg">
                                    {cellState.studentAnswer}
                                  </div>
                                  <div className="text-xs text-green-400 mt-1">&#x2713;</div>
                                </div>
                              )}

                              {cellState && !cellState.isCorrect && (
                                <div className="text-center">
                                  <div className="text-white font-mono font-bold text-lg line-through opacity-50">
                                    {cellState.studentAnswer}
                                  </div>
                                  <div className="text-xs text-red-400 mt-1">Try again</div>
                                </div>
                              )}

                              {!cellState && !isSelected && (
                                <div className="text-slate-500 text-lg">?</div>
                              )}
                            </>
                          )}
                        </CellTag>
                      );
                    }),
                  )}
                </div>
                {isPerimeterMode && showAllSides && (
                  <div className="flex items-center ml-2 text-purple-300 font-mono font-bold text-sm" data-lever="all_sides">
                    {factor2Total}
                  </div>
                )}
              </div>
              {isPerimeterMode && showAllSides && (
                <div className="flex justify-center mt-2 ml-16 text-blue-300 font-mono font-bold text-sm" data-lever="all_sides">
                  {factor1Total}
                </div>
              )}
            </div>
          </div>

          {/* Cell input — forward mode */}
          {!isFactorMode && !isPerimeterMode && selectedCell && !challengeDone && (
            <LuminaCard surface="nested" className="mt-8 border-blue-500/30">
              <LuminaCardHeader>
                <LuminaCardTitle className="text-sm font-mono uppercase tracking-wider text-blue-400">
                  Step 1: Calculate Partial Product
                </LuminaCardTitle>
              </LuminaCardHeader>
              <LuminaCardContent className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    {showCellEquations
                      ? `What is ${formatCellEquation(selectedCell[0], selectedCell[1])}?`
                      : "What is this cell's partial product? Multiply its column header (top) by its row header (left)."}
                  </label>
                  <div className="flex gap-2">
                    <LuminaInput
                      id="cell-input"
                      type="number"
                      inputMode="numeric"
                      value={currentInput}
                      onChange={(e) => { if (!learnerBlocked()) setCurrentInput(e.target.value); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCellSubmit();
                      }}
                      className="flex-1 font-mono"
                      placeholder="Enter answer"
                      aria-label="Cell product"
                      disabled={challengeDone || closed}
                    />
                    <LuminaButton
                      tone="primary"
                      onClick={handleCellSubmit}
                      disabled={!currentInput || challengeDone || closed}
                    >
                      Check
                    </LuminaButton>
                  </div>
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Sum section — forward mode */}
          {showSumSection && !challengeDone && (
            <LuminaCard surface="nested" className="mt-8 border-purple-500/30">
              <LuminaCardHeader>
                <LuminaCardTitle className="text-sm font-mono uppercase tracking-wider text-purple-400">
                  Step 2: Add All Partial Products
                </LuminaCardTitle>
              </LuminaCardHeader>
              <LuminaCardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  {Array.from(cellStates.values())
                    .filter((s) => s.isCorrect)
                    .map((s) => s.studentAnswer)
                    .join(' + ')}
                </div>
                {showStack && (
                  <div className="flex justify-center" data-lever="stack_products">
                    <div className="inline-flex flex-col items-end font-mono text-lg text-slate-200 border-b-2 border-slate-400 pb-1 px-3">
                      {Array.from(cellStates.values()).filter((s) => s.isCorrect).map((s, i, all) => (
                        <div key={`${s.row},${s.col}`}>{i === all.length - 1 ? '+ ' : ''}{s.studentAnswer}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the sum of all partial products?
                  </label>
                  <div className="flex gap-2">
                    <LuminaInput
                      type="number"
                      inputMode="numeric"
                      value={sumInput}
                      onChange={(e) => { if (!learnerBlocked()) setSumInput(e.target.value); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSumSubmit();
                      }}
                      className="flex-1 font-mono"
                      placeholder="Enter sum"
                      aria-label="Sum of the cell products"
                      disabled={closed}
                    />
                    <LuminaButton
                      tone="primary"
                      onClick={handleSumSubmit}
                      disabled={!sumInput || challengeDone || closed}
                    >
                      Submit Final Answer
                    </LuminaButton>
                  </div>
                  {sumAttempted && sumCorrect === false && (
                    <div className="mt-2 text-sm text-red-400">
                      Not quite. Double-check your addition of the partial products.
                    </div>
                  )}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Perimeter input */}
          {isPerimeterMode && !challengeDone && (
            <LuminaCard surface="nested" className="mt-8 border-emerald-500/30">
              <LuminaCardHeader>
                <LuminaCardTitle className="text-sm font-mono uppercase tracking-wider text-emerald-400">
                  Find the Perimeter
                </LuminaCardTitle>
              </LuminaCardHeader>
              <LuminaCardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  The rectangle has sides of {factor1Total} and {factor2Total}.
                  {showPerimeterExpansion && (
                    <>
                      <br />
                      Perimeter = {factor1Total} + {factor2Total} + {factor1Total} + {factor2Total}
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the perimeter of this rectangle?
                  </label>
                  <div className="flex gap-2">
                    <LuminaInput
                      type="number"
                      inputMode="numeric"
                      value={perimeterInput}
                      onChange={(e) => {
                        if (learnerBlocked()) return;
                        setPerimeterInput(e.target.value);
                        if (perimeterCorrect !== null) setPerimeterCorrect(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handlePerimeterSubmit();
                      }}
                      className={`flex-1 font-mono ${
                        perimeterCorrect === true
                          ? 'border-emerald-400'
                          : perimeterCorrect === false
                            ? 'border-rose-400'
                            : ''
                      }`}
                      placeholder="Enter perimeter"
                      aria-label="Perimeter"
                      disabled={challengeDone || closed}
                    />
                    <LuminaButton
                      tone="primary"
                      onClick={handlePerimeterSubmit}
                      disabled={!perimeterInput || challengeDone || closed}
                    >
                      Submit
                    </LuminaButton>
                  </div>
                  {perimeterCorrect === false && !challengeDone && (
                    <div className="mt-2 text-sm text-red-400">
                      Not quite. Remember: the perimeter is the total distance around the rectangle. Try adding all four sides.
                    </div>
                  )}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          )}

          {/* Factor mode: Check Factors button */}
          {isFactorMode && !challengeDone && !factorAllCorrect && (
            <div className="mt-8 flex justify-center">
              <LuminaButton
                tone="primary"
                onClick={handleFactorCheck}
                disabled={!allFactorInputsFilled || closed}
                className="px-8 py-3 text-lg"
              >
                Check My Factors
              </LuminaButton>
            </div>
          )}

          {/* Factor mode: hint after wrong attempt */}
          {isFactorMode && factorChecked && !factorAllCorrect && !challengeDone && (
            <LuminaCard surface="nested" className="mt-6 border-yellow-500/30">
              <LuminaCardContent className="pt-6">
                <p className="text-sm text-yellow-300">
                  Not quite! Look at the partial products in the grid. Each cell equals
                  its column header &times; its row header. Try using one cell to figure out
                  a dimension, then check the others.
                </p>
              </LuminaCardContent>
            </LuminaCard>
          )}

          </div>

          {/* Between-challenge interstitial: shown after the current challenge is done */}
          {challengeDone && (
            <div className="mt-8 space-y-4">
              <LuminaFeedbackCard status="correct" label={`Problem ${currentIndex + 1} Complete`}>
                {isPerimeterMode ? (
                  <p>
                    Perimeter = 2 &times; ({factor1Total} + {factor2Total}) ={' '}
                    <span className="font-bold text-white">{totalPerimeter}</span>
                  </p>
                ) : isFactorMode ? (
                  <p>
                    The factors are ({factor1Parts.join(' + ')}) &times; ({factor2Parts.join(' + ')})
                    = {factor1Total} &times; {factor2Total} ={' '}
                    <span className="font-bold text-white">{totalProduct}</span>
                  </p>
                ) : (
                  <p>
                    You found <span className="font-bold text-white">{totalProduct}</span> from{' '}
                    {factor1Total} &times; {factor2Total}.
                  </p>
                )}
              </LuminaFeedbackCard>
              {tutorOwned ? null : hasNextChallenge ? (
                <div className="flex justify-end">
                  <LuminaActionButton action="next" onClick={handleNextChallenge}>
                    Next Problem →
                  </LuminaActionButton>
                </div>
              ) : (
                <p className="text-right text-sm text-slate-400 font-mono uppercase tracking-wider">
                  Last problem
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          <Accordion type="single" collapsible className="mt-8" onValueChange={(v) => {
            if (v === 'instructions') handleShowHint();
          }}>
            <AccordionItem value="instructions" className="border-white/10 bg-slate-800/30 rounded-xl px-6">
              <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
                <span className="text-sm font-mono uppercase tracking-wider text-slate-400">
                  How to Use This Tool
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-4">
                {isFactorMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="purple" className="mt-0.5">1</LuminaBadge>
                      <span>Look at the partial products shown in each cell of the grid</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="purple" className="mt-0.5">2</LuminaBadge>
                      <span>Figure out what numbers go on top and on the left side</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="purple" className="mt-0.5">3</LuminaBadge>
                      <span>Each cell = its column header &times; its row header</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="purple" className="mt-0.5">4</LuminaBadge>
                      <span>Type your answers into the input fields and click &quot;Check My Factors&quot;</span>
                    </li>
                  </ul>
                ) : isPerimeterMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="emerald" className="mt-0.5">1</LuminaBadge>
                      <span>Look at the two side lengths labeled on the rectangle</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="emerald" className="mt-0.5">2</LuminaBadge>
                      <span>Perimeter is the total distance around the outside of a shape</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="emerald" className="mt-0.5">3</LuminaBadge>
                      <span>Rectangle shortcut: Perimeter = 2 &times; (length + width)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="emerald" className="mt-0.5">4</LuminaBadge>
                      <span>Type your answer and press Submit</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="blue" className="mt-0.5">1</LuminaBadge>
                      <span>Click on each cell and calculate the partial product (e.g., 30 &times; 4 = 120)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="blue" className="mt-0.5">2</LuminaBadge>
                      <span>Complete all cells to unlock Step 2</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="blue" className="mt-0.5">3</LuminaBadge>
                      <span>Add all your partial products together to get the final answer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuminaBadge accent="blue" className="mt-0.5">4</LuminaBadge>
                      <span>This demonstrates the Distributive Property of multiplication</span>
                    </li>
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const AreaModel = withWorkspaceController<AreaModelProps, ProgressOptions<AreaModelChallenge>, Progress>(
  'area-model', AreaModelSurface, useScriptedProgress, useWorkspaceProgressFor('area-model'));

export default AreaModel;
