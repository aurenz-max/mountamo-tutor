'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import {
  usePrimitiveEvaluation,
  type BarModelMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';

// ---------------------------------------------------------------------------
// Public types (mirrored by the generator)
// ---------------------------------------------------------------------------

export type BarModelGraphStyle = 'bar' | 'scaled_bar' | 'picture';

export type BarModelEvalMode =
  | 'compare_bars'
  | 'read_scale'
  | 'picture_graph'
  | 'scaled_bar_graph'
  | 'graph_word_problem'
  | 'build_graph';

export interface BarModelScale {
  step: number;
  max: number;
  iconEmoji?: string;
  iconValue?: number;
}

export interface BarValue {
  label: string;
  value: number;
  color?: string;
}

export interface BarModelChallenge {
  id: string;
  evalMode: BarModelEvalMode;
  values: BarValue[];
  graphStyle: BarModelGraphStyle;
  scale?: BarModelScale;
  prompt: string;
  hint?: string;
  narration?: string;
  expectedValue?: number;
  options?: number[];
  targetBarIndex?: number;
  expectedDataset?: { label: string; value: number }[];
  expectedScaleStep?: number;
  availableScaleSteps?: number[];
}

export interface BarModelData {
  title: string;
  description: string;
  /** 3-6 challenges. Walked sequentially. */
  challenges: BarModelChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BarModelMetrics>) => void;
}

interface BarModelProps {
  data: BarModelData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const COLOR_PALETTE: Record<string, string> = {
  blue: 'rgb(59, 130, 246)',
  green: 'rgb(34, 197, 94)',
  purple: 'rgb(168, 85, 247)',
  orange: 'rgb(249, 115, 22)',
  pink: 'rgb(236, 72, 153)',
  yellow: 'rgb(234, 179, 8)',
  cyan: 'rgb(34, 211, 238)',
  red: 'rgb(239, 68, 68)',
};

const ORDERED_COLORS = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow'];

const resolveColor = (color: string | undefined, i: number): string => {
  if (color && COLOR_PALETTE[color.toLowerCase()]) return COLOR_PALETTE[color.toLowerCase()];
  if (color && /^(#|rgb)/i.test(color)) return color;
  return COLOR_PALETTE[ORDERED_COLORS[i % ORDERED_COLORS.length]];
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BarsAreaProps {
  values: BarValue[];
  graphStyle: BarModelGraphStyle;
  scale?: BarModelScale;
  highlightedIndex?: number | null;
  selectedIndex?: number | null;
  onBarClick?: (i: number) => void;
  clickable?: boolean;
  feedbackIndex?: { index: number; correct: boolean } | null;
}

const BarsArea: React.FC<BarsAreaProps> = ({
  values,
  graphStyle,
  scale,
  highlightedIndex = null,
  selectedIndex = null,
  onBarClick,
  clickable = false,
  feedbackIndex = null,
}) => {
  const showAxis = (graphStyle === 'scaled_bar' || graphStyle === 'picture') && !!scale;
  const maxBar = Math.max(1, ...values.map((v) => v.value));
  const axisMax = scale?.max ?? maxBar;
  const ticks = useMemo(() => {
    if (!showAxis || !scale) return [];
    const step = scale.step || 1;
    const max = scale.max;
    const out: number[] = [];
    for (let t = 0; t <= max + 0.0001; t += step) out.push(Math.round(t * 100) / 100);
    return out;
  }, [showAxis, scale]);

  return (
    <div className="w-full">
      {/* Picture graph key */}
      {graphStyle === 'picture' && scale?.iconEmoji && scale?.iconValue ? (
        <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/10 text-sm text-slate-200">
          <span className="text-xl leading-none">{scale.iconEmoji}</span>
          <span className="font-mono">= {scale.iconValue} items</span>
        </div>
      ) : null}

      <div className="relative">
        {/* Vertical gridlines for scaled axes */}
        {showAxis && scale ? (
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {ticks.map((t, i) => {
              const left = (t / axisMax) * 100;
              const isMajor = t === 0 || t === scale.max;
              return (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 ${isMajor ? 'w-px bg-white/15' : 'w-px bg-white/5'}`}
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>
        ) : null}

        {/* Bars */}
        <div className="space-y-3 relative">
          {values.map((item, i) => {
            const isHighlighted = highlightedIndex === i;
            const isSelected = selectedIndex === i;
            const fb = feedbackIndex?.index === i ? feedbackIndex : null;
            const ringClass = fb
              ? fb.correct
                ? 'border-emerald-400 ring-2 ring-emerald-400/40'
                : 'border-rose-400 ring-2 ring-rose-400/40'
              : isSelected
                ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                : isHighlighted
                  ? 'border-amber-400 ring-2 ring-amber-400/40'
                  : 'border-white/10';

            const widthPct = graphStyle === 'bar'
              ? (item.value / maxBar) * 100
              : (item.value / Math.max(1, axisMax)) * 100;

            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={`font-medium ${isHighlighted ? 'text-amber-300' : 'text-slate-200'}`}>
                    {item.label}
                  </span>
                  {graphStyle !== 'picture' && !isHighlighted ? (
                    <span className="font-mono text-slate-400 text-xs">{item.value}</span>
                  ) : null}
                </div>

                {graphStyle === 'picture' && scale?.iconEmoji && scale?.iconValue ? (
                  <PictureBar
                    value={item.value}
                    iconEmoji={scale.iconEmoji}
                    iconValue={scale.iconValue}
                    axisMax={axisMax}
                    ringClass={ringClass}
                    onClick={clickable && onBarClick ? () => onBarClick(i) : undefined}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!(clickable && onBarClick)}
                    onClick={clickable && onBarClick ? () => onBarClick(i) : undefined}
                    className={`relative h-10 w-full bg-slate-800/50 rounded-lg overflow-hidden border ${ringClass} ${clickable ? 'cursor-pointer hover:border-white/30' : 'cursor-default'} transition`}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, widthPct))}%`,
                        backgroundColor: resolveColor(item.color, i),
                      }}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Axis tick labels */}
      {showAxis && scale ? (
        <div className="relative mt-2 h-5">
          {ticks.map((t, i) => {
            const left = (t / axisMax) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 text-xs font-mono text-slate-400 -translate-x-1/2"
                style={{ left: `${left}%` }}
              >
                {t}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

interface PictureBarProps {
  value: number;
  iconEmoji: string;
  iconValue: number;
  axisMax: number;
  ringClass: string;
  onClick?: () => void;
}

const PictureBar: React.FC<PictureBarProps> = ({ value, iconEmoji, iconValue, axisMax, ringClass, onClick }) => {
  const iconCount = Math.max(0, Math.round(value / iconValue));
  const maxIconCount = Math.max(1, Math.ceil(axisMax / iconValue));

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`grid gap-1 w-full px-2 py-1.5 rounded-lg border ${ringClass} bg-slate-800/30 ${onClick ? 'cursor-pointer hover:border-white/30' : 'cursor-default'} transition`}
      style={{ gridTemplateColumns: `repeat(${maxIconCount}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: maxIconCount }).map((_, i) => (
        <span key={i} className="text-2xl text-center leading-none select-none">
          {i < iconCount ? iconEmoji : ' '}
        </span>
      ))}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Build-graph controls (used only for build_graph mode)
// ---------------------------------------------------------------------------

interface BuildControlsProps {
  values: BarValue[];
  onChange: (values: BarValue[]) => void;
  scaleSteps: number[];
  chosenStep: number | null;
  onChooseStep: (s: number) => void;
  disabled?: boolean;
}

const BuildControls: React.FC<BuildControlsProps> = ({
  values,
  onChange,
  scaleSteps,
  chosenStep,
  onChooseStep,
  disabled,
}) => {
  const adjust = (i: number, delta: number) => {
    const next = values.map((v, idx) =>
      idx === i ? { ...v, value: Math.max(0, v.value + delta) } : v,
    );
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-mono">Adjust each bar</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {values.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10">
              <span className="text-sm text-slate-200">{v.label}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled || v.value === 0}
                  className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  onClick={() => adjust(i, -1)}
                  aria-label={`Decrease ${v.label}`}
                >
                  −
                </Button>
                <span className="font-mono text-slate-100 w-8 text-center">{v.value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  onClick={() => adjust(i, 1)}
                  aria-label={`Increase ${v.label}`}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-mono">Choose a scale step</p>
        <div className="flex flex-wrap gap-2">
          {scaleSteps.map((s) => (
            <Button
              key={s}
              variant="ghost"
              disabled={disabled}
              onClick={() => onChooseStep(s)}
              className={`px-4 py-2 border ${chosenStep === s ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100' : 'bg-white/5 border-white/20 text-slate-100 hover:bg-white/10'}`}
            >
              Step of {s}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase config (single phase — all challenges share one eval mode per session)
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  graph: { label: 'Graph', icon: '📊', accentColor: 'emerald' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BarModel: React.FC<BarModelProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `bar-model-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress (shared hooks) ──────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => 'graph',
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation hook ───────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<BarModelMetrics>({
    primitiveType: 'bar-model',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const graphStyle: BarModelGraphStyle = currentChallenge?.graphStyle ?? 'bar';

  // ── Per-challenge interaction state ────────────────────────────────────────
  const [builtValues, setBuiltValues] = useState<BarValue[]>(() => currentChallenge?.values ?? []);
  const [chosenStep, setChosenStep] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // Reset per-challenge state when the active challenge changes.
  useEffect(() => {
    if (!currentChallenge) return;
    setBuiltValues(currentChallenge.values);
    setChosenStep(null);
    setSelectedOption(null);
    setSelectedBarIndex(null);
    setFeedback(null);
    setShowHint(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── AI tutoring ────────────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    evalMode: currentChallenge?.evalMode,
    graphStyle,
    values: currentChallenge?.values.map((v) => `${v.label}: ${v.value}`).join(', ') ?? '',
    value1: currentChallenge?.values[0]?.value,
    value2: currentChallenge?.values[1]?.value,
    barCount: currentChallenge?.values.length ?? 0,
    scaleStep: currentChallenge?.scale?.step,
    iconEmoji: currentChallenge?.scale?.iconEmoji,
    iconValue: currentChallenge?.scale?.iconValue,
    currentPrompt: currentChallenge?.prompt,
    attemptNumber: currentAttempts,
  }), [title, currentIndex, challenges.length, currentChallenge, graphStyle, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'bar-model',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K-5',
  });

  // Session intro — once, on the first challenge
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    if (challenges.length === 0 || !currentChallenge) return;
    hasIntroducedRef.current = true;
    const labels = currentChallenge.values
      .map((v) => `${v.label}${v.value > 0 ? ` (${v.value})` : ''}`)
      .join(', ');
    sendText(
      currentChallenge.narration
        ?? `[ACTIVITY_START] ${title}. ${challenges.length} graph challenges in this session. ` +
          `Mode: ${currentChallenge.evalMode}. First graph bars: ${labels}. ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, title, sendText]);

  // Per-challenge handoff (skips the first because intro covers it)
  const lastAnnouncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge) return;
    if (!hasIntroducedRef.current) return;
    if (lastAnnouncedIdRef.current === null) {
      lastAnnouncedIdRef.current = currentChallenge.id;
      return;
    }
    if (lastAnnouncedIdRef.current === currentChallenge.id) return;
    lastAnnouncedIdRef.current = currentChallenge.id;
    const labels = currentChallenge.values
      .map((v) => `${v.label}${v.value > 0 ? ` (${v.value})` : ''}`)
      .join(', ');
    sendText(
      `[CHALLENGE_START] Challenge ${currentIndex + 1} of ${challenges.length}. ` +
      `Bars: ${labels}. ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [currentChallenge, currentIndex, challenges.length, isConnected, sendText]);

  // Session complete: AI summary + evaluation submit
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.attempts === 1 && r.correct).length;
    const hintsViewed = results.filter((r) => r.attempts > 1).length;
    // Per-challenge score: 100 if first try, then decays per extra attempt.
    const perChallengeScore = (r: typeof results[number]) =>
      r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + perChallengeScore(r), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const sessionMode = challenges[0].evalMode;
    const sessionGraphStyle = challenges[0].graphStyle;

    const metrics: BarModelMetrics = {
      type: 'bar-model',
      evalMode: sessionMode,
      graphStyle: sessionGraphStyle,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    const phaseStr = phaseResults
      .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseStr}. Overall: ${overallAccuracy}%. ` +
      `Celebrate completion of the ${challenges.length}-challenge graph session.`,
      { silent: true },
    );

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          evalMode: sessionMode,
          prompts: challenges.map((c) => c.prompt),
          attemptsPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return r?.attempts ?? 0;
          }),
        },
      });
    }
  }, [
    isComplete, results, phaseResults, challenges,
    sendText, submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Submission helper ──────────────────────────────────────────────────────
  const submitResult = useCallback(
    (correct: boolean, extras: Record<string, unknown> = {}) => {
      if (!currentChallenge) return;
      // Stale-state guard (PRD §6a #3): the reset useEffect's setBuiltValues
      // is async — on the render immediately after advance(), `builtValues`
      // still holds the previous challenge's bars while `currentChallenge`
      // has already moved on. Only proceed when bar labels line up.
      const stateMatches =
        currentChallenge.values.length === 0
        || builtValues.length === 0
        || builtValues[0]?.label === currentChallenge.values[0]?.label;
      if (!stateMatches) return;

      incrementAttempts();
      setFeedback(correct ? 'correct' : 'incorrect');
      if (correct) {
        if (recordedRef.current) return;
        recordedRef.current = true;
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          ...extras,
        });
        sendText(
          `[PHASE_COMPLETE] Challenge ${currentIndex + 1}/${challenges.length} solved on attempt ${currentAttempts + 1}. ` +
          `Briefly acknowledge and preview the next one if there is one.`,
          { silent: true },
        );
      } else {
        setShowHint(true);
      }
    },
    [
      currentChallenge, currentAttempts, builtValues,
      incrementAttempts, recordResult, sendText,
      currentIndex, challenges.length,
    ],
  );

  // ── Interaction handlers ───────────────────────────────────────────────────
  const handleBarClick = (i: number) => {
    if (!currentChallenge || feedback === 'correct' || isComplete) return;
    if (currentChallenge.evalMode === 'compare_bars') {
      const correct = currentChallenge.targetBarIndex === i;
      setSelectedBarIndex(i);
      submitResult(correct, { selectedIndex: i });
    }
  };

  const handleOptionClick = (opt: number) => {
    if (!currentChallenge || feedback === 'correct' || isComplete) return;
    setSelectedOption(opt);
    const correct = opt === currentChallenge.expectedValue;
    submitResult(correct, { selectedOption: opt });
  };

  const handleBuildSubmit = () => {
    if (!currentChallenge || feedback === 'correct' || isComplete) return;
    if (chosenStep == null) return;
    const expected = currentChallenge.expectedDataset ?? [];
    const datasetCorrect = expected.length === builtValues.length
      && expected.every((e) => {
        const match = builtValues.find((b) => b.label === e.label);
        return match && match.value === e.value;
      });
    const stepCorrect = chosenStep === currentChallenge.expectedScaleStep;
    submitResult(datasetCorrect && stepCorrect, {
      datasetCorrect,
      stepCorrect,
      chosenStep,
    });
  };

  const advanceToNextChallenge = () => {
    advance();
  };

  // ── Derived render data ────────────────────────────────────────────────────
  const valuesToRender: BarValue[] =
    currentChallenge?.evalMode === 'build_graph'
      ? builtValues
      : (currentChallenge?.values ?? []);

  const scaleToRender: BarModelScale | undefined =
    currentChallenge?.evalMode === 'build_graph' && currentChallenge.scale
      ? { ...currentChallenge.scale, step: chosenStep ?? currentChallenge.scale.step }
      : currentChallenge?.scale;

  const showOptions = currentChallenge && (
    currentChallenge.evalMode === 'read_scale'
    || currentChallenge.evalMode === 'picture_graph'
    || currentChallenge.evalMode === 'scaled_bar_graph'
    || currentChallenge.evalMode === 'graph_word_problem'
  );

  const highlightedIndex =
    currentChallenge && (
      currentChallenge.evalMode === 'read_scale'
      || currentChallenge.evalMode === 'picture_graph'
      || currentChallenge.evalMode === 'scaled_bar_graph'
    ) && typeof currentChallenge.targetBarIndex === 'number'
      ? currentChallenge.targetBarIndex
      : null;

  const compareFeedback =
    currentChallenge?.evalMode === 'compare_bars' && selectedBarIndex != null && feedback
      ? { index: selectedBarIndex, correct: feedback === 'correct' }
      : null;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-12 ${className || ''}`}>
        <div className="backdrop-blur-xl bg-slate-900/40 rounded-3xl border border-white/10 p-6 text-center">
          <p className="text-slate-300">No bar-model challenges available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-5xl mx-auto my-12 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Bar Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">
              {currentChallenge ? currentChallenge.evalMode.replace(/_/g, ' ') : 'comparative visualization'}
            </p>
          </div>
        </div>
      </div>

      <div className="backdrop-blur-xl bg-slate-900/40 rounded-3xl border border-white/10 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="relative z-10 space-y-6">
          {/* Title + description */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
            <p className="text-slate-300 text-sm font-light">{description}</p>
          </div>

          {/* Progress bar */}
          {!isComplete && challenges.length > 1 ? (
            <div className="flex items-center justify-center gap-3 text-xs text-emerald-300 font-mono uppercase tracking-wider">
              <span>Challenge {Math.min(currentIndex + 1, challenges.length)} of {challenges.length}</span>
              <div className="flex gap-1.5">
                {challenges.map((ch, idx) => {
                  const done = results.some((r) => r.challengeId === ch.id);
                  const isCurrent = idx === currentIndex && !isComplete;
                  return (
                    <div
                      key={ch.id}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        done
                          ? 'bg-green-400/70 border-green-300/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : isCurrent
                          ? 'bg-emerald-400/70 border-emerald-300/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                          : 'bg-slate-700/40 border-slate-600/50'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Per-challenge UI */}
          {!isComplete && currentChallenge ? (
            <>
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-center">
                <p className="text-cyan-100 text-base font-medium">{currentChallenge.prompt}</p>
              </div>

              <div className="px-2">
                <BarsArea
                  values={valuesToRender}
                  graphStyle={graphStyle}
                  scale={scaleToRender}
                  highlightedIndex={highlightedIndex}
                  selectedIndex={selectedBarIndex}
                  onBarClick={currentChallenge.evalMode === 'compare_bars' ? handleBarClick : undefined}
                  clickable={currentChallenge.evalMode === 'compare_bars' && feedback !== 'correct'}
                  feedbackIndex={compareFeedback}
                />
              </div>

              {showOptions && currentChallenge.options && currentChallenge.options.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {currentChallenge.options.map((opt) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = currentChallenge.expectedValue === opt;
                    const variantClass = isSelected
                      ? feedback === 'correct'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                        : 'bg-rose-500/20 border-rose-400 text-rose-100'
                      : feedback === 'correct' && isAnswer
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                        : 'bg-white/5 border-white/20 text-slate-100 hover:bg-white/10';
                    return (
                      <Button
                        key={opt}
                        variant="ghost"
                        disabled={feedback === 'correct'}
                        onClick={() => handleOptionClick(opt)}
                        className={`min-w-[64px] px-4 py-2 border font-mono text-lg ${variantClass}`}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </div>
              ) : null}

              {currentChallenge.evalMode === 'build_graph' ? (
                <div className="space-y-4">
                  <BuildControls
                    values={builtValues}
                    onChange={setBuiltValues}
                    scaleSteps={currentChallenge.availableScaleSteps ?? [1, 2, 5, 10]}
                    chosenStep={chosenStep}
                    onChooseStep={setChosenStep}
                    disabled={feedback === 'correct'}
                  />
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      disabled={feedback === 'correct' || chosenStep == null}
                      onClick={handleBuildSubmit}
                      className="px-6 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                    >
                      Submit graph
                    </Button>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <div className={`rounded-xl px-4 py-3 text-center border ${
                  feedback === 'correct'
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                }`}>
                  {feedback === 'correct' ? (
                    <p className="text-sm font-medium">Nice work — that&apos;s correct.</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Not quite — try again.</p>
                      {showHint && currentChallenge.hint ? (
                        <p className="text-rose-100/80 font-light">{currentChallenge.hint}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {feedback === 'correct' ? (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={advanceToNextChallenge}
                    className="px-6 py-2 bg-emerald-500/30 border border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/40"
                  >
                    {currentIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish Session'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Phase summary panel */}
          {isComplete && phaseResults.length > 0 ? (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={submittedResult?.score}
              durationMs={elapsedMs}
              heading="Graph Session Complete!"
              celebrationMessage={`You worked through ${challenges.length} graph ${challenges.length === 1 ? 'challenge' : 'challenges'}!`}
              className="mt-4"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BarModel;
