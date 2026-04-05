'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeComposerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeComposerPiece {
  id: string;
  shape: 'triangle' | 'square' | 'rectangle' | 'circle' | 'hexagon' | 'trapezoid' | 'rhombus' | 'semicircle';
  color: string;
  width: number;
  height: number;
  initialRotation?: number;
  targetX?: number;
  targetY?: number;
  targetRotation?: number;
}

export interface ShapeComposerComponent {
  shape: string;
  count: number;
}

export interface ShapeComposerChallenge {
  id: string;
  type: 'compose-match' | 'compose-picture' | 'decompose' | 'free-create' | 'how-many-ways';
  instruction: string;
  // compose-match
  targetShape?: string;
  targetOutlinePath?: string; // SVG path for the silhouette
  pieces?: ShapeComposerPiece[];
  // compose-picture
  targetPicture?: string;
  targetDescription?: string;
  availableShapes?: Array<{ shape: string; color: string; count: number }>;
  pictureSlots?: Array<{ id: string; shape: string; x: number; y: number; width: number; height: number; rotation: number }>;
  // decompose
  compositeShapePath?: string; // SVG path for the composite shape
  compositeDescription?: string;
  expectedComponents?: ShapeComposerComponent[];
  divisionLineHints?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  // how-many-ways
  targetForComposition?: string;
  allowedPieces?: string[];
  minimumPiecesNeeded?: number;
  validSolutionCount?: number;
  // shared
  hint?: string;
}

export interface ShapeComposerData {
  title: string;
  description?: string;
  challenges: ShapeComposerChallenge[];
  snapTolerance?: number;
  rotationSnap?: number;
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeComposerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'compose-match':   { label: 'Compose Match',   icon: '🧩', accentColor: 'purple' },
  'compose-picture': { label: 'Compose Picture', icon: '🎨', accentColor: 'blue' },
  'decompose':       { label: 'Decompose',       icon: '✂️', accentColor: 'emerald' },
  'free-create':     { label: 'Free Create',     icon: '✨', accentColor: 'amber' },
  'how-many-ways':   { label: 'How Many Ways',   icon: '🔢', accentColor: 'orange' },
};

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 350;
const SNAP_DISTANCE = 50;

// Shape colors for the palette
const SHAPE_COLORS: Record<string, string> = {
  triangle: '#8B5CF6',
  square: '#3B82F6',
  rectangle: '#10B981',
  circle: '#F59E0B',
  hexagon: '#EC4899',
  trapezoid: '#6366F1',
  rhombus: '#14B8A6',
  semicircle: '#F97316',
};

// ============================================================================
// Shape SVG Renderers
// ============================================================================

function getShapePath(shape: string, w: number, h: number): string {
  switch (shape) {
    case 'triangle':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'square':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'rectangle':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'hexagon': {
      const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + rx * Math.cos(a)} ${cy + ry * Math.sin(a)}`;
      });
      return `M ${pts.join(' L ')} Z`;
    }
    case 'trapezoid':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'rhombus':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
    case 'circle':
      return ''; // handled separately with <ellipse>
    case 'semicircle':
      return `M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} L 0 ${h} Z`;
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }
}

interface PlacedShape {
  id: string;
  shape: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ShapeSVGProps {
  shape: string;
  color: string;
  width: number;
  height: number;
  rotation?: number;
  x?: number;
  y?: number;
  opacity?: number;
  className?: string;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  strokeColor?: string;
  strokeWidth?: number;
  showLabel?: boolean;
}

const ShapeSVG: React.FC<ShapeSVGProps> = ({
  shape, color, width, height, rotation = 0, x = 0, y = 0,
  opacity = 1, className = '', onClick, onMouseDown,
  strokeColor = 'rgba(255,255,255,0.3)', strokeWidth = 1.5, showLabel = false,
}) => {
  const transform = `translate(${x}, ${y}) rotate(${rotation}, ${width / 2}, ${height / 2})`;

  return (
    <g transform={transform} className={className} onClick={onClick} onMouseDown={onMouseDown}
       style={{ cursor: onClick || onMouseDown ? 'pointer' : 'default' }}>
      {shape === 'circle' ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2}
                 fill={color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={opacity} />
      ) : (
        <path d={getShapePath(shape, width, height)}
              fill={color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={opacity} />
      )}
      {showLabel && (
        <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={10} fontWeight="bold" pointerEvents="none">
          {shape}
        </text>
      )}
    </g>
  );
};

// ============================================================================
// Props
// ============================================================================

interface ShapeComposerProps {
  data: ShapeComposerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const ShapeComposer: React.FC<ShapeComposerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    snapTolerance = SNAP_DISTANCE,
    rotationSnap = 45,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge Progress (shared hooks)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const [placedShapes, setPlacedShapes] = useState<PlacedShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [decomposeTaps, setDecomposeTaps] = useState<string[]>([]);
  const [freeCreateShapes, setFreeCreateShapes] = useState<PlacedShape[]>([]);
  const [howManyAnswer, setHowManyAnswer] = useState('');

  const canvasRef = useRef<SVGSVGElement>(null);
  const stableInstanceIdRef = useRef(instanceId || `shape-composer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const placedCountRef = useRef(0);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeComposerMetrics>({
    primitiveType: 'shape-composer',
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
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'compose-match',
    instruction: currentChallenge?.instruction ?? '',
    targetShape: currentChallenge?.targetShape ?? currentChallenge?.targetPicture ?? '',
    piecesPlaced: placedShapes.length,
    totalPieces: currentChallenge?.pieces?.length ?? currentChallenge?.pictureSlots?.length ?? 0,
    expectedComponents: currentChallenge?.expectedComponents ?? [],
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge,
    placedShapes.length, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'shape-composer',
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
      `[ACTIVITY_START] Shape Composer for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Let's build shapes together! We'll use smaller shapes to make bigger ones."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Drag & Drop Handlers
  // -------------------------------------------------------------------------
  const isFreeCreate = currentChallenge?.type === 'free-create';

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH - dragging.offsetX;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT - dragging.offsetY;

    const setter = isFreeCreate ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.map(s =>
      s.id === dragging.id ? { ...s, x: Math.max(0, Math.min(CANVAS_WIDTH - s.width, x)), y: Math.max(0, Math.min(CANVAS_HEIGHT - s.height, y)) } : s
    ));
  }, [dragging, isFreeCreate]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!dragging) return;
    // Check snap-to-fit for compose-match — match by shape type, not ID
    if (currentChallenge?.type === 'compose-match' && currentChallenge.pieces) {
      setPlacedShapes(prev => {
        const draggedShape = prev.find(s => s.id === dragging.id);
        if (!draggedShape) return prev;
        // Find targets of the same shape type that aren't already occupied by another piece
        const occupiedTargets = new Set(
          prev.filter(s => s.id !== dragging.id).map(s => {
            const t = currentChallenge.pieces!.find(p =>
              p.shape === s.shape && p.targetX !== undefined && p.targetY !== undefined &&
              Math.abs(s.x - p.targetX!) < 5 && Math.abs(s.y - p.targetY!) < 5
            );
            return t ? t.id : null;
          }).filter(Boolean)
        );
        // Find the nearest unoccupied same-shape target
        let bestTarget: ShapeComposerPiece | null = null;
        let bestDist = Infinity;
        for (const p of currentChallenge.pieces!) {
          if (p.targetX === undefined || p.targetY === undefined) continue;
          if (p.shape !== draggedShape.shape) continue;
          if (occupiedTargets.has(p.id)) continue;
          const dx = draggedShape.x - p.targetX;
          const dy = draggedShape.y - p.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < snapTolerance && dist < bestDist) {
            bestDist = dist;
            bestTarget = p;
          }
        }
        if (bestTarget) {
          return prev.map(s =>
            s.id === dragging.id
              ? { ...s, x: bestTarget!.targetX!, y: bestTarget!.targetY!, rotation: bestTarget!.targetRotation ?? s.rotation }
              : s
          );
        }
        return prev;
      });
    }
    // Check snap for compose-picture
    if (currentChallenge?.type === 'compose-picture' && currentChallenge.pictureSlots) {
      setPlacedShapes(prev => prev.map(s => {
        if (s.id !== dragging.id) return s;
        const matchingSlot = currentChallenge.pictureSlots!.find(slot =>
          slot.shape === s.shape &&
          !prev.some(other => other.id !== s.id && Math.abs(other.x - slot.x) < 5 && Math.abs(other.y - slot.y) < 5)
        );
        if (matchingSlot) {
          const dx = s.x - matchingSlot.x;
          const dy = s.y - matchingSlot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < snapTolerance) {
            return { ...s, x: matchingSlot.x, y: matchingSlot.y, width: matchingSlot.width, height: matchingSlot.height, rotation: matchingSlot.rotation };
          }
        }
        return s;
      }));
    }
    setDragging(null);
  }, [dragging, currentChallenge, snapTolerance]);

  const handleShapeMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (hasSubmittedEvaluation) return;
    e.preventDefault();
    const allShapes = isFreeCreate ? freeCreateShapes : placedShapes;
    const shape = allShapes.find(s => s.id === id);
    if (!shape || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const mouseY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    setDragging({ id, offsetX: mouseX - shape.x, offsetY: mouseY - shape.y });
    setSelectedShapeId(id);
  }, [hasSubmittedEvaluation, placedShapes, freeCreateShapes, isFreeCreate]);

  // -------------------------------------------------------------------------
  // Palette: Add shape to canvas
  // -------------------------------------------------------------------------
  const addShapeFromPalette = useCallback((shape: string, color: string, w: number, h: number) => {
    if (hasSubmittedEvaluation) return;
    placedCountRef.current += 1;
    const newShape: PlacedShape = {
      id: `placed-${Date.now()}-${placedCountRef.current}`,
      shape,
      color,
      x: CANVAS_WIDTH / 2 - w / 2,
      y: CANVAS_HEIGHT / 2 - h / 2,
      width: w,
      height: h,
      rotation: 0,
    };
    if (currentChallenge?.type === 'free-create') {
      setFreeCreateShapes(prev => [...prev, newShape]);
    } else {
      setPlacedShapes(prev => [...prev, newShape]);
    }
  }, [hasSubmittedEvaluation, currentChallenge?.type]);

  // Add piece from compose-match/compose-picture piece list
  const addPieceToCanvas = useCallback((piece: ShapeComposerPiece) => {
    if (hasSubmittedEvaluation) return;
    if (placedShapes.some(s => s.id === piece.id)) return; // already placed
    const newShape: PlacedShape = {
      id: piece.id,
      shape: piece.shape,
      color: piece.color || SHAPE_COLORS[piece.shape] || '#8B5CF6',
      x: 20 + Math.random() * 60,
      y: CANVAS_HEIGHT / 2 - piece.height / 2,
      width: piece.width,
      height: piece.height,
      rotation: piece.initialRotation ?? 0,
    };
    setPlacedShapes(prev => [...prev, newShape]);
  }, [hasSubmittedEvaluation, placedShapes]);

  // -------------------------------------------------------------------------
  // Rotate selected shape
  // -------------------------------------------------------------------------
  const rotateSelected = useCallback((degrees: number) => {
    if (!selectedShapeId || hasSubmittedEvaluation) return;
    const setter = currentChallenge?.type === 'free-create' ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.map(s =>
      s.id === selectedShapeId ? { ...s, rotation: (s.rotation + degrees) % 360 } : s
    ));
  }, [selectedShapeId, hasSubmittedEvaluation, currentChallenge?.type]);

  // Remove selected shape from canvas
  const removeSelected = useCallback(() => {
    if (!selectedShapeId || hasSubmittedEvaluation) return;
    const setter = currentChallenge?.type === 'free-create' ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.filter(s => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  }, [selectedShapeId, hasSubmittedEvaluation, currentChallenge?.type]);

  // -------------------------------------------------------------------------
  // Decompose: tap to identify regions
  // -------------------------------------------------------------------------
  const handleDecomposeTap = useCallback((componentShape: string) => {
    if (hasSubmittedEvaluation || !currentChallenge || currentChallenge.type !== 'decompose') return;
    setDecomposeTaps(prev => [...prev, componentShape]);
  }, [hasSubmittedEvaluation, currentChallenge]);

  // -------------------------------------------------------------------------
  // Check Answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    let correct = false;

    switch (currentChallenge.type) {
      case 'compose-match': {
        // Check if all target positions have a same-shape piece nearby (match by type, not ID)
        const pieces = currentChallenge.pieces ?? [];
        const usedPlacedIds = new Set<string>();
        const allSnapped = pieces.every(piece => {
          if (piece.targetX === undefined || piece.targetY === undefined) return true;
          // Find any placed shape of the same type near this target
          const match = placedShapes.find(s => {
            if (usedPlacedIds.has(s.id)) return false;
            if (s.shape !== piece.shape) return false;
            const dx = s.x - piece.targetX!;
            const dy = s.y - piece.targetY!;
            return Math.sqrt(dx * dx + dy * dy) < snapTolerance;
          });
          if (match) { usedPlacedIds.add(match.id); return true; }
          return false;
        });
        correct = allSnapped && placedShapes.length >= pieces.length;
        break;
      }
      case 'compose-picture': {
        // Check if all slots are filled with correct shapes
        const slots = currentChallenge.pictureSlots ?? [];
        const allFilled = slots.every(slot => {
          return placedShapes.some(s =>
            s.shape === slot.shape &&
            Math.abs(s.x - slot.x) < snapTolerance &&
            Math.abs(s.y - slot.y) < snapTolerance
          );
        });
        correct = allFilled;
        break;
      }
      case 'decompose': {
        // Check if student identified correct component shapes
        const expected = currentChallenge.expectedComponents ?? [];
        const tappedCounts: Record<string, number> = {};
        decomposeTaps.forEach(s => { tappedCounts[s] = (tappedCounts[s] || 0) + 1; });
        correct = expected.every(comp => (tappedCounts[comp.shape] || 0) >= comp.count) &&
          Object.values(tappedCounts).reduce((a, b) => a + b, 0) ===
          expected.reduce((a, b) => a + b.count, 0);
        break;
      }
      case 'how-many-ways': {
        const answer = parseInt(howManyAnswer, 10);
        correct = answer === (currentChallenge.minimumPiecesNeeded ?? 0);
        break;
      }
      case 'free-create': {
        // Always correct — celebrate creativity
        correct = freeCreateShapes.length >= 2;
        break;
      }
    }

    if (correct) {
      setFeedback(currentChallenge.type === 'free-create'
        ? 'Amazing creation! 🎉'
        : 'Correct! Great job! 🎉');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student completed ${currentChallenge.type} challenge correctly. `
        + `${currentChallenge.type === 'compose-match' ? `They built ${currentChallenge.targetShape} from ${placedShapes.length} pieces.` : ''}`
        + `${currentChallenge.type === 'decompose' ? `They identified the components: ${decomposeTaps.join(', ')}.` : ''}`
        + `${currentChallenge.type === 'free-create' ? `They used ${freeCreateShapes.length} shapes to create a picture.` : ''}`
        + ` Congratulate briefly and use spatial vocabulary.`,
        { silent: true }
      );
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        piecesUsed: currentChallenge.type === 'free-create' ? freeCreateShapes.length : placedShapes.length,
      });
    } else {
      const hintText = currentChallenge.hint ?? 'Try again! Look at the shapes carefully.';
      setFeedback(hintText);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] ${currentChallenge.type} challenge. Attempt ${currentAttempts + 1}. `
        + `${currentChallenge.type === 'compose-match' ? `${placedShapes.length}/${(currentChallenge.pieces ?? []).length} pieces placed.` : ''}`
        + `${currentChallenge.type === 'decompose' ? `Student identified: ${decomposeTaps.join(', ')}. Expected: ${(currentChallenge.expectedComponents ?? []).map(c => `${c.count} ${c.shape}`).join(', ')}.` : ''}`
        + ` Give a spatial hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentAttempts, placedShapes, decomposeTaps, freeCreateShapes, howManyAnswer,
      snapTolerance, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All done
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their shape composition skills!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const accuracy = challenges.length > 0
          ? Math.round((correctCount / challenges.length) * 100) : 0;
        const totalPiecesUsed = challengeResults.reduce((s, r) => s + ((r.piecesUsed as number) || 0), 0);

        const metrics: ShapeComposerMetrics = {
          type: 'shape-composer',
          evalMode: challenges[0]?.type ?? 'default',
          accuracy,
          challengesCorrect: correctCount,
          challengesTotal: challenges.length,
          totalPiecesUsed,
          totalAttempts,
          compositionAccuracy: accuracy,
          spatialReasoningScore: accuracy,
        };

        submitEvaluation(
          correctCount === challenges.length,
          accuracy,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Reset domain-specific state
    setPlacedShapes([]);
    setDecomposeTaps([]);
    setFreeCreateShapes([]);
    setHowManyAnswer('');
    setSelectedShapeId(null);
    setFeedback('');
    setFeedbackType('');
    placedCountRef.current = 0;

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${nextChallenge.type}. Instruction: "${nextChallenge.instruction}". Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [advanceProgress, phaseResults, challengeResults, challenges, currentChallengeIndex,
      hasSubmittedEvaluation, submitEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Last result for "next" flow
  // -------------------------------------------------------------------------
  const lastResult = challengeResults[challengeResults.length - 1];
  const showingCorrectFeedback = lastResult?.challengeId === currentChallenge?.id && lastResult?.correct;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderPalette = () => {
    if (!currentChallenge) return null;

    // compose-match: show specific pieces
    if (currentChallenge.type === 'compose-match' && currentChallenge.pieces) {
      const unplaced = currentChallenge.pieces.filter(p => !placedShapes.some(s => s.id === p.id));
      if (unplaced.length === 0) return (
        <div className="text-center text-slate-400 text-sm py-2">All pieces placed!</div>
      );
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {unplaced.map(piece => (
            <button key={piece.id}
              className="p-2 rounded-lg bg-white/5 border border-white/20 hover:bg-white/10 transition-colors"
              onClick={() => addPieceToCanvas(piece)}>
              <svg width={40} height={40} viewBox={`0 0 ${piece.width} ${piece.height}`}>
                <ShapeSVG shape={piece.shape} color={piece.color || SHAPE_COLORS[piece.shape] || '#8B5CF6'}
                          width={piece.width} height={piece.height} />
              </svg>
              <div className="text-xs text-slate-400 mt-1">{piece.shape}</div>
            </button>
          ))}
        </div>
      );
    }

    // compose-picture: show available shapes with counts
    if (currentChallenge.type === 'compose-picture' && currentChallenge.availableShapes) {
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {currentChallenge.availableShapes.map((s, i) => {
            const placedCount = placedShapes.filter(p => p.shape === s.shape).length;
            const remaining = s.count - placedCount;
            return (
              <button key={i}
                className={`p-2 rounded-lg border transition-colors ${remaining > 0 ? 'bg-white/5 border-white/20 hover:bg-white/10' : 'bg-white/2 border-white/5 opacity-50'}`}
                disabled={remaining <= 0}
                onClick={() => addShapeFromPalette(s.shape, s.color || SHAPE_COLORS[s.shape] || '#8B5CF6', 50, s.shape === 'rectangle' ? 35 : 50)}>
                <svg width={36} height={36} viewBox="0 0 50 50">
                  <ShapeSVG shape={s.shape} color={s.color || SHAPE_COLORS[s.shape] || '#8B5CF6'} width={50} height={50} />
                </svg>
                <div className="text-xs text-slate-400 mt-1">{s.shape} ×{remaining}</div>
              </button>
            );
          })}
        </div>
      );
    }

    // free-create / how-many-ways: generic palette
    if (currentChallenge.type === 'free-create' || currentChallenge.type === 'how-many-ways') {
      const allowedShapes = currentChallenge.allowedPieces ??
        ['triangle', 'square', 'rectangle', 'circle'];
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {allowedShapes.map(shape => (
            <button key={shape}
              className="p-2 rounded-lg bg-white/5 border border-white/20 hover:bg-white/10 transition-colors"
              onClick={() => addShapeFromPalette(shape, SHAPE_COLORS[shape] || '#8B5CF6', 50, shape === 'rectangle' ? 35 : 50)}>
              <svg width={36} height={36} viewBox="0 0 50 50">
                <ShapeSVG shape={shape} color={SHAPE_COLORS[shape] || '#8B5CF6'} width={50} height={50} />
              </svg>
              <div className="text-xs text-slate-400 mt-1">{shape}</div>
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  const renderCanvas = () => {
    if (!currentChallenge) return null;
    const shapes = currentChallenge.type === 'free-create' ? freeCreateShapes : placedShapes;

    return (
      <svg ref={canvasRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="w-full rounded-xl border border-white/10 bg-slate-800/50"
        style={{ maxHeight: 350 }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}>
        {/* Grid dots for guidance */}
        {Array.from({ length: 9 }, (_, row) =>
          Array.from({ length: 11 }, (_, col) => (
            <circle key={`dot-${row}-${col}`}
              cx={20 + col * (CANVAS_WIDTH - 40) / 10}
              cy={20 + row * (CANVAS_HEIGHT - 40) / 8}
              r={1.5} fill="rgba(255,255,255,0.08)" />
          ))
        )}

        {/* Target silhouette for compose-match */}
        {currentChallenge.type === 'compose-match' && currentChallenge.targetOutlinePath && (
          <path d={currentChallenge.targetOutlinePath}
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeDasharray="8 4" />
        )}

        {/* Picture slots for compose-picture */}
        {currentChallenge.type === 'compose-picture' && currentChallenge.pictureSlots?.map(slot => (
          <g key={slot.id} transform={`translate(${slot.x}, ${slot.y}) rotate(${slot.rotation}, ${slot.width / 2}, ${slot.height / 2})`}>
            {slot.shape === 'circle' ? (
              <ellipse cx={slot.width / 2} cy={slot.height / 2} rx={slot.width / 2} ry={slot.height / 2}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />
            ) : (
              <path d={getShapePath(slot.shape, slot.width, slot.height)}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />
            )}
          </g>
        ))}

        {/* Decompose: show the composite shape */}
        {currentChallenge.type === 'decompose' && currentChallenge.compositeShapePath && (
          <path d={currentChallenge.compositeShapePath}
            fill="rgba(139,92,246,0.3)" stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
        )}

        {/* Division line hints for decompose */}
        {currentChallenge.type === 'decompose' && currentChallenge.divisionLineHints?.map((line, i) => (
          <line key={`div-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Placed shapes */}
        {shapes.map(s => (
          <ShapeSVG key={s.id} shape={s.shape} color={s.color}
            width={s.width} height={s.height} rotation={s.rotation}
            x={s.x} y={s.y}
            strokeColor={selectedShapeId === s.id ? '#FCD34D' : 'rgba(255,255,255,0.3)'}
            strokeWidth={selectedShapeId === s.id ? 2.5 : 1.5}
            onMouseDown={(e) => handleShapeMouseDown(s.id, e)} />
        ))}
      </svg>
    );
  };

  const renderDecomposeButtons = () => {
    if (!currentChallenge || currentChallenge.type !== 'decompose') return null;
    const expected = currentChallenge.expectedComponents ?? [];
    const shapes = Array.from(new Set(expected.map(c => c.shape)));
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Tap to identify shapes you see:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {shapes.map(shape => {
            const count = decomposeTaps.filter(t => t === shape).length;
            const expectedCount = expected.find(c => c.shape === shape)?.count ?? 0;
            return (
              <button key={shape}
                className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  count >= expectedCount
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => handleDecomposeTap(shape)}>
                <svg width={24} height={24} viewBox="0 0 50 50">
                  <ShapeSVG shape={shape} color={SHAPE_COLORS[shape] || '#8B5CF6'} width={50} height={50} />
                </svg>
                <span className="text-sm">{shape}</span>
                {count > 0 && <Badge variant="secondary" className="bg-white/10 text-xs">{count}</Badge>}
              </button>
            );
          })}
        </div>
        {decomposeTaps.length > 0 && (
          <Button variant="ghost" size="sm"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs"
            onClick={() => setDecomposeTaps([])}>
            Reset Selections
          </Button>
        )}
      </div>
    );
  };

  const renderHowManyWays = () => {
    if (!currentChallenge || currentChallenge.type !== 'how-many-ways') return null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          Build <span className="text-slate-200 font-medium">{currentChallenge.targetForComposition}</span> using the shapes below.
          How many pieces do you need?
        </p>
        <div className="flex items-center gap-3 justify-center">
          <input
            type="number"
            min={1}
            max={20}
            value={howManyAnswer}
            onChange={(e) => setHowManyAnswer(e.target.value)}
            className="w-16 px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-slate-100 text-center text-lg"
            placeholder="?"
          />
          <span className="text-slate-400 text-sm">pieces</span>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardHeader><CardTitle className="text-slate-100">{title}</CardTitle></CardHeader>
        <CardContent><p className="text-slate-400">No challenges available.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {!allChallengesComplete && (
              <Badge variant="secondary" className="bg-white/10 text-slate-300">
                {currentChallengeIndex + 1} / {challenges.length}
              </Badge>
            )}
            {isConnected && (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-xs">
                AI Tutor
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)}
            durationMs={elapsedMs}
            heading="Shape Composer Complete!"
            celebrationMessage="You composed and decomposed shapes like a pro!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Instruction */}
            <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon ?? '🧩'}</span>
                <span className="text-sm font-medium text-slate-300">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label ?? currentChallenge.type}
                </span>
              </div>
              <p className="text-slate-100">{currentChallenge.instruction}</p>
            </div>

            {/* Canvas */}
            {(currentChallenge.type !== 'decompose' || currentChallenge.compositeShapePath) && (
              <div className="relative">
                {renderCanvas()}
                {/* Shape controls */}
                {selectedShapeId && !showingCorrectFeedback && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button variant="ghost" size="sm"
                      className="bg-slate-900/80 border border-white/20 hover:bg-white/10 text-xs h-7 px-2"
                      onClick={() => rotateSelected(rotationSnap)}>
                      ↻ {rotationSnap}°
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="bg-slate-900/80 border border-white/20 hover:bg-red-500/20 text-xs h-7 px-2"
                      onClick={removeSelected}>
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Palette */}
            {!showingCorrectFeedback && currentChallenge.type !== 'decompose' && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-slate-500 mb-2">Shape Palette — click to add</p>
                {renderPalette()}
              </div>
            )}

            {/* Decompose buttons */}
            {currentChallenge.type === 'decompose' && !showingCorrectFeedback && renderDecomposeButtons()}

            {/* How Many Ways input */}
            {currentChallenge.type === 'how-many-ways' && !showingCorrectFeedback && renderHowManyWays()}

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                feedbackType === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                feedbackType === 'error' ? 'bg-red-500/20 text-red-300 border border-red-400/30' :
                'bg-blue-500/20 text-blue-300 border border-blue-400/30'
              }`}>
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-end">
              {showingCorrectFeedback ? (
                <Button variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10"
                  onClick={advanceToNextChallenge}>
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'See Results →'}
                </Button>
              ) : (
                <Button variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10"
                  onClick={handleCheckAnswer}>
                  Check Answer
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ShapeComposer;
