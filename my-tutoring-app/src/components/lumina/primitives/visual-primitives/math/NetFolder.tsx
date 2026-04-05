'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NetFolderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type SolidType =
  | 'cube'
  | 'rectangular_prism'
  | 'triangular_prism'
  | 'square_pyramid'
  | 'triangular_pyramid'
  | 'cylinder'
  | 'cone';

export type NetLayout = 'cross' | 't_shape' | 'l_shape' | 'strip' | 'custom';

export interface NetFolderSolid {
  type: SolidType;
  name: string;
  dimensions: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
    radius?: number | null;
  };
  faces: number;
  edges: number;
  vertices: number;
}

export interface NetFolderAlternativeNet {
  layout: string;
  valid: boolean;
  explanation: string;
}

export interface NetFolderChallenge {
  id: string;
  type: 'identify_solid' | 'match_faces' | 'valid_net' | 'surface_area' | 'count_faces_edges_vertices';
  instruction: string;
  targetAnswer: string | number;
  hint: string;
  narration: string;
  // identify_solid
  options?: string[];
  // match_faces
  highlightedFace?: string;
  faceOptions?: string[];
  // valid_net
  netLayout?: string;
  isValidNet?: boolean;
  netExplanation?: string;
  // surface_area
  faceDimensions?: Array<{ width: number; height: number }>;
  unitLabel?: string;
}

export interface NetFolderData {
  title: string;
  description?: string;
  solid: NetFolderSolid;
  net: {
    layout: NetLayout;
    faceLabels: string[];
    gridOverlay: boolean;
  };
  challenges: NetFolderChallenge[];
  alternativeNets?: NetFolderAlternativeNet[];
  showOptions?: {
    showDimensions?: boolean;
    showFaceLabels?: boolean;
    showGridOverlay?: boolean;
    showFaceCorrespondence?: boolean;
    allowRotation?: boolean;
    animationSpeed?: number;
  };
  imagePrompt?: string | null;
  gradeBand?: '3-4' | '4-5';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NetFolderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify_solid: { label: 'Identify', icon: '🔍', accentColor: 'blue' },
  count_faces_edges_vertices: { label: 'Count', icon: '🔢', accentColor: 'orange' },
  match_faces: { label: 'Match', icon: '🎯', accentColor: 'purple' },
  valid_net: { label: 'Valid Net', icon: '✓', accentColor: 'emerald' },
  surface_area: { label: 'Area', icon: '📐', accentColor: 'amber' },
};

// Face colors for 3D rendering
const FACE_COLORS = [
  'rgba(99, 102, 241, 0.7)',   // indigo
  'rgba(236, 72, 153, 0.7)',   // pink
  'rgba(34, 197, 94, 0.7)',    // green
  'rgba(251, 146, 60, 0.7)',   // orange
  'rgba(59, 130, 246, 0.7)',   // blue
  'rgba(168, 85, 247, 0.7)',   // purple
];

const FACE_BORDERS = [
  'rgba(99, 102, 241, 0.9)',
  'rgba(236, 72, 153, 0.9)',
  'rgba(34, 197, 94, 0.9)',
  'rgba(251, 146, 60, 0.9)',
  'rgba(59, 130, 246, 0.9)',
  'rgba(168, 85, 247, 0.9)',
];

// 3D solid face definitions (CSS transform-based)
interface FaceDef {
  label: string;
  transform: string;
  width: number;
  height: number;
}

function getCubeFaces(size: number): FaceDef[] {
  const h = size / 2;
  return [
    { label: 'front',  transform: `translateZ(${h}px)`, width: size, height: size },
    { label: 'back',   transform: `rotateY(180deg) translateZ(${h}px)`, width: size, height: size },
    { label: 'right',  transform: `rotateY(90deg) translateZ(${h}px)`, width: size, height: size },
    { label: 'left',   transform: `rotateY(-90deg) translateZ(${h}px)`, width: size, height: size },
    { label: 'top',    transform: `rotateX(90deg) translateZ(${h}px)`, width: size, height: size },
    { label: 'bottom', transform: `rotateX(-90deg) translateZ(${h}px)`, width: size, height: size },
  ];
}

function getRectPrismFaces(l: number, w: number, h: number): FaceDef[] {
  const hl = l / 2, hw = w / 2, hh = h / 2;
  return [
    { label: 'front',  transform: `translateZ(${hw}px)`, width: l, height: h },
    { label: 'back',   transform: `rotateY(180deg) translateZ(${hw}px)`, width: l, height: h },
    { label: 'right',  transform: `rotateY(90deg) translateZ(${hl}px)`, width: w, height: h },
    { label: 'left',   transform: `rotateY(-90deg) translateZ(${hl}px)`, width: w, height: h },
    { label: 'top',    transform: `rotateX(90deg) translateZ(${hh}px)`, width: l, height: w },
    { label: 'bottom', transform: `rotateX(-90deg) translateZ(${hh}px)`, width: l, height: w },
  ];
}

function getSquarePyramidFaces(base: number, height: number): FaceDef[] {
  const hb = base / 2;
  const slant = Math.sqrt(height * height + hb * hb);
  const angle = Math.atan2(height, hb) * (180 / Math.PI);
  return [
    { label: 'base', transform: `rotateX(-90deg) translateZ(${0}px)`, width: base, height: base },
    { label: 'front', transform: `translateZ(${hb}px) rotateX(${90 - angle}deg)`, width: base, height: slant },
    { label: 'back', transform: `rotateY(180deg) translateZ(${hb}px) rotateX(${90 - angle}deg)`, width: base, height: slant },
    { label: 'right', transform: `rotateY(90deg) translateZ(${hb}px) rotateX(${90 - angle}deg)`, width: base, height: slant },
    { label: 'left', transform: `rotateY(-90deg) translateZ(${hb}px) rotateX(${90 - angle}deg)`, width: base, height: slant },
  ];
}

function getSolidFaces(solid: NetFolderSolid): FaceDef[] {
  const s = 100; // default size
  switch (solid.type) {
    case 'cube':
      return getCubeFaces(solid.dimensions.length ?? s);
    case 'rectangular_prism':
      return getRectPrismFaces(
        solid.dimensions.length ?? s,
        solid.dimensions.width ?? s * 0.7,
        solid.dimensions.height ?? s * 0.5,
      );
    case 'square_pyramid':
      return getSquarePyramidFaces(
        solid.dimensions.length ?? s,
        solid.dimensions.height ?? s * 0.8,
      );
    default:
      return getCubeFaces(s);
  }
}

// Net layout positions — where each face goes when unfolded flat
interface NetFacePos {
  label: string;
  gridRow: number;
  gridCol: number;
  width: number;
  height: number;
}

function getCubeNetPositions(layout: NetLayout, size: number): NetFacePos[] {
  switch (layout) {
    case 'cross':
      return [
        { label: 'top',    gridRow: 0, gridCol: 1, width: size, height: size },
        { label: 'left',   gridRow: 1, gridCol: 0, width: size, height: size },
        { label: 'front',  gridRow: 1, gridCol: 1, width: size, height: size },
        { label: 'right',  gridRow: 1, gridCol: 2, width: size, height: size },
        { label: 'back',   gridRow: 1, gridCol: 3, width: size, height: size },
        { label: 'bottom', gridRow: 2, gridCol: 1, width: size, height: size },
      ];
    case 't_shape':
      return [
        { label: 'left',   gridRow: 0, gridCol: 0, width: size, height: size },
        { label: 'front',  gridRow: 0, gridCol: 1, width: size, height: size },
        { label: 'right',  gridRow: 0, gridCol: 2, width: size, height: size },
        { label: 'top',    gridRow: 1, gridCol: 1, width: size, height: size },
        { label: 'bottom', gridRow: 2, gridCol: 1, width: size, height: size },
        { label: 'back',   gridRow: 3, gridCol: 1, width: size, height: size },
      ];
    case 'l_shape':
      return [
        { label: 'front',  gridRow: 0, gridCol: 0, width: size, height: size },
        { label: 'right',  gridRow: 1, gridCol: 0, width: size, height: size },
        { label: 'back',   gridRow: 2, gridCol: 0, width: size, height: size },
        { label: 'left',   gridRow: 3, gridCol: 0, width: size, height: size },
        { label: 'top',    gridRow: 0, gridCol: 1, width: size, height: size },
        { label: 'bottom', gridRow: 3, gridCol: 1, width: size, height: size },
      ];
    default:
      return getCubeNetPositions('cross', size);
  }
}

function getRectPrismNetPositions(layout: NetLayout, l: number, w: number, h: number): NetFacePos[] {
  // Cross layout for rectangular prism
  return [
    { label: 'top',    gridRow: 0, gridCol: 1, width: l, height: w },
    { label: 'left',   gridRow: 1, gridCol: 0, width: w, height: h },
    { label: 'front',  gridRow: 1, gridCol: 1, width: l, height: h },
    { label: 'right',  gridRow: 1, gridCol: 2, width: w, height: h },
    { label: 'back',   gridRow: 1, gridCol: 3, width: l, height: h },
    { label: 'bottom', gridRow: 2, gridCol: 1, width: l, height: w },
  ];
}

function getNetPositions(solid: NetFolderSolid, layout: NetLayout): NetFacePos[] {
  const s = 60;
  switch (solid.type) {
    case 'cube':
      return getCubeNetPositions(layout, s);
    case 'rectangular_prism':
      return getRectPrismNetPositions(
        layout,
        solid.dimensions.length ? Math.min(solid.dimensions.length, 80) : s,
        solid.dimensions.width ? Math.min(solid.dimensions.width, 60) : s * 0.7,
        solid.dimensions.height ? Math.min(solid.dimensions.height, 50) : s * 0.5,
      );
    case 'square_pyramid':
      return getCubeNetPositions(layout, s).slice(0, solid.faces);
    default:
      return getCubeNetPositions(layout, s);
  }
}

// ============================================================================
// Sub-components
// ============================================================================

// 3D Solid Viewer with CSS transforms
const SolidViewer: React.FC<{
  solid: NetFolderSolid;
  rotation: { x: number; y: number };
  highlightedFace: string | null;
  onFaceClick?: (label: string) => void;
  showLabels: boolean;
  allowRotation: boolean;
  onRotate?: (delta: { x: number; y: number }) => void;
}> = ({ solid, rotation, highlightedFace, onFaceClick, showLabels, allowRotation, onRotate }) => {
  const faces = useMemo(() => getSolidFaces(solid), [solid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!allowRotation) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [allowRotation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !onRotate) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    onRotate({ x: -dy * 0.5, y: dx * 0.5 });
  }, [onRotate]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{ width: 220, height: 220, perspective: '600px' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: isDragging.current ? 'none' : 'transform 0.3s ease',
        }}
      >
        {faces.map((face, i) => (
          <div
            key={face.label}
            onClick={() => onFaceClick?.(face.label)}
            className={`absolute flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
              onFaceClick ? 'cursor-pointer hover:brightness-125' : ''
            } ${highlightedFace === face.label ? 'ring-4 ring-yellow-400 brightness-150 z-10' : ''}`}
            style={{
              width: face.width,
              height: face.height,
              transform: face.transform,
              backfaceVisibility: 'hidden',
              backgroundColor: FACE_COLORS[i % FACE_COLORS.length],
              borderColor: FACE_BORDERS[i % FACE_BORDERS.length],
            }}
          >
            {showLabels && (
              <span className="text-white drop-shadow-lg text-[10px]">{face.label}</span>
            )}
          </div>
        ))}
      </div>
      {allowRotation && (
        <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-slate-500">
          Drag to rotate
        </div>
      )}
    </div>
  );
};

// 2D Net Display
const NetDisplay: React.FC<{
  solid: NetFolderSolid;
  layout: NetLayout;
  faceLabels: string[];
  showLabels: boolean;
  showGrid: boolean;
  highlightedFace: string | null;
  onFaceClick?: (label: string) => void;
}> = ({ solid, layout, faceLabels, showLabels, showGrid, highlightedFace, onFaceClick }) => {
  const positions = useMemo(() => getNetPositions(solid, layout), [solid, layout]);

  // Calculate grid bounds
  const maxRow = Math.max(...positions.map(p => p.gridRow)) + 1;
  const maxCol = Math.max(...positions.map(p => p.gridCol)) + 1;
  const cellSize = 62;
  const gap = 2;

  return (
    <div
      className="relative mx-auto"
      style={{
        width: maxCol * (cellSize + gap),
        height: maxRow * (cellSize + gap),
      }}
    >
      {positions.map((pos, i) => {
        const faceLabel = faceLabels[i] || pos.label;
        const isHighlighted = highlightedFace === pos.label || highlightedFace === faceLabel;

        return (
          <div
            key={pos.label}
            onClick={() => onFaceClick?.(pos.label)}
            className={`absolute flex items-center justify-center border-2 transition-all duration-300 ${
              onFaceClick ? 'cursor-pointer hover:brightness-125' : ''
            } ${isHighlighted ? 'ring-4 ring-yellow-400 brightness-150 z-10' : ''}`}
            style={{
              left: pos.gridCol * (cellSize + gap),
              top: pos.gridRow * (cellSize + gap),
              width: cellSize,
              height: cellSize,
              backgroundColor: FACE_COLORS[i % FACE_COLORS.length],
              borderColor: FACE_BORDERS[i % FACE_BORDERS.length],
            }}
          >
            {showGrid && (
              <div className="absolute inset-0 opacity-30">
                {Array.from({ length: 5 }).map((_, gi) => (
                  <div key={`h${gi}`} className="absolute w-full border-t border-white/40" style={{ top: `${(gi + 1) * (100 / 6)}%` }} />
                ))}
                {Array.from({ length: 5 }).map((_, gi) => (
                  <div key={`v${gi}`} className="absolute h-full border-l border-white/40" style={{ left: `${(gi + 1) * (100 / 6)}%` }} />
                ))}
              </div>
            )}
            {showLabels && (
              <span className="text-white drop-shadow-lg text-xs font-bold z-10">{faceLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface NetFolderProps {
  data: NetFolderData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const NetFolder: React.FC<NetFolderProps> = ({ data, className }) => {
  const {
    title,
    description,
    solid,
    net,
    challenges = [],
    alternativeNets = [],
    showOptions = {},
    gradeBand = '3-4',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showDimensions = true,
    showFaceLabels = true,
    showGridOverlay = false,
    showFaceCorrespondence = true,
    allowRotation = true,
    animationSpeed = 1,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [isFolded, setIsFolded] = useState(true);
  const [highlightedFace, setHighlightedFace] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // FEV input fields
  const [facesInput, setFacesInput] = useState('');
  const [edgesInput, setEdgesInput] = useState('');
  const [verticesInput, setVerticesInput] = useState('');

  // Challenge progress
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

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `net-folder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NetFolderMetrics>({
    primitiveType: 'net-folder',
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
    solidType: solid.type,
    solidName: solid.name,
    faces: solid.faces,
    edges: solid.edges,
    vertices: solid.vertices,
    netLayout: net.layout,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'identify_solid',
    instruction: currentChallenge?.instruction ?? '',
    attemptNumber: currentAttempts + 1,
    isFolded,
  }), [
    solid, net.layout, gradeBand, challenges.length,
    currentChallengeIndex, currentChallenge, currentAttempts, isFolded,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'net-folder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '3-4' ? 'Grade 3-4' : 'Grade 4-5',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a 3D shapes activity about ${solid.name} (${solid.type}). `
      + `The student will explore this solid, its net, and answer ${challenges.length} challenges. `
      + `Grade band: ${gradeBand}. `
      + `Introduce warmly: "Today we're going to explore a ${solid.name}! Let's discover its faces, edges, and how it unfolds."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, solid, gradeBand, sendText]);

  // -------------------------------------------------------------------------
  // Rotation handler
  // -------------------------------------------------------------------------
  const handleRotate = useCallback((delta: { x: number; y: number }) => {
    setRotation(prev => ({
      x: Math.max(-90, Math.min(90, prev.x + delta.x)),
      y: prev.y + delta.y,
    }));
  }, []);

  // Face click for correspondence
  const handleFaceClick = useCallback((label: string) => {
    if (!showFaceCorrespondence) return;
    setHighlightedFace(prev => prev === label ? null : label);
  }, [showFaceCorrespondence]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkIdentifySolid = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const correct = selectedAnswer.toLowerCase() === String(currentChallenge.targetAnswer).toLowerCase();
    incrementAttempts();

    if (correct) {
      setFeedback(`Correct! This is a ${solid.name}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly identified the solid as "${selectedAnswer}". `
        + `Congratulate: "Great job recognizing the ${solid.name}!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Look at the shape carefully and try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.targetAnswer}". `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedAnswer, solid.name, sendText, incrementAttempts]);

  const checkMatchFaces = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const correct = selectedAnswer.toLowerCase() === String(currentChallenge.targetAnswer).toLowerCase();
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! The highlighted face on the net corresponds to the ${currentChallenge.targetAnswer} of the solid.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly matched the face: "${selectedAnswer}". `
        + `Celebrate spatial reasoning!`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Try folding the net in your mind to find where this face goes.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct face is "${currentChallenge.targetAnswer}". `
        + `Give a spatial hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedAnswer, sendText, incrementAttempts]);

  const checkValidNet = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const studentSaysValid = selectedAnswer === 'valid';
    const correct = studentSaysValid === currentChallenge.isValidNet;
    incrementAttempts();

    if (correct) {
      const explanation = currentChallenge.netExplanation || '';
      setFeedback(correct && currentChallenge.isValidNet
        ? `Correct! This net folds into a valid solid. ${explanation}`
        : `Correct! This net does NOT fold into a valid solid. ${explanation}`
      );
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly identified the net as ${currentChallenge.isValidNet ? 'valid' : 'invalid'}. `
        + `Explanation: ${explanation}`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Try imagining folding the net up — do all the faces connect properly?`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student said the net is ${studentSaysValid ? 'valid' : 'invalid'} `
        + `but it's actually ${currentChallenge.isValidNet ? 'valid' : 'invalid'}. `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedAnswer, sendText, incrementAttempts]);

  const checkSurfaceArea = useCallback(() => {
    if (!currentChallenge) return false;
    const answer = parseInt(numericInput, 10);
    const target = Number(currentChallenge.targetAnswer);
    const correct = answer === target;
    incrementAttempts();

    if (correct) {
      setFeedback(`Correct! The surface area is ${target} ${currentChallenge.unitLabel || 'square units'}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student calculated surface area as ${answer}, which is correct! `
        + `Celebrate: "You added up all the face areas perfectly!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Count the unit squares on each face of the net and add them all up.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer} but surface area is ${target}. `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, numericInput, sendText, incrementAttempts]);

  const checkCountFEV = useCallback(() => {
    if (!currentChallenge) return false;
    const f = parseInt(facesInput, 10);
    const e = parseInt(edgesInput, 10);
    const v = parseInt(verticesInput, 10);
    const correctF = f === solid.faces;
    const correctE = e === solid.edges;
    const correctV = v === solid.vertices;
    const allCorrect = correctF && correctE && correctV;
    incrementAttempts();

    if (allCorrect) {
      setFeedback(`Correct! ${solid.name} has ${solid.faces} faces, ${solid.edges} edges, and ${solid.vertices} vertices.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly counted: ${solid.faces} faces, ${solid.edges} edges, ${solid.vertices} vertices. `
        + `Celebrate and mention Euler's formula if grade 4-5.`,
        { silent: true }
      );
    } else {
      const parts: string[] = [];
      if (!correctF) parts.push(`faces (you said ${f}, it's ${solid.faces})`);
      if (!correctE) parts.push(`edges (you said ${e}, it's ${solid.edges})`);
      if (!correctV) parts.push(`vertices (you said ${v}, it's ${solid.vertices})`);
      setFeedback(`Not quite. Check your count for: ${parts.join(', ')}.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student counts: F=${f} E=${e} V=${v}. Correct: F=${solid.faces} E=${solid.edges} V=${solid.vertices}. `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
    return allCorrect;
  }, [currentChallenge, facesInput, edgesInput, verticesInput, solid, sendText, incrementAttempts]);

  // -------------------------------------------------------------------------
  // Main check handler
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'identify_solid':
        correct = checkIdentifySolid();
        break;
      case 'match_faces':
        correct = checkMatchFaces();
        break;
      case 'valid_net':
        correct = checkValidNet();
        break;
      case 'surface_area':
        correct = checkSurfaceArea();
        break;
      case 'count_faces_edges_vertices':
        correct = checkCountFEV();
        break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, currentAttempts,
    checkIdentifySolid, checkMatchFaces, checkValidNet, checkSurfaceArea, checkCountFEV,
    recordResult,
  ]);

  // -------------------------------------------------------------------------
  // Advance
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their 3D shape understanding!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correct = challengeResults.filter(r => r.correct).length;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const score = Math.round((correct / challenges.length) * 100);

        // Count by type
        const byType = (type: string) => {
          const ofType = challengeResults.filter(r => {
            const ch = challenges.find(c => c.id === r.challengeId);
            return ch?.type === type;
          });
          return {
            correct: ofType.filter(r => r.correct).length,
            total: ofType.length,
          };
        };

        const idResult = byType('identify_solid');
        const matchResult = byType('match_faces');
        const validResult = byType('valid_net');
        const areaResult = byType('surface_area');
        const fevResult = byType('count_faces_edges_vertices');

        const metrics: NetFolderMetrics = {
          type: 'net-folder',
          evalMode: challenges[0]?.type ?? 'default',
          solidsIdentified: idResult.correct,
          solidsTotal: idResult.total,
          facesMatchedCorrectly: matchResult.correct,
          facesTotal: matchResult.total,
          validNetsIdentified: validResult.correct,
          netsTotal: validResult.total,
          surfaceAreaCorrect: areaResult.correct,
          surfaceAreaTotal: areaResult.total,
          facesEdgesVerticesCounted: fevResult.correct === fevResult.total && fevResult.total > 0,
          totalAttempts,
          accuracy: score,
        };

        submitEvaluation(
          correct === challenges.length,
          score,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset for next challenge
    setFeedback('');
    setFeedbackType('');
    setSelectedAnswer(null);
    setNumericInput('');
    setFacesInput('');
    setEdgesInput('');
    setVerticesInput('');
    setHighlightedFace(null);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${nextChallenge.type}. Instruction: "${nextChallenge.instruction}". `
        + `Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, currentChallengeIndex,
    hasSubmittedEvaluation, sendText, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Check if answer is ready
  // -------------------------------------------------------------------------
  const canCheck = useMemo(() => {
    if (!currentChallenge) return false;
    switch (currentChallenge.type) {
      case 'identify_solid':
      case 'match_faces':
      case 'valid_net':
        return selectedAnswer !== null;
      case 'surface_area':
        return numericInput.trim() !== '';
      case 'count_faces_edges_vertices':
        return facesInput.trim() !== '' && edgesInput.trim() !== '' && verticesInput.trim() !== '';
      default:
        return false;
    }
  }, [currentChallenge, selectedAnswer, numericInput, facesInput, edgesInput, verticesInput]);

  const lastResult = challengeResults[challengeResults.length - 1];
  const showNextButton = lastResult && lastResult.correct && lastResult.challengeId === currentChallenge?.id;

  // -------------------------------------------------------------------------
  // Render challenge UI
  // -------------------------------------------------------------------------
  const renderChallengeInput = () => {
    if (!currentChallenge) return null;

    switch (currentChallenge.type) {
      case 'identify_solid':
        return (
          <div className="flex flex-wrap gap-2">
            {(currentChallenge.options || []).map(opt => (
              <Button
                key={opt}
                variant="ghost"
                onClick={() => setSelectedAnswer(opt)}
                className={`border transition-all ${
                  selectedAnswer === opt
                    ? 'bg-indigo-600/40 border-indigo-400 text-white'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                }`}
              >
                {opt}
              </Button>
            ))}
          </div>
        );

      case 'match_faces':
        return (
          <div className="space-y-3">
            {currentChallenge.highlightedFace && (
              <p className="text-sm text-slate-400">
                The highlighted face on the net is shown in yellow. Which face is it on the solid?
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(currentChallenge.faceOptions || net.faceLabels || []).map(opt => (
                <Button
                  key={opt}
                  variant="ghost"
                  onClick={() => setSelectedAnswer(opt)}
                  className={`border transition-all ${
                    selectedAnswer === opt
                      ? 'bg-indigo-600/40 border-indigo-400 text-white'
                      : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
                  }`}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'valid_net':
        return (
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setSelectedAnswer('valid')}
              className={`border transition-all flex-1 ${
                selectedAnswer === 'valid'
                  ? 'bg-emerald-600/40 border-emerald-400 text-white'
                  : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
              }`}
            >
              Valid Net ✓
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSelectedAnswer('invalid')}
              className={`border transition-all flex-1 ${
                selectedAnswer === 'invalid'
                  ? 'bg-red-600/40 border-red-400 text-white'
                  : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
              }`}
            >
              Invalid Net ✗
            </Button>
          </div>
        );

      case 'surface_area':
        return (
          <div className="space-y-3">
            {currentChallenge.faceDimensions && (
              <div className="flex flex-wrap gap-2">
                {currentChallenge.faceDimensions.map((fd, i) => (
                  <Badge key={i} variant="outline" className="text-slate-300 border-white/20">
                    Face {i + 1}: {fd.width} × {fd.height} = {fd.width * fd.height}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={numericInput}
                onChange={e => setNumericInput(e.target.value)}
                placeholder="Total surface area"
                className="bg-white/5 border border-white/20 rounded-md px-3 py-2 text-slate-100 w-40 focus:outline-none focus:border-indigo-400"
              />
              <span className="text-slate-400 text-sm">{currentChallenge.unitLabel || 'square units'}</span>
            </div>
          </div>
        );

      case 'count_faces_edges_vertices':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Faces</label>
              <input
                type="number"
                value={facesInput}
                onChange={e => setFacesInput(e.target.value)}
                className="bg-white/5 border border-white/20 rounded-md px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Edges</label>
              <input
                type="number"
                value={edgesInput}
                onChange={e => setEdgesInput(e.target.value)}
                className="bg-white/5 border border-white/20 rounded-md px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Vertices</label>
              <input
                type="number"
                value={verticesInput}
                onChange={e => setVerticesInput(e.target.value)}
                className="bg-white/5 border border-white/20 rounded-md px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
            {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {challenges.length > 0 && (
              <Badge variant="outline" className="text-slate-300 border-white/20">
                {currentChallengeIndex + 1} / {challenges.length}
              </Badge>
            )}
            <Badge variant="outline" className="text-slate-300 border-white/20">
              {solid.name}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Solid info */}
        {showDimensions && (
          <div className="flex flex-wrap gap-2">
            {solid.dimensions.length != null && (
              <Badge variant="outline" className="text-slate-400 border-white/10">L: {solid.dimensions.length}</Badge>
            )}
            {solid.dimensions.width != null && (
              <Badge variant="outline" className="text-slate-400 border-white/10">W: {solid.dimensions.width}</Badge>
            )}
            {solid.dimensions.height != null && (
              <Badge variant="outline" className="text-slate-400 border-white/10">H: {solid.dimensions.height}</Badge>
            )}
            {solid.dimensions.radius != null && (
              <Badge variant="outline" className="text-slate-400 border-white/10">R: {solid.dimensions.radius}</Badge>
            )}
          </div>
        )}

        {/* 3D Solid + Net side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 3D View */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
            <div className="text-xs text-slate-400 text-center mb-2 font-medium">3D Solid</div>
            <SolidViewer
              solid={solid}
              rotation={rotation}
              highlightedFace={highlightedFace}
              onFaceClick={showFaceCorrespondence ? handleFaceClick : undefined}
              showLabels={showFaceLabels}
              allowRotation={allowRotation}
              onRotate={handleRotate}
            />
          </div>

          {/* Net View */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">2D Net</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFolded(prev => !prev)}
                className="text-xs bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 h-6 px-2"
              >
                {isFolded ? 'Unfold' : 'Fold'}
              </Button>
            </div>
            <div
              className="transition-all"
              style={{ transitionDuration: `${animationSpeed * 500}ms` }}
            >
              {isFolded ? (
                <SolidViewer
                  solid={solid}
                  rotation={{ x: -25, y: 35 }}
                  highlightedFace={highlightedFace}
                  onFaceClick={showFaceCorrespondence ? handleFaceClick : undefined}
                  showLabels={showFaceLabels}
                  allowRotation={false}
                />
              ) : (
                <NetDisplay
                  solid={solid}
                  layout={net.layout}
                  faceLabels={net.faceLabels}
                  showLabels={showFaceLabels}
                  showGrid={showGridOverlay}
                  highlightedFace={highlightedFace}
                  onFaceClick={showFaceCorrespondence ? handleFaceClick : undefined}
                />
              )}
            </div>
          </div>
        </div>

        {/* Challenge area */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-400/30">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            </div>
            <p className="text-slate-200 font-medium">{currentChallenge.instruction}</p>

            {renderChallengeInput()}

            {/* Feedback */}
            {feedback && (
              <div
                className={`rounded-md p-3 text-sm ${
                  feedbackType === 'success'
                    ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-300'
                    : feedbackType === 'error'
                    ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                    : 'bg-blue-900/30 border border-blue-500/30 text-blue-300'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!showNextButton && (
                <Button
                  variant="ghost"
                  onClick={handleCheckAnswer}
                  disabled={!canCheck || hasSubmittedEvaluation}
                  className="bg-indigo-600/20 border border-indigo-400/30 hover:bg-indigo-600/40 text-indigo-200 disabled:opacity-40"
                >
                  Check Answer
                </Button>
              )}
              {showNextButton && (
                <Button
                  variant="ghost"
                  onClick={advanceToNextChallenge}
                  className="bg-emerald-600/20 border border-emerald-400/30 hover:bg-emerald-600/40 text-emerald-200"
                >
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish!'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You explored the ${solid.name} and completed all challenges!`}
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NetFolder;
