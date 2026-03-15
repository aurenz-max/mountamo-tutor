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
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export interface MeasurementShape {
  id: string;
  type: 'rectangle' | 'square';
  widthInches: number;
  heightInches: number;
  color: string;
  label: string;
  hint: string;
}

export interface MeasurementToolsData {
  primitiveType?: string;
  challengeType?: 'measure' | 'compare' | 'convert';
  title?: string;
  rulerLengthInches: number;
  unit: 'inches' | 'centimeters';
  precision: 'whole' | 'half';
  gradeBand: 'K-2' | '3-5';
  shapes: MeasurementShape[];

  /** Target unit for convert mode (defaults to opposite of unit) */
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
  measure: { label: 'Measure', icon: '\uD83D\uDCCF', accentColor: 'blue' },
  convert: { label: 'Convert', icon: '\uD83D\uDD04', accentColor: 'amber' },
};

// =============================================================================
// Helpers
// =============================================================================

function convertValue(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'inches' && toUnit === 'centimeters') return value * INCH_TO_CM;
  if (fromUnit === 'centimeters' && toUnit === 'inches') return value / INCH_TO_CM;
  return value;
}

function getCorrectOrder(shapes: MeasurementShape[]): string[] {
  return [...shapes].sort((a, b) => a.widthInches - b.widthInches).map((s) => s.id);
}

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
      {/* Ruler body */}
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

      {/* Tick marks and labels */}
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

      {/* Unit label */}
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
// Draggable Shape Component (SVG)
// =============================================================================

interface DraggableShapeProps {
  shape: MeasurementShape;
  pixelsPerUnit: number;
  isOnRuler: boolean;
  position: { x: number; y: number };
  onDragStart: (e: React.PointerEvent) => void;
  isDragging: boolean;
  isActive: boolean;
  isCompleted: boolean;
}

const DraggableShape: React.FC<DraggableShapeProps> = ({
  shape,
  pixelsPerUnit,
  isOnRuler,
  position,
  onDragStart,
  isDragging,
  isActive,
  isCompleted,
}) => {
  const w = shape.widthInches * pixelsPerUnit;
  const h = Math.max(shape.heightInches * pixelsPerUnit, 36);

  const fillColor = isCompleted
    ? 'rgba(52,211,153,0.25)'
    : shape.color || 'rgba(99,102,241,0.35)';
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
      {/* Drop shadow when dragging */}
      {isDragging && (
        <rect
          x={position.x + 3}
          y={position.y + 3}
          width={w}
          height={h}
          rx={shape.type === 'square' ? 4 : 6}
          fill="rgba(0,0,0,0.3)"
        />
      )}

      <rect
        x={position.x}
        y={position.y}
        width={w}
        height={h}
        rx={shape.type === 'square' ? 4 : 6}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isDragging ? 2.5 : 2}
        className="transition-colors duration-150"
      />

      {/* Label */}
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
        {shape.label}
      </text>

      {/* Completed checkmark */}
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

      {/* "Drag me" hint for active shape not yet on ruler */}
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
// Main Component
// =============================================================================

const MeasurementTools: React.FC<MeasurementToolsProps> = ({ data, className }) => {
  const {
    title,
    challengeType = 'measure',
    rulerLengthInches,
    unit,
    precision,
    gradeBand,
    shapes,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const effectiveConvertToUnit = data.convertToUnit || (unit === 'inches' ? 'centimeters' : 'inches');
  const resolvedInstanceId = instanceId || `measurement-tools-${Date.now()}`;
  const pixelsPerUnit = Math.min(
    (CANVAS_WIDTH - RULER_LEFT_PAD - 40) / rulerLengthInches,
    60,
  );
  const rulerTotalWidth = rulerLengthInches * pixelsPerUnit;

  // Compute tallest shape height to size the canvas dynamically
  const maxShapeH = useMemo(() => {
    return Math.max(...shapes.map((s) => Math.max(s.heightInches * pixelsPerUnit, 36)), 60);
  }, [shapes, pixelsPerUnit]);

  // Dynamic layout: shape area → gap → ruler → bottom padding
  const rulerY = SHAPE_AREA_Y + maxShapeH + SHAPE_RULER_GAP + 50;
  const canvasHeight = rulerY + RULER_HEIGHT + BOTTOM_PAD;

  // -- Shared hooks ---------------------------------------------------------
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: measureComplete,
    recordResult,
    incrementAttempts,
    advance,
    reset,
  } = useChallengeProgress({
    challenges: shapes,
    getChallengeId: (s) => s.id,
  });

  const phaseResults = usePhaseResults({
    challenges: shapes,
    results: challengeResults,
    isComplete: measureComplete,
    getChallengeType: () => (challengeType === 'convert' ? 'convert' : 'measure'),
    phaseConfig: PHASE_CONFIG,
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

  // -- Measure state --------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hasIntroducedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [shapePositions, setShapePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [onRuler, setOnRuler] = useState<Record<string, boolean>>({});

  // -- Convert mode state ---------------------------------------------------
  const [convertStep, setConvertStep] = useState(false);
  const [convertInput, setConvertInput] = useState('');
  const [convertFeedback, setConvertFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [measuredValue, setMeasuredValue] = useState(0);
  const convertCorrectCountRef = useRef(0);

  // -- Compare mode state ---------------------------------------------------
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [compareFeedback, setCompareFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [comparisonDone, setComparisonDone] = useState(false);
  const [compareAttempts, setCompareAttempts] = useState(0);

  // -- Derived state --------------------------------------------------------
  const currentShape = shapes[currentIndex] ?? null;

  const isFullyComplete = useMemo(() => {
    if (!measureComplete) return false;
    if (challengeType === 'compare' && !comparisonDone) return false;
    return true;
  }, [measureComplete, challengeType, comparisonDone]);

  // Initialize shape positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    shapes.forEach((shape) => {
      const w = shape.widthInches * pixelsPerUnit;
      positions[shape.id] = {
        x: CANVAS_WIDTH / 2 - w / 2,
        y: SHAPE_AREA_Y,
      };
    });
    setShapePositions(positions);
    setOnRuler({});
  }, [shapes, pixelsPerUnit]);

  // -- AI Tutoring ----------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    unit,
    precision,
    gradeBand,
    currentShapeIndex: currentIndex,
    totalShapes: shapes.length,
    currentShape: currentShape?.label,
    shapeWidth: currentShape?.widthInches,
    isOnRuler: currentShape ? !!onRuler[currentShape.id] : false,
    currentAttempts,
    convertStep,
    convertToUnit: effectiveConvertToUnit,
    comparePhase: measureComplete && challengeType === 'compare' && !comparisonDone,
  }), [challengeType, unit, precision, gradeBand, currentIndex, shapes.length, currentShape, onRuler, currentAttempts, convertStep, effectiveConvertToUnit, measureComplete, comparisonDone]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? '1st Grade' : '3rd Grade',
  });

  // Introduction
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentShape) return;
    hasIntroducedRef.current = true;

    const modeDesc =
      challengeType === 'compare'
        ? `Measure all ${shapes.length} shapes, then compare them by ordering shortest to longest.`
        : challengeType === 'convert'
          ? `Measure each shape in ${unit}, then convert the measurement to ${effectiveConvertToUnit}.`
          : `Drag shapes onto a ruler to measure them. ${shapes.length} shapes to measure in ${unit}.`;

    sendText(
      `[ACTIVITY_START] Measurement activity! ${modeDesc} ` +
      `First shape: "${currentShape.label}" (${currentShape.type}). ` +
      `Introduce warmly.`,
      { silent: true },
    );
  }, [isConnected, currentShape, shapes.length, unit, effectiveConvertToUnit, challengeType, sendText]);

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
    if (!currentShape || hasSubmitted || convertStep) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const pos = shapePositions[currentShape.id];
    if (!pos) return;

    setDragOffset({ x: svgPt.x - pos.x, y: svgPt.y - pos.y });
    setIsDragging(true);
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
  }, [currentShape, hasSubmitted, convertStep, getSVGPoint, shapePositions]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !currentShape) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    setShapePositions((prev) => ({
      ...prev,
      [currentShape.id]: {
        x: svgPt.x - dragOffset.x,
        y: svgPt.y - dragOffset.y,
      },
    }));
  }, [isDragging, currentShape, getSVGPoint, dragOffset]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !currentShape) return;
    e.preventDefault();
    setIsDragging(false);

    const pos = shapePositions[currentShape.id];
    if (!pos) return;

    const shapeH = Math.max(currentShape.heightInches * pixelsPerUnit, 36);
    const shapeBottom = pos.y + shapeH;
    const snapZoneTop = rulerY - 50;

    // Check if shape is in the snap zone (above the ruler)
    if (shapeBottom >= snapZoneTop && pos.y < rulerY) {
      const snappedY = rulerY - shapeH - 2;
      setShapePositions((prev) => ({
        ...prev,
        [currentShape.id]: { x: RULER_LEFT_PAD, y: snappedY },
      }));
      setOnRuler((prev) => ({ ...prev, [currentShape.id]: true }));

      if (!onRuler[currentShape.id]) {
        sendText(
          `[SHAPE_PLACED] Student placed "${currentShape.label}" on the ruler. ` +
          `Ask: "Now look at the ruler — how many ${unit} long is this shape?"`,
          { silent: true },
        );
      }
    } else if (pos.y >= rulerY + RULER_HEIGHT) {
      const w = currentShape.widthInches * pixelsPerUnit;
      setShapePositions((prev) => ({
        ...prev,
        [currentShape.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
      }));
      setOnRuler((prev) => ({ ...prev, [currentShape.id]: false }));
    }
  }, [isDragging, currentShape, shapePositions, pixelsPerUnit, rulerY, onRuler, sendText, unit]);

  // -- Answer checking (measure step) --------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentShape) return;

    const studentNum = parseFloat(answerInput);
    if (isNaN(studentNum)) {
      setFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    incrementAttempts();
    const tolerance = precision === 'half' ? 0.25 : 0.5;
    const isCorrect = Math.abs(studentNum - currentShape.widthInches) <= tolerance;

    if (challengeType === 'convert' && isCorrect) {
      // Correct measurement in convert mode → switch to convert step
      setMeasuredValue(currentShape.widthInches);
      setFeedback({
        message: `Yes! The ${currentShape.label} is ${currentShape.widthInches} ${unit} long. Now convert it!`,
        correct: true,
      });
      sendText(
        `[MEASURE_CORRECT] Student measured "${currentShape.label}" as ${studentNum} ${unit}. ` +
        `Correct: ${currentShape.widthInches} ${unit}. ` +
        `Now they need to convert to ${effectiveConvertToUnit}. Encourage them.`,
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

    // Standard measure/compare mode, or incorrect answer
    if (isCorrect) {
      recordResult({
        challengeId: currentShape.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: 100,
        studentAnswer: studentNum,
        targetAnswer: currentShape.widthInches,
      });

      setFeedback({
        message: `Yes! The ${currentShape.label} is ${currentShape.widthInches} ${unit} long!`,
        correct: true,
      });

      sendText(
        `[ANSWER_CORRECT] Student measured "${currentShape.label}" as ${studentNum} ${unit}. ` +
        `Correct: ${currentShape.widthInches} ${unit}. Attempts: ${currentAttempts + 1}. ` +
        `Congratulate briefly.`,
        { silent: true },
      );

      setTimeout(() => {
        setFeedback(null);
        setAnswerInput('');
        setShowHint(false);
        const advanced = advance();
        if (advanced) {
          const nextShape = shapes[currentIndex + 1];
          if (nextShape) {
            const w = nextShape.widthInches * pixelsPerUnit;
            setShapePositions((prev) => ({
              ...prev,
              [nextShape.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
            }));
            setOnRuler((prev) => ({ ...prev, [nextShape.id]: false }));

            sendText(
              `[NEXT_ITEM] Shape ${currentIndex + 2} of ${shapes.length}: ` +
              `"${nextShape.label}" (${nextShape.type}). ` +
              `Say: "Next shape! Drag it onto the ruler to measure."`,
              { silent: true },
            );
          }
        } else if (challengeType === 'compare') {
          sendText(
            `[MEASURE_PHASE_DONE] All shapes measured! Now the student must order them from shortest to longest. ` +
            `Explain: "Great measuring! Now let's compare — click the shapes in order from shortest to longest."`,
            { silent: true },
          );
        }
      }, 1400);
    } else {
      recordResult({
        challengeId: currentShape.id,
        correct: false,
        attempts: currentAttempts + 1,
        score: 0,
        studentAnswer: studentNum,
        targetAnswer: currentShape.widthInches,
      });

      setFeedback({
        message: 'Not quite — look at the ruler more carefully!',
        correct: false,
      });

      sendText(
        `[ANSWER_INCORRECT] Student guessed ${studentNum} ${unit} for "${currentShape.label}" ` +
        `(actual: ${currentShape.widthInches} ${unit}). Attempt: ${currentAttempts + 1}. ` +
        `Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentShape, answerInput, currentAttempts, precision, unit, challengeType, effectiveConvertToUnit, incrementAttempts, recordResult, advance, currentIndex, shapes, pixelsPerUnit, sendText]);

  // -- Conversion checking (convert mode) -----------------------------------
  const checkConversion = useCallback(() => {
    if (!currentShape) return;

    const studentNum = parseFloat(convertInput);
    if (isNaN(studentNum)) {
      setConvertFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    incrementAttempts();
    const correctConverted = convertValue(measuredValue, unit, effectiveConvertToUnit);
    const tolerance = Math.max(0.5, correctConverted * 0.1);
    const isCorrect = Math.abs(studentNum - correctConverted) <= tolerance;

    if (isCorrect) {
      convertCorrectCountRef.current += 1;
      const measureScore = 50;
      const convertScore = 50;

      recordResult({
        challengeId: currentShape.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: measureScore + convertScore,
        studentAnswer: studentNum,
        targetAnswer: correctConverted,
        measuredValue,
        convertedValue: studentNum,
      });

      setConvertFeedback({
        message: `Correct! ${measuredValue} ${unit} = ${Math.round(correctConverted * 10) / 10} ${effectiveConvertToUnit}!`,
        correct: true,
      });

      sendText(
        `[CONVERT_CORRECT] Student converted ${measuredValue} ${unit} to ${studentNum} ${effectiveConvertToUnit}. ` +
        `Correct: ~${Math.round(correctConverted * 10) / 10}. Congratulate briefly.`,
        { silent: true },
      );

      setTimeout(() => {
        setConvertStep(false);
        setConvertInput('');
        setConvertFeedback(null);
        setFeedback(null);
        setAnswerInput('');
        setShowHint(false);

        const advanced = advance();
        if (advanced) {
          const nextShape = shapes[currentIndex + 1];
          if (nextShape) {
            const w = nextShape.widthInches * pixelsPerUnit;
            setShapePositions((prev) => ({
              ...prev,
              [nextShape.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
            }));
            setOnRuler((prev) => ({ ...prev, [nextShape.id]: false }));

            sendText(
              `[NEXT_ITEM] Shape ${currentIndex + 2} of ${shapes.length}: ` +
              `"${nextShape.label}". Measure it and convert!`,
              { silent: true },
            );
          }
        }
      }, 1400);
    } else {
      setConvertFeedback({
        message: effectiveConvertToUnit === 'centimeters'
          ? `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try multiplying!`
          : `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try dividing!`,
        correct: false,
      });

      sendText(
        `[CONVERT_INCORRECT] Student tried ${studentNum} ${effectiveConvertToUnit} ` +
        `(correct: ~${Math.round(correctConverted * 10) / 10}). ` +
        `Help them with the conversion without giving the answer.`,
        { silent: true },
      );
    }
  }, [currentShape, convertInput, measuredValue, unit, effectiveConvertToUnit, currentAttempts, incrementAttempts, recordResult, advance, currentIndex, shapes, pixelsPerUnit, sendText]);

  // -- Comparison checking (compare mode) -----------------------------------
  const handleComparisonCheck = useCallback(() => {
    const correctOrder = getCorrectOrder(shapes);
    const isCorrect = selectedOrder.every((id, i) => id === correctOrder[i]);
    setCompareAttempts((a) => a + 1);

    if (isCorrect) {
      setCompareFeedback({ message: 'Perfect! You ordered them correctly from shortest to longest!', correct: true });
      setComparisonDone(true);

      const orderLabels = selectedOrder.map((id) => shapes.find((s) => s.id === id)?.label).join(' → ');
      sendText(
        `[COMPARE_CORRECT] Student correctly ordered shapes from shortest to longest: ${orderLabels}. ` +
        `Celebrate their comparison skills!`,
        { silent: true },
      );
    } else {
      setCompareFeedback({ message: 'Not quite! Think about which shapes were shorter when you measured them.', correct: false });
      setSelectedOrder([]);

      sendText(
        `[COMPARE_INCORRECT] Student ordered shapes incorrectly. Attempt: ${compareAttempts + 1}. ` +
        `Hint: remind them of their measurements without giving the order.`,
        { silent: true },
      );
    }
  }, [shapes, selectedOrder, compareAttempts, sendText]);

  // -- Evaluation on completion ---------------------------------------------
  useEffect(() => {
    if (!isFullyComplete || hasSubmitted) return;

    const totalMeasureCorrect = challengeResults.filter((r) => r.correct).length;
    let overallScore: number;

    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      measureCorrect: totalMeasureCorrect,
      measureTotal: shapes.length,
      compareCorrect: 0,
      compareTotal: 0,
      convertCorrect: 0,
      convertTotal: 0,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    if (challengeType === 'compare') {
      const compareScore = comparisonDone ? 100 : 0;
      const measureScore = Math.round((totalMeasureCorrect / shapes.length) * 100);
      overallScore = Math.round(measureScore * 0.6 + compareScore * 0.4);
      metrics.compareCorrect = comparisonDone ? 1 : 0;
      metrics.compareTotal = 1;
      metrics.attemptsCount += compareAttempts;
    } else if (challengeType === 'convert') {
      metrics.convertCorrect = convertCorrectCountRef.current;
      metrics.convertTotal = shapes.length;
      overallScore = Math.round((challengeResults.reduce((s, r) => s + (r.score ?? 0), 0)) / shapes.length);
    } else {
      overallScore = Math.round((totalMeasureCorrect / shapes.length) * 100);
    }

    submitResult(
      overallScore >= 70,
      overallScore,
      metrics,
      { challengeResults, compareAttempts: challengeType === 'compare' ? compareAttempts : undefined },
    );

    const phaseScoreStr = phaseResults.map((p) => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[ALL_COMPLETE] Student finished all shapes! Mode: ${challengeType}. ` +
      `Score: ${overallScore}%. ${phaseScoreStr}. Celebrate!`,
      { silent: true },
    );
  }, [isFullyComplete, hasSubmitted, challengeResults, shapes, challengeType, comparisonDone, compareAttempts, submitResult, phaseResults, sendText]);

  // -- Reset ----------------------------------------------------------------
  const handleReset = () => {
    reset();
    resetAttempt();
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    setConvertStep(false);
    setConvertInput('');
    setConvertFeedback(null);
    setMeasuredValue(0);
    convertCorrectCountRef.current = 0;
    setSelectedOrder([]);
    setCompareFeedback(null);
    setComparisonDone(false);
    setCompareAttempts(0);
    hasIntroducedRef.current = false;
    const positions: Record<string, { x: number; y: number }> = {};
    shapes.forEach((shape) => {
      const w = shape.widthInches * pixelsPerUnit;
      positions[shape.id] = {
        x: CANVAS_WIDTH / 2 - w / 2,
        y: SHAPE_AREA_Y,
      };
    });
    setShapePositions(positions);
    setOnRuler({});
  };

  // -- Completed shape IDs --------------------------------------------------
  const completedIds = useMemo(
    () => new Set(challengeResults.filter((r) => r.correct).map((r) => r.challengeId)),
    [challengeResults],
  );

  const localOverallScore = useMemo(() => {
    if (!isFullyComplete || shapes.length === 0) return 0;
    const totalCorrect = challengeResults.filter((r) => r.correct).length;
    if (challengeType === 'compare') {
      const measureScore = Math.round((totalCorrect / shapes.length) * 100);
      return Math.round(measureScore * 0.6 + (comparisonDone ? 40 : 0));
    }
    if (challengeType === 'convert') {
      return Math.round(challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / shapes.length);
    }
    return Math.round((totalCorrect / shapes.length) * 100);
  }, [isFullyComplete, shapes, challengeResults, challengeType, comparisonDone]);

  // -- Instruction text per mode --------------------------------------------
  const getInstructionText = () => {
    if (!currentShape) return '';
    if (challengeType === 'compare') {
      return `Measure each shape by dragging it onto the ruler. After measuring all shapes, you'll compare them!`;
    }
    if (challengeType === 'convert') {
      if (convertStep) return `Convert your measurement of the ${currentShape.label} from ${unit} to ${effectiveConvertToUnit}.`;
      return `Drag the ${currentShape.label} onto the ruler and measure it in ${unit}.`;
    }
    return `Drag the ${currentShape.label} onto the ruler, then tell me how many ${unit} long it is.`;
  };

  const getSubtitle = () => {
    if (isFullyComplete) return 'Complete!';
    if (challengeType === 'compare' && measureComplete && !comparisonDone) return 'Order the shapes from shortest to longest';
    if (challengeType === 'convert' && convertStep) return 'Convert your measurement';
    return 'Drag the shape onto the ruler to measure it';
  };

  const getModeIcon = () => {
    if (challengeType === 'compare') return '\u2696\uFE0F';
    if (challengeType === 'convert') return '\uD83D\uDD04';
    return '\uD83D\uDCCF';
  };

  const getHeading = () => {
    if (challengeType === 'compare') return 'Comparison Complete!';
    if (challengeType === 'convert') return 'Conversion Complete!';
    return 'Measurement Complete!';
  };

  const getCelebration = () => {
    if (challengeType === 'compare') return 'Great job measuring and comparing the shapes!';
    if (challengeType === 'convert') return 'Great job measuring and converting!';
    return 'Great job measuring all the shapes!';
  };

  // Stepper helpers
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
          {shapes.map((shape, i) => (
            <div
              key={shape.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                completedIds.has(shape.id)
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

        {/* ================================================================
            COMPARE MODE — Comparison Phase (after all shapes measured)
            ================================================================ */}
        {challengeType === 'compare' && measureComplete && !comparisonDone && !isFullyComplete && (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p className="text-purple-200 font-medium mb-1">Order the shapes from shortest to longest</p>
              <p className="text-slate-400 text-sm">Click each shape in order, starting with the shortest one.</p>
            </div>

            {/* Selected order display */}
            {selectedOrder.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-500 text-xs mr-1">Your order:</span>
                {selectedOrder.map((id, i) => {
                  const shape = shapes.find((s) => s.id === id);
                  return shape ? (
                    <Badge key={id} className="bg-purple-500/15 border-purple-400/30 text-purple-200">
                      {i + 1}. {shape.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {/* Available shapes to pick */}
            <div className="flex flex-wrap gap-2">
              {shapes
                .filter((s) => !selectedOrder.includes(s.id))
                .map((shape) => (
                  <Button
                    key={shape.id}
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                    onClick={() => setSelectedOrder((prev) => [...prev, shape.id])}
                  >
                    {shape.label}
                  </Button>
                ))}
            </div>

            {/* Actions */}
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
              {selectedOrder.length === shapes.length && (
                <Button
                  variant="ghost"
                  className="bg-purple-500/10 border border-purple-400/30 hover:bg-purple-500/20 text-purple-300"
                  onClick={handleComparisonCheck}
                >
                  Check Order
                </Button>
              )}
            </div>

            {/* Comparison feedback */}
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

        {/* ================================================================
            ACTIVE WORKSPACE — Measure phase (all modes)
            ================================================================ */}
        {currentShape && !measureComplete && (
          <>
            {/* Instruction */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm font-medium">
                Shape {currentIndex + 1} of {shapes.length}
              </p>
              <p className="text-slate-200 mt-1">{getInstructionText()}</p>
            </div>

            {/* SVG Workspace (hidden during convert step) */}
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

                  {shapePositions[currentShape.id] && (
                    <DraggableShape
                      shape={currentShape}
                      pixelsPerUnit={pixelsPerUnit}
                      isOnRuler={!!onRuler[currentShape.id]}
                      position={shapePositions[currentShape.id]}
                      onDragStart={handleDragStart}
                      isDragging={isDragging}
                      isActive={true}
                      isCompleted={false}
                    />
                  )}
                </svg>
              </div>
            )}

            {/* Measure answer input (when shape is on ruler and NOT in convert step) */}
            {onRuler[currentShape.id] && !convertStep && (
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

                {/* Feedback */}
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

                {/* Hint */}
                {showHint && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-200 text-sm">{currentShape.hint}</p>
                  </div>
                )}

                {!feedback?.correct && currentAttempts >= 2 && !showHint && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={() => setShowHint(true)}
                    >
                      Need a Hint?
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================
                CONVERT STEP — shown after correct measurement in convert mode
                ============================================================ */}
            {convertStep && currentShape && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-amber-200 font-medium mb-1">Convert your measurement!</p>
                  <p className="text-slate-200 mt-1">
                    The <span className="text-amber-300 font-medium">{currentShape.label}</span> is{' '}
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

                {/* Conversion feedback */}
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

        {/* Reset after full completion */}
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
