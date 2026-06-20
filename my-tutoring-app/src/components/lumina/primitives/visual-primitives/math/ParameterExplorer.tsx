'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import katex from 'katex';
// @ts-ignore – CSS import works at runtime via Next.js loader
import 'katex/dist/katex.min.css';
import { Lightbulb } from 'lucide-react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaPanel,
  LuminaBadge,
  LuminaSlider,
  LuminaSectionLabel,
  LuminaCallout,
  LuminaPrompt,
  LuminaInput,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaFeedbackCard,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ParameterExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ParameterDef {
  symbol: string;
  name: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description: string;
}

export interface ParameterExplorerChallenge {
  id: string;
  type: 'explore' | 'predict-direction' | 'predict-value' | 'identify-relationship';
  instruction: string;
  /** For predict challenges */
  prediction?: {
    varyParameter: string;
    newValue?: number;
    correctDirection?: 'increase' | 'decrease' | 'stay-same';
    correctValue?: number;
    tolerance?: number;
    explanation: string;
  };
  /** For identify-relationship */
  correctParameter?: string;

  // ── Within-mode SUPPORT TIER overlays (set by the generator when config.difficulty
  //    is present). These withdraw EXPLANATORY OVERLAYS only — the sliders and the
  //    formula (the manipulable simulation) stay live at every tier. Absent ⇒ all
  //    overlays on (back-compat). See gemini-parameter-explorer.ts resolveSupportStructure. ──
  /** Show the big focal live OUTPUT readout. Off for real predictions (hard/medium)
   *  so the student can't slide to the asked value and read the answer off it. */
  showOutputReadout?: boolean;
  /** Show the numeric value beside each parameter slider. Off at hard. */
  showParamReadouts?: boolean;
  /** Show the amber "watch this slider" cue on the varied parameter. Off at hard. */
  showVaryHighlight?: boolean;
  /** Support tier for tutor-reveal calibration ('easy' | 'medium' | 'hard'). */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface ParameterExplorerData {
  title: string;
  description?: string;
  /** The formula in LaTeX */
  formula: string;
  /** JavaScript-evaluable expression using parameter symbols as variables */
  jsExpression: string;
  /** What the formula computes */
  outputName: string;
  outputUnit?: string;
  /** Domain context */
  context: string;
  /** Variable definitions with slider ranges */
  parameters: ParameterDef[];
  /** Guided observations */
  observations?: Array<{
    trigger: string;
    prompt: string;
  }>;
  challenges: ParameterExplorerChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ParameterExplorerMetrics>) => void;
}

// ============================================================================
// Phase Config
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  explore: { label: 'Explore', icon: '🔍', accentColor: 'blue' },
  'predict-direction': { label: 'Predict Direction', icon: '↕️', accentColor: 'amber' },
  'predict-value': { label: 'Predict Value', icon: '🎯', accentColor: 'purple' },
  'identify-relationship': { label: 'Identify Relationship', icon: '🔗', accentColor: 'emerald' },
};

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
// Helpers
// ============================================================================

/** Safely evaluate the JS expression with given parameter values */
function evaluateFormula(
  jsExpression: string,
  paramValues: Record<string, number>,
): number | null {
  try {
    const paramNames = Object.keys(paramValues);
    const paramVals = Object.values(paramValues);
    // Build a function with parameter names as arguments
    // eslint-disable-next-line no-new-func
    const fn = new Function(...paramNames, `"use strict"; return (${jsExpression});`);
    const result = fn(...paramVals);
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 1e6) / 1e6; // avoid floating-point noise
  } catch {
    return null;
  }
}

/**
 * Tier-aware tutor reveal clause. A living-sim tutor sees the full challenge data
 * (including outputValue and the correct answer) and can LEAK what a hard tier hid
 * on screen. This calibrates how much the tutor may say:
 *  - easy   → may name the relationship and walk the effect (the readouts already show it)
 *  - medium → nudge execution; do NOT name the relationship; ask what they predict
 *  - hard   → never state the parameter's effect, never read the output; ask what
 *             the student PREDICTS will happen and why, from the formula structure
 * At every tier: never reveal the final numeric answer.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  type: ParameterExplorerChallenge['type'] | undefined,
): string {
  // identify-relationship: the dominant parameter IS the answer — never name it at any tier.
  if (type === 'identify-relationship') {
    return 'REVEAL POLICY: never name which parameter dominates — ask the student where each '
      + 'parameter sits in the formula (multiplier vs additive, exponent) and let them decide.';
  }
  switch (tier) {
    case 'hard':
      return 'REVEAL POLICY (hard): the live output readout and value readouts are HIDDEN on '
        + 'screen — do NOT read the output value back, do NOT state the parameter\'s effect or '
        + 'name the relationship. Ask what the student PREDICTS will happen and why, reasoning '
        + 'from the formula. Never reveal the answer.';
    case 'medium':
      return 'REVEAL POLICY (medium): the output readout is hidden — nudge the student to predict '
        + 'the effect from the formula before sliding; do not name the relationship outright. '
        + 'Never reveal the answer.';
    case 'easy':
      return 'REVEAL POLICY (easy): the readouts are visible — you may name the relationship and '
        + 'point to the live readout as a self-check, but still let the student answer.';
    default:
      return 'REVEAL POLICY: guide without revealing the final answer.';
  }
}

/** Format a number for display */
function formatOutput(value: number): string {
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 0.001 && value !== 0)) {
    return value.toExponential(3);
  }
  // Up to 4 decimal places, trimming trailing zeros
  return parseFloat(value.toFixed(4)).toString();
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ParameterSliderProps {
  param: ParameterDef;
  value: number;
  locked: boolean;
  onValueChange: (value: number) => void;
  onToggleLock: () => void;
  highlighted?: boolean;
  /** Support-tier overlay: show the live numeric value of this parameter. The
   *  slider itself (the manipulable object) always renders. */
  showValueReadout?: boolean;
}

const ParameterSlider: React.FC<ParameterSliderProps> = ({
  param,
  value,
  locked,
  onValueChange,
  onToggleLock,
  highlighted,
  showValueReadout = true,
}) => {
  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        highlighted
          ? 'border-amber-400/50 bg-amber-500/10'
          : locked
          ? 'border-white/5 bg-slate-800/30 opacity-60'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-slate-100">
            {param.symbol}
          </span>
          <span className="text-xs text-slate-400">{param.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {showValueReadout && (
            <span className="text-sm font-mono text-slate-200">
              {formatOutput(value)}
              {param.unit && (
                <span className="text-slate-500 ml-0.5">{param.unit}</span>
              )}
            </span>
          )}
          <button
            onClick={onToggleLock}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              locked
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
            }`}
            title={locked ? 'Unlock parameter' : 'Lock parameter (hold constant)'}
          >
            {locked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
      {/* Bespoke interaction surface: the parameter slider control. */}
      <LuminaSlider
        accent="blue"
        min={param.min}
        max={param.max}
        step={param.step}
        value={[value]}
        disabled={locked}
        onValueChange={([v]) => onValueChange(v)}
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>
          {param.min}
          {param.unit || ''}
        </span>
        <span>
          {param.max}
          {param.unit || ''}
        </span>
      </div>
      {param.description && (
        <p className="text-[11px] text-slate-500 mt-1">{param.description}</p>
      )}
    </div>
  );
};

// ============================================================================
// Component
// ============================================================================

interface ParameterExplorerProps {
  data: ParameterExplorerData;
  className?: string;
}

const ParameterExplorer: React.FC<ParameterExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    formula,
    jsExpression,
    outputName,
    outputUnit,
    context,
    parameters,
    observations = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `parameter-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge Progress (shared hooks)
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  // Parameter values (keyed by symbol)
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const p of parameters) {
      initial[p.symbol] = p.default;
    }
    return initial;
  });

  // Locked parameters (hold-and-vary)
  const [lockedParams, setLockedParams] = useState<Set<string>>(new Set());

  // Track which parameters the student has explored (moved)
  const [exploredParams, setExploredParams] = useState<Set<string>>(new Set());

  // Observations that have been triggered
  const [triggeredObservations, setTriggeredObservations] = useState<Set<number>>(new Set());

  // Used hold-and-vary?
  const [usedHoldAndVary, setUsedHoldAndVary] = useState(false);

  // Challenge answer state
  const [selectedDirection, setSelectedDirection] = useState<'increase' | 'decrease' | 'stay-same' | null>(null);
  const [predictedValue, setPredictedValue] = useState('');
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const outputValue = useMemo(
    () => evaluateFormula(jsExpression, paramValues),
    [jsExpression, paramValues],
  );

  // ── Support-tier overlay flags (default ON when the field is absent — back-compat
  //    for sessions with no config.difficulty). The simulation object (sliders +
  //    formula) is always rendered; only these explanatory overlays withdraw. ──
  const showOutputReadout = currentChallenge?.showOutputReadout ?? true;
  const showParamReadouts = currentChallenge?.showParamReadouts ?? true;
  const showVaryHighlight = currentChallenge?.showVaryHighlight ?? true;
  const supportTier = currentChallenge?.supportTier;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ParameterExplorerMetrics>({
    primitiveType: 'parameter-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(
    () => ({
      formula,
      outputName,
      paramValues,
      outputValue,
      exploredParams: Array.from(exploredParams),
      lockedParams: Array.from(lockedParams),
      currentChallengeType: currentChallenge?.type,
      currentChallengeInstruction: currentChallenge?.instruction,
      challengeIndex: currentChallengeIndex,
      totalChallenges: challenges.length,
      supportTier,
    }),
    [
      formula,
      outputName,
      paramValues,
      outputValue,
      exploredParams,
      lockedParams,
      currentChallenge,
      currentChallengeIndex,
      challenges.length,
      supportTier,
    ],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'parameter-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 9-12',
  });

  // Introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Parameter Explorer: "${title}". Formula: ${formula}. `
      + `Context: ${context}. Parameters: ${parameters.map((p) => `${p.symbol} (${p.name})`).join(', ')}. `
      + `${challenges.length} challenges. Introduce the formula and explain what it describes.`,
      { silent: true },
    );
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleParamChange = useCallback(
    (symbol: string, value: number) => {
      SoundManager.tick();
      setParamValues((prev) => ({ ...prev, [symbol]: value }));
      setExploredParams((prev) => new Set(prev).add(symbol));
    },
    [],
  );

  const toggleLock = useCallback(
    (symbol: string) => {
      setLockedParams((prev) => {
        const next = new Set(prev);
        if (next.has(symbol)) {
          next.delete(symbol);
          SoundManager.toggle(false);
        } else {
          next.add(symbol);
          setUsedHoldAndVary(true);
          SoundManager.toggle(true);
        }
        return next;
      });
    },
    [],
  );

  // Reset answer state for a new challenge
  const resetAnswerState = useCallback(() => {
    setSelectedDirection(null);
    setPredictedValue('');
    setSelectedParameter(null);
    setAnswerFeedback(null);
    setShowExplanation(false);
  }, []);

  // Submit evaluation when all challenges complete
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;

    const correctCount = challengeResults.filter((r) => r.correct).length;
    const score = Math.round((correctCount / challenges.length) * 100);

    const phaseScoreStr = phaseResults
      .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${score}%. `
      + `Parameters explored: ${exploredParams.size}/${parameters.length}. `
      + `Used hold-and-vary: ${usedHoldAndVary}. Give encouraging phase-specific feedback.`,
      { silent: true },
    );

    submitEvaluation(score >= 60, score, {
      type: 'parameter-explorer',
      evalMode: challenges[0]?.type ?? 'default',
      predictionsCorrect: correctCount,
      predictionsTotal: challenges.length,
      parametersExplored: Array.from(exploredParams),
      observationsTriggered: triggeredObservations.size,
      usedHoldAndVary,
      explorationTime: Math.round((elapsedMs ?? 0) / 1000),
    });
  }, [
    hasSubmittedEvaluation,
    challenges,
    challengeResults,
    phaseResults,
    exploredParams,
    parameters.length,
    usedHoldAndVary,
    triggeredObservations.size,
    elapsedMs,
    sendText,
    submitEvaluation,
  ]);

  // Auto-submit when all challenges complete
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && challenges.length > 0) {
      handleSubmitEvaluation();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges.length, handleSubmitEvaluation]);

  // -------------------------------------------------------------------------
  // Challenge Answer Checking
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let isCorrect = false;

    switch (currentChallenge.type) {
      case 'explore': {
        // Explore mode: auto-advance after the student interacts
        isCorrect = exploredParams.size >= 1;
        break;
      }
      case 'predict-direction': {
        if (!selectedDirection || !currentChallenge.prediction) break;
        isCorrect = selectedDirection === currentChallenge.prediction.correctDirection;
        break;
      }
      case 'predict-value': {
        if (!predictedValue.trim() || !currentChallenge.prediction) break;
        const predicted = parseFloat(predictedValue);
        if (isNaN(predicted)) break;
        const correct = currentChallenge.prediction.correctValue ?? 0;
        const tol = currentChallenge.prediction.tolerance ?? Math.abs(correct * 0.1);
        isCorrect = Math.abs(predicted - correct) <= tol;
        break;
      }
      case 'identify-relationship': {
        if (!selectedParameter || !currentChallenge.correctParameter) break;
        isCorrect = selectedParameter === currentChallenge.correctParameter;
        break;
      }
    }

    incrementAttempts();
    if (isCorrect) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }
    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
    setShowExplanation(true);

    if (isCorrect) {
      sendText(
        `[ANSWER_CORRECT] Challenge ${currentChallengeIndex + 1}/${challenges.length}: `
        + `"${currentChallenge.instruction}" — Student answered correctly. Congratulate briefly.`,
        { silent: true },
      );
    } else {
      const studentAnswer =
        currentChallenge.type === 'predict-direction'
          ? selectedDirection
          : currentChallenge.type === 'predict-value'
          ? predictedValue
          : selectedParameter;
      sendText(
        `[ANSWER_INCORRECT] Challenge ${currentChallengeIndex + 1}/${challenges.length}: `
        + `"${currentChallenge.instruction}" — Student chose "${studentAnswer}" but correct is `
        + `"${currentChallenge.prediction?.correctDirection ?? currentChallenge.prediction?.correctValue ?? currentChallenge.correctParameter}". `
        + `Attempt ${currentAttempts + 1}. Give a hint. `
        + tutorRevealPolicy(currentChallenge.supportTier, currentChallenge.type),
        { silent: true },
      );
    }

    // Record result after a short delay for feedback
    const score = isCorrect ? 100 : Math.max(0, 100 - currentAttempts * 25);
    recordResult({
      challengeId: currentChallenge.id,
      correct: isCorrect,
      attempts: currentAttempts + 1,
      score,
    });
  }, [
    currentChallenge,
    selectedDirection,
    predictedValue,
    selectedParameter,
    exploredParams.size,
    currentAttempts,
    currentChallengeIndex,
    challenges.length,
    incrementAttempts,
    recordResult,
    sendText,
  ]);

  const handleNextChallenge = useCallback(() => {
    resetAnswerState();
    if (!advanceProgress()) {
      // All done — evaluation auto-submits via effect
      return;
    }
    const nextCh = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly. `
      + tutorRevealPolicy(nextCh?.supportTier, nextCh?.type),
      { silent: true },
    );
  }, [advanceProgress, resetAnswerState, currentChallengeIndex, challenges, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Observation Triggers
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Simple observation trigger check — we evaluate a basic text match
    // (a real implementation could parse trigger conditions)
    observations.forEach((obs, idx) => {
      if (triggeredObservations.has(idx)) return;
      // For now, trigger observations sequentially as the user explores
      if (idx <= exploredParams.size - 1) {
        setTriggeredObservations((prev) => new Set(prev).add(idx));
      }
    });
  }, [observations, exploredParams.size, triggeredObservations]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const correct = challengeResults.filter((r) => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [challengeResults, challenges.length]);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          {challenges.length > 0 && (
            <LuminaChallengeCounter
              current={currentChallengeIndex + 1}
              total={challenges.length}
            />
          )}
        </div>
        {(description || context) && (
          <p className="text-sm text-slate-400 mt-1">{description || context}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6">
        {/* ── Formula Display ── */}
        <LuminaPanel className="text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Formula</p>
          <MathDisplay latex={formula} display className="text-lg text-slate-100" />
          <p className="text-xs text-slate-500 mt-1">
            {outputName}
            {outputUnit && ` (${outputUnit})`}
          </p>
        </LuminaPanel>

        {/* ── Output Display (bespoke focal readout — a withdrawable OVERLAY) ──
            At harder tiers showOutputReadout is false: the live numeric result is
            hidden so the student must PREDICT the parameter's effect rather than
            read it off. The sliders + formula (the manipulable sim) stay live. */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-400/20 text-center">
          <p className="text-xs text-slate-400 mb-1">{outputName}</p>
          {showOutputReadout ? (
            <p className="text-3xl font-mono font-bold text-blue-300">
              {outputValue !== null ? formatOutput(outputValue) : '—'}
              {outputUnit && (
                <span className="text-base text-blue-400/60 ml-1">{outputUnit}</span>
              )}
            </p>
          ) : (
            <p className="text-3xl font-mono font-bold text-blue-300/40 select-none" title="Predict the result — readout hidden at this level">
              ?
            </p>
          )}
        </div>

        {/* ── Parameter Sliders ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <LuminaSectionLabel accent="blue" size="sm">Parameters</LuminaSectionLabel>
            {lockedParams.size > 0 && (
              <LuminaBadge accent="rose" className="text-xs">
                {lockedParams.size} locked — hold-and-vary mode
              </LuminaBadge>
            )}
          </div>
          {parameters.map((param) => (
            <ParameterSlider
              key={param.symbol}
              param={param}
              value={paramValues[param.symbol] ?? param.default}
              locked={lockedParams.has(param.symbol)}
              onValueChange={(v) => handleParamChange(param.symbol, v)}
              onToggleLock={() => toggleLock(param.symbol)}
              showValueReadout={showParamReadouts}
              highlighted={
                currentChallenge?.type === 'predict-direction' ||
                currentChallenge?.type === 'predict-value'
                  ? showVaryHighlight &&
                    currentChallenge.prediction?.varyParameter === param.symbol
                  : currentChallenge?.type === 'identify-relationship'
                  ? selectedParameter === param.symbol
                  : false
              }
            />
          ))}
        </div>

        {/* ── Observation Prompts ── */}
        {observations.length > 0 && triggeredObservations.size > 0 && (
          <div className="space-y-2">
            {observations.map(
              (obs, idx) =>
                triggeredObservations.has(idx) && (
                  <LuminaCallout
                    key={idx}
                    accent="emerald"
                    label="Observe"
                    icon={<Lightbulb className="w-4 h-4" />}
                  >
                    {obs.prompt}
                  </LuminaCallout>
                ),
            )}
          </div>
        )}

        {/* ── Challenge Area ── */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="space-y-4">
            <LuminaPrompt>{currentChallenge.instruction}</LuminaPrompt>

            {/* Explore: just needs to interact with sliders */}
            {currentChallenge.type === 'explore' && (
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-3">
                  Move the sliders above to explore how the parameters affect the output.
                </p>
                <LuminaActionButton
                  action="check"
                  onClick={handleCheckAnswer}
                  disabled={exploredParams.size === 0}
                >
                  Done Exploring
                </LuminaActionButton>
              </div>
            )}

            {/* Predict Direction */}
            {currentChallenge.type === 'predict-direction' && (
              <div className="space-y-3">
                {currentChallenge.prediction && (
                  <p className="text-xs text-slate-500">
                    If <span className="font-mono text-slate-300">{currentChallenge.prediction.varyParameter}</span> changes,
                    what happens to <span className="font-mono text-slate-300">{outputName}</span>?
                  </p>
                )}
                <div className="flex gap-2 justify-center">
                  {(['increase', 'decrease', 'stay-same'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className={`rounded-xl border px-4 py-2 capitalize transition-all ${answerStateClass(
                        selectedDirection === dir ? 'selected' : 'idle',
                      )}`}
                      onClick={() => {
                        SoundManager.select();
                        setSelectedDirection(dir);
                      }}
                      disabled={answerFeedback !== null}
                    >
                      {dir === 'increase' ? '📈 Increase' : dir === 'decrease' ? '📉 Decrease' : '➡️ Stay Same'}
                    </button>
                  ))}
                </div>
                {answerFeedback === null && selectedDirection && (
                  <div className="text-center">
                    <LuminaActionButton action="check" onClick={handleCheckAnswer} />
                  </div>
                )}
              </div>
            )}

            {/* Predict Value */}
            {currentChallenge.type === 'predict-value' && (
              <div className="space-y-3">
                {currentChallenge.prediction && (
                  <p className="text-xs text-slate-500">
                    If <span className="font-mono text-slate-300">{currentChallenge.prediction.varyParameter}</span>{' '}
                    {currentChallenge.prediction.newValue !== undefined
                      ? `changes to ${currentChallenge.prediction.newValue}`
                      : 'changes'}
                    , what will <span className="font-mono text-slate-300">{outputName}</span> be?
                  </p>
                )}
                <div className="flex items-center gap-2 justify-center">
                  <LuminaInput
                    type="number"
                    value={predictedValue}
                    onChange={(e) => setPredictedValue(e.target.value)}
                    placeholder="Your prediction..."
                    disabled={answerFeedback !== null}
                    className="w-40 text-center font-mono"
                  />
                  {outputUnit && <span className="text-sm text-slate-500">{outputUnit}</span>}
                </div>
                {answerFeedback === null && predictedValue.trim() && (
                  <div className="text-center">
                    <LuminaActionButton action="check" onClick={handleCheckAnswer} />
                  </div>
                )}
              </div>
            )}

            {/* Identify Relationship */}
            {currentChallenge.type === 'identify-relationship' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Select the parameter that has the strongest effect on{' '}
                  <span className="font-mono text-slate-300">{outputName}</span>.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {parameters.map((param) => (
                    <button
                      key={param.symbol}
                      type="button"
                      className={`rounded-xl border px-4 py-2 font-mono transition-all ${answerStateClass(
                        selectedParameter === param.symbol ? 'selected' : 'idle',
                      )}`}
                      onClick={() => {
                        SoundManager.select();
                        setSelectedParameter(param.symbol);
                      }}
                      disabled={answerFeedback !== null}
                    >
                      {param.symbol}
                      <span className="ml-1 text-xs font-sans text-slate-400">({param.name})</span>
                    </button>
                  ))}
                </div>
                {answerFeedback === null && selectedParameter && (
                  <div className="text-center">
                    <LuminaActionButton action="check" onClick={handleCheckAnswer} />
                  </div>
                )}
              </div>
            )}

            {/* Feedback */}
            {answerFeedback && (
              <LuminaFeedbackCard status={answerFeedback}>
                {showExplanation && currentChallenge.prediction?.explanation
                  ? currentChallenge.prediction.explanation
                  : answerFeedback === 'correct'
                  ? 'Nicely done.'
                  : 'Take another look at how the parameters drive the output.'}
              </LuminaFeedbackCard>
            )}

            {/* Next button */}
            {answerFeedback !== null && (
              <div className="text-center">
                <LuminaActionButton action="next" onClick={handleNextChallenge}>
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish'}
                </LuminaActionButton>
              </div>
            )}
          </LuminaPanel>
        )}

        {/* ── Phase Summary ── */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Exploration Complete!"
            celebrationMessage="You explored the parameter relationships!"
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ParameterExplorer;
