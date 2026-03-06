'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeSorterShape {
  shape: string;
  color: string;
  size: 'small' | 'medium' | 'large';
  rotation: number;
}

export interface ShapeSorterChallenge {
  id: string;
  type: 'identify' | 'count' | 'sort';
  instruction: string;
  /** The attribute being tested: shape name, color, side count, or curved vs straight */
  ruleAttribute: 'shape' | 'color' | 'sides' | 'curved';
  /** For identify: the target value to match (e.g. "triangle", "red", "3", "true").
   *  For count: the shape name to examine (e.g. "hexagon"). */
  targetValue?: string;
  /** Pool of shapes — all challenge types use this unified array */
  shapes: ShapeSorterShape[];
}

export interface ShapeSorterData {
  title: string;
  description?: string;
  challenges: ShapeSorterChallenge[];
  gradeBand?: 'K' | '1';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeSorterMetrics>) => void;
}

// ============================================================================
// Shape Property Reference — the single source of geometric truth
// ============================================================================

export const SHAPE_PROPERTIES: Record<string, { sides: number; corners: number; curved: boolean }> = {
  circle:    { sides: 0, corners: 0, curved: true },
  oval:      { sides: 0, corners: 0, curved: true },
  triangle:  { sides: 3, corners: 3, curved: false },
  square:    { sides: 4, corners: 4, curved: false },
  rectangle: { sides: 4, corners: 4, curved: false },
  diamond:   { sides: 4, corners: 4, curved: false },
  rhombus:   { sides: 4, corners: 4, curved: false },
  pentagon:  { sides: 5, corners: 5, curved: false },
  hexagon:   { sides: 6, corners: 6, curved: false },
};

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify: { label: 'Identify', icon: '👆', accentColor: 'purple' },
  count:    { label: 'Count',    icon: '🔢', accentColor: 'emerald' },
  sort:     { label: 'Sort',     icon: '📦', accentColor: 'cyan' },
};

const SHAPE_COLORS: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4',
};

const SIZE_SCALE: Record<string, number> = { small: 0.6, medium: 1.0, large: 1.4 };

// ============================================================================
// Code-Derived Truth Helpers
// ============================================================================

/** Check whether a shape matches the rule for an identify challenge */
function isTargetShape(s: ShapeSorterShape, ruleAttribute: string, targetValue?: string): boolean {
  if (!targetValue) return false;
  const tv = targetValue.trim().toLowerCase();
  const props = SHAPE_PROPERTIES[s.shape];
  switch (ruleAttribute) {
    case 'shape':  return s.shape === tv;
    case 'color':  return s.color === tv;
    case 'sides':  return String(props?.sides ?? -1) === tv;
    case 'curved': return String(props?.curved ?? false) === tv;
    default:       return false;
  }
}

/** Derive the bin label a shape belongs to for a sort challenge */
function getShapeBinLabel(s: ShapeSorterShape, ruleAttribute: string): string {
  const props = SHAPE_PROPERTIES[s.shape];
  switch (ruleAttribute) {
    case 'sides':  return `${props?.sides ?? 0} sides`;
    case 'color':  return s.color.charAt(0).toUpperCase() + s.color.slice(1);
    case 'shape':  return s.shape.charAt(0).toUpperCase() + s.shape.slice(1);
    case 'curved': return (props?.curved ?? false) ? 'Curved' : 'Straight';
    default:       return 'Unknown';
  }
}

// ============================================================================
// SVG Shape Rendering
// ============================================================================

function renderShapeSVG(
  shape: string, cx: number, cy: number, baseSize: number,
  color: string, rotation: number,
  opts?: { highlighted?: boolean; dimmed?: boolean; showSides?: Set<number>; showCorners?: boolean },
): React.ReactNode {
  const fill = SHAPE_COLORS[color] || color || '#94a3b8';
  const opacity = opts?.dimmed ? 0.3 : 1;
  const strokeWidth = opts?.highlighted ? 3 : 1.5;
  const stroke = opts?.highlighted ? '#fbbf24' : 'rgba(255,255,255,0.3)';
  const s = baseSize;
  const transform = `rotate(${rotation} ${cx} ${cy})`;

  let shapeEl: React.ReactNode = null;
  const sideLines: React.ReactNode[] = [];
  const cornerDots: React.ReactNode[] = [];

  // Helper to add side highlights + corner dots for a polygon
  const addPolygonOverlays = (corners: number[][]) => {
    if (opts?.showCorners) {
      corners.forEach(([x, y], i) => {
        cornerDots.push(
          <circle key={`corner-${i}`} cx={x} cy={y} r={4} fill="#fbbf24"
            stroke="#000" strokeWidth={1} transform={transform} />
        );
      });
    }
    if (opts?.showSides) {
      for (let i = 0; i < corners.length; i++) {
        const next = (i + 1) % corners.length;
        if (opts.showSides.has(i)) {
          sideLines.push(
            <line key={`side-${i}`} x1={corners[i][0]} y1={corners[i][1]}
              x2={corners[next][0]} y2={corners[next][1]}
              stroke="#fbbf24" strokeWidth={4} transform={transform} />
          );
        }
      }
    }
  };

  switch (shape) {
    case 'circle': {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      break;
    }
    case 'oval': {
      shapeEl = <ellipse cx={cx} cy={cy} rx={s * 0.65} ry={s * 0.4} fill={fill}
        stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      break;
    }
    case 'square': {
      const half = s / 2;
      const c = [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    case 'triangle': {
      const h = s * 0.866;
      const c = [[cx, cy - h / 2], [cx - s / 2, cy + h / 2], [cx + s / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    case 'rectangle': {
      const w = s * 1.4, h = s * 0.7;
      const c = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    case 'diamond':
    case 'rhombus': {
      const half = s / 2;
      const c = [[cx, cy - half * 1.2], [cx + half, cy], [cx, cy + half * 1.2], [cx - half, cy]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    case 'hexagon': {
      const r = s / 2;
      const c = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    case 'pentagon': {
      const r = s / 2;
      const c = Array.from({ length: 5 }, (_, i) => {
        const a = (2 * Math.PI / 5) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
      addPolygonOverlays(c);
      break;
    }
    default: {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} opacity={opacity} transform={transform} />;
    }
  }

  return <g>{shapeEl}{sideLines}{cornerDots}</g>;
}

// ============================================================================
// Sub-Components
// ============================================================================

// --- IDENTIFY: Tap all shapes matching the rule ---
interface IdentifyViewProps {
  shapes: ShapeSorterShape[];
  targetIndices: Set<number>;
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
}

const IdentifyView: React.FC<IdentifyViewProps> = ({ shapes, targetIndices, selectedIndices, onToggle }) => {
  const cols = Math.min(shapes.length, 4);
  const cellSize = 90;
  const svgWidth = cols * cellSize;
  const rows = Math.ceil(shapes.length / cols);
  const svgHeight = rows * cellSize;

  return (
    <div className="flex justify-center">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="max-w-full h-auto">
        {shapes.map((s, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = col * cellSize + cellSize / 2;
          const cy = row * cellSize + cellSize / 2;
          const scale = SIZE_SCALE[s.size] || 1;
          const baseSize = 36 * scale;
          const isSelected = selectedIndices.has(i);
          const isTarget = targetIndices.has(i);

          return (
            <g key={i} className="cursor-pointer" onClick={() => onToggle(i)}>
              {isSelected && (
                <circle cx={cx} cy={cy} r={baseSize / 2 + 8} fill="none"
                  stroke={isTarget ? '#22c55e' : '#ef4444'} strokeWidth={3}
                  strokeDasharray={isTarget ? 'none' : '6 3'} />
              )}
              {renderShapeSVG(s.shape, cx, cy, baseSize, s.color, s.rotation,
                { highlighted: isSelected && isTarget })}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// --- COUNT: Examine a shape, count sides and corners ---
interface CountViewProps {
  shape: ShapeSorterShape;
  tappedSides: Set<number>;
  showCorners: boolean;
  sidesAnswer: string;
  cornersAnswer: string;
  onTapSide: (idx: number) => void;
  onToggleCorners: () => void;
  onSidesChange: (v: string) => void;
  onCornersChange: (v: string) => void;
}

const CountView: React.FC<CountViewProps> = ({
  shape, tappedSides, showCorners, sidesAnswer, cornersAnswer,
  onTapSide, onToggleCorners, onSidesChange, onCornersChange,
}) => {
  const props = SHAPE_PROPERTIES[shape.shape];
  const totalSides = props?.sides ?? 0;
  const isCurved = props?.curved ?? false;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <svg width={200} height={200} viewBox="0 0 200 200">
          {renderShapeSVG(shape.shape, 100, 100, 100, shape.color, 0, {
            showSides: tappedSides,
            showCorners,
          })}
        </svg>
      </div>

      {/* Side tap buttons */}
      {!isCurved && totalSides > 0 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: totalSides }, (_, i) => (
            <Button key={i} variant="ghost" size="sm"
              className={`text-xs ${tappedSides.has(i)
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10'}`}
              onClick={() => onTapSide(i)}>
              Side {i + 1} {tappedSides.has(i) ? '✓' : ''}
            </Button>
          ))}
        </div>
      )}

      {/* Corner toggle */}
      {!isCurved && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm"
            className={`text-xs ${showCorners
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
              : 'bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10'}`}
            onClick={onToggleCorners}>
            {showCorners ? 'Corners shown ✓' : 'Show corners'}
          </Button>
        </div>
      )}

      {/* Curved shape note */}
      {isCurved && (
        <p className="text-center text-slate-400 text-xs">
          This shape has curved sides — no straight sides or corners!
        </p>
      )}

      {/* Answer inputs */}
      <div className="flex justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-slate-300">How many sides?</span>
          <div className="flex items-center gap-0 rounded-lg border border-white/20 overflow-hidden">
            <Button variant="ghost" size="sm"
              className="h-9 w-9 rounded-none bg-white/5 hover:bg-white/10 text-slate-300 border-r border-white/10 p-0"
              onClick={() => onSidesChange(String(Math.max(0, (parseInt(sidesAnswer) || 0) - 1)))}>
              −
            </Button>
            <span className="h-9 w-10 flex items-center justify-center bg-slate-800/50 text-slate-100 text-sm font-medium tabular-nums">
              {sidesAnswer || '0'}
            </span>
            <Button variant="ghost" size="sm"
              className="h-9 w-9 rounded-none bg-white/5 hover:bg-white/10 text-slate-300 border-l border-white/10 p-0"
              onClick={() => onSidesChange(String(Math.min(20, (parseInt(sidesAnswer) || 0) + 1)))}>
              +
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-slate-300">How many corners?</span>
          <div className="flex items-center gap-0 rounded-lg border border-white/20 overflow-hidden">
            <Button variant="ghost" size="sm"
              className="h-9 w-9 rounded-none bg-white/5 hover:bg-white/10 text-slate-300 border-r border-white/10 p-0"
              onClick={() => onCornersChange(String(Math.max(0, (parseInt(cornersAnswer) || 0) - 1)))}>
              −
            </Button>
            <span className="h-9 w-10 flex items-center justify-center bg-slate-800/50 text-slate-100 text-sm font-medium tabular-nums">
              {cornersAnswer || '0'}
            </span>
            <Button variant="ghost" size="sm"
              className="h-9 w-9 rounded-none bg-white/5 hover:bg-white/10 text-slate-300 border-l border-white/10 p-0"
              onClick={() => onCornersChange(String(Math.min(20, (parseInt(cornersAnswer) || 0) + 1)))}>
              +
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SORT: Assign shapes to code-derived bins ---
interface SortViewProps {
  shapes: ShapeSorterShape[];
  bins: string[];
  ruleAttribute: string;
  binAssignments: Map<number, string>;
  selectedShapeIdx: number | null;
  onSelectShape: (idx: number) => void;
  onSelectBin: (binLabel: string) => void;
}

const SortView: React.FC<SortViewProps> = ({
  shapes, bins, ruleAttribute, binAssignments, selectedShapeIdx,
  onSelectShape, onSelectBin,
}) => {
  return (
    <div className="space-y-4">
      {/* Rule badge */}
      <div className="flex justify-center">
        <Badge className="bg-cyan-500/20 border-cyan-400/30 text-cyan-300 text-xs capitalize">
          Sort by: {ruleAttribute}
        </Badge>
      </div>

      {/* Shapes tray */}
      <div className="flex justify-center gap-2 flex-wrap">
        {shapes.map((s, i) => {
          const isAssigned = binAssignments.has(i);
          const isActive = selectedShapeIdx === i;
          return (
            <button key={i} onClick={() => !isAssigned && onSelectShape(i)}
              className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all ${
                isAssigned ? 'border-emerald-400/30 bg-emerald-400/5 opacity-40' :
                isActive ? 'border-amber-400 bg-amber-400/10 scale-110' :
                'border-white/20 bg-white/5 hover:bg-white/10'
              }`}
              disabled={isAssigned}>
              <svg width={40} height={40} viewBox="0 0 40 40">
                {renderShapeSVG(s.shape, 20, 20, 20, s.color, s.rotation, { dimmed: isAssigned })}
              </svg>
            </button>
          );
        })}
      </div>

      {/* Bins — derived from shapes + ruleAttribute */}
      <div className="flex justify-center gap-3 flex-wrap">
        {bins.map((binLabel, i) => {
          const count = Array.from(binAssignments.values()).filter(b => b === binLabel).length;
          return (
            <button key={i} onClick={() => selectedShapeIdx !== null && onSelectBin(binLabel)}
              className={`px-4 py-3 rounded-xl border-2 min-w-[100px] transition-all ${
                selectedShapeIdx !== null
                  ? 'border-amber-400/50 bg-amber-400/5 hover:bg-amber-400/10 cursor-pointer'
                  : 'border-white/20 bg-white/5 cursor-default'
              }`}>
              <div className="text-sm font-medium text-slate-200">{binLabel}</div>
              <Badge className="mt-1 bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
                {count} shape{count !== 1 ? 's' : ''}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface ShapeSorterProps {
  data: ShapeSorterData;
  className?: string;
}

const ShapeSorter: React.FC<ShapeSorterProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Shared challenge progress ──────────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] || null;

  // ── Per-challenge state ────────────────────────────────────────
  const [identifySelected, setIdentifySelected] = useState<Set<number>>(new Set());
  const [tappedSides, setTappedSides] = useState<Set<number>>(new Set());
  const [showCorners, setShowCorners] = useState(false);
  const [sidesAnswer, setSidesAnswer] = useState('');
  const [cornersAnswer, setCornersAnswer] = useState('');
  const [binAssignments, setBinAssignments] = useState<Map<number, string>>(new Map());
  const [sortSelectedShape, setSortSelectedShape] = useState<number | null>(null);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // ── Refs & evaluation ──────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `shape-sorter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeSorterMetrics>({
    primitiveType: 'shape-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Code-derived computed values ───────────────────────────────

  /** Target indices for identify challenges — derived from ruleAttribute + targetValue */
  const targetIndices = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'identify') return new Set<number>();
    return new Set(
      currentChallenge.shapes
        .map((s, i) => isTargetShape(s, currentChallenge.ruleAttribute, currentChallenge.targetValue) ? i : -1)
        .filter(i => i >= 0)
    );
  }, [currentChallenge]);

  /** Bin labels for sort challenges — derived from shapes + ruleAttribute */
  const sortBins = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'sort') return [] as string[];
    const unique = new Set<string>();
    currentChallenge.shapes.forEach(s => unique.add(getShapeBinLabel(s, currentChallenge.ruleAttribute)));
    return Array.from(unique).sort();
  }, [currentChallenge]);

  /** Shape properties for count challenges */
  const countShape = currentChallenge?.type === 'count' ? currentChallenge.shapes[0] : null;
  const countProps = countShape ? SHAPE_PROPERTIES[countShape.shape] : null;

  // ── AI Tutoring ────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? '',
    ruleAttribute: currentChallenge?.ruleAttribute ?? '',
    targetValue: currentChallenge?.targetValue ?? '',
    shapeName: countShape?.shape,
    expectedSides: countProps?.sides,
    expectedCorners: countProps?.corners,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? '',
    attemptNumber: currentAttempts + 1,
  }), [currentChallenge, countShape, countProps, gradeBand, challenges.length, currentChallengeIndex, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'shape-sorter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity intro
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Shape Sorter activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering shape identification, property counting, and attribute-based sorting. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}). `
      + `Introduce warmly: "Let's explore shapes together!"`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Interaction handlers ───────────────────────────────────────

  const handleIdentifyToggle = useCallback((idx: number) => {
    if (hasSubmittedEvaluation) return;
    setIdentifySelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, [hasSubmittedEvaluation]);

  const handleTapSide = useCallback((idx: number) => {
    setTappedSides(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const handleSortSelectShape = useCallback((idx: number) => {
    if (hasSubmittedEvaluation) return;
    setSortSelectedShape(idx);
  }, [hasSubmittedEvaluation]);

  const handleSortSelectBin = useCallback((binLabel: string) => {
    if (sortSelectedShape === null) return;
    setBinAssignments(prev => {
      const next = new Map(prev);
      next.set(sortSelectedShape, binLabel);
      return next;
    });
    setSortSelectedShape(null);
  }, [sortSelectedShape]);

  // ── Check answer — all truth derived from SHAPE_PROPERTIES ────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    let correct = false;

    switch (currentChallenge.type) {
      case 'identify': {
        const selectedAll = Array.from(targetIndices).every(i => identifySelected.has(i));
        const noExtras = Array.from(identifySelected).every(i => targetIndices.has(i));
        correct = selectedAll && noExtras && targetIndices.size > 0;

        if (correct) {
          setFeedback(`Great! You found all the right shapes!`);
          setFeedbackType('success');
          sendText(`[ANSWER_CORRECT] Student correctly identified all shapes matching ${currentChallenge.ruleAttribute}=${currentChallenge.targetValue}. Congratulate briefly.`, { silent: true });
        } else {
          const missed = Array.from(targetIndices).filter(i => !identifySelected.has(i)).length;
          const extra = Array.from(identifySelected).filter(i => !targetIndices.has(i)).length;
          setFeedback(
            missed > 0
              ? `You missed ${missed} shape${missed > 1 ? 's' : ''}. Look more carefully!`
              : `${extra} shape${extra > 1 ? 's don\'t' : ' doesn\'t'} match. Try again!`
          );
          setFeedbackType('error');
          sendText(`[ANSWER_INCORRECT] Missed ${missed}, ${extra} extras. Rule: ${currentChallenge.ruleAttribute}=${currentChallenge.targetValue}. Attempt ${currentAttempts + 1}. Give a hint.`, { silent: true });
        }
        break;
      }

      case 'count': {
        const expSides = countProps?.sides ?? 0;
        const expCorners = countProps?.corners ?? 0;
        const sidesCorrect = parseInt(sidesAnswer) === expSides;
        const cornersCorrect = parseInt(cornersAnswer) === expCorners;
        correct = sidesCorrect && cornersCorrect;

        const shapeName = countShape?.shape ?? 'shape';
        if (correct) {
          setFeedback(`Yes! A ${shapeName} has ${expSides} sides and ${expCorners} corners!`);
          setFeedbackType('success');
          sendText(`[ANSWER_CORRECT] Student correctly counted ${expSides} sides and ${expCorners} corners for ${shapeName}. Reinforce the shape-property connection.`, { silent: true });
        } else {
          const hint = !sidesCorrect
            ? 'Check the sides again — try tapping each one.'
            : 'Check the corners again — look where the sides meet.';
          setFeedback(hint);
          setFeedbackType('error');
          sendText(`[ANSWER_INCORRECT] Student said ${sidesAnswer} sides, ${cornersAnswer} corners for ${shapeName} (expected ${expSides}/${expCorners}). Attempt ${currentAttempts + 1}. ${hint}`, { silent: true });
        }
        break;
      }

      case 'sort': {
        const shapes = currentChallenge.shapes;
        if (binAssignments.size < shapes.length) {
          setFeedback('Sort all shapes into bins first!');
          setFeedbackType('error');
          return;
        }
        const wrongCount = shapes.filter((s, i) =>
          binAssignments.get(i) !== getShapeBinLabel(s, currentChallenge.ruleAttribute)
        ).length;
        correct = wrongCount === 0;

        if (correct) {
          setFeedback('Amazing! You sorted all shapes correctly!');
          setFeedbackType('success');
          sendText(`[ANSWER_CORRECT] Student sorted all shapes correctly by ${currentChallenge.ruleAttribute}. Congratulate.`, { silent: true });
        } else {
          setFeedback(`${wrongCount} shape${wrongCount > 1 ? 's are' : ' is'} in the wrong bin. Try again!`);
          setFeedbackType('error');
          sendText(`[ANSWER_INCORRECT] ${wrongCount} shapes sorted incorrectly by ${currentChallenge.ruleAttribute}. Attempt ${currentAttempts + 1}. Hint about the sorting rule.`, { silent: true });
          setBinAssignments(new Map());
          setSortSelectedShape(null);
        }
        break;
      }
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        challengeType: currentChallenge.type,
      });
    }
  }, [
    currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText,
    identifySelected, targetIndices, sidesAnswer, cornersAnswer, countProps, countShape,
    binAssignments,
  ]);

  // ── Advance to next challenge ──────────────────────────────────
  const resetChallengeState = useCallback(() => {
    setIdentifySelected(new Set());
    setTappedSides(new Set());
    setShowCorners(false);
    setSidesAnswer('');
    setCornersAnswer('');
    setBinAssignments(new Map());
    setSortSelectedShape(null);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // Helper to calculate accuracy per challenge type
  const calcTypeAccuracy = useCallback((type: string): number => {
    const ofType = challenges.filter(c => c.type === type);
    if (ofType.length === 0) return 100;
    const correctCount = ofType.filter(c =>
      challengeResults.find(r => r.challengeId === c.id && r.correct)
    ).length;
    return Math.round((correctCount / ofType.length) * 100);
  }, [challenges, challengeResults]);

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their geometry skills!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const metrics: ShapeSorterMetrics = {
          type: 'shape-sorter',
          identifyAccuracy: calcTypeAccuracy('identify'),
          countAccuracy: calcTypeAccuracy('count'),
          sortAccuracy: calcTypeAccuracy('sort'),
          attemptsCount: totalAttempts,
        };

        submitEvaluation(overallPct >= 80, overallPct, metrics, { challengeResults });
      }
      return;
    }

    resetChallengeState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Introduce it briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex, resetChallengeState,
    calcTypeAccuracy,
  ]);

  // Auto-submit when complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ───────────────────────────────────────────────────
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete || hasSubmittedEvaluation) return false;
    switch (currentChallenge.type) {
      case 'identify': return identifySelected.size > 0;
      case 'count': return sidesAnswer !== '' && cornersAnswer !== '';
      case 'sort': return binAssignments.size === currentChallenge.shapes.length;
      default: return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, hasSubmittedEvaluation,
      identifySelected, sidesAnswer, cornersAnswer, binAssignments]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs capitalize">
                {currentChallenge.type}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge progress badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              if (!challenges.some(c => c.type === type)) return null;
              const isCurrent = currentChallenge?.type === type;
              return (
                <Badge key={type}
                  className={`text-xs ${isCurrent
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}>
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
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Challenge content */}
        {currentChallenge && !allChallengesComplete && (
          <>
            {currentChallenge.type === 'identify' && (
              <IdentifyView
                shapes={currentChallenge.shapes}
                targetIndices={targetIndices}
                selectedIndices={identifySelected}
                onToggle={handleIdentifyToggle}
              />
            )}
            {currentChallenge.type === 'count' && countShape && (
              <CountView
                shape={countShape}
                tappedSides={tappedSides}
                showCorners={showCorners}
                sidesAnswer={sidesAnswer}
                cornersAnswer={cornersAnswer}
                onTapSide={handleTapSide}
                onToggleCorners={() => setShowCorners(p => !p)}
                onSidesChange={setSidesAnswer}
                onCornersChange={setCornersAnswer}
              />
            )}
            {currentChallenge.type === 'sort' && (
              <SortView
                shapes={currentChallenge.shapes}
                bins={sortBins}
                ruleAttribute={currentChallenge.ruleAttribute}
                binAssignments={binAssignments}
                selectedShapeIdx={sortSelectedShape}
                onSelectShape={handleSortSelectShape}
                onSelectBin={handleSortSelectBin}
              />
            )}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer} disabled={!canCheck}>
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}>
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

        {/* Hint on repeated failure */}
        {currentChallenge && feedbackType === 'error' && currentAttempts >= 3 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">
              {currentChallenge.type === 'count'
                ? 'Try tapping each side one at a time, then count the corners where sides meet.'
                : currentChallenge.type === 'identify'
                ? 'Look carefully at each shape. Does it match the rule?'
                : 'Take your time and think about what makes each shape different.'}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Shape Sorting Complete!"
            celebrationMessage={`You completed all ${challenges.length} shape challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ShapeSorter;
