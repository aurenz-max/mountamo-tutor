'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaPanel,
  LuminaButton,
  LuminaPrompt,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaSectionLabel,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type BarModelMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { buildPictureGraphEvidence } from './barModelEvidence';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import type { PipTarget } from '../../../pip/PipSurfaceStore';
import { barModelPipPose } from '../../../pip/barModelPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { OPTION_MODES, ROW_TAP_MODES, barModelMiss, describeGraphWork, workspaceAssignment, workspaceScene, type BarModelView }
  from './barModelWorkspace';
import { COUNTS_LEVER, LINE_LEVER, TWO_BARS_LEVER, isPracticeGraph, levelLineRow, makeGraphLevers, makeGraphMiss,
  makeGraphVerdict, twoBarPractice, GRAPH_MAX, type GraphRule } from './barModelBuild';
import { GraphBuildScene } from './GraphBuildScene';
import { BAR_VALUES, DATA_BESIDE, GROUP_FIVES, GUIDE_LINE, ICON_VALUES, MARK_BARS, MARK_ROW, MINOR_TICKS, PAIR_ROWS, PILE_ROW,
  PRACTICE_NOTE, SORT_PILE, STEP_MARKS, WORD_MODEL, barModelLevers, fivesRows, isSimplerGraph, leverFacts, leverRefusal, minorStep,
  namedRows, simplerGraph, stepMarks, wordModel, type WordModel } from './barModelLevers';
import { useBuildWatcher } from '../../build-layer/buildLayer';

// ---------------------------------------------------------------------------
// Public types (mirrored by the generator)
// ---------------------------------------------------------------------------

export type BarModelGraphStyle = 'bar' | 'scaled_bar' | 'picture';

export type BarModelEvalMode =
  // K one-to-one data family (K.MD.B.3) — one icon per object, no scale to read.
  | 'build_one_to_one'
  | 'read_one_to_one'
  | 'match_to_bar'
  | 'say_what_it_shows'
  | 'compare_two_graphs'
  | 'most_least'
  | 'compare_bars'
  | 'read_scale'
  | 'picture_graph'
  | 'scaled_bar_graph'
  | 'graph_word_problem'
  | 'build_graph'
  // Open build: set the bars of an empty graph so the data fits an ask (barModelBuild.ts).
  | 'make_graph';

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
  /** Per-row icon for one-to-one picture rows. Falls back to scale.iconEmoji. */
  emoji?: string;
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
  /** K one-to-one: the collection the child records from (build) or counts (match). */
  sourceItems?: { emoji: string; categoryIndex: number }[];
  /** K one-to-one: draw the source as a mixed pile rather than tidy groups. */
  sourceScattered?: boolean;
  /** build_one_to_one answer key — the true count for each row, in row order. */
  expectedCounts?: number[];
  /** match_to_bar: how many objects are in the stimulus cluster. */
  stimulusCount?: number;
  /** Related surveys use the same categories and icon scale. */
  graphLabel?: string;
  secondGraphLabel?: string;
  secondValues?: BarValue[];
  comparisonFocus?: 'same' | 'different';
  /**
   * Support-tier scaffolds (set by the generator from config.difficulty).
   * showBarValues = numeric readout next to NON-answer bars; showTargetHighlight
   * = amber "read this" cue. Both default ON when absent (no tier applied).
   */
  showBarValues?: boolean;
  showTargetHighlight?: boolean;
  /** build_one_to_one: show how many stickers the child has placed so far. */
  showPlacedCount?: boolean;
  supportTier?: 'easy' | 'medium' | 'hard';
  /** make_graph: what the made graph must show. Any data that fits passes; there is no answer key. */
  graphRule?: GraphRule;
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
  runtimePlanItemId?: string;
  /** The RESOLVED eval-mode pin from a live mount. */
  runtimeEvalMode?: string;
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

/** Re-alpha an `rgb(r, g, b)` string to `rgba(r, g, b, a)`; passthrough otherwise. */
const withAlpha = (color: string, a: number): string =>
  color.startsWith('rgb(') ? color.replace('rgb(', 'rgba(').replace(')', `, ${a})`) : color;

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
  /** Support tier: show the numeric value readout next to each bar (perception aid). */
  showBarValues?: boolean;
  /** The bar whose value IS the answer — its number is NEVER shown, at any tier. */
  answerBarIndex?: number | null;
  /** K build: mark empty picture cells so the child can see where a sticker goes. */
  showEmptySlots?: boolean;
  /** K build: show how many stickers the child has placed in each row so far. */
  showPlacedCount?: boolean;
  /** Registers each row (label and bar) as a Pip target. */
  rowRef?: (id: string) => (element: Element | null) => void;
  /** Lever `mark_bars`: more rows with the amber mark. */
  markedRows?: readonly number[];
  /** Lever `group_fives`: the rows drawn with a gap after every fifth picture. */
  fivesRows?: readonly number[];
  /** Lever `guide_line`: a dashed line at the end of this row's bar, down to the axis. */
  guideRow?: number | null;
  /** Lever `minor_ticks`: unlabelled axis marks at this spacing. */
  minorStep?: number | null;
  /** Lever `icon_values`: the key's number under every picture. */
  iconValues?: boolean;
  /** Lever `pile_row`: the group to count, drawn as a row in the graph's columns above the rows. */
  pileRow?: { emoji: string; count: number } | null;
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
  showBarValues = true,
  answerBarIndex = null,
  showEmptySlots = false,
  showPlacedCount = false,
  rowRef,
  markedRows = [],
  fivesRows = [],
  guideRow = null,
  minorStep = null,
  iconValues = false,
  pileRow = null,
}) => {
  // A one-to-one chart carries NO numeric axis: the icons are the count, and a
  // numbered axis under them lets the child read the answer off the scale
  // instead of counting — which is the K skill itself. Scaled bars and 1-icon-
  // = N picture graphs keep theirs; reading the axis is their skill.
  const showAxis = (graphStyle === 'scaled_bar' || (graphStyle === 'picture' && (scale?.iconValue ?? 1) > 1)) && !!scale;
  const maxBar = Math.max(1, ...values.map((v) => v.value));
  const axisMax = Math.max(scale?.max ?? maxBar, pileRow?.count ?? 0);
  const minorTicks = showAxis && minorStep ? Array.from({ length: Math.floor(axisMax / minorStep) + 1 }, (_, k) => k * minorStep)
    .filter(t => !scale || Math.abs(t / (scale.step || 1) - Math.round(t / (scale.step || 1))) > 1e-9) : [];
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
      {graphStyle === 'picture' && scale?.iconEmoji && (scale?.iconValue ?? 1) > 1 ? (
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
            {minorTicks.map(t => (
              <div key={`m${t}`} data-lever="minor-tick" className="absolute top-0 bottom-0 w-px border-l border-dotted border-white/10"
                style={{ left: `${(t / axisMax) * 100}%` }} />
            ))}
            {guideRow != null && values[guideRow] ? (
              <div data-lever="guide-line" className="absolute -top-1 -bottom-3 border-l-2 border-dashed border-amber-300/80"
                style={{ left: `${Math.min(100, (values[guideRow].value / Math.max(1, axisMax)) * 100)}%` }} />
            ) : null}
          </div>
        ) : null}

        {/* Bars */}
        <div className="space-y-3 relative">
          {pileRow ? (
            <div data-lever="pile-row" className="space-y-1">
              <div className="text-sm font-medium text-cyan-200">The group</div>
              <PictureBar value={pileRow.count} iconEmoji={pileRow.emoji} iconValue={1} axisMax={axisMax}
                ringClass="border-dashed border-cyan-300/40" />
            </div>
          ) : null}
          {values.map((item, i) => {
            const isHighlighted = highlightedIndex === i || markedRows.includes(i);
            const isSelected = selectedIndex === i;
            const fb = feedbackIndex?.index === i ? feedbackIndex : null;
            // Grading state (selected/correct/incorrect) is FRAME → tokenized
            // via answerStateClass so it matches the eval language everywhere.
            // The amber "look-here" highlight is a bespoke hint cue, kept local.
            const ringClass = fb
              ? fb.correct
                ? answerStateClass('correct')
                : answerStateClass('incorrect')
              : isSelected
                ? answerStateClass('selected')
                : isHighlighted
                  ? 'border-amber-400 ring-2 ring-amber-400/40'
                  : 'border-white/10';

            const widthPct = graphStyle === 'bar'
              ? (item.value / maxBar) * 100
              : (item.value / Math.max(1, axisMax)) * 100;

            // The answer bar's value is hidden at EVERY tier; other bars' values
            // are a tier-controlled perception aid, anchored to the bar's tip.
            const showValueLabel = graphStyle !== 'picture' && showBarValues && i !== answerBarIndex;
            const fillColor = resolveColor(item.color, i);
            const clampedWidth = Math.max(0, Math.min(100, widthPct));

            return (
              <div key={i} ref={rowRef?.(`row-${i}`)} data-pip-object={rowRef ? `row-${i}` : undefined} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-medium ${isHighlighted ? 'text-amber-300' : 'text-slate-200'}`}>
                    {item.label}
                  </span>
                  {showPlacedCount ? (
                    <span className="font-mono text-xs text-slate-400">{item.value} placed</span>
                  ) : null}
                </div>

                {graphStyle === 'picture' && (item.emoji || scale?.iconEmoji) ? (
                  <PictureBar
                    value={item.value}
                    iconEmoji={item.emoji ?? scale?.iconEmoji ?? '⭐'}
                    iconValue={scale?.iconValue ?? 1}
                    axisMax={axisMax}
                    ringClass={ringClass}
                    showEmptySlots={showEmptySlots}
                    label={item.label}
                    groupFives={fivesRows.includes(i)}
                    iconValueLabel={iconValues && (scale?.iconValue ?? 1) > 1 ? scale?.iconValue ?? null : null}
                    onClick={clickable && onBarClick ? () => onBarClick(i) : undefined}
                  />
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!(clickable && onBarClick)}
                      aria-label={clickable && onBarClick ? `${item.label} row` : undefined}
                      onClick={clickable && onBarClick ? () => onBarClick(i) : undefined}
                      className={`relative h-10 w-full bg-black/20 rounded-xl overflow-hidden border ${ringClass} ${clickable ? 'cursor-pointer hover:border-white/30' : 'cursor-default'} transition`}
                    >
                      <div
                        className="h-full rounded-xl transition-all duration-500"
                        style={{
                          width: `${clampedWidth}%`,
                          background: `linear-gradient(90deg, ${withAlpha(fillColor, 0.75)} 0%, ${fillColor} 100%)`,
                          boxShadow: `0 0 18px ${withAlpha(fillColor, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.18)`,
                        }}
                      />
                    </button>
                    {/* Value pinned to the bar's tip — "this bar reaches N". */}
                    {showValueLabel ? (
                      <span
                        className="absolute top-1/2 -translate-y-1/2 font-mono text-xs text-slate-300 pointer-events-none transition-all duration-500"
                        style={{ left: `min(calc(${clampedWidth}% + 8px), calc(100% - 22px))` }}
                      >
                        {item.value}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Axis tick labels */}
      {showAxis && scale ? (
        <div className="relative mt-2 h-5">
          {minorTicks.map(t => (
            <div key={`m${t}`} aria-hidden className="absolute top-0 h-1.5 w-px bg-slate-500" style={{ left: `${(t / axisMax) * 100}%` }} />
          ))}
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
  showEmptySlots?: boolean;
  /** The row's name, the tappable button's label. */
  label?: string;
  onClick?: () => void;
  /** Lever `group_fives`: a gap after every fifth cell. */
  groupFives?: boolean;
  /** Lever `icon_values`: this number under every picture. Never a running total. */
  iconValueLabel?: number | null;
}

const PictureBar: React.FC<PictureBarProps> = ({ value, iconEmoji, iconValue, axisMax, ringClass, showEmptySlots = false, label, onClick,
  groupFives = false, iconValueLabel = null }) => {
  const iconCount = Math.max(0, Math.round(value / iconValue));
  const maxIconCount = Math.max(1, Math.ceil(axisMax / iconValue));

  return (
    <button
      type="button"
      disabled={!onClick}
      aria-label={onClick && label ? `${label} row` : undefined}
      onClick={onClick}
      className={`grid gap-1 w-full px-2 py-1.5 rounded-lg border ${ringClass} bg-slate-800/30 ${onClick ? 'cursor-pointer hover:border-white/30' : 'cursor-default'} transition`}
      style={{ gridTemplateColumns: `repeat(${maxIconCount}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: maxIconCount }).map((_, i) => {
        const gap = groupFives && (i + 1) % 5 === 0 && i < maxIconCount - 1;
        return (
          <span
            key={i}
            data-five-gap={gap ? 'true' : undefined}
            className={`text-2xl text-center leading-none select-none ${i < iconCount ? '' : 'text-white/20'} ${gap ? 'mr-3 border-r-2 border-dashed border-amber-300/50 pr-1' : ''}`}
          >
            {i < iconCount ? iconEmoji : (showEmptySlots ? '○' : ' ')}
            {iconValueLabel != null && i < iconCount ? (
              <span data-lever="icon-value" className="block text-[10px] font-mono text-amber-200">{iconValueLabel}</span>
            ) : null}
          </span>
        );
      })}
    </button>
  );
};

// ---------------------------------------------------------------------------
// K one-to-one data family (build_one_to_one, read_one_to_one, match_to_bar,
// most_least). The pile the child records from — or, in match_to_bar, the group
// they count before choosing a row. Never labelled with its own total.
// ---------------------------------------------------------------------------

interface SourceCollectionProps {
  items: { emoji: string; categoryIndex: number }[];
  scattered?: boolean;
  heading: string;
  /** Lever `sort_pile`: one line per kind, in the order of the rows. */
  sorted?: boolean;
}

const SourceCollection: React.FC<SourceCollectionProps> = ({ items, scattered = false, heading, sorted = false }) => (
  <LuminaPanel className="px-4 py-4">
    <div className="text-center">
      <LuminaSectionLabel accent="cyan" size="sm">{heading}</LuminaSectionLabel>
    </div>
    {sorted ? (
      <div data-lever="sorted-pile" className="mt-3 space-y-2">
        {Array.from(new Set(items.map(it => it.categoryIndex))).sort((a, b) => a - b).map(k => (
          <div key={k} data-pile-line={k} className="flex flex-wrap items-center justify-center gap-x-4">
            {items.filter(it => it.categoryIndex === k).map((it, i) => (
              <span key={i} className="text-3xl leading-none select-none">{it.emoji}</span>
            ))}
          </div>
        ))}
      </div>
    ) : <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {items.map((item, i) => (
        <span
          key={i}
          className="text-3xl leading-none select-none"
          // Jitter is index-derived, not random: a re-render must never move an
          // object mid-count. Scatter is the hard tier's structural lever.
          style={scattered ? { transform: `translateY(${((i * 7) % 5) - 2}px) rotate(${((i * 13) % 21) - 10}deg)` } : undefined}
        >
          {item.emoji}
        </span>
      ))}
    </div>}
  </LuminaPanel>
);

/** Lever `word_model`: rows in pictures the graph does not use, labelled with the comparison words. Not part of the graph. */
const WordModelPanel: React.FC<{ model: WordModel }> = ({ model }) => (
  <LuminaPanel className="px-4 py-3" data-lever="word-model">
    <div className="space-y-1.5">
      {model.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-16 text-right text-sm font-semibold text-amber-200">{r.word}</span>
          <span className="text-2xl leading-none select-none">{model.glyph.repeat(r.count)}</span>
        </div>
      ))}
    </div>
  </LuminaPanel>
);

interface StickerControlsProps {
  values: BarValue[];
  onRemove: (i: number) => void;
  disabled?: boolean;
}

/** Undo affordance for the sticker chart. Placing is done on the row itself. */
const StickerControls: React.FC<StickerControlsProps> = ({ values, onRemove, disabled }) => (
  <div className="flex flex-wrap justify-center gap-2">
    {values.map((v, i) => (
      <LuminaButton
        key={i}
        size="sm"
        tone="ghost"
        disabled={disabled || v.value === 0}
        onClick={() => { SoundManager.tick(); onRemove(i); }}
        className="px-3 py-1.5"
      >
        {`Take one off ${v.label}`}
      </LuminaButton>
    ))}
  </div>
);

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
  /** Lever `data_beside`: the number the question gives for each row. */
  given?: Record<string, number> | null;
  /** Lever `step_marks`: how many numbered marks each step needs to reach the learner's tallest bar. */
  marks?: Record<number, number> | null;
}

const BuildControls: React.FC<BuildControlsProps> = ({
  values,
  onChange,
  scaleSteps,
  chosenStep,
  onChooseStep,
  disabled,
  given = null,
  marks = null,
}) => {
  const adjust = (i: number, delta: number) => {
    SoundManager.tick();
    const next = values.map((v, idx) =>
      idx === i ? { ...v, value: Math.max(0, v.value + delta) } : v,
    );
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <LuminaSectionLabel accent="cyan" size="sm">Adjust each bar</LuminaSectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {values.map((v, i) => (
            <LuminaPanel key={i} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-slate-200">{v.label}
                {given?.[v.label] != null ? <span data-lever="data-beside" className="ml-2 font-mono text-xs text-amber-200">({given[v.label]})</span> : null}
              </span>
              <div className="flex items-center gap-2">
                <LuminaButton
                  size="sm"
                  disabled={disabled || v.value === 0}
                  className="h-7 w-7 p-0"
                  onClick={() => adjust(i, -1)}
                  aria-label={`Decrease ${v.label}`}
                >
                  −
                </LuminaButton>
                <span className="font-mono text-slate-100 w-8 text-center">{v.value}</span>
                <LuminaButton
                  size="sm"
                  disabled={disabled}
                  className="h-7 w-7 p-0"
                  onClick={() => adjust(i, 1)}
                  aria-label={`Increase ${v.label}`}
                >
                  +
                </LuminaButton>
              </div>
            </LuminaPanel>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <LuminaSectionLabel accent="cyan" size="sm">Choose a scale step</LuminaSectionLabel>
        <div className="flex flex-wrap gap-2">
          {scaleSteps.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <LuminaButton
                tone={chosenStep === s ? 'primary' : 'ghost'}
                disabled={disabled}
                onClick={() => { SoundManager.select(); onChooseStep(s); }}
                className="px-4 py-2"
              >
                Step of {s}
              </LuminaButton>
              {marks?.[s] != null ? <span data-lever="step-marks" className="text-xs text-amber-200">{marks[s]} marks</span> : null}
            </div>
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

const scoreGraphResult = (result: { correct: boolean; attempts: number; score?: number }) =>
  result.score ?? (result.correct ? Math.max(20, 100 - (result.attempts - 1) * 20) : 0);

// Row-tap modes (key: targetBarIndex) and number-choice modes live in barModelWorkspace.ts.

/** Modes whose answer IS a row's own count, so that row never shows its number. */
const READ_ROW_MODES = new Set<BarModelEvalMode>([
  'read_one_to_one', 'read_scale', 'picture_graph', 'scaled_bar_graph',
]);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** The teaching workspace is bar-model's only controller: the runtime owns progression. */
const useBarModelProgress = useWorkspaceProgressFor('bar-model');

const BarModelSurface = ({ data, className, runtimePlanItemId }: BarModelProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  // ── Challenge progress. The runtime moves the index. ──
  // A fresh challenge and Try again both clear the working graph (bound below, once the setters exist).
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solveSpoken = useRef<(index: number) => void>(() => {});
  const progress = useBarModelProgress<BarModelChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solveSpoken.current(index),
  });
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
  } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete: isComplete || !!progress.practiceSummary,
    getChallengeType: () => 'graph',
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((sum, r) => sum + scoreGraphResult(r), 0) / Math.max(1, rs.length)),
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

  // In-item levers (make_graph: `barModelBuild.ts`; every other mode: `barModelLevers.ts`), keyed by the session item
  // they were pulled on, and the easier graph a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<BarModelChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier graph while the simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const graphStyle: BarModelGraphStyle = currentChallenge?.graphStyle ?? 'bar';

  // ── Per-challenge interaction state ────────────────────────────────────────
  const [builtValues, setBuiltValues] = useState<BarValue[]>(() => currentChallenge?.values ?? []);
  const [chosenStep, setChosenStep] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);
  /** make_graph: the check's words about the learner's own graph; they stay until the next check. */
  const [verdictText, setVerdictText] = useState('');
  const graphSvgRef = useRef<SVGSVGElement | null>(null);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);
  /** Every option tapped per challenge, wrong ones included — the factual response history. */
  const selectionsRef = useRef<Record<string, number[]>>({});

  /** Spoken tries on the open item that the tutor judged wrong. */
  const spokenMisses = useRef(0);
  // The runtime opens every item, fresh or after Try again, so no revision lands after it opens.
  openItem.current = (index, retry) => {
    // Try again on an easier graph reopens that graph, never the full one it stands in for.
    const next = retry && practice ? practice : challenges[index];
    if (!next) return;
    // make_graph: Try again keeps the graph and the verdict, so the learner revises their own work.
    if (retry && next.evalMode === 'make_graph') return;
    if (!retry) { setPractice(null); setVerdictText(''); }
    setSelectedOption(null);
    setSelectedBarIndex(null);
    setFeedback(null);
    setShowHint(false);
    setBuiltValues(next.values);
    if (retry) { spokenMisses.current += 1; return; }
    spokenMisses.current = 0;
    setChosenStep(null);
    recordedRef.current = false;
  };
  // A spoken item has no check of its own; its committed success is its result.
  solveSpoken.current = index => {
    const solved = challenges[index];
    if (!solved || (solved.evalMode !== 'say_what_it_shows' && solved.evalMode !== 'compare_two_graphs')) return;
    if (results.some(r => r.challengeId === solved.id)) return;
    recordResult({ challengeId: solved.id, evalMode: solved.evalMode, correct: true, attempts: spokenMisses.current + 1 });
  };

  // Session complete: evaluation submit
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.attempts === 1 && r.correct).length;
    const hintsViewed = results.filter((r) => r.attempts > 1).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + scoreGraphResult(r), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const sessionMode = challenges.every((c) => c.evalMode === challenges[0].evalMode) ? challenges[0].evalMode : 'mixed';
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

    // The live host has no evaluation provider; the workspace submits only under one.
    if (!hasSubmittedEvaluation && progress.recordsEvaluation) {
      const goalMet = correctCount === challenges.length;
      const selections = challenges.map((c) => ({ challengeId: c.id, selectedOptions: selectionsRef.current[c.id] ?? [] }));
      const diagnosisEvidence = buildPictureGraphEvidence(challenges, selections);
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          evalMode: sessionMode,
          prompts: challenges.map((c) => c.prompt),
          challengeResults: results,
          attemptsPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return r?.attempts ?? 0;
          }),
          selections,
          ...(diagnosisEvidence ? { diagnosisEvidence } : {}),
        },
      }, undefined, diagnosisEvidence);
    }
  }, [
    isComplete, results, challenges,
    submitEvaluation, hasSubmittedEvaluation, progress.recordsEvaluation,
  ]);

  // ── Submission helper ──────────────────────────────────────────────────────
  const submitResult = useCallback(
    (correct: boolean, extras: Record<string, unknown> = {}, work: Partial<BarModelView> = {}) => {
      if (!currentChallenge) return;
      // Stale-state guard (PRD §6a #3): if `builtValues` still holds the previous
      // challenge's bars while `currentChallenge` has already moved on, do not
      // check. Only proceed when bar labels line up.
      const stateMatches =
        currentChallenge.values.length === 0
        || builtValues.length === 0
        || builtValues[0]?.label === currentChallenge.values[0]?.label;
      if (!stateMatches) return;

      // The graph's own check is the workspace's checked gesture.
      const view = { built: builtValues, selectedOption, selectedRow: selectedBarIndex, chosenStep, ...work };
      progress.commitCheck(describeGraphWork(currentChallenge, view), correct,
        correct ? undefined : barModelMiss(currentChallenge, view));
      setFeedback(correct ? 'correct' : 'incorrect');
      if (correct) {
        if (recordedRef.current) return;
        // The easier two-bar graph is ungraded practice: it records no result of its own.
        if (isPracticeGraph(currentChallenge) || isSimplerGraph(currentChallenge)) { SoundManager.playCorrect(); return; }
        recordedRef.current = true;
        SoundManager.playCorrect();
        recordResult({
          challengeId: currentChallenge.id,
          evalMode: currentChallenge.evalMode,
          correct: true,
          attempts: currentAttempts + 1,
          ...extras,
        });
      } else {
        SoundManager.playIncorrect();
        setShowHint(true);
      }
    },
    [
      currentChallenge, currentAttempts, builtValues,
      recordResult, progress, selectedOption, selectedBarIndex, chosenStep,
    ],
  );

  // ── Interaction handlers ───────────────────────────────────────────────────
  const handleBarClick = (i: number) => {
    if (learnerBlocked() || !currentChallenge || feedback === 'correct' || isComplete) return;
    // K sticker chart: tapping a row places one sticker in it. The row's own
    // capacity is two cells longer than the answer, so running out of room can
    // never tell the child they are finished.
    if (currentChallenge.evalMode === 'build_one_to_one') {
      const capacity = currentChallenge.scale?.max ?? 10;
      SoundManager.tick();
      setBuiltValues((prev) => prev.map((v, idx) => (
        idx === i ? { ...v, value: Math.min(capacity, v.value + 1) } : v
      )));
      setFeedback(null);
      return;
    }
    if (ROW_TAP_MODES.has(currentChallenge.evalMode)) {
      const correct = currentChallenge.targetBarIndex === i;
      setSelectedBarIndex(i);
      submitResult(correct, { selectedIndex: i }, { selectedRow: i });
    }
  };

  const handleStickerRemove = (i: number) => {
    if (learnerBlocked() || !currentChallenge || feedback === 'correct' || isComplete) return;
    setBuiltValues((prev) => prev.map((v, idx) => (
      idx === i ? { ...v, value: Math.max(0, v.value - 1) } : v
    )));
    setFeedback(null);
  };

  const handleStickerSubmit = () => {
    if (learnerBlocked() || !currentChallenge || feedback === 'correct' || isComplete) return;
    const expected = currentChallenge.expectedCounts ?? [];
    const correct = expected.length === builtValues.length
      && expected.every((n, i) => builtValues[i]?.value === n);
    submitResult(correct, { placedCounts: builtValues.map((v) => v.value) });
  };

  const handleOptionClick = (opt: number) => {
    if (learnerBlocked() || !currentChallenge || feedback === 'correct' || isComplete) return;
    setSelectedOption(opt);
    const correct = opt === currentChallenge.expectedValue;
    const tapped = [...(selectionsRef.current[currentChallenge.id] ?? []), opt];
    selectionsRef.current[currentChallenge.id] = tapped;
    submitResult(correct, { selectedOption: opt, selectedOptions: tapped }, { selectedOption: opt });
  };

  const handleBuildSubmit = () => {
    if (learnerBlocked() || !currentChallenge || feedback === 'correct' || isComplete) return;
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

  // ── Open build (make_graph): tap a column to put one in, tap a picture to take one out; "I'm done!" commits ──
  const isMakeGraph = currentChallenge?.evalMode === 'make_graph';
  const graphOpen = isMakeGraph && progress.canAttempt !== false && feedback !== 'correct' && !isComplete;
  const setBar = (i: number, delta: number) => {
    if (learnerBlocked() || !graphOpen) return;
    SoundManager.tick();
    setBuiltValues(prev => prev.map((v, idx) => idx === i ? { ...v, value: Math.max(0, Math.min(GRAPH_MAX, v.value + delta)) } : v));
  };
  const handleGraphDone = () => {
    if (learnerBlocked() || !graphOpen || !currentChallenge) return;
    const bars = builtValues.map(v => v.value);
    setVerdictText(makeGraphVerdict(currentChallenge, bars));
    submitResult(!makeGraphMiss(currentChallenge.graphRule, bars), { graphValues: bars });
  };
  const graphRule = isMakeGraph ? currentChallenge?.graphRule : undefined;
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  // Every other mode's levers: drawn on the session graph only while pulled (or on from the tier), never on an easier graph.
  const itemLevers = sessionChallenge?.evalMode === 'make_graph' ? [] : barModelLevers(sessionChallenge, pulledLevers);
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.pulled);
  // The live line (shared build layer): what the graph looks like so far. Never a number, never a comparison:
  // which bar is tallest is the skill.
  const graphSeeing = useBuildWatcher({
    buildKey: builtValues.map(v => v.value).join(','),
    enabled: graphOpen && builtValues.some(v => v.value > 0),
    svg: graphSvgRef,
    request: { task: currentChallenge?.prompt ?? '',
      sceneNote: `An empty picture graph with one column each for ${currentChallenge?.values.map(v => v.label).join(', ')}; `
        + 'the child stacks one picture per tap. Talk about the pictures and colours, never which column is taller or shorter.',
      numbers: 'never' },
  });

  // ── Derived render data ────────────────────────────────────────────────────
  const isStickerBuild = currentChallenge?.evalMode === 'build_one_to_one';

  const valuesToRender: BarValue[] =
    currentChallenge?.evalMode === 'build_graph' || isStickerBuild || isMakeGraph
      ? builtValues
      : (currentChallenge?.values ?? []);

  const scaleToRender: BarModelScale | undefined =
    currentChallenge?.evalMode === 'build_graph' && currentChallenge.scale
      // The best step is the answer: until the learner picks one the axis is numbered only at 0 and the top.
      ? { ...currentChallenge.scale, step: chosenStep ?? currentChallenge.scale.max }
      : currentChallenge?.scale;

  const showOptions = !!currentChallenge && OPTION_MODES.has(currentChallenge.evalMode);

  // The bar named by the prompt (read modes only). Its value is the answer, so
  // BarsArea hides it at every tier regardless of the highlight cue below.
  const answerBarIndex =
    currentChallenge
      && READ_ROW_MODES.has(currentChallenge.evalMode)
      && typeof currentChallenge.targetBarIndex === 'number'
      ? currentChallenge.targetBarIndex
      : null;

  // Amber "read this one" cue — a tracking aid the support tier can withdraw
  // (showTargetHighlight === false at the hard tier). Defaults ON when absent.
  const highlightedIndex =
    answerBarIndex != null && (currentChallenge?.showTargetHighlight !== false || helpOn(MARK_ROW))
      ? answerBarIndex
      : null;
  // What the pulled help levers draw (`barModelLevers.ts`); each is off on an easier graph.
  const leverDraw = !currentChallenge || practice ? null : {
    fives: helpOn(GROUP_FIVES) ? fivesRows(currentChallenge) : [],
    pile: helpOn(PILE_ROW) && currentChallenge.stimulusCount
      ? { emoji: currentChallenge.sourceItems?.[0]?.emoji ?? currentChallenge.scale?.iconEmoji ?? '⭐', count: currentChallenge.stimulusCount } : null,
    model: helpOn(WORD_MODEL) ? wordModel(currentChallenge) : null,
    guide: helpOn(GUIDE_LINE) ? currentChallenge.targetBarIndex ?? null : null,
    minor: helpOn(MINOR_TICKS) ? minorStep(currentChallenge) : null,
    marked: helpOn(MARK_BARS) ? namedRows(currentChallenge) : [],
    given: helpOn(DATA_BESIDE) ? Object.fromEntries((currentChallenge.expectedDataset ?? []).map(e => [e.label, e.value])) : null,
    marks: helpOn(STEP_MARKS) ? stepMarks(currentChallenge.availableScaleSteps ?? [1, 2, 5, 10], builtValues) : null,
  };
  const pairRows = helpOn(PAIR_ROWS) && currentChallenge?.secondValues?.length === currentChallenge?.values.length;
  /** compare_two_graphs with `pair_rows`: each kind's two rows together, one from each survey. */
  const pairedValues: BarValue[] = pairRows && currentChallenge?.secondValues
    ? currentChallenge.values.flatMap((v, i) => [{ ...v, label: `${v.label}: ${currentChallenge.graphLabel ?? 'first'}` },
      { ...currentChallenge.secondValues![i], label: `${currentChallenge.secondValues![i].label}: ${currentChallenge.secondGraphLabel ?? 'second'}`,
        color: v.color }])
    : [];

  const rowTapFeedback =
    currentChallenge && ROW_TAP_MODES.has(currentChallenge.evalMode)
      && selectedBarIndex != null && feedback
      ? { index: selectedBarIndex, correct: feedback === 'correct' }
      : null;

  // ── Pip shared surface ─────────────────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's last touch; Pip never places a sticker, chooses, checks, or
  // advances. Tutor audio counts only while the tutor is on this block.
  const pip = usePipTargets(currentChallenge?.id ?? null, false);
  const [pipTouched, setPipTouched] = useState<{ scopeId: string; element: Element } | null>(null);
  const { isAudioPlaying, activePrimitiveId } = useLuminaAIContext();
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const isCurrentChallengeCorrect = !!currentChallenge
    && results.some((r) => r.challengeId === currentChallenge.id && r.correct);
  const pipTouch = (node: EventTarget) => {
    if (!currentChallenge || isCurrentChallengeCorrect || !(node instanceof Element)) return;
    setPipTouched({ scopeId: currentChallenge.id, element: node.closest('button, [role="button"]') ?? node });
  };
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || isComplete || hasSubmittedEvaluation) return null;
    const rowIds = valuesToRender.map((_value, i) => `row-${i}`);
    const targets: PipTarget[] = pip.targets(['graph', 'source', 'controls', ...rowIds], (id) => (
      id === 'graph' ? 'The graph' : id === 'source' ? 'The group to count' : id === 'controls' ? 'The graph controls'
        : valuesToRender[Number(id.slice(4))]?.label ?? 'A row'
    ));
    const touched = pipTouched?.scopeId === currentChallenge.id && pipTouched.element.isConnected ? pipTouched.element : null;
    if (touched) targets.push({ id: 'touched', label: 'Your last touch', element: touched });
    const pose = barModelPipPose({
      running: true, preparing: false, currentSolved: isCurrentChallengeCorrect, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      evalMode: currentChallenge.evalMode, markedRowIndex: highlightedIndex,
      visibleIds: targets.map((target) => target.id), hasTouch: !!touched,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Bar model',
      dock: pip.dock.current, targets, pose,
    };
  });

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { built: builtValues, selectedOption, selectedRow: selectedBarIndex, chosenStep });
    const makeGraph = sessionChallenge.evalMode === 'make_graph';
    const levers = practice ? [] : makeGraph ? makeGraphLevers(sessionChallenge, pulledLevers) : itemLevers;
    /** A practice graph and the full graph it stands in for share no work. */
    const showItem = (c: BarModelChallenge) => {
      setBuiltValues(c.values); setFeedback(null); setVerdictText(''); setSelectedOption(null); setSelectedBarIndex(null);
      setChosenStep(null); setShowHint(false);
    };
    const onScreen = practice || makeGraph ? undefined : leverFacts(sessionChallenge, helpOn, builtValues);
    const note = makeGraph ? 'An easier graph with two bars, ungraded. The full graph comes back after it.' : PRACTICE_NOTE;
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: note } : {}) },
      ...(levers.length || practice ? { levers } : {}),
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this graph.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const refusal = makeGraph ? undefined : leverRefusal(sessionChallenge, id, builtValues);
        if (refusal) return refusal;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = id === TWO_BARS_LEVER ? twoBarPractice(sessionChallenge) : simplerGraph(sessionChallenge);
          if (!easier) return 'This graph has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); showItem(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); showItem(sessionChallenge); },
    };
  });
  /** A solved answer, or a checked one waiting for Try again or Next challenge. */
  const answerClosed = feedback === 'correct' || progress.canAttempt === false;
  // The live host has no evaluation provider, so the runtime's practice summary also ends the session.
  const sessionOver = isComplete || !!progress.practiceSummary;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-12 ${className || ''}`}>
        <LuminaCard className="rounded-3xl p-6 text-center">
          <p className="text-slate-300">No bar-model challenges available.</p>
        </LuminaCard>
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

      <LuminaCard className="rounded-3xl p-6 md:p-10 relative overflow-hidden">
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
          {!sessionOver && challenges.length > 1 ? (
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(currentIndex + 1, challenges.length)}
                total={challenges.length}
                variant="dots"
                accent="emerald"
              />
            </div>
          ) : null}

          {/* Per-challenge UI */}
          {!sessionOver && currentChallenge ? (
            <div className="space-y-6" onPointerDownCapture={(event) => pipTouch(event.target)}
              onFocusCapture={(event) => pipTouch(event.target)}>
              <LuminaPrompt accent="cyan" center>
                <span className="text-base">{currentChallenge.prompt}</span>
              </LuminaPrompt>

              {currentChallenge.sourceItems && currentChallenge.sourceItems.length > 0 ? (
                <div ref={pip.ref('source')} data-pip-object="source">
                  <SourceCollection
                    items={currentChallenge.sourceItems}
                    sorted={helpOn(SORT_PILE)}
                    scattered={currentChallenge.sourceScattered}
                    heading={isStickerBuild ? 'Everything we found' : 'Count this group'}
                  />
                </div>
              ) : null}

              {/* Every graph on screen, as one Pip region. */}
              <div ref={pip.ref('graph')} data-pip-object="graph" className="space-y-6">
                <div className="px-2 space-y-5">
                  {leverDraw?.model && <WordModelPanel model={leverDraw.model} />}
                  {currentChallenge.graphLabel && !pairRows && <h3 className="text-lg font-semibold text-cyan-200">{currentChallenge.graphLabel}</h3>}
                  {pairRows && <div data-lever="pair-rows" className="text-sm text-cyan-200">{currentChallenge.graphLabel} and {currentChallenge.secondGraphLabel}, row by row</div>}
                  {isMakeGraph ? (
                    <div className="flex justify-center">
                      <GraphBuildScene ref={graphSvgRef} bars={builtValues} disabled={!graphOpen}
                        lineRow={graphRule && leverOn(LINE_LEVER) ? levelLineRow(graphRule) : null} counts={leverOn(COUNTS_LEVER)}
                        onAdd={i => setBar(i, 1)} onRemove={i => setBar(i, -1)} rowRef={pip.ref} />
                    </div>
                  ) : <BarsArea
                    values={pairRows ? pairedValues : valuesToRender}
                    graphStyle={graphStyle}
                    scale={scaleToRender}
                    highlightedIndex={highlightedIndex}
                    selectedIndex={selectedBarIndex}
                    onBarClick={
                      isStickerBuild || ROW_TAP_MODES.has(currentChallenge.evalMode)
                        ? handleBarClick
                        : undefined
                    }
                    clickable={
                      (isStickerBuild || ROW_TAP_MODES.has(currentChallenge.evalMode))
                      && !answerClosed
                    }
                    feedbackIndex={rowTapFeedback}
                    showBarValues={(currentChallenge.showBarValues ?? true) || helpOn(BAR_VALUES)}
                    answerBarIndex={answerBarIndex}
                    showEmptySlots={isStickerBuild}
                    showPlacedCount={false}
                    rowRef={pip.ref}
                    markedRows={leverDraw?.marked}
                    fivesRows={leverDraw?.fives}
                    guideRow={leverDraw?.guide}
                    minorStep={leverDraw?.minor}
                    iconValues={helpOn(ICON_VALUES)}
                    pileRow={leverDraw?.pile}
                  />}
                </div>

                {currentChallenge.secondValues && !pairRows && <div className="px-2 space-y-3">
                  <h3 className="text-lg font-semibold text-amber-200">{currentChallenge.secondGraphLabel}</h3>
                  <BarsArea values={currentChallenge.secondValues} graphStyle="picture" scale={scaleToRender} showBarValues={false} />
                </div>}
              </div>

              {pipStore && (
                <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                  className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
              )}

              {isMakeGraph ? (
                <div className="space-y-4">
                  {practice && (
                    <div data-practice-graph="true" className="text-center text-xs text-cyan-200">
                      An easier graph first. It is not graded; the full graph comes back after it.
                    </div>
                  )}
                  <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                    {graphSeeing && graphOpen && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {graphSeeing}</span>}
                  </div>
                  <div className="flex justify-center">
                    <LuminaButton tone="primary" disabled={!graphOpen || builtValues.every(v => v.value === 0)} onClick={handleGraphDone}>
                      I&apos;m done!
                    </LuminaButton>
                  </div>
                </div>
              ) : null}

              {practice && !isMakeGraph && (
                <div data-practice-graph="true" className="text-center text-xs text-cyan-200">
                  An easier graph first. It is not graded; the full graph comes back after it.
                </div>
              )}

              {isStickerBuild ? (
                <div className="space-y-4">
                  <StickerControls
                    values={builtValues}
                    onRemove={handleStickerRemove}
                    disabled={answerClosed}
                  />
                  <div className="flex justify-center">
                    <LuminaActionButton
                      action="check"
                      disabled={answerClosed}
                      onClick={handleStickerSubmit}
                    >
                      Check my chart
                    </LuminaActionButton>
                  </div>
                </div>
              ) : null}

              {showOptions && currentChallenge.options && currentChallenge.options.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {currentChallenge.options.map((opt) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = currentChallenge.expectedValue === opt;
                    const choiceState = isSelected
                      ? feedback === 'correct'
                        ? 'correct'
                        : 'incorrect'
                      : feedback === 'correct' && isAnswer
                        ? 'correct'
                        : 'idle';
                    return (
                      <LuminaAnswerChoice
                        key={opt}
                        state={choiceState}
                        disabled={answerClosed}
                        onClick={() => handleOptionClick(opt)}
                        className="w-auto min-w-[72px] pl-5 pr-9 py-3 text-center font-mono text-lg"
                      >
                        {opt}
                      </LuminaAnswerChoice>
                    );
                  })}
                </div>
              ) : null}

              {currentChallenge.evalMode === 'build_graph' ? (
                <div className="space-y-4">
                  <div ref={pip.ref('controls')} data-pip-object="controls">
                    <BuildControls
                      values={builtValues}
                      onChange={setBuiltValues}
                      scaleSteps={currentChallenge.availableScaleSteps ?? [1, 2, 5, 10]}
                      chosenStep={chosenStep}
                      onChooseStep={setChosenStep}
                      disabled={answerClosed}
                      given={leverDraw?.given}
                      marks={leverDraw?.marks}
                    />
                  </div>
                  <div className="flex justify-center">
                    <LuminaActionButton
                      action="check"
                      disabled={answerClosed || chosenStep == null}
                      onClick={handleBuildSubmit}
                    >
                      Submit graph
                    </LuminaActionButton>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <LuminaFeedbackCard
                  status={feedback === 'correct' ? 'correct' : 'incorrect'}
                  label={feedback === 'correct' ? 'Nice work' : 'Not quite'}
                  teachingNote={
                    feedback === 'incorrect' && showHint && currentChallenge.hint
                      ? currentChallenge.hint
                      : undefined
                  }
                >
                  {isMakeGraph && verdictText ? verdictText : feedback === 'correct'
                    ? "That's correct."
                    : 'Take another look and try again.'}
                </LuminaFeedbackCard>
              ) : null}

            </div>
          ) : null}

          {/* Phase summary panel */}
          {sessionOver && phaseResults.length > 0 ? (
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
      </LuminaCard>
    </div>
  );
};

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const BarModel = withWorkspaceOnly<BarModelProps>('bar-model', BarModelSurface, props => props.data.title);

export default BarModel;
