'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import { buildCheck, describeShapeWork, makeShapeMiss, workspaceAssignment, workspaceScene, type ShapeView } from './shapeBuilderWorkspace';
import { CORNER_MARKS_LEVER, EQUAL_TICKS_LEVER, FEWER_LEVER, FOLD_LINES_LEVER, PARALLEL_MARKS_LEVER, SIDE_TAGS_LEVER,
  fewerShape, leverFacts, shapeBuilderLevers } from './shapeBuilderLevers';
import { SHAPE_WATCH_NEVER_SAY, shapeMarks, tapDot, type ShapeBuild } from './shapeMakeBuild';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface Point {
  x: number;
  y: number;
}

export interface ShapeBuilderChallenge {
  id: string;
  /** `make_shape` is the open build: an empty grid, any shape with the code-written `targetProperties` passes. */
  type: 'build' | 'measure' | 'classify' | 'classify_by_lines' | 'compose' | 'find_symmetry' | 'coordinate_shape' | 'make_shape';
  instruction: string;
  targetProperties?: {
    sides?: number;
    rightAngles?: number;
    parallelPairs?: number;
    equalSides?: 'all' | 'pairs' | 'none';
    linesOfSymmetry?: number;
  } | null;
  hint: string;
  narration: string;
  /** Support-tier construction scaffolds (set by the generator from
   *  config.difficulty). Display-only — the geometry checker never reads them. */
  showTargetGhost?: boolean;
  showSideCountBadge?: boolean;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface PreloadedShape {
  id: string;
  vertices: Point[];
  name: string;
  locked: boolean;
  correctCategory?: string;
}

export interface ShapeBuilderData {
  title: string;
  description?: string;
  mode: 'build' | 'discover' | 'classify' | 'compose' | 'decompose' | 'symmetry';
  grid: {
    type: 'dot' | 'coordinate' | 'none';
    size: { rows: number; columns: number };
    showCoordinates: boolean;
  };
  targetShape?: {
    name: string | null;
    properties: {
      sides: number;
      rightAngles?: number | null;
      parallelPairs?: number | null;
      equalSides?: 'all' | 'pairs' | 'none' | null;
      linesOfSymmetry?: number | null;
    };
  } | null;
  preloadedShapes?: PreloadedShape[];
  challenges: ShapeBuilderChallenge[];
  tools: {
    ruler: boolean;
    protractor: boolean;
    symmetryLine: boolean;
    parallelMarker: boolean;
  };
  classificationCategories?: string[];
  patternBlocks?: {
    enabled: boolean;
    availableShapes: string[];
  };
  imagePrompt?: string | null;
  gradeBand?: 'K-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CELL_SIZE = 40;
const GRID_PADDING = 20;
const DOT_RADIUS = 3;
const VERTEX_RADIUS = 8;
const SNAP_DISTANCE = 15;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build:             { label: 'Build',        icon: '🔨', accentColor: 'purple' },
  measure:           { label: 'Measure',      icon: '📏', accentColor: 'blue' },
  classify:          { label: 'Classify',     icon: '📋', accentColor: 'emerald' },
  classify_by_lines: { label: 'Lines',        icon: '📐', accentColor: 'orange' },
  compose:           { label: 'Compose',      icon: '🧩', accentColor: 'cyan' },
  find_symmetry:     { label: 'Symmetry',     icon: '🪞', accentColor: 'pink' },
  coordinate_shape:  { label: 'Coordinates',  icon: '📐', accentColor: 'amber' },
  make_shape:        { label: 'Make a Shape', icon: '✏️', accentColor: 'cyan' },
};

// ============================================================================
// Geometry Helpers
// ============================================================================

function ptDist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function gridToPixel(gridPt: Point): Point {
  return {
    x: gridPt.x * CELL_SIZE + GRID_PADDING,
    y: gridPt.y * CELL_SIZE + GRID_PADDING,
  };
}

function pixelToNearestGrid(
  px: Point,
  rows: number,
  cols: number,
): Point | null {
  const gx = Math.round((px.x - GRID_PADDING) / CELL_SIZE);
  const gy = Math.round((px.y - GRID_PADDING) / CELL_SIZE);
  if (gx < 0 || gx > cols || gy < 0 || gy > rows) return null;
  const snapPx = gridToPixel({ x: gx, y: gy });
  const d = Math.sqrt((px.x - snapPx.x) ** 2 + (px.y - snapPx.y) ** 2);
  if (d > SNAP_DISTANCE) return null;
  return { x: gx, y: gy };
}

function angleDegrees(a: Point, b: Point, c: Point): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cos) * (180 / Math.PI);
}

function areSegmentsParallel(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const dxa = a2.x - a1.x;
  const dya = a2.y - a1.y;
  const dxb = b2.x - b1.x;
  const dyb = b2.y - b1.y;
  return Math.abs(dxa * dyb - dya * dxb) < 0.001;
}

interface ShapeProperties {
  sides: number;
  sideLengths: number[];
  angles: number[];
  rightAngles: number;
  parallelPairs: number;
  equalSides: 'all' | 'pairs' | 'none';
  perimeter: number;
}

function computeShapeProperties(vertices: Point[]): ShapeProperties {
  const n = vertices.length;
  const sideLengths = vertices.map((v, i) => ptDist(v, vertices[(i + 1) % n]));
  const angles = vertices.map((v, i) =>
    angleDegrees(vertices[(i - 1 + n) % n], v, vertices[(i + 1) % n]),
  );
  const rightAngles = angles.filter((a) => Math.abs(a - 90) < 8).length;

  let parallelPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        areSegmentsParallel(
          vertices[i],
          vertices[(i + 1) % n],
          vertices[j],
          vertices[(j + 1) % n],
        )
      ) {
        parallelPairs++;
      }
    }
  }

  const rounded = sideLengths.map((l) => Math.round(l * 100) / 100);
  const unique = new Set(rounded);
  let equalSides: 'all' | 'pairs' | 'none' = 'none';
  if (unique.size === 1) {
    equalSides = 'all';
  } else if (n === 4 && unique.size === 2) {
    const sorted = [...rounded].sort((a, b) => a - b);
    if (sorted[0] === sorted[1] && sorted[2] === sorted[3]) equalSides = 'pairs';
  }

  return {
    sides: n,
    sideLengths,
    angles,
    rightAngles,
    parallelPairs,
    equalSides,
    perimeter: sideLengths.reduce((s, l) => s + l, 0),
  };
}

function identifyShape(props: ShapeProperties): string {
  const { sides, rightAngles, parallelPairs, equalSides, sideLengths } = props;

  if (sides === 3) {
    if (equalSides === 'all') return 'Equilateral Triangle';
    if (rightAngles >= 1) return 'Right Triangle';
    const r = sideLengths.map((l) => Math.round(l * 10));
    if (new Set(r).size === 2) return 'Isosceles Triangle';
    return 'Scalene Triangle';
  }
  if (sides === 4) {
    if (equalSides === 'all' && rightAngles === 4) return 'Square';
    if (rightAngles === 4) return 'Rectangle';
    if (equalSides === 'all' && parallelPairs >= 2) return 'Rhombus';
    if (parallelPairs >= 2) return 'Parallelogram';
    if (parallelPairs >= 1) return 'Trapezoid';
    return 'Quadrilateral';
  }

  const names: Record<number, string> = {
    5: 'Pentagon',
    6: 'Hexagon',
    7: 'Heptagon',
    8: 'Octagon',
  };
  const base = names[sides] || `${sides}-gon`;
  return equalSides === 'all' ? `Regular ${base}` : base;
}

/**
 * Build a canonical GHOST polygon for the easy-tier construction scaffold.
 * This is a self-check model only — it is NEVER read by the geometry checker,
 * which validates the student's placed vertices against targetProperties. The
 * ghost is a regular n-gon snapped to integer grid points, centered on the
 * grid, sized to fit. Returns null if there's no usable side count.
 */
function buildGhostVertices(
  target: { sides?: number } | null | undefined,
  rows: number,
  cols: number,
): Point[] | null {
  const sides = target?.sides;
  if (!sides || sides < 3) return null;
  const cx = Math.round(cols / 2);
  const cy = Math.round(rows / 2);
  const radius = Math.max(2, Math.min(cx, cy) - 1);
  const verts: Point[] = [];
  // Start at the top, go clockwise. Round to integer grid points so the
  // emphasized snap-dots land on real, clickable grid dots.
  for (let i = 0; i < sides; i++) {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    verts.push({
      x: Math.max(0, Math.min(cols, Math.round(cx + radius * Math.cos(theta)))),
      y: Math.max(0, Math.min(rows, Math.round(cy + radius * Math.sin(theta)))),
    });
  }
  return verts;
}

function isLineOfSymmetry(lineP1: Point, lineP2: Point, vertices: Point[]): boolean {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;

  for (const v of vertices) {
    const t = ((v.x - lineP1.x) * dx + (v.y - lineP1.y) * dy) / lenSq;
    const projX = lineP1.x + t * dx;
    const projY = lineP1.y + t * dy;
    const rx = 2 * projX - v.x;
    const ry = 2 * projY - v.y;
    const match = vertices.some((u) => ptDist(u, { x: rx, y: ry }) < 0.5);
    if (!match) return false;
  }
  return true;
}

// ============================================================================
// Component
// ============================================================================

interface ShapeBuilderProps {
  data: ShapeBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const ShapeBuilderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ShapeBuilderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ShapeBuilderChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    mode,
    grid,
    targetShape,
    preloadedShapes = [],
    challenges = [],
    tools,
    classificationCategories = [],
    gradeBand = 'K-2',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const rows = grid?.size?.rows || 10;
  const cols = grid?.size?.columns || 10;
  const gridType = grid?.type || 'dot';
  const showCoordinates = grid?.showCoordinates || false;
  const svgWidth = cols * CELL_SIZE + GRID_PADDING * 2;
  const svgHeight = rows * CELL_SIZE + GRID_PADDING * 2;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Build mode
  const [placedVertices, setPlacedVertices] = useState<Point[]>([]);
  const [isShapeClosed, setIsShapeClosed] = useState(false);
  const [hoveredGridPoint, setHoveredGridPoint] = useState<Point | null>(null);

  // Discover / measure mode
  const [showSideLengths, setShowSideLengths] = useState(false);
  const [showAngles, setShowAngles] = useState(false);
  const [showParallel, setShowParallel] = useState(false);

  // Classify mode
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [classifications, setClassifications] = useState<Record<string, string>>({});

  // Symmetry mode
  const [symmetryLineStart, setSymmetryLineStart] = useState<Point | null>(null);
  const [symmetryLines, setSymmetryLines] = useState<Array<{ start: Point; end: Point }>>([]);
  const [validSymmetryLines, setValidSymmetryLines] = useState(0);

  // Tool state
  const [activeTool, setActiveTool] = useState<'select' | 'ruler' | 'protractor' | 'symmetry'>('select');

  // Challenge tracking (shared hooks). On the workspace path the runtime moves the index.
  const stableInstanceIdRef = useRef(instanceId || `shape-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: result => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    incrementAttempts,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the check callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  // make_shape levers (`shapeBuilderLevers.ts`), keyed by the session item they were pulled on, and the easier ask
  // a simplify lever put on screen in its place. The item starts bare: no lever comes from the tier.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ShapeBuilderChallenge | null>(null);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Evaluation tracking
  const [shapesBuiltCorrectly, setShapesBuiltCorrectly] = useState(0);
  const [propertiesIdentified, setPropertiesIdentified] = useState(0);
  const [propertiesTotal, setPropertiesTotal] = useState(0);
  const [classificationsCorrect, setClassificationsCorrect] = useState(0);
  const [classificationsTotal, setClassificationsTotal] = useState(0);
  const [symmetryLinesFoundTotal, setSymmetryLinesFoundTotal] = useState(0);
  const [toolsUsed, setToolsUsed] = useState<Set<string>>(new Set());
  const [hierarchyUnderstood] = useState(false);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  const sessionChallenge = challenges[currentChallengeIndex] || null;
  /** What is on screen: the easier ask while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const activeMode = currentChallenge?.type || mode;
  const isClassifyChallenge = activeMode === 'classify' || activeMode === 'classify_by_lines';

  // -------------------------------------------------------------------------
  // Support tier (construction scaffolds) — display-only, set by the generator
  // -------------------------------------------------------------------------
  const supportTier = currentChallenge?.supportTier ?? null;
  const isConstructMode = activeMode === 'build' || activeMode === 'coordinate_shape';
  // Ghost outline + emphasized snap-dots: only while constructing, only when the
  // tier (easy) asked for it, and only before the student has closed their shape.
  const showTargetGhost =
    isConstructMode && !!currentChallenge?.showTargetGhost && !isShapeClosed;
  const showSideCountBadge = isConstructMode && !!currentChallenge?.showSideCountBadge;

  // Target side count drives the ghost + the side-count badge target. Prefer the
  // per-challenge targetProperties, falling back to the activity-level target.
  const targetSideCount =
    currentChallenge?.targetProperties?.sides ?? targetShape?.properties?.sides ?? null;

  const ghostVertices = useMemo(
    () => (showTargetGhost ? buildGhostVertices({ sides: targetSideCount ?? undefined }, rows, cols) : null),
    [showTargetGhost, targetSideCount, rows, cols],
  );

  const activeShape = useMemo(() => {
    if (isClassifyChallenge) return null;
    return preloadedShapes[0] || null;
  }, [isClassifyChallenge, preloadedShapes]);

  // Computed shape properties
  const currentShapeProps = useMemo(() => {
    if ((activeMode === 'build' || activeMode === 'coordinate_shape') && isShapeClosed && placedVertices.length >= 3) {
      return computeShapeProperties(placedVertices);
    }
    if (
      (activeMode === 'measure' || activeMode === 'find_symmetry' || activeMode === 'compose') &&
      activeShape &&
      activeShape.vertices.length >= 3
    ) {
      return computeShapeProperties(activeShape.vertices);
    }
    return null;
  }, [activeMode, isShapeClosed, placedVertices, activeShape]);

  const currentShapeName = useMemo(
    () => (currentShapeProps ? identifyShape(currentShapeProps) : null),
    [currentShapeProps],
  );

  const displayVertices = useMemo((): Point[] => {
    if (activeMode === 'build' || activeMode === 'coordinate_shape' || activeMode === 'make_shape') return placedVertices;
    if (isClassifyChallenge) return [];
    return activeShape?.vertices || [];
  }, [activeMode, isClassifyChallenge, placedVertices, activeShape]);

  // Phase results (for PhaseSummaryPanel)
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // Overall score for panel fallback
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeBuilderMetrics>({
      primitiveType: 'shape-builder',
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

  const aiPrimitiveData = useMemo(
    () => ({
      mode,
      gradeBand,
      gridType,
      targetShapeName: targetShape?.name || null,
      targetProperties: targetShape?.properties || null,
      currentChallengeIndex,
      totalChallenges: challenges.length,
      instruction: currentChallenge?.instruction || '',
      challengeType: activeMode,
      placedVertexCount: placedVertices.length,
      isShapeClosed,
      currentShapeName,
      currentShapeProperties: currentShapeProps
        ? {
            sides: currentShapeProps.sides,
            rightAngles: currentShapeProps.rightAngles,
            parallelPairs: currentShapeProps.parallelPairs,
            equalSides: currentShapeProps.equalSides,
          }
        : null,
      classificationsComplete: Object.keys(classifications).length,
      classificationsTotal: preloadedShapes.length,
      symmetryLinesFound: validSymmetryLines,
      activeTool,
      attemptNumber: currentAttempts + 1,
      supportTier,
    }),
    [
      mode, gradeBand, gridType, targetShape, currentChallengeIndex, challenges.length,
      currentChallenge, activeMode, placedVertices.length, isShapeClosed, currentShapeName,
      currentShapeProps, classifications, preloadedShapes.length, validSymmetryLines,
      activeTool, currentAttempts, supportTier,
    ],
  );

  // Tier-aware tutor reveal policy. At hard, the tutor must NOT name the vertices
  // or sides to place, nor reveal the construction — it asks what shape the
  // student is building and what properties it needs. The construction (and the
  // target ghost) is hidden at hard, so the tutor must not leak it.
  const tutorRevealClause = useMemo(() => {
    if (!supportTier) return '';
    if (supportTier === 'easy') {
      return ' [TIER easy] You MAY name the target shape and walk the first corner placement; '
        + 'the student also has a ghost outline to check against.';
    }
    if (supportTier === 'medium') {
      return ' [TIER medium] Name the property to aim for (e.g. "4 equal sides") but do NOT '
        + 'tell the student where to place each vertex.';
    }
    return ' [TIER hard] Do NOT name the vertices or sides to place, and do NOT reveal the '
      + 'finished shape or the construction. Ask what shape the student is building and what '
      + 'properties it needs; let them count their own corners.';
  }, [supportTier]);

  // Its context carries the targets, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'shape-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'K-2' : 'Grades 3-5',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Shape Builder activity for ${gradeBand}. Mode: ${mode}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}". `
      + (targetShape?.name ? `Target shape: ${targetShape.name}. ` : '')
      + `Introduce warmly: "Let's explore shapes together!" Then read the first instruction.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, mode, gradeBand, currentChallenge, targetShape, sendText]);

  // -------------------------------------------------------------------------
  // Auto-submit evaluation when all challenges complete
  // -------------------------------------------------------------------------
  // The "Next Challenge" button is hidden for the last challenge (since
  // allChallengesComplete becomes true immediately), so advanceToNextChallenge
  // is never called. This effect ensures submitEvaluation fires automatically.

  useEffect(() => {
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned || !allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;

    const totalCorrect = challengeResults.filter((r) => r.correct).length;
    const score = Math.round((totalCorrect / challenges.length) * 100);

    const metrics: ShapeBuilderMetrics = {
      type: 'shape-builder',
      shapesBuiltCorrectly,
      shapesTotal: challenges.filter(
        (c) => c.type === 'build' || c.type === 'coordinate_shape',
      ).length,
      propertiesIdentified,
      propertiesTotal,
      classificationCorrect: classificationsCorrect,
      classificationTotal: classificationsTotal,
      compositionsCompleted: challengeResults.filter(
        (_, i) => challenges[i]?.type === 'compose',
      ).filter((r) => r.correct).length,
      compositionsTotal: challenges.filter((c) => c.type === 'compose').length,
      symmetryLinesFound: symmetryLinesFoundTotal,
      symmetryLinesTotal: challenges
        .filter((c) => c.type === 'find_symmetry')
        .reduce((s, c) => s + (c.targetProperties?.linesOfSymmetry || 1), 0),
      hierarchyUnderstood,
      toolsUsed: Array.from(toolsUsed),
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    submitEvaluation(totalCorrect === challenges.length, score, metrics, { challengeResults });

    const phaseScoreStr = phaseResults
      .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${score}%. `
      + `Give encouraging phase-specific feedback.`,
      { silent: true },
    );
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, phaseResults,
    shapesBuiltCorrectly, propertiesIdentified, propertiesTotal, classificationsCorrect,
    classificationsTotal, symmetryLinesFoundTotal, hierarchyUnderstood, toolsUsed,
    submitEvaluation, sendText, tutorOwned,
  ]);

  // -------------------------------------------------------------------------
  // SVG Interaction
  // -------------------------------------------------------------------------

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // make_shape builds through its own dot targets (`tapShapeDot`).
      if (hasSubmittedEvaluation || learnerBlocked() || activeMode === 'make_shape') return;
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const scaleX = svgWidth / rect.width;
      const scaleY = svgHeight / rect.height;
      const px: Point = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
      // CLASSIFY mode — select shapes by clicking near their center (pixel-based,
      // no grid snap needed since shape centers often fall between grid points)
      if (isClassifyChallenge) {
        const clickedShape = preloadedShapes.find((shape) => {
          const cx = shape.vertices.reduce((s, v) => s + v.x, 0) / shape.vertices.length;
          const cy = shape.vertices.reduce((s, v) => s + v.y, 0) / shape.vertices.length;
          const centerPx = gridToPixel({ x: cx, y: cy });
          return ptDist(px, centerPx) < CELL_SIZE * 1.5;
        });
        if (clickedShape) {
          SoundManager.select();
          setSelectedShapeId(clickedShape.id);
          setFeedback(`Selected: ${clickedShape.name}. Now choose a category.`);
          setFeedbackType('info');
        }
        return;
      }

      const gridPt = pixelToNearestGrid(px, rows, cols);
      if (!gridPt) return;

      // BUILD mode
      if (activeMode === 'build' || activeMode === 'coordinate_shape') {
        if (isShapeClosed) return;

        // Close shape by clicking first vertex
        if (placedVertices.length >= 3) {
          const first = placedVertices[0];
          if (first.x === gridPt.x && first.y === gridPt.y) {
            SoundManager.pop();
            setIsShapeClosed(true);
            setFeedback('');
            setFeedbackType('');
            const props = computeShapeProperties(placedVertices);
            const name = identifyShape(props);
            sendText(
              `[SHAPE_CLOSED] Student closed a shape with ${props.sides} sides. `
              + `Identified as: ${name}. Properties: ${props.rightAngles} right angles, `
              + `${props.parallelPairs} parallel pairs, equal sides: ${props.equalSides}. `
              + `Name the discovery: "${props.sides} sides, ${props.sides} angles — you built a ${name}!"`,
              { silent: true },
            );
            return;
          }
        }

        if (placedVertices.some((v) => v.x === gridPt.x && v.y === gridPt.y)) {
          SoundManager.invalid();
          setFeedback('That point is already placed!');
          setFeedbackType('error');
          return;
        }

        SoundManager.snap();
        setPlacedVertices((prev) => [...prev, gridPt]);
        setFeedback('');
        if (placedVertices.length === 0) {
          sendText(
            `[FIRST_VERTEX] Student placed first vertex at (${gridPt.x}, ${gridPt.y}). `
            + `Encourage: "Great start! Keep placing points to build your shape."`
            + tutorRevealClause,
            { silent: true },
          );
        }
        return;
      }

      // SYMMETRY mode
      if (activeMode === 'find_symmetry') {
        if (!symmetryLineStart) {
          setSymmetryLineStart(gridPt);
          setFeedback('Click another point to complete the symmetry line.');
          setFeedbackType('info');
        } else {
          const lineStart = symmetryLineStart;
          const lineEnd = gridPt;
          setSymmetryLineStart(null);

          const shapeVerts = activeShape?.vertices || placedVertices;
          if (shapeVerts.length >= 3) {
            const valid = isLineOfSymmetry(lineStart, lineEnd, shapeVerts);
            const isDuplicate = symmetryLines.some((existing) => {
              const d1 = ptDist(existing.start, lineStart) + ptDist(existing.end, lineEnd);
              const d2 = ptDist(existing.start, lineEnd) + ptDist(existing.end, lineStart);
              return d1 < 1 || d2 < 1;
            });

            if (valid && !isDuplicate) {
              SoundManager.playCorrect();
              setSymmetryLines((prev) => [...prev, { start: lineStart, end: lineEnd }]);
              setValidSymmetryLines((prev) => prev + 1);
              setSymmetryLinesFoundTotal((prev) => prev + 1);
              setFeedback('You found a line of symmetry!');
              setFeedbackType('success');
              setToolsUsed((prev) => new Set(prev).add('symmetryLine'));
              sendText(
                `[SYMMETRY_FOUND] Student found a valid line of symmetry (${validSymmetryLines + 1} found). `
                + `Celebrate: "You found a line of symmetry! Each side is a mirror image."`,
                { silent: true },
              );
            } else if (isDuplicate) {
              SoundManager.invalid();
              setFeedback("You already found that line of symmetry!");
              setFeedbackType('info');
            } else {
              SoundManager.playIncorrect();
              setFeedback("That's not a line of symmetry. Try again!");
              setFeedbackType('error');
              sendText(
                `[SYMMETRY_INCORRECT] Student drew from (${lineStart.x},${lineStart.y}) to `
                + `(${lineEnd.x},${lineEnd.y}) — not a symmetry line. `
                + `Hint: "If you fold along this line, would both halves match perfectly?"`,
                { silent: true },
              );
            }
          }
        }
        return;
      }

    },
    [
      hasSubmittedEvaluation, svgWidth, svgHeight, rows, cols, activeMode,
      isShapeClosed, placedVertices, symmetryLineStart, activeShape, symmetryLines,
      validSymmetryLines, preloadedShapes, sendText, tutorRevealClause,
    ],
  );

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = svgWidth / rect.width;
      const scaleY = svgHeight / rect.height;
      const px: Point = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
      setHoveredGridPoint(pixelToNearestGrid(px, rows, cols));
    },
    [svgWidth, svgHeight, rows, cols],
  );

  // -------------------------------------------------------------------------
  // Classify Handler
  // -------------------------------------------------------------------------

  const handleClassify = useCallback(
    (category: string) => {
      if (!selectedShapeId || hasSubmittedEvaluation || learnerBlocked()) return;
      const shape = preloadedShapes.find((s) => s.id === selectedShapeId);
      if (!shape) return;

      setClassifications((prev) => ({ ...prev, [selectedShapeId]: category }));

      // Correctness is determined by the generator — each shape has a correctCategory
      const isCorrect = shape.correctCategory === category;

      if (isCorrect) {
        SoundManager.playCorrect();
        setClassificationsCorrect((prev) => prev + 1);
        setFeedback(`Correct! ${shape.name} belongs in "${category}".`);
        setFeedbackType('success');
        sendText(
          `[CLASSIFY_CORRECT] Student correctly classified "${shape.name}" as "${category}". Celebrate briefly.`,
          { silent: true },
        );
      } else {
        SoundManager.playIncorrect();
        setFeedback(`Not quite. Look at the properties of ${shape.name} again.`);
        setFeedbackType('error');
        sendText(
          `[CLASSIFY_INCORRECT] Student put "${shape.name}" in "${category}" but it belongs in "${shape.correctCategory}". `
          + `Guide the student to examine the shape's properties.`,
          { silent: true },
        );
      }
      setClassificationsTotal((prev) => prev + 1);
      setSelectedShapeId(null);
    },
    [selectedShapeId, hasSubmittedEvaluation, preloadedShapes, sendText],
  );

  // -------------------------------------------------------------------------
  // Measurement Toggles
  // -------------------------------------------------------------------------

  const handleToggleRuler = useCallback(() => {
    if (learnerBlocked()) return;
    SoundManager.toggle(!showSideLengths);
    setShowSideLengths((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('ruler'));
    setActiveTool('ruler');
  }, [showSideLengths]);

  const handleToggleProtractor = useCallback(() => {
    if (learnerBlocked()) return;
    SoundManager.toggle(!showAngles);
    setShowAngles((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('protractor'));
    setActiveTool('protractor');
  }, [showAngles]);

  const handleToggleParallel = useCallback(() => {
    if (learnerBlocked()) return;
    SoundManager.toggle(!showParallel);
    setShowParallel((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('parallelMarker'));
  }, [showParallel]);

  // -------------------------------------------------------------------------
  // Check Answer
  // -------------------------------------------------------------------------

  /** What the check reads, in the workspace's terms (the same view the scene publishes). */
  const shapeView = (): ShapeView => ({
    points: placedVertices, closed: isShapeClosed,
    classifications: Object.fromEntries(Object.entries(classifications)
      .map(([id, cat]) => [preloadedShapes.find(sh => sh.id === id)?.name ?? id, cat])),
    shapeNames: preloadedShapes.map(sh => sh.name), categories: classificationCategories,
    linesFound: validSymmetryLines,
    toolsOn: [showSideLengths && 'ruler', showAngles && 'protractor', showParallel && 'parallel marker']
      .filter((t): t is string => !!t),
  });

  // A move that is not a check (an open shape, an unfinished sort, missing tools or fold lines) only counts an
  // attempt on the scripted path, as before; a check commits through `commitCheck` on both paths.
  const notACheck = () => { if (!tutorOwned) incrementAttempts(); };

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || learnerBlocked()) return;
    const commit = (correct: boolean, miss?: string) =>
      commitCheck.current(describeShapeWork(currentChallenge, shapeView()), correct, correct ? undefined : miss);

    // The open build: any shape with every asked property passes. The words name no property and no shape.
    if (activeMode === 'make_shape') {
      if (!isShapeClosed) return;
      const miss = makeShapeMiss(currentChallenge, shapeView());
      if (!miss) {
        SoundManager.playCorrect();
        setShapesBuiltCorrectly((prev) => prev + 1);
        setFeedback('Yes! Your shape has everything the ask says.');
        setFeedbackType('success');
      } else {
        SoundManager.playIncorrect();
        setFeedback('Not yet. Check your shape against each part of the ask, then change it.');
        setFeedbackType('error');
      }
      commit(!miss, miss);
      return;
    }

    if (activeMode === 'build' || activeMode === 'coordinate_shape') {
      if (!isShapeClosed || !currentShapeProps) {
        notACheck();
        SoundManager.invalid();
        setFeedback('Close your shape first by clicking the first vertex!');
        setFeedbackType('error');
        return;
      }
      const target = currentChallenge.targetProperties;
      if (!target) {
        SoundManager.playCorrect();
        setShapesBuiltCorrectly((prev) => prev + 1);
        setFeedback(`Great! You built a ${currentShapeName}!`);
        setFeedbackType('success');
        commit(true);
        sendText(
          `[BUILD_CORRECT] Student successfully built a ${currentShapeName}. Celebrate!`,
          { silent: true },
        );
        return;
      }

      const { miss, mismatches } = buildCheck(target, currentShapeProps);
      if (!miss) {
        SoundManager.playCorrect();
        setShapesBuiltCorrectly((prev) => prev + 1);
        setFeedback(`Perfect! That's a ${currentShapeName}!`);
        setFeedbackType('success');
        commit(true);
        sendText(
          `[BUILD_CORRECT] Student built a ${currentShapeName} matching target. `
          + `${target.sides} sides, ${target.rightAngles || 0} right angles. Celebrate!`,
          { silent: true },
        );
      } else {
        SoundManager.playIncorrect();
        setFeedback(`Not quite. ${mismatches.join('. ')}. Try again!`);
        setFeedbackType('error');
        commit(false, miss);
        sendText(
          `[BUILD_INCORRECT] Shape doesn't match. Issues: ${mismatches.join(', ')}. `
          + `Attempt ${currentAttempts + 1}. Guide without giving the answer.`
          + tutorRevealClause,
          { silent: true },
        );
      }
      return;
    }

    if (activeMode === 'measure') {
      let propsFound = 0;
      let propsNeeded = 0;
      if (showSideLengths) propsFound++;
      if (showAngles) propsFound++;
      if (showParallel) propsFound++;
      propsNeeded = [tools.ruler, tools.protractor, tools.parallelMarker].filter(Boolean).length;

      if (propsFound >= propsNeeded && currentShapeProps) {
        SoundManager.playCorrect();
        setPropertiesIdentified((prev) => prev + propsFound);
        setPropertiesTotal((prev) => prev + propsNeeded);
        setFeedback(`You discovered all properties of this ${currentShapeName}!`);
        setFeedbackType('success');
        commit(true);
        sendText(
          `[MEASURE_COMPLETE] Student measured all properties of ${currentShapeName}: `
          + `${currentShapeProps.sides} sides, ${currentShapeProps.rightAngles} right angles, `
          + `${currentShapeProps.parallelPairs} parallel pairs. Summarize the discovery.`,
          { silent: true },
        );
      } else {
        notACheck();
        SoundManager.invalid();
        setFeedback("Use all measurement tools to discover the shape's properties!");
        setFeedbackType('info');
        const missing = !showSideLengths ? 'ruler' : !showAngles ? 'protractor' : 'parallel marker';
        sendText(
          `[MEASURE_INCOMPLETE] Student used ${propsFound}/${propsNeeded} tools. `
          + `Encourage: "Try using the ${missing} tool!"`,
          { silent: true },
        );
      }
      return;
    }

    if (isClassifyChallenge) {
      const totalShapes = preloadedShapes.length;
      const classified = Object.keys(classifications).length;
      if (classified >= totalShapes) {
        // Read from this sort, not the running tally (which spans items and a Try again).
        const rightNow = preloadedShapes.filter(sh => classifications[sh.id] === sh.correctCategory).length;
        const allRight = rightNow === totalShapes;
        setFeedback(`All shapes classified! ${rightNow}/${totalShapes} correct.`);
        setFeedbackType(allRight ? 'success' : 'info');
        commit(allRight, 'misplaced_shape');
        sendText(
          `[CLASSIFY_COMPLETE] All ${totalShapes} shapes classified. `
          + `${rightNow}/${totalShapes} correct. `
          + (allRight
            ? 'Celebrate: "You sorted all the shapes perfectly!"'
            : 'Encourage: "Good effort! Let\'s review the tricky ones."'),
          { silent: true },
        );
      } else {
        notACheck();
        SoundManager.invalid();
        setFeedback(`Classify all shapes first. ${classified}/${totalShapes} done.`);
        setFeedbackType('info');
      }
      return;
    }

    if (activeMode === 'find_symmetry') {
      const target = currentChallenge.targetProperties?.linesOfSymmetry || 1;
      if (validSymmetryLines >= target) {
        setFeedback(
          `You found ${validSymmetryLines} line${validSymmetryLines > 1 ? 's' : ''} of symmetry!`,
        );
        setFeedbackType('success');
        commit(true);
        sendText(
          `[SYMMETRY_COMPLETE] Found ${validSymmetryLines}/${target} lines. Celebrate!`,
          { silent: true },
        );
      } else {
        notACheck();
        SoundManager.invalid();
        setFeedback(`Found ${validSymmetryLines}/${target}. Keep looking!`);
        setFeedbackType('info');
        sendText(
          `[SYMMETRY_PARTIAL] ${validSymmetryLines}/${target} found. `
          + `Hint: "Imagine folding the shape. Where could you fold so both halves match?"`,
          { silent: true },
        );
      }
      return;
    }

    if (activeMode === 'compose') {
      SoundManager.playCorrect();
      setFeedback('Shape composed! Great work with pattern blocks.');
      setFeedbackType('success');
      commit(true);
      sendText('[COMPOSE_COMPLETE] Student completed the composition. Celebrate!', { silent: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge, hasSubmittedEvaluation, currentAttempts, activeMode, isShapeClosed, placedVertices,
    currentShapeProps, currentShapeName, tools, showSideLengths, showAngles, showParallel,
    preloadedShapes, classifications, classificationsCorrect, validSymmetryLines, sendText,
    incrementAttempts, tutorRevealClause, tutorOwned, classificationCategories,
  ]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------

  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The shape workspace',
    solved: isCurrentChallengeComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  /** Clears the working surface: a fresh item, or Try again on a mode whose build does not survive a retry. */
  const resetDomainState = useCallback(() => {
    setFeedback('');
    setFeedbackType('');
    setPlacedVertices([]);
    setIsShapeClosed(false);
    setShowSideLengths(false);
    setShowAngles(false);
    setShowParallel(false);
    setSelectedShapeId(null);
    setClassifications({});
    setSymmetryLineStart(null);
    setSymmetryLines([]);
    setValidSymmetryLines(0);
    setActiveTool('select');
  }, []);

  // Workspace path: the runtime opens a fresh item and Try again. On the open build (make_shape) Try again keeps the
  // shape and the verdict's words, so the learner revises the build; a new item opens an empty grid.
  openItem.current = (retry) => {
    if (!retry) { resetDomainState(); setPractice(null); return; }
    if (currentChallenge?.type === 'make_shape') return;
    resetDomainState();
  };

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done — send AI summary and submit evaluation
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
        / challenges.length
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback.`,
        { silent: true },
      );

      // The workspace path submits the scored session from `onFinished` (below), not this tally.
      if (!hasSubmittedEvaluation && !tutorOwned) {
        const totalCorrect = challengeResults.filter((r) => r.correct).length;
        const score =
          challenges.length > 0 ? Math.round((totalCorrect / challenges.length) * 100) : 0;

        const metrics: ShapeBuilderMetrics = {
          type: 'shape-builder',
          shapesBuiltCorrectly,
          shapesTotal: challenges.filter(
            (c) => c.type === 'build' || c.type === 'coordinate_shape' || c.type === 'make_shape',
          ).length,
          propertiesIdentified,
          propertiesTotal,
          classificationCorrect: classificationsCorrect,
          classificationTotal: classificationsTotal,
          compositionsCompleted: challengeResults.filter(
            (_, i) => challenges[i]?.type === 'compose',
          ).filter((r) => r.correct).length,
          compositionsTotal: challenges.filter((c) => c.type === 'compose').length,
          symmetryLinesFound: symmetryLinesFoundTotal,
          symmetryLinesTotal: challenges
            .filter((c) => c.type === 'find_symmetry')
            .reduce((s, c) => s + (c.targetProperties?.linesOfSymmetry || 1), 0),
          hierarchyUnderstood,
          toolsUsed: Array.from(toolsUsed),
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(totalCorrect === challenges.length, score, metrics, { challengeResults });
      }
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    // Just reset domain-specific state:
    resetDomainState();

    const nextIndex = currentChallengeIndex + 1;
    const next = challenges[nextIndex];
    sendText(
      `[NEXT_ITEM] Challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${next.instruction}" (type: ${next.type}). Read instruction and encourage.`
      + (next.supportTier === 'hard'
        ? ' [TIER hard] Do NOT name vertices/sides to place or reveal the shape; ask what shape they are building.'
        : next.supportTier === 'medium'
          ? ' [TIER medium] Name the target property, not the placement.'
          : next.supportTier === 'easy'
            ? ' [TIER easy] You may name the shape and walk the first corner.'
            : ''),
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText, hasSubmittedEvaluation,
    shapesBuiltCorrectly, propertiesIdentified, propertiesTotal, classificationsCorrect,
    classificationsTotal, symmetryLinesFoundTotal, hierarchyUnderstood, toolsUsed, submitEvaluation,
    currentChallengeIndex, resetDomainState, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss (`diagnosisEvidence.phases`).
  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const metrics: ShapeBuilderMetrics = {
      type: 'shape-builder',
      shapesBuiltCorrectly,
      shapesTotal: challenges.filter(c => c.type === 'build' || c.type === 'coordinate_shape' || c.type === 'make_shape').length,
      propertiesIdentified,
      propertiesTotal,
      classificationCorrect: classificationsCorrect,
      classificationTotal: classificationsTotal,
      compositionsCompleted: result.outcomes.filter((r, i) => challenges[i]?.type === 'compose' && r.solved).length,
      compositionsTotal: challenges.filter((c) => c.type === 'compose').length,
      symmetryLinesFound: symmetryLinesFoundTotal,
      symmetryLinesTotal: challenges
        .filter((c) => c.type === 'find_symmetry')
        .reduce((s, c) => s + (c.targetProperties?.linesOfSymmetry || 1), 0),
      hierarchyUnderstood,
      toolsUsed: Array.from(toolsUsed),
      attemptsCount: result.attemptsCount,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  const handleReset = useCallback(() => {
    if (learnerBlocked()) return;
    setPlacedVertices([]);
    setIsShapeClosed(false);
    setFeedback('');
    setFeedbackType('');
    setSymmetryLineStart(null);
    setSymmetryLines([]);
    setValidSymmetryLines(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  // W1 offers no demonstration targets and no presentation. Only make_shape declares levers.
  const band = gradeBand === '3-5' ? '3-5' : 'K-2';
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, shapeView());
    if (sessionChallenge.type !== 'make_shape') { workspace.current = { ...scene }; return; }
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : shapeBuilderLevers(sessionChallenge, pulledLevers, band);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = fewerShape(sessionChallenge, band);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          setLeverState(pulled); resetDomainState(); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetDomainState(); setPractice(null); },
    };
  });

  // ── Open build (make_shape): the dot taps, the live line, the commit ──
  const isMakeShape = activeMode === 'make_shape';
  const buildOpen = isMakeShape && !isCurrentChallengeComplete && !hasSubmittedEvaluation
    && !(tutorOwned && progress.canAttempt === false);
  const tapShapeDot = (p: { x: number; y: number }) => {
    if (!buildOpen || learnerBlocked()) return;
    const next = tapDot({ points: placedVertices, closed: isShapeClosed } as ShapeBuild, p);
    if (!next) { SoundManager.invalid(); return; }
    if (next.closed && !isShapeClosed) SoundManager.pop(); else SoundManager.snap();
    setPlacedVertices(next.points);
    setIsShapeClosed(next.closed);
  };
  const marks = isMakeShape && isShapeClosed ? shapeMarks(placedVertices) : null;
  // The live line (shared build layer): what the shape looks like so far. Never a number, a shape name or a
  // property word: counting sides, checking corners and naming the shape can each be the skill.
  const buildSeeing = useBuildWatcher({
    buildKey: `${placedVertices.map(v => `${v.x},${v.y}`).join('|')}${isShapeClosed ? '#' : ''}`,
    enabled: buildOpen && placedVertices.length >= 2,
    svg: svgRef,
    request: { task: currentChallenge?.instruction ?? '', sceneNote: 'A grid of dots the learner taps to place corners of a shape.',
      numbers: 'never', neverSay: SHAPE_WATCH_NEVER_SAY },
  });

  // -------------------------------------------------------------------------
  // Rendering Helpers
  // -------------------------------------------------------------------------

  const renderGrid = useCallback(() => {
    const elements: React.ReactNode[] = [];
    if (gridType === 'none') return elements;

    // Coordinate grid lines
    if (gridType === 'coordinate') {
      for (let c = 0; c <= cols; c++) {
        elements.push(
          <line
            key={`vl-${c}`}
            x1={GRID_PADDING + c * CELL_SIZE}
            y1={GRID_PADDING}
            x2={GRID_PADDING + c * CELL_SIZE}
            y2={GRID_PADDING + rows * CELL_SIZE}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />,
        );
      }
      for (let r = 0; r <= rows; r++) {
        elements.push(
          <line
            key={`hl-${r}`}
            x1={GRID_PADDING}
            y1={GRID_PADDING + r * CELL_SIZE}
            x2={GRID_PADDING + cols * CELL_SIZE}
            y2={GRID_PADDING + r * CELL_SIZE}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />,
        );
      }
    }

    // Dots for both grid types
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const px = gridToPixel({ x: c, y: r });
        elements.push(
          <circle
            key={`d-${r}-${c}`}
            cx={px.x}
            cy={px.y}
            r={DOT_RADIUS}
            fill="rgba(255,255,255,0.15)"
          />,
        );
      }
    }

    // Coordinate labels
    if (showCoordinates) {
      for (let c = 0; c <= cols; c++) {
        elements.push(
          <text
            key={`xl-${c}`}
            x={GRID_PADDING + c * CELL_SIZE}
            y={GRID_PADDING + rows * CELL_SIZE + 16}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(255,255,255,0.3)"
          >
            {c}
          </text>,
        );
      }
      for (let r = 0; r <= rows; r++) {
        elements.push(
          <text
            key={`yl-${r}`}
            x={GRID_PADDING - 12}
            y={GRID_PADDING + r * CELL_SIZE + 4}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(255,255,255,0.3)"
          >
            {r}
          </text>,
        );
      }
    }

    return elements;
  }, [gridType, rows, cols, showCoordinates]);

  const renderShapeSvg = useCallback(
    (vertices: Point[], color: string, filled: boolean, keyPrefix: string = '') => {
      if (vertices.length < 2) return null;
      const n = vertices.length;
      const elements: React.ReactNode[] = [];

      // Fill polygon
      if (filled && vertices.length >= 3) {
        const points = vertices.map((v) => {
          const p = gridToPixel(v);
          return `${p.x},${p.y}`;
        }).join(' ');
        elements.push(
          <polygon
            key={`${keyPrefix}fill`}
            points={points}
            fill={color.replace('rgb', 'rgba').replace(')', ',0.1)')}
            stroke="none"
          />,
        );
      }

      // Edges
      const edgeCount = filled ? n : n - 1;
      for (let i = 0; i < edgeCount; i++) {
        const from = gridToPixel(vertices[i]);
        const to = gridToPixel(vertices[(i + 1) % n]);
        elements.push(
          <line
            key={`${keyPrefix}e-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
      }

      // Vertices
      vertices.forEach((v, i) => {
        const p = gridToPixel(v);
        elements.push(
          <circle
            key={`${keyPrefix}v-${i}`}
            cx={p.x}
            cy={p.y}
            r={VERTEX_RADIUS}
            fill={i === 0 && !filled ? 'rgba(234,179,8,0.8)' : color}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={1.5}
            className="cursor-pointer"
          />,
        );
      });

      return <g key={`${keyPrefix}group`}>{elements}</g>;
    },
    [],
  );

  const renderMeasurements = useCallback(() => {
    const vertices = displayVertices;
    if (vertices.length < 3 || !currentShapeProps) return null;
    const n = vertices.length;
    const elements: React.ReactNode[] = [];

    // Side lengths
    if (showSideLengths) {
      for (let i = 0; i < n; i++) {
        const from = gridToPixel(vertices[i]);
        const to = gridToPixel(vertices[(i + 1) % n]);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 0 ? (-dy / len) * 14 : 0;
        const ny = len > 0 ? (dx / len) * 14 : -14;

        elements.push(
          <g key={`sl-${i}`}>
            <rect
              x={midX + nx - 16}
              y={midY + ny - 8}
              width={32}
              height={16}
              rx={4}
              fill="rgba(59,130,246,0.8)"
            />
            <text
              x={midX + nx}
              y={midY + ny + 4}
              textAnchor="middle"
              fontSize={10}
              fill="white"
              fontWeight="bold"
            >
              {currentShapeProps.sideLengths[i].toFixed(1)}
            </text>
          </g>,
        );
      }
    }

    // Angles
    if (showAngles) {
      for (let i = 0; i < n; i++) {
        const p = gridToPixel(vertices[i]);
        const angle = currentShapeProps.angles[i];
        const isRight = Math.abs(angle - 90) < 8;
        elements.push(
          <g key={`a-${i}`}>
            <rect
              x={p.x + 10}
              y={p.y - 20}
              width={36}
              height={16}
              rx={4}
              fill={isRight ? 'rgba(16,185,129,0.8)' : 'rgba(168,85,247,0.8)'}
            />
            <text
              x={p.x + 28}
              y={p.y - 8}
              textAnchor="middle"
              fontSize={10}
              fill="white"
              fontWeight="bold"
            >
              {Math.round(angle)}°
            </text>
          </g>,
        );
      }
    }

    // Parallel markers
    if (showParallel) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (
            areSegmentsParallel(
              vertices[i],
              vertices[(i + 1) % n],
              vertices[j],
              vertices[(j + 1) % n],
            )
          ) {
            const drawMark = (a: Point, b: Point, key: string) => {
              const pa = gridToPixel(a);
              const pb = gridToPixel(b);
              elements.push(
                <text
                  key={key}
                  x={(pa.x + pb.x) / 2}
                  y={(pa.y + pb.y) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={16}
                  fill="rgba(251,191,36,0.9)"
                  className="pointer-events-none"
                >
                  ‖
                </text>,
              );
            };
            drawMark(vertices[i], vertices[(i + 1) % n], `p-${i}-${j}-a`);
            drawMark(vertices[j], vertices[(j + 1) % n], `p-${i}-${j}-b`);
          }
        }
      }
    }

    return <g>{elements}</g>;
  }, [displayVertices, currentShapeProps, showSideLengths, showAngles, showParallel]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="purple" className="text-xs">
              {gradeBand}
            </LuminaBadge>
            <LuminaBadge accent="emerald" className="text-xs capitalize">
              {mode}
            </LuminaBadge>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Challenge Progress */}
        {challenges.length > 1 && (
          <div className="flex items-center gap-2">
            {challenges.map((ch, i) => (
              <div
                key={ch.id}
                className={`h-1.5 flex-1 rounded-full ${
                  challengeResults.some((r) => r.challengeId === ch.id && r.correct)
                    ? 'bg-emerald-500/60'
                    : i === currentChallengeIndex
                      ? 'bg-violet-500/60'
                      : 'bg-slate-700/40'
                }`}
              />
            ))}
            <span className="text-slate-500 text-xs ml-2">
              {Math.min(currentChallengeIndex + 1, challenges.length)}/{challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </LuminaPanel>
        )}

        {/* Support tier (easy/medium): live side-count badge while constructing.
            A tracking aid that offloads counting corners — withdrawn at hard. */}
        {showSideCountBadge && !isShapeClosed && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge className="bg-violet-500/20 border-violet-400/40 text-violet-300 text-xs">
              {placedVertices.length} corner{placedVertices.length === 1 ? '' : 's'} placed
              {targetSideCount ? ` / ${targetSideCount} needed` : ''}
            </Badge>
          </div>
        )}

        {/* Measurement Tools Bar */}
        {(tools.ruler || tools.protractor || tools.symmetryLine || tools.parallelMarker) &&
          !allChallengesComplete && !isMakeShape && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 text-xs">Tools:</span>
              {tools.ruler && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 ${
                    showSideLengths
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={handleToggleRuler}
                >
                  Ruler
                </Button>
              )}
              {tools.protractor && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 ${
                    showAngles
                      ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={handleToggleProtractor}
                >
                  Protractor
                </Button>
              )}
              {tools.parallelMarker && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 ${
                    showParallel
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={handleToggleParallel}
                >
                  Parallel
                </Button>
              )}
              {tools.symmetryLine && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 ${
                    symmetryLineStart
                      ? 'bg-pink-500/20 border-pink-400/50 text-pink-300'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setActiveTool('symmetry');
                    setToolsUsed((prev) => new Set(prev).add('symmetryLine'));
                  }}
                >
                  Symmetry
                </Button>
              )}
            </div>
          )}

        {/* Pip's dock sits above the drawing grid, which it outlines as the
            workspace; never a vertex, a grid point, or a shape to classify. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}

        {/* SVG Workspace */}
        <div {...pip.workspace} className="mx-auto flex w-fit justify-center">
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="max-w-full h-auto rounded-xl cursor-crosshair"
            style={{ background: 'rgba(255,255,255,0.02)' }}
            onClick={handleSvgClick}
            data-build-scene={isMakeShape ? 'shape-grid' : undefined}
            onMouseMove={handleSvgMouseMove}
          >
            {/* Border */}
            <rect
              x={1}
              y={1}
              width={svgWidth - 2}
              height={svgHeight - 2}
              rx={12}
              ry={12}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1.5}
            />

            {/* Grid */}
            {renderGrid()}

            {/* Support tier (easy): faint GHOST of the target outline + emphasized
                vertex snap-dots — a self-check model. NEVER read by the checker. */}
            {ghostVertices && ghostVertices.length >= 3 && (
              <g className="pointer-events-none" key="target-ghost">
                <polygon
                  points={ghostVertices
                    .map((v) => {
                      const p = gridToPixel(v);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                  fill="rgba(139,92,246,0.04)"
                  stroke="rgba(139,92,246,0.35)"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                />
                {ghostVertices.map((v, i) => {
                  const p = gridToPixel(v);
                  return (
                    <circle
                      key={`ghost-dot-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={DOT_RADIUS + 3}
                      fill="rgba(139,92,246,0.45)"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={1}
                    />
                  );
                })}
              </g>
            )}

            {/* Classify mode: all preloaded shapes */}
            {isClassifyChallenge &&
              preloadedShapes.map((shape) => {
                const classified = classifications[shape.id];
                const isSelected = selectedShapeId === shape.id;
                const color = classified
                  ? 'rgb(16,185,129)'
                  : isSelected
                    ? 'rgb(234,179,8)'
                    : 'rgb(139,92,246)';
                const cx =
                  shape.vertices.reduce((s, v) => s + v.x, 0) / shape.vertices.length;
                const cy =
                  shape.vertices.reduce((s, v) => s + v.y, 0) / shape.vertices.length;
                const center = gridToPixel({ x: cx, y: cy });

                return (
                  <g key={shape.id}>
                    {renderShapeSvg(shape.vertices, color, true, `${shape.id}-`)}
                    <text
                      x={center.x}
                      y={center.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fill="rgba(255,255,255,0.7)"
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      {classified ? `✓ ${classified}` : shape.name}
                    </text>
                  </g>
                );
              })}

            {/* Non-classify mode: main shape */}
            {activeMode !== 'classify' && (
              <>
                {renderShapeSvg(displayVertices, 'rgb(139,92,246)', isShapeClosed)}

                {/* Preview edge while building */}
                {!isShapeClosed && placedVertices.length > 0 && hoveredGridPoint && (() => {
                  const last = gridToPixel(placedVertices[placedVertices.length - 1]);
                  const hover = gridToPixel(hoveredGridPoint);
                  return (
                    <line
                      x1={last.x}
                      y1={last.y}
                      x2={hover.x}
                      y2={hover.y}
                      stroke="rgba(139,92,246,0.3)"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      className="pointer-events-none"
                    />
                  );
                })()}
              </>
            )}

            {/* Measurements */}
            {renderMeasurements()}

            {/* Symmetry lines */}
            {symmetryLines.map((line, i) => {
              const from = gridToPixel(line.start);
              const to = gridToPixel(line.end);
              return (
                <line
                  key={`sym-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(236,72,153,0.7)"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                />
              );
            })}

            {/* Symmetry line in progress */}
            {symmetryLineStart && hoveredGridPoint && (() => {
              const from = gridToPixel(symmetryLineStart);
              const to = gridToPixel(hoveredGridPoint);
              return (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(236,72,153,0.3)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  className="pointer-events-none"
                />
              );
            })()}

            {/* Hover indicator */}
            {hoveredGridPoint && !isShapeClosed && (() => {
              const p = gridToPixel(hoveredGridPoint);
              return (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={VERTEX_RADIUS + 2}
                  fill="none"
                  stroke="rgba(139,92,246,0.4)"
                  strokeWidth={1.5}
                  className="pointer-events-none"
                />
              );
            })()}

            {/* make_shape help levers: marks on the learner's OWN shape, pulled on a miss. Aids, never in the picture. */}
            {isMakeShape && (
              <g data-aid className="pointer-events-none">
                {leverOn(SIDE_TAGS_LEVER) && (marks?.corners ?? (placedVertices.length >= 2 ? placedVertices : []))
                  .map((a, i, cs) => {
                    if (!isShapeClosed && i === cs.length - 1) return null;
                    const b = cs[(i + 1) % cs.length], pa = gridToPixel(a), pb = gridToPixel(b);
                    return (
                      <g key={`tag-${i}`} data-lever="side-tag">
                        <circle cx={(pa.x + pb.x) / 2} cy={(pa.y + pb.y) / 2} r={9} fill="rgba(56,189,248,0.85)" />
                        <text x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 + 4} textAnchor="middle" fontSize={11}
                          fontWeight="bold" fill="white">{i + 1}</text>
                      </g>
                    );
                  })}
                {marks && leverOn(CORNER_MARKS_LEVER) && marks.rightCorners.map((i) => {
                  const n = marks.corners.length, c = marks.corners[i];
                  const toward = (q: { x: number; y: number }) => {
                    const dx = q.x - c.x, dy = q.y - c.y, l = Math.hypot(dx, dy);
                    return { x: (dx / l) * 0.3, y: (dy / l) * 0.3 };
                  };
                  const u = toward(marks.corners[(i - 1 + n) % n]), v = toward(marks.corners[(i + 1) % n]);
                  const pts = [{ x: c.x + u.x, y: c.y + u.y }, { x: c.x + u.x + v.x, y: c.y + u.y + v.y }, { x: c.x + v.x, y: c.y + v.y }]
                    .map(gridToPixel).map(q => `${q.x},${q.y}`).join(' ');
                  return <polyline key={`ra-${i}`} data-lever="corner-mark" points={pts} fill="none" stroke="rgba(16,185,129,0.95)" strokeWidth={2} />;
                })}
                {marks && leverOn(PARALLEL_MARKS_LEVER) && marks.parallelGroups.flatMap((g, gi) => g.map((i) => {
                  const n = marks.corners.length, pa = gridToPixel(marks.corners[i]), pb = gridToPixel(marks.corners[(i + 1) % n]);
                  return (
                    <text key={`par-${gi}-${i}`} data-lever="parallel-mark" x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 6}
                      textAnchor="middle" fontSize={13} fill="rgba(251,191,36,0.95)">{'>'.repeat(gi + 1)}</text>
                  );
                }))}
                {marks && leverOn(EQUAL_TICKS_LEVER) && marks.lengthGroups.flatMap((g, gi) => g.map((i) => {
                  const n = marks.corners.length, pa = gridToPixel(marks.corners[i]), pb = gridToPixel(marks.corners[(i + 1) % n]);
                  return (
                    <text key={`eq-${gi}-${i}`} data-lever="equal-tick" x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 + 14}
                      textAnchor="middle" fontSize={13} fontWeight="bold" fill="rgba(244,114,182,0.95)">{'|'.repeat(gi + 1)}</text>
                  );
                }))}
                {marks && leverOn(FOLD_LINES_LEVER) && marks.foldLines.map(([a, b], i) => {
                  const pa = gridToPixel(a), pb = gridToPixel(b);
                  return <line key={`fold-${i}`} data-lever="fold-line" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                    stroke="rgba(236,72,153,0.8)" strokeWidth={2} strokeDasharray="8 5" />;
                })}
              </g>
            )}

            {/* make_shape: a tap target on every dot, above the shape so a corner is tapped too. */}
            {isMakeShape && (
              <g data-aid>
                {Array.from({ length: (rows + 1) * (cols + 1) }, (_, k) => {
                  const pt = { x: k % (cols + 1), y: Math.floor(k / (cols + 1)) };
                  const px = gridToPixel(pt);
                  return (
                    <circle key={`dot-${k}`} data-pip-object={`dot-${pt.x}-${pt.y}`} aria-label={`Dot ${pt.x}, ${pt.y}`}
                      cx={px.x} cy={px.y} r={CELL_SIZE / 2 - 2} fill="transparent"
                      className={buildOpen ? 'cursor-pointer' : undefined}
                      onClick={(e) => { e.stopPropagation(); tapShapeDot(pt); }} />
                  );
                })}
              </g>
            )}
          </svg>
        </div>

        {isMakeShape && !allChallengesComplete && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs text-center">
              Tap dots to make corners. Tap your first corner to close the shape. Tap a corner to take it out.
            </p>
            <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
              {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
            </div>
          </div>
        )}

        {/* Shape Properties Panel */}
        {isShapeClosed && currentShapeProps && currentShapeName && (
          <LuminaPanel className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-violet-500/20 border-violet-400/40 text-violet-300 text-xs">
                {currentShapeName}
              </Badge>
              <Badge className="bg-slate-700/40 border-slate-600/40 text-slate-300 text-xs">
                {currentShapeProps.sides} sides
              </Badge>
              {currentShapeProps.rightAngles > 0 && (
                <Badge className="bg-emerald-500/20 border-emerald-400/40 text-emerald-300 text-xs">
                  {currentShapeProps.rightAngles} right angles
                </Badge>
              )}
              {currentShapeProps.parallelPairs > 0 && (
                <Badge className="bg-amber-500/20 border-amber-400/40 text-amber-300 text-xs">
                  {currentShapeProps.parallelPairs} parallel pairs
                </Badge>
              )}
              <Badge className="bg-slate-700/40 border-slate-600/40 text-slate-300 text-xs">
                sides: {currentShapeProps.equalSides}
              </Badge>
            </div>
            {/* Hierarchy hint for grades 3-5 */}
            {gradeBand === '3-5' && currentShapeProps.sides === 4 && (
              <p className="text-slate-500 text-xs italic">
                {currentShapeName === 'Square'
                  ? 'Square → Rectangle → Parallelogram → Quadrilateral'
                  : currentShapeName === 'Rectangle'
                    ? 'Rectangle → Parallelogram → Quadrilateral'
                    : currentShapeName === 'Rhombus'
                      ? 'Rhombus → Parallelogram → Quadrilateral'
                      : currentShapeName === 'Parallelogram'
                        ? 'Parallelogram → Quadrilateral'
                        : currentShapeName === 'Trapezoid'
                          ? 'Trapezoid → Quadrilateral'
                          : 'Quadrilateral'}
              </p>
            )}
          </LuminaPanel>
        )}

        {/* Classify Categories */}
        {isClassifyChallenge && classificationCategories.length > 0 && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-xs">Categories:</span>
            {classificationCategories.map((cat) => (
              <Button
                key={cat}
                variant="ghost"
                size="sm"
                className={`text-xs h-7 capitalize ${
                  selectedShapeId
                    ? 'bg-violet-500/10 border border-violet-400/30 hover:bg-violet-500/20 text-violet-300'
                    : 'bg-white/5 border border-white/20 text-slate-500'
                }`}
                disabled={!selectedShapeId}
                onClick={() => handleClassify(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {/* Symmetry count */}
        {activeMode === 'find_symmetry' && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-slate-300">
              Lines found:{' '}
              <span className="text-pink-300 font-bold">{validSymmetryLines}</span>
              {currentChallenge?.targetProperties?.linesOfSymmetry && (
                <span className="text-slate-500">
                  {' '}/ {currentChallenge.targetProperties.linesOfSymmetry}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-center text-sm font-medium ${
              feedbackType === 'success'
                ? 'text-emerald-400'
                : feedbackType === 'error'
                  ? 'text-red-400'
                  : 'text-slate-300'
            }`}
          >
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                {(activeMode === 'build' || activeMode === 'coordinate_shape' || isMakeShape) && (
                  <LuminaButton
                    size="sm"
                    className="text-slate-400 text-xs"
                    onClick={handleReset}
                    disabled={tutorOwned && progress.canAttempt === false}
                  >
                    Clear Shape
                  </LuminaButton>
                )}
                {isMakeShape ? (
                  <LuminaButton tone="primary" disabled={!buildOpen || !isShapeClosed}
                    onClick={() => { if (!learnerBlocked()) handleCheckAnswer(); }}>
                    I&apos;m done!
                  </LuminaButton>
                ) : (
                  <LuminaActionButton
                    action="check"
                    onClick={handleCheckAnswer}
                    disabled={hasSubmittedEvaluation || (tutorOwned && progress.canAttempt === false)}
                  />
                )}
              </>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && !tutorOwned && (
              <LuminaActionButton
                action="next"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} shape challenges!`}
            className="mt-4"
          />
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const ShapeBuilder = withWorkspaceController<ShapeBuilderProps, ProgressOptions<ShapeBuilderChallenge>, Progress>(
  'shape-builder', ShapeBuilderSurface, useScriptedProgress, useWorkspaceProgressFor('shape-builder'));

export default ShapeBuilder;
