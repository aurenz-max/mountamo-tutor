'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  LuminaActionButton,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaHintDisclosure,
  LuminaInlineStat,
  LuminaInput,
  LuminaPanel,
  LuminaPrompt,
  LuminaSlider,
  accentText,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FormulaLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { evaluateFormulaExpression } from './formulaLabMath';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  EMPTY_WORK, describeFormulaWork, directionFromPosition, directionLabel, formatNumber, formulaCheck, formulaMiss,
  observedPosition, tokenizeFormula, valuesToScope, workspaceAssignment, workspaceScene, type FormulaWork,
} from './formulaLabWorkspace';
import {
  FIND_QUANTITY_LEVER, GROUP_TOKENS_LEVER, MODEL_PAIR_LEVER, NEW_INPUTS_LEVER, ORDER_CARD_LEVER, SUBSTITUTION_LEVER, TRACK_MARKS,
  TRACK_SCALE_LEVER, VALUE_CHECK_LEVER, formulaLevers, isPracticeFormula, leverFacts, modelPair, orderCard, simplerFormula,
} from './formulaLabLevers';

export type FormulaLabDirection = 'increase' | 'decrease' | 'stay-same';
export type FormulaLabSceneKind = 'motion' | 'geometry' | 'container' | 'relationship';
export type FormulaLabSupportTier = 'easy' | 'medium' | 'hard';
export type FormulaLabStrategyCue = 'visible' | 'hint' | 'none';
export type FormulaLabChallengeType =
  | 'free-explore'
  | 'predict-direction'
  | 'predict-magnitude'
  | 'construct-formula'
  | 'transfer-apply';

export interface FormulaLabVariable {
  symbol: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  accent: LuminaAccent;
}

export interface FormulaLabChallenge {
  id: string;
  type: FormulaLabChallengeType;
  changedVariableSymbol: string;
  baselineValues: number[];
  targetValues: number[];
  expectedBaselineOutput: number;
  expectedTargetOutput: number;
  correctDirection: FormulaLabDirection;
  /** Deterministic display scaffolds applied by config.difficulty. */
  showLiveOutputReadout?: boolean;
  strategyCue?: FormulaLabStrategyCue;
  groupFormulaTokens?: boolean;
  showSubstitutionSetup?: boolean;
  requireJustification?: boolean;
  supportTier?: FormulaLabSupportTier;
}

export interface FormulaLabData {
  title: string;
  description: string;
  context: string;
  transferContext: string;
  formulaLatex: string;
  /** Restricted expression: variables, finite numbers, pi, (), + - * / ^. */
  expression: string;
  outputSymbol: string;
  outputName: string;
  outputUnit: string;
  variables: FormulaLabVariable[];
  sceneKind: FormulaLabSceneKind;
  challengeType: FormulaLabChallengeType;
  challenges: FormulaLabChallenge[];
  gradeBand: string;

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FormulaLabMetrics>) => void;
}

interface FormulaLabProps {
  data: FormulaLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  'free-explore': { label: 'Explore', icon: '↔', accentColor: 'emerald' },
  'predict-direction': { label: 'Direction', icon: '→', accentColor: 'cyan' },
  'predict-magnitude': { label: 'Magnitude', icon: '◆', accentColor: 'amber' },
  'construct-formula': { label: 'Construct', icon: '∑', accentColor: 'purple' },
  'transfer-apply': { label: 'Transfer', icon: '↗', accentColor: 'pink' },
};

const VARIABLE_ACCENTS: LuminaAccent[] = ['cyan', 'amber', 'purple', 'emerald'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type FormulaTokenGroup = 'values' | 'operations' | 'grouping';

const formulaTokenGroup = (token: string): FormulaTokenGroup => {
  if (token === '(' || token === ')') return 'grouping';
  if (['+', '-', '*', '/', '^'].includes(token)) return 'operations';
  return 'values';
};

const FORMULA_TOKEN_GROUPS: { id: FormulaTokenGroup; label: string }[] = [
  { id: 'values', label: 'Variables & values' },
  { id: 'operations', label: 'Operations' },
  { id: 'grouping', label: 'Grouping' },
];

const substitutedExpression = (
  expression: string,
  variables: FormulaLabVariable[],
  values: number[],
): string => tokenizeFormula(expression).map((token) => {
  const variableIndex = variables.findIndex((variable) => variable.symbol === token);
  if (variableIndex >= 0) return formatNumber(values[variableIndex]);
  if (token === '*') return '×';
  if (token === '/') return '÷';
  return token;
}).join(' ');

/** Scripted path only: the legacy tutor's reveal boundary for the support tier. */
const tutorRevealPolicy = (
  tier: FormulaLabSupportTier | undefined,
  mode: FormulaLabChallengeType,
): string => {
  const answerBoundary = mode === 'construct-formula'
    ? 'The formula-token order is the answer: never state or imply it.'
    : mode === 'transfer-apply'
      ? 'Never state the substituted result or numeric output.'
      : 'Never state the direction or magnitude of the output change.';
  if (tier === 'easy') {
    return `${answerBoundary} EASY support: you may name the relevant strategy or setup step, then ask the student to carry it out.`;
  }
  if (tier === 'medium') {
    return `${answerBoundary} MEDIUM support: nudge the next observation or step, but do not name the variable's role, operation, or substitution setup.`;
  }
  if (tier === 'hard') {
    return `${answerBoundary} HARD support: do not restore any withheld cue; ask what evidence the student sees and require them to explain their reasoning.`;
  }
  return answerBoundary;
};

const shuffledIndexes = (length: number): number[] => {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
};

function FormulaDisplay({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        trust: false,
      });
    } catch {
      return latex;
    }
  }, [latex]);

  return <div className="overflow-x-auto text-center text-2xl md:text-4xl" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface PredictionTrackProps {
  value: number | null;
  disabled: boolean;
  actualDirection?: FormulaLabDirection;
  actualPosition?: number;
  onChange: (value: number) => void;
}

function PredictionTrack({ value, disabled, actualDirection, actualPosition, onChange }: PredictionTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    if (disabled || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const normalized = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    onChange(normalized);
  }, [disabled, onChange]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  }, [disabled, updateFromClientX]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromClientX(event.clientX);
  }, [disabled, updateFromClientX]);

  const observedPosition = actualPosition
    ?? (actualDirection === 'decrease' ? -0.72 : actualDirection === 'increase' ? 0.72 : 0);

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span>Less</span><span>Same</span><span>More</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Place your output prediction"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(value * 100)}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onChange(clamp((value ?? 0) - 0.1, -1, 1));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onChange(clamp((value ?? 0) + 0.1, -1, 1));
          } else if (event.key === 'Home') {
            event.preventDefault();
            onChange(-1);
          } else if (event.key === 'End') {
            event.preventDefault();
            onChange(1);
          }
        }}
        className={`relative h-14 touch-none rounded-full border border-white/10 bg-black/25 ${disabled ? 'cursor-default' : 'cursor-crosshair'}`}
      >
        <div className="absolute left-5 right-5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-400/70 via-slate-500/40 to-emerald-400/70" />
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/25" />
        {value !== null && (
          <div
            className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-md border-2 border-cyan-300 bg-cyan-500/30 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-[left] duration-100"
            style={{ left: `${50 + value * 45}%` }}
            aria-hidden="true"
          />
        )}
        {actualDirection && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200 bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
            style={{ left: `${50 + observedPosition * 45}%` }}
            title="Observed result"
          />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Drag anywhere on the track. Distance from the center shows how strong you expect the change to be.
      </p>
    </div>
  );
}

interface LivingSceneProps {
  kind: FormulaLabSceneKind;
  inputProgress: number;
  outputDelta: number;
  revealed: boolean;
  inputLabel: string;
  outputLabel: string;
}

function LivingScene({ kind, inputProgress, outputDelta, revealed, inputLabel, outputLabel }: LivingSceneProps) {
  const input = clamp(inputProgress, 0, 1);
  const effect = revealed ? clamp(outputDelta, -1, 1) : 0;
  const glow = revealed ? 0.25 + Math.abs(effect) * 0.55 : 0.15;

  if (kind === 'motion') {
    const cartX = 235 + effect * 80;
    const blocks = 1 + Math.round(input * 3);
    return (
      <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label={`${inputLabel} changes a moving system and affects ${outputLabel}`}>
        <defs>
          <linearGradient id="formula-lab-track" x1="0" x2="1">
            <stop offset="0" stopColor="#334155" /><stop offset="1" stopColor="#64748b" />
          </linearGradient>
          <marker id="formula-lab-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#22d3ee" />
          </marker>
        </defs>
        <line x1="70" y1="205" x2="570" y2="205" stroke="url(#formula-lab-track)" strokeWidth="8" strokeLinecap="round" />
        {[0, 1, 2, 3].map((index) => index < blocks && (
          <rect key={index} x={cartX + 28 + index * 25} y={116 - index * 3} width="22" height="35" rx="4" fill="#f59e0b" opacity="0.75" />
        ))}
        <g style={{ transform: `translateX(${cartX - 235}px)`, transition: 'transform 350ms ease-out' }}>
          <rect x="220" y="145" width="135" height="42" rx="10" fill="#0f172a" stroke="#67e8f9" strokeWidth="3" />
          <circle cx="250" cy="196" r="15" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" />
          <circle cx="327" cy="196" r="15" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" />
        </g>
        <line x1="105" y1="165" x2={175 + input * 70} y2="165" stroke="#22d3ee" strokeWidth="8" markerEnd="url(#formula-lab-arrow)" />
        {revealed && [0, 1, 2].map((index) => (
          <line key={index} x1={410 + index * 25} y1={145 + index * 16} x2={470 + Math.abs(effect) * 70 + index * 18} y2={145 + index * 16} stroke="#34d399" strokeWidth="5" opacity={0.75 - index * 0.15} />
        ))}
        <text x="105" y="140" fill="#67e8f9" fontSize="15">{inputLabel}</text>
        <text x="475" y="105" fill={revealed ? '#6ee7b7' : '#64748b'} fontSize="15">{revealed ? outputLabel : `${outputLabel}: hidden`}</text>
      </svg>
    );
  }

  if (kind === 'geometry') {
    const radius = 48 + input * 58;
    return (
      <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label={`${inputLabel} changes a geometric figure and affects ${outputLabel}`}>
        <circle cx="255" cy="130" r={radius} fill={`rgba(34,211,238,${glow})`} stroke="#67e8f9" strokeWidth="4" style={{ transition: 'all 250ms ease-out' }} />
        <line x1="255" y1="130" x2={255 + radius} y2="130" stroke="#fbbf24" strokeWidth="4" strokeDasharray="7 5" />
        <circle cx={255 + radius} cy="130" r="9" fill="#fbbf24" />
        <text x="255" y="224" fill="#fcd34d" textAnchor="middle" fontSize="15">dragged {inputLabel}</text>
        <rect x="430" y={198 - (revealed ? 120 * (0.45 + effect * 0.4) : 28)} width="85" height={revealed ? 120 * (0.45 + effect * 0.4) : 28} rx="8" fill={revealed ? '#34d399' : '#334155'} opacity="0.75" />
        <text x="472" y="220" fill={revealed ? '#6ee7b7' : '#64748b'} textAnchor="middle" fontSize="15">{revealed ? outputLabel : 'predict first'}</text>
      </svg>
    );
  }

  if (kind === 'container') {
    const level = revealed ? 55 + 90 * (0.5 + effect * 0.45) : 55;
    return (
      <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label={`${inputLabel} flows into a system and affects ${outputLabel}`}>
        <path d="M120 55 H300 V90" fill="none" stroke="#fbbf24" strokeWidth={10 + input * 18} strokeLinecap="round" />
        <path d="M255 82 L300 115 L345 82" fill="#fbbf24" opacity="0.75" />
        {[0, 1, 2].map((index) => <circle key={index} cx={282 + index * 18} cy={118 + index * 11} r="6" fill="#67e8f9" opacity={0.8 - index * 0.15} />)}
        <path d="M390 65 V215 H555 V65" fill="none" stroke="#94a3b8" strokeWidth="5" />
        <rect x="396" y={215 - level} width="153" height={level} fill="#22d3ee" opacity={glow} style={{ transition: 'all 300ms ease-out' }} />
        <text x="175" y="38" fill="#fcd34d" fontSize="15">{inputLabel}</text>
        <text x="472" y="238" fill={revealed ? '#6ee7b7' : '#64748b'} textAnchor="middle" fontSize="15">{revealed ? outputLabel : `${outputLabel}: hidden`}</text>
      </svg>
    );
  }

  const orbRadius = revealed ? 45 + Math.abs(effect) * 28 : 45;
  return (
    <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label={`${inputLabel} feeds a relationship system and affects ${outputLabel}`}>
      <defs>
        <radialGradient id="formula-lab-orb">
          <stop offset="0" stopColor="#a5f3fc" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0891b2" stopOpacity={glow} />
        </radialGradient>
      </defs>
      <circle cx="135" cy="125" r={35 + input * 20} fill="#f59e0b" opacity="0.65" style={{ transition: 'all 250ms ease-out' }} />
      <text x="135" y="130" fill="white" textAnchor="middle" fontSize="15">{inputLabel}</text>
      <path d="M200 125 C275 75 330 175 405 125" fill="none" stroke="#22d3ee" strokeWidth={4 + input * 7} strokeDasharray="12 9" opacity="0.8" />
      <circle cx="490" cy="125" r={orbRadius} fill="url(#formula-lab-orb)" stroke={revealed ? '#6ee7b7' : '#64748b'} strokeWidth="4" style={{ transition: 'all 300ms ease-out' }} />
      <text x="490" y="130" fill="white" textAnchor="middle" fontSize="15">{revealed ? outputLabel : '?'}</text>
      <text x="320" y="218" fill="#94a3b8" textAnchor="middle" fontSize="14">one quantity changes · all others stay fixed</text>
    </svg>
  );
}

const FormulaLabSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FormulaLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FormulaLabChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    context,
    transferContext,
    formulaLatex,
    expression,
    outputSymbol,
    outputName,
    outputUnit,
    variables,
    sceneKind,
    challengeType,
    challenges,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `formula-lab-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  // Challenge progress. On the workspace path the runtime moves the index; the hooks below are bound after render.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (challenge) => challenge.id,
    instanceId: resolvedInstanceId,
    objectiveId,
    planItemId: runtimePlanItemId,
    workspace,
    assignment: (challenge) => workspaceAssignment(data, challenge),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete,
    getChallengeType: (challenge) => challenge.type,
    phaseConfig: PHASE_CONFIG,
  });

  const {
    submitResult,
    hasSubmitted,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FormulaLabMetrics>({
    primitiveType: 'formula-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // In-item levers (`formulaLabLevers.ts`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FormulaLabChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice problem. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const tokensGrouped = !!currentChallenge?.groupFormulaTokens || leverOn(GROUP_TOKENS_LEVER);
  const substitutionShown = !!currentChallenge?.showSubstitutionSetup || leverOn(SUBSTITUTION_LEVER);
  const currentMode = currentChallenge?.type ?? challengeType;
  const changedVariableIndex = currentChallenge
    ? variables.findIndex((variable) => variable.symbol === currentChallenge.changedVariableSymbol)
    : -1;
  const changedVariable = changedVariableIndex >= 0 ? variables[changedVariableIndex] : null;
  const formulaTokens = useMemo(() => tokenizeFormula(expression), [expression]);
  const formulaTokenOrder = useMemo(
    () => {
      const indexes = shuffledIndexes(formulaTokens.length);
      if (!tokensGrouped || currentMode !== 'construct-formula') return indexes;
      return indexes.sort((left, right) => {
        const leftRank = FORMULA_TOKEN_GROUPS.findIndex(({ id }) => id === formulaTokenGroup(formulaTokens[left]));
        const rightRank = FORMULA_TOKEN_GROUPS.findIndex(({ id }) => id === formulaTokenGroup(formulaTokens[right]));
        return leftRank - rightRank;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentChallenge?.id, tokensGrouped, currentMode, formulaTokens],
  );

  const [predictionPosition, setPredictionPosition] = useState<number | null>(null);
  const [predictionDirection, setPredictionDirection] = useState<FormulaLabDirection | null>(null);
  const [predictionLocked, setPredictionLocked] = useState(false);
  const [selectedFormulaTokenIndexes, setSelectedFormulaTokenIndexes] = useState<number[]>([]);
  const [transferAnswer, setTransferAnswer] = useState('');
  const [justification, setJustification] = useState('');
  const [currentValues, setCurrentValues] = useState<number[]>(currentChallenge?.baselineValues ?? []);
  const [challengeDone, setChallengeDone] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [hintsViewed, setHintsViewed] = useState(0);
  const hintViewedRef = useRef(false);
  const recordedRef = useRef(false);
  const completionSubmittedRef = useRef(false);

  // Resets. A fresh challenge opens blank at its starting values; Try again (workspace path) clears the checked work.
  const resetWork = (challenge: FormulaLabChallenge | null) => {
    setPredictionPosition(null);
    setPredictionDirection(null);
    setPredictionLocked(false);
    setSelectedFormulaTokenIndexes([]);
    setTransferAnswer('');
    setJustification('');
    setFeedback(null);
    if (challenge) setCurrentValues([...challenge.baselineValues]);
  };
  const resetChallenge = (challenge: FormulaLabChallenge | null) => {
    resetWork(challenge);
    setChallengeDone(false);
    hintViewedRef.current = false;
    recordedRef.current = false;
  };
  // Workspace path: the runtime opens each item (and reopens it after a miss) in the same commit as the scene.
  // Try again on a practice problem keeps it; a fresh item (or the full item back after practice) drops it.
  openItem.current = (index, retry) => {
    if (retry) resetWork(currentChallenge);
    else { setPractice(null); resetChallenge(challenges[index] ?? null); }
  };

  // Both paths: a new challenge id opens blank (the scripted path's Next; on the workspace path a no-op repeat).
  useEffect(() => {
    if (!currentChallenge) return;
    resetChallenge(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  /** What the living system shows: the `new_inputs` lever moves it to the transfer's new inputs (its output stays hidden). */
  const shownValues = currentMode === 'transfer-apply' && leverOn(NEW_INPUTS_LEVER) && currentChallenge
    ? currentChallenge.targetValues : currentValues;

  const currentOutput = useMemo(() => {
    if (!currentChallenge) return null;
    return evaluateFormulaExpression(expression, valuesToScope(variables, shownValues));
  }, [currentChallenge, expression, variables, shownValues]);

  const inputProgress = useMemo(() => {
    if (!changedVariable || changedVariableIndex < 0) return 0.5;
    const span = changedVariable.max - changedVariable.min;
    return span > 0 ? (shownValues[changedVariableIndex] - changedVariable.min) / span : 0.5;
  }, [changedVariable, changedVariableIndex, shownValues]);

  const outputDelta = useMemo(() => {
    if (!currentChallenge || currentOutput === null) return 0;
    const span = Math.abs(currentChallenge.expectedTargetOutput - currentChallenge.expectedBaselineOutput);
    if (span < 1e-9) return 0;
    return (currentOutput - currentChallenge.expectedBaselineOutput) / span;
  }, [currentChallenge, currentOutput]);

  const observedPredictionPosition = useMemo(
    () => (currentChallenge ? observedPosition(currentChallenge) : 0),
    [currentChallenge],
  );

  const formulaContext = currentMode === 'construct-formula'
    ? 'the expression is withheld while the student constructs it'
    : formulaLatex;
  const supportTier = currentChallenge?.supportTier;
  const tierTutorPolicy = tutorRevealPolicy(supportTier, currentMode);
  const hasRequiredJustification = !currentChallenge?.requireJustification
    || justification.trim().length >= 8;
  const isPredictionMode = currentMode === 'predict-direction' || currentMode === 'predict-magnitude';
  const selectedFormulaTokens = selectedFormulaTokenIndexes.map((index) => formulaTokens[index]);
  /** The learner's work as the domain module reads it. */
  const work: FormulaWork = {
    prediction: predictionPosition,
    tokens: selectedFormulaTokens,
    answer: transferAnswer,
    value: changedVariableIndex >= 0 ? currentValues[changedVariableIndex] ?? null : null,
  };

  const aiPrimitiveData = useMemo(() => ({
    title,
    context,
    formulaContext,
    outputName,
    challengeType: currentMode,
    supportTier: supportTier ?? 'not-set',
    changedVariable: changedVariable?.name ?? '',
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    predictionLocked,
    predictionDirection: predictionDirection ?? 'not-set',
    currentInputValue: changedVariableIndex >= 0 ? currentValues[changedVariableIndex] : null,
    targetInputValue: currentChallenge && changedVariableIndex >= 0
      ? currentChallenge.targetValues[changedVariableIndex]
      : null,
    challengeComplete: challengeDone,
  }), [
    title,
    context,
    formulaContext,
    outputName,
    currentMode,
    supportTier,
    changedVariable,
    currentIndex,
    challenges.length,
    predictionLocked,
    predictionDirection,
    changedVariableIndex,
    currentValues,
    currentChallenge,
    challengeDone,
  ]);

  // The legacy context and its tagged messages are the scripted path's; on the workspace path the tutor reads the scene.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'formula-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const introducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || introducedRef.current || !currentChallenge) return;
    introducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Formula Lab: ${title}. Relationship available to the student: ${formulaContext}. ` +
      `${challenges.length} challenges beginning with ${currentMode}. Briefly invite the student into the task. ` +
      `${tierTutorPolicy}`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, title, formulaContext, challenges.length, currentMode, tierTutorPolicy, sendText]);

  /**
   * A checked answer that finishes the challenge: the checked gesture (counts the attempt, records the verdict), then
   * this primitive's own fields (the score, the prediction, the build). On the workspace path only a credited answer
   * finishes; the scripted path also finishes a missed prediction.
   */
  const finishChallenge = useCallback((
    correct: boolean,
    score: number,
    message: string,
    response: Record<string, unknown>,
    checked: FormulaWork,
  ) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    progress.commitCheck(
      describeFormulaWork(data, currentChallenge, checked),
      correct,
      correct ? undefined : formulaMiss(data, currentChallenge, checked),
    );
    const attempts = currentAttempts + 1;
    // An easier practice problem (a simplify lever) is not the session's challenge: it records nothing.
    if (!isPracticeFormula(currentChallenge)) recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts,
      score,
      challengeType: currentMode,
      ...response,
      observedDirection: currentChallenge.correctDirection,
    });
    setChallengeDone(true);
    setFeedback({ correct, message });
    sendText(
      correct
        ? `[ANSWER_CORRECT] The student completed the ${currentMode} task on challenge ${currentIndex + 1} after ${attempts} attempt(s). `
          + `Acknowledge briefly and connect the observed evidence to the relationship. ${tierTutorPolicy}`
        : `[ANSWER_INCORRECT] The student completed the ${currentMode} task with a mismatch on challenge ${currentIndex + 1} after ${attempts} attempt(s). `
          + `Ask them to compare their response with the now-revealed relationship; do not just recite the answer. ${tierTutorPolicy}`,
      { silent: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, recordResult, currentMode, tierTutorPolicy, sendText, currentIndex, data, progress.commitCheck]);

  /** A wrong check that leaves the challenge open (Try again on the workspace path, revise on the scripted one). */
  const missed = (checked: FormulaWork, message: string, tag: string) => {
    if (!currentChallenge) return;
    SoundManager.playIncorrect();
    setFeedback({ correct: false, message });
    sendText(`${tag} Coach the next step within this tier policy. ${tierTutorPolicy}`, { silent: true });
    progress.commitCheck(describeFormulaWork(data, currentChallenge, checked), false, formulaMiss(data, currentChallenge, checked));
  };

  const magnitudeMessage = (correct: boolean) => (correct
    ? `Your signed prediction was close to the observed strength of change in ${outputName}.`
    : 'Compare the cyan prediction with the amber observed marker. Direction and distance from the center both matter.');

  const handleLockPrediction = useCallback(() => {
    if (
      !currentChallenge
      || !isPredictionMode
      || predictionPosition === null
      || predictionLocked
      || challengeDone
      || !hasRequiredJustification
      || learnerBlocked()
    ) return;
    SoundManager.select();
    const direction = directionFromPosition(predictionPosition);
    const checked: FormulaWork = { ...EMPTY_WORK, prediction: predictionPosition };
    if (tutorOwned) {
      // Workspace path: the locked prediction is the checked answer. A miss keeps the output hidden for Try again.
      const { correct, score } = formulaCheck(data, currentChallenge, checked);
      if (!correct) {
        missed(checked, `That prediction does not match how ${outputName} responds yet. Look at where `
          + `${changedVariable?.symbol ?? 'the changed quantity'} sits in the formula, then place it again.`, '[ANSWER_INCORRECT]');
        return;
      }
      setPredictionDirection(direction);
      setPredictionLocked(true);
      setCurrentValues([...currentChallenge.targetValues]);
      finishChallenge(
        true,
        score,
        currentMode === 'predict-magnitude'
          ? magnitudeMessage(true)
          : `Your prediction matched the system: ${outputName} ${directionLabel(currentChallenge.correctDirection)}.`,
        {
          predictionPosition,
          predictionDirection: direction,
          ...(currentMode === 'predict-magnitude' ? { observedPosition: observedPredictionPosition } : {}),
          justification: justification.trim() || undefined,
          finalValues: currentChallenge.targetValues,
        },
        checked,
      );
      return;
    }
    setPredictionDirection(direction);
    setPredictionLocked(true);
    sendText(
      `[PREDICTION_LOCKED] Challenge ${currentIndex + 1} of ${challenges.length}. ` +
      `The student predicts ${outputName} will ${directionLabel(direction)}. ` +
      `Briefly tell them to move ${changedVariable?.name ?? 'the variable'} to the target and compare the observation with their prediction. ` +
      `${tierTutorPolicy}`,
      { silent: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge,
    isPredictionMode,
    currentMode,
    predictionPosition,
    predictionLocked,
    challengeDone,
    hasRequiredJustification,
    tutorOwned,
    finishChallenge,
    observedPredictionPosition,
    justification,
    sendText,
    currentIndex,
    challenges.length,
    outputName,
    changedVariable,
    tierTutorPolicy,
    data,
  ]);

  /** The changed quantity reached its target: free-explore's finish, and the scripted path's test of a prediction. */
  const completeManipulation = useCallback((values: number[]) => {
    if (!currentChallenge) return;
    if (currentMode === 'free-explore') {
      finishChallenge(
        true,
        100,
        `You held the other quantities fixed and observed ${outputName} ${directionLabel(currentChallenge.correctDirection)}.`,
        { finalValues: values },
        { ...EMPTY_WORK, value: values[changedVariableIndex] ?? null },
      );
      return;
    }
    if (predictionPosition === null || predictionDirection === null) return;
    const checked: FormulaWork = { ...EMPTY_WORK, prediction: predictionPosition };
    const { correct, score } = formulaCheck(data, currentChallenge, checked);
    if (currentMode === 'predict-magnitude') {
      finishChallenge(
        correct,
        score,
        magnitudeMessage(correct),
        {
          predictionPosition,
          observedPosition: observedPredictionPosition,
          predictionDirection,
          justification: justification.trim() || undefined,
          finalValues: values,
        },
        checked,
      );
      return;
    }
    finishChallenge(
      correct,
      score,
      correct
        ? `Your prediction matched the system: ${outputName} ${directionLabel(currentChallenge.correctDirection)}.`
        : `The system showed that ${outputName} ${directionLabel(currentChallenge.correctDirection)}. Compare the two output markers.`,
      { predictionDirection, finalValues: values, justification: justification.trim() || undefined },
      checked,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge,
    currentMode,
    changedVariableIndex,
    finishChallenge,
    observedPredictionPosition,
    outputName,
    predictionDirection,
    predictionPosition,
    justification,
    data,
  ]);

  const handleVariableChange = useCallback((nextValue: number) => {
    const canManipulate = currentMode === 'free-explore' || predictionLocked;
    if (!currentChallenge || !changedVariable || changedVariableIndex < 0 || !canManipulate || challengeDone || learnerBlocked()) return;
    const nextValues = [...currentValues];
    nextValues[changedVariableIndex] = nextValue;
    setCurrentValues(nextValues);
    const target = currentChallenge.targetValues[changedVariableIndex];
    if (Math.abs(nextValue - target) <= changedVariable.step / 2) {
      completeManipulation(nextValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge,
    changedVariable,
    changedVariableIndex,
    currentMode,
    predictionLocked,
    challengeDone,
    currentValues,
    completeManipulation,
  ]);

  const handleCheckFormula = useCallback(() => {
    if (!currentChallenge || currentMode !== 'construct-formula' || challengeDone || learnerBlocked()) return;
    const checked: FormulaWork = { ...EMPTY_WORK, tokens: selectedFormulaTokens };
    if (!formulaCheck(data, currentChallenge, checked).correct) {
      missed(
        checked,
        'That sequence does not represent the relationship yet. Check the operator order and parentheses, then revise it.',
        `[ANSWER_INCORRECT] The student's formula construction does not yet match on challenge ${currentIndex + 1}, attempt ${currentAttempts + 1}.`,
      );
      return;
    }
    finishChallenge(
      true,
      100,
      'Your constructed expression matches the living relationship.',
      { assembledExpression: selectedFormulaTokens.join(' ') },
      checked,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeDone, currentAttempts, currentChallenge, currentIndex, currentMode, finishChallenge, selectedFormulaTokens, data]);

  const handleCheckTransfer = useCallback(() => {
    if (!currentChallenge || currentMode !== 'transfer-apply' || challengeDone || learnerBlocked()) return;
    if (transferAnswer.trim().length === 0 || !hasRequiredJustification) return;
    const answer = Number(transferAnswer);
    if (!Number.isFinite(answer)) return;
    const checked: FormulaWork = { ...EMPTY_WORK, answer: transferAnswer };
    if (!formulaCheck(data, currentChallenge, checked).correct) {
      missed(
        checked,
        'That output does not fit the transferred inputs yet. Substitute each shown value and keep the operation order intact.',
        `[ANSWER_INCORRECT] The student's transfer calculation is not yet correct on challenge ${currentIndex + 1}, attempt ${currentAttempts + 1}.`,
      );
      return;
    }
    const expected = currentChallenge.expectedTargetOutput;
    setCurrentValues([...currentChallenge.targetValues]);
    finishChallenge(
      true,
      100,
      `Yes — the relationship gives ${formatNumber(expected)} ${outputUnit} in the new setting.`,
      { submittedOutput: answer, expectedOutput: expected, justification: justification.trim() || undefined },
      checked,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    challengeDone,
    currentAttempts,
    currentChallenge,
    currentIndex,
    currentMode,
    finishChallenge,
    hasRequiredJustification,
    outputUnit,
    transferAnswer,
    justification,
    data,
  ]);

  const announcedChallengeIdRef = useRef(currentChallenge?.id ?? null);
  useEffect(() => {
    if (!isConnected || !currentChallenge || !changedVariable) return;
    if (announcedChallengeIdRef.current === currentChallenge.id) return;
    announcedChallengeIdRef.current = currentChallenge.id;
    const baseline = currentChallenge.baselineValues[changedVariableIndex];
    const target = currentChallenge.targetValues[changedVariableIndex];
    const visibleTaskData = currentMode === 'construct-formula'
      ? 'The expression is withheld while the student arranges the visible tokens.'
      : currentMode === 'transfer-apply'
        ? `Visible inputs: ${variables.map((variable, index) => (
          `${variable.name} ${formatNumber(currentChallenge.targetValues[index])} ${variable.unit}`
        )).join(', ')}.`
        : `${changedVariable.name} changes from ${formatNumber(baseline)} ${changedVariable.unit} `
          + `to ${formatNumber(target)} ${changedVariable.unit} while the other inputs stay fixed.`;
    sendText(
      `[NEXT_ITEM] Formula Lab experiment ${currentIndex + 1} of ${challenges.length}. ` +
      `Mode: ${currentMode}. ${visibleTaskData} Invite the student to begin. ${tierTutorPolicy}`,
      { silent: true },
    );
  }, [
    isConnected,
    currentChallenge,
    changedVariable,
    changedVariableIndex,
    currentMode,
    variables,
    currentIndex,
    challenges.length,
    tierTutorPolicy,
    sendText,
  ]);

  // Scripted path: the primitive's own Next (the workspace path hides it; the runtime advances).
  const handleNext = useCallback(() => {
    if (!challengeDone) return;
    advance();
  }, [challengeDone, advance]);

  // Session complete (scripted path): the primitive's own tally, submitted once.
  useEffect(() => {
    if (!isComplete || hasSubmitted || completionSubmittedRef.current) return;
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned) return;
    completionSubmittedRef.current = true;
    const totalChallenges = challenges.length;
    const correctCount = challengeResults.filter((result) => result.correct).length;
    const attemptsCount = challengeResults.reduce((sum, result) => sum + result.attempts, 0);
    const firstTryCount = challengeResults.filter((result) => result.correct && result.attempts === 1).length;
    const scoreTotal = challengeResults.reduce(
      (sum, result) => sum + (typeof result.score === 'number' ? result.score : result.correct ? 100 : 0),
      0,
    );
    const overallAccuracy = totalChallenges > 0 ? Math.round(scoreTotal / totalChallenges) : 0;
    const metrics: FormulaLabMetrics = {
      type: 'formula-lab',
      challengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge: totalChallenges > 0
        ? Math.round((attemptsCount / totalChallenges) * 10) / 10
        : 0,
    };
    submitResult(overallAccuracy >= 70, overallAccuracy, metrics, { challengeResults });
    sendText(
      `[ALL_COMPLETE] The student completed ${totalChallenges} Formula Lab tasks with ${overallAccuracy}% accuracy. ` +
      `Celebrate briefly and name holding variables constant, testing predictions, and transferring relationships as the habits they practiced. ${tierTutorPolicy}`,
      { silent: true },
    );
  }, [
    isComplete,
    hasSubmitted,
    tutorOwned,
    challenges.length,
    challengeResults,
    challengeType,
    hintsViewed,
    submitResult,
    tierTutorPolicy,
    sendText,
  ]);

  // Workspace path, under a lesson's evaluation provider only (the live host has none): the scored session, whose item
  // scores count corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || completionSubmittedRef.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    completionSubmittedRef.current = true;
    const metrics: FormulaLabMetrics = {
      type: 'formula-lab',
      challengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  const outputRevealed = currentMode === 'free-explore'
    || (isPredictionMode && predictionLocked)
    || challengeDone;

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(data, currentChallenge, { ...work, revealed: outputRevealed });
    const onScreen = practice ? '' : leverFacts(data, sessionChallenge, pulledLevers);
    const levers = practice ? [] : formulaLevers(data, sessionChallenge, pulledLevers, {
      tokensGrouped: !!sessionChallenge.groupFormulaTokens, substitutionShown: !!sessionChallenge.showSubstitutionSetup });
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
          const easier = simplerFormula(data, sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetChallenge(easier);
          return { practice: workspaceAssignment(data, easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallenge(sessionChallenge); },
    };
  });

  if (!currentChallenge && !hasSubmitted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">No Formula Lab challenges are available.</LuminaCardContent>
      </LuminaCard>
    );
  }

  const baselineValue = changedVariable && changedVariableIndex >= 0
    ? currentChallenge?.baselineValues[changedVariableIndex]
    : undefined;
  const targetValue = changedVariable && changedVariableIndex >= 0
    ? currentChallenge?.targetValues[changedVariableIndex]
    : undefined;
  const currentInputValue = changedVariableIndex >= 0 ? shownValues[changedVariableIndex] : undefined;
  const hasMoreChallenges = currentIndex + 1 < challenges.length;
  const canManipulate = currentMode === 'free-explore' || (isPredictionMode && predictionLocked);
  const showLiveOutputReadout = currentChallenge?.showLiveOutputReadout ?? true;
  const numericOutputVisible = outputRevealed && (showLiveOutputReadout || challengeDone);
  const strategyCue = currentChallenge?.strategyCue ?? (isPredictionMode ? 'hint' : 'none');
  const strategyText = currentMode === 'free-explore'
    ? `Compare ${outputName} before and after moving ${changedVariable?.name ?? 'the input'}; keep every other input fixed.`
    : isPredictionMode
      ? `Find ${changedVariable?.symbol ?? 'the changed variable'} in the formula. Decide whether its role makes ${outputName} move up, down, or stay stable before calculating.`
      : currentMode === 'construct-formula'
        ? 'Start with the quantities, connect them with operations, and use grouping only where the relationship needs it.'
        : 'Substitute each shown input into the same formula first, then evaluate the operations in order.';
  const hintText = currentMode === 'free-explore'
    ? `Watch the scene at the starting value, then at the target. What changed in ${outputName}, and what stayed fixed?`
    : isPredictionMode
      ? `Find ${changedVariable?.symbol ?? 'the changed variable'} in the formula. What role does it play—multiplier, divisor, or exponent?`
      : currentMode === 'construct-formula'
        ? 'Sort the pieces mentally into quantities, operations, and grouping marks before choosing the first token.'
        : 'Replace each variable symbol with its shown value before doing any arithmetic.';
  const availableFormulaTokenIndexes = formulaTokenOrder.filter(
    (index) => !selectedFormulaTokenIndexes.includes(index),
  );
  const transferSubstitution = currentMode === 'transfer-apply'
    ? substitutedExpression(expression, variables, currentChallenge?.targetValues ?? [])
    : '';
  const pair = currentChallenge ? modelPair(data, currentChallenge) : null;
  const builtValue = currentMode === 'construct-formula' && currentChallenge && selectedFormulaTokens.length
    ? evaluateFormulaExpression(selectedFormulaTokens.join(' '), valuesToScope(variables, currentChallenge.baselineValues)) : null;
  /** Prediction input: closed once locked, once the challenge is done, and while a checked miss waits for Try again. */
  const predictionClosed = predictionLocked || challengeDone || blocked;
  const placePrediction = (value: number) => {
    if (predictionClosed || learnerBlocked()) return;
    setPredictionPosition(clamp(value, -1, 1));
    if (tutorOwned) setFeedback(null);
  };
  const pickToken = (index: number) => {
    if (challengeDone || learnerBlocked()) return;
    setSelectedFormulaTokenIndexes((current) => [...current, index]);
  };

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: hasSubmitted ? null : currentChallenge?.id ?? null,
    label: 'The formula lab',
    solved: challengeDone && challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  return (
    <LuminaCard className={className} topAccent="cyan">
      <LuminaCardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle>{title}</LuminaCardTitle>
            <LuminaCardDescription className="mt-1">{description}</LuminaCardDescription>
          </div>
          <LuminaBadge accent="cyan">Formula Lab · {gradeBand}</LuminaBadge>
        </div>
        <LuminaPanel accent="cyan" className="py-3">
          {currentMode === 'construct-formula' && !challengeDone
            ? <p className="text-center text-3xl font-semibold text-cyan-100">{outputSymbol} = ?</p>
            : <FormulaDisplay latex={formulaLatex} />}
          {/* `find_quantity` lever: the changed quantity's symbol ringed wherever it sits in the formula. */}
          {leverOn(FIND_QUANTITY_LEVER) && changedVariable && (
            <p data-lever="find-quantity" className="mt-2 text-center text-lg text-slate-200">
              {outputSymbol} ={' '}
              {formulaTokens.map((token, index) => (token === changedVariable.symbol
                ? <span key={index} className="mx-0.5 rounded-full border-2 border-amber-300 px-2 text-amber-100">{token}</span>
                : <span key={index} className="mx-0.5">{token === '*' ? '×' : token === '/' ? '÷' : token}</span>))}
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {variables.map((variable, index) => (
              <LuminaBadge key={variable.symbol} accent={variable.accent ?? VARIABLE_ACCENTS[index % VARIABLE_ACCENTS.length]}>
                {variable.symbol} = {variable.name} ({variable.unit})
              </LuminaBadge>
            ))}
            <LuminaBadge accent="emerald">{outputSymbol} = {outputName} ({outputUnit})</LuminaBadge>
          </div>
        </LuminaPanel>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!hasSubmitted && currentChallenge && changedVariable && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
            </div>

            <LuminaPrompt>
              {currentMode === 'free-explore' && (
                <>
                  <span className="block text-xs font-semibold uppercase tracking-widest text-emerald-300">Explore the relationship</span>
                  Move <span className={accentText[changedVariable.accent]}>{changedVariable.name}</span> from{' '}
                  <strong>{formatNumber(baselineValue ?? 0)} {changedVariable.unit}</strong> to{' '}
                  <strong>{formatNumber(targetValue ?? 0)} {changedVariable.unit}</strong> while every other quantity stays fixed. Watch what changes.
                </>
              )}
              {currentMode === 'predict-direction' && (
                <>
                  <span className="block text-xs font-semibold uppercase tracking-widest text-cyan-300">Predict the direction</span>
                  When <span className={accentText[changedVariable.accent]}>{changedVariable.name}</span> changes from{' '}
                  <strong>{formatNumber(baselineValue ?? 0)} {changedVariable.unit}</strong> to{' '}
                  <strong>{formatNumber(targetValue ?? 0)} {changedVariable.unit}</strong>, will <strong>{outputName}</strong> decrease, stay about the same, or increase?
                </>
              )}
              {currentMode === 'predict-magnitude' && (
                <>
                  <span className="block text-xs font-semibold uppercase tracking-widest text-amber-300">Predict direction and strength</span>
                  Place a signed prediction for how strongly <strong>{outputName}</strong> will change when{' '}
                  <span className={accentText[changedVariable.accent]}>{changedVariable.name}</span> moves from{' '}
                  <strong>{formatNumber(baselineValue ?? 0)}</strong> to <strong>{formatNumber(targetValue ?? 0)}</strong>.
                </>
              )}
              {currentMode === 'construct-formula' && (
                <>
                  <span className="block text-xs font-semibold uppercase tracking-widest text-purple-300">Construct the formula</span>
                  Build the hidden right-hand side of <strong>{outputSymbol} = ?</strong> from the available variables, numbers, and operators.
                </>
              )}
              {currentMode === 'transfer-apply' && (
                <>
                  <span className="block text-xs font-semibold uppercase tracking-widest text-rose-300">Transfer the relationship</span>
                  {transferContext} Use the shown inputs to calculate <strong>{outputName}</strong>. The live output stays hidden until you commit.
                </>
              )}
            </LuminaPrompt>

            {strategyCue === 'visible' && (
              <LuminaPanel accent="cyan" className="py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Strategy cue</p>
                <p className="mt-1 text-sm text-slate-200">{strategyText}</p>
              </LuminaPanel>
            )}

            {/* Pip's dock sits above the workspace, which it outlines as a region. */}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <LuminaPanel className="overflow-hidden p-2 md:p-4">
                <div className="mb-1 flex items-center justify-between px-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Living system</span>
                  <LuminaBadge accent={outputRevealed ? 'emerald' : 'amber'}>
                    {outputRevealed ? 'Output visible' : 'Output hidden'}
                  </LuminaBadge>
                </div>
                <LivingScene
                  kind={sceneKind}
                  inputProgress={inputProgress}
                  outputDelta={outputDelta}
                  revealed={outputRevealed}
                  inputLabel={changedVariable.name}
                  outputLabel={outputName}
                />
                <div className="flex flex-wrap justify-center gap-6 border-t border-white/5 px-3 pt-3">
                  <LuminaInlineStat
                    label={changedVariable.name}
                    value={formatNumber(currentInputValue ?? 0)}
                    suffix={changedVariable.unit}
                    accent={changedVariable.accent}
                  />
                  <LuminaInlineStat
                    label={outputName}
                    value={numericOutputVisible && currentOutput !== null ? formatNumber(currentOutput) : '?'}
                    suffix={numericOutputVisible ? outputUnit : undefined}
                    accent="emerald"
                  />
                </div>
              </LuminaPanel>

              <div className="space-y-4">
                {isPredictionMode && (
                  <LuminaPanel accent={currentMode === 'predict-magnitude' ? 'amber' : 'cyan'}>
                    <p className="mb-3 text-sm font-semibold text-slate-200">1. Place your prediction</p>
                    <PredictionTrack
                      value={predictionPosition}
                      disabled={predictionClosed}
                      actualDirection={challengeDone ? currentChallenge.correctDirection : undefined}
                      actualPosition={challengeDone && currentMode === 'predict-magnitude' ? observedPredictionPosition : undefined}
                      onChange={placePrediction}
                    />
                    {/* `track_scale` lever: the track labelled in words, the same for every item. */}
                    {leverOn(TRACK_SCALE_LEVER) && (
                      <div data-lever="track-scale" className="relative mt-1 h-8 text-[10px] leading-tight text-slate-300" aria-hidden="true">
                        {TRACK_MARKS.map((label, index) => (
                          <span key={label} className="absolute w-16 -translate-x-1/2 text-center" style={{ left: `${50 + (index - 2) * 22.5}%` }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* The keyboard's other way onto the track, and the journey's: the same position, in hundredths. */}
                    <input
                      type="range"
                      className="sr-only"
                      aria-label="Your prediction"
                      min={-100}
                      max={100}
                      step={1}
                      value={Math.round((predictionPosition ?? 0) * 100)}
                      disabled={predictionClosed}
                      onChange={(event) => placePrediction(Number(event.target.value) / 100)}
                    />
                    {currentChallenge.requireJustification && !predictionLocked && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-200" htmlFor={`${resolvedInstanceId}-prediction-reason`}>
                          What in the formula supports your prediction?
                        </label>
                        <LuminaInput
                          id={`${resolvedInstanceId}-prediction-reason`}
                          aria-label="Prediction reason"
                          value={justification}
                          disabled={predictionClosed}
                          onChange={(event) => { if (!learnerBlocked()) setJustification(event.target.value); }}
                          placeholder="State the variable's role or another piece of evidence"
                        />
                      </div>
                    )}
                    {!predictionLocked && (
                      <div className="mt-4 flex justify-center">
                        <LuminaActionButton
                          action="check"
                          disabled={predictionPosition === null || !hasRequiredJustification || predictionClosed}
                          onClick={handleLockPrediction}
                        >
                          Lock prediction
                        </LuminaActionButton>
                      </div>
                    )}
                  </LuminaPanel>
                )}

                {(currentMode === 'free-explore' || isPredictionMode) && (
                  <LuminaPanel accent={canManipulate ? changedVariable.accent : undefined} className={!canManipulate ? 'opacity-45' : undefined}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-200">{isPredictionMode ? '2. Test the system' : 'Move one variable'}</p>
                      {targetValue !== undefined && (
                        <LuminaBadge accent={changedVariable.accent}>target {formatNumber(targetValue)} {changedVariable.unit}</LuminaBadge>
                      )}
                    </div>
                    <LuminaSlider
                      accent={changedVariable.accent}
                      min={changedVariable.min}
                      max={changedVariable.max}
                      step={changedVariable.step}
                      value={[currentInputValue ?? changedVariable.defaultValue]}
                      disabled={!canManipulate || challengeDone || blocked}
                      onValueChange={([value]) => handleVariableChange(value)}
                      silent
                    />
                    {/* The keyboard's other way onto the slider, and the journey's. */}
                    <input
                      type="range"
                      className="sr-only"
                      aria-label="Changed quantity"
                      min={changedVariable.min}
                      max={changedVariable.max}
                      step={changedVariable.step}
                      value={currentInputValue ?? changedVariable.defaultValue}
                      disabled={!canManipulate || challengeDone || blocked}
                      onChange={(event) => handleVariableChange(Number(event.target.value))}
                    />
                    <p className="mt-3 text-xs text-slate-500">
                      {canManipulate
                        ? `Move ${changedVariable.name} until it reaches the target. Watch every representation respond together.`
                        : 'Lock a prediction before the variable control becomes active.'}
                    </p>
                  </LuminaPanel>
                )}

                {currentMode === 'construct-formula' && (
                  <LuminaPanel accent="purple" className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your expression</p>
                      <div className="mt-2 min-h-14 rounded-xl border border-purple-400/25 bg-black/20 p-3 text-center text-xl text-purple-100">
                        {selectedFormulaTokens.length > 0 ? selectedFormulaTokens.join(' ') : 'Choose the first token'}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {tokensGrouped
                        ? FORMULA_TOKEN_GROUPS.map((group) => {
                          const groupIndexes = availableFormulaTokenIndexes.filter(
                            (index) => formulaTokenGroup(formulaTokens[index]) === group.id,
                          );
                          if (groupIndexes.length === 0) return null;
                          return (
                            <div key={group.id} className="rounded-xl border border-white/10 bg-black/15 p-2">
                              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                {group.label}
                              </p>
                              <div className="flex flex-wrap justify-center gap-2">
                                {groupIndexes.map((index) => (
                                  <LuminaButton
                                    key={index}
                                    tone="ghost"
                                    onClick={() => pickToken(index)}
                                    disabled={challengeDone || blocked}
                                  >
                                    {formulaTokens[index]}
                                  </LuminaButton>
                                ))}
                              </div>
                            </div>
                          );
                        })
                        : availableFormulaTokenIndexes.map((index) => (
                          <LuminaButton
                            key={index}
                            tone="ghost"
                            onClick={() => pickToken(index)}
                            disabled={challengeDone || blocked}
                          >
                            {formulaTokens[index]}
                          </LuminaButton>
                        ))}
                    </div>
                    {/* `value_check` lever: what the learner's build gives at the starting values, beside the living system. */}
                    {leverOn(VALUE_CHECK_LEVER) && (
                      <div data-lever="value-check" className="rounded-xl border border-purple-400/20 bg-black/15 p-3 text-center text-sm text-slate-200">
                        <p className="text-xs text-slate-400">
                          At the starting values ({variables.map((variable, index) => `${variable.symbol} = ${formatNumber(currentChallenge.baselineValues[index])}`).join(', ')})
                        </p>
                        <p className="mt-1">
                          your build gives <strong>{builtValue === null ? 'no value yet' : formatNumber(builtValue)}</strong>
                          {' · '}the living system gives <strong>{formatNumber(currentChallenge.expectedBaselineOutput)}</strong>
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                      <LuminaButton
                        tone="subtle"
                        disabled={selectedFormulaTokenIndexes.length === 0 || challengeDone || blocked}
                        onClick={() => { if (!learnerBlocked()) setSelectedFormulaTokenIndexes((current) => current.slice(0, -1)); }}
                      >
                        Undo token
                      </LuminaButton>
                      <LuminaActionButton
                        action="check"
                        disabled={selectedFormulaTokenIndexes.length === 0 || challengeDone || blocked}
                        onClick={handleCheckFormula}
                      >
                        Check formula
                      </LuminaActionButton>
                    </div>
                  </LuminaPanel>
                )}

                {currentMode === 'transfer-apply' && (
                  <LuminaPanel accent="rose" className="space-y-4">
                    <div className="flex flex-wrap justify-center gap-2">
                      {variables.map((variable, index) => (
                        <LuminaBadge key={variable.symbol} accent={variable.accent}>
                          {variable.symbol} = {formatNumber(currentChallenge.targetValues[index])} {variable.unit}
                        </LuminaBadge>
                      ))}
                    </div>
                    {substitutionShown && (
                      <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-rose-300">Substitution setup</p>
                        <p className="mt-2 text-lg text-rose-100">{outputSymbol} = {transferSubstitution}</p>
                      </div>
                    )}
                    <label className="block text-sm font-semibold text-slate-200" htmlFor={`${resolvedInstanceId}-transfer-answer`}>
                      {outputSymbol} ({outputUnit})
                    </label>
                    <LuminaInput
                      id={`${resolvedInstanceId}-transfer-answer`}
                      aria-label="Transferred output"
                      type="number"
                      inputMode="decimal"
                      value={transferAnswer}
                      disabled={challengeDone || blocked}
                      onChange={(event) => { if (!learnerBlocked()) setTransferAnswer(event.target.value); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleCheckTransfer();
                      }}
                      placeholder="Enter the withheld output"
                    />
                    {currentChallenge.requireJustification && (
                      <>
                        <label className="block text-sm font-semibold text-slate-200" htmlFor={`${resolvedInstanceId}-transfer-reason`}>
                          Show your substitution or explain your calculation
                        </label>
                        <LuminaInput
                          id={`${resolvedInstanceId}-transfer-reason`}
                          aria-label="Calculation reason"
                          value={justification}
                          disabled={challengeDone || blocked}
                          onChange={(event) => { if (!learnerBlocked()) setJustification(event.target.value); }}
                          placeholder="Briefly justify how the formula gives your output"
                        />
                      </>
                    )}
                    <div className="flex justify-center">
                      <LuminaActionButton
                        action="check"
                        disabled={transferAnswer.trim().length === 0 || challengeDone || !hasRequiredJustification || blocked}
                        onClick={handleCheckTransfer}
                      >
                        Check transferred output
                      </LuminaActionButton>
                    </div>
                  </LuminaPanel>
                )}
              </div>
            </div>

            </div>

            {/* Lever pictures and cards outside the item: none of its symbols, numbers or order. */}
            {(leverOn(MODEL_PAIR_LEVER) && pair) || leverOn(ORDER_CARD_LEVER) ? (
              <div className="flex flex-wrap justify-center gap-4">
                {leverOn(MODEL_PAIR_LEVER) && pair && (
                  <figure data-lever="model-pair" className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
                    {pair.rows.map((row) => (
                      <p key={row.rule} className="py-0.5">
                        <strong>{row.rule}</strong>: {pair.input} {formatNumber(row.from)} → {formatNumber(row.to)},
                        {' '}{pair.output} {formatNumber(row.outFrom)} → {formatNumber(row.outTo)}
                      </p>
                    ))}
                    <figcaption className="mt-1 text-xs text-slate-400">Which rule is the formula like?</figcaption>
                  </figure>
                )}
                {leverOn(ORDER_CARD_LEVER) && (
                  <div data-lever="order-card" className="max-w-md rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
                    {orderCard(data).map((line) => <p key={line} className="py-0.5">{line}</p>)}
                  </div>
                )}
              </div>
            ) : null}

            {/* Hint (scripted path). With the tutor, help is the tutor's. */}
            {!tutorOwned && strategyCue === 'hint' && !challengeDone && (!isPredictionMode || !predictionLocked) && (
              <LuminaHintDisclosure
                onOpenChange={(open) => {
                  if (open && !hintViewedRef.current) {
                    hintViewedRef.current = true;
                    setHintsViewed((count) => count + 1);
                  }
                }}
              >
                {hintText}
              </LuminaHintDisclosure>
            )}

            {feedback && (
              <LuminaFeedbackCard
                status={feedback.correct ? 'correct' : 'insight'}
                label={feedback.correct ? 'Relationship confirmed' : 'Revise the model'}
                teachingNote={challengeDone
                  ? `${formatNumber(currentChallenge.expectedBaselineOutput)} ${outputUnit} → ${formatNumber(currentChallenge.expectedTargetOutput)} ${outputUnit}. The result is derived from the same validated expression used by the living system.`
                  : 'The answer remains hidden while you revise. Use the visible quantities and the structure of the relationship.'}
              >
                {feedback.message}
              </LuminaFeedbackCard>
            )}

            {/* On the workspace path the shell's Try again / Next challenge replace Next. */}
            {!tutorOwned && challengeDone && (
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={handleNext}>
                  {hasMoreChallenges ? 'Next experiment →' : 'See results →'}
                </LuminaActionButton>
              </div>
            )}

            <p className="text-center text-xs text-slate-500">
              {currentMode === 'transfer-apply' ? transferContext : context}
            </p>
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Formula relationship discovered"
            celebrationMessage={`You completed ${challenges.length} formula tasks and used the living system to connect observation, prediction, structure, and transfer.`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FormulaLab = withWorkspaceController<FormulaLabProps, ProgressOptions<FormulaLabChallenge>, Progress>(
  'formula-lab', FormulaLabSurface, useScriptedProgress, useWorkspaceProgressFor('formula-lab'));

export default FormulaLab;
