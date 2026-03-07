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
  title?: string;
  rulerLengthInches: number;
  unit: 'inches' | 'centimeters';
  precision: 'whole' | 'half';
  gradeBand: 'K-2' | '3-5';
  shapes: MeasurementShape[];

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
const RULER_Y = 260;
const SHAPE_AREA_Y = 40;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 380;
const RULER_LEFT_PAD = 40;

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  measure: { label: 'Measure', icon: '\uD83D\uDCCF', accentColor: 'blue' },
};

// =============================================================================
// Ruler Component (SVG)
// =============================================================================

interface RulerProps {
  lengthInches: number;
  unit: 'inches' | 'centimeters';
  precision: 'whole' | 'half';
  pixelsPerUnit: number;
  leftPad: number;
}

const Ruler: React.FC<RulerProps> = ({ lengthInches, unit, precision, pixelsPerUnit, leftPad }) => {
  const totalWidth = lengthInches * pixelsPerUnit;
  const step = precision === 'half' ? 0.5 : 1;
  const tickCount = Math.round(lengthInches / step);

  return (
    <g>
      {/* Ruler body */}
      <rect
        x={leftPad}
        y={RULER_Y}
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
              y1={RULER_Y}
              x2={x}
              y2={RULER_Y + (isWhole ? 28 : 16)}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={isWhole ? 1.5 : 0.8}
            />
            {isWhole && (
              <text
                x={x}
                y={RULER_Y + 44}
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
        y={RULER_Y + 38}
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

const SnapZone: React.FC<{ leftPad: number; totalWidth: number; active: boolean }> = ({
  leftPad,
  totalWidth,
  active,
}) => (
  <rect
    x={leftPad}
    y={RULER_Y - 50}
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

  const resolvedInstanceId = instanceId || `measurement-tools-${Date.now()}`;
  const pixelsPerUnit = Math.min(
    (CANVAS_WIDTH - RULER_LEFT_PAD - 40) / rulerLengthInches,
    60,
  );
  const rulerTotalWidth = rulerLengthInches * pixelsPerUnit;

  // -- Shared hooks ---------------------------------------------------------
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
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
    isComplete,
    getChallengeType: () => 'measure',
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

  // -- Local state ----------------------------------------------------------
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

  const currentShape = shapes[currentIndex] ?? null;

  // Initialize shape positions (stacked in holding area)
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    shapes.forEach((shape, i) => {
      const w = shape.widthInches * pixelsPerUnit;
      positions[shape.id] = {
        x: CANVAS_WIDTH / 2 - w / 2,
        y: SHAPE_AREA_Y + i * 8,
      };
    });
    setShapePositions(positions);
    setOnRuler({});
  }, [shapes, pixelsPerUnit]);

  // -- AI Tutoring ----------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    unit,
    precision,
    gradeBand,
    currentShapeIndex: currentIndex,
    totalShapes: shapes.length,
    currentShape: currentShape?.label,
    shapeWidth: currentShape?.widthInches,
    isOnRuler: currentShape ? !!onRuler[currentShape.id] : false,
    currentAttempts,
  }), [unit, precision, gradeBand, currentIndex, shapes.length, currentShape, onRuler, currentAttempts]);

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
    sendText(
      `[ACTIVITY_START] Measurement activity! Student will drag shapes onto a ruler to measure them. ` +
      `${shapes.length} shapes to measure in ${unit}. ` +
      `First shape: "${currentShape.label}" (${currentShape.type}). ` +
      `Introduce warmly: "Let's measure some shapes! Drag the shape onto the ruler to see how long it is."`,
      { silent: true },
    );
  }, [isConnected, currentShape, shapes.length, unit, sendText]);

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
    if (!currentShape || hasSubmitted) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const pos = shapePositions[currentShape.id];
    if (!pos) return;

    setDragOffset({ x: svgPt.x - pos.x, y: svgPt.y - pos.y });
    setIsDragging(true);
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
  }, [currentShape, hasSubmitted, getSVGPoint, shapePositions]);

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
    const snapZoneTop = RULER_Y - 50;

    // Check if shape is in the snap zone (above the ruler)
    if (shapeBottom >= snapZoneTop && pos.y < RULER_Y) {
      // Snap: align left edge to ruler 0, bottom edge sits just above ruler
      const snappedY = RULER_Y - shapeH - 2;
      setShapePositions((prev) => ({
        ...prev,
        [currentShape.id]: { x: RULER_LEFT_PAD, y: snappedY },
      }));
      setOnRuler((prev) => ({ ...prev, [currentShape.id]: true }));

      if (!onRuler[currentShape.id]) {
        sendText(
          `[SHAPE_PLACED] Student placed "${currentShape.label}" on the ruler. ` +
          `It spans from 0 to its width. Ask: "Great! Now look at the ruler — how many ${unit} long is this shape?"`,
          { silent: true },
        );
      }
    } else if (pos.y >= RULER_Y + RULER_HEIGHT) {
      // Dragged below ruler — bounce back to holding area
      const w = currentShape.widthInches * pixelsPerUnit;
      setShapePositions((prev) => ({
        ...prev,
        [currentShape.id]: { x: CANVAS_WIDTH / 2 - w / 2, y: SHAPE_AREA_Y },
      }));
      setOnRuler((prev) => ({ ...prev, [currentShape.id]: false }));
    }
  }, [isDragging, currentShape, shapePositions, pixelsPerUnit, onRuler, sendText, unit]);

  // -- Answer checking ------------------------------------------------------
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

    recordResult({
      challengeId: currentShape.id,
      correct: isCorrect,
      attempts: currentAttempts + 1,
      score: isCorrect ? 100 : 0,
      studentAnswer: studentNum,
      targetAnswer: currentShape.widthInches,
    });

    setFeedback({
      message: isCorrect
        ? `Yes! The ${currentShape.label} is ${currentShape.widthInches} ${unit} long!`
        : 'Not quite — look at the ruler more carefully!',
      correct: isCorrect,
    });

    if (isCorrect) {
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
            // Reset next shape to holding area
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
        }
      }, 1400);
    } else {
      sendText(
        `[ANSWER_INCORRECT] Student guessed ${studentNum} ${unit} for "${currentShape.label}" ` +
        `(actual: ${currentShape.widthInches} ${unit}). Attempt: ${currentAttempts + 1}. ` +
        `Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentShape, answerInput, currentAttempts, precision, unit, incrementAttempts, recordResult, advance, currentIndex, shapes, pixelsPerUnit, sendText]);

  // -- Evaluation on completion ---------------------------------------------
  useEffect(() => {
    if (!isComplete || hasSubmitted) return;

    const totalCorrect = challengeResults.filter((r) => r.correct).length;
    const score = Math.round((totalCorrect / shapes.length) * 100);

    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      estimateCorrect: 0,
      estimateTotal: 0,
      readCorrect: totalCorrect,
      readTotal: shapes.length,
      convertCorrect: 0,
      convertTotal: 0,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    submitResult(totalCorrect === shapes.length, score, metrics, { challengeResults });

    const phaseScoreStr = phaseResults
      .map((p) => `${p.label} ${p.score}%`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Student measured all ${shapes.length} shapes! ` +
      `Score: ${score}%. ${phaseScoreStr}. Celebrate!`,
      { silent: true },
    );
  }, [isComplete, hasSubmitted, challengeResults, shapes, submitResult, phaseResults, sendText]);

  // -- Reset ----------------------------------------------------------------
  const handleReset = () => {
    reset();
    resetAttempt();
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    hasIntroducedRef.current = false;
    const positions: Record<string, { x: number; y: number }> = {};
    shapes.forEach((shape, i) => {
      const w = shape.widthInches * pixelsPerUnit;
      positions[shape.id] = {
        x: CANVAS_WIDTH / 2 - w / 2,
        y: SHAPE_AREA_Y + i * 8,
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
    if (!isComplete || shapes.length === 0) return 0;
    return Math.round((challengeResults.filter((r) => r.correct).length / shapes.length) * 100);
  }, [isComplete, shapes, challengeResults]);

  // -- Render ---------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{'\uD83D\uDCCF'}</span>
            <div>
              <CardTitle className="text-slate-100 text-xl">
                {title || 'Measurement Tools'}
              </CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                {currentShape && !isComplete
                  ? `Drag the shape onto the ruler to measure it`
                  : 'Complete!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300">
              {unit}
            </Badge>
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
                  : i === currentIndex && !isComplete
                    ? 'bg-blue-500'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Results panel */}
        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Measurement Complete!"
            celebrationMessage="Great job measuring all the shapes!"
            className="mb-4"
          />
        )}

        {/* Active workspace */}
        {currentShape && !isComplete && (
          <>
            {/* Instruction */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm font-medium">
                Shape {currentIndex + 1} of {shapes.length}
              </p>
              <p className="text-slate-200 mt-1">
                Drag the <span className="text-blue-300 font-medium">{currentShape.label}</span> onto the ruler, then tell me how many {unit} long it is.
              </p>
            </div>

            {/* SVG Workspace */}
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className="max-w-full h-auto rounded-xl touch-none"
                style={{ background: 'rgba(255,255,255,0.02)' }}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerLeave={handleDragEnd}
              >
                {/* Border */}
                <rect
                  x={1}
                  y={1}
                  width={CANVAS_WIDTH - 2}
                  height={CANVAS_HEIGHT - 2}
                  rx={12}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1.5}
                />

                {/* Holding area label */}
                <text
                  x={CANVAS_WIDTH / 2}
                  y={28}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.2)"
                  fontSize={12}
                  className="select-none"
                >
                  Shapes
                </text>

                {/* Snap zone above ruler */}
                <SnapZone
                  leftPad={RULER_LEFT_PAD}
                  totalWidth={rulerTotalWidth}
                  active={isDragging}
                />

                {/* Ruler */}
                <Ruler
                  lengthInches={rulerLengthInches}
                  unit={unit}
                  precision={precision}
                  pixelsPerUnit={pixelsPerUnit}
                  leftPad={RULER_LEFT_PAD}
                />

                {/* Render completed shapes (behind current) */}
                {shapes.map((shape, i) => {
                  if (i === currentIndex) return null;
                  const pos = shapePositions[shape.id];
                  if (!pos) return null;
                  return (
                    <DraggableShape
                      key={shape.id}
                      shape={shape}
                      pixelsPerUnit={pixelsPerUnit}
                      isOnRuler={!!onRuler[shape.id]}
                      position={pos}
                      onDragStart={() => {}}
                      isDragging={false}
                      isActive={false}
                      isCompleted={completedIds.has(shape.id)}
                    />
                  );
                })}

                {/* Current shape (on top) */}
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

            {/* Answer input (only visible when shape is on ruler) */}
            {onRuler[currentShape.id] && (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-slate-300 text-sm">How many {unit} long?</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-11 w-11 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-lg font-bold p-0"
                      onClick={() => {
                        const step = precision === 'half' ? 0.5 : 1;
                        const cur = parseFloat(answerInput) || 0;
                        setAnswerInput(String(Math.max(0, +(cur - step).toFixed(1))));
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
                        const step = precision === 'half' ? 0.5 : 1;
                        const cur = parseFloat(answerInput) || 0;
                        setAnswerInput(String(Math.min(rulerLengthInches, +(cur + step).toFixed(1))));
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
                    <p
                      className={`text-sm font-medium ${
                        feedback.correct ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
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

                {/* Hint button */}
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
          </>
        )}

        {/* Reset after completion */}
        {isComplete && (
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
