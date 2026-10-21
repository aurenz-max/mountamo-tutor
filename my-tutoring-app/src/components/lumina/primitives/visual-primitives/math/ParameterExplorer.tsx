'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { bossAssignment } from '../../../components/live-activity/boss';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  DIRECTION_LABEL, describeParameterWork, evaluateFormula, formatOutput, parameterAsk, parameterCheck, parameterLabel,
  parameterMiss, promptFor, resultText, sliderLabel, startingValues, workspaceScene,
  type Direction, type ParameterWork, plainFormula,
} from './parameterExplorerWorkspace';
import {
  DOUBLE_MARKS_LEVER, DOUBLING_MODEL_LEVER, FIND_PARAMETER_LEVER, MODEL_PAIR_LEVER, PARAMETER_LEVERS, PRACTICE_NOTE,
  SCALING_MODEL_LEVER, SUBSTITUTION_LEVER, doubleMarks, doublingModel, modelPair, scalingModel, substitutionText, type Model,
} from './parameterExplorerLevers';

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
    /** The value the varied parameter moves to from its starting value (both predict modes). */
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
  /** Show the big focal live OUTPUT readout. The predict modes hide it until the answer is
   *  checked whatever this says, so the student cannot slide to the asked value and read it off. */
  showOutputReadout?: boolean;
  /** Show the numeric value beside each parameter slider. Off at hard. */
  showParamReadouts?: boolean;
  /** Show the amber "watch this slider" cue on the varied parameter. Off at hard. */
  showVaryHighlight?: boolean;
  /** Support tier the generator resolved ('easy' | 'medium' | 'hard'). */
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

const DIRECTION_ICON: Record<Direction, string> = { increase: '📈', decrease: '📉', 'stay-same': '➡️' };

const useParameterProgress = useWorkspaceProgressFor('parameter-explorer');

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
// Sub-Components
// ============================================================================

interface ParameterSliderProps {
  param: ParameterDef;
  value: number;
  locked: boolean;
  /** Closed while a checked answer waits for Try again. */
  disabled?: boolean;
  onValueChange: (value: number) => void;
  onToggleLock: () => void;
  highlighted?: boolean;
  /** Support-tier overlay: show the live numeric value of this parameter. The
   *  slider itself (the manipulable object) always renders. */
  showValueReadout?: boolean;
  /** `double_marks` lever: where the starting value and its double sit on the slider. */
  marks?: { start: number; double: number };
}

/** A model outside the item (a lever picture): each rule with its letter moved and what the rule gives. */
function ModelFigure({ model, lever }: { model: Model; lever: string }) {
  return (
    <figure data-lever={lever} className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
      <figcaption className="mb-2 text-xs text-slate-400">A model outside this formula</figcaption>
      <div className="space-y-1 font-mono">
        {model.rows.map((row) => (
          <p key={row.rule}>
            {row.rule}: {model.input} {formatOutput(row.from)} → {formatOutput(row.to)}, {model.output} {formatOutput(row.outFrom)} → {formatOutput(row.outTo)}
          </p>
        ))}
      </div>
    </figure>
  );
}

const ParameterSlider: React.FC<ParameterSliderProps> = ({
  param,
  value,
  locked,
  disabled,
  onValueChange,
  onToggleLock,
  highlighted,
  showValueReadout = true,
  marks,
}) => {
  const at = (v: number) => `${((v - param.min) / Math.max(1e-9, param.max - param.min)) * 100}%`;
  return (
    <div
      data-parameter={param.symbol}
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
            type="button"
            onClick={onToggleLock}
            disabled={disabled}
            aria-label={locked ? `Unlock ${param.symbol}` : `Lock ${param.symbol}`}
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
        disabled={locked || disabled}
        onValueChange={([v]) => onValueChange(v)}
      />
      {/* The same control for the keyboard and the journey driver (the Radix thumb has no value input). */}
      <input
        type="range"
        className="sr-only"
        aria-label={sliderLabel(param)}
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        disabled={locked || disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
      {marks && (
        <div data-lever="double-marks" className="relative mt-1 h-4 text-[10px] text-amber-300" aria-hidden="true">
          <span className="absolute -translate-x-1/2" style={{ left: at(marks.start) }}>▲ start</span>
          <span className="absolute -translate-x-1/2" style={{ left: at(marks.double) }}>▲ ×2</span>
        </div>
      )}
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const ParameterExplorerSurface = ({ data, className, runtimePlanItemId }: ParameterExplorerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  const stableInstanceIdRef = useRef(instanceId || `parameter-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Challenge progress: the teaching workspace owns it. The hooks below are bound after render.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  /** Every ask reads the lab, so the assignment is built here from the boss's pieces; no key reaches the tutor. */
  const assignment = (challenge: ParameterExplorerChallenge) => bossAssignment(challenge.id, parameterAsk(data, challenge), null);
  const progress = useParameterProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId,
    objectiveId,
    planItemId: runtimePlanItemId,
    workspace,
    assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    results: challengeResults,
    isComplete: allChallengesComplete,
  } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

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
  // Parameter values (keyed by symbol). Every item opens at the starting values its ask is stated from.
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => startingValues(data));
  // Locked parameters (hold-and-vary)
  const [lockedParams, setLockedParams] = useState<Set<string>>(new Set());
  // Parameters the student has moved in the lesson (metrics), and on the current item (explore's check).
  const [exploredParams, setExploredParams] = useState<Set<string>>(new Set());
  const [movedThisItem, setMovedThisItem] = useState<string[]>([]);
  // Observations that have been triggered
  const [triggeredObservations, setTriggeredObservations] = useState<Set<number>>(new Set());
  const [usedHoldAndVary, setUsedHoldAndVary] = useState(false);
  // Challenge answer state
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [predictedValue, setPredictedValue] = useState('');
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);

  // In-item levers (`PARAMETER_LEVERS`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ParameterExplorerChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice problem. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const currentType = currentChallenge?.type;
  const isPredict = currentType === 'predict-direction' || currentType === 'predict-value';
  const outputValue = useMemo(
    () => evaluateFormula(jsExpression, paramValues),
    [jsExpression, paramValues],
  );
  /** The learner's work as the domain module reads it. */
  const work: ParameterWork = {
    direction: selectedDirection,
    value: predictedValue,
    parameter: selectedParameter,
    moved: movedThisItem,
  };
  /** The item is credited: the result and the explanation are on screen. */
  const itemClosed = answerFeedback === 'correct';

  // ── Support-tier overlay flags (default ON when the field is absent — back-compat
  //    for sessions with no config.difficulty). The simulation object (sliders +
  //    formula) is always rendered; only these explanatory overlays withdraw. In the
  //    predict modes the output is the answer, so it stays hidden until the item is
  //    credited at every tier. ──
  const showOutputReadout = isPredict ? itemClosed : currentChallenge?.showOutputReadout ?? true;
  const showParamReadouts = currentChallenge?.showParamReadouts ?? true;
  const showVaryHighlight = currentChallenge?.showVaryHighlight ?? true;
  /** Observation cards narrate relationships, which the checked modes ask for: explore only. */
  const observationsVisible = currentType === 'explore' || !currentChallenge;
  const shownObservations = observationsVisible
    ? observations.filter((_, idx) => triggeredObservations.has(idx)).map((obs) => obs.prompt)
    : [];

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
  // Handlers
  // -------------------------------------------------------------------------
  const handleParamChange = useCallback(
    (symbol: string, value: number) => {
      if (learnerBlocked()) return;
      SoundManager.tick();
      setParamValues((prev) => ({ ...prev, [symbol]: value }));
      setExploredParams((prev) => new Set(prev).add(symbol));
      setMovedThisItem((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleLock = useCallback(
    (symbol: string) => {
      if (learnerBlocked()) return;
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
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Reset the answer (Try again keeps the sliders as they are).
  const resetAnswerState = useCallback(() => {
    setSelectedDirection(null);
    setPredictedValue('');
    setSelectedParameter(null);
    setAnswerFeedback(null);
  }, []);
  // A fresh item opens at the starting values, unlocked, with nothing moved.
  const openFresh = useCallback(() => {
    resetAnswerState();
    setParamValues(startingValues(data));
    setLockedParams(new Set());
    setMovedThisItem([]);
  }, [resetAnswerState, data]);
  // The runtime opens each item (and reopens it after a miss) in the same commit as the scene. Try again on a practice
  // problem keeps it; a fresh item (or the full item back after practice) drops it.
  openItem.current = (_index, retry) => {
    if (retry) resetAnswerState();
    else { setPractice(null); openFresh(); }
  };

  // Under a lesson's evaluation provider only (the live host has none): the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  const submittedOnFinish = useRef(false);
  finish.current = (result) => {
    if (hasSubmittedEvaluation || submittedOnFinish.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submittedOnFinish.current = true;
    submitEvaluation(result.passed, result.accuracy, {
      type: 'parameter-explorer',
      evalMode: challenges[0]?.type ?? 'default',
      predictionsCorrect: result.firstTryCount,
      predictionsTotal: challenges.length,
      parametersExplored: Array.from(exploredParams),
      observationsTriggered: triggeredObservations.size,
      usedHoldAndVary,
      explorationTime: Math.round((elapsedMs ?? 0) / 1000),
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  // The activity's own check; the runtime records the verdict and the named miss.
  const handleCheckAnswer = () => {
    if (!currentChallenge || answerFeedback !== null || learnerBlocked()) return;
    const isCorrect = parameterCheck(data, currentChallenge, work);
    progress.commitCheck(
      describeParameterWork(data, currentChallenge, work),
      isCorrect,
      isCorrect ? undefined : parameterMiss(data, currentChallenge, work),
    );
    if (isCorrect) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
    // A credited item shows the asked setting on the sliders.
    const p = currentChallenge.prediction;
    if (isCorrect && p?.newValue !== undefined && parameters.some((x) => x.symbol === p.varyParameter)) {
      setParamValues({ ...startingValues(data), [p.varyParameter]: p.newValue });
    }
  };

  // -------------------------------------------------------------------------
  // Observation Triggers
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Observations open one by one as the learner moves more parameters.
    observations.forEach((obs, idx) => {
      if (triggeredObservations.has(idx)) return;
      if (idx <= exploredParams.size - 1) {
        setTriggeredObservations((prev) => new Set(prev).add(idx));
      }
    });
  }, [observations, exploredParams.size, triggeredObservations]);

  // What the tutor and the observer are shown, republished every render. No demonstration, no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(data, currentChallenge, {
      ...work,
      values: paramValues,
      locked: Array.from(lockedParams),
      outputShown: showOutputReadout,
      valuesShown: showParamReadouts,
      observations: shownObservations,
      solved: answerFeedback === 'correct',
    });
    const levers = practice ? [] : PARAMETER_LEVERS.declare(sessionChallenge, data, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : PARAMETER_LEVERS.support(sessionChallenge, data),
      onScreen: practice ? '' : PARAMETER_LEVERS.onScreen(sessionChallenge, data, pulledLevers),
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
          const easier = PARAMETER_LEVERS.simpler(sessionChallenge, data, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); openFresh();
          return { practice: assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); openFresh(); },
    };
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const correct = challengeResults.filter((r) => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [challengeResults, challenges.length]);

  const showSummary = allChallengesComplete && (hasSubmittedEvaluation || !!progress.practiceSummary);

  /** Answer controls: closed once the item is checked, and while a checked miss waits for Try again. */
  const answerClosed = answerFeedback !== null || blocked;
  const result = currentChallenge && itemClosed ? resultText(data, currentChallenge) : '';
  // Lever pictures, built for the session item (never drawn on a practice problem; `leverOn` is false there).
  const ringSymbol = sessionChallenge?.prediction?.varyParameter;
  const pairModel = sessionChallenge && leverOn(MODEL_PAIR_LEVER) ? modelPair(data, sessionChallenge) : null;
  const scaleModel = sessionChallenge && leverOn(SCALING_MODEL_LEVER) ? scalingModel(data, sessionChallenge) : null;
  const doubleModel = sessionChallenge && leverOn(DOUBLING_MODEL_LEVER) ? doublingModel(data, sessionChallenge) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
            {challenges.length > 0 && (
              <LuminaChallengeCounter
                current={currentChallengeIndex + 1}
                total={challenges.length}
              />
            )}
          </div>
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
          {/* `find_parameter` lever: the changed parameter ringed wherever it sits in the formula. */}
          {leverOn(FIND_PARAMETER_LEVER) && ringSymbol && (
            <p data-lever="find-parameter" className="mt-2 font-mono text-lg text-slate-200">
              {plainFormula(data).split(/([A-Za-z_][A-Za-z0-9_]*)/).map((token, i) => (token === ringSymbol
                ? <span key={i} className="rounded-full px-1.5 ring-2 ring-amber-300">{token}</span>
                : <span key={i}>{token}</span>))}
            </p>
          )}
          {/* `substitution` lever: the formula with the setting written in, not worked out. */}
          {leverOn(SUBSTITUTION_LEVER) && sessionChallenge && (
            <p data-lever="substitution" className="mt-2 font-mono text-base text-slate-200">{substitutionText(data, sessionChallenge)}</p>
          )}
        </LuminaPanel>

        {/* ── Output Display (bespoke focal readout — a withdrawable OVERLAY) ──
            Hidden in the predict modes until the answer is credited (it is the answer), and
            at the tiers that withdraw it elsewhere. The sliders + formula stay live. */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-400/20 text-center">
          <p className="text-xs text-slate-400 mb-1">{outputName}</p>
          {showOutputReadout ? (
            <p className="text-3xl font-mono font-bold text-blue-300" data-output="shown">
              {outputValue !== null ? formatOutput(outputValue) : '—'}
              {outputUnit && (
                <span className="text-base text-blue-400/60 ml-1">{outputUnit}</span>
              )}
            </p>
          ) : (
            <p className="text-3xl font-mono font-bold text-blue-300/40 select-none" data-output="hidden" title="Predict the result — the readout is hidden until you check">
              ?
            </p>
          )}
        </div>

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the workspace it outlines. */}
        <PipDock />
        <PipWorkspace className="space-y-6">
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
                disabled={blocked}
                onValueChange={(v) => handleParamChange(param.symbol, v)}
                onToggleLock={() => toggleLock(param.symbol)}
                showValueReadout={showParamReadouts}
                marks={leverOn(DOUBLE_MARKS_LEVER) ? doubleMarks(data).find((m) => m.symbol === param.symbol) : undefined}
                highlighted={
                  isPredict
                    ? showVaryHighlight && currentChallenge?.prediction?.varyParameter === param.symbol
                    : currentType === 'identify-relationship'
                    ? selectedParameter === param.symbol
                    : false
                }
              />
            ))}
            {leverOn(DOUBLE_MARKS_LEVER) && (
              <div className="text-center">
                <button
                  type="button"
                  disabled={blocked}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
                  onClick={() => {
                    if (learnerBlocked()) return;
                    SoundManager.select();
                    setParamValues(startingValues(data));
                  }}
                >
                  Back to start
                </button>
              </div>
            )}
          </div>

          {/* Lever pictures outside the item: none of its letters or numbers. */}
          {pairModel || scaleModel || doubleModel ? (
            <div className="space-y-2">
              {pairModel && <ModelFigure model={pairModel} lever="model-pair" />}
              {scaleModel && <ModelFigure model={scaleModel} lever="scaling-model" />}
              {doubleModel && <ModelFigure model={doubleModel} lever="doubling-model" />}
            </div>
          ) : null}

          {/* ── Observation Prompts (explore only: they narrate relationships the checked modes ask for) ── */}
          {shownObservations.length > 0 && (
            <div className="space-y-2">
              {shownObservations.map((prompt, idx) => (
                <LuminaCallout
                  key={idx}
                  accent="emerald"
                  label="Observe"
                  icon={<Lightbulb className="w-4 h-4" />}
                >
                  {prompt}
                </LuminaCallout>
              ))}
            </div>
          )}

          {/* ── Challenge Area ── */}
          {/* Stays up once the last item is credited, until the runtime closes the lesson. */}
          {currentChallenge && !showSummary && (
            <LuminaPanel className="space-y-4">
              <LuminaPrompt>{promptFor(data, currentChallenge)}</LuminaPrompt>

              {/* Explore: just needs to interact with sliders */}
              {currentChallenge.type === 'explore' && (
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-3">
                    Move the sliders above to explore how the parameters affect the output.
                  </p>
                  <LuminaActionButton
                    action="check"
                    onClick={handleCheckAnswer}
                    disabled={movedThisItem.length === 0 || answerClosed}
                  >
                    Done Exploring
                  </LuminaActionButton>
                </div>
              )}

              {/* Predict Direction */}
              {currentChallenge.type === 'predict-direction' && (
                <div className="space-y-3">
                  <div className="flex gap-2 justify-center">
                    {(['increase', 'decrease', 'stay-same'] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        aria-label={DIRECTION_LABEL[dir]}
                        className={`rounded-xl border px-4 py-2 transition-all ${answerStateClass(
                          selectedDirection === dir ? 'selected' : 'idle',
                        )}`}
                        onClick={() => {
                          if (learnerBlocked()) return;
                          SoundManager.select();
                          setSelectedDirection(dir);
                        }}
                        disabled={answerClosed}
                      >
                        <span aria-hidden="true">{DIRECTION_ICON[dir]} </span>{DIRECTION_LABEL[dir]}
                      </button>
                    ))}
                  </div>
                  {answerFeedback === null && selectedDirection && (
                    <div className="text-center">
                      <LuminaActionButton action="check" onClick={handleCheckAnswer} disabled={blocked} />
                    </div>
                  )}
                </div>
              )}

              {/* Predict Value */}
              {currentChallenge.type === 'predict-value' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-center">
                    <LuminaInput
                      type="number"
                      aria-label="Your prediction"
                      value={predictedValue}
                      onChange={(e) => { if (!learnerBlocked()) setPredictedValue(e.target.value); }}
                      placeholder="Your prediction..."
                      disabled={answerClosed}
                      className="w-40 text-center font-mono"
                    />
                    {outputUnit && <span className="text-sm text-slate-500">{outputUnit}</span>}
                  </div>
                  {answerFeedback === null && predictedValue.trim() && (
                    <div className="text-center">
                      <LuminaActionButton action="check" onClick={handleCheckAnswer} disabled={blocked} />
                    </div>
                  )}
                </div>
              )}

              {/* Identify Relationship */}
              {currentChallenge.type === 'identify-relationship' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {parameters.map((param) => (
                      <button
                        key={param.symbol}
                        type="button"
                        aria-label={parameterLabel(param)}
                        className={`rounded-xl border px-4 py-2 font-mono transition-all ${answerStateClass(
                          selectedParameter === param.symbol ? 'selected' : 'idle',
                        )}`}
                        onClick={() => {
                          if (learnerBlocked()) return;
                          SoundManager.select();
                          setSelectedParameter(param.symbol);
                        }}
                        disabled={answerClosed}
                      >
                        {param.symbol}
                        <span className="ml-1 text-xs font-sans text-slate-400">({param.name})</span>
                      </button>
                    ))}
                  </div>
                  {answerFeedback === null && selectedParameter && (
                    <div className="text-center">
                      <LuminaActionButton action="check" onClick={handleCheckAnswer} disabled={blocked} />
                    </div>
                  )}
                </div>
              )}

              {/* Feedback. A miss shows nothing new: the explanation and the result wait for credit. */}
              {answerFeedback && (
                <LuminaFeedbackCard status={answerFeedback}>
                  {itemClosed ? (
                    <>
                      {result && <span className="block">{result}</span>}
                      {currentChallenge.prediction?.explanation && (
                        <span className="block mt-1">{currentChallenge.prediction.explanation}</span>
                      )}
                      {!result && !currentChallenge.prediction?.explanation && 'Nicely done.'}
                    </>
                  ) : (
                    'Not yet. Look at where that parameter sits in the formula and think again.'
                  )}
                </LuminaFeedbackCard>
              )}
            </LuminaPanel>
          )}
        </PipWorkspace>

        {/* ── Phase Summary ── */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
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

const ParameterExplorer = withWorkspaceOnly<ParameterExplorerProps>('parameter-explorer', ParameterExplorerSurface, props => props.data.title);

export default ParameterExplorer;
