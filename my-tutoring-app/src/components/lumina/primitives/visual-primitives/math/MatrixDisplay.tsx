'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatrixDisplayMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  SCALAR_LABEL, blankGrid, boxLabel, boxMarks, describeMatrixWork, formatEntry, matrixCorrect, matrixMiss,
  workComplete, workspaceAssignment, workspaceScene, type MatrixWork,
} from './matrixDisplayWorkspace';
import {
  DIAGONALS_LEVER, LETTERS_LEVER, MODEL_LEVER, POSITION_LEVER, ROW_BANDS_LEVER, ROW_COLUMN_LEVER, SIGNS_LEVER, TERMS_LEVER,
  isPracticeMatrix, leverFacts, matrixLevers, matrixModel, positionRecipe, simplerMatrix, termList, type MatrixModel,
} from './matrixDisplayLevers';

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
  /** Support tier (modality #4): when true, "Show steps" is withheld until the student
   *  has made at least one attempt. Undefined/false = available up front. */
  stepsAfterAttempt?: boolean;
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  challenges: MatrixDisplayChallenge[];
  challengeType: MatrixChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'algebra2' | 'precalculus' | 'advanced';
  /** Within-mode support tier when present (surfaced for a future live tutor). */
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

/**
 * Tier-aware reveal policy for the AI tutor (scripted path). Tells the tutor how much of the
 * method it may surface and — crucially — what it must never state outright, so
 * the scaffold never leaks the answer the student is computing. Keyed on the
 * operation because the "never say X" line differs per challenge type.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  mode: MatrixChallengeType,
): string {
  if (!tier) return '';
  const never =
    mode === 'determinant'
      ? 'Never state the determinant value for the student.'
      : 'Never state the result-matrix entries for the student.';
  const method =
    mode === 'determinant'
      ? 'for a 2×2 [[a,b],[c,d]], det = ad − bc'
      : mode === 'inverse'
        ? 'A⁻¹ = (1/det) · [[d, −b], [−c, a]] — swap the diagonal, negate the off-diagonal, divide by det'
        : mode === 'multiply'
          ? 'each result entry is a row of A dotted with a column of B (multiply matching entries, then sum)'
          : mode === 'transpose'
            ? 'row i of A becomes column i of Aᵀ'
            : 'add or subtract matching entries position by position';
  switch (tier) {
    case 'easy':
      return `SUPPORT TIER easy: maximum scaffolding. You may name the method (${method}) and walk the setup one entry at a time. ${never}`;
    case 'medium':
      return `SUPPORT TIER medium: nudge the next entry and let the student do the arithmetic. ${never}`;
    default:
      return `SUPPORT TIER hard: the on-screen hint and up-front "Show steps" are withdrawn. Ask the student to recall the rule and map one entry themselves; do not supply the withheld method outright. ${never}`;
  }
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
// Steps Reveal — one worked entry per operation (scripted path). It never fills in the
// whole answer: the rest of the result stays masked, and a determinant stops before its value.
// ============================================================================

const StepsReveal: React.FC<{ challenge: MatrixDisplayChallenge }> = ({ challenge }) => {
  const { challengeType, values, secondMatrix, expectedMatrix } = challenge;
  const onlyCell = (m: number[][], r: number, c: number) => m.map((row, ri) => row.map((_, ci) => ri === r && ci === c));

  if (challengeType === 'determinant' && values.length === 2) {
    const a = values[0][0], b = values[0][1], c = values[1][0], d = values[1][1];
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono text-slate-200">det = ad − bc</div>
        <div className="font-mono text-slate-300">= ({a})({d}) − ({b})({c})</div>
        <div className="text-xs text-slate-400">Multiply each pair, then subtract the second product from the first.</div>
      </div>
    );
  }

  if (challengeType === 'determinant' && values.length === 3) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">det = a₁₁(a₂₂a₃₃ − a₂₃a₃₂) − a₁₂(a₂₁a₃₃ − a₂₃a₃₁) + a₁₃(a₂₁a₃₂ − a₂₂a₃₁)</div>
        <div className="text-xs text-slate-400">Work each bracket, multiply by the top-row entry in front of it, then combine with the signs + − +.</div>
      </div>
    );
  }

  if (challengeType === 'transpose' && expectedMatrix && values.length > 1) {
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div>Each entry at A[i][j] moves to position Aᵀ[j][i].</div>
        <div className="font-mono text-slate-300">Worked example: Aᵀ[0][1] = A[1][0] = {formatNumber(values[1][0])}</div>
        <MatrixRenderer values={expectedMatrix} label="Aᵀ" accent="emerald" revealMask={onlyCell(expectedMatrix, 0, 1)} />
      </div>
    );
  }

  if ((challengeType === 'add' || challengeType === 'subtract') && expectedMatrix && secondMatrix) {
    const sym = challengeType === 'add' ? '+' : '−';
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">result[i][j] = A[i][j] {sym} B[i][j]</div>
        <div className="font-mono text-slate-300">
          Worked example: result[0][0] = ({values[0][0]}) {sym} ({secondMatrix.values[0][0]}) = {formatNumber(expectedMatrix[0][0])}
        </div>
        <MatrixRenderer values={expectedMatrix} label="Result" accent="emerald" revealMask={onlyCell(expectedMatrix, 0, 0)} />
      </div>
    );
  }

  if (challengeType === 'multiply' && expectedMatrix && secondMatrix) {
    // Walk through result[0][0] as the worked example so students see the dot product
    // mechanic (row 0 of A · column 0 of B) before generalizing to the rest. Mask the
    // remaining cells of the Result matrix so the walkthrough doesn't give away the
    // answers the student still has to compute.
    const aRow0 = values[0];
    const bCol0 = secondMatrix.values.map((row) => row[0]);
    const products = aRow0.map((a, k) => a * bCol0[k]);
    const r00 = expectedMatrix[0][0];
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono text-slate-200">result[i][j] = Σ A[i][k] × B[k][j]</div>
        <div className="pt-1 text-xs uppercase tracking-wider text-slate-400">Worked example: result[0][0]</div>
        <div className="font-mono text-slate-300">
          = {aRow0.map((_, k) => `A[0][${k}] × B[${k}][0]`).join(' + ')}
        </div>
        <div className="font-mono text-slate-300">
          = {aRow0.map((a, k) => `(${a})(${bCol0[k]})`).join(' + ')}
        </div>
        <div className="font-mono text-slate-300">
          = {products.join(' + ')}
        </div>
        <div className="font-mono text-emerald-300 font-bold">= {r00}</div>
        <div className="pt-1 text-xs text-slate-400">Repeat for each row of A and column of B to fill the rest.</div>
        <MatrixRenderer values={expectedMatrix} label="Result" accent="emerald" revealMask={onlyCell(expectedMatrix, 0, 0)} />
      </div>
    );
  }

  if (challengeType === 'inverse' && values.length === 2) {
    const a = values[0][0], b = values[0][1], c = values[1][0], d = values[1][1];
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <div className="font-mono">A⁻¹ = (1/det) · [[d, −b], [−c, a]]</div>
        <div className="font-mono text-slate-300">det = ({a})({d}) − ({b})({c})</div>
        <div className="text-xs text-slate-400">Swap a and d, change the signs of b and c, then divide every entry by det.</div>
      </div>
    );
  }

  return null;
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

const MatrixDisplaySurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  MatrixDisplayProps & { tutorOwned: boolean; useController: (options: ProgressOptions<MatrixDisplayChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges,
    challengeType: sessionChallengeType,
    educationalContext,
    gradeBand,
    supportTier,
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
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    mergeResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`matrixDisplayLevers.ts`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place.
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
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [cellCorrectness, setCellCorrectness] = useState<boolean[][] | undefined>(undefined);
  /** The answer box being worked (the tracking levers follow it). */
  const [activeCell, setActiveCell] = useState<[number, number]>([0, 0]);

  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const submittedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  /**
   * A fresh item (both paths): every box empty. Try again (workspace): the boxes the check marked wrong are emptied and
   * the right ones kept; the determinant box is emptied.
   */
  const resetWork = (ch: MatrixDisplayChallenge | null, retry: boolean) => {
    setScalarInput('');
    if (retry && ch && cellCorrectness) {
      setMatrixInput(prev => blankGrid(ch).map((row, i) => row.map((_, j) => (cellCorrectness[i]?.[j] ? prev[i]?.[j] ?? '' : ''))));
    } else {
      setMatrixInput(ch ? blankGrid(ch) : []);
      setShowSteps(false);
      hintViewedRef.current = false;
      setActiveCell([0, 0]);
    }
    setFeedback(null);
    setCellCorrectness(undefined);
    recordedRef.current = false;
  };
  // Scripted path: a new session item (Next, or new lesson content) opens blank, as before the workspace binding.
  useEffect(() => {
    if (!tutorOwned) resetWork(sessionChallenge, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChallenge?.id]);
  openItem.current = (index, retry) => {
    // Try again on a practice problem keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) { resetWork(practice ?? challenges[index] ?? null, true); return; }
    setPractice(null);
    resetWork(challenges[index] ?? null, false);
  };

  // ── AI tutoring (scripted path) ─────────────────────────────────
  // aiPrimitiveData carries only session/progress metadata (the catalog
  // contextKeys), never per-cell matrix values — those would leak the answer
  // through the silent context update. Mode + tier are session-level, so the
  // reveal policy is resolved once. On the workspace path the tutor reads the scene instead.
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: sessionChallengeType,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    gradeBand: gradeBand ?? null,
    supportTier: supportTier ?? null,
  }), [title, sessionChallengeType, currentIndex, challenges.length, gradeBand, supportTier]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'matrix-display',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const revealPolicy = tutorRevealPolicy(supportTier, sessionChallengeType);

  // Introduce the session once the tutor connects (one end_of_turn message
  // carrying the first problem's shape, so the tutor reads a real task).
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = challenges[0];
    sendText(
      `[ACTIVITY_START] Matrix session: ${challenges.length} ${sessionChallengeType} problem(s). `
      + `Introduce the ${sessionChallengeType} operation briefly, then read the first task `
      + `(a ${first.rows}×${first.columns} matrix).`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true },
    );
  }, [tutorOwned, isConnected, challenges, sessionChallengeType, revealPolicy, sendText]);

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

  // ── Scripted path: submit the aggregate evaluation exactly once ──
  useEffect(() => {
    if (tutorOwned) return;
    if (!allChallengesComplete) return;
    if (submittedRef.current) return;
    if (hasSubmitted) return;
    submittedRef.current = true;

    const totalChallenges = challengeResults.length;
    const overallAccuracy = totalChallenges > 0
      ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / totalChallenges)
      : 0;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const hintsViewed = challengeResults.filter((r) => Boolean(r.hintViewed)).length;
    const averageAttemptsPerChallenge = totalChallenges > 0
      ? Math.round((attemptsCount / totalChallenges) * 10) / 10
      : 0;

    const metrics: MatrixDisplayMetrics = {
      type: 'matrix-display',
      challengeType: sessionChallengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    const result = submitResult(overallAccuracy >= 60, overallAccuracy, metrics);
    setSubmittedResult(result);

    sendText(
      `[ALL_COMPLETE] The student finished all ${totalChallenges} ${sessionChallengeType} matrices. `
      + `Correct: ${correctCount}/${totalChallenges}, first-try: ${firstTryCount}, accuracy: ${overallAccuracy}%. `
      + `Give a brief, encouraging, matrix-focused summary.`,
      { silent: true },
    );
  }, [tutorOwned, allChallengesComplete, challengeResults, hasSubmitted, sessionChallengeType, submitResult, sendText]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
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
    const perCellCorrect = boxMarks(currentChallenge, work);
    setCellCorrectness(perCellCorrect);
    // The checked gesture (counts the attempt, records the verdict on both paths), then this primitive's own fields.
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
          hintViewed: hintViewedRef.current,
        });
      }
      sendText(
        `[ANSWER_CORRECT] The student solved the ${currentChallenge.challengeType} matrix correctly on attempt ${attempts}. `
        + `Congratulate briefly and cue them to click "${currentIndex + 1 < challenges.length ? 'Next Matrix →' : 'Finish'}".`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: attempts === 1 || tutorOwned
          ? 'Not quite — check each entry and try again.'
          : 'Still off. Open "Show steps" for a walkthrough.',
      });
      // Describe what's off WITHOUT surfacing the correct value: for a scalar we
      // can echo the student's own wrong entry; for a matrix we report only the
      // count of incorrect cells so the hint stays scaffolding, not solving.
      const wrongDetail = currentChallenge.expectedScalar !== undefined
        ? `entered "${scalarInput.trim()}"`
        : perCellCorrect
          ? `got ${perCellCorrect.flat().filter((ok) => !ok).length} of ${perCellCorrect.flat().length} entries wrong`
          : 'has some entries off';
      sendText(
        `[ANSWER_INCORRECT] On the ${currentChallenge.challengeType} matrix the student ${wrongDetail} (attempt ${attempts}). `
        + `Point at one specific entry (or the cross-multiplication step) to recheck. Give a hint without revealing the answer.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, currentIndex, challenges.length, feedback, scalarInput, matrixInput, mergeResult,
    sendText, revealPolicy, tutorOwned, progress.commitCheck]);

  // ── Reveal hint / steps (scripted path; with the tutor, help is the tutor's) ──
  const handleShowSteps = useCallback(() => {
    SoundManager.pop();
    setShowSteps(true);
    hintViewedRef.current = true;
    if (!currentChallenge) return;
    sendText(
      `[SHOW_STEPS] The student opened the worked walkthrough for the ${currentChallenge.challengeType} matrix. `
      + `Reinforce the method in one or two sentences and invite them to finish the remaining entries themselves.`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true },
    );
  }, [currentChallenge, sendText, revealPolicy]);

  // ── Advance to next challenge (scripted path; the workspace path hides Next and the runtime advances) ──
  // Send exactly one end_of_turn message carrying the NEXT problem's shape, so
  // the tutor introduces the real problem (the auto context update is silent).
  const handleNext = useCallback(() => {
    if (!currentChallenge || tutorOwned) return;
    // If user hasn't gotten it right after multiple attempts, record as incorrect and move on.
    if (!recordedRef.current) {
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts: Math.max(1, currentAttempts),
        score: 0,
        challengeType: currentChallenge.challengeType,
        hintViewed: hintViewedRef.current,
      });
    }
    const next = challenges[currentIndex + 1];
    if (next) {
      sendText(
        `[NEXT_ITEM] Matrix ${currentIndex + 2} of ${challenges.length} (${next.challengeType}, ${next.rows}×${next.columns}). `
        + `Introduce it briefly — same operation, new numbers.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
      resetWork(next, false);
    }
    advanceProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceProgress, challenges, currentIndex, currentAttempts, currentChallenge, recordResult, sendText, revealPolicy, tutorOwned]);

  // ── Levers (workspace path) ─────────────────────────────────────
  const leverDecls = useMemo(() => matrixLevers(sessionChallenge, pulledLevers), [sessionChallenge, pulledLevers]);
  const model = useMemo(() => (sessionChallenge ? matrixModel(sessionChallenge) : null), [sessionChallenge]);

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { scalar: scalarInput, cells: matrixInput, marks: cellCorrectness });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, activeCell);
    const levers = practice ? [] : leverDecls;
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice problem is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerMatrix(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(easier, false);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(sessionChallenge, false); },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted ? null : currentChallenge?.id ?? null,
    label: 'The matrices and your answer',
    solved: challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
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
  /** Input closed once the item is solved, and on the workspace path while a checked answer waits for Try again. */
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
            overallScore={submittedResult?.score ?? localOverallScore}
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
              <p className="text-slate-100 text-sm font-medium">{ch.instruction}</p>
            </LuminaPanel>

            {/* Pip's dock sits above the workspace, which it outlines as a region. */}
            {pip.store && !allChallengesComplete && <div {...pip.dock} />}
            <div {...pip.workspace}>
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

            {/* Lever pictures, on the session item only. */}
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
            </div>

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

            {/* Hint panel (challenge-specific). Withdrawn at the hard support tier
                (generator emits an empty hint), so render only when present. It states the rule, never a value. */}
            {ch.hint && (
              <div className="text-xs text-slate-400 italic">{ch.hint}</div>
            )}

            {/* Show steps reveal (scripted path) */}
            {!tutorOwned && showSteps && (
              <LuminaPanel accent="purple">
                <div className="text-xs font-mono uppercase tracking-wider text-purple-400 mb-2">Walkthrough</div>
                <StepsReveal challenge={ch} />
              </LuminaPanel>
            )}

            {/* Controls. On the workspace path the shell's Try again / Next challenge replace Next and Skip. */}
            <div className="flex flex-wrap items-center gap-2">
              {!feedback?.correct && (
                <LuminaActionButton
                  action="check"
                  onClick={handleCheck}
                  disabled={!canSubmit || blocked}
                />
              )}
              {/* "Show steps" worked example. At the hard tier (stepsAfterAttempt) it is
                  withheld until the student has attempted at least once — recovery, not a
                  free pass. Easy/medium: available up front. */}
              {!tutorOwned && !showSteps && !feedback?.correct &&
                (!ch.stepsAfterAttempt || currentAttempts >= 1) && (
                <LuminaButton onClick={handleShowSteps}>
                  Show steps
                </LuminaButton>
              )}
              {!tutorOwned && feedback?.correct && (
                <LuminaActionButton action="next" onClick={handleNext}>
                  {currentIndex + 1 < challenges.length ? 'Next Matrix →' : 'Finish'}
                </LuminaActionButton>
              )}
              {!tutorOwned && !feedback?.correct && currentAttempts >= 3 && (
                <LuminaButton tone="subtle" onClick={handleNext}>
                  Skip →
                </LuminaButton>
              )}
            </div>
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

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const MatrixDisplay = withWorkspaceController<MatrixDisplayProps, ProgressOptions<MatrixDisplayChallenge>, Progress>(
  'matrix-display', MatrixDisplaySurface, useScriptedProgress, useWorkspaceProgressFor('matrix-display'));

export default MatrixDisplay;
