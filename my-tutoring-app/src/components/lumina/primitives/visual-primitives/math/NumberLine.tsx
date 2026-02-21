'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberLineMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberLineOperation {
  type: 'add' | 'subtract';
  startValue: number;
  changeValue: number;
  showJumpArc: boolean;
}

export interface NumberLineChallenge {
  id: string;
  type: 'plot_point' | 'show_jump' | 'order_values' | 'find_between';
  instruction: string;
  targetValues: number[];
  hint: string;
  /** Starting position for show_jump challenges */
  startValue?: number;
  /** Per-challenge operations for show_jump challenges */
  operations?: NumberLineOperation[];
}

export interface NumberLineData {
  title: string;
  description?: string;
  range: { min: number; max: number };
  highlights?: { label: string; value: number }[];

  // Interactive mode fields (optional — display-only if omitted)
  interactionMode?: 'plot' | 'jump' | 'compare' | 'order';
  numberType?: 'integer' | 'fraction' | 'decimal' | 'mixed';
  operations?: NumberLineOperation[];
  challenges?: NumberLineChallenge[];
  gradeBand?: 'K-2' | '3-5';
  tickInterval?: number;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberLineMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SVG_WIDTH = 760;
const SVG_HEIGHT = 240;
const SVG_PADDING = 60;
const LINE_Y = 140;
const LINE_WIDTH = SVG_WIDTH - 2 * SVG_PADDING;
const POINT_RADIUS = 10;
const TICK_HEIGHT = 12;
const MAJOR_TICK_HEIGHT = 18;

type InteractionPhase = 'explore' | 'plot' | 'operate' | 'compare';

const PHASE_LABELS: Record<InteractionPhase, string> = {
  explore: 'Explore',
  plot: 'Plot',
  operate: 'Operate',
  compare: 'Compare',
};

const CHALLENGE_PHASE_CONFIG: Record<string, PhaseConfig> = {
  plot_point: { label: 'Plot', icon: '\uD83D\uDCCD', accentColor: 'blue' },
  show_jump: { label: 'Operate', icon: '\uD83E\uDD98', accentColor: 'orange' },
  order_values: { label: 'Compare', icon: '\uD83D\uDCCA', accentColor: 'purple' },
  find_between: { label: 'Find Between', icon: '\uD83D\uDD0D', accentColor: 'emerald' },
};

// ============================================================================
// Utilities
// ============================================================================

function formatValue(value: number, numberType: string): string {
  if (numberType === 'integer') return String(Math.round(value));
  if (numberType === 'decimal') {
    const rounded = Math.round(value * 100) / 100;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(rounded * 10 % 1 === 0 ? 1 : 2);
  }
  if (numberType === 'fraction' || numberType === 'mixed') {
    return toFractionString(value);
  }
  return String(value);
}

function toFractionString(value: number): string {
  if (Number.isInteger(value)) return String(value);

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const frac = abs - whole;

  for (const denom of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const numer = Math.round(frac * denom);
    if (Math.abs(frac - numer / denom) < 0.001) {
      if (numer === 0) return `${sign}${whole}`;
      if (numer === denom) return `${sign}${whole + 1}`;
      if (whole > 0) return `${sign}${whole} ${numer}/${denom}`;
      return `${sign}${numer}/${denom}`;
    }
  }
  return abs.toFixed(2);
}

function getSnapPrecision(numberType: string, zoomLevel: number): number {
  if (numberType === 'integer') return 1;
  if (numberType === 'decimal') return zoomLevel >= 3 ? 0.01 : 0.1;
  if (numberType === 'fraction') {
    if (zoomLevel >= 3) return 1 / 8;
    if (zoomLevel >= 2) return 1 / 4;
    return 1 / 2;
  }
  // mixed
  if (zoomLevel >= 3) return 1 / 8;
  if (zoomLevel >= 2) return 1 / 4;
  return 1 / 2;
}

function snapToValue(raw: number, numberType: string, zoomLevel: number, min: number, max: number): number {
  const precision = getSnapPrecision(numberType, zoomLevel);
  const snapped = Math.round(raw / precision) * precision;
  return Math.max(min, Math.min(max, Math.round(snapped * 1000) / 1000));
}

function getDefaultTickInterval(numberType: string, zoomLevel: number, range: number): number {
  if (numberType === 'integer') {
    if (range <= 20) return 1;
    if (range <= 50) return 5;
    return 10;
  }
  const precision = getSnapPrecision(numberType, zoomLevel);
  let interval = precision;
  const maxTicks = 25;
  while (range / interval > maxTicks) interval *= 2;
  return interval;
}

function challengeTypeToPhase(type: string): InteractionPhase {
  if (type === 'plot_point' || type === 'find_between') return 'plot';
  if (type === 'show_jump') return 'operate';
  if (type === 'order_values') return 'compare';
  return 'explore';
}

// ============================================================================
// Component
// ============================================================================

interface NumberLineProps {
  data: NumberLineData;
  className?: string;
}

const NumberLine: React.FC<NumberLineProps> = ({ data, className }) => {
  const {
    title,
    description,
    range: dataRange,
    highlights = [],
    interactionMode = 'plot',
    numberType: defaultNumberType = 'integer',
    operations = [],
    challenges = [],
    gradeBand = 'K-2',
    tickInterval: customTickInterval,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const { min: rangeMin = 0, max: rangeMax = 10 } = dataRange || {};
  const isK2 = gradeBand === 'K-2';
  const isInteractive = challenges.length > 0;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [activeNumberType, setActiveNumberType] = useState(defaultNumberType);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewCenter, setViewCenter] = useState((rangeMin + rangeMax) / 2);

  // Points placed by the student
  const [placedPoints, setPlacedPoints] = useState<number[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Order mode
  const [selectedOrderValue, setSelectedOrderValue] = useState<number | null>(null);
  const [orderedPlacements, setOrderedPlacements] = useState<Map<number, number>>(new Map());

  // Jump mode
  const [jumpEndPoints, setJumpEndPoints] = useState<number[]>([]);

  // Challenge tracking (shared hooks)
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
    phaseConfig: CHALLENGE_PHASE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  // Feedback state
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const stableInstanceIdRef = useRef(instanceId || `number-line-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const currentPhase: InteractionPhase = currentChallenge
    ? challengeTypeToPhase(currentChallenge.type)
    : 'explore';

  // Per-challenge operations take priority over global operations
  const activeOperations: NumberLineOperation[] = currentChallenge?.operations?.length
    ? currentChallenge.operations
    : operations;

  // -------------------------------------------------------------------------
  // Coordinate Conversion
  // -------------------------------------------------------------------------
  const visibleRange = useMemo(() => (rangeMax - rangeMin) / zoomLevel, [rangeMin, rangeMax, zoomLevel]);
  const visibleMin = useMemo(() => {
    const raw = viewCenter - visibleRange / 2;
    return Math.max(rangeMin, Math.min(raw, rangeMax - visibleRange));
  }, [viewCenter, visibleRange, rangeMin, rangeMax]);
  const visibleMax = useMemo(() => Math.min(rangeMax, visibleMin + visibleRange), [visibleMin, visibleRange, rangeMax]);

  const valueToX = useCallback((value: number) => {
    const range = visibleMax - visibleMin;
    if (range === 0) return SVG_PADDING;
    return SVG_PADDING + ((value - visibleMin) / range) * LINE_WIDTH;
  }, [visibleMin, visibleMax]);

  const xToValue = useCallback((clientX: number) => {
    if (!svgRef.current) return visibleMin;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    const range = visibleMax - visibleMin;
    return visibleMin + ((svgX - SVG_PADDING) / LINE_WIDTH) * range;
  }, [visibleMin, visibleMax]);

  // -------------------------------------------------------------------------
  // Tick Marks
  // -------------------------------------------------------------------------
  const ticks = useMemo(() => {
    const interval = customTickInterval || getDefaultTickInterval(activeNumberType, zoomLevel, visibleMax - visibleMin);
    const result: { value: number; isMajor: boolean }[] = [];
    const start = Math.ceil(visibleMin / interval) * interval;
    for (let v = start; v <= visibleMax + interval * 0.001; v += interval) {
      result.push({ value: Math.round(v * 1000) / 1000, isMajor: Number.isInteger(Math.round(v * 1000) / 1000) });
    }
    return result;
  }, [activeNumberType, zoomLevel, visibleMin, visibleMax, customTickInterval]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NumberLineMetrics>({
    primitiveType: 'number-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    rangeMin,
    rangeMax,
    numberType: activeNumberType,
    interactionMode,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free explore',
    challengeType: currentChallenge?.type ?? interactionMode,
    targetValues: currentChallenge?.targetValues ?? [],
    placedPoints,
    attemptNumber: currentAttempts + 1,
    zoomLevel,
    currentPhase,
  }), [
    rangeMin, rangeMax, activeNumberType, interactionMode, gradeBand,
    challenges.length, currentChallengeIndex, currentChallenge,
    placedPoints, currentAttempts, zoomLevel, currentPhase,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'number-line',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: isK2 ? 'K-2' : '3-5',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Number line activity for ${gradeBand}. Range: ${rangeMin} to ${rangeMax}. `
      + `Mode: ${interactionMode}, number type: ${activeNumberType}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}". `
      + `Introduce warmly and read the first instruction.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, rangeMin, rangeMax, interactionMode, activeNumberType, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------

  const handleLineClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (hasSubmittedEvaluation || !isInteractive) return;
    if (draggingIndex !== null) return;

    const rawValue = xToValue(e.clientX);
    const snappedValue = snapToValue(rawValue, activeNumberType, zoomLevel, visibleMin, visibleMax);

    // Order mode: place the selected value
    if (currentChallenge?.type === 'order_values' && selectedOrderValue !== null) {
      setOrderedPlacements(prev => {
        const next = new Map(prev);
        next.set(selectedOrderValue, snappedValue);
        return next;
      });
      setSelectedOrderValue(null);
      return;
    }

    // Jump mode: set endpoint
    if (currentChallenge?.type === 'show_jump') {
      setJumpEndPoints(prev => {
        if (prev.length >= activeOperations.length) {
          // Replace last endpoint when all steps already placed
          const next = [...prev];
          next[next.length - 1] = snappedValue;
          return next;
        }
        return [...prev, snappedValue];
      });
      return;
    }

    // Plot / find_between: add a point
    if (currentChallenge?.type === 'plot_point' || currentChallenge?.type === 'find_between') {
      const maxPoints = currentChallenge.targetValues.length;
      setPlacedPoints(prev => {
        if (prev.length >= maxPoints) {
          // Replace the last point
          const next = [...prev];
          next[next.length - 1] = snappedValue;
          return next;
        }
        return [...prev, snappedValue];
      });
    }
  }, [hasSubmittedEvaluation, isInteractive, draggingIndex, xToValue, activeNumberType,
      zoomLevel, visibleMin, visibleMax, currentChallenge, selectedOrderValue]);

  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingIndex(index);
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIndex === null) return;
    const rawValue = xToValue(e.clientX);
    const snappedValue = snapToValue(rawValue, activeNumberType, zoomLevel, visibleMin, visibleMax);
    setPlacedPoints(prev => {
      const next = [...prev];
      next[draggingIndex] = snappedValue;
      return next;
    });
  }, [draggingIndex, xToValue, activeNumberType, zoomLevel, visibleMin, visibleMax]);

  const handlePointerUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isK2 && activeNumberType === 'integer') return;
    e.preventDefault();
    setZoomLevel(prev => {
      const next = e.deltaY < 0 ? Math.min(prev + 0.5, 5) : Math.max(prev - 0.5, 1);
      return next;
    });
  }, [isK2, activeNumberType]);

  // Pan
  const handlePan = useCallback((direction: 'left' | 'right') => {
    const step = visibleRange * 0.25;
    setViewCenter(prev => {
      const next = direction === 'left' ? prev - step : prev + step;
      return Math.max(rangeMin + visibleRange / 2, Math.min(rangeMax - visibleRange / 2, next));
    });
  }, [visibleRange, rangeMin, rangeMax]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const targets = currentChallenge.targetValues;
    let correct = false;
    let accuracy = 0;

    switch (currentChallenge.type) {
      case 'plot_point': {
        const tolerance = getSnapPrecision(activeNumberType, zoomLevel);
        const matched = targets.every(target =>
          placedPoints.some(p => Math.abs(p - target) <= tolerance + 0.001)
        );
        correct = matched;
        if (matched && placedPoints.length > 0) {
          const errors = targets.map(target => {
            const closest = placedPoints.reduce((best, p) =>
              Math.abs(p - target) < Math.abs(best - target) ? p : best
            , placedPoints[0]);
            return Math.abs(closest - target);
          });
          const avgError = errors.reduce((s, e) => s + e, 0) / errors.length;
          accuracy = Math.max(0, 100 - (avgError / Math.max(rangeMax - rangeMin, 1)) * 200);
        }
        break;
      }
      case 'show_jump': {
        if (activeOperations.length > 0 && jumpEndPoints.length === activeOperations.length) {
          const tolerance = getSnapPrecision(activeNumberType, zoomLevel);
          let totalError = 0;
          let allCorrect = true;
          for (let i = 0; i < activeOperations.length; i++) {
            const op = activeOperations[i];
            const expected = op.type === 'add'
              ? op.startValue + op.changeValue
              : op.startValue - op.changeValue;
            const error = Math.abs(jumpEndPoints[i] - expected);
            if (error > tolerance + 0.001) allCorrect = false;
            totalError += error;
          }
          correct = allCorrect;
          const avgError = totalError / activeOperations.length;
          accuracy = correct ? Math.max(0, 100 - (avgError / Math.max(rangeMax - rangeMin, 1)) * 100) : 0;
        }
        break;
      }
      case 'order_values': {
        if (orderedPlacements.size === targets.length) {
          const placedOrder = Array.from(orderedPlacements.entries())
            .sort((a, b) => a[1] - b[1])
            .map(e => e[0]);
          const targetOrder = [...targets].sort((a, b) => a - b);
          correct = placedOrder.every((v, i) => v === targetOrder[i]);
          accuracy = correct ? 100 : 0;
        }
        break;
      }
      case 'find_between': {
        if (placedPoints.length > 0 && targets.length >= 2) {
          const low = Math.min(...targets);
          const high = Math.max(...targets);
          const point = placedPoints[placedPoints.length - 1];
          correct = point > low && point < high;
          accuracy = correct ? 100 : 0;
        }
        break;
      }
    }

    if (correct) {
      setFeedback(isK2 ? 'Great job!' : 'Correct!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: Math.round(accuracy),
        accuracy: Math.round(accuracy),
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly completed "${currentChallenge.instruction}". `
        + `Attempts: ${currentAttempts + 1}. Congratulate briefly.`,
        { silent: true }
      );
    } else {
      setFeedback(currentChallenge.hint || 'Not quite. Try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Challenge: "${currentChallenge.instruction}". `
        + `Student placed: [${placedPoints.join(', ')}]. Target: [${targets.join(', ')}]. `
        + `Attempt ${currentAttempts + 1}. Give a hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, placedPoints, jumpEndPoints, orderedPlacements, activeOperations,
      activeNumberType, zoomLevel, rangeMin, rangeMax, isK2, currentAttempts, sendText,
      incrementAttempts, recordResult]);

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete — use phaseResults for AI feedback
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challengeResults.length > 0
        ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / challengeResults.length)
        : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `${challenges.length} challenges completed. Give encouraging phase-specific feedback.`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const avgAccuracy = challengeResults.length > 0
          ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / challengeResults.length)
          : 0;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const score = Math.round((totalCorrect / challenges.length) * 100);

        const lastTarget = currentChallenge?.targetValues?.[0] ?? 0;
        const lastPlaced = placedPoints[0] ?? jumpEndPoints[jumpEndPoints.length - 1] ?? 0;

        const metrics: NumberLineMetrics = {
          type: 'number-line',
          targetValue: lastTarget,
          placedValue: lastPlaced,
          error: Math.abs(lastPlaced - lastTarget),
          accuracy: avgAccuracy,
          scaleMin: rangeMin,
          scaleMax: rangeMax,
          scaleType: activeNumberType === 'fraction' ? 'fraction' : activeNumberType === 'decimal' ? 'decimal' : 'integer',
          challengesCompleted: totalCorrect,
          totalChallenges: challenges.length,
          averageAccuracy: avgAccuracy,
          totalAttempts,
          interactionMode,
          gradeBand,
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    // Now reset domain-specific state.
    setFeedback('');
    setFeedbackType('');
    setPlacedPoints([]);
    setJumpEndPoints([]);
    setOrderedPlacements(new Map());
    setSelectedOrderValue(null);

    const nextChallenge = challenges[currentChallengeIndex + 1];

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}". Introduce it briefly.`,
      { silent: true }
    );
  }, [advanceProgress, phaseResults, challenges, challengeResults, sendText,
      hasSubmittedEvaluation, placedPoints, jumpEndPoints, currentChallenge,
      rangeMin, rangeMax, activeNumberType, interactionMode, gradeBand, submitEvaluation,
      currentChallengeIndex]);

  // -------------------------------------------------------------------------
  // Auto-submit evaluation when all challenges complete
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const canCheck = (() => {
    if (!currentChallenge || hasSubmittedEvaluation || isCurrentChallengeComplete) return false;
    if (currentChallenge.type === 'plot_point' || currentChallenge.type === 'find_between') return placedPoints.length > 0;
    if (currentChallenge.type === 'show_jump') return jumpEndPoints.length === activeOperations.length;
    if (currentChallenge.type === 'order_values') return orderedPlacements.size >= currentChallenge.targetValues.length;
    return false;
  })();

  const showZoomControls = !isK2 && activeNumberType !== 'integer';

  // -------------------------------------------------------------------------
  // Jump Arc Rendering
  // -------------------------------------------------------------------------
  const renderJumpArc = useCallback((startVal: number, endVal: number, color: string, label?: string) => {
    const startX = valueToX(startVal);
    const endX = valueToX(endVal);
    const midX = (startX + endX) / 2;
    const arcHeight = Math.min(Math.abs(endX - startX) * 0.5, 80);
    const controlY = LINE_Y - arcHeight;
    const direction = endVal > startVal;

    return (
      <g key={`jump-${startVal}-${endVal}-${color}`}>
        <path
          d={`M ${startX} ${LINE_Y} Q ${midX} ${controlY} ${endX} ${LINE_Y}`}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray="6 3"
          opacity={0.8}
        />
        <polygon
          points={`${endX},${LINE_Y} ${endX + (direction ? -8 : 8)},${LINE_Y - 6} ${endX + (direction ? -8 : 8)},${LINE_Y + 6}`}
          fill={color}
        />
        <text
          x={midX}
          y={controlY - 8}
          textAnchor="middle"
          fill={color}
          fontSize={14}
          fontWeight="bold"
        >
          {label ?? `${direction ? '+' : '-'}${Math.abs(Math.round((endVal - startVal) * 100) / 100)}`}
        </text>
      </g>
    );
  }, [valueToX]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Display-only fallback (backward compatibility with old data)
  if (!isInteractive) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <svg
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="max-w-full h-auto rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <rect x={1} y={1} width={SVG_WIDTH - 2} height={SVG_HEIGHT - 2}
                rx={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <line
                x1={SVG_PADDING} y1={LINE_Y}
                x2={SVG_WIDTH - SVG_PADDING} y2={LINE_Y}
                stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} strokeLinecap="round"
              />
              {ticks.map((tick, i) => {
                const x = valueToX(tick.value);
                if (x < SVG_PADDING - 5 || x > SVG_WIDTH - SVG_PADDING + 5) return null;
                const h = tick.isMajor ? MAJOR_TICK_HEIGHT : TICK_HEIGHT;
                return (
                  <g key={i}>
                    <line x1={x} y1={LINE_Y - h / 2} x2={x} y2={LINE_Y + h / 2}
                      stroke={tick.isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                      strokeWidth={tick.isMajor ? 1.5 : 1} />
                    <text x={x} y={LINE_Y + h / 2 + 16} textAnchor="middle"
                      fill="rgba(255,255,255,0.5)" fontSize={tick.isMajor ? 14 : 10} fontFamily="monospace">
                      {formatValue(tick.value, activeNumberType)}
                    </text>
                  </g>
                );
              })}
              {highlights.map((hl, i) => {
                const x = valueToX(hl.value);
                if (x < SVG_PADDING || x > SVG_WIDTH - SVG_PADDING) return null;
                return (
                  <g key={`hl-${i}`}>
                    <circle cx={x} cy={LINE_Y} r={7} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
                    <text x={x} y={LINE_Y - 16} textAnchor="middle" fill="#93c5fd" fontSize={12} fontWeight="600">
                      {hl.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Interactive Mode Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {gradeBand}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {activeNumberType}
            </Badge>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase + Progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(['explore', 'plot', 'operate', 'compare'] as InteractionPhase[]).map(phase => (
              <Badge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {PHASE_LABELS[phase]}
              </Badge>
            ))}
          </div>
          {challenges.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {challenges.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      challengeResults.some(r => r.challengeId === challenges[i].id && r.correct)
                        ? 'bg-emerald-400'
                        : i === currentChallengeIndex
                          ? 'bg-orange-400 animate-pulse'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-slate-500 text-xs">
                {Math.min(currentChallengeIndex + 1, challenges.length)}/{challenges.length}
              </span>
            </div>
          )}
        </div>

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            {currentChallenge.type === 'show_jump' && activeOperations.length > 1 && (
              <p className="text-slate-400 text-xs mt-1">
                {jumpEndPoints.length < activeOperations.length
                  ? `Click to place jump ${jumpEndPoints.length + 1} of ${activeOperations.length}`
                  : `All ${activeOperations.length} jumps placed — check your answer!`}
              </p>
            )}
          </div>
        )}

        {/* Order Mode: Value Chips */}
        {currentChallenge?.type === 'order_values' && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-slate-400 text-xs mr-2">Tap a value, then tap the line:</span>
            {currentChallenge.targetValues.map(val => {
              const isPlaced = orderedPlacements.has(val);
              const isSelected = selectedOrderValue === val;
              return (
                <Button
                  key={val}
                  variant="ghost"
                  size="sm"
                  className={`text-sm px-3 py-1 ${
                    isPlaced
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                      : isSelected
                        ? 'bg-orange-500/20 border-orange-400/50 text-orange-300 ring-1 ring-orange-400/50'
                        : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => !isPlaced && setSelectedOrderValue(val)}
                  disabled={isPlaced}
                >
                  {formatValue(val, activeNumberType)}
                </Button>
              );
            })}
          </div>
        )}

        {/* Number Line SVG */}
        <div className="flex justify-center">
          <svg
            ref={svgRef}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="max-w-full h-auto rounded-xl cursor-crosshair select-none"
            style={{ background: 'rgba(255,255,255,0.02)' }}
            onClick={handleLineClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Border */}
            <rect x={1} y={1} width={SVG_WIDTH - 2} height={SVG_HEIGHT - 2}
              rx={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* Main Number Line */}
            <line
              x1={SVG_PADDING} y1={LINE_Y}
              x2={SVG_WIDTH - SVG_PADDING} y2={LINE_Y}
              stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} strokeLinecap="round"
            />

            {/* End Arrows */}
            <polygon points={`${SVG_PADDING - 8},${LINE_Y} ${SVG_PADDING + 2},${LINE_Y - 5} ${SVG_PADDING + 2},${LINE_Y + 5}`}
              fill="rgba(255,255,255,0.3)" />
            <polygon points={`${SVG_WIDTH - SVG_PADDING + 8},${LINE_Y} ${SVG_WIDTH - SVG_PADDING - 2},${LINE_Y - 5} ${SVG_WIDTH - SVG_PADDING - 2},${LINE_Y + 5}`}
              fill="rgba(255,255,255,0.3)" />

            {/* Tick Marks */}
            {ticks.map((tick, i) => {
              const x = valueToX(tick.value);
              if (x < SVG_PADDING - 5 || x > SVG_WIDTH - SVG_PADDING + 5) return null;
              const h = tick.isMajor ? MAJOR_TICK_HEIGHT : TICK_HEIGHT;
              return (
                <g key={i}>
                  <line
                    x1={x} y1={LINE_Y - h / 2}
                    x2={x} y2={LINE_Y + h / 2}
                    stroke={tick.isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={tick.isMajor ? 1.5 : 1}
                  />
                  <text
                    x={x} y={LINE_Y + h / 2 + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize={tick.isMajor ? (isK2 ? 16 : 12) : 10}
                    fontFamily="monospace"
                    fontWeight={tick.isMajor ? '600' : '400'}
                  >
                    {formatValue(tick.value, activeNumberType)}
                  </text>
                </g>
              );
            })}

            {/* Pre-placed Highlights */}
            {highlights.map((hl, i) => {
              const x = valueToX(hl.value);
              if (x < SVG_PADDING || x > SVG_WIDTH - SVG_PADDING) return null;
              return (
                <g key={`hl-${i}`}>
                  <circle cx={x} cy={LINE_Y} r={6} fill="#3b82f6" opacity={0.6} />
                  <text x={x} y={LINE_Y - 16} textAnchor="middle" fill="#93c5fd" fontSize={11}>
                    {hl.label}
                  </text>
                </g>
              );
            })}

            {/* Operation Jump Arcs (pre-defined, shown as reference) */}
            {activeOperations.map((op, i) => {
              if (!op.showJumpArc) return null;
              const endVal = op.type === 'add'
                ? op.startValue + op.changeValue
                : op.startValue - op.changeValue;
              return renderJumpArc(
                op.startValue,
                endVal,
                op.type === 'add' ? '#34d399' : '#f87171',
                `${op.type === 'add' ? '+' : '-'}${op.changeValue}`
              );
            })}

            {/* Jump Mode: Start Point */}
            {currentChallenge?.type === 'show_jump' && activeOperations.length > 0 && (
              <g>
                <circle
                  cx={valueToX(activeOperations[0].startValue)}
                  cy={LINE_Y}
                  r={POINT_RADIUS}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={valueToX(activeOperations[0].startValue)}
                  y={LINE_Y + POINT_RADIUS + 20}
                  textAnchor="middle"
                  fill="#93c5fd"
                  fontSize={12}
                  fontWeight="bold"
                >
                  Start: {formatValue(activeOperations[0].startValue, activeNumberType)}
                </text>
              </g>
            )}

            {/* Jump Mode: Student's Jump Arcs */}
            {currentChallenge?.type === 'show_jump' && activeOperations.length > 0 && jumpEndPoints.map((endPt, i) => (
              renderJumpArc(
                activeOperations[i].startValue,
                endPt,
                feedbackType === 'success' ? '#34d399' : feedbackType === 'error' ? '#f87171' : '#fbbf24',
              )
            ))}

            {/* Jump Mode: Student's Endpoints */}
            {currentChallenge?.type === 'show_jump' && jumpEndPoints.map((endPt, i) => (
              <g key={`jump-pt-${i}`}>
                <circle
                  cx={valueToX(endPt)}
                  cy={LINE_Y}
                  r={POINT_RADIUS}
                  fill="#fbbf24"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={valueToX(endPt)}
                  y={LINE_Y + POINT_RADIUS + 20}
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize={12}
                  fontWeight="bold"
                >
                  {formatValue(endPt, activeNumberType)}
                </text>
              </g>
            ))}

            {/* Student-placed Points (draggable) */}
            {placedPoints.map((val, i) => {
              const x = valueToX(val);
              return (
                <g
                  key={`pt-${i}`}
                  onPointerDown={(e) => handlePointerDown(i, e)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle cx={x} cy={LINE_Y} r={POINT_RADIUS + 5} fill="transparent" />
                  <circle
                    cx={x} cy={LINE_Y} r={POINT_RADIUS}
                    fill="#f59e0b" stroke="white" strokeWidth={2}
                    className="transition-all"
                  />
                  <text
                    x={x} y={LINE_Y - POINT_RADIUS - 8}
                    textAnchor="middle" fill="#fbbf24"
                    fontSize={13} fontWeight="bold"
                  >
                    {formatValue(val, activeNumberType)}
                  </text>
                </g>
              );
            })}

            {/* Order Mode: Placed Values */}
            {currentChallenge?.type === 'order_values' && Array.from(orderedPlacements.entries()).map(([val, pos]) => {
              const x = valueToX(pos);
              return (
                <g key={`ord-${val}`}>
                  <circle cx={x} cy={LINE_Y} r={POINT_RADIUS}
                    fill="#34d399" stroke="white" strokeWidth={2} />
                  <text x={x} y={LINE_Y - POINT_RADIUS - 8}
                    textAnchor="middle" fill="#6ee7b7" fontSize={13} fontWeight="bold">
                    {formatValue(val, activeNumberType)}
                  </text>
                </g>
              );
            })}

            {/* Zoom hint */}
            {showZoomControls && (
              <text x={SVG_WIDTH - SVG_PADDING} y={SVG_HEIGHT - 12}
                textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={10}>
                Scroll to zoom
              </text>
            )}
          </svg>
        </div>

        {/* Controls Row: Zoom + Number Type */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Number Type Toggle (3-5 mode only) */}
          {!isK2 && (
            <div className="flex items-center gap-1">
              {(['integer', 'fraction', 'decimal', 'mixed'] as const).map(nt => (
                <Button
                  key={nt}
                  variant="ghost"
                  size="sm"
                  className={`text-xs px-2 py-0.5 h-7 ${
                    activeNumberType === nt
                      ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400'
                  }`}
                  onClick={() => setActiveNumberType(nt)}
                >
                  {nt}
                </Button>
              ))}
            </div>
          )}

          {/* Zoom + Pan Controls */}
          {showZoomControls && (
            <div className="flex items-center gap-2">
              {zoomLevel > 1 && (
                <Button variant="ghost" size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 w-7 h-7 p-0 text-xs"
                  onClick={() => handlePan('left')}>
                  &larr;
                </Button>
              )}
              <Button variant="ghost" size="sm"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 w-7 h-7 p-0 text-xs"
                onClick={() => setZoomLevel(z => Math.max(1, z - 0.5))}>
                &minus;
              </Button>
              <span className="text-slate-500 text-xs w-14 text-center">{zoomLevel.toFixed(1)}x</span>
              <Button variant="ghost" size="sm"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 w-7 h-7 p-0 text-xs"
                onClick={() => setZoomLevel(z => Math.min(5, z + 0.5))}>
                +
              </Button>
              {zoomLevel > 1 && (
                <Button variant="ghost" size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 w-7 h-7 p-0 text-xs"
                  onClick={() => handlePan('right')}>
                  &rarr;
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={checkAnswer}
                  disabled={!canCheck}
                >
                  Check Answer
                </Button>
                {(placedPoints.length > 0 || jumpEndPoints.length > 0 || orderedPlacements.size > 0) && (
                  <Button
                    variant="ghost"
                    className="bg-slate-800/30 border border-white/10 hover:bg-white/5 text-slate-400"
                    onClick={() => {
                      setPlacedPoints([]);
                      setJumpEndPoints([]);
                      setOrderedPlacements(new Map());
                      setSelectedOrderValue(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint after 2 failed attempts */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}

        {/* Phase Summary Panel — shown when all challenges complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Number Line Complete!"
            celebrationMessage={`You completed all ${challenges.length} challenges!`}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NumberLine;
