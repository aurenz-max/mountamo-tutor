'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';

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

export interface BarModelChallenge {
  id?: string;
  evalMode: BarModelEvalMode;
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

export interface BarValue {
  label: string;
  value: number;
  color?: string;
}

export interface BarModelData {
  title: string;
  description: string;
  values: BarValue[];
  graphStyle?: BarModelGraphStyle;
  scale?: BarModelScale;
  challenge?: BarModelChallenge;

  // Eval injection (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onComplete?: (results: ChallengeResult[]) => void;
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
          {i < iconCount ? iconEmoji : '\u00A0'}
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
// Main component
// ---------------------------------------------------------------------------

const BarModel: React.FC<BarModelProps> = ({ data, className }) => {
  const graphStyle: BarModelGraphStyle = data.graphStyle ?? 'bar';
  const challenge = data.challenge;
  const challenges = useMemo(() => (challenge ? [challenge] : []), [challenge]);
  const challengeKey = challenge?.id ?? challenge?.evalMode ?? null;
  const resolvedInstanceId = data.instanceId ?? 'bar-model-default';

  // Local interaction state
  const [builtValues, setBuiltValues] = useState<BarValue[]>(data.values);
  const [chosenStep, setChosenStep] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Reset interaction state on challenge change
  useEffect(() => {
    setBuiltValues(data.values);
    setChosenStep(null);
    setSelectedOption(null);
    setSelectedBarIndex(null);
    setFeedback(null);
    setShowHint(false);
  }, [challengeKey, data.values]);

  // Challenge progress (always exactly 0 or 1 challenge)
  const {
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    currentAttempts,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (c) => c.id ?? 'bm-1',
  });

  // ── AI tutoring ──
  const aiPrimitiveData = useMemo(() => ({
    values: data.values.map((v) => `${v.label}: ${v.value}`).join(', '),
    value1: data.values[0]?.value,
    value2: data.values[1]?.value,
    barCount: data.values.length,
    title: data.title,
    graphStyle,
    evalMode: challenge?.evalMode,
    scaleStep: data.scale?.step,
    iconEmoji: data.scale?.iconEmoji,
    iconValue: data.scale?.iconValue,
    currentPrompt: challenge?.prompt,
    attemptNumber: currentAttempts,
  }), [data, graphStyle, challenge, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'bar-model',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K-5',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || data.values.length === 0) return;
    hasIntroducedRef.current = true;
    const labels = data.values
      .map((v) => `${v.label}${v.value > 0 ? ` (${v.value})` : ''}`)
      .join(', ');
    sendText(
      challenge?.narration
        ?? `[ACTIVITY_START] ${data.title}. Bars: ${labels}. ${challenge?.prompt ?? 'Help the student read the graph.'}`,
      { silent: true },
    );
  }, [isConnected, data.values, data.title, challenge, sendText]);

  // Fire onComplete once when the challenge resolves
  const completionFiredRef = useRef(false);
  useEffect(() => {
    if (isComplete && !completionFiredRef.current && data.onComplete) {
      completionFiredRef.current = true;
      data.onComplete(results);
    }
  }, [isComplete, results, data]);

  // ── Submission helpers ──
  const submitResult = useCallback((correct: boolean, extras: Record<string, unknown> = {}) => {
    incrementAttempts();
    setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) {
      recordResult({
        challengeId: challenge?.id ?? 'bm-1',
        correct: true,
        attempts: currentAttempts + 1,
        ...extras,
      });
    } else {
      setShowHint(true);
    }
  }, [incrementAttempts, recordResult, challenge, currentAttempts]);

  // ── Interaction handlers ──
  const handleBarClick = (i: number) => {
    if (!challenge || isComplete) return;
    if (challenge.evalMode === 'compare_bars') {
      const correct = challenge.targetBarIndex === i;
      setSelectedBarIndex(i);
      submitResult(correct, { selectedIndex: i });
    }
  };

  const handleOptionClick = (opt: number) => {
    if (!challenge || isComplete || feedback === 'correct') return;
    setSelectedOption(opt);
    const correct = opt === challenge.expectedValue;
    submitResult(correct, { selectedOption: opt });
  };

  const handleBuildSubmit = () => {
    if (!challenge || isComplete || feedback === 'correct') return;
    if (chosenStep == null) return; // student must pick a scale
    const expected = challenge.expectedDataset ?? [];
    const datasetCorrect = expected.length === builtValues.length
      && expected.every((e) => {
        const match = builtValues.find((b) => b.label === e.label);
        return match && match.value === e.value;
      });
    const stepCorrect = chosenStep === challenge.expectedScaleStep;
    submitResult(datasetCorrect && stepCorrect, {
      datasetCorrect,
      stepCorrect,
      chosenStep,
    });
  };

  const handleNext = () => {
    // Single-challenge primitive: nothing to advance to. onComplete already fired.
    // This button just provides a visual "I'm done" affordance.
  };

  // ── Derived render data ──
  const valuesToRender: BarValue[] =
    challenge?.evalMode === 'build_graph' ? builtValues : data.values;

  const scaleToRender: BarModelScale | undefined =
    challenge?.evalMode === 'build_graph' && data.scale
      ? { ...data.scale, step: chosenStep ?? data.scale.step }
      : data.scale;

  const showOptions =
    challenge && (
      challenge.evalMode === 'read_scale'
      || challenge.evalMode === 'picture_graph'
      || challenge.evalMode === 'scaled_bar_graph'
      || challenge.evalMode === 'graph_word_problem'
    );

  const highlightedIndex =
    challenge && (
      challenge.evalMode === 'read_scale'
      || challenge.evalMode === 'picture_graph'
      || challenge.evalMode === 'scaled_bar_graph'
    ) && typeof challenge.targetBarIndex === 'number'
      ? challenge.targetBarIndex
      : null;

  const compareFeedback =
    challenge?.evalMode === 'compare_bars' && selectedBarIndex != null && feedback
      ? { index: selectedBarIndex, correct: feedback === 'correct' }
      : null;

  // ---------------------------------------------------------------------------
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
              {challenge ? challenge.evalMode.replace(/_/g, ' ') : 'comparative visualization'}
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
            <h3 className="text-xl font-bold text-white mb-1">{data.title}</h3>
            <p className="text-slate-300 text-sm font-light">{data.description}</p>
          </div>

          {/* Challenge prompt */}
          {challenge ? (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-center">
              <p className="text-cyan-100 text-base font-medium">{challenge.prompt}</p>
            </div>
          ) : null}

          {/* Bars area */}
          <div className="px-2">
            <BarsArea
              values={valuesToRender}
              graphStyle={graphStyle}
              scale={scaleToRender}
              highlightedIndex={highlightedIndex}
              selectedIndex={selectedBarIndex}
              onBarClick={challenge?.evalMode === 'compare_bars' ? handleBarClick : undefined}
              clickable={challenge?.evalMode === 'compare_bars' && !isComplete}
              feedbackIndex={compareFeedback}
            />
          </div>

          {/* MC options */}
          {showOptions && challenge?.options && challenge.options.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {challenge.options.map((opt) => {
                const isSelected = selectedOption === opt;
                const isAnswer = challenge.expectedValue === opt;
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
                    disabled={isComplete}
                    onClick={() => handleOptionClick(opt)}
                    className={`min-w-[64px] px-4 py-2 border font-mono text-lg ${variantClass}`}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
          ) : null}

          {/* Build controls */}
          {challenge?.evalMode === 'build_graph' ? (
            <div className="space-y-4">
              <BuildControls
                values={builtValues}
                onChange={setBuiltValues}
                scaleSteps={challenge.availableScaleSteps ?? [1, 2, 5, 10]}
                chosenStep={chosenStep}
                onChooseStep={setChosenStep}
                disabled={isComplete}
              />
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  disabled={isComplete || chosenStep == null}
                  onClick={handleBuildSubmit}
                  className="px-6 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  Submit graph
                </Button>
              </div>
            </div>
          ) : null}

          {/* Feedback */}
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
                  {showHint && challenge?.hint ? (
                    <p className="text-rose-100/80 font-light">{challenge.hint}</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {isComplete ? (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={handleNext}
                className="px-6 py-2 bg-white/5 border border-white/20 text-slate-100 hover:bg-white/10"
              >
                Continue
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BarModel;
