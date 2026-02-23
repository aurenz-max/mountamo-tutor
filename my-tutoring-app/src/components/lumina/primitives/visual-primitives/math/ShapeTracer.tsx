'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeTracerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeTracerChallenge {
  id: string;
  type: 'trace' | 'complete' | 'draw-from-description' | 'connect-dots';
  instruction: string;
  targetShape: string;
  // trace
  tracePath?: Array<{ x: number; y: number }>;
  tolerance?: number;
  // complete
  drawnSides?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  remainingVertices?: Array<{ x: number; y: number }>;
  // draw-from-description
  description?: string;
  requiredProperties?: {
    sides?: number;
    corners?: number;
    allSidesEqual?: boolean;
    hasCurvedSides?: boolean;
  };
  // connect-dots
  dots?: Array<{ x: number; y: number; label?: string }>;
  correctOrder?: number[];
  revealShape?: string;
}

export interface ShapeTracerData {
  title: string;
  description?: string;
  challenges: ShapeTracerChallenge[];
  gridSize: number;
  showPropertyReminder: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeTracerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  trace: { label: 'Trace', icon: '\u270F\uFE0F', accentColor: 'blue' },
  complete: { label: 'Complete', icon: '\uD83E\uDDE9', accentColor: 'purple' },
  'draw-from-description': { label: 'Draw', icon: '\uD83C\uDFA8', accentColor: 'emerald' },
  'connect-dots': { label: 'Connect', icon: '\uD83D\uDD17', accentColor: 'orange' },
};

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 400;
const DOT_RADIUS = 16;
const GRID_DOT_RADIUS = 6;

const SHAPE_FILL: Record<string, string> = {
  triangle: 'rgba(59, 130, 246, 0.15)',
  square: 'rgba(168, 85, 247, 0.15)',
  rectangle: 'rgba(34, 197, 94, 0.15)',
  circle: 'rgba(234, 179, 8, 0.15)',
  hexagon: 'rgba(236, 72, 153, 0.15)',
  pentagon: 'rgba(6, 182, 212, 0.15)',
  rhombus: 'rgba(249, 115, 22, 0.15)',
};

const SHAPE_STROKE: Record<string, string> = {
  triangle: 'rgba(59, 130, 246, 0.6)',
  square: 'rgba(168, 85, 247, 0.6)',
  rectangle: 'rgba(34, 197, 94, 0.6)',
  circle: 'rgba(234, 179, 8, 0.6)',
  hexagon: 'rgba(236, 72, 153, 0.6)',
  pentagon: 'rgba(6, 182, 212, 0.6)',
  rhombus: 'rgba(249, 115, 22, 0.6)',
};

// ============================================================================
// Helpers
// ============================================================================

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function generateGridDots(gridSize: number): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  const pad = 40;
  for (let x = pad; x <= CANVAS_WIDTH - pad; x += gridSize) {
    for (let y = pad; y <= CANVAS_HEIGHT - pad; y += gridSize) {
      dots.push({ x, y });
    }
  }
  return dots;
}

function checkShapeProperties(
  vertices: Array<{ x: number; y: number }>,
  required: NonNullable<ShapeTracerChallenge['requiredProperties']>,
): { correct: boolean; feedback: string } {
  const numSides = vertices.length;

  if (required.sides !== undefined && numSides !== required.sides) {
    return { correct: false, feedback: `Your shape has ${numSides} sides but needs ${required.sides}.` };
  }
  if (required.corners !== undefined && numSides !== required.corners) {
    return { correct: false, feedback: `Your shape has ${numSides} corners but needs ${required.corners}.` };
  }
  if (required.allSidesEqual && numSides >= 2) {
    const lengths = vertices.map((v, i) => dist(v, vertices[(i + 1) % numSides]));
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const tolerance = avg * 0.35; // generous for small hands
    if (!lengths.every(len => Math.abs(len - avg) <= tolerance)) {
      return { correct: false, feedback: 'Try to make all sides about the same length!' };
    }
  }

  return { correct: true, feedback: 'Great shape!' };
}

// ============================================================================
// Props
// ============================================================================

interface ShapeTracerProps {
  data: ShapeTracerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const ShapeTracer: React.FC<ShapeTracerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gridSize = 50,
    showPropertyReminder = true,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── State ─────────────────────────────────────────────────────────

  const [tappedIndices, setTappedIndices] = useState<number[]>([]);
  const [selectedGridPoints, setSelectedGridPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [shapeComplete, setShapeComplete] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [revealedShape, setRevealedShape] = useState('');

  // ── Challenge Progress (shared hooks) ─────────────────────────────

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
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  const gridDots = useMemo(() => generateGridDots(gridSize), [gridSize]);

  // ── Refs ──────────────────────────────────────────────────────────

  const stableInstanceIdRef = useRef(instanceId || `shape-tracer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Computed ──────────────────────────────────────────────────────

  const sidesCompleted = useMemo(() => {
    if (!currentChallenge) return 0;
    switch (currentChallenge.type) {
      case 'trace':
        return Math.max(0, tappedIndices.length - 1);
      case 'complete':
        return (currentChallenge.drawnSides?.length ?? 0) + Math.max(0, tappedIndices.length - 1);
      case 'draw-from-description':
        return Math.max(0, selectedGridPoints.length - 1);
      case 'connect-dots':
        return Math.max(0, tappedIndices.length - 1);
      default:
        return 0;
    }
  }, [currentChallenge, tappedIndices, selectedGridPoints]);

  const totalSides = useMemo(() => {
    if (!currentChallenge) return 0;
    switch (currentChallenge.type) {
      case 'trace':
        return currentChallenge.tracePath?.length ?? 0;
      case 'complete':
        return (currentChallenge.drawnSides?.length ?? 0) + (currentChallenge.remainingVertices?.length ?? 0);
      case 'draw-from-description':
        return currentChallenge.requiredProperties?.sides ?? 0;
      case 'connect-dots':
        return currentChallenge.dots?.length ?? 0;
      default:
        return 0;
    }
  }, [currentChallenge]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  const canUndo = !isCurrentChallengeComplete && !allChallengesComplete && (
    currentChallenge?.type === 'draw-from-description'
      ? selectedGridPoints.length > 0
      : tappedIndices.length > 0
  );

  // ── Evaluation Hook ───────────────────────────────────────────────

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeTracerMetrics>({
    primitiveType: 'shape-tracer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring Integration ───────────────────────────────────────

  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'trace',
    targetShape: currentChallenge?.targetShape ?? '',
    description: currentChallenge?.description ?? '',
    requiredProperties: currentChallenge?.requiredProperties ?? {},
    sidesCompleted,
    totalSides,
    attemptNumber: currentAttempts + 1,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? '',
  }), [
    currentChallenge, sidesCompleted, totalSides, currentAttempts,
    gradeBand, challenges.length, currentChallengeIndex,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'shape-tracer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Shape Tracer activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering shape construction. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}, shape: ${currentChallenge?.targetShape}). `
      + `Introduce warmly: "Let's learn to draw shapes! We'll trace, complete, and even draw shapes from descriptions."`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Interaction Handlers ──────────────────────────────────────────

  const handleTraceTap = useCallback((vertexIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete) return;
    const path = currentChallenge?.tracePath;
    if (!path) return;

    if (vertexIndex !== tappedIndices.length) {
      setFeedback('Try tapping the next dot in order!');
      setFeedbackType('error');
      return;
    }

    const newTapped = [...tappedIndices, vertexIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');

    const sideNum = newTapped.length - 1;
    if (sideNum > 0 && sideNum < path.length) {
      sendText(
        `[SIDE_COMPLETE] Student completed side ${sideNum} of ${path.length} for ${currentChallenge?.targetShape}. `
        + `Encourage: "Side ${sideNum} done! ${path.length - sideNum} more to go!"`,
        { silent: true },
      );
    }

    if (newTapped.length === path.length) {
      setShapeComplete(true);
      setFeedback(`You traced the ${currentChallenge?.targetShape}!`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge!.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student traced a ${currentChallenge?.targetShape} with ${path.length} sides! `
        + `Celebrate: "You drew a perfect ${currentChallenge?.targetShape}! Look at all ${path.length} sides!"`,
        { silent: true },
      );
    }
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, currentAttempts, sendText, recordResult]);

  const handleCompleteTap = useCallback((vertexIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete) return;
    const remaining = currentChallenge?.remainingVertices;
    if (!remaining) return;

    if (vertexIndex !== tappedIndices.length) {
      setFeedback('Tap the next dot to add the next side!');
      setFeedbackType('error');
      return;
    }

    const newTapped = [...tappedIndices, vertexIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');

    const drawnCount = currentChallenge?.drawnSides?.length ?? 0;
    const sideNum = drawnCount + newTapped.length;
    const totalShapeSides = drawnCount + remaining.length;

    if (newTapped.length > 0) {
      sendText(
        `[SIDE_COMPLETE] Student drew side ${sideNum} of ${totalShapeSides} for ${currentChallenge?.targetShape}. `
        + `${totalShapeSides - sideNum} sides remaining.`,
        { silent: true },
      );
    }

    if (newTapped.length === remaining.length) {
      setShapeComplete(true);
      setFeedback(`You completed the ${currentChallenge?.targetShape}!`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge!.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student completed a ${currentChallenge?.targetShape}! `
        + `They drew the missing ${remaining.length} side(s). Celebrate!`,
        { silent: true },
      );
    }
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, currentAttempts, sendText, recordResult]);

  const handleGridDotClick = useCallback((dot: { x: number; y: number }) => {
    if (hasSubmittedEvaluation || shapeComplete) return;
    if (selectedGridPoints.some(p => p.x === dot.x && p.y === dot.y)) {
      setFeedback('You already placed a corner there!');
      setFeedbackType('error');
      return;
    }
    setSelectedGridPoints(prev => [...prev, dot]);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, shapeComplete, selectedGridPoints]);

  const handleConnectDotTap = useCallback((dotIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete) return;
    const dots = currentChallenge?.dots;
    const order = currentChallenge?.correctOrder;
    if (!dots || !order) return;

    const expectedDot = order[tappedIndices.length];
    if (dotIndex !== expectedDot) {
      incrementAttempts();
      setFeedback('Try finding the next number in order!');
      setFeedbackType('error');
      sendText(
        `[WRONG_DOT] Student tapped dot ${dotIndex} but should tap dot ${expectedDot} (step ${tappedIndices.length + 1}). `
        + `Hint: "Look for the number ${tappedIndices.length + 1}. Which dot is next?"`,
        { silent: true },
      );
      return;
    }

    const newTapped = [...tappedIndices, dotIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');

    if (newTapped.length === order.length) {
      setShapeComplete(true);
      const shapeName = currentChallenge?.revealShape || currentChallenge?.targetShape || 'shape';
      setRevealedShape(shapeName);
      setFeedback(`It's a ${shapeName}!`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge!.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student connected all ${order.length} dots and revealed a ${shapeName}! `
        + `Ask: "What shape did you make? How many sides does it have?"`,
        { silent: true },
      );
    }
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, currentAttempts, sendText, recordResult, incrementAttempts]);

  const handleUndo = useCallback(() => {
    if (currentChallenge?.type === 'draw-from-description') {
      setSelectedGridPoints(prev => prev.slice(0, -1));
    } else {
      setTappedIndices(prev => prev.slice(0, -1));
    }
    setFeedback('');
    setFeedbackType('');
  }, [currentChallenge?.type]);

  const handleCheckShape = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'draw-from-description') return;
    if (selectedGridPoints.length < 3) {
      setFeedback('You need at least 3 corners to make a shape!');
      setFeedbackType('error');
      return;
    }

    incrementAttempts();
    const required = currentChallenge.requiredProperties;
    if (!required) {
      setShapeComplete(true);
      setFeedback(`Nice ${currentChallenge.targetShape}!`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      return;
    }

    const result = checkShapeProperties(selectedGridPoints, required);
    if (result.correct) {
      setShapeComplete(true);
      setFeedback(`Great job! You drew a ${currentChallenge.targetShape}!`);
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student drew a ${currentChallenge.targetShape} from description: "${currentChallenge.description}". `
        + `Their shape has ${selectedGridPoints.length} sides. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback(result.feedback);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student's shape doesn't match. ${result.feedback} `
        + `Required: ${JSON.stringify(required)}. Student drew ${selectedGridPoints.length} vertices. `
        + `Give a gentle hint.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedGridPoints, currentAttempts, sendText, recordResult, incrementAttempts]);

  // ── Challenge Navigation ──────────────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their shape-drawing skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correct = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correct / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: ShapeTracerMetrics = {
          type: 'shape-tracer',
          tracingAccuracy: accuracy,
          shapesCompleted: correct,
          totalShapes: challenges.length,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(correct === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain-specific state
    setTappedIndices([]);
    setSelectedGridPoints([]);
    setShapeComplete(false);
    setFeedback('');
    setFeedbackType('');
    setRevealedShape('');

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}, shape: ${nextChallenge.targetShape}). `
      + `Read the instruction and encourage the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // Auto-submit when all complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Render Helpers ────────────────────────────────────────────────

  const shapeFill = SHAPE_FILL[currentChallenge?.targetShape ?? ''] || 'rgba(99, 102, 241, 0.15)';
  const shapeStroke = SHAPE_STROKE[currentChallenge?.targetShape ?? ''] || 'rgba(99, 102, 241, 0.6)';

  // ---- Trace Canvas ----
  const renderTraceCanvas = () => {
    const path = currentChallenge?.tracePath;
    if (!path || path.length === 0) return null;

    return (
      <>
        {/* Dotted outline of full shape */}
        <polygon
          points={path.map(p => `${p.x},${p.y}`).join(' ')}
          fill={shapeComplete ? shapeFill : 'none'}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={2}
          strokeDasharray="8 6"
          className={shapeComplete ? 'transition-all duration-500' : ''}
        />

        {/* Animated ant-trail on dotted lines */}
        {!shapeComplete && (
          <polygon
            points={path.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth={2}
            strokeDasharray="4 12"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-16"
              dur="1s"
              repeatCount="indefinite"
            />
          </polygon>
        )}

        {/* Solid lines between tapped vertices */}
        {tappedIndices.length > 1 && tappedIndices.map((vertIdx, i) => {
          if (i === 0) return null;
          const from = path[tappedIndices[i - 1]];
          const to = path[vertIdx];
          return (
            <line
              key={`side-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {/* Closing line when shape is complete */}
        {shapeComplete && path.length > 2 && (
          <line
            x1={path[path.length - 1].x} y1={path[path.length - 1].y}
            x2={path[0].x} y2={path[0].y}
            stroke={shapeStroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Vertex dots (tap targets) */}
        {path.map((point, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = idx === tappedIndices.length;

          return (
            <g key={`v-${idx}`} className="cursor-pointer" onClick={() => handleTraceTap(idx)}>
              {/* Pulsing ring for next vertex */}
              {isNext && !shapeComplete && (
                <circle
                  cx={point.x} cy={point.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={point.x} cy={point.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(59, 130, 246, 0.7)' : isNext ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
                className="transition-colors duration-200"
              />

              <text
                x={point.x} y={point.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight="bold"
                fill={isTapped ? '#93c5fd' : isNext ? '#93c5fd' : '#94a3b8'}
                className="pointer-events-none select-none"
              >
                {idx + 1}
              </text>

              {isTapped && (
                <text
                  x={point.x + DOT_RADIUS - 2} y={point.y - DOT_RADIUS + 2}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={10}
                  className="pointer-events-none select-none"
                  fill="#4ade80"
                >
                  {'\u2713'}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  };

  // ---- Complete Canvas ----
  const renderCompleteCanvas = () => {
    const drawnSides = currentChallenge?.drawnSides ?? [];
    const remaining = currentChallenge?.remainingVertices ?? [];

    // Build all vertices for polygon fill when complete
    const allVerts: Array<{ x: number; y: number }> = [];
    for (const side of drawnSides) {
      if (
        allVerts.length === 0 ||
        allVerts[allVerts.length - 1].x !== side.from.x ||
        allVerts[allVerts.length - 1].y !== side.from.y
      ) {
        allVerts.push(side.from);
      }
      allVerts.push(side.to);
    }
    for (const v of remaining) allVerts.push(v);

    return (
      <>
        {/* Fill when complete */}
        {shapeComplete && allVerts.length >= 3 && (
          <polygon
            points={allVerts.map(p => `${p.x},${p.y}`).join(' ')}
            fill={shapeFill} stroke="none"
            className="transition-all duration-500"
          />
        )}

        {/* Pre-drawn sides */}
        {drawnSides.map((side, i) => (
          <line
            key={`drawn-${i}`}
            x1={side.from.x} y1={side.from.y} x2={side.to.x} y2={side.to.y}
            stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeLinecap="round"
          />
        ))}

        {/* Student-drawn sides */}
        {tappedIndices.map((vertIdx, i) => {
          let from: { x: number; y: number };
          if (i === 0) {
            const lastSide = drawnSides[drawnSides.length - 1];
            from = lastSide ? lastSide.to : remaining[0];
          } else {
            from = remaining[tappedIndices[i - 1]];
          }
          const to = remaining[vertIdx];
          return (
            <line
              key={`stu-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Closing line when complete */}
        {shapeComplete && remaining.length > 0 && drawnSides.length > 0 && (
          <line
            x1={remaining[remaining.length - 1].x} y1={remaining[remaining.length - 1].y}
            x2={drawnSides[0].from.x} y2={drawnSides[0].from.y}
            stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
          />
        )}

        {/* Drawn-side vertex dots */}
        {drawnSides.map((side, i) => (
          <React.Fragment key={`dv-${i}`}>
            <circle cx={side.from.x} cy={side.from.y} r={5} fill="rgba(255,255,255,0.3)" />
            {i === drawnSides.length - 1 && (
              <circle cx={side.to.x} cy={side.to.y} r={5} fill="rgba(255,255,255,0.3)" />
            )}
          </React.Fragment>
        ))}

        {/* Remaining vertex dots */}
        {remaining.map((point, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = idx === tappedIndices.length;
          return (
            <g key={`rem-${idx}`} className="cursor-pointer" onClick={() => handleCompleteTap(idx)}>
              {isNext && !shapeComplete && (
                <circle
                  cx={point.x} cy={point.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(168, 85, 247, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={point.x} cy={point.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(168, 85, 247, 0.7)' : isNext ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
              />

              {!isTapped && (
                <circle cx={point.x} cy={point.y} r={4} fill={isNext ? 'rgba(168, 85, 247, 0.7)' : 'rgba(255,255,255,0.4)'} />
              )}
              {isTapped && (
                <text
                  x={point.x} y={point.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={10} fill="#c084fc"
                  className="pointer-events-none select-none"
                >
                  {'\u2713'}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  };

  // ---- Draw-from-description Canvas ----
  const renderDrawCanvas = () => {
    return (
      <>
        {/* Grid dots */}
        {gridDots.map((dot, idx) => {
          const isSelected = selectedGridPoints.some(p => p.x === dot.x && p.y === dot.y);
          return (
            <circle
              key={`g-${idx}`}
              cx={dot.x} cy={dot.y}
              r={isSelected ? GRID_DOT_RADIUS + 4 : GRID_DOT_RADIUS}
              fill={isSelected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.08)'}
              stroke={isSelected ? 'rgba(34, 197, 94, 0.7)' : 'none'}
              strokeWidth={isSelected ? 2 : 0}
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleGridDotClick(dot)}
            />
          );
        })}

        {/* Lines between selected points */}
        {selectedGridPoints.length > 1 && selectedGridPoints.map((point, i) => {
          if (i === 0) return null;
          const prev = selectedGridPoints[i - 1];
          return (
            <line
              key={`ln-${i}`}
              x1={prev.x} y1={prev.y} x2={point.x} y2={point.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Preview closing line (dashed) */}
        {selectedGridPoints.length >= 3 && !shapeComplete && (
          <line
            x1={selectedGridPoints[selectedGridPoints.length - 1].x}
            y1={selectedGridPoints[selectedGridPoints.length - 1].y}
            x2={selectedGridPoints[0].x}
            y2={selectedGridPoints[0].y}
            stroke="rgba(34, 197, 94, 0.2)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}

        {/* Closed shape fill when complete */}
        {shapeComplete && selectedGridPoints.length >= 3 && (
          <>
            <line
              x1={selectedGridPoints[selectedGridPoints.length - 1].x}
              y1={selectedGridPoints[selectedGridPoints.length - 1].y}
              x2={selectedGridPoints[0].x}
              y2={selectedGridPoints[0].y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
            <polygon
              points={selectedGridPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill={shapeFill} stroke="none"
            />
          </>
        )}

        {/* Vertex labels */}
        {selectedGridPoints.map((point, i) => (
          <text
            key={`lbl-${i}`}
            x={point.x} y={point.y - GRID_DOT_RADIUS - 8}
            textAnchor="middle"
            fontSize={11} fontWeight="bold"
            fill="#86efac"
            className="pointer-events-none select-none"
          >
            {i + 1}
          </text>
        ))}
      </>
    );
  };

  // ---- Connect-dots Canvas ----
  const renderConnectDotsCanvas = () => {
    const dots = currentChallenge?.dots ?? [];
    const order = currentChallenge?.correctOrder ?? [];

    return (
      <>
        {/* Fill when complete */}
        {shapeComplete && tappedIndices.length >= 3 && (
          <polygon
            points={tappedIndices.map(i => `${dots[i].x},${dots[i].y}`).join(' ')}
            fill={shapeFill} stroke="none"
            className="transition-all duration-500"
          />
        )}

        {/* Lines between connected dots */}
        {tappedIndices.length > 1 && tappedIndices.map((dotIdx, i) => {
          if (i === 0) return null;
          const from = dots[tappedIndices[i - 1]];
          const to = dots[dotIdx];
          return (
            <line
              key={`con-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Closing line */}
        {shapeComplete && tappedIndices.length >= 3 && (
          <line
            x1={dots[tappedIndices[tappedIndices.length - 1]].x}
            y1={dots[tappedIndices[tappedIndices.length - 1]].y}
            x2={dots[tappedIndices[0]].x}
            y2={dots[tappedIndices[0]].y}
            stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
          />
        )}

        {/* Dot tap targets */}
        {dots.map((dot, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = order[tappedIndices.length] === idx;

          return (
            <g key={`d-${idx}`} className="cursor-pointer" onClick={() => handleConnectDotTap(idx)}>
              {isNext && !shapeComplete && (
                <circle
                  cx={dot.x} cy={dot.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(249, 115, 22, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={dot.x} cy={dot.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(249, 115, 22, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(249, 115, 22, 0.7)' : isNext ? 'rgba(249, 115, 22, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
              />

              <text
                x={dot.x} y={dot.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight="bold"
                fill={isTapped ? '#fdba74' : '#94a3b8'}
                className="pointer-events-none select-none"
              >
                {dot.label || String(idx + 1)}
              </text>
            </g>
          );
        })}

        {/* Revealed shape name */}
        {revealedShape && (
          <text
            x={CANVAS_WIDTH / 2} y={30}
            textAnchor="middle"
            fontSize={20} fontWeight="bold"
            fill="#fdba74"
            className="select-none"
          >
            {`It's a ${revealedShape}!`}
          </text>
        )}
      </>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
                {currentChallenge.targetShape}
              </Badge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Type Badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              if (!challenges.some(c => c.type === type)) return null;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    currentChallenge?.type === type
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Property Reminder */}
        {showPropertyReminder && currentChallenge?.requiredProperties && !shapeComplete && (
          <div className="flex items-center gap-3 bg-slate-800/20 rounded-lg px-3 py-2 border border-white/5">
            <span className="text-slate-500 text-xs uppercase tracking-wider">Needs:</span>
            <div className="flex gap-2 flex-wrap">
              {currentChallenge.requiredProperties.sides !== undefined && (
                <Badge className="bg-emerald-500/10 border-emerald-400/30 text-emerald-300 text-xs">
                  {currentChallenge.requiredProperties.sides} sides
                </Badge>
              )}
              {currentChallenge.requiredProperties.corners !== undefined && (
                <Badge className="bg-blue-500/10 border-blue-400/30 text-blue-300 text-xs">
                  {currentChallenge.requiredProperties.corners} corners
                </Badge>
              )}
              {currentChallenge.requiredProperties.allSidesEqual && (
                <Badge className="bg-purple-500/10 border-purple-400/30 text-purple-300 text-xs">
                  All sides equal
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Drawing Canvas */}
        <div className="flex justify-center">
          <svg
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="max-w-full h-auto rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {/* Border */}
            <rect
              x={1} y={1}
              width={CANVAS_WIDTH - 2} height={CANVAS_HEIGHT - 2}
              rx={12} ry={12}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5}
            />

            {/* Background dot grid (for non draw-from-description modes) */}
            {currentChallenge?.type !== 'draw-from-description' && (
              Array.from(
                { length: Math.floor((CANVAS_WIDTH - 80) / gridSize) + 1 },
                (_, i) => Array.from(
                  { length: Math.floor((CANVAS_HEIGHT - 80) / gridSize) + 1 },
                  (_, j) => (
                    <circle
                      key={`bg-${i}-${j}`}
                      cx={40 + i * gridSize}
                      cy={40 + j * gridSize}
                      r={1.5}
                      fill="rgba(255,255,255,0.05)"
                    />
                  ),
                )
              )
            )}

            {/* Mode-specific rendering */}
            {currentChallenge?.type === 'trace' && renderTraceCanvas()}
            {currentChallenge?.type === 'complete' && renderCompleteCanvas()}
            {currentChallenge?.type === 'draw-from-description' && renderDrawCanvas()}
            {currentChallenge?.type === 'connect-dots' && renderConnectDotsCanvas()}
          </svg>
        </div>

        {/* Side Counter */}
        {currentChallenge && !allChallengesComplete && totalSides > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {Array.from({ length: totalSides }, (_, i) => (
              <div
                key={`sc-${i}`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  i < sidesCompleted
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : 'bg-slate-800/30 text-slate-500 border border-white/5'
                }`}
              >
                Side {i + 1} {i < sidesCompleted ? '\u2713' : ''}
              </div>
            ))}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {canUndo && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                onClick={handleUndo}
              >
                Undo
              </Button>
            )}

            {currentChallenge?.type === 'draw-from-description' && !isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckShape}
                disabled={selectedGridPoints.length < 3}
              >
                Check Shape
              </Button>
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
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Shape Tracer Complete!"
            celebrationMessage={`You completed all ${challenges.length} shape challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ShapeTracer;
