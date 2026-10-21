'use client';

import React, { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaActionButton,
  LuminaChoiceChip,
  LuminaPanel,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HistogramMetrics } from '../../../evaluation/types';
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';
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
  SHAPE_LABEL, binRange, computeBins, describeHistogramWork, frequencyAxis, histogramCorrect, histogramMiss, workIsCheckable,
  workspaceScene, type Bin, type HistogramWork,
} from './histogramWorkspace';
import {
  AXIS_NAMES_LEVER, BALANCE_MODEL, BALANCE_MODEL_LEVER, COUNT_LABELS_LEVER, COUNT_MARKS_LEVER, HISTOGRAM_LEVERS,
  ISOLATE_LEVER, LEVEL_LINE_LEVER, OUTLINE_LEVER, PEAK_MODEL_LEVER, TAIL_MODEL_LEVER, isPracticeGraph, peakModel, tailModel,
  type HistogramLeverContext,
} from './histogramLevers';
import { histogramBoss } from './histogram.boss';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export type HistogramChallengeType =
  | 'identify_shape'
  | 'find_modal_bin'
  | 'read_frequency'
  | 'estimate_center';

export type HistogramShapeKind =
  | 'symmetric'
  | 'right-skewed'
  | 'left-skewed'
  | 'bimodal'
  | 'uniform';

export interface HistogramChallenge {
  id: string;
  challengeType: HistogramChallengeType;
  data: number[];
  binWidth: number;
  binStart: number;
  contextTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  prompt: string;
  hint?: string;
  /** The session's support tier, stamped on each item by the generator (when a model lever comes). Absent: medium. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // identify_shape
  expectedShape?: HistogramShapeKind;
  shapeOptions?: HistogramShapeKind[];

  // find_modal_bin
  expectedBinStart?: number;
  expectedBinEnd?: number;

  // read_frequency
  targetBinStart?: number;
  targetBinEnd?: number;
  targetFrequency?: number;

  // estimate_center
  targetStatistic?: 'mean' | 'median';
  targetAnswer?: number;
  tolerance?: number;
}

export interface HistogramData {
  primitiveType?: string;
  title: string;
  description: string;
  challengeType: HistogramChallengeType;
  challenges: HistogramChallenge[];
  gradeBand: '6-7' | '7-8';
  /** Show the mean/std-dev/min/max panel. Hidden in estimate_center mode, and
   *  withdrawn at the 'hard' support tier. */
  showStatistics: boolean;
  /**
   * Show the per-bar frequency count labels. When omitted, falls back to the
   * mode default (on for identify_shape / estimate_center). The generator sets
   * it explicitly per support tier — 'hard' withdraws it for those two modes;
   * it is always off for find_modal_bin / read_frequency (it'd be the answer).
   */
  showFrequencyLabels?: boolean;
  /** The within-mode support tier that produced this session. Display logic keys off the resolved flags above; the
   *  levers read each item's own `supportTier`. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HistogramMetrics>) => void;
}

interface HistogramProps {
  data: HistogramData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// =============================================================================
// Constants & helpers
// =============================================================================

const CHART_WIDTH = 600;
const CHART_HEIGHT = 340;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 560;
const PLOT_TOP = 40;
const PLOT_BOTTOM = 280;

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  identify_shape:  { label: 'Identify Shape',  icon: '📈', accentColor: 'emerald' },
  find_modal_bin:  { label: 'Find Modal Bin',  icon: '🏔️', accentColor: 'emerald' },
  read_frequency:  { label: 'Read Frequency',  icon: '🔢', accentColor: 'emerald' },
  estimate_center: { label: 'Estimate Center', icon: '🎯', accentColor: 'amber' },
};

const phaseScore = (attempts: number): number =>
  Math.max(20, 100 - Math.max(0, attempts - 1) * 20);

function computeStats(data: number[]) {
  if (data.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0, skew: 'N/A' };
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...data);
  const max = Math.max(...data);
  let skew = 'Symmetric';
  if (n >= 3 && stdDev > 0) {
    const skewness = data.reduce((s, x) => s + ((x - mean) / stdDev) ** 3, 0) / n;
    if (skewness > 0.5) skew = 'Right-skewed';
    else if (skewness < -0.5) skew = 'Left-skewed';
  }
  return { mean, stdDev, min, max, count: n, skew };
}

// =============================================================================
// Chart subcomponent
// =============================================================================

interface ChartProps {
  bins: Bin[];
  xAxisLabel: string;
  yAxisLabel: string;
  showFrequency: boolean;
  highlightedBinIndex: number | null;
  /** Index of the bar the student has clicked (find_modal_bin). null = none. */
  selectedBinIndex: number | null;
  /** Bin range to outline (read_frequency target). null = none. */
  targetBin: { start: number; end: number } | null;
  /** True when bars are clickable (find_modal_bin mode). */
  clickable: boolean;
  onBinClick: (index: number) => void;
  onBinHover: (index: number | null) => void;
  /** Lever pictures (`histogramLevers.ts`): a line over the bar tops, a level line at a tapped bar's height, every bar
   *  but one faded, unnumbered count lines across one bar, captions on the axes. */
  outline?: boolean;
  levelAt?: number | null;
  fadeExcept?: number | null;
  marksOn?: number | null;
  axisNames?: boolean;
}

/** A small model graph outside the item: bars only, no numbers, an optional balance point and tail marker. */
const ModelHistogram: React.FC<{ counts: number[]; caption: string; lever: string; balanceAt?: number; tail?: 'left' | 'right' }> =
  ({ counts, caption, lever, balanceAt, tail }) => {
    const W = 180, H = 80, max = Math.max(...counts), slot = W / counts.length;
    return (
      <figure data-lever={lever} className="mx-auto w-64 rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full h-auto" aria-hidden="true">
          {counts.map((n, i) => (
            <rect key={i} x={i * slot + 2} y={H - (n / max) * (H - 6)} width={slot - 4} height={(n / max) * (H - 6)}
              fill="#38bdf8" fillOpacity={0.6} rx={1} />
          ))}
          <line x1={0} y1={H} x2={W} y2={H} stroke="#64748b" />
          {balanceAt !== undefined && (
            <polygon points={`${balanceAt * slot},${H + 2} ${balanceAt * slot - 6},${H + 14} ${balanceAt * slot + 6},${H + 14}`} fill="#fbbf24" />
          )}
          {tail && (
            <line x1={tail === 'right' ? W * 0.55 : W * 0.45} y1={H + 9} x2={tail === 'right' ? W - 4 : 4} y2={H + 9}
              stroke="#f472b6" strokeWidth={2} markerEnd="url(#tail-arrow)" />
          )}
          <defs>
            <marker id="tail-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#f472b6" />
            </marker>
          </defs>
        </svg>
        <figcaption className="text-xs text-slate-300 mt-1">{caption}</figcaption>
      </figure>
    );
  };

const HistogramChart: React.FC<ChartProps> = ({
  bins,
  xAxisLabel,
  yAxisLabel,
  showFrequency,
  highlightedBinIndex,
  selectedBinIndex,
  targetBin,
  clickable,
  onBinClick,
  onBinHover,
  outline = false,
  levelAt = null,
  fadeExcept = null,
  marksOn = null,
  axisNames = false,
}) => {
  const axis = useMemo(() => frequencyAxis(Math.max(0, ...bins.map((b) => b.count))), [bins]);

  if (bins.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <p>No data available.</p>
      </div>
    );
  }

  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const yOf = (count: number) => PLOT_BOTTOM - (count / axis.top) * plotHeight;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-auto">
      {/* Y-axis label */}
      <text
        x={15}
        y={(PLOT_TOP + PLOT_BOTTOM) / 2}
        fill="#94a3b8"
        fontSize={12}
        transform={`rotate(-90 15 ${(PLOT_TOP + PLOT_BOTTOM) / 2})`}
        textAnchor="middle"
      >
        {yAxisLabel}
      </text>

      {/* X-axis label */}
      <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={CHART_HEIGHT - 10} fill="#94a3b8" fontSize={12} textAnchor="middle">
        {xAxisLabel}
      </text>

      {/* Faint line at every whole count, when the labelled lines skip some */}
      {axis.minor && Array.from({ length: axis.top + 1 }).map((_, c) => (c % axis.step === 0 ? null : (
        <line key={`y-minor-${c}`} x1={PLOT_LEFT} y1={yOf(c)} x2={PLOT_RIGHT} y2={yOf(c)}
          stroke="#334155" strokeWidth={1} opacity={0.25} />
      )))}

      {/* Labelled lines at every step, on whole counts */}
      {Array.from({ length: axis.top / axis.step + 1 }).map((_, i) => {
        const value = i * axis.step;
        const y = yOf(value);
        return (
          <g key={`y-tick-${i}`}>
            <line x1={PLOT_LEFT - 5} y1={y} x2={PLOT_LEFT} y2={y} stroke="#475569" strokeWidth={1} />
            <text x={PLOT_LEFT - 10} y={y + 4} fill="#94a3b8" fontSize={10} textAnchor="end">
              {value}
            </text>
            <line
              x1={PLOT_LEFT}
              y1={y}
              x2={PLOT_RIGHT}
              y2={y}
              stroke="#334155"
              strokeWidth={1}
              strokeDasharray="4"
              opacity={0.5}
            />
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke="#475569" strokeWidth={2} />
      <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} stroke="#475569" strokeWidth={2} />

      {/* Bars */}
      {bins.map((bin, index) => {
        const barWidth = plotWidth / bins.length - 4;
        const barHeight = (bin.count / axis.top) * plotHeight;
        const x = PLOT_LEFT + index * (plotWidth / bins.length) + 2;
        const y = PLOT_BOTTOM - barHeight;
        const isHovered = highlightedBinIndex === index;
        const isSelected = selectedBinIndex === index;
        const isTarget =
          targetBin !== null && bin.start === targetBin.start && bin.end === targetBin.end;

        const fillColor = isSelected
          ? '#fbbf24'
          : isTarget
            ? '#f59e0b'
            : isHovered
              ? '#34d399'
              : '#10b981';

        const strokeColor = isSelected
          ? '#fcd34d'
          : isTarget
            ? '#fbbf24'
            : isHovered
              ? '#6ee7b7'
              : '#10b981';

        return (
          <g key={`bin-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={fillColor}
              fillOpacity={fadeExcept !== null && fadeExcept !== index ? 0.15
                : isSelected || isTarget ? 0.85 : isHovered ? 0.9 : 0.7}
              strokeOpacity={fadeExcept !== null && fadeExcept !== index ? 0.25 : 1}
              stroke={strokeColor}
              strokeWidth={isSelected || isTarget ? 2.5 : isHovered ? 2 : 1}
              rx={2}
              className={`transition-all duration-150 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              data-pip-object={clickable ? `bar-${index}` : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `Bar from ${bin.start} to ${bin.end}` : undefined}
              onMouseEnter={() => onBinHover(index)}
              onMouseLeave={() => onBinHover(null)}
              onClick={() => clickable && onBinClick(index)}
            />

            {marksOn === index && Array.from({ length: Math.max(0, bin.count - 1) }).map((_, k) => (
              <line key={`mark-${k}`} data-lever="count-marks" x1={x + 2} x2={x + barWidth - 2}
                y1={yOf(k + 1)} y2={yOf(k + 1)} stroke="#0f172a" strokeWidth={1.5} opacity={0.7} pointerEvents="none" />
            ))}

            {showFrequency && bin.count > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 8}
                fill={isSelected || isTarget ? '#fde68a' : '#a7f3d0'}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
              >
                {bin.count}
              </text>
            )}

            <text
              x={x + barWidth / 2 - (plotWidth / bins.length) / 2 + 2}
              y={PLOT_BOTTOM + 15}
              fill="#94a3b8"
              fontSize={10}
              textAnchor="middle"
            >
              {bin.start}
            </text>
          </g>
        );
      })}

      {/* Lever: a line joining the bar tops */}
      {outline && (
        <polyline data-lever="outline-tops" fill="none" stroke="#f472b6" strokeWidth={2.5} pointerEvents="none"
          points={bins.map((b, i) => `${PLOT_LEFT + (i + 0.5) * (plotWidth / bins.length)},${yOf(b.count)}`).join(' ')} />
      )}

      {/* Lever: a level line at the top of the tapped bar */}
      {levelAt !== null && (
        <line data-lever="level-line" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yOf(levelAt)} y2={yOf(levelAt)}
          stroke="#f472b6" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
      )}

      {/* Lever: what each axis counts */}
      {axisNames && (
        <g data-lever="axis-names" pointerEvents="none">
          <text x={PLOT_LEFT + 6} y={PLOT_TOP - 10} fill="#f9a8d4" fontSize={11}>↑ how many values</text>
          <text x={PLOT_RIGHT} y={CHART_HEIGHT - 10} fill="#f9a8d4" fontSize={11} textAnchor="end">values (bar edges) →</text>
        </g>
      )}

      {/* Last x-axis label */}
      {bins.length > 0 && (
        <text
          x={PLOT_LEFT + plotWidth}
          y={PLOT_BOTTOM + 15}
          fill="#94a3b8"
          fontSize={10}
          textAnchor="middle"
        >
          {bins[bins.length - 1].end}
        </text>
      )}
    </svg>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const useHistogramProgress = useWorkspaceProgressFor('histogram');
const PRACTICE_NOTE = 'An easier practice graph is on screen in place of the item. It is not graded; the full item comes back after it.';

const HistogramSurface = ({ data, className, runtimePlanItemId }: HistogramProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    challengeType,
    challenges,
    gradeBand,
    showStatistics,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef<string>(instanceId || `histogram-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  // -- Challenge progress: the teaching workspace owns it. --
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useHistogramProgress({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: histogramBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete,
    getChallengeType: () => challengeType,
    phaseConfig: PHASE_CONFIG,
    getScore: (rs: ChallengeResult[]) =>
      rs.length === 0
        ? 0
        : Math.round(
            rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / rs.length,
          ),
  });

  const {
    submitResult,
    hasSubmitted,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<HistogramMetrics>({
    primitiveType: 'histogram',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -- Per-challenge state --------------------------------------------------
  const [selectedShape, setSelectedShape] = useState<HistogramShapeKind | null>(null);
  const [selectedBinIndex, setSelectedBinIndex] = useState<number | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const recordedRef = useRef(false);
  const [hoveredBinIndex, setHoveredBinIndex] = useState<number | null>(null);

  /** The working surface blank: a fresh item, or Try again. */
  const clearWork = () => {
    setSelectedShape(null);
    setSelectedBinIndex(null);
    setNumericInput('');
    setFeedback(null);
    setHoveredBinIndex(null);
  };
  // In-item levers (`HISTOGRAM_LEVERS`), keyed by the session item they were pulled on, and the easier graph a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<HistogramChallenge | null>(null);

  openItem.current = (_index, retry) => {
    clearWork();
    // Try again on a practice graph keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) return;
    setPractice(null);
    recordedRef.current = false;
  };

  // -- Derived state --------------------------------------------------------
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier graph while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice graph. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  const bins = useMemo<Bin[]>(() => {
    if (!currentChallenge) return [];
    return computeBins(currentChallenge.data, currentChallenge.binWidth, currentChallenge.binStart);
  }, [currentChallenge]);

  const stats = useMemo(() => {
    if (!currentChallenge || !showStatistics) return null;
    return computeStats(currentChallenge.data);
  }, [currentChallenge, showStatistics]);

  // For find_modal_bin: don't reveal frequency labels (they would give it away).
  // For read_frequency: hide labels too (they're literally the answer).
  // For identify_shape and estimate_center: labels are fine — unless the support
  // tier withdrew them (hard). The generator drives this via data.showFrequencyLabels;
  // when absent, fall back to the mode default so un-tiered sessions are unchanged.
  const sessionShowsLabels =
    (challengeType === 'identify_shape' || challengeType === 'estimate_center') &&
    (data.showFrequencyLabels ?? true);
  /** The session's labels, or the `count_labels` lever's on an estimate item. */
  const showFrequencyLabels = sessionShowsLabels || (challengeType === 'estimate_center' && leverOn(COUNT_LABELS_LEVER));

  // Target bin outline for read_frequency
  const targetBin = useMemo(() => {
    if (!currentChallenge) return null;
    if (challengeType !== 'read_frequency') return null;
    if (currentChallenge.targetBinStart === undefined || currentChallenge.targetBinEnd === undefined) return null;
    return { start: currentChallenge.targetBinStart, end: currentChallenge.targetBinEnd };
  }, [currentChallenge, challengeType]);

  // -- Submit handler. Every check commits (right or wrong); a missing choice or a non-number is not a check. --
  const handleSubmit = useCallback(() => {
    if (!currentChallenge || recordedRef.current || hasSubmitted || learnerBlocked()) return;
    const work: HistogramWork = { shape: selectedShape, binIndex: selectedBinIndex, typed: numericInput };

    if (!workIsCheckable(currentChallenge, work, bins)) {
      SoundManager.invalid();
      setFeedback({
        message: challengeType === 'identify_shape'
          ? 'Pick a shape from the choices below.'
          : challengeType === 'find_modal_bin'
            ? 'Tap the bar you think is tallest.'
            : challengeType === 'read_frequency' ? 'Type a whole number.' : 'Type a number.',
        correct: false,
      });
      return;
    }

    const isCorrect = histogramCorrect(currentChallenge, work, bins);
    const nextAttempts = currentAttempts + 1;
    const chosenBin = selectedBinIndex === null ? undefined : bins[selectedBinIndex];
    const studentAnswer: string | number =
      challengeType === 'identify_shape' ? (selectedShape ?? '')
        : challengeType === 'find_modal_bin' ? (chosenBin ? binRange(chosenBin.start, chosenBin.end, selectedBinIndex === bins.length - 1) : '')
          : parseFloat(numericInput);
    const targetAnswer: string | number =
      challengeType === 'identify_shape' ? (currentChallenge.expectedShape ?? '')
        : challengeType === 'find_modal_bin' ? `[${currentChallenge.expectedBinStart}, ${currentChallenge.expectedBinEnd})`
          : challengeType === 'read_frequency' ? (currentChallenge.targetFrequency ?? 0) : (currentChallenge.targetAnswer ?? 0);

    // The checked gesture (counts the attempt, records the verdict), then this primitive's own fields.
    progress.commitCheck(describeHistogramWork(currentChallenge, work, bins), isCorrect,
      histogramMiss(currentChallenge, work, bins));

    // An easier practice graph (a simplify lever) is not the session's challenge: it records nothing of its own, and the
    // full item comes back after it.
    if (isCorrect && isPracticeGraph(currentChallenge)) {
      SoundManager.playCorrect();
      setFeedback({ message: 'Correct! Now back to the full graph.', correct: true });
      return;
    }

    if (isCorrect) {
      SoundManager.playCorrect();
      recordedRef.current = true;
      mergeResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: nextAttempts,
        score: phaseScore(nextAttempts),
        studentAnswer,
        targetAnswer,
      });
      setFeedback({
        message:
          challengeType === 'estimate_center'
            ? `Close enough! The ${currentChallenge.targetStatistic} is ${currentChallenge.targetAnswer}.`
            : 'Correct!',
        correct: true,
      });
    } else {
      SoundManager.playIncorrect();
      const msg =
        challengeType === 'identify_shape'
          ? 'Not quite — take another look at the bars.'
          : challengeType === 'find_modal_bin'
            ? 'Not the tallest bar — look again.'
            : challengeType === 'read_frequency'
              ? 'Not quite — read the bar height again.'
              : 'Not quite — try a different estimate.';
      setFeedback({ message: msg, correct: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge,
    challengeType,
    selectedShape,
    selectedBinIndex,
    numericInput,
    bins,
    mergeResult,
    progress.commitCheck,
    currentAttempts,
    hasSubmitted,
  ]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || challenges.length === 0 || progress.recordsEvaluation === false) return;
    const metrics: HistogramMetrics = {
      type: 'histogram',
      challengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -- Mode-specific copy ---------------------------------------------------
  const modeLabel = PHASE_CONFIG[challengeType]?.label ?? challengeType;
  const modeIcon = PHASE_CONFIG[challengeType]?.icon ?? '📊';

  const getHeading = (): string => {
    if (challengeType === 'identify_shape') return 'Shape Recognition Complete!';
    if (challengeType === 'find_modal_bin') return 'Modal Bin Practice Complete!';
    if (challengeType === 'read_frequency') return 'Frequency Reading Complete!';
    return 'Center Estimation Complete!';
  };

  const getCelebration = (): string => {
    if (challengeType === 'identify_shape') return 'Great job reading the shape of each distribution!';
    if (challengeType === 'find_modal_bin') return 'Sharp eye for the tallest bar!';
    if (challengeType === 'read_frequency') return 'Solid frequency-reading practice!';
    return 'Strong work estimating from the visual!';
  };

  // -- Completed IDs --------------------------------------------------------
  const completedIds = useMemo(
    () => new Set(challengeResults.filter((r) => r.correct).map((r) => r.challengeId)),
    [challengeResults],
  );
  const solved = !!currentChallenge && completedIds.has(currentChallenge.id);
  /** Input closed once the item is done, and while a checked answer waits for Try again. */
  const inputClosed = isComplete || hasSubmitted || solved || blocked;

  const localOverallScore = useMemo(() => {
    if (!isComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challenges.length,
    );
  }, [isComplete, challenges.length, challengeResults]);

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, {
      shape: selectedShape, binIndex: selectedBinIndex, typed: numericInput,
      showFrequencyLabels, showStatistics,
    });
    const ctx: HistogramLeverContext = { countLabelsShown: sessionShowsLabels, barTapped: selectedBinIndex !== null };
    const levers = practice ? [] : HISTOGRAM_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : HISTOGRAM_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : HISTOGRAM_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
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
          const easier = HISTOGRAM_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); clearWork();
          return { practice: histogramBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); clearWork(); },
    };
  });

  const tail = leverOn(TAIL_MODEL_LEVER) && sessionChallenge ? tailModel(sessionChallenge) : null;
  const peak = leverOn(PEAK_MODEL_LEVER) && sessionChallenge ? peakModel(sessionChallenge) : null;
  const askedIndex = targetBin ? bins.findIndex((b) => b.start === targetBin.start) : -1;

  // -- Render ---------------------------------------------------------------
  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{modeIcon}</span>
            <div>
              <LuminaCardTitle>{title || 'Reading Histograms'}</LuminaCardTitle>
              <p className="text-sm text-slate-400 mt-0.5">{modeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge accent="amber">Practice</LuminaBadge>}
            <LuminaBadge accent="emerald">Grades {gradeBand}</LuminaBadge>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-4">
          {challenges.map((c, i) => (
            <div
              key={c.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                completedIds.has(c.id)
                  ? 'bg-emerald-500'
                  : i === currentIndex && !isComplete
                    ? 'bg-blue-500'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Results panel */}
        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading={getHeading()}
            celebrationMessage={getCelebration()}
            className="mb-4"
          />
        )}

        {/* ACTIVE WORKSPACE */}
        {currentChallenge && !isComplete && (
          <>
            {/* Per-challenge context header */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm font-medium">
                Histogram {currentIndex + 1} of {challenges.length} — {currentChallenge.contextTitle}
              </p>
              <p className="text-slate-200 mt-1">{currentChallenge.prompt}</p>
            </div>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the graph and the answer
                as one region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
            {/* Chart */}
            <LuminaPanel>
              <HistogramChart
                bins={bins}
                xAxisLabel={currentChallenge.xAxisLabel}
                yAxisLabel={currentChallenge.yAxisLabel}
                showFrequency={showFrequencyLabels}
                highlightedBinIndex={hoveredBinIndex}
                selectedBinIndex={selectedBinIndex}
                targetBin={targetBin}
                clickable={challengeType === 'find_modal_bin'}
                onBinClick={(idx) => {
                  if (inputClosed || learnerBlocked()) return;
                  SoundManager.select();
                  setSelectedBinIndex(idx);
                }}
                onBinHover={setHoveredBinIndex}
                outline={leverOn(OUTLINE_LEVER)}
                levelAt={leverOn(LEVEL_LINE_LEVER) && selectedBinIndex !== null ? bins[selectedBinIndex]?.count ?? null : null}
                fadeExcept={leverOn(ISOLATE_LEVER) && askedIndex >= 0 ? askedIndex : null}
                marksOn={leverOn(COUNT_MARKS_LEVER) && askedIndex >= 0 ? askedIndex : null}
                axisNames={leverOn(AXIS_NAMES_LEVER)}
              />

              {/* Model graphs outside the item (`histogramLevers.ts`), on the session item only. */}
              {(tail || peak || leverOn(BALANCE_MODEL_LEVER)) && (
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {tail && <ModelHistogram lever="tail-model" counts={tail.counts} caption={tail.caption}
                    tail={tail.shape === 'right-skewed' ? 'right' : 'left'} />}
                  {peak && <ModelHistogram lever="peak-model" counts={peak.counts} caption={peak.caption} />}
                  {leverOn(BALANCE_MODEL_LEVER) && <ModelHistogram lever="balance-model" counts={BALANCE_MODEL.counts}
                    caption={BALANCE_MODEL.caption} balanceAt={BALANCE_MODEL.balanceAt} tail="right" />}
                </div>
              )}

              {hoveredBinIndex !== null && bins[hoveredBinIndex] && (
                <div className="mt-2 text-xs text-slate-400 text-center font-mono">
                  Bin {binRange(bins[hoveredBinIndex].start, bins[hoveredBinIndex].end, hoveredBinIndex === bins.length - 1)}{' '}
                  {showFrequencyLabels && <>— frequency {bins[hoveredBinIndex].count}</>}
                </div>
              )}
            </LuminaPanel>

            {/* Statistics panel — hidden in estimate_center to avoid revealing the answer */}
            {showStatistics && stats && challengeType !== 'estimate_center' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Count" value={stats.count} accent="emerald" />
                <StatCard label="Min" value={stats.min} accent="slate" />
                <StatCard label="Max" value={stats.max} accent="slate" />
                <StatCard label="Range" value={stats.max - stats.min} accent="emerald" />
              </div>
            )}

            {/* MODE-SPECIFIC INPUT */}
            <div className="space-y-3">
              {/* identify_shape: choice chips */}
              {challengeType === 'identify_shape' && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {(currentChallenge.shapeOptions ?? []).map((opt) => (
                    <LuminaChoiceChip
                      key={opt}
                      accent="emerald"
                      label={SHAPE_LABEL[opt]}
                      selected={selectedShape === opt}
                      disabled={inputClosed}
                      onClick={() => {
                        if (inputClosed || learnerBlocked()) return;
                        SoundManager.select();
                        setSelectedShape(opt);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* find_modal_bin: prompt to click a bar */}
              {challengeType === 'find_modal_bin' && (
                <div className="text-center text-sm text-slate-400">
                  {selectedBinIndex === null
                    ? 'Tap the bar you think is tallest.'
                    : `Selected: ${binRange(bins[selectedBinIndex]?.start ?? 0, bins[selectedBinIndex]?.end ?? 0, selectedBinIndex === bins.length - 1)}`}
                </div>
              )}

              {/* read_frequency / estimate_center: numeric entry */}
              {(challengeType === 'read_frequency' || challengeType === 'estimate_center') && (
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm text-slate-300" htmlFor={`${resolvedInstanceId}-answer`}>
                    {challengeType === 'read_frequency'
                      ? 'How many values are in that bin?'
                      : `Your estimate for the ${currentChallenge.targetStatistic ?? 'center'}:`}
                  </label>
                  <LuminaInput
                    id={`${resolvedInstanceId}-answer`}
                    aria-label="Your answer"
                    type="number"
                    inputMode="numeric"
                    value={numericInput}
                    disabled={inputClosed}
                    onChange={(e) => { if (!learnerBlocked()) setNumericInput(e.target.value); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-32 text-center text-lg font-mono"
                    placeholder="?"
                  />
                </div>
              )}
            </div>
            </PipWorkspace>

            {/* Check; the runtime retries and advances. */}
            {!solved && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" onClick={handleSubmit} disabled={hasSubmitted || blocked} />
              </div>
            )}

            {feedback && (
              <div
                className={`rounded-lg p-3 border ${
                  feedback.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <p className={`text-sm font-medium ${feedback.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                  {feedback.message}
                </p>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// =============================================================================
// Small subcomponent: stat card
// =============================================================================

interface StatCardProps {
  label: string;
  value: number;
  accent: 'emerald' | 'slate';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, accent }) => {
  const accentText = accent === 'emerald' ? 'text-emerald-300' : 'text-slate-200';
  return (
    <LuminaPanel>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold ${accentText} tabular-nums`}>{Math.round(value * 100) / 100}</div>
    </LuminaPanel>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const Histogram = withWorkspaceOnly<HistogramProps>('histogram', HistogramSurface, props => props.data.title);

export default Histogram;
