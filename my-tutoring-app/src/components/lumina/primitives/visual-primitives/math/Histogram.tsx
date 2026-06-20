'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaPanel,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HistogramMetrics } from '../../../evaluation/types';
import { useChallengeProgress, type ChallengeResult } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** The within-mode support tier that produced this session (debug / future
   *  tutor calibration). Display logic keys off the resolved flags above. */
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

const SHAPE_LABEL: Record<HistogramShapeKind, string> = {
  symmetric: 'Symmetric',
  'right-skewed': 'Right-Skewed',
  'left-skewed': 'Left-Skewed',
  bimodal: 'Bimodal',
  uniform: 'Uniform',
};

const phaseScore = (attempts: number): number =>
  Math.max(20, 100 - Math.max(0, attempts - 1) * 20);

/**
 * Keep the AI tutor's reveal level in sync with BOTH the support tier and the
 * mode, so it never leaks what the workspace withheld. Two rules combine:
 *  - The ANSWER is never named at any tier. For identify_shape the shape-name
 *    IS the answer, so the tutor must never say symmetric/skewed/etc.; likewise
 *    the modal bin, the bin count, and the mean/median are answers.
 *  - The STRATEGY is named at easy, nudged at medium, withdrawn at hard — matching
 *    the generator's scaffolding withdrawal (stat panel / bar-count labels / hint).
 */
const tutorRevealPolicy = (
  tier: 'easy' | 'medium' | 'hard' | undefined,
  type: HistogramChallengeType,
): string => {
  const neverReveal =
    type === 'identify_shape'
      ? ' Never name the distribution shape (symmetric / skewed / bimodal / uniform) — that IS the answer.'
      : type === 'find_modal_bin'
        ? ' Never say which bin is the tallest — that IS the answer.'
        : type === 'read_frequency'
          ? ' Never state the bin\'s count — that IS the answer.'
          : ' Never state the mean or median value — that IS the answer.';
  switch (tier) {
    case 'easy':
      return (
        ' SUPPORT TIER EASY: you may name the STRATEGY — point to where to look' +
        ' (the tallest bars, the balance of the tails, the height up the y-axis, the balance point)' +
        ' and walk the student through reading it step by step.' + neverReveal
      );
    case 'medium':
      return (
        ' SUPPORT TIER MEDIUM: the workspace still shows its aids — nudge the student\'s' +
        ' reading of the graph; do not narrate the whole strategy.' + neverReveal
      );
    case 'hard':
      return (
        ' SUPPORT TIER HARD: on-screen aids (stat panel, bar-count labels, hint) are withdrawn —' +
        ' do NOT name the strategy or which feature to read; ask what the student notices in the bars themselves.' +
        neverReveal
      );
    default:
      return neverReveal;
  }
};

interface Bin {
  start: number;
  end: number;
  count: number;
}

function computeBins(data: number[], binWidth: number, binStart: number): Bin[] {
  if (data.length === 0 || binWidth <= 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const effectiveStart = binStart <= min ? binStart : Math.floor(min / binWidth) * binWidth;
  const effectiveEnd = Math.ceil((max - effectiveStart) / binWidth) * binWidth + effectiveStart;
  const numBins = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / binWidth));
  const out: Bin[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = effectiveStart + i * binWidth;
    const end = start + binWidth;
    const count = data.filter((v) => v >= start && v < end).length;
    out.push({ start, end, count });
  }
  return out;
}

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
}

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
}) => {
  const maxFrequency = useMemo(() => {
    if (bins.length === 0) return 1;
    return Math.max(...bins.map((b) => b.count), 1);
  }, [bins]);

  if (bins.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <p>No data available.</p>
      </div>
    );
  }

  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;

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

      {/* Axes */}
      <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke="#475569" strokeWidth={2} />
      <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} stroke="#475569" strokeWidth={2} />

      {/* Y-ticks and gridlines */}
      {Array.from({ length: 6 }).map((_, i) => {
        const y = PLOT_BOTTOM - (i * plotHeight) / 5;
        const value = Math.round((maxFrequency * 1.1 * i) / 5);
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

      {/* Bars */}
      {bins.map((bin, index) => {
        const barWidth = plotWidth / bins.length - 4;
        const barHeight = (bin.count / (maxFrequency * 1.1)) * plotHeight;
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
              fillOpacity={isSelected || isTarget ? 0.85 : isHovered ? 0.9 : 0.7}
              stroke={strokeColor}
              strokeWidth={isSelected || isTarget ? 2.5 : isHovered ? 2 : 1}
              rx={2}
              className={`transition-all duration-150 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              onMouseEnter={() => onBinHover(index)}
              onMouseLeave={() => onBinHover(null)}
              onClick={() => clickable && onBinClick(index)}
            />

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
              x={x + barWidth / 2}
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

      {/* Last x-axis label */}
      {bins.length > 0 && (
        <text
          x={PLOT_LEFT + plotWidth - 2}
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

const Histogram: React.FC<HistogramProps> = ({ data, className }) => {
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

  // -- Shared hooks ---------------------------------------------------------
  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
    reset,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (c) => c.id,
  });

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
    resetAttempt,
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
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);
  const hintViewedRef = useRef(false);
  const recordedRef = useRef(false);
  const [hintsViewedSession, setHintsViewedSession] = useState(0);
  const [hoveredBinIndex, setHoveredBinIndex] = useState<number | null>(null);

  // -- Derived state --------------------------------------------------------
  const currentChallenge = challenges[currentIndex] ?? null;
  const currentChallengeId = currentChallenge?.id ?? null;

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
  const showFrequencyLabels =
    data.showFrequencyLabels ??
    (challengeType === 'identify_shape' || challengeType === 'estimate_center');

  // Target bin outline for read_frequency
  const targetBin = useMemo(() => {
    if (!currentChallenge) return null;
    if (challengeType !== 'read_frequency') return null;
    if (currentChallenge.targetBinStart === undefined || currentChallenge.targetBinEnd === undefined) return null;
    return { start: currentChallenge.targetBinStart, end: currentChallenge.targetBinEnd };
  }, [currentChallenge, challengeType]);

  // -- AI tutoring ----------------------------------------------------------
  // Catalog `tutoring` block (catalog/math.ts) supplies the scaffold; this hook
  // wires the runtime context + speech triggers so the tutor stops falling back
  // to the generic message. contextKeys in the catalog mirror these field names.
  const aiPrimitiveData = useMemo(
    () => ({
      challengeType,
      currentChallengeIndex: currentIndex + 1,
      totalChallenges: challenges.length,
      contextTitle: currentChallenge?.contextTitle ?? '',
      prompt: currentChallenge?.prompt ?? '',
      xAxisLabel: currentChallenge?.xAxisLabel ?? '',
      binWidth: currentChallenge?.binWidth,
      binStart: currentChallenge?.binStart,
      attempts,
      gradeBand,
      supportTier: data.supportTier,
    }),
    [challengeType, currentIndex, challenges.length, currentChallenge, attempts, gradeBand, data.supportTier],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'histogram',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand ?? '6-8',
  });

  // Session intro — once, on the first histogram.
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    if (challenges.length === 0 || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] ${title || 'Reading Histograms'} — ${challenges.length} histograms in this session, ` +
        `mode ${challengeType}. First histogram: ${currentChallenge.contextTitle}. Prompt: ${currentChallenge.prompt}. ` +
        `Briefly welcome the student and orient them to the first histogram.` +
        tutorRevealPolicy(data.supportTier, challengeType),
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, title, challengeType, data.supportTier, sendText]);

  // Per-histogram handoff — exactly one AI turn per advance (skips the first,
  // which the intro covers), with the FULL new-histogram data to avoid the
  // turn-race hallucination documented in ADDING_TUTORING_SCAFFOLD.md.
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
    sendText(
      `[NEXT_HISTOGRAM] Histogram ${currentIndex + 1} of ${challenges.length}: ${currentChallenge.contextTitle}. ` +
        `Prompt: ${currentChallenge.prompt}. Briefly introduce this new histogram — name its real-world context.` +
        tutorRevealPolicy(data.supportTier, challengeType),
      { silent: true },
    );
  }, [currentChallenge, currentIndex, challenges.length, isConnected, challengeType, data.supportTier, sendText]);

  // -- Per-challenge reset (canonical pattern, §6c) -------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setSelectedShape(null);
    setSelectedBinIndex(null);
    setNumericInput('');
    setFeedback(null);
    setShowHint(false);
    setAttempts(0);
    attemptsRef.current = 0;
    hintViewedRef.current = false;
    recordedRef.current = false;
    setHoveredBinIndex(null);
  }, [currentChallengeId]);

  // -- Submit handler -------------------------------------------------------
  const handleSubmit = useCallback(() => {
    if (!currentChallenge || recordedRef.current || hasSubmitted) return;

    let isCorrect = false;
    let studentAnswer: string | number = '';
    let targetAnswer: string | number = '';
    let validationError: string | null = null;

    if (challengeType === 'identify_shape') {
      if (!selectedShape) {
        validationError = 'Pick a shape from the choices below.';
      } else {
        studentAnswer = selectedShape;
        targetAnswer = currentChallenge.expectedShape ?? '';
        isCorrect = selectedShape === currentChallenge.expectedShape;
      }
    } else if (challengeType === 'find_modal_bin') {
      if (selectedBinIndex === null) {
        validationError = 'Click the tallest bar to choose its bin.';
      } else {
        const chosenBin = bins[selectedBinIndex];
        studentAnswer = chosenBin ? `[${chosenBin.start}, ${chosenBin.end})` : '';
        targetAnswer = `[${currentChallenge.expectedBinStart}, ${currentChallenge.expectedBinEnd})`;
        isCorrect = !!chosenBin && chosenBin.start === currentChallenge.expectedBinStart;
      }
    } else if (challengeType === 'read_frequency') {
      const num = parseFloat(numericInput);
      if (isNaN(num)) {
        validationError = 'Type a whole number.';
      } else {
        studentAnswer = num;
        targetAnswer = currentChallenge.targetFrequency ?? 0;
        isCorrect = num === currentChallenge.targetFrequency;
      }
    } else if (challengeType === 'estimate_center') {
      const num = parseFloat(numericInput);
      if (isNaN(num)) {
        validationError = 'Type a number.';
      } else {
        studentAnswer = num;
        targetAnswer = currentChallenge.targetAnswer ?? 0;
        const tol = currentChallenge.tolerance ?? 0;
        isCorrect = Math.abs(num - (currentChallenge.targetAnswer ?? 0)) <= tol;
      }
    }

    if (validationError) {
      SoundManager.invalid();
      setFeedback({ message: validationError, correct: false });
      return;
    }

    const nextAttempts = attemptsRef.current + 1;
    attemptsRef.current = nextAttempts;
    setAttempts(nextAttempts);

    if (isCorrect) {
      SoundManager.playCorrect();
      recordedRef.current = true;
      const score = phaseScore(nextAttempts);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: nextAttempts,
        score,
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
      sendText(
        `[ANSWER_CORRECT] The student read histogram ${currentIndex + 1} of ${challenges.length} ` +
          `(${currentChallenge.contextTitle}, mode ${challengeType}) correctly on attempt ${nextAttempts}. ` +
          `Acknowledge briefly${
            currentIndex + 1 < challenges.length ? ' and preview the next histogram.' : ' — the session is wrapping up.'
          }`,
        { silent: true },
      );
      setTimeout(() => advance(), 1100);
    } else {
      SoundManager.playIncorrect();
      const msg =
        challengeType === 'identify_shape'
          ? 'Not quite — take another look at the bars.'
          : challengeType === 'find_modal_bin'
            ? 'Not the tallest bar — look again.'
            : challengeType === 'read_frequency'
              ? 'Not quite — count the bar height again.'
              : 'Not quite — try a different estimate.';
      setFeedback({ message: msg, correct: false });
      sendText(
        `[ANSWER_INCORRECT] On histogram ${currentIndex + 1} (${currentChallenge.contextTitle}, mode ${challengeType}), ` +
          `the student answered "${studentAnswer}" — not correct (attempt ${nextAttempts}). ` +
          `Give ONE brief hint about how to read the graph, without revealing the answer.` +
          tutorRevealPolicy(data.supportTier, challengeType),
        { silent: true },
      );
    }
  }, [
    currentChallenge,
    challengeType,
    selectedShape,
    selectedBinIndex,
    numericInput,
    bins,
    advance,
    recordResult,
    hasSubmitted,
    sendText,
    currentIndex,
    challenges.length,
    data.supportTier,
  ]);

  // -- Hint handler ---------------------------------------------------------
  const handleShowHint = useCallback(() => {
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      setHintsViewedSession((n) => n + 1);
    }
  }, []);

  // -- Submit metrics on completion -----------------------------------------
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || hasSubmitted || submittedRef.current) return;
    submittedRef.current = true;

    const totalChallenges = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && (r.score ?? 0) >= 100).length;
    const overallAccuracy =
      totalChallenges > 0
        ? Math.round(
            challengeResults.reduce(
              (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
              0,
            ) / totalChallenges,
          )
        : 0;
    const averageAttemptsPerChallenge =
      totalChallenges > 0 ? Math.round((attemptsCount / totalChallenges) * 10) / 10 : 0;

    const metrics: HistogramMetrics = {
      type: 'histogram',
      challengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedSession,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    submitResult(overallAccuracy >= 70, overallAccuracy, metrics, {
      challengeResults,
    });

    sendText(
      `[ALL_COMPLETE] The student finished all ${totalChallenges} histograms (mode ${challengeType}), ` +
        `overall ${overallAccuracy}%. Celebrate the completed session in one or two sentences.`,
      { silent: true },
    );
  }, [
    isComplete,
    hasSubmitted,
    challengeResults,
    challenges.length,
    challengeType,
    hintsViewedSession,
    submitResult,
    sendText,
  ]);

  // -- Reset ----------------------------------------------------------------
  const handleReset = useCallback(() => {
    reset();
    resetAttempt();
    submittedRef.current = false;
    setSelectedShape(null);
    setSelectedBinIndex(null);
    setNumericInput('');
    setFeedback(null);
    setShowHint(false);
    setAttempts(0);
    attemptsRef.current = 0;
    hintViewedRef.current = false;
    recordedRef.current = false;
    setHintsViewedSession(0);
    setHoveredBinIndex(null);
  }, [reset, resetAttempt]);

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

  const localOverallScore = useMemo(() => {
    if (!isComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challenges.length,
    );
  }, [isComplete, challenges.length, challengeResults]);

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
            overallScore={submittedResult?.score ?? localOverallScore}
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
                onBinClick={(idx) => { SoundManager.select(); setSelectedBinIndex(idx); }}
                onBinHover={setHoveredBinIndex}
              />

              {hoveredBinIndex !== null && bins[hoveredBinIndex] && (
                <div className="mt-2 text-xs text-slate-400 text-center font-mono">
                  Bin [{bins[hoveredBinIndex].start}, {bins[hoveredBinIndex].end}){' '}
                  {showFrequencyLabels && <>— frequency {bins[hoveredBinIndex].count}</>}
                </div>
              )}
            </LuminaPanel>

            {/* Statistics panel — hidden in estimate_center to avoid revealing the answer */}
            {showStatistics && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Count" value={stats.count} accent="emerald" />
                <StatCard label="Min" value={stats.min} accent="slate" />
                <StatCard label="Max" value={stats.max} accent="slate" />
                <StatCard label="Range" value={stats.max - stats.min} accent="emerald" />
              </div>
            )}

            {/* MODE-SPECIFIC INPUT */}
            <div className="space-y-3">
              {/* identify_shape: MC chips */}
              {challengeType === 'identify_shape' && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {(currentChallenge.shapeOptions ?? []).map((opt) => (
                    <Button
                      key={opt}
                      variant="ghost"
                      onClick={() => { SoundManager.select(); setSelectedShape(opt); }}
                      className={`bg-white/5 border hover:bg-white/10 ${
                        selectedShape === opt
                          ? 'border-emerald-400/60 text-emerald-300'
                          : 'border-white/20 text-slate-200'
                      }`}
                    >
                      {SHAPE_LABEL[opt]}
                    </Button>
                  ))}
                </div>
              )}

              {/* find_modal_bin: prompt to click a bar */}
              {challengeType === 'find_modal_bin' && (
                <div className="text-center text-sm text-slate-400">
                  {selectedBinIndex === null
                    ? 'Click on the bar you think is tallest.'
                    : `Selected: [${bins[selectedBinIndex]?.start}, ${bins[selectedBinIndex]?.end})`}
                </div>
              )}

              {/* read_frequency / estimate_center: numeric entry */}
              {(challengeType === 'read_frequency' || challengeType === 'estimate_center') && (
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm text-slate-300">
                    {challengeType === 'read_frequency'
                      ? 'How many values are in that bin?'
                      : `Your estimate for the ${currentChallenge.targetStatistic ?? 'center'}:`}
                  </label>
                  <LuminaInput
                    type="number"
                    inputMode="numeric"
                    value={numericInput}
                    onChange={(e) => setNumericInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-32 text-center text-lg font-mono"
                    placeholder="?"
                  />
                </div>
              )}

              {/* Check button */}
              <div className="flex justify-center">
                <LuminaActionButton action="check" onClick={handleSubmit} disabled={hasSubmitted} />
              </div>

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

              {showHint && currentChallenge.hint && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-200 text-sm">{currentChallenge.hint}</p>
                </div>
              )}

              {!feedback?.correct && attempts >= 2 && !showHint && currentChallenge.hint && (
                <div className="flex justify-center">
                  <LuminaButton onClick={handleShowHint}>Need a Hint?</LuminaButton>
                </div>
              )}
            </div>
          </>
        )}

        {isComplete && (
          <div className="flex justify-center">
            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
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

export default Histogram;
