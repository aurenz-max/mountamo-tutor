'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { evaluateFormulaExpression } from './formulaLabMath';

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

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if ((abs >= 100000 || (abs > 0 && abs < 0.001))) return value.toExponential(2);
  return Number(value.toFixed(3)).toString();
};

const valuesToScope = (
  variables: FormulaLabVariable[],
  values: number[],
): Record<string, number> => Object.fromEntries(
  variables.map((variable, index) => [variable.symbol, values[index]]),
);

const tokenizeFormula = (expression: string): string[] => (
  expression.match(/(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/^])/g) ?? []
);

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

const directionFromPosition = (position: number): FormulaLabDirection => {
  if (position < -0.18) return 'decrease';
  if (position > 0.18) return 'increase';
  return 'stay-same';
};

const directionLabel = (direction: FormulaLabDirection): string => {
  if (direction === 'increase') return 'increase';
  if (direction === 'decrease') return 'decrease';
  return 'stay about the same';
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

const FormulaLab: React.FC<FormulaLabProps> = ({ data, className }) => {
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

  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress({ challenges, getChallengeId: (challenge) => challenge.id });

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

  const currentChallenge = challenges[currentIndex] ?? null;
  const currentMode = currentChallenge?.type ?? challengeType;
  const changedVariableIndex = currentChallenge
    ? variables.findIndex((variable) => variable.symbol === currentChallenge.changedVariableSymbol)
    : -1;
  const changedVariable = changedVariableIndex >= 0 ? variables[changedVariableIndex] : null;
  const formulaTokens = useMemo(() => tokenizeFormula(expression), [expression]);
  const formulaTokenOrder = useMemo(
    () => {
      const indexes = shuffledIndexes(formulaTokens.length);
      if (!currentChallenge?.groupFormulaTokens || currentMode !== 'construct-formula') return indexes;
      return indexes.sort((left, right) => {
        const leftRank = FORMULA_TOKEN_GROUPS.findIndex(({ id }) => id === formulaTokenGroup(formulaTokens[left]));
        const rightRank = FORMULA_TOKEN_GROUPS.findIndex(({ id }) => id === formulaTokenGroup(formulaTokens[right]));
        return leftRank - rightRank;
      });
    },
    [currentChallenge?.id, currentChallenge?.groupFormulaTokens, currentMode, formulaTokens],
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

  useEffect(() => {
    if (!currentChallenge) return;
    setPredictionPosition(null);
    setPredictionDirection(null);
    setPredictionLocked(false);
    setSelectedFormulaTokenIndexes([]);
    setTransferAnswer('');
    setJustification('');
    setCurrentValues([...currentChallenge.baselineValues]);
    setChallengeDone(false);
    setFeedback(null);
    hintViewedRef.current = false;
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  const currentOutput = useMemo(() => {
    if (!currentChallenge) return null;
    return evaluateFormulaExpression(expression, valuesToScope(variables, currentValues));
  }, [currentChallenge, expression, variables, currentValues]);

  const inputProgress = useMemo(() => {
    if (!changedVariable || changedVariableIndex < 0) return 0.5;
    const span = changedVariable.max - changedVariable.min;
    return span > 0 ? (currentValues[changedVariableIndex] - changedVariable.min) / span : 0.5;
  }, [changedVariable, changedVariableIndex, currentValues]);

  const outputDelta = useMemo(() => {
    if (!currentChallenge || currentOutput === null) return 0;
    const span = Math.abs(currentChallenge.expectedTargetOutput - currentChallenge.expectedBaselineOutput);
    if (span < 1e-9) return 0;
    return (currentOutput - currentChallenge.expectedBaselineOutput) / span;
  }, [currentChallenge, currentOutput]);

  const observedPredictionPosition = useMemo(() => {
    if (!currentChallenge) return 0;
    const baseline = currentChallenge.expectedBaselineOutput;
    const target = currentChallenge.expectedTargetOutput;
    const relativeChange = (target - baseline) / Math.max(1, Math.abs(baseline));
    return clamp(relativeChange, -1, 1);
  }, [currentChallenge]);

  const formulaContext = currentMode === 'construct-formula'
    ? 'the expression is withheld while the student constructs it'
    : formulaLatex;
  const supportTier = currentChallenge?.supportTier;
  const tierTutorPolicy = tutorRevealPolicy(supportTier, currentMode);
  const hasRequiredJustification = !currentChallenge?.requireJustification
    || justification.trim().length >= 8;

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

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'formula-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
  });

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

  const handleLockPrediction = useCallback(() => {
    if (
      !currentChallenge
      || !['predict-direction', 'predict-magnitude'].includes(currentMode)
      || predictionPosition === null
      || predictionLocked
      || challengeDone
      || !hasRequiredJustification
    ) return;
    SoundManager.select();
    const direction = directionFromPosition(predictionPosition);
    setPredictionDirection(direction);
    setPredictionLocked(true);
    incrementAttempts();
    sendText(
      `[PREDICTION_LOCKED] Challenge ${currentIndex + 1} of ${challenges.length}. ` +
      `The student predicts ${outputName} will ${directionLabel(direction)}. ` +
      `Briefly tell them to move ${changedVariable?.name ?? 'the variable'} to the target and compare the observation with their prediction. ` +
      `${tierTutorPolicy}`,
      { silent: true },
    );
  }, [
    currentChallenge,
    currentMode,
    predictionPosition,
    predictionLocked,
    challengeDone,
    hasRequiredJustification,
    incrementAttempts,
    sendText,
    currentIndex,
    challenges.length,
    outputName,
    changedVariable,
    tierTutorPolicy,
  ]);

  const finishChallenge = useCallback((
    correct: boolean,
    score: number,
    message: string,
    response: Record<string, unknown>,
    attempts = Math.max(1, currentAttempts),
  ) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    recordResult({
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
    const completedAttempts = Math.max(1, attempts);
    sendText(
      correct
        ? `[ANSWER_CORRECT] The student completed the ${currentMode} task on challenge ${currentIndex + 1} after ${completedAttempts} attempt(s). `
          + `Acknowledge briefly and connect the observed evidence to the relationship. ${tierTutorPolicy}`
        : `[ANSWER_INCORRECT] The student completed the ${currentMode} task with a mismatch on challenge ${currentIndex + 1} after ${completedAttempts} attempt(s). `
          + `Ask them to compare their response with the now-revealed relationship; do not just recite the answer. ${tierTutorPolicy}`,
      { silent: true },
    );
  }, [
    currentChallenge,
    currentAttempts,
    recordResult,
    currentMode,
    tierTutorPolicy,
    sendText,
    currentIndex,
  ]);

  const completeManipulation = useCallback((values: number[]) => {
    if (!currentChallenge) return;
    if (currentMode === 'free-explore') {
      finishChallenge(
        true,
        100,
        `You held the other quantities fixed and observed ${outputName} ${directionLabel(currentChallenge.correctDirection)}.`,
        { finalValues: values },
      );
      return;
    }
    if (predictionPosition === null || predictionDirection === null) return;
    if (currentMode === 'predict-magnitude') {
      const distance = Math.abs(predictionPosition - observedPredictionPosition);
      const score = Math.round(Math.max(0, 1 - distance / 2) * 100);
      const correct = score >= 70;
      finishChallenge(
        correct,
        score,
        correct
          ? `Your signed prediction was close to the observed strength of change in ${outputName}.`
          : `Compare the cyan prediction with the amber observed marker. Direction and distance from the center both matter.`,
        {
          predictionPosition,
          observedPosition: observedPredictionPosition,
          predictionDirection,
          justification: justification.trim() || undefined,
          finalValues: values,
        },
      );
      return;
    }
    const correct = predictionDirection === currentChallenge.correctDirection;
    finishChallenge(
      correct,
      correct ? 100 : 0,
      correct
        ? `Your prediction matched the system: ${outputName} ${directionLabel(currentChallenge.correctDirection)}.`
        : `The system showed that ${outputName} ${directionLabel(currentChallenge.correctDirection)}. Compare the two output markers.`,
      { predictionDirection, finalValues: values, justification: justification.trim() || undefined },
    );
  }, [
    currentChallenge,
    currentMode,
    finishChallenge,
    observedPredictionPosition,
    outputName,
    predictionDirection,
    predictionPosition,
    justification,
  ]);

  const handleVariableChange = useCallback((nextValue: number) => {
    const canManipulate = currentMode === 'free-explore' || predictionLocked;
    if (!currentChallenge || !changedVariable || changedVariableIndex < 0 || !canManipulate || challengeDone) return;
    const nextValues = [...currentValues];
    nextValues[changedVariableIndex] = nextValue;
    setCurrentValues(nextValues);
    const target = currentChallenge.targetValues[changedVariableIndex];
    if (Math.abs(nextValue - target) <= changedVariable.step / 2) {
      completeManipulation(nextValues);
    }
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
    if (!currentChallenge || currentMode !== 'construct-formula' || challengeDone) return;
    incrementAttempts();
    const assembled = selectedFormulaTokenIndexes.map((index) => formulaTokens[index]);
    const correct = assembled.length === formulaTokens.length
      && assembled.every((token, index) => token === formulaTokens[index]);
    if (!correct) {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: 'That sequence does not represent the relationship yet. Check the operator order and parentheses, then revise it.',
      });
      sendText(
        `[ANSWER_INCORRECT] The student's formula construction does not yet match on challenge ${currentIndex + 1}, attempt ${currentAttempts + 1}. ` +
        `Coach the next step within this tier policy. ${tierTutorPolicy}`,
        { silent: true },
      );
      return;
    }
    finishChallenge(
      true,
      100,
      'Your constructed expression matches the living relationship.',
      { assembledExpression: assembled.join(' ') },
      currentAttempts + 1,
    );
  }, [
    challengeDone,
    currentAttempts,
    currentChallenge,
    currentIndex,
    currentMode,
    finishChallenge,
    formulaTokens,
    incrementAttempts,
    selectedFormulaTokenIndexes,
    sendText,
    tierTutorPolicy,
  ]);

  const handleCheckTransfer = useCallback(() => {
    if (!currentChallenge || currentMode !== 'transfer-apply' || challengeDone) return;
    if (transferAnswer.trim().length === 0 || !hasRequiredJustification) return;
    const answer = Number(transferAnswer);
    if (!Number.isFinite(answer)) return;
    incrementAttempts();
    const expected = currentChallenge.expectedTargetOutput;
    const tolerance = Math.max(1e-6, Math.abs(expected) * 0.005);
    const correct = Math.abs(answer - expected) <= tolerance;
    if (!correct) {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: 'That output does not fit the transferred inputs yet. Substitute each shown value and keep the operation order intact.',
      });
      sendText(
        `[ANSWER_INCORRECT] The student's transfer calculation is not yet correct on challenge ${currentIndex + 1}, attempt ${currentAttempts + 1}. ` +
        `Coach the next step within this tier policy. ${tierTutorPolicy}`,
        { silent: true },
      );
      return;
    }
    setCurrentValues([...currentChallenge.targetValues]);
    finishChallenge(
      true,
      100,
      `Yes — the relationship gives ${formatNumber(expected)} ${outputUnit} in the new setting.`,
      { submittedOutput: answer, expectedOutput: expected, justification: justification.trim() || undefined },
      currentAttempts + 1,
    );
  }, [
    challengeDone,
    currentAttempts,
    currentChallenge,
    currentIndex,
    currentMode,
    finishChallenge,
    hasRequiredJustification,
    incrementAttempts,
    outputUnit,
    sendText,
    tierTutorPolicy,
    transferAnswer,
    justification,
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

  const handleNext = useCallback(() => {
    if (!challengeDone) return;
    advance();
  }, [challengeDone, advance]);

  useEffect(() => {
    if (!isComplete || hasSubmitted || completionSubmittedRef.current) return;
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
    challenges.length,
    challengeResults,
    challengeType,
    hintsViewed,
    submitResult,
    tierTutorPolicy,
    sendText,
  ]);

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
  const currentInputValue = changedVariableIndex >= 0 ? currentValues[changedVariableIndex] : undefined;
  const hasMoreChallenges = currentIndex + 1 < challenges.length;
  const isPredictionMode = currentMode === 'predict-direction' || currentMode === 'predict-magnitude';
  const canManipulate = currentMode === 'free-explore' || (isPredictionMode && predictionLocked);
  const outputRevealed = currentMode === 'free-explore'
    || (isPredictionMode && predictionLocked)
    || challengeDone;
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
  const selectedFormulaTokens = selectedFormulaTokenIndexes.map((index) => formulaTokens[index]);
  const availableFormulaTokenIndexes = formulaTokenOrder.filter(
    (index) => !selectedFormulaTokenIndexes.includes(index),
  );
  const transferSubstitution = currentMode === 'transfer-apply'
    ? substitutedExpression(expression, variables, currentChallenge?.targetValues ?? [])
    : '';

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
                      disabled={predictionLocked}
                      actualDirection={challengeDone ? currentChallenge.correctDirection : undefined}
                      actualPosition={challengeDone && currentMode === 'predict-magnitude' ? observedPredictionPosition : undefined}
                      onChange={setPredictionPosition}
                    />
                    {currentChallenge.requireJustification && !predictionLocked && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-200" htmlFor={`${resolvedInstanceId}-prediction-reason`}>
                          What in the formula supports your prediction?
                        </label>
                        <LuminaInput
                          id={`${resolvedInstanceId}-prediction-reason`}
                          value={justification}
                          onChange={(event) => setJustification(event.target.value)}
                          placeholder="State the variable's role or another piece of evidence"
                        />
                      </div>
                    )}
                    {!predictionLocked && (
                      <div className="mt-4 flex justify-center">
                        <LuminaActionButton
                          action="check"
                          disabled={predictionPosition === null || !hasRequiredJustification}
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
                      disabled={!canManipulate || challengeDone}
                      onValueChange={([value]) => handleVariableChange(value)}
                      silent
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
                      {currentChallenge.groupFormulaTokens
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
                                    onClick={() => setSelectedFormulaTokenIndexes((current) => [...current, index])}
                                    disabled={challengeDone}
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
                            onClick={() => setSelectedFormulaTokenIndexes((current) => [...current, index])}
                            disabled={challengeDone}
                          >
                            {formulaTokens[index]}
                          </LuminaButton>
                        ))}
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <LuminaButton
                        tone="subtle"
                        disabled={selectedFormulaTokenIndexes.length === 0 || challengeDone}
                        onClick={() => setSelectedFormulaTokenIndexes((current) => current.slice(0, -1))}
                      >
                        Undo token
                      </LuminaButton>
                      <LuminaActionButton
                        action="check"
                        disabled={selectedFormulaTokenIndexes.length === 0 || challengeDone}
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
                    {currentChallenge.showSubstitutionSetup && (
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
                      type="number"
                      inputMode="decimal"
                      value={transferAnswer}
                      disabled={challengeDone}
                      onChange={(event) => setTransferAnswer(event.target.value)}
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
                          value={justification}
                          disabled={challengeDone}
                          onChange={(event) => setJustification(event.target.value)}
                          placeholder="Briefly justify how the formula gives your output"
                        />
                      </>
                    )}
                    <div className="flex justify-center">
                      <LuminaActionButton
                        action="check"
                        disabled={transferAnswer.trim().length === 0 || challengeDone || !hasRequiredJustification}
                        onClick={handleCheckTransfer}
                      >
                        Check transferred output
                      </LuminaActionButton>
                    </div>
                  </LuminaPanel>
                )}
              </div>
            </div>

            {strategyCue === 'hint' && !challengeDone && (!isPredictionMode || !predictionLocked) && (
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

            {challengeDone && (
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

export default FormulaLab;
