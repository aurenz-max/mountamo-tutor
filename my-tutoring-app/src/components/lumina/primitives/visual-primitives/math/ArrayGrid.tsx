'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  usePrimitiveEvaluation,
  type ArrayGridMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaBadge,
  LuminaActionButton,
  LuminaButton,
  LuminaInput,
} from '../../../ui';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  arrayItems, arrayMiss, arrayShape, cellKey, describeArrayWork, gridFor, makeArrayAsk, makeArrayMiss, workspaceScene,
  type ArrayGridView, type ArrayItem,
} from './arrayGridWorkspace';
import {
  ARRAY_LEVERS, NUMBER_LABELS_LEVER, ROW_COUNTS_LEVER, ROW_STRIPS_LEVER, SQUARE_COUNT_LEVER, type ArrayLeverContext,
} from './arrayGridLevers';
import { arrayGridBoss } from './arrayGrid.boss';
import { ArrayBuildGrid, FirstArray } from './ArrayBuildGrid';

/**
 * Array Grid — multi-challenge array builder / counter / multiplier, and the open build `make_array`.
 *
 * Session walks the student through 3-6 distinct (rows, columns) pairs in the
 * SAME eval mode. Per PRD §6h (array-grid post-mortem), per-challenge state
 * must reset on advance; the stale-state guard lives in submit handlers
 * (§6a #8). Pool-service generator owns dimension variance — Gemini emits
 * only wrapper metadata.
 *
 * Taught only on the shared teaching workspace (`arrayGrid.card.ts`, `arrayGrid.boss.ts`): the check commits through
 * `progress.commitCheck` and the runtime owns progression: no Next button, the scored session submitted from
 * `onFinished`.
 */

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type ArrayGridChallengeType = 'build_array' | 'count_array' | 'multiply_array' | 'make_array';
export type ArrayGridIconType = 'dot' | 'square' | 'star';

export interface ArrayGridChallenge {
  id: string;
  /** 0 on make_array, where the learner chooses the rows and columns. */
  targetRows: number;
  targetColumns: number;
  /** make_array (open build): how many squares to make, as any full rectangle on an empty grid. */
  total?: number;
  /** make_array: 2 asks for a second, different array after the first. */
  ways?: 1 | 2;
  /** make_array: the ask, written by code ("Make an array with 12 squares."). */
  instruction?: string;
  /** Item-space calibration stamp (mult-div-facts): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface ArrayGridData {
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: ArrayGridChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: ArrayGridChallengeType;

  // Display options (session-level)
  iconType?: ArrayGridIconType;
  showLabels?: boolean;
  maxRows?: number;
  maxColumns?: number;

  // Within-mode support tier (resolved by the generator from config.difficulty).
  /** Support tier applied to this session ('easy'|'medium'|'hard'). Metadata only. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /**
   * Number-free strategy hint shown under the task header. Present at the easy
   * tier (names the approach, never the answer); withdrawn at medium/hard.
   */
  strategyHint?: string;

  // Evaluation integration (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ArrayGridMetrics>) => void;
}

interface ArrayGridProps {
  data: ArrayGridData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_array:    { label: 'Build',    icon: '🔨', accentColor: 'emerald' },
  count_array:    { label: 'Count',    icon: '🔢', accentColor: 'blue' },
  multiply_array: { label: 'Multiply', icon: '✖️', accentColor: 'purple' },
  make_array:     { label: 'Make',     icon: '🧱', accentColor: 'cyan' },
};

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

/** The make_array verdict's words: the rule an array keeps, never a number or a direction. */
const MAKE_FEEDBACK: Record<string, string> = {
  ragged: 'Not yet. In an array every row has the same number of squares, with no gaps. Fix your squares.',
  same_as_first: 'That is the same array as your first one. Change your squares to make a different array.',
};
const MAKE_NOT_YET = 'Not yet. Count your squares, then fix your array.';
const PRACTICE_NOTE = 'An easier practice array is on screen in place of the item. It is not graded; the full item comes back after it.';

const useArrayProgress = useWorkspaceProgressFor('array-grid');

// ============================================================================
// Component
// ============================================================================

const ArrayGridSurface = ({ data, className, runtimePlanItemId }: ArrayGridProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challengeType: sessionChallengeType,
    iconType = 'star',
    showLabels = true,
    maxRows = 6,
    maxColumns = 8,
    strategyHint,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  /** The lesson's arrays, each with the session's mode and icon (`arrayItems`). */
  const challenges = useMemo(() => arrayItems(data), [data]);

  const isMakeMode = sessionChallengeType === 'make_array';
  /** make_array always builds squares: the ask names them. */
  const icon: ArrayGridIconType = isMakeMode ? 'square' : iconType;

  const stableInstanceIdRef = useRef(instanceId || `array-grid-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress: the teaching workspace moves the index. ──
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useArrayProgress({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: arrayGridBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, results, isComplete, mergeResult } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const learnerBlocked = () => progress.canAttempt === false;

  // Levers (`ARRAY_LEVERS`), keyed by the session item they were pulled on, and the easier item a simplify lever put
  // on screen in its place. The item starts bare: no lever comes from the tier (the tier's labels and strategy tip
  // are session-level starting positions, not levers).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ArrayItem | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier ask while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** The session's labels, or the number_labels lever on this item. */
  const labelsShown = showLabels || leverOn(NUMBER_LABELS_LEVER);

  const targetRows = currentChallenge?.targetRows ?? 0;
  const targetColumns = currentChallenge?.targetColumns ?? 0;
  const targetProduct = targetRows * targetColumns;
  const makeTotal = currentChallenge?.total ?? 0;
  const makeAsk = currentChallenge?.instruction ?? makeArrayAsk(makeTotal, currentChallenge?.ways);

  const isMultiplyMode = sessionChallengeType === 'multiply_array';
  const isPreBuilt = sessionChallengeType === 'count_array' || isMultiplyMode;

  // Capped button ranges (must match component caps in the catalog/generator)
  const rowButtonCount = Math.min(maxRows, 6);
  const colButtonCount = Math.min(maxColumns, 8);

  // ── Per-challenge interaction state (resets on advance) ────────
  const [currentRows, setCurrentRows] = useState(0);
  const [currentColumns, setCurrentColumns] = useState(0);
  const [totalAnswer, setTotalAnswer] = useState('');
  const [rowsAnswer, setRowsAnswer] = useState('');
  const [columnsAnswer, setColumnsAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);
  /** make_array: the squares on the grid (`row-column`), and the first array on a two-ways item once it passed. */
  const [cells, setCells] = useState<string[]>([]);
  const [firstWay, setFirstWay] = useState<{ rows: number; columns: number } | null>(null);

  const recordedRef = useRef(false);

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c lesson: missing any slot leaks state from challenge N into N+1. A practice ask and the return from it
  // change the id too, so each opens an empty grid. The reset runs in the same update that opens the item
  // (`openItem`, the lever handlers), so no later render of the item supersedes its receipt; the effect then finds
  // the item already reset.
  const resetFor = useRef<string | null>(null);
  const resetItem = (challenge: ArrayGridChallenge) => {
    resetFor.current = challenge.id;
    // Pre-built modes show the array immediately at target dimensions.
    const startRows = isPreBuilt ? challenge.targetRows : 0;
    const startCols = isPreBuilt ? challenge.targetColumns : 0;
    setCurrentRows(startRows);
    setCurrentColumns(startCols);
    setTotalAnswer('');
    setRowsAnswer('');
    setColumnsAnswer('');
    setFeedback(null);
    setFeedbackType(null);
    setAttempts(0);
    setChallengeDone(false);
    setCells([]);
    setFirstWay(null);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (currentChallenge && resetFor.current !== currentChallenge.id) resetItem(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id, isPreBuilt]);

  // A fresh item ends any practice; Try again clears what was typed. The open build keeps its squares and the
  // verdict's words, so the learner revises the array.
  openItem.current = (index, retry) => {
    if (!retry) {
      setPractice(null);
      if (challenges[index]) resetItem(challenges[index]);
      return;
    }
    if (isMakeMode) return;
    setTotalAnswer(''); setRowsAnswer(''); setColumnsAnswer('');
    setFeedback(null); setFeedbackType(null);
  };

  // ── Evaluation hook ────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ArrayGridMetrics>({
    primitiveType: 'array-grid',
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

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = (challenge: ArrayGridChallenge | null): boolean => {
    if (!challenge) return false;
    // For pre-built modes the array is rendered at target dims from the reset effect — match against that. For
    // build mode, the student-built dims can legitimately disagree with target dims, so any state belongs to the
    // active challenge.
    if (isPreBuilt) return currentRows === challenge.targetRows && currentColumns === challenge.targetColumns;
    return true;
  };

  // ── Per-challenge completion (called from submit handlers) ─────
  // A practice ask (the simplify lever) records nothing: it is not the session's challenge.
  const completeCurrentChallenge = (score: number, attemptsCount: number) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    if (!stateMatchesChallenge(currentChallenge)) return;
    recordedRef.current = true;
    setChallengeDone(true);
    if (!practice) mergeResult({ challengeId: currentChallenge.id, correct: true, attempts: attemptsCount, score });
  };

  // ── The learner's work, as the check, the tutor and the scene read it ──
  const view: ArrayGridView = {
    mode: sessionChallengeType, icon, rows: currentRows, columns: currentColumns, totalAnswer, rowsAnswer, columnsAnswer,
    labelsShown, cells, firstWay,
  };
  /** The checked gesture: counts the attempt and records the verdict with its named miss. */
  const commit = (correct: boolean) => {
    progress.commitCheck(describeArrayWork(view), correct, correct ? undefined : arrayMiss(currentChallenge, view));
  };

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss (`diagnosisEvidence.phases`).
  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const metrics: ArrayGridMetrics = {
      type: 'array-grid',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / Math.max(1, challenges.length)) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Build-mode controls ────────────────────────────────────────
  const handleRowChange = (newRows: number) => {
    if (challengeDone || isPreBuilt || learnerBlocked()) return;
    SoundManager.select();
    setCurrentRows(newRows);
    setFeedback(null);
  };

  const handleColumnChange = (newColumns: number) => {
    if (challengeDone || isPreBuilt || learnerBlocked()) return;
    SoundManager.select();
    setCurrentColumns(newColumns);
    setFeedback(null);
  };

  // ── Submit handlers ────────────────────────────────────────────
  const arrayBuilt =
    currentRows === targetRows && currentColumns === targetColumns;

  const handleSubmitCountOrBuild = () => {
    if (!currentChallenge) return;
    const studentTotal = parseInt(totalAnswer, 10);
    const correctArray = currentRows === targetRows && currentColumns === targetColumns;
    const correctTotal = studentTotal === targetProduct;
    const isCorrect = correctArray && correctTotal;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    commit(isCorrect);

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Correct! There are ${targetProduct} ${iconType}s in total.`
          : `Perfect! You built a ${currentRows} × ${currentColumns} array with ${studentTotal} total items.`,
      );
      setFeedbackType('success');
      completeCurrentChallenge(phaseScore(nextAttempts), nextAttempts);
      return;
    }

    SoundManager.playIncorrect();
    if (correctArray && !correctTotal) {
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Not quite. Try counting again — skip count by rows or columns.`
          : `You built the array correctly (${currentRows} × ${currentColumns}), but your total is incorrect. Count again!`,
      );
      setFeedbackType('hint');
    } else if (!correctArray && correctTotal) {
      setFeedback(
        `Your total (${studentTotal}) would be correct for a different array. Build ${targetRows} rows × ${targetColumns} columns.`,
      );
      setFeedbackType('hint');
    } else {
      setFeedback(
        sessionChallengeType === 'count_array'
          ? `Not quite. Count the items carefully — try skip counting by rows!`
          : `Not quite. First, build a ${targetRows} × ${targetColumns} array, then count the total.`,
      );
      setFeedbackType('error');
    }
  };

  const handleSubmitMultiply = () => {
    if (!currentChallenge) return;
    const studentRows = parseInt(rowsAnswer, 10);
    const studentColumns = parseInt(columnsAnswer, 10);
    const studentTotal = parseInt(totalAnswer, 10);

    const correctRows = studentRows === targetRows;
    const correctColumns = studentColumns === targetColumns;
    const correctTotal = studentTotal === targetProduct;
    const isCorrect = correctRows && correctColumns && correctTotal;

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    commit(isCorrect);

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        `Excellent! ${targetRows} × ${targetColumns} = ${targetProduct}. You wrote the multiplication fact correctly!`,
      );
      setFeedbackType('success');
      completeCurrentChallenge(phaseScore(nextAttempts), nextAttempts);
      return;
    }

    SoundManager.playIncorrect();
    const hints: string[] = [];
    if (!correctRows) hints.push('count the rows (horizontal groups)');
    if (!correctColumns) hints.push('count the columns (items in each row)');
    if (!correctTotal) hints.push('multiply rows × columns for the total');
    setFeedback(`Not quite. Try to ${hints.join(', ')}.`);
    setFeedbackType(hints.length === 1 ? 'hint' : 'error');
  };

  /**
   * make_array ("I'm done!"): any full rectangle of the asked number of squares passes. On a two-ways item the first
   * right array is kept, drawn small beside the grid and not committed; the second commits, right only when it differs.
   * The words name no number and no direction.
   */
  const handleSubmitMake = () => {
    if (!currentChallenge) return;
    const miss = makeArrayMiss(makeTotal, cells, firstWay);
    if (!miss && currentChallenge.ways === 2 && !firstWay) {
      const s = arrayShape(cells);
      SoundManager.playCorrect();
      setFirstWay({ rows: s.rows, columns: s.columns });
      setFeedback(`That is one array! Now change your squares to make a different array with ${makeTotal} squares.`);
      setFeedbackType('hint');
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    commit(!miss);
    if (!miss) {
      SoundManager.playCorrect();
      setFeedback(firstWay ? 'Yes! Two different arrays with the same number of squares.' : 'Yes! That is an array.');
      setFeedbackType('success');
      completeCurrentChallenge(phaseScore(nextAttempts), nextAttempts);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback(MAKE_FEEDBACK[miss] ?? MAKE_NOT_YET);
    setFeedbackType('error');
  };

  const handleSubmit = () => {
    if (challengeDone || learnerBlocked()) return;
    if (isMakeMode) handleSubmitMake();
    else if (isMultiplyMode) handleSubmitMultiply();
    else handleSubmitCountOrBuild();
  };

  const toggleCell = (key: string) => {
    if (challengeDone || learnerBlocked()) return;
    SoundManager.tap();
    setCells((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ── Can submit? ────────────────────────────────────────────────
  const canSubmit = (() => {
    if (challengeDone) return false;
    if (isMakeMode) return cells.length > 0;
    if (isMultiplyMode) return rowsAnswer !== '' && columnsAnswer !== '' && totalAnswer !== '';
    return arrayBuilt && totalAnswer !== '';
  })();

  // ── What the tutor and the observer are shown, republished every render ──
  // The levers draw on the array, so on build they come once the learner has picked its rows and columns.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const ctx: ArrayLeverContext = { labelsShown: showLabels, arrayShown: isPreBuilt || (currentRows > 0 && currentColumns > 0) };
    const scene = workspaceScene(currentChallenge, view);
    const levers = practice ? [] : ARRAY_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : ARRAY_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : ARRAY_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
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
          const easier = ARRAY_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          setLeverState(pulled); resetItem(easier); setPractice(easier);
          return { practice: arrayGridBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetItem(sessionChallenge); setPractice(null); },
    };
  });

  // ── Open build (make_array): the grid, the live line ──
  const gridRef = useRef<SVGSVGElement | null>(null);
  const buildOpen = isMakeMode && !challengeDone && !learnerBlocked();
  // The live line (shared build layer): what the grid looks like so far, NEVER a number — counting is the task.
  const buildSeeing = useBuildWatcher({
    buildKey: cells.join('|'),
    enabled: buildOpen && cells.length > 0,
    svg: gridRef,
    request: {
      task: makeAsk,
      sceneNote: 'A dark grid of empty cells. The learner taps a cell to fill it with a green square.',
      numbers: 'never',
    },
  });

  // ── Icon renderer ──────────────────────────────────────────────
  const renderIcon = () => {
    const baseClass = 'fill-blue-400/80';
    switch (iconType) {
      case 'dot':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );
      case 'square':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" className={baseClass} />
          </svg>
        );
      case 'star':
      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              className={baseClass}
            />
          </svg>
        );
    }
  };

  // Displayed rows/columns for the grid
  const displayRows = isPreBuilt ? targetRows : currentRows;
  const displayColumns = isPreBuilt ? targetColumns : currentColumns;
  const stripsOn = leverOn(ROW_STRIPS_LEVER);

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No array grid challenges available.
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
          overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score}
          durationMs={elapsedMs}
          heading="Array Session Complete"
          celebrationMessage={
            results.every((r) => r.correct)
              ? 'Perfect! You solved every array.'
              : 'Great work — keep practicing arrays!'
          }
        />
      </div>
    );
  }

  const grid = gridFor(makeTotal);
  const typingBlocked = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!learnerBlocked()) set(e.target.value);
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 6v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Array Builder</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <LuminaBadge accent="emerald" className="text-xs font-mono uppercase tracking-wider">
              {isMakeMode ? 'Make an Array' : isMultiplyMode ? 'Multiply' : isPreBuilt ? 'Count' : 'Build & Multiply'}
            </LuminaBadge>
            {practice && <LuminaBadge accent="amber" className="text-xs font-mono uppercase tracking-wider">Practice</LuminaBadge>}
          </div>
        </div>
      </div>

      <LuminaCard className="relative overflow-hidden shadow-2xl">
        <div
          className="absolute inset-0 opacity-10 rounded-3xl"
          style={{
            backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        ></div>

        <LuminaCardHeader className="relative z-10 text-center">
          <LuminaCardTitle>{title}</LuminaCardTitle>
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
                        ? 'bg-green-500/20 text-green-200 border-green-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Array {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* Strategy hint (support tier: shown at easy, withdrawn at medium/hard) */}
          {strategyHint && !challengeDone && (
            <div className="mb-6 mx-auto max-w-2xl flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm">
              <span aria-hidden>💡</span>
              <span>{strategyHint}</span>
            </div>
          )}

          {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the array and its answer
              inputs as one region. */}
          <PipDock />
          <PipWorkspace>
          {/* Open build (make_array): the ask, an empty grid, the first array beside it on a two-ways item. */}
          {isMakeMode && currentChallenge && (
            <div className="mb-6 space-y-3">
              <h4 className="text-lg font-semibold text-green-300 text-center">{makeAsk}</h4>
              <p className="text-slate-500 text-xs text-center">Tap a cell to put a square in. Tap a square to take it out.</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <ArrayBuildGrid ref={gridRef} rows={grid.rows} columns={grid.columns} cells={cells}
                  rowCounts={leverOn(ROW_COUNTS_LEVER)} disabled={!buildOpen} onToggle={toggleCell} />
                {firstWay && <FirstArray rows={firstWay.rows} columns={firstWay.columns} />}
              </div>
              <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
              </div>
              {leverOn(SQUARE_COUNT_LEVER) && (
                <p className="text-center text-sm text-slate-300" data-lever="square-count">
                  Squares on your grid: <span className="text-orange-300 font-bold text-lg">{cells.length}</span>
                </p>
              )}
            </div>
          )}

          {/* Step 1: Build (build_array mode only) */}
          {!isPreBuilt && !isMakeMode && !challengeDone && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-green-300 mb-4 text-center">
                Step 1: Build an array with {targetRows} rows and {targetColumns} columns
              </h4>

              <div className="flex flex-col items-center gap-6">
                {/* Row Controls */}
                <div className="flex items-center gap-4">
                  <span className="text-green-300 font-semibold w-24 text-right">Rows:</span>
                  <div className="flex gap-2 flex-wrap max-w-2xl">
                    {Array.from({ length: rowButtonCount }, (_, i) => i + 1).map((num) => (
                      <button
                        key={`row-${num}`}
                        onClick={() => handleRowChange(num)}
                        disabled={challengeDone}
                        aria-label={`Rows: ${num}`}
                        className={`w-10 h-10 rounded-lg font-bold transition-all ${
                          currentRows === num
                            ? 'bg-green-500 text-white scale-110 shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column Controls */}
                <div className="flex items-center gap-4">
                  <span className="text-blue-300 font-semibold w-24 text-right">Columns:</span>
                  <div className="flex gap-2 flex-wrap max-w-2xl">
                    {Array.from({ length: colButtonCount }, (_, i) => i + 1).map((num) => (
                      <button
                        key={`col-${num}`}
                        onClick={() => handleColumnChange(num)}
                        disabled={challengeDone}
                        aria-label={`Columns: ${num}`}
                        className={`w-10 h-10 rounded-lg font-bold transition-all ${
                          currentColumns === num
                            ? 'bg-blue-500 text-white scale-110 shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Array Grid */}
          {!isMakeMode && displayRows > 0 && displayColumns > 0 && (
            <div className="flex justify-center items-center mb-8">
              <div className="relative inline-block">
                {/* Column Labels */}
                {labelsShown && (
                  <div className="flex mb-2" data-axis-labels="columns" style={{ marginLeft: '40px' }}>
                    {Array.from({ length: displayColumns }).map((_, index) => (
                      <div
                        key={`col-label-${index}`}
                        className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm w-16"
                      >
                        {index + 1}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex">
                  {/* Row Labels */}
                  {labelsShown && (
                    <div className="flex flex-col mr-2" data-axis-labels="rows">
                      {Array.from({ length: displayRows }).map((_, index) => (
                        <div
                          key={`row-label-${index}`}
                          className="flex items-center justify-center text-green-300 font-mono font-bold text-sm h-16 w-10"
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grid: one flex row per array row, so the row_strips lever can outline each row (a ring, no layout shift). */}
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: displayRows }).map((_, rowIndex) => (
                      <div
                        key={`row-${rowIndex}`}
                        data-lever={stripsOn ? 'row-strip' : undefined}
                        className={`flex gap-2 rounded-xl ${stripsOn
                          ? rowIndex % 2 === 0 ? 'ring-2 ring-amber-400/70 bg-amber-400/10' : 'ring-2 ring-sky-400/70 bg-sky-400/10'
                          : ''}`}
                      >
                        {Array.from({ length: displayColumns }).map((_, colIndex) => (
                          <div
                            key={cellKey(rowIndex, colIndex)}
                            className="w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-200 border-2 bg-slate-800/30 border-slate-600"
                          >
                            {renderIcon()}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Section — varies by challenge type */}

          {/* count_array */}
          {sessionChallengeType === 'count_array' && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                How many {iconType}s in total?
              </h4>
              <div className="flex justify-center items-center gap-4">
                <label className="text-slate-300 font-semibold">Total:</label>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label="Total"
                  value={totalAnswer}
                  onChange={typingBlocked(setTotalAnswer)}
                  placeholder="?"
                  className="w-32 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
                <span className="text-slate-300">{iconType}s</span>
              </div>
            </div>
          )}

          {/* multiply_array */}
          {isMultiplyMode && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                Write the multiplication sentence
              </h4>
              <div className="flex justify-center items-center gap-3 flex-wrap">
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label="Rows"
                  value={rowsAnswer}
                  onChange={typingBlocked(setRowsAnswer)}
                  placeholder="rows"
                  className="w-24 text-center font-mono text-xl"
                />
                <span className="text-2xl text-slate-300 font-bold">×</span>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label="Columns"
                  value={columnsAnswer}
                  onChange={typingBlocked(setColumnsAnswer)}
                  placeholder="cols"
                  className="w-24 text-center font-mono text-xl"
                />
                <span className="text-2xl text-slate-300 font-bold">=</span>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label="Total"
                  value={totalAnswer}
                  onChange={typingBlocked(setTotalAnswer)}
                  placeholder="total"
                  className="w-28 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
              </div>
            </div>
          )}

          {/* build_array */}
          {sessionChallengeType === 'build_array' && arrayBuilt && !challengeDone && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                Step 2: How many {iconType}s in total?
              </h4>
              <div className="flex justify-center items-center gap-4">
                <label className="text-slate-300 font-semibold">Total:</label>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label="Total"
                  value={totalAnswer}
                  onChange={typingBlocked(setTotalAnswer)}
                  placeholder="?"
                  className="w-32 text-center font-mono text-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
                <span className="text-slate-300">{iconType}s</span>
              </div>
            </div>
          )}
          </PipWorkspace>

          {/* Feedback Display */}
          {feedback && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                feedbackType === 'success'
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : feedbackType === 'error'
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
              }`}
            >
              <p className="font-medium">{feedback}</p>
            </div>
          )}

          {/* Submit Control. The open build commits with "I'm done!" through the same check; there is no auto-check. */}
          {!challengeDone && (
            <div className="flex justify-center gap-4 mb-8">
              {isMakeMode ? (
                <>
                  <LuminaButton disabled={!buildOpen || cells.length === 0} onClick={() => { if (!learnerBlocked()) setCells([]); }}>
                    Clear the grid
                  </LuminaButton>
                  <LuminaButton tone="primary" disabled={!buildOpen || !canSubmit} onClick={handleSubmit}>
                    I&apos;m done!
                  </LuminaButton>
                </>
              ) : (
                <LuminaActionButton
                  action="check"
                  onClick={handleSubmit}
                  disabled={!canSubmit || learnerBlocked()}
                />
              )}
            </div>
          )}

          {/* Between-challenge interstitial; the runtime advances. */}
          {challengeDone && (
            <LuminaCard surface="nested" className="mt-2 border-green-500/30">
              <LuminaCardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-green-400">
                    ✓ Array {currentIndex + 1} complete!
                  </h4>
                </div>
                {isMakeMode ? (
                  <p className="text-sm text-slate-300">
                    {makeTotal} squares in equal rows.
                  </p>
                ) : (
                  <p className="text-sm text-slate-300">
                    {targetRows} × {targetColumns} ={' '}
                    <span className="font-bold text-white">{targetProduct}</span>
                  </p>
                )}
              </LuminaCardContent>
            </LuminaCard>
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const ArrayGrid = withWorkspaceOnly<ArrayGridProps>('array-grid', ArrayGridSurface, props => props.data.title);

export default ArrayGrid;
