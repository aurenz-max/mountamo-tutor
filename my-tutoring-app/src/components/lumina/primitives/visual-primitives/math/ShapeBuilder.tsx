'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface Point {
  x: number;
  y: number;
}

export interface ShapeBuilderChallenge {
  id: string;
  type: 'build' | 'measure' | 'classify' | 'compose' | 'find_symmetry' | 'coordinate_shape';
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
}

export interface PreloadedShape {
  id: string;
  vertices: Point[];
  name: string;
  locked: boolean;
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
}

const ShapeBuilder: React.FC<ShapeBuilderProps> = ({ data, className }) => {
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

  // Challenge tracking
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Evaluation tracking
  const [challengeResults, setChallengeResults] = useState<
    Array<{ challengeId: string; correct: boolean; attempts: number }>
  >([]);
  const [shapesBuiltCorrectly, setShapesBuiltCorrectly] = useState(0);
  const [propertiesIdentified, setPropertiesIdentified] = useState(0);
  const [propertiesTotal, setPropertiesTotal] = useState(0);
  const [classificationsCorrect, setClassificationsCorrect] = useState(0);
  const [classificationsTotal, setClassificationsTotal] = useState(0);
  const [symmetryLinesFoundTotal, setSymmetryLinesFoundTotal] = useState(0);
  const [toolsUsed, setToolsUsed] = useState<Set<string>>(new Set());
  const [hierarchyUnderstood] = useState(false);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `shape-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const svgRef = useRef<SVGSVGElement>(null);

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const activeMode = currentChallenge?.type || mode;

  const activeShape = useMemo(() => {
    if (activeMode === 'classify') return null;
    return preloadedShapes[0] || null;
  }, [activeMode, preloadedShapes]);

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
    if (activeMode === 'build' || activeMode === 'coordinate_shape') return placedVertices;
    if (activeMode === 'classify') return [];
    return activeShape?.vertices || [];
  }, [activeMode, placedVertices, activeShape]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const { submitResult: submitEvaluation, hasSubmitted: hasSubmittedEvaluation } =
    usePrimitiveEvaluation<ShapeBuilderMetrics>({
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
    }),
    [
      mode, gradeBand, gridType, targetShape, currentChallengeIndex, challenges.length,
      currentChallenge, activeMode, placedVertices.length, isShapeClosed, currentShapeName,
      currentShapeProps, classifications, preloadedShapes.length, validSymmetryLines,
      activeTool, currentAttempts,
    ],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'shape-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'K-2' : 'Grades 3-5',
  });

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
  // SVG Interaction
  // -------------------------------------------------------------------------

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (hasSubmittedEvaluation) return;
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
      if (activeMode === 'classify') {
        const clickedShape = preloadedShapes.find((shape) => {
          const cx = shape.vertices.reduce((s, v) => s + v.x, 0) / shape.vertices.length;
          const cy = shape.vertices.reduce((s, v) => s + v.y, 0) / shape.vertices.length;
          const centerPx = gridToPixel({ x: cx, y: cy });
          return ptDist(px, centerPx) < CELL_SIZE * 1.5;
        });
        if (clickedShape) {
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
          setFeedback('That point is already placed!');
          setFeedbackType('error');
          return;
        }

        setPlacedVertices((prev) => [...prev, gridPt]);
        setFeedback('');
        if (placedVertices.length === 0) {
          sendText(
            `[FIRST_VERTEX] Student placed first vertex at (${gridPt.x}, ${gridPt.y}). `
            + `Encourage: "Great start! Keep placing points to build your shape."`,
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
              setFeedback("You already found that line of symmetry!");
              setFeedbackType('info');
            } else {
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
      validSymmetryLines, preloadedShapes, sendText,
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
      if (!selectedShapeId || hasSubmittedEvaluation) return;
      const shape = preloadedShapes.find((s) => s.id === selectedShapeId);
      if (!shape) return;

      setClassifications((prev) => ({ ...prev, [selectedShapeId]: category }));

      const shapeProps = computeShapeProperties(shape.vertices);
      const shapeName = identifyShape(shapeProps);

      // Determine correctness: support both side-count categories (e.g. "Triangles")
      // and property-based categories from the AI generator (e.g. "Has 4 Right Angles")
      const catLower = category.toLowerCase();
      const sideCountMap: Record<string, number[]> = {
        triangles: [3],
        quadrilaterals: [4],
        pentagons: [5],
        hexagons: [6],
        polygons: [5, 6, 7, 8],
      };

      let isCorrect = false;
      if (sideCountMap[catLower]) {
        // Side-count based category
        isCorrect = sideCountMap[catLower].includes(shapeProps.sides);
      } else {
        // Property-based category: match keywords in the category name against shape properties
        const hasRight = catLower.includes('right angle');
        const hasParallel = catLower.includes('parallel');
        const hasEqual = catLower.includes('equal');
        const isNegative = catLower.includes('not') || catLower.includes('no ');

        if (hasRight) {
          // Extract number from category if present (e.g. "Has 4 Right Angles")
          const numMatch = category.match(/(\d+)\s*right/i);
          const requiredCount = numMatch ? parseInt(numMatch[1]) : 1;
          const shapeHasProperty = shapeProps.rightAngles >= requiredCount;
          isCorrect = isNegative ? !shapeHasProperty : shapeHasProperty;
        } else if (hasParallel) {
          const numMatch = category.match(/(\d+)\s*parallel/i);
          const requiredCount = numMatch ? parseInt(numMatch[1]) : 1;
          const shapeHasProperty = shapeProps.parallelPairs >= requiredCount;
          isCorrect = isNegative ? !shapeHasProperty : shapeHasProperty;
        } else if (hasEqual) {
          const shapeHasProperty = shapeProps.equalSides === 'all' || shapeProps.equalSides === 'pairs';
          isCorrect = isNegative ? !shapeHasProperty : shapeHasProperty;
        } else {
          // Fallback: check if shape name matches category text
          isCorrect = catLower.includes(shapeName.toLowerCase())
            || shapeName.toLowerCase().includes(catLower.replace(/s$/, ''));
        }
      }

      if (isCorrect) {
        setClassificationsCorrect((prev) => prev + 1);
        setFeedback(`Correct! ${shape.name} (${shapeName}) belongs in "${category}".`);
        setFeedbackType('success');
        sendText(
          `[CLASSIFY_CORRECT] Student correctly classified "${shape.name}" (${shapeName}) as "${category}". `
          + `Properties: ${shapeProps.sides} sides, ${shapeProps.rightAngles} right angles, `
          + `${shapeProps.parallelPairs} parallel pairs, equal sides: ${shapeProps.equalSides}. Celebrate briefly.`,
          { silent: true },
        );
      } else {
        setFeedback(`Not quite. Look at the properties of ${shape.name} again.`);
        setFeedbackType('error');
        sendText(
          `[CLASSIFY_INCORRECT] Student put "${shape.name}" (${shapeName}: ${shapeProps.rightAngles} right angles, `
          + `${shapeProps.parallelPairs} parallel pairs, sides: ${shapeProps.equalSides}) in "${category}". `
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
    setShowSideLengths((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('ruler'));
    setActiveTool('ruler');
  }, []);

  const handleToggleProtractor = useCallback(() => {
    setShowAngles((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('protractor'));
    setActiveTool('protractor');
  }, []);

  const handleToggleParallel = useCallback(() => {
    setShowParallel((prev) => !prev);
    setToolsUsed((prev) => new Set(prev).add('parallelMarker'));
  }, []);

  // -------------------------------------------------------------------------
  // Check Answer
  // -------------------------------------------------------------------------

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    setCurrentAttempts((prev) => prev + 1);

    if (activeMode === 'build' || activeMode === 'coordinate_shape') {
      if (!isShapeClosed || !currentShapeProps) {
        setFeedback('Close your shape first by clicking the first vertex!');
        setFeedbackType('error');
        return;
      }
      const target = currentChallenge.targetProperties;
      if (!target) {
        setShapesBuiltCorrectly((prev) => prev + 1);
        setFeedback(`Great! You built a ${currentShapeName}!`);
        setFeedbackType('success');
        setChallengeResults((prev) => [
          ...prev,
          { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
        ]);
        sendText(
          `[BUILD_CORRECT] Student successfully built a ${currentShapeName}. Celebrate!`,
          { silent: true },
        );
        return;
      }

      let matches = true;
      const mismatches: string[] = [];

      if (target.sides !== undefined && currentShapeProps.sides !== target.sides) {
        matches = false;
        mismatches.push(`needs ${target.sides} sides, has ${currentShapeProps.sides}`);
      }
      // Only enforce rightAngles when requiring a positive count (e.g. "4 right angles").
      // A target of 0 is almost always generator noise, not a real constraint.
      if (target.rightAngles !== undefined && target.rightAngles > 0 && currentShapeProps.rightAngles !== target.rightAngles) {
        matches = false;
        mismatches.push(`needs ${target.rightAngles} right angles, has ${currentShapeProps.rightAngles}`);
      }
      // Only enforce parallelPairs when requiring a positive count.
      if (target.parallelPairs !== undefined && target.parallelPairs > 0 && currentShapeProps.parallelPairs < target.parallelPairs) {
        matches = false;
        mismatches.push(`needs ${target.parallelPairs} parallel pairs, has ${currentShapeProps.parallelPairs}`);
      }
      // Only enforce equalSides when requiring equality ('all' or 'pairs'), not 'none'.
      if (target.equalSides && target.equalSides !== 'none' && currentShapeProps.equalSides !== target.equalSides) {
        matches = false;
        mismatches.push(`sides should be ${target.equalSides} equal`);
      }

      if (matches) {
        setShapesBuiltCorrectly((prev) => prev + 1);
        setFeedback(`Perfect! That's a ${currentShapeName}!`);
        setFeedbackType('success');
        setChallengeResults((prev) => [
          ...prev,
          { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
        ]);
        sendText(
          `[BUILD_CORRECT] Student built a ${currentShapeName} matching target. `
          + `${target.sides} sides, ${target.rightAngles || 0} right angles. Celebrate!`,
          { silent: true },
        );
      } else {
        setFeedback(`Not quite. ${mismatches.join('. ')}. Try again!`);
        setFeedbackType('error');
        sendText(
          `[BUILD_INCORRECT] Shape doesn't match. Issues: ${mismatches.join(', ')}. `
          + `Attempt ${currentAttempts + 1}. Guide without giving the answer.`,
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
        setPropertiesIdentified((prev) => prev + propsFound);
        setPropertiesTotal((prev) => prev + propsNeeded);
        setFeedback(`You discovered all properties of this ${currentShapeName}!`);
        setFeedbackType('success');
        setChallengeResults((prev) => [
          ...prev,
          { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
        ]);
        sendText(
          `[MEASURE_COMPLETE] Student measured all properties of ${currentShapeName}: `
          + `${currentShapeProps.sides} sides, ${currentShapeProps.rightAngles} right angles, `
          + `${currentShapeProps.parallelPairs} parallel pairs. Summarize the discovery.`,
          { silent: true },
        );
      } else {
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

    if (activeMode === 'classify') {
      const totalShapes = preloadedShapes.length;
      const classified = Object.keys(classifications).length;
      if (classified >= totalShapes) {
        setFeedback(`All shapes classified! ${classificationsCorrect}/${totalShapes} correct.`);
        setFeedbackType(classificationsCorrect === totalShapes ? 'success' : 'info');
        setChallengeResults((prev) => [
          ...prev,
          {
            challengeId: currentChallenge.id,
            correct: classificationsCorrect === totalShapes,
            attempts: currentAttempts + 1,
          },
        ]);
        sendText(
          `[CLASSIFY_COMPLETE] All ${totalShapes} shapes classified. `
          + `${classificationsCorrect}/${totalShapes} correct. `
          + (classificationsCorrect === totalShapes
            ? 'Celebrate: "You sorted all the shapes perfectly!"'
            : 'Encourage: "Good effort! Let\'s review the tricky ones."'),
          { silent: true },
        );
      } else {
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
        setChallengeResults((prev) => [
          ...prev,
          { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
        ]);
        sendText(
          `[SYMMETRY_COMPLETE] Found ${validSymmetryLines}/${target} lines. Celebrate!`,
          { silent: true },
        );
      } else {
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
      setFeedback('Shape composed! Great work with pattern blocks.');
      setFeedbackType('success');
      setChallengeResults((prev) => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
      ]);
      sendText('[COMPOSE_COMPLETE] Student completed the composition. Celebrate!', { silent: true });
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, currentAttempts, activeMode, isShapeClosed,
    currentShapeProps, currentShapeName, tools, showSideLengths, showAngles, showParallel,
    preloadedShapes, classifications, classificationsCorrect, validSymmetryLines, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------

  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );
  const allChallengesComplete =
    challenges.length > 0 &&
    challengeResults.filter((r) => r.correct).length >= challenges.length;

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      sendText(
        `[ALL_COMPLETE] Student completed all ${challenges.length} shape challenges! Celebrate!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter((r) => r.correct).length;
        const score =
          challenges.length > 0 ? Math.round((totalCorrect / challenges.length) * 100) : 0;

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
      }
      return;
    }

    // Reset for next challenge
    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
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

    const next = challenges[nextIndex];
    sendText(
      `[NEXT_ITEM] Challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${next.instruction}" (type: ${next.type}). Read instruction and encourage.`,
      { silent: true },
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText, hasSubmittedEvaluation,
    shapesBuiltCorrectly, propertiesIdentified, propertiesTotal, classificationsCorrect,
    classificationsTotal, symmetryLinesFoundTotal, hierarchyUnderstood, toolsUsed, submitEvaluation,
  ]);

  const handleReset = useCallback(() => {
    setPlacedVertices([]);
    setIsShapeClosed(false);
    setFeedback('');
    setFeedbackType('');
    setSymmetryLineStart(null);
    setSymmetryLines([]);
    setValidSymmetryLines(0);
  }, []);

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
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-violet-300 text-xs">
              {gradeBand}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs capitalize">
              {mode}
            </Badge>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
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
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Measurement Tools Bar */}
        {(tools.ruler || tools.protractor || tools.symmetryLine || tools.parallelMarker) &&
          !allChallengesComplete && (
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

        {/* SVG Workspace */}
        <div className="flex justify-center">
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="max-w-full h-auto rounded-xl cursor-crosshair"
            style={{ background: 'rgba(255,255,255,0.02)' }}
            onClick={handleSvgClick}
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

            {/* Classify mode: all preloaded shapes */}
            {activeMode === 'classify' &&
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
          </svg>
        </div>

        {/* Shape Properties Panel */}
        {isShapeClosed && currentShapeProps && currentShapeName && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5 space-y-2">
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
          </div>
        )}

        {/* Classify Categories */}
        {activeMode === 'classify' && classificationCategories.length > 0 && !allChallengesComplete && (
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
                {(activeMode === 'build' || activeMode === 'coordinate_shape') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs"
                    onClick={handleReset}
                  >
                    Clear Shape
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleCheckAnswer}
                  disabled={hasSubmittedEvaluation}
                >
                  Check Answer
                </Button>
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
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter((r) => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShapeBuilder;
