'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MeasurementToolsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress, type ChallengeResult } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export type MeasurementToolsChallengeType = 'measure' | 'compare' | 'estimate' | 'convert';

export interface MeasurementToolsChallenge {
  id: string;
  shapeType: 'rectangle' | 'square';
  widthInches: number;
  heightInches: number;
  color: string;
  label: string;
  hint: string;
}

export interface MeasurementToolsData {
  primitiveType?: string;
  title: string;
  description?: string;
  challengeType: MeasurementToolsChallengeType;
  challenges: MeasurementToolsChallenge[];
  rulerLengthInches: number;
  unit: 'inches' | 'centimeters';
  precision: 'whole' | 'half';
  gradeBand: 'K-2' | '3-5';
  convertToUnit?: 'inches' | 'centimeters';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MeasurementToolsMetrics>) => void;
}

interface MeasurementToolsProps {
  data: MeasurementToolsData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RULER_HEIGHT = 64;
const SHAPE_AREA_Y = 40;
const CANVAS_WIDTH = 660;
const RULER_LEFT_PAD = 40;
const SHAPE_RULER_GAP = 12;
const BOTTOM_PAD = 20;
const INCH_TO_CM = 2.54;

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  measure: { label: 'Measure', icon: '📏', accentColor: 'blue' },
  compare: { label: 'Compare', icon: '⚖️', accentColor: 'purple' },
  estimate: { label: 'Estimate', icon: '📐', accentColor: 'cyan' },
  convert: { label: 'Convert', icon: '🔄', accentColor: 'amber' },
};

// =============================================================================
// Helpers
// =============================================================================

const phaseScore = (attempts: number): number =>
  Math.max(20, 100 - Math.max(0, attempts - 1) * 20);

const convertValue = (value: number, fromUnit: string, toUnit: string): number => {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'inches' && toUnit === 'centimeters') return value * INCH_TO_CM;
  if (fromUnit === 'centimeters' && toUnit === 'inches') return value / INCH_TO_CM;
  return value;
};

const getCorrectOrder = (challenges: MeasurementToolsChallenge[]): string[] =>
  [...challenges].sort((a, b) => a.widthInches - b.widthInches).map((c) => c.id);

// =============================================================================
// Ruler Component (SVG)
// =============================================================================

interface RulerProps {
  lengthInches: number;
  unit: 'inches' | 'centimeters';
  precision: 'whole' | 'half';
  pixelsPerUnit: number;
  leftPad: number;
  rulerY: number;
}

const Ruler: React.FC<RulerProps> = ({ lengthInches, unit, precision, pixelsPerUnit, leftPad, rulerY }) => {
  const totalWidth = lengthInches * pixelsPerUnit;
  const step = precision === 'half' ? 0.5 : 1;
  const tickCount = Math.round(lengthInches / step);

  return (
    <g>
      <rect
        x={leftPad}
        y={rulerY}
        width={totalWidth}
        height={RULER_HEIGHT}
        rx={4}
        fill="rgba(139,92,45,0.35)"
        stroke="rgba(200,160,80,0.5)"
        strokeWidth={1.5}
      />
      {Array.from({ length: tickCount + 1 }, (_, i) => {
        const tickValue = i * step;
        if (tickValue > lengthInches) return null;
        const x = leftPad + tickValue * pixelsPerUnit;
        const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;

        return (
          <g key={i}>
            <line
              x1={x}
              y1={rulerY}
              x2={x}
              y2={rulerY + (isWhole ? 28 : 16)}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={isWhole ? 1.5 : 0.8}
            />
            {isWhole && (
              <text
                x={x}
                y={rulerY + 44}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize={13}
                fontWeight="bold"
                className="select-none"
              >
                {Math.round(tickValue)}
              </text>
            )}
          </g>
        );
      })}
      <text
        x={leftPad + totalWidth + 8}
        y={rulerY + 38}
        fill="rgba(255,255,255,0.4)"
        fontSize={11}
        className="select-none"
      >
        {unit === 'inches' ? 'in' : 'cm'}
      </text>
    </g>
  );
};

// =============================================================================
// Draggable Shape (SVG)
// =============================================================================

interface DraggableShapeProps {
  challenge: MeasurementToolsChallenge;
  pixelsPerUnit: number;
  isOnRuler: boolean;
  position: { x: number; y: number };
  onDragStart: (e: React.PointerEvent) => void;
  isDragging: boolean;
  isActive: boolean;
  isCompleted: boolean;
}

const DraggableShape: React.FC<DraggableShapeProps> = ({
  challenge,
  pixelsPerUnit,
  isOnRuler,
  position,
  onDragStart,
  isDragging,
  isActive,
  isCompleted,
}) => {
  const w = challenge.widthInches * pixelsPerUnit;
  const h = Math.max(challenge.heightInches * pixelsPerUnit, 36);

  const fillColor = isCompleted
    ? 'rgba(52,211,153,0.25)'
    : challenge.color || 'rgba(99,102,241,0.35)';
  const strokeColor = isCompleted
    ? 'rgba(52,211,153,0.6)'
    : isDragging
      ? 'rgba(251,191,36,0.8)'
      : isActive
        ? 'rgba(129,140,248,0.7)'
        : 'rgba(129,140,248,0.4)';

  return (
    <g
      onPointerDown={isCompleted ? undefined : onDragStart}
      style={{ cursor: isCompleted ? 'default' : isDragging ? 'grabbing' : 'grab' }}
    >
      {isDragging && (
        <rect
          x={position.x + 3}
          y={position.y + 3}
          width={w}
          height={h}
          rx={challenge.shapeType === 'square' ? 4 : 6}
          fill="rgba(0,0,0,0.3)"
        />
      )}

      <rect
        x={position.x}
        y={position.y}
        width={w}
        height={h}
        rx={challenge.shapeType === 'square' ? 4 : 6}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isDragging ? 2.5 : 2}
        className="transition-colors duration-150"
      />

      <text
        x={position.x + w / 2}
        y={position.y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.8)"
        fontSize={Math.min(13, w / 6)}
        fontWeight="500"
        className="select-none pointer-events-none"
      >
        {challenge.label}
      </text>

      {isCompleted && (
        <text
          x={position.x + w - 10}
          y={position.y + 14}
          textAnchor="middle"
          fill="#34d399"
          fontSize={14}
          className="select-none pointer-events-none"
        >
          ✓
        </text>
      )}

      {isActive && !isOnRuler && !isDragging && !isCompleted && (
        <text
          x={position.x + w / 2}
          y={position.y - 8}
          textAnchor="middle"
          fill="rgba(251,191,36,0.7)"
          fontSize={11}
          className="select-none pointer-events-none"
        >
          Drag onto the ruler
        </text>
      )}
    </g>
  );
};

// =============================================================================
// Snap Zone Indicator
// =============================================================================

const SnapZone: React.FC<{ leftPad: number; totalWidth: number; active: boolean; rulerY: number }> = ({
  leftPad,
  totalWidth,
  active,
  rulerY,
}) => (
  <rect
    x={leftPad}
    y={rulerY - 50}
    width={totalWidth}
    height={48}
    rx={6}
    fill={active ? 'rgba(251,191,36,0.08)' : 'transparent'}
    stroke={active ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.05)'}
    strokeWidth={1.5}
    strokeDasharray="6 4"
    className="transition-all duration-200"
  />
);

// =============================================================================
// Compare-Phase Shape Preview
// =============================================================================
// Renders each shape at its measured width on a shared scale so students can
// visually compare lengths during the comparison phase. Width is the variable
// being compared (the dimension measured on the ruler) — heights are capped to
// a uniform band so the comparison stays width-focused.

const COMPARE_PX_PER_INCH = 22;
const COMPARE_ROW_HEIGHT = 40;
const COMPARE_MAX_SHAPE_HEIGHT = 32;

const ShapePreview: React.FC<{
  challenge: MeasurementToolsChallenge;
  interactive?: boolean;
}> = ({ challenge, interactive }) => {
  const w = Math.max(challenge.widthInches * COMPARE_PX_PER_INCH, 16);
  const h = Math.min(
    Math.max(challenge.heightInches * COMPARE_PX_PER_INCH, 18),
    COMPARE_MAX_SHAPE_HEIGHT,
  );
  return (
    <svg
      width={w}
      height={COMPARE_ROW_HEIGHT}
      viewBox={`0 0 ${w} ${COMPARE_ROW_HEIGHT}`}
      className="flex-shrink-0 pointer-events-none"
      aria-hidden="true"
    >
      <rect
        x={0.75}
        y={(COMPARE_ROW_HEIGHT - h) / 2}
        width={w - 1.5}
        height={h}
        rx={challenge.shapeType === 'square' ? 3 : 5}
        fill={challenge.color}
        stroke={interactive ? 'rgba(168,85,247,0.55)' : 'rgba(168,85,247,0.4)'}
        strokeWidth={1.5}
      />
    </svg>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const MeasurementTools: React.FC<MeasurementToolsProps> = ({ data, className }) => {
  const {
    title,
    challengeType,
    challenges,
    rulerLengthInches,
    unit,
    precision,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const effectiveConvertToUnit = data.convertToUnit || (unit === 'inches' ? 'centimeters' : 'inches');
  const stableInstanceIdRef = useRef<string>(instanceId || `measurement-tools-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  const pixelsPerUnit = Math.min(
    (CANVAS_WIDTH - RULER_LEFT_PAD - 40) / rulerLengthInches,
    60,
  );
  const rulerTotalWidth = rulerLengthInches * pixelsPerUnit;

  const maxShapeH = useMemo(() => {
    return Math.max(
      ...challenges.map((c) => Math.max(c.heightInches * pixelsPerUnit, 36)),
      60,
    );
  }, [challenges, pixelsPerUnit]);

  const rulerY = SHAPE_AREA_Y + maxShapeH + SHAPE_RULER_GAP + 50;
  const canvasHeight = rulerY + RULER_HEIGHT + BOTTOM_PAD;

  // -- Shared hooks ---------------------------------------------------------
  const {
    currentIndex,
    results: challengeResults,
    isComplete: measureComplete,
    recordResult,
    advance,
    reset,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (c) => c.id,
  });

  // Each challenge's effective phase label (used by PhaseSummaryPanel).
  // For a single-mode session this is always the same key, which renders as
  // one aggregate row — same shape as factor-tree (§6a #4).
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: measureComplete,
    getChallengeType: () => challengeType,
    phaseConfig: PHASE_CONFIG,
    getScore: (rs: ChallengeResult[]) =>
      rs.length === 0
        ? 0
        : Math.round(
            rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : (r.correct ? 100 : 0)), 0) / rs.length,
          ),
  });

  const {
    submitResult,
    hasSubmitted,
    submittedResult,
    elapsedMs,
    resetAttempt,
  } = usePrimitiveEvaluation<MeasurementToolsMetrics>({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -- Per-challenge state --------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [measureAttempts, setMeasureAttempts] = useState(0);
  const measureAttemptsRef = useRef(0);
  const hintViewedRef = useRef(false);
  const recordedRef = useRef(false);
  const hasIntroducedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [shapePositions, setShapePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [onRuler, setOnRuler] = useState<Record<string, boolean>>({});

  // Convert mode per-challenge state
  const [convertStep, setConvertStep] = useState(false);
  const [convertInput, setConvertInput] = useState('');
  const [convertFeedback, setConvertFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [measuredValue, setMeasuredValue] = useState(0);
  const [convertAttempts, setConvertAttempts] = useState(0);
  const convertAttemptsRef = useRef(0);

  // Compare mode session-level state
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [compareFeedback, setCompareFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [comparisonDone, setComparisonDone] = useState(false);
  const [compareAttempts, setCompareAttempts] = useState(0);
  const [hintsViewedSession, setHintsViewedSession] = useState(0);

  // -- Derived state --------------------------------------------------------
  const currentChallenge = challenges[currentIndex] ?? null;
  const currentChallengeId = currentChallenge?.id ?? null;

  const isFullyComplete = useMemo(() => {
    if (!measureComplete) return false;
    if (challengeType === 'compare' && !comparisonDone) return false;
    return true;
  }, [measureComplete, challengeType, comparisonDone]);

  // -- Per-challenge reset (canonical pattern, §6c) -------------------------
  // Runs whenever advance() flips the index — resets every per-challenge slot.
  useEffect(() => {
    if (!currentChallenge) return;
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    setMeasureAttempts(0);
    measureAttemptsRef.current = 0;
    setConvertStep(false);
    setConvertInput('');
    setConvertFeedback(null);
    setMeasuredValue(0);
    setConvertAttempts(0);
    convertAttemptsRef.current = 0;
    hintViewedRef.current = false;
    recordedRef.current = false;

    const w = currentChallenge.widthInches * pixelsPerUnit;
    setShapePositions((prev) => ({
      ...prev,
      [currentChallenge.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
    }));
    setOnRuler((prev) => ({ ...prev, [currentChallenge.id]: false }));
  }, [currentChallengeId, pixelsPerUnit]);

  // Initialize shape positions for all challenges on mount / data swap
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    challenges.forEach((c) => {
      const w = c.widthInches * pixelsPerUnit;
      positions[c.id] = { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y };
    });
    setShapePositions(positions);
    setOnRuler({});
  }, [challenges, pixelsPerUnit]);

  // -- AI Tutoring ----------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    currentShape: currentChallenge?.label,
    shapeWidth: currentChallenge?.widthInches,
    unit,
    precision,
    gradeBand,
    isOnRuler: currentChallenge ? !!onRuler[currentChallenge.id] : false,
    currentAttempts: measureAttempts + convertAttempts,
    convertStep,
    convertToUnit: effectiveConvertToUnit,
    comparePhase: measureComplete && challengeType === 'compare' && !comparisonDone,
  }), [
    challengeType, currentIndex, challenges.length, currentChallenge, unit, precision,
    gradeBand, onRuler, measureAttempts, convertAttempts, convertStep,
    effectiveConvertToUnit, measureComplete, comparisonDone,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? '1st Grade' : '3rd Grade',
  });

  // Introduction (session-level)
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    const modeDesc =
      challengeType === 'compare'
        ? `Measure all ${challenges.length} shapes, then compare them by ordering shortest to longest.`
        : challengeType === 'convert'
          ? `Measure each shape in ${unit}, then convert the measurement to ${effectiveConvertToUnit}.`
          : `${challenges.length} shapes to measure in ${unit}. Drag each onto the ruler.`;

    sendText(
      `[ACTIVITY_START] Measurement session! ${modeDesc} ` +
      `First shape: "${currentChallenge.label}". Introduce warmly.`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, challenges.length, unit, effectiveConvertToUnit, challengeType, sendText]);

  // -- Drag handlers --------------------------------------------------------
  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!currentChallenge || hasSubmitted || convertStep) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const pos = shapePositions[currentChallenge.id];
    if (!pos) return;
    setDragOffset({ x: svgPt.x - pos.x, y: svgPt.y - pos.y });
    setIsDragging(true);
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
  }, [currentChallenge, hasSubmitted, convertStep, getSVGPoint, shapePositions]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !currentChallenge) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    setShapePositions((prev) => ({
      ...prev,
      [currentChallenge.id]: {
        x: svgPt.x - dragOffset.x,
        y: svgPt.y - dragOffset.y,
      },
    }));
  }, [isDragging, currentChallenge, getSVGPoint, dragOffset]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !currentChallenge) return;
    e.preventDefault();
    setIsDragging(false);

    const pos = shapePositions[currentChallenge.id];
    if (!pos) return;

    const shapeH = Math.max(currentChallenge.heightInches * pixelsPerUnit, 36);
    const shapeBottom = pos.y + shapeH;
    const snapZoneTop = rulerY - 50;

    if (shapeBottom >= snapZoneTop && pos.y < rulerY) {
      const snappedY = rulerY - shapeH - 2;
      setShapePositions((prev) => ({
        ...prev,
        [currentChallenge.id]: { x: RULER_LEFT_PAD, y: snappedY },
      }));
      setOnRuler((prev) => ({ ...prev, [currentChallenge.id]: true }));

      if (!onRuler[currentChallenge.id]) {
        sendText(
          `[SHAPE_PLACED] Student placed "${currentChallenge.label}" on the ruler. ` +
          `Ask: "How many ${unit} long is this shape?"`,
          { silent: true },
        );
      }
    } else if (pos.y >= rulerY + RULER_HEIGHT) {
      const w = currentChallenge.widthInches * pixelsPerUnit;
      setShapePositions((prev) => ({
        ...prev,
        [currentChallenge.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
      }));
      setOnRuler((prev) => ({ ...prev, [currentChallenge.id]: false }));
    }
  }, [isDragging, currentChallenge, shapePositions, pixelsPerUnit, rulerY, onRuler, sendText, unit]);

  // -- Helpers --------------------------------------------------------------
  /**
   * Compute and record the final per-challenge score, then advance.
   * Stale-state guard (§6a #8): bail if already recorded for this challenge.
   */
  const completeChallenge = useCallback((opts: { correct: boolean; studentMeasure: number }) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    recordedRef.current = true;

    const mAttempts = Math.max(1, measureAttemptsRef.current);
    let score: number;
    if (challengeType === 'convert') {
      const cAttempts = Math.max(1, convertAttemptsRef.current);
      score = opts.correct
        ? Math.round(phaseScore(mAttempts) * 0.5 + phaseScore(cAttempts) * 0.5)
        : 0;
    } else {
      score = opts.correct ? phaseScore(mAttempts) : 0;
    }

    recordResult({
      challengeId: currentChallenge.id,
      correct: opts.correct,
      attempts: mAttempts + (challengeType === 'convert' ? convertAttemptsRef.current : 0),
      score,
      studentAnswer: opts.studentMeasure,
      targetAnswer: currentChallenge.widthInches,
    });
  }, [currentChallenge, challengeType, recordResult]);

  // -- Answer checking (measure phase) --------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;

    const studentNum = parseFloat(answerInput);
    if (isNaN(studentNum)) {
      setFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    const nextAttempts = measureAttemptsRef.current + 1;
    measureAttemptsRef.current = nextAttempts;
    setMeasureAttempts(nextAttempts);

    const tolerance = precision === 'half' ? 0.25 : 0.5;
    const isCorrect = Math.abs(studentNum - currentChallenge.widthInches) <= tolerance;

    if (challengeType === 'convert' && isCorrect) {
      // Correct measurement → switch to convert step (per-challenge multi-step)
      setMeasuredValue(currentChallenge.widthInches);
      setFeedback({
        message: `Yes! The ${currentChallenge.label} is ${currentChallenge.widthInches} ${unit} long. Now convert it!`,
        correct: true,
      });
      sendText(
        `[MEASURE_CORRECT] Student measured "${currentChallenge.label}" as ${studentNum} ${unit}. ` +
        `Now convert to ${effectiveConvertToUnit}. Encourage them.`,
        { silent: true },
      );
      setTimeout(() => {
        setFeedback(null);
        setConvertStep(true);
        setConvertInput('');
        setConvertFeedback(null);
      }, 1200);
      return;
    }

    if (isCorrect) {
      completeChallenge({ correct: true, studentMeasure: studentNum });
      setFeedback({
        message: `Yes! The ${currentChallenge.label} is ${currentChallenge.widthInches} ${unit} long!`,
        correct: true,
      });
      sendText(
        `[ANSWER_CORRECT] Student measured "${currentChallenge.label}" as ${studentNum} ${unit}. ` +
        `Correct: ${currentChallenge.widthInches} ${unit}. Attempts: ${nextAttempts}. Brief celebration.`,
        { silent: true },
      );

      setTimeout(() => {
        const advanced = advance();
        if (advanced) {
          const nextIdx = currentIndex + 1;
          const nextChallenge = challenges[nextIdx];
          if (nextChallenge) {
            sendText(
              `[NEXT_ITEM] Shape ${nextIdx + 1} of ${challenges.length}: "${nextChallenge.label}". ` +
              `Say: "Next shape! Drag it onto the ruler to measure."`,
              { silent: true },
            );
          }
        } else if (challengeType === 'compare') {
          sendText(
            `[MEASURE_PHASE_DONE] All shapes measured. Comparison phase begins. ` +
            `Explain: "Great measuring! Now order the shapes shortest to longest."`,
            { silent: true },
          );
        }
      }, 1100);
    } else {
      setFeedback({
        message: 'Not quite — look at the ruler more carefully!',
        correct: false,
      });
      sendText(
        `[ANSWER_INCORRECT] Student guessed ${studentNum} ${unit} for "${currentChallenge.label}" ` +
        `(actual: ${currentChallenge.widthInches} ${unit}). Attempt ${nextAttempts}. Give a hint.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, answerInput, precision, unit, challengeType, effectiveConvertToUnit,
    completeChallenge, advance, currentIndex, challenges, sendText,
  ]);

  // -- Conversion checking (convert mode) -----------------------------------
  const checkConversion = useCallback(() => {
    if (!currentChallenge) return;

    const studentNum = parseFloat(convertInput);
    if (isNaN(studentNum)) {
      setConvertFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    const nextAttempts = convertAttemptsRef.current + 1;
    convertAttemptsRef.current = nextAttempts;
    setConvertAttempts(nextAttempts);

    const correctConverted = convertValue(measuredValue, unit, effectiveConvertToUnit);
    const tolerance = Math.max(0.5, correctConverted * 0.1);
    const isCorrect = Math.abs(studentNum - correctConverted) <= tolerance;

    if (isCorrect) {
      completeChallenge({ correct: true, studentMeasure: measuredValue });
      setConvertFeedback({
        message: `Correct! ${measuredValue} ${unit} = ${Math.round(correctConverted * 10) / 10} ${effectiveConvertToUnit}!`,
        correct: true,
      });
      sendText(
        `[CONVERT_CORRECT] Student converted ${measuredValue} ${unit} to ${studentNum} ${effectiveConvertToUnit}. ` +
        `Brief celebration.`,
        { silent: true },
      );

      setTimeout(() => {
        const advanced = advance();
        if (advanced) {
          const nextIdx = currentIndex + 1;
          const nextChallenge = challenges[nextIdx];
          if (nextChallenge) {
            sendText(
              `[NEXT_ITEM] Shape ${nextIdx + 1} of ${challenges.length}: "${nextChallenge.label}". ` +
              `Measure it and convert!`,
              { silent: true },
            );
          }
        }
      }, 1100);
    } else {
      setConvertFeedback({
        message: effectiveConvertToUnit === 'centimeters'
          ? `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try multiplying!`
          : `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try dividing!`,
        correct: false,
      });
      sendText(
        `[CONVERT_INCORRECT] Student tried ${studentNum} ${effectiveConvertToUnit} ` +
        `(correct: ~${Math.round(correctConverted * 10) / 10}). Attempt ${nextAttempts}. Help without revealing.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, convertInput, measuredValue, unit, effectiveConvertToUnit,
    completeChallenge, advance, currentIndex, challenges, sendText,
  ]);

  // -- Comparison checking (compare mode session-level) ---------------------
  const handleComparisonCheck = useCallback(() => {
    const correctOrder = getCorrectOrder(challenges);
    const isCorrect = selectedOrder.every((id, i) => id === correctOrder[i]);
    setCompareAttempts((a) => a + 1);

    if (isCorrect) {
      setCompareFeedback({ message: 'Perfect! You ordered them shortest to longest!', correct: true });
      setComparisonDone(true);
      const orderLabels = selectedOrder.map((id) => challenges.find((c) => c.id === id)?.label).join(' → ');
      sendText(
        `[COMPARE_CORRECT] Student ordered shapes correctly: ${orderLabels}. Celebrate!`,
        { silent: true },
      );
    } else {
      setCompareFeedback({ message: 'Not quite! Think back to which shapes were shorter.', correct: false });
      setSelectedOrder([]);
      sendText(
        `[COMPARE_INCORRECT] Student ordered incorrectly. Attempt ${compareAttempts + 1}. Remind without revealing.`,
        { silent: true },
      );
    }
  }, [challenges, selectedOrder, compareAttempts, sendText]);

  // -- Hint tracking --------------------------------------------------------
  const showHintHandler = useCallback(() => {
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      setHintsViewedSession((n) => n + 1);
    }
  }, []);

  // -- Evaluation on completion ---------------------------------------------
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!isFullyComplete || hasSubmitted || submittedRef.current) return;
    submittedRef.current = true;

    const totalChallenges = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount =
      challengeResults.reduce((s, r) => s + r.attempts, 0)
      + (challengeType === 'compare' ? compareAttempts : 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && (r.score ?? 0) >= 100).length;

    const challengeScoreAvg = totalChallenges > 0
      ? Math.round(
          challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / totalChallenges,
        )
      : 0;

    let overallAccuracy: number;
    if (challengeType === 'compare') {
      const compareScore = comparisonDone ? Math.max(20, 100 - (compareAttempts - 1) * 20) : 0;
      overallAccuracy = Math.round(challengeScoreAvg * 0.6 + compareScore * 0.4);
    } else {
      overallAccuracy = challengeScoreAvg;
    }

    const averageAttemptsPerChallenge = totalChallenges > 0
      ? Math.round((attemptsCount / totalChallenges) * 10) / 10
      : 0;

    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      challengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedSession,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    submitResult(
      overallAccuracy >= 70,
      overallAccuracy,
      metrics,
      { challengeResults, compareAttempts: challengeType === 'compare' ? compareAttempts : undefined },
    );

    const phaseScoreStr = phaseResults.map((p) => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[ALL_COMPLETE] Session finished! Mode: ${challengeType}. Score: ${overallAccuracy}%. ${phaseScoreStr}. Celebrate!`,
      { silent: true },
    );
  }, [
    isFullyComplete, hasSubmitted, challengeResults, challenges.length, challengeType,
    comparisonDone, compareAttempts, hintsViewedSession, submitResult, phaseResults, sendText,
  ]);

  // -- Reset ----------------------------------------------------------------
  const handleReset = () => {
    reset();
    resetAttempt();
    submittedRef.current = false;
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    setMeasureAttempts(0);
    measureAttemptsRef.current = 0;
    setConvertStep(false);
    setConvertInput('');
    setConvertFeedback(null);
    setMeasuredValue(0);
    setConvertAttempts(0);
    convertAttemptsRef.current = 0;
    setSelectedOrder([]);
    setCompareFeedback(null);
    setComparisonDone(false);
    setCompareAttempts(0);
    setHintsViewedSession(0);
    hintViewedRef.current = false;
    recordedRef.current = false;
    hasIntroducedRef.current = false;
    const positions: Record<string, { x: number; y: number }> = {};
    challenges.forEach((c) => {
      const w = c.widthInches * pixelsPerUnit;
      positions[c.id] = { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y };
    });
    setShapePositions(positions);
    setOnRuler({});
  };

  // -- Completed IDs --------------------------------------------------------
  const completedIds = useMemo(
    () => new Set(challengeResults.filter((r) => r.correct).map((r) => r.challengeId)),
    [challengeResults],
  );

  const localOverallScore = useMemo(() => {
    if (!isFullyComplete || challenges.length === 0) return 0;
    const challengeScoreAvg = Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
    if (challengeType === 'compare') {
      const compareScore = comparisonDone ? Math.max(20, 100 - (compareAttempts - 1) * 20) : 0;
      return Math.round(challengeScoreAvg * 0.6 + compareScore * 0.4);
    }
    return challengeScoreAvg;
  }, [isFullyComplete, challenges.length, challengeResults, challengeType, comparisonDone, compareAttempts]);

  // -- Mode-specific copy ---------------------------------------------------
  const getInstructionText = (): string => {
    if (!currentChallenge) return '';
    if (challengeType === 'compare') {
      return `Measure each shape by dragging it onto the ruler. After measuring all shapes, you'll compare them!`;
    }
    if (challengeType === 'convert') {
      if (convertStep) return `Convert your measurement of the ${currentChallenge.label} from ${unit} to ${effectiveConvertToUnit}.`;
      return `Drag the ${currentChallenge.label} onto the ruler and measure it in ${unit}.`;
    }
    return `Drag the ${currentChallenge.label} onto the ruler, then tell me how many ${unit} long it is.`;
  };

  const getSubtitle = (): string => {
    if (isFullyComplete) return 'Complete!';
    if (challengeType === 'compare' && measureComplete && !comparisonDone) return 'Order the shapes from shortest to longest';
    if (challengeType === 'convert' && convertStep) return 'Convert your measurement';
    return 'Drag the shape onto the ruler to measure it';
  };

  const getModeIcon = (): string => {
    if (challengeType === 'compare') return '⚖️';
    if (challengeType === 'convert') return '🔄';
    if (challengeType === 'estimate') return '📐';
    return '📏';
  };

  const getHeading = (): string => {
    if (challengeType === 'compare') return 'Comparison Complete!';
    if (challengeType === 'convert') return 'Conversion Complete!';
    if (challengeType === 'estimate') return 'Estimation Complete!';
    return 'Measurement Complete!';
  };

  const getCelebration = (): string => {
    if (challengeType === 'compare') return 'Great job measuring and comparing the shapes!';
    if (challengeType === 'convert') return 'Great job measuring and converting!';
    if (challengeType === 'estimate') return 'Great job reading between the marks!';
    return 'Great job measuring all the shapes!';
  };

  const measureStep = precision === 'half' ? 0.5 : 1;
  const convertStepSize = 0.5;

  // -- Render ---------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getModeIcon()}</span>
            <div>
              <CardTitle className="text-slate-100 text-xl">
                {title || 'Measurement Tools'}
              </CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">{getSubtitle()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300">
              {unit}
            </Badge>
            {challengeType === 'convert' && (
              <Badge className="bg-amber-900/30 border-amber-700/50 text-amber-300">
                → {effectiveConvertToUnit}
              </Badge>
            )}
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              Grades {gradeBand}
            </Badge>
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
                  : i === currentIndex && !measureComplete
                    ? 'bg-blue-500'
                    : 'bg-slate-700'
              }`}
            />
          ))}
          {challengeType === 'compare' && (
            <div
              className={`h-2 flex-1 rounded-full transition-all ${
                comparisonDone
                  ? 'bg-purple-500'
                  : measureComplete
                    ? 'bg-purple-400 animate-pulse'
                    : 'bg-slate-700'
              }`}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Results panel */}
        {isFullyComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading={getHeading()}
            celebrationMessage={getCelebration()}
            className="mb-4"
          />
        )}

        {/* COMPARE — Comparison phase (after all shapes measured) */}
        {challengeType === 'compare' && measureComplete && !comparisonDone && !isFullyComplete && (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p className="text-purple-200 font-medium mb-1">Order the shapes from shortest to longest</p>
              <p className="text-slate-400 text-sm">
                Each shape is shown at the size you measured. Click the shortest first, then the next shortest, and so on.
              </p>
            </div>

            {selectedOrder.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-slate-500 text-xs">Your order (shortest → longest):</span>
                <div className="space-y-1.5">
                  {selectedOrder.map((id, i) => {
                    const c = challenges.find((c) => c.id === id);
                    if (!c) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-3 bg-purple-500/10 border border-purple-400/30 rounded-lg pl-3 pr-4 py-1.5"
                      >
                        <span className="text-purple-300 text-sm font-bold w-5 flex-shrink-0">{i + 1}.</span>
                        <ShapePreview challenge={c} />
                        <span className="text-slate-200 text-sm">{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {challenges.some((c) => !selectedOrder.includes(c.id)) && (
              <div className="space-y-1.5">
                <span className="text-slate-500 text-xs">
                  {selectedOrder.length === 0
                    ? 'Click the shortest shape first:'
                    : 'Click the next shortest:'}
                </span>
                <div className="space-y-1.5">
                  {challenges
                    .filter((c) => !selectedOrder.includes(c.id))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedOrder((prev) => [...prev, c.id])}
                        className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-purple-400/40 rounded-lg pl-3 pr-4 py-1.5 text-left transition-colors"
                      >
                        <ShapePreview challenge={c} interactive />
                        <span className="text-slate-200 text-sm">{c.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {selectedOrder.length > 0 && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                  onClick={() => { setSelectedOrder([]); setCompareFeedback(null); }}
                >
                  Reset Order
                </Button>
              )}
              {selectedOrder.length === challenges.length && (
                <Button
                  variant="ghost"
                  className="bg-purple-500/10 border border-purple-400/30 hover:bg-purple-500/20 text-purple-300"
                  onClick={handleComparisonCheck}
                >
                  Check Order
                </Button>
              )}
            </div>

            {compareFeedback && (
              <div
                className={`rounded-lg p-3 border ${
                  compareFeedback.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <p className={`text-sm font-medium ${compareFeedback.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                  {compareFeedback.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE WORKSPACE — Measure phase (all modes) */}
        {currentChallenge && !measureComplete && (
          <>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm font-medium">
                Shape {currentIndex + 1} of {challenges.length}
              </p>
              <p className="text-slate-200 mt-1">{getInstructionText()}</p>
            </div>

            {!convertStep && (
              <div className="flex justify-center">
                <svg
                  ref={svgRef}
                  width={CANVAS_WIDTH}
                  height={canvasHeight}
                  viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
                  className="max-w-full h-auto rounded-xl touch-none"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerLeave={handleDragEnd}
                >
                  <rect
                    x={1}
                    y={1}
                    width={CANVAS_WIDTH - 2}
                    height={canvasHeight - 2}
                    rx={12}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1.5}
                  />

                  <SnapZone
                    leftPad={RULER_LEFT_PAD}
                    totalWidth={rulerTotalWidth}
                    active={isDragging}
                    rulerY={rulerY}
                  />

                  <Ruler
                    lengthInches={rulerLengthInches}
                    unit={unit}
                    precision={precision}
                    pixelsPerUnit={pixelsPerUnit}
                    leftPad={RULER_LEFT_PAD}
                    rulerY={rulerY}
                  />

                  {shapePositions[currentChallenge.id] && (
                    <DraggableShape
                      challenge={currentChallenge}
                      pixelsPerUnit={pixelsPerUnit}
                      isOnRuler={!!onRuler[currentChallenge.id]}
                      position={shapePositions[currentChallenge.id]}
                      onDragStart={handleDragStart}
                      isDragging={isDragging}
                      isActive={true}
                      isCompleted={false}
                    />
                  )}
                </svg>
              </div>
            )}

            {/* Measure stepper (shape on ruler, not in convert step) */}
            {onRuler[currentChallenge.id] && !convertStep && (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-slate-300 text-sm">How many {unit} long?</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-11 w-11 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-lg font-bold p-0"
                      onClick={() => {
                        const cur = parseFloat(answerInput) || 0;
                        setAnswerInput(String(Math.max(0, +(cur - measureStep).toFixed(1))));
                      }}
                      disabled={hasSubmitted || (parseFloat(answerInput) || 0) <= 0}
                    >
                      &minus;
                    </Button>
                    <span className="w-16 text-center text-3xl font-bold text-blue-300 tabular-nums select-none">
                      {parseFloat(answerInput) || 0}
                    </span>
                    <Button
                      variant="ghost"
                      className="h-11 w-11 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-lg font-bold p-0"
                      onClick={() => {
                        const cur = parseFloat(answerInput) || 0;
                        setAnswerInput(String(Math.min(rulerLengthInches, +(cur + measureStep).toFixed(1))));
                      }}
                      disabled={hasSubmitted}
                    >
                      +
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300 mt-1"
                    onClick={checkAnswer}
                    disabled={hasSubmitted || (parseFloat(answerInput) || 0) <= 0}
                  >
                    Check Answer
                  </Button>
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

                {showHint && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-200 text-sm">{currentChallenge.hint}</p>
                  </div>
                )}

                {!feedback?.correct && measureAttempts >= 2 && !showHint && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={showHintHandler}
                    >
                      Need a Hint?
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* CONVERT step (after correct measurement in convert mode) */}
            {convertStep && currentChallenge && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-amber-200 font-medium mb-1">Convert your measurement!</p>
                  <p className="text-slate-200 mt-1">
                    The <span className="text-amber-300 font-medium">{currentChallenge.label}</span> is{' '}
                    <span className="text-blue-300 font-bold">{measuredValue} {unit}</span>.{' '}
                    How many <span className="text-amber-300 font-medium">{effectiveConvertToUnit}</span> is that?
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    {unit === 'inches'
                      ? `Hint: 1 inch = ${INCH_TO_CM} centimeters`
                      : `Hint: 1 inch = ${INCH_TO_CM} centimeters (divide to get inches)`}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-slate-300 text-sm">How many {effectiveConvertToUnit}?</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-11 w-11 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-lg font-bold p-0"
                      onClick={() => {
                        const cur = parseFloat(convertInput) || 0;
                        setConvertInput(String(Math.max(0, +(cur - convertStepSize).toFixed(1))));
                      }}
                      disabled={(parseFloat(convertInput) || 0) <= 0}
                    >
                      &minus;
                    </Button>
                    <span className="w-16 text-center text-3xl font-bold text-amber-300 tabular-nums select-none">
                      {parseFloat(convertInput) || 0}
                    </span>
                    <Button
                      variant="ghost"
                      className="h-11 w-11 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-lg font-bold p-0"
                      onClick={() => {
                        const cur = parseFloat(convertInput) || 0;
                        setConvertInput(String(+(cur + convertStepSize).toFixed(1)));
                      }}
                    >
                      +
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/20 text-amber-300 mt-1"
                    onClick={checkConversion}
                    disabled={(parseFloat(convertInput) || 0) <= 0}
                  >
                    Check Conversion
                  </Button>
                </div>

                {convertFeedback && (
                  <div
                    className={`rounded-lg p-3 border ${
                      convertFeedback.correct
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <p className={`text-sm font-medium ${convertFeedback.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                      {convertFeedback.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isFullyComplete && (
          <div className="flex justify-center">
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MeasurementTools;
