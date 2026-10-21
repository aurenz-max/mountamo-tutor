'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatrixDisplayMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  SCALAR_LABEL, blankGrid, boxLabel, boxMarks, describeMatrixWork, formatEntry, matrixCorrect, matrixMiss,
  workComplete, workspaceScene, type MatrixWork,
} from './matrixDisplayWorkspace';
import {
  DIAGONALS_LEVER, LETTERS_LEVER, MATRIX_LEVERS, MODEL_LEVER, POSITION_LEVER, ROW_BANDS_LEVER, ROW_COLUMN_LEVER, SIGNS_LEVER,
  TERMS_LEVER, isPracticeMatrix, matrixModel, positionRecipe, termList, type MatrixModel,
} from './matrixDisplayLevers';
import { matrixDisplayBoss } from './matrixDisplay.boss';

// ============================================================================
// Data Types — re-exported from the generator's canonical interface
// ============================================================================

export type MatrixChallengeType =
  | 'transpose'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'determinant'
  | 'inverse';

export interface MatrixDisplayChallenge {
  id: string;
  challengeType: MatrixChallengeType;
  instruction: string;
  rows: number;
  columns: number;
  values: number[][];
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label?: string;
  };
  expectedScalar?: number;
  expectedMatrix?: number[][];
  hint: string;
  /** Support tier (modality #4): the generator's hard-tier flag (the old scripted "Show steps" gate). */
  stepsAfterAttempt?: boolean;
  /** The lesson's support tier, stamped on each challenge: when the tutor's model lever comes. */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  challenges: MatrixDisplayChallenge[];
  challengeType: MatrixChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'algebra2' | 'precalculus' | 'advanced';
  /** Within-mode support tier when present (also stamped on each challenge). */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MatrixDisplayMetrics>) => void;
}

// ============================================================================
// Phase config (one row per challenge type)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  transpose:   { label: 'Transpose',   icon: '🔄', accentColor: 'cyan' },
  add:         { label: 'Add',         icon: '➕', accentColor: 'emerald' },
  subtract:    { label: 'Subtract',    icon: '➖', accentColor: 'amber' },
  multiply:    { label: 'Multiply',    icon: '✖️', accentColor: 'purple' },
  determinant: { label: 'Determinant', icon: '◊',  accentColor: 'pink' },
  inverse:     { label: 'Inverse',     icon: '⁻¹', accentColor: 'blue' },
};

// ============================================================================
// Helpers
// ============================================================================

const formatNumber = formatEntry;

/** §6a #11 standard per-challenge score formula. */
function phaseScore(attempts: number): number {
  return Math.max(20, 100 - (Math.max(0, attempts - 1) * 20));
}

/** Colour bands for the `row_bands` lever: row r of the matrix and column r of the answer grid. */
const BANDS = ['bg-cyan-500/20 border-cyan-400/60', 'bg-amber-500/20 border-amber-400/60',
  'bg-fuchsia-500/20 border-fuchsia-400/60', 'bg-lime-500/20 border-lime-400/60', 'bg-sky-500/20 border-sky-400/60'];
const LIT = 'ring-2 ring-cyan-300 bg-cyan-500/20';
const GREEN = 'bg-emerald-500/25 border-emerald-400/70';
const RED = 'bg-rose-500/25 border-rose-400/70';
const LETTERS = [['a', 'b'], ['c', 'd']];
const SIGNS = ['+', '−', '+'];

// ============================================================================
// Matrix Renderer (read-only display of a number matrix)
// ============================================================================

interface MatrixRendererProps {
  values: number[][];
  label?: string;
  accent?: 'purple' | 'blue' | 'emerald';
  /** Optional per-cell mask. Cells where revealMask[ri][ci] is false render a "?" placeholder instead of the value. Default: all cells revealed. */
  revealMask?: boolean[][];
  /** Lever marks: a cell's tint, whether it is lit, and a small corner mark (a letter or a sign). */
  tint?: (ri: number, ci: number) => string | undefined;
  lit?: (ri: number, ci: number) => boolean;
  corner?: (ri: number, ci: number) => string | undefined;
}

const MatrixRenderer: React.FC<MatrixRendererProps> = ({ values, label, accent = 'purple', revealMask, tint, lit, corner }) => {
  const rows = values.length;
  const accentColor = accent === 'blue' ? '#60a5fa' : accent === 'emerald' ? '#34d399' : '#a78bfa';

  return (
    <div className="flex flex-col items-center">
      {label && (
        <div className="text-xs font-mono text-slate-400 mb-2 font-semibold">{label}</div>
      )}
      <div className="relative inline-flex items-center">
        <div
          className="font-thin leading-none select-none"
          style={{ fontSize: `${rows * 2.2}rem`, color: accentColor }}
        >
          [
        </div>
        <div className="mx-2 py-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values[0]?.length ?? 0}, minmax(0, 1fr))` }}>
            {values.flatMap((row, ri) =>
              row.map((v, ci) => {
                const revealed = revealMask ? revealMask[ri]?.[ci] !== false : true;
                const mark = corner?.(ri, ci);
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={`relative w-14 h-12 flex items-center justify-center text-base font-mono rounded-lg border font-semibold ${
                      tint?.(ri, ci) ?? (revealed
                        ? 'bg-slate-900/40 border-slate-700/40'
                        : 'bg-slate-900/20 border-slate-700/30')
                    } ${revealed ? 'text-white' : 'text-slate-600'} ${lit?.(ri, ci) ? LIT : ''}`}
                  >
                    {mark && <span className="absolute top-0.5 left-1 text-[10px] font-sans text-cyan-200">{mark}</span>}
                    {revealed ? formatNumber(v) : '?'}
                  </div>
                );
              }),
            )}
          </div>
        </div>
        <div
          className="font-thin leading-none select-none"
          style={{ fontSize: `${rows * 2.2}rem`, color: accentColor }}
        >
          ]
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Matrix Input (editable result matrix)
// ============================================================================

interface MatrixInputProps {
  rows: number;
  columns: number;
  values: string[][];
  onChange: (row: number, col: number, value: string) => void;
  onFocusCell?: (row: number, col: number) => void;
  disabled?: boolean;
  highlightCorrect?: boolean[][];   // per-cell correctness for post-submit feedback
  tint?: (ri: number, ci: number) => string | undefined;
  outline?: [number, number] | null;
}

const MatrixInput: React.FC<MatrixInputProps> = ({ rows, columns, values, onChange, onFocusCell, disabled, highlightCorrect, tint, outline }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-mono text-emerald-300 mb-2 font-semibold">Your Answer</div>
      <div className="relative inline-flex items-center">
        <div className="font-thin leading-none select-none text-emerald-400" style={{ fontSize: `${rows * 2.2}rem` }}>
          [
        </div>
        <div className="mx-2 py-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows }).flatMap((_, ri) =>
              Array.from({ length: columns }).map((_, ci) => {
                const correct = highlightCorrect?.[ri]?.[ci];
                const borderClass =
                  correct === true ? 'border-emerald-400' :
                  correct === false ? 'border-rose-400' :
                  'border-slate-600/60 focus:border-emerald-400';
                const outlined = outline && outline[0] === ri && outline[1] === ci;
                return (
                  <input
                    key={`${ri}-${ci}`}
                    type="text"
                    inputMode="numeric"
                    aria-label={boxLabel(ri, ci)}
                    value={values[ri]?.[ci] ?? ''}
                    onChange={(e) => onChange(ri, ci, e.target.value)}
                    onFocus={() => onFocusCell?.(ri, ci)}
                    disabled={disabled}
                    className={`w-14 h-12 text-center text-base font-mono rounded-lg border-2 ${tint?.(ri, ci) ?? 'bg-slate-800/60'} ${borderClass} ${outlined ? LIT : ''} focus:ring-2 focus:ring-emerald-500/30 text-white outline-none font-semibold disabled:opacity-70`}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="font-thin leading-none select-none text-emerald-400" style={{ fontSize: `${rows * 2.2}rem` }}>
          ]
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Lever pictures (workspace path, `matrixDisplayLevers.ts`)
// ============================================================================

const ModelCard: React.FC<{ model: MatrixModel }> = ({ model }) => {
  const row = (ns: Array<number | string>) => `[ ${ns.map(n => (typeof n === 'number' ? formatNumber(n) : n)).join('   ')} ]`;
  return (
    <figure data-lever="model-example" className="mx-auto max-w-sm rounded-lg border border-white/10 bg-slate-900/40 p-3 text-center font-mono text-sm text-slate-200 space-y-1">
      {model.kind === 'transpose' && (
        <>
          <div>{model.from.map(r => row(r)).join('  ')}  →  {model.to.map(r => row(r)).join('  ')}</div>
          <figcaption className="font-sans text-[11px] text-slate-400">Another matrix: its first row of letters becomes the first column, its second row the second column.</figcaption>
        </>
      )}
      {model.kind === 'entrywise' && (
        <>
          <div>{row(model.a)} {model.op} {row(model.b)} = {row(model.r)}</div>
          <figcaption className="font-sans text-[11px] text-slate-400">Another example: each entry {model.op === '+' ? 'plus' : 'minus'} the entry in the same spot.</figcaption>
        </>
      )}
      {model.kind === 'dot' && (
        <>
          <div>{row(model.row)} · {row(model.col)} = {formatNumber(model.row[0])}×{formatNumber(model.col[0])} + {formatNumber(model.row[1])}×{formatNumber(model.col[1])}</div>
          <div>= {formatNumber(model.products[0])} + {formatNumber(model.products[1])} = {formatNumber(model.sum)}</div>
          <figcaption className="font-sans text-[11px] text-slate-400">Another example: a row times a column. Multiply matching entries, then add.</figcaption>
        </>
      )}
      {model.kind === 'det' && (
        <>
          <div>det {row(model.m[0])} {row(model.m[1])} = {formatNumber(model.m[0][0])}×{formatNumber(model.m[1][1])} − {formatNumber(model.m[0][1])}×{formatNumber(model.m[1][0])}</div>
          <div>= {formatNumber(model.ad)} − {formatNumber(model.bc)} = {formatNumber(model.det)}</div>
          <figcaption className="font-sans text-[11px] text-slate-400">Another matrix: the main diagonal's product minus the other diagonal's.</figcaption>
        </>
      )}
      {model.kind === 'inverse' && (
        <>
          <div>{row(model.m[0])} {row(model.m[1])}  →  {row(model.inv[0])} {row(model.inv[1])}</div>
          <figcaption className="font-sans text-[11px] text-slate-400">Another matrix with determinant one: swap the diagonal, change the signs of the other two, divide by the determinant.</figcaption>
        </>
      )}
    </figure>
  );
};

// ============================================================================
// Component
// ============================================================================

interface MatrixDisplayProps {
  data: MatrixDisplayData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const NO_LEVERS: string[] = [];
const useMatrixProgress = useWorkspaceProgressFor('matrix-display');
const PRACTICE_NOTE = 'An easier practice problem is on screen in place of the item. It is not graded; the full item comes back after it.';

const MatrixDisplaySurface = ({ data, className, runtimePlanItemId }: MatrixDisplayProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges,
    challengeType: sessionChallengeType,
    educationalContext,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ──────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `matrix-display-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<MatrixDisplayMetrics>({
    primitiveType: 'matrix-display',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Challenge progression: the teaching workspace owns it. ──
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useMatrixProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: matrixDisplayBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`MATRIX_LEVERS`), keyed by the session item they were pulled on, and the easier problem a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MatrixDisplayChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : NO_LEVERS;
  /** A runtime pull on the session item; never drawn on a practice problem. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-challenge state ─────────────────────────────────────────
  const [scalarInput, setScalarInput] = useState<string>('');
  const [matrixInput, setMatrixInput] = useState<string[][]>(() => (challenges[0] ? blankGrid(challenges[0]) : []));
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [cellCorrectness, setCellCorrectness] = useState<boolean[][] | undefined>(undefined);
  /** The answer box being worked (the tracking levers follow it). */
  const [activeCell, setActiveCell] = useState<[number, number]>([0, 0]);

  const recordedRef = useRef(false);
  const submittedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  /**
   * A fresh item: every box empty. Try again: the boxes the check marked wrong are emptied and the right ones kept; the
   * determinant box is emptied.
   */
  const resetWork = (ch: MatrixDisplayChallenge | null, retry: boolean) => {
    setScalarInput('');
    if (retry && ch && cellCorrectness) {
      setMatrixInput(prev => blankGrid(ch).map((row, i) => row.map((_, j) => (cellCorrectness[i]?.[j] ? prev[i]?.[j] ?? '' : ''))));
    } else {
      setMatrixInput(ch ? blankGrid(ch) : []);
      setActiveCell([0, 0]);
    }
    setFeedback(null);
    setCellCorrectness(undefined);
    recordedRef.current = false;
  };
  openItem.current = (index, retry) => {
    // Try again on a practice problem keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) { resetWork(practice ?? challenges[index] ?? null, true); return; }
    setPractice(null);
    resetWork(challenges[index] ?? null, false);
  };

  // ── Aggregate score (live preview) ──────────────────────────────
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const sum = challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
    return Math.round(sum / challengeResults.length);
  }, [challengeResults]);

  // ── Phase results for the summary panel ─────────────────────────
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => {
      if (rs.length === 0) return 0;
      const sum = rs.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
      return Math.round(sum / rs.length);
    },
  });

  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<MatrixDisplayMetrics> | null>(null);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (progress.recordsEvaluation === false || hasSubmitted || submittedRef.current || challenges.length === 0) return;
    submittedRef.current = true;
    const metrics: MatrixDisplayMetrics = {
      type: 'matrix-display',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    setSubmittedResult(submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence));
  };

  // ── Handle matrix-input cell change ─────────────────────────────
  const handleMatrixInputChange = useCallback((row: number, col: number, value: string) => {
    if (workspaceClosed.current) return;
    setMatrixInput((prev) => {
      const next = prev.map((r) => [...r]);
      if (!next[row]) next[row] = [];
      next[row][col] = value;
      return next;
    });
  }, []);

  // ── Check answer. Every check commits (right or wrong); a box that is not a number is not a check. ──
  const handleCheck = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    if (recordedRef.current) return;          // stale-state guard
    if (feedback?.correct) return;

    const work: MatrixWork = { scalar: scalarInput, cells: matrixInput };
    if (!workComplete(currentChallenge, work)) {
      SoundManager.invalid();
      setFeedback({ correct: false, message: 'Type a number in every box first.' });
      return;
    }
    const attempts = currentAttempts + 1;
    const correct = matrixCorrect(currentChallenge, work);
    setCellCorrectness(boxMarks(currentChallenge, work));
    // The checked gesture (counts the attempt, records the verdict), then this primitive's own fields.
    progress.commitCheck(describeMatrixWork(currentChallenge, work), correct, matrixMiss(currentChallenge, work));

    if (correct) {
      SoundManager.playCorrect();
      const score = phaseScore(attempts);
      const practiceItem = isPracticeMatrix(currentChallenge);
      setFeedback({ correct: true, message: practiceItem ? 'Correct!' : `Correct! +${score} points` });
      // An easier practice problem (a simplify lever) is not the session's challenge: it records nothing of its own.
      if (!practiceItem) {
        recordedRef.current = true;
        mergeResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts,
          score,
          challengeType: currentChallenge.challengeType,
        });
      }
    } else {
      SoundManager.playIncorrect();
      setFeedback({ correct: false, message: 'Not quite — check each entry and try again.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, feedback, scalarInput, matrixInput, mergeResult, progress.commitCheck]);

  const model = useMemo(() => (sessionChallenge ? matrixModel(sessionChallenge) : null), [sessionChallenge]);

  // ── What the tutor and the observer are shown, republished every render. ──
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const ctx = { active: activeCell };
    const scene = workspaceScene(currentChallenge, { scalar: scalarInput, cells: matrixInput, marks: cellCorrectness });
    const levers = practice ? [] : MATRIX_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : MATRIX_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : MATRIX_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
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
          const easier = MATRIX_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(easier, false);
          return { practice: matrixDisplayBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(sessionChallenge, false); },
    };
  });

  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400">No matrix challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const canSubmit = currentChallenge?.expectedScalar !== undefined
    ? scalarInput.trim().length > 0
    : (currentChallenge?.expectedMatrix?.every((row, i) => row.every((_, j) => (matrixInput[i]?.[j] ?? '').trim().length > 0)) ?? false);
  /** Input closed once the item is solved, and while a checked answer waits for Try again. */
  const inputClosed = !!feedback?.correct || blocked;

  // Lever marks on the session item.
  const ch = currentChallenge;
  const [ar, ac] = activeCell;
  const bands = leverOn(ROW_BANDS_LEVER);
  const position = leverOn(POSITION_LEVER);
  const rowColumn = leverOn(ROW_COLUMN_LEVER);
  const diagonals = leverOn(DIAGONALS_LEVER);
  const signs = leverOn(SIGNS_LEVER);
  const letters = leverOn(LETTERS_LEVER);
  const tintA = bands ? (ri: number) => BANDS[ri % BANDS.length]
    : diagonals ? (ri: number, ci: number) => (ri === ci ? GREEN : ri + ci === 1 ? RED : undefined) : undefined;
  const litA = position ? (ri: number, ci: number) => ri === ar && ci === ac : rowColumn ? (ri: number) => ri === ar : undefined;
  const litB = position ? (ri: number, ci: number) => ri === ar && ci === ac
    : rowColumn ? (_ri: number, ci: number) => ci === ac : undefined;
  const cornerA = signs ? (ri: number, ci: number) => (ri === 0 ? SIGNS[ci] : undefined)
    : letters ? (ri: number, ci: number) => LETTERS[ri]?.[ci] : undefined;
  const tintAnswer = bands ? (_ri: number, ci: number) => BANDS[ci % BANDS.length] : undefined;
  const outline = position || rowColumn ? activeCell : null;
  const focusCell = (r: number, c: number) => { if (!workspaceClosed.current) setActiveCell([r, c]); };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge>
            {Math.min(currentIndex + 1, challenges.length)} / {challenges.length}
          </LuminaBadge>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Summary panel (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="Matrix Session Complete!"
            celebrationMessage="You worked through every problem!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && ch && (
          <>
            {/* Instruction */}
            <LuminaPanel>
              <div className="flex items-center gap-2">
                {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
                <p className="text-slate-100 text-sm font-medium">{ch.instruction}</p>
              </div>
            </LuminaPanel>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the matrices and the answer
                as one region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {/* Source matrices */}
              <LuminaPanel className="flex flex-wrap items-center justify-center gap-6">
                <MatrixRenderer
                  values={ch.values}
                  label={ch.secondMatrix ? 'Matrix A' : 'Matrix'}
                  accent="purple"
                  tint={tintA}
                  lit={litA}
                  corner={cornerA}
                />
                {ch.secondMatrix && (
                  <>
                    <div className="text-3xl text-slate-400 font-bold">
                      {ch.challengeType === 'add' ? '+' :
                       ch.challengeType === 'subtract' ? '−' :
                       ch.challengeType === 'multiply' ? '×' : ''}
                    </div>
                    <MatrixRenderer
                      values={ch.secondMatrix.values}
                      label={ch.secondMatrix.label ?? 'Matrix B'}
                      accent="blue"
                      lit={litB}
                    />
                  </>
                )}
                <div className="text-3xl text-slate-400 font-bold">=</div>

                {/* Student input */}
                {ch.expectedScalar !== undefined ? (
                  <div className="flex flex-col items-center">
                    <div className="text-xs font-mono text-emerald-300 mb-2 font-semibold">Your Answer</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={SCALAR_LABEL}
                      value={scalarInput}
                      onChange={(e) => { if (!learnerBlocked()) setScalarInput(e.target.value); }}
                      disabled={inputClosed}
                      placeholder="det = ?"
                      className="w-32 h-14 text-center text-lg font-mono rounded-lg bg-slate-800/60 border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 text-white outline-none font-semibold disabled:opacity-70"
                    />
                  </div>
                ) : ch.expectedMatrix ? (
                  <MatrixInput
                    rows={ch.expectedMatrix.length}
                    columns={ch.expectedMatrix[0]?.length ?? 0}
                    values={matrixInput}
                    onChange={handleMatrixInputChange}
                    onFocusCell={focusCell}
                    disabled={inputClosed}
                    highlightCorrect={cellCorrectness}
                    tint={tintAnswer}
                    outline={outline}
                  />
                ) : null}
              </LuminaPanel>

              {/* Lever pictures (`matrixDisplayLevers.ts`), on the session item only. */}
              {!practice && !feedback?.correct && (
                <>
                  {diagonals && (
                    <p data-lever="diagonal-marks" className="text-center text-xs text-slate-300">
                      <span className="text-emerald-300">green product</span> − <span className="text-rose-300">red product</span>
                    </p>
                  )}
                  {signs && (
                    <p data-lever="cofactor-signs" className="text-center text-xs text-slate-300">
                      Expand along the top row: each top entry times the small determinant left when its row and column are covered, with the signs + − +.
                    </p>
                  )}
                  {letters && (
                    <figure data-lever="swap-negate-letters" className="text-center font-mono text-sm text-cyan-200">
                      <div>A⁻¹ = [ d   −b ]  [ −c   a ]  ÷ (ad − bc)</div>
                      <figcaption className="font-sans text-[11px] text-slate-400">Swap a and d, change the signs of b and c, divide every entry by ad − bc.</figcaption>
                    </figure>
                  )}
                  {position && (ch.challengeType === 'add' || ch.challengeType === 'subtract') && (
                    <p data-lever="position-recipe" className="text-center font-mono text-sm text-cyan-200">
                      This box = {positionRecipe(ar, ac, ch.challengeType === 'add' ? '+' : '−')}
                    </p>
                  )}
                  {leverOn(TERMS_LEVER) && ch.secondMatrix && (
                    <p data-lever="term-list" className="text-center font-mono text-sm text-cyan-200">
                      This box = {termList(ar, ac, ch.values[0]?.length ?? 0)}
                    </p>
                  )}
                  {leverOn(MODEL_LEVER) && model && <ModelCard model={model} />}
                </>
              )}
            </PipWorkspace>

            {/* Feedback */}
            {feedback && (
              <div className={`p-3 rounded-lg border text-sm ${
                feedback.correct
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Rule line (challenge-specific). Withdrawn at the hard support tier (the generator emits an empty hint),
                so render only when present. It states the rule, never a value. */}
            {ch.hint && (
              <div className="text-xs text-slate-400 italic">{ch.hint}</div>
            )}

            {/* Check; the runtime retries and advances. */}
            {!feedback?.correct && (
              <div className="flex flex-wrap items-center gap-2">
                <LuminaActionButton action="check" onClick={handleCheck} disabled={!canSubmit || blocked} />
              </div>
            )}
          </>
        )}

        {/* Educational context (session-level) */}
        {educationalContext && !allChallengesComplete && (
          <LuminaPanel accent="purple">
            <p className="text-xs text-slate-300 leading-relaxed">{educationalContext}</p>
          </LuminaPanel>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const MatrixDisplay = withWorkspaceOnly<MatrixDisplayProps>('matrix-display', MatrixDisplaySurface, props => props.data.title);

export default MatrixDisplay;
