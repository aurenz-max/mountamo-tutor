'use client';

/**
 * Measurement Tools — a ruler session: each shape is put on the ruler (it snaps
 * with its left edge at 0), its length is read and checked; convert then changes
 * the checked length to the other unit, and compare ends by ordering the measured
 * shapes shortest to longest.
 *
 * Shared teaching workspace (W1, plain shape): `measurementToolsWorkspace.ts`
 * holds the items (one per shape, plus compare's ordering), the assignment, the
 * scene, the learner's work in words and the named miss. Under a live runtime the
 * tutor owns the item; the activity's own check commits through
 * `progress.commitCheck`, and the runtime owns Try again and Next.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MeasurementToolsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  INCH_TO_CM, ORDER_ITEM_ID, conversionCorrect, conversionTarget, describeMeasurementWork, lessonOf,
  measureCorrect, measurementItems, measurementMiss, orderChoices, orderCorrect, orderShapes, workspaceAssignment, workspaceScene,
  type MeasurementItem, type MeasurementView,
} from './measurementToolsWorkspace';
import {
  EDGE_LINE_LEVER, HALF_MARKS_LEVER, INCH_MODEL_LEVER, ORDER_STEPS_LEVER, OWN_LENGTHS_LEVER, PRACTICE_NOTE,
  SPACE_SHADING_LEVER, leverFacts, measurementLevers, practiceItem,
} from './measurementToolsLevers';

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

  // -- Support tier (within-mode scaffolding level; set by the generator) --
  // All fields are display-/instruction-only and default to the medium-tier
  // behavior when absent, so a no-tier session renders exactly as before.
  /** 'easy' | 'medium' | 'hard' — drives the live tutor's reveal calibration. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Ruler tick-label density. 'all' labels half ticks too; 'sparse' labels
   *  only even wholes so the student counts marks. Default 'whole'. */
  rulerLabels?: 'all' | 'whole' | 'sparse';
  /** How much the instruction spells out the align-at-0 / read-the-edge method.
   *  Default 'standard'. */
  instructionDetail?: 'full' | 'standard' | 'minimal';
  /** Attempts before the "Need a Hint?" button appears. Default 2. */
  hintThreshold?: number;
  /** convert mode: show the "1 inch = 2.54 cm" factor. Default true. */
  showConversionFactor?: boolean;

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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
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

/** A typed or stepped length; null while the box is empty or not a number. */
const parseLength = (text: string): number | null => {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : null;
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
  rulerY: number;
  /** Tick-label density (support-tier perception aid). 'all' labels half ticks
   *  too; 'sparse' labels only even wholes; 'whole' labels every whole. */
  labelMode?: 'all' | 'whole' | 'sparse';
  /** space_shading lever: every other whole-unit space tinted, the whole ruler's length (never the shape's). */
  shadeSpaces?: boolean;
  /** half_marks lever: the half ticks drawn taller and brighter. No label is added. */
  halfMarks?: boolean;
}

const Ruler: React.FC<RulerProps> = ({ lengthInches, unit, precision, pixelsPerUnit, leftPad, rulerY, labelMode = 'whole',
  shadeSpaces = false, halfMarks = false }) => {
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
      {shadeSpaces && Array.from({ length: Math.floor(lengthInches) }, (_, i) => i).filter((i) => i % 2 === 0).map((i) => (
        <rect key={`shade-${i}`} data-lever="space-shade" x={leftPad + i * pixelsPerUnit} y={rulerY + 1}
          width={pixelsPerUnit} height={28} fill="rgba(251,191,36,0.22)" />
      ))}
      {Array.from({ length: tickCount + 1 }, (_, i) => {
        const tickValue = i * step;
        if (tickValue > lengthInches) return null;
        const x = leftPad + tickValue * pixelsPerUnit;
        const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;

        // Tier-driven label density (perception aid). Withdrawing labels forces
        // the student to count marks — never changes the measurement itself.
        const showLabel = isWhole
          ? labelMode === 'sparse'
            ? Math.round(tickValue) % 2 === 0 // even wholes only (incl. 0)
            : true // 'whole' or 'all' → every whole labeled
          : labelMode === 'all'; // half ticks labeled only at the easy tier

        return (
          <g key={i}>
            <line
              x1={x}
              y1={rulerY}
              x2={x}
              y2={rulerY + (isWhole ? 28 : halfMarks ? 24 : 16)}
              stroke={!isWhole && halfMarks ? 'rgba(251,191,36,0.95)' : 'rgba(255,255,255,0.6)'}
              strokeWidth={isWhole ? 1.5 : halfMarks ? 2 : 0.8}
              {...(!isWhole && halfMarks ? { 'data-lever': 'half-mark' } : {})}
            />
            {showLabel && (
              <text
                x={x}
                y={rulerY + (isWhole ? 44 : 34)}
                textAnchor="middle"
                fill={isWhole ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)'}
                fontSize={isWhole ? 13 : 10}
                fontWeight={isWhole ? 'bold' : 'normal'}
                className="select-none"
              >
                {isWhole ? Math.round(tickValue) : tickValue}
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
// Lever pictures (`measurementToolsLevers.ts`). Each is drawn only while its lever is pulled; none writes a number.
// =============================================================================

/** inch_model: a bar one inch long over a centimeter scale, outside the item. Words only, no digit. */
const InchModel: React.FC = () => {
  const cm = 34;
  const inch = cm * 2.54;
  return (
    <div data-lever="inch-model" className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <svg width={cm * 3 + 24} height={64} viewBox={`0 0 ${cm * 3 + 24} 64`} aria-hidden="true">
        <rect x={12} y={6} width={inch} height={16} rx={3} fill="rgba(59,130,246,0.45)" stroke="rgba(147,197,253,0.8)" />
        <line x1={12} y1={34} x2={12 + cm * 3} y2={34} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={12 + i * cm} y1={30} x2={12 + i * cm} y2={46} stroke="rgba(251,191,36,0.9)" strokeWidth={1.5} />
        ))}
        <line x1={12 + inch} y1={4} x2={12 + inch} y2={50} stroke="rgba(147,197,253,0.8)" strokeDasharray="3 3" />
      </svg>
      <span className="text-xs text-slate-300">The blue bar is one inch. Each yellow space is one centimeter.</span>
    </div>
  );
};

/** order_steps: wordless bars growing short to long, the way the order runs. */
const OrderSteps: React.FC<{ count: number }> = ({ count }) => (
  <div data-lever="order-steps" aria-hidden="true" className="flex items-end gap-1.5 pl-1">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="h-2 rounded-sm bg-purple-300/60" style={{ width: `${14 + i * 14}px` }} />
    ))}
    <span className="text-purple-300/80 text-xs ml-1">→</span>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

const MeasurementToolsSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  MeasurementToolsProps & { tutorOwned: boolean; useController: (options: ProgressOptions<MeasurementItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    challengeType,
    challenges,
    rulerLengthInches,
    unit,
    precision,
    gradeBand,
    supportTier,
    rulerLabels = 'whole',
    instructionDetail = 'standard',
    hintThreshold = 2,
    showConversionFactor = true,
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

  /** What every item's check, scene and miss read from the session. */
  const lesson = useMemo(() => lessonOf(data), [data]);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  /** One item per shape, then compare's ordering. Memoized: a new array restarts the scripted progress. */
  const items = useMemo(() => measurementItems(challengeType, challenges), [challengeType, challenges]);

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

  // -- Progress. On the workspace path the runtime moves the index. ---------
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (item) => workspaceAssignment(item, lessonRef.current),
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, results: itemResults, isComplete: allItemsDone, mergeResult, advance, reset } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  /** The activity's own check is the workspace's checked gesture. A ref, so delayed callbacks read the latest. */
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  // Levers (`measurementToolsLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place. The tier's ruler labels and conversion hint are starting positions.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MeasurementItem | null>(null);
  const sessionItem = items[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const currentChallenge = currentItem?.kind === 'shape' ? currentItem.challenge : null;
  const currentChallengeId = currentChallenge?.id ?? null;
  const inOrderPhase = currentItem?.kind === 'order';
  /** The shapes the ordering asks about: a practice set, or the session's. */
  const orderList = useMemo(() => currentItem?.kind === 'order' ? orderShapes(currentItem, lesson) : [], [currentItem, lesson]);

  /** Per-shape results (the ordering is its own item). */
  const challengeResults = useMemo(
    () => itemResults.filter((r) => r.challengeId !== ORDER_ITEM_ID),
    [itemResults],
  );
  const orderResult = itemResults.find((r) => r.challengeId === ORDER_ITEM_ID);
  const measureComplete = challenges.length > 0
    && challenges.every((c) => challengeResults.some((r) => r.challengeId === c.id && r.correct));
  const comparisonDone = !!orderResult?.correct;
  const isFullyComplete = allItemsDone && measureComplete && (challengeType !== 'compare' || comparisonDone || challenges.length < 2);

  // Each challenge's effective phase label (used by PhaseSummaryPanel).
  // For a single-mode session this is always the same key, which renders as
  // one aggregate row — same shape as factor-tree (§6a #4).
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: isFullyComplete,
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

  // Compare mode ordering state (its own item)
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [compareFeedback, setCompareFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [compareAttempts, setCompareAttempts] = useState(0);
  const [hintsViewedSession, setHintsViewedSession] = useState(0);

  /** The compare buttons' order: never shortest to longest. */
  const orderButtons = useMemo(() => orderChoices(orderList), [orderList]);

  /** The shape back above the ruler. */
  const homePosition = useCallback((c: MeasurementToolsChallenge) => ({
    x: CANVAS_WIDTH / 2 - (c.widthInches * pixelsPerUnit) / 2, y: SHAPE_AREA_Y,
  }), [pixelsPerUnit]);
  /** Where the shape is drawn: where it was dragged or snapped, else home. */
  const positionOf = (c: MeasurementToolsChallenge) => shapePositions[c.id] ?? homePosition(c);

  /**
   * The item blank: a fresh shape or the scripted reset. Try again on the workspace path (`retry`) clears only the
   * checked answer: the shape stays on the ruler (the snap puts its left edge at 0, so the placement is never the
   * miss), and after a wrong conversion the checked measurement stays, so only the conversion is asked again.
   */
  const clearWork = useCallback((retry: boolean) => {
    setAnswerInput('');
    setFeedback(null);
    setConvertInput('');
    setConvertFeedback(null);
    setSelectedOrder([]);
    setCompareFeedback(null);
    recordedRef.current = false;
    setIsDragging(false);
    if (!retry) {
      setConvertStep(false);
      setMeasuredValue(0);
      // Every shape back above the ruler (a missing position is the home one), so a practice shape and the full
      // item it stands in for both open blank.
      setShapePositions({});
      setOnRuler({});
    }
  }, []);
  // A fresh item (or the full item back after a practice item) drops the practice; Try again keeps it.
  openItem.current = (retry) => { clearWork(retry); if (!retry) setPractice(null); };

  // -- Per-challenge reset (canonical pattern, §6c) -------------------------
  // Runs whenever the index moves — resets every per-item slot.
  useEffect(() => {
    if (!currentItem) return;
    setShowHint(false);
    setMeasureAttempts(0);
    measureAttemptsRef.current = 0;
    setConvertAttempts(0);
    convertAttemptsRef.current = 0;
    hintViewedRef.current = false;
    clearWork(false);
  }, [currentItem?.id, pixelsPerUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize shape positions for all challenges on mount / data swap
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    challenges.forEach((c) => { positions[c.id] = homePosition(c); });
    setShapePositions(positions);
    setOnRuler({});
  }, [challenges, homePosition]);

  /** The learner's work as the check reads it, as of the last render. */
  const view: MeasurementView = {
    onRuler: !!(currentChallenge && onRuler[currentChallenge.id]),
    measure: parseLength(answerInput),
    convertStep,
    converted: parseLength(convertInput),
    order: selectedOrder,
  };
  const viewRef = useRef(view);
  viewRef.current = view;

  // -- Support-tier reveal calibration for the live tutor (Gotcha #2) -------
  // The tutor sees the full challenge data and could leak what a hard tier hid
  // on screen (the align-at-0/read-edge method; the conversion factor). These
  // clauses calibrate how much the tutor may name at each tier.
  const measureRevealClause = useMemo(() => {
    if (supportTier === 'easy')
      return ' (Tier EASY: you may name the method — line the left edge up with 0, then read where the right edge lands — but never state the measurement.)';
    if (supportTier === 'hard')
      return ' (Tier HARD: the step-by-step method is hidden on screen on purpose — do NOT spell out align-at-0/read-the-edge. Ask what they see at the shape\'s right edge. Never reveal the measurement.)';
    return ' (Tier MEDIUM: nudge where to look on the ruler without walking every step or revealing the measurement.)';
  }, [supportTier]);

  const convertRevealClause = useMemo(() => {
    if (supportTier === 'easy')
      return ' (Tier EASY: you may restate 1 inch = 2.54 cm and name multiply vs divide, but never the final number.)';
    if (supportTier === 'hard')
      return ' (Tier HARD: the conversion factor is hidden on screen on purpose — do NOT state "1 inch = 2.54 cm" or which operation. Ask what they recall about inches and centimeters. Never reveal the answer.)';
    return ' (Tier MEDIUM: nudge the operation and rough size without restating the full rule or the answer.)';
  }, [supportTier]);

  // -- AI Tutoring (scripted path) ------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    currentShape: currentChallenge?.label,
    shapeWidth: currentChallenge?.widthInches,
    unit,
    precision,
    gradeBand,
    supportTier: supportTier ?? 'medium',
    isOnRuler: currentChallenge ? !!onRuler[currentChallenge.id] : false,
    currentAttempts: measureAttempts + convertAttempts,
    convertStep,
    convertToUnit: effectiveConvertToUnit,
    comparePhase: inOrderPhase,
  }), [
    challengeType, currentIndex, challenges.length, currentChallenge, unit, precision,
    gradeBand, supportTier, onRuler, measureAttempts, convertAttempts, convertStep,
    effectiveConvertToUnit, inOrderPhase,
  ]);

  // Its context carries the widths, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? '1st Grade' : '3rd Grade',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

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

  // -- Placing the shape ----------------------------------------------------
  /** Snaps the current shape onto the ruler, its left edge at 0. */
  const placeOnRuler = useCallback(() => {
    if (!currentChallenge || hasSubmitted || convertStep || learnerBlocked()) return;
    SoundManager.snap();
    const shapeH = Math.max(currentChallenge.heightInches * pixelsPerUnit, 36);
    setShapePositions((prev) => ({
      ...prev,
      [currentChallenge.id]: { x: RULER_LEFT_PAD, y: rulerY - shapeH - 2 },
    }));
    setOnRuler((prev) => ({ ...prev, [currentChallenge.id]: true }));
    if (!onRuler[currentChallenge.id]) {
      sendText(
        `[SHAPE_PLACED] Student placed "${currentChallenge.label}" on the ruler. ` +
        `Ask: "How many ${unit} long is this shape?"`,
        { silent: true },
      );
    }
  }, [currentChallenge, hasSubmitted, convertStep, pixelsPerUnit, rulerY, onRuler, sendText, unit]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!currentChallenge || hasSubmitted || convertStep || learnerBlocked()) return;
    e.preventDefault();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const pos = positionOf(currentChallenge);
    if (!pos) return;
    setDragOffset({ x: svgPt.x - pos.x, y: svgPt.y - pos.y });
    setIsDragging(true);
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
  }, [currentChallenge, hasSubmitted, convertStep, getSVGPoint, shapePositions]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const pos = positionOf(currentChallenge);
    if (!pos) return;

    const shapeH = Math.max(currentChallenge.heightInches * pixelsPerUnit, 36);
    const shapeBottom = pos.y + shapeH;
    const snapZoneTop = rulerY - 50;

    if (shapeBottom >= snapZoneTop && pos.y < rulerY) {
      placeOnRuler();
    } else if (pos.y >= rulerY + RULER_HEIGHT) {
      setShapePositions((prev) => ({ ...prev, [currentChallenge.id]: homePosition(currentChallenge) }));
      setOnRuler((prev) => ({ ...prev, [currentChallenge.id]: false }));
    }
  }, [isDragging, currentChallenge, shapePositions, pixelsPerUnit, rulerY, placeOnRuler, homePosition]);

  // -- Helpers --------------------------------------------------------------
  /**
   * The shape's own score fields beside the result `commitCheck` records, then (scripted path) the move on.
   * Stale-state guard (§6a #8): bail if already recorded for this challenge.
   */
  const completeChallenge = useCallback((opts: { studentMeasure: number }) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    recordedRef.current = true;
    // An easier practice item (a simplify lever) is not the session's shape: it records nothing.
    if (practice) return;

    const mAttempts = Math.max(1, measureAttemptsRef.current);
    const score = challengeType === 'convert'
      ? Math.round(phaseScore(mAttempts) * 0.5 + phaseScore(Math.max(1, convertAttemptsRef.current)) * 0.5)
      : phaseScore(mAttempts);

    mergeResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: mAttempts + (challengeType === 'convert' ? convertAttemptsRef.current : 0),
      score,
      studentAnswer: opts.studentMeasure,
      targetAnswer: currentChallenge.widthInches,
    });

    // The runtime advances on the workspace path; the scripted path moves on after the celebration.
    if (tutorOwned) return;
    setTimeout(() => {
      if (!advance()) return;
      const next = items[currentIndex + 1];
      if (next?.kind === 'shape') {
        sendText(
          `[NEXT_ITEM] Shape ${currentIndex + 2} of ${challenges.length}: "${next.challenge.label}". ` +
          (challengeType === 'convert' ? 'Measure it and convert!' : 'Say: "Next shape! Drag it onto the ruler to measure."'),
          { silent: true },
        );
      } else if (next?.kind === 'order') {
        sendText(
          `[MEASURE_PHASE_DONE] All shapes measured. Comparison phase begins. ` +
          `Explain: "Great measuring! Now order the shapes shortest to longest."`,
          { silent: true },
        );
      }
    }, 1100);
  }, [currentChallenge, practice, challengeType, mergeResult, tutorOwned, advance, items, currentIndex, challenges.length, sendText]);

  // -- Answer checking (measure step) ---------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentChallenge || learnerBlocked() || recordedRef.current) return;

    const studentNum = parseLength(answerInput);
    if (studentNum === null) {
      setFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    const nextAttempts = measureAttemptsRef.current + 1;
    measureAttemptsRef.current = nextAttempts;
    setMeasureAttempts(nextAttempts);

    const isCorrect = measureCorrect(currentChallenge, lesson, studentNum);
    const work = { ...viewRef.current, measure: studentNum };

    if (challengeType === 'convert' && isCorrect) {
      // The measurement is the first step of a convert item, not its answer: the conversion opens, nothing commits.
      SoundManager.playCorrect();
      setMeasuredValue(currentChallenge.widthInches);
      setFeedback(null);
      setConvertStep(true);
      setConvertInput('');
      setConvertFeedback(null);
      sendText(
        `[MEASURE_CORRECT] Student measured "${currentChallenge.label}" as ${studentNum} ${unit}. ` +
        `Now convert to ${effectiveConvertToUnit}. Encourage them.`,
        { silent: true },
      );
      return;
    }

    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    commitCheck.current(describeMeasurementWork(currentItem!, lesson, work), isCorrect,
      isCorrect ? undefined : measurementMiss(currentItem, lesson, work));

    if (isCorrect) {
      SoundManager.playCorrect();
      completeChallenge({ studentMeasure: studentNum });
      setFeedback({
        message: `Yes! The ${currentChallenge.label} is ${currentChallenge.widthInches} ${unit} long!`,
        correct: true,
      });
      sendText(
        `[ANSWER_CORRECT] Student measured "${currentChallenge.label}" as ${studentNum} ${unit}. ` +
        `Correct: ${currentChallenge.widthInches} ${unit}. Attempts: ${nextAttempts}. Brief celebration.`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback({
        message: 'Not quite — look at the ruler more carefully!',
        correct: false,
      });
      sendText(
        `[ANSWER_INCORRECT] Student guessed ${studentNum} ${unit} for "${currentChallenge.label}" ` +
        `(actual: ${currentChallenge.widthInches} ${unit}). Attempt ${nextAttempts}. Give a hint.` +
        measureRevealClause,
        { silent: true },
      );
    }
  }, [
    currentChallenge, currentItem, answerInput, lesson, unit, challengeType, effectiveConvertToUnit,
    completeChallenge, sendText, measureRevealClause,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Conversion checking (convert mode) -----------------------------------
  const checkConversion = useCallback(() => {
    if (!currentChallenge || learnerBlocked() || recordedRef.current) return;

    const studentNum = parseLength(convertInput);
    if (studentNum === null) {
      setConvertFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    const nextAttempts = convertAttemptsRef.current + 1;
    convertAttemptsRef.current = nextAttempts;
    setConvertAttempts(nextAttempts);

    const correctConverted = conversionTarget(currentChallenge, lesson);
    const isCorrect = conversionCorrect(currentChallenge, lesson, studentNum);
    const work = { ...viewRef.current, convertStep: true, converted: studentNum };
    commitCheck.current(describeMeasurementWork(currentItem!, lesson, work), isCorrect,
      isCorrect ? undefined : measurementMiss(currentItem, lesson, work));

    if (isCorrect) {
      SoundManager.playCorrect();
      completeChallenge({ studentMeasure: measuredValue });
      setConvertFeedback({
        message: `Correct! ${measuredValue} ${unit} = ${Math.round(correctConverted * 10) / 10} ${effectiveConvertToUnit}!`,
        correct: true,
      });
      sendText(
        `[CONVERT_CORRECT] Student converted ${measuredValue} ${unit} to ${studentNum} ${effectiveConvertToUnit}. ` +
        `Brief celebration.`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      // The rule is named only where the session shows it; at the hard tier the learner recalls it.
      setConvertFeedback({
        message: !showConversionFactor
          ? 'Not quite. Think about how inches and centimeters compare.'
          : effectiveConvertToUnit === 'centimeters'
            ? `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try multiplying!`
            : `Not quite. Remember: 1 inch = ${INCH_TO_CM} centimeters. Try dividing!`,
        correct: false,
      });
      sendText(
        `[CONVERT_INCORRECT] Student tried ${studentNum} ${effectiveConvertToUnit} ` +
        `(correct: ~${Math.round(correctConverted * 10) / 10}). Attempt ${nextAttempts}. Help without revealing.` +
        convertRevealClause,
        { silent: true },
      );
    }
  }, [
    currentChallenge, currentItem, convertInput, measuredValue, unit, effectiveConvertToUnit, lesson,
    showConversionFactor, completeChallenge, sendText, convertRevealClause,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Comparison checking (compare mode's last item) -----------------------
  /** The ordering on screen is solved: the session's, or a practice set's. */
  const orderSolved = compareFeedback?.correct === true || (!practice && comparisonDone);
  const handleOrderTap = (id: string) => {
    if (learnerBlocked() || orderSolved || selectedOrder.includes(id)) return;
    SoundManager.select();
    setSelectedOrder((prev) => [...prev, id]);
  };

  const handleComparisonCheck = useCallback(() => {
    if (!currentItem || currentItem.kind !== 'order' || learnerBlocked() || orderSolved) return;
    const isCorrect = orderCorrect(orderList, selectedOrder);
    const work = { ...viewRef.current, order: selectedOrder };
    if (!practice) setCompareAttempts((a) => a + 1);
    commitCheck.current(describeMeasurementWork(currentItem, lesson, work), isCorrect,
      isCorrect ? undefined : measurementMiss(currentItem, lesson, work));

    if (isCorrect) {
      SoundManager.playCorrect();
      setCompareFeedback({ message: 'Perfect! You ordered them shortest to longest!', correct: true });
      const orderLabels = selectedOrder.map((id) => orderList.find((c) => c.id === id)?.label).join(' → ');
      sendText(
        `[COMPARE_CORRECT] Student ordered shapes correctly: ${orderLabels}. Celebrate!`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setCompareFeedback({ message: 'Not quite! Think back to which shapes were shorter.', correct: false });
      // The scripted path starts the order over; the workspace keeps the taps on screen until Try again.
      if (!tutorOwned) setSelectedOrder([]);
      sendText(
        `[COMPARE_INCORRECT] Student ordered incorrectly. Attempt ${compareAttempts + 1}. Remind without revealing.`,
        { silent: true },
      );
    }
  }, [currentItem, practice, lesson, orderList, selectedOrder, orderSolved, compareAttempts, tutorOwned, sendText]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Hint tracking --------------------------------------------------------
  const showHintHandler = useCallback(() => {
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      setHintsViewedSession((n) => n + 1);
    }
  }, []);

  // -- Evaluation on completion (scripted path) -----------------------------
  const submittedRef = useRef(false);
  useEffect(() => {
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned || !isFullyComplete || hasSubmitted || submittedRef.current) return;
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
    tutorOwned, isFullyComplete, hasSubmitted, challengeResults, challenges.length, challengeType,
    comparisonDone, compareAttempts, hintsViewedSession, submitResult, phaseResults, sendText,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || submittedRef.current || items.length === 0) return;
    submittedRef.current = true;
    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      challengeType,
      totalChallenges: items.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: hintsViewedSession,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / items.length) * 10) / 10,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -- Reset (scripted path) ------------------------------------------------
  const handleReset = () => {
    reset();
    resetAttempt();
    submittedRef.current = false;
    setShowHint(false);
    setMeasureAttempts(0);
    measureAttemptsRef.current = 0;
    setConvertAttempts(0);
    convertAttemptsRef.current = 0;
    setCompareAttempts(0);
    setHintsViewedSession(0);
    hintViewedRef.current = false;
    hasIntroducedRef.current = false;
    clearWork(false);
    const positions: Record<string, { x: number; y: number }> = {};
    challenges.forEach((c) => { positions[c.id] = homePosition(c); });
    setShapePositions(positions);
    setOnRuler({});
  };

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation; every mode declares levers (`measurementToolsLevers.ts`), none during a practice item.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem || !sessionItem) return;
    const scene = workspaceScene(currentItem, lesson, viewRef.current);
    const leverView = { convertStep: viewRef.current.convertStep };
    const onScreen = practice ? '' : leverFacts(sessionItem, pulledLevers, leverView);
    const levers = practice ? [] : measurementLevers(sessionItem, lesson, pulledLevers, leverView);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === EDGE_LINE_LEVER && !viewRef.current.onRuler)
          return 'The shape is not on the ruler yet: the learner puts it on first, then the line can drop from its edge.';
        const pulled = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionItem, lesson);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); clearWork(false); setPractice(easier);
          return { practice: workspaceAssignment(easier, lesson) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearWork(false); setPractice(null); },
    };
  });

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
  // The align-at-0 / read-the-edge method is the core instructional scaffold.
  // 'full' (easy) names it explicitly; 'minimal' (hard) withholds it so the
  // student recalls the method. The shape + unit never change across tiers.
  const methodCue = instructionDetail === 'full'
    ? ` Line up its left edge with 0, then read where the right edge lands.`
    : '';

  const getInstructionText = (): string => {
    if (!currentChallenge) return '';
    if (challengeType === 'compare') {
      if (instructionDetail === 'minimal') return `Measure each shape with the ruler. Then you'll compare them.`;
      return `Measure each shape by putting it on the ruler.${methodCue} After measuring all shapes, you'll compare them!`;
    }
    if (challengeType === 'convert') {
      if (convertStep) return `Convert your measurement of the ${currentChallenge.label} from ${unit} to ${effectiveConvertToUnit}.`;
      if (instructionDetail === 'minimal') return `Measure the ${currentChallenge.label} in ${unit}.`;
      return `Put the ${currentChallenge.label} on the ruler and measure it in ${unit}.${methodCue}`;
    }
    if (instructionDetail === 'minimal') return `Measure the ${currentChallenge.label} in ${unit}.`;
    return `Put the ${currentChallenge.label} on the ruler, then tell me how many ${unit} long it is.${methodCue}`;
  };

  const getSubtitle = (): string => {
    if (isFullyComplete) return 'Complete!';
    if (inOrderPhase) return 'Order the shapes from shortest to longest';
    if (challengeType === 'convert' && convertStep) return 'Convert your measurement';
    return 'Put the shape on the ruler to measure it';
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
  const shapeRecorded = !!currentChallenge && completedIds.has(currentChallenge.id);
  const measureLocked = hasSubmitted || shapeRecorded || feedback?.correct === true;
  const convertLocked = hasSubmitted || shapeRecorded || convertFeedback?.correct === true;

  // -- Render ---------------------------------------------------------------
  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: isFullyComplete || hasSubmitted ? null : inOrderPhase ? 'compare' : currentChallenge?.id ?? null,
    label: 'The measuring workspace',
    solved: inOrderPhase ? comparisonDone : convertStep ? convertFeedback?.correct === true : feedback?.correct === true,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getModeIcon()}</span>
            <div>
              <LuminaCardTitle>
                {title || 'Measurement Tools'}
              </LuminaCardTitle>
              <p className="text-sm text-slate-400 mt-0.5">{getSubtitle()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue">{unit}</LuminaBadge>
            {challengeType === 'convert' && (
              <LuminaBadge accent="amber">→ {effectiveConvertToUnit}</LuminaBadge>
            )}
            <LuminaBadge>Grades {gradeBand}</LuminaBadge>
          </div>
        </div>

        {/* Progress dots — bespoke interaction-state strip (per-shape + compare phase) */}
        <div className="flex items-center gap-2 mt-4">
          {challenges.map((c) => (
            <div
              key={c.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                completedIds.has(c.id)
                  ? 'bg-emerald-500'
                  : c.id === currentChallengeId
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
                  : inOrderPhase
                    ? 'bg-purple-400 animate-pulse'
                    : 'bg-slate-700'
              }`}
            />
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
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

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !isFullyComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* COMPARE — ordering, the session's last item */}
        {inOrderPhase && !isFullyComplete && (
          <div className="space-y-4">
            <LuminaPrompt accent="purple">
              <p className="text-purple-200 font-medium mb-1">Order the shapes from shortest to longest</p>
              <p className="text-slate-400 text-sm font-normal">
                {practice ? 'Practice: each shape is drawn to scale.' : 'Each shape is shown at the size you measured.'}{' '}
                Click the shortest first, then the next shortest, and so on.
              </p>
            </LuminaPrompt>

            {leverOn(ORDER_STEPS_LEVER) && <OrderSteps count={orderList.length} />}

            {selectedOrder.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-slate-500 text-xs">Your order (shortest → longest):</span>
                <div className="space-y-1.5">
                  {selectedOrder.map((id, i) => {
                    const c = orderList.find((c) => c.id === id);
                    if (!c) return null;
                    return (
                      <LuminaPanel
                        key={id}
                        accent="purple"
                        className="flex items-center gap-3 pl-3 pr-4 py-1.5"
                      >
                        <span className="text-purple-300 text-sm font-bold w-5 flex-shrink-0">{i + 1}.</span>
                        <ShapePreview challenge={c} />
                        <span className="text-slate-200 text-sm">{c.label}</span>
                        {leverOn(OWN_LENGTHS_LEVER) && (
                          <span data-lever="own-length" className="text-blue-300 text-xs ml-auto">{c.widthInches} {unit}</span>
                        )}
                      </LuminaPanel>
                    );
                  })}
                </div>
              </div>
            )}

            {orderButtons.some((c) => !selectedOrder.includes(c.id)) && (
              <div className="space-y-1.5">
                <span className="text-slate-500 text-xs">
                  {selectedOrder.length === 0
                    ? 'Click the shortest shape first:'
                    : 'Click the next shortest:'}
                </span>
                <div className="space-y-1.5">
                  {orderButtons
                    .filter((c) => !selectedOrder.includes(c.id))
                    .map((c) => (
                      <LuminaButton
                        key={c.id}
                        type="button"
                        aria-label={c.label}
                        onClick={() => handleOrderTap(c.id)}
                        className="w-full flex items-center justify-start gap-3 h-auto pl-3 pr-4 py-1.5 text-left hover:border-purple-400/40"
                      >
                        <ShapePreview challenge={c} interactive />
                        <span className="text-slate-200 text-sm">{c.label}</span>
                        {leverOn(OWN_LENGTHS_LEVER) && (
                          <span data-lever="own-length" className="text-blue-300 text-xs ml-auto">{c.widthInches} {unit}</span>
                        )}
                      </LuminaButton>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {selectedOrder.length > 0 && !orderSolved && (
                <LuminaButton
                  tone="subtle"
                  onClick={() => { if (learnerBlocked()) return; setSelectedOrder([]); setCompareFeedback(null); }}
                >
                  Reset Order
                </LuminaButton>
              )}
              {selectedOrder.length === orderList.length && !orderSolved && (
                <LuminaActionButton action="check" onClick={handleComparisonCheck}>
                  Check Order
                </LuminaActionButton>
              )}
            </div>

            {compareFeedback && (
              <LuminaFeedbackCard status={compareFeedback.correct ? 'correct' : 'incorrect'}>
                {compareFeedback.message}
              </LuminaFeedbackCard>
            )}
          </div>
        )}

        {/* ACTIVE WORKSPACE — Measure step (all modes) */}
        {currentChallenge && !isFullyComplete && (
          <>
            <LuminaPrompt accent="blue">
              <p className="text-blue-200 text-sm font-medium">
                {practice ? <span data-practice>Practice shape</span> : <>Shape {currentIndex + 1} of {challenges.length}</>}
              </p>
              <p className="text-slate-200 mt-1 font-normal">{getInstructionText()}</p>
            </LuminaPrompt>

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
                    labelMode={rulerLabels}
                    shadeSpaces={leverOn(SPACE_SHADING_LEVER)}
                    halfMarks={leverOn(HALF_MARKS_LEVER)}
                  />

                  {currentChallenge && (
                    <DraggableShape
                      challenge={currentChallenge}
                      pixelsPerUnit={pixelsPerUnit}
                      isOnRuler={!!onRuler[currentChallenge.id]}
                      position={positionOf(currentChallenge)}
                      onDragStart={handleDragStart}
                      isDragging={isDragging}
                      isActive={true}
                      isCompleted={false}
                    />
                  )}
                  {leverOn(EDGE_LINE_LEVER) && onRuler[currentChallenge.id] && (
                    <line data-lever="edge-line" x1={RULER_LEFT_PAD + currentChallenge.widthInches * pixelsPerUnit}
                      x2={RULER_LEFT_PAD + currentChallenge.widthInches * pixelsPerUnit}
                      y1={positionOf(currentChallenge).y} y2={rulerY + RULER_HEIGHT}
                      stroke="rgba(251,191,36,0.9)" strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />
                  )}
                </svg>
              </div>
            )}

            {/* The drag's tap-and-keyboard twin: the same snap, left edge at 0. */}
            {!onRuler[currentChallenge.id] && !convertStep && (
              <div className="flex justify-center">
                <LuminaButton tone="subtle" onClick={placeOnRuler} disabled={hasSubmitted}>
                  Put it on the ruler
                </LuminaButton>
              </div>
            )}

            {/* Measure entry (shape on ruler, not in convert step) */}
            {onRuler[currentChallenge.id] && !convertStep && (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-slate-300 text-sm">How many {unit} long?</span>
                  <div className="flex items-center gap-2">
                    <LuminaButton
                      className="h-11 w-11 text-slate-200 text-lg font-bold p-0"
                      aria-label={`Less, by ${measureStep === 0.5 ? 'a half' : 'one'}`}
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.tick();
                        const cur = parseLength(answerInput) ?? 0;
                        setAnswerInput(String(Math.max(0, +(cur - measureStep).toFixed(1))));
                      }}
                      disabled={measureLocked || (parseLength(answerInput) ?? 0) <= 0}
                    >
                      &minus;
                    </LuminaButton>
                    <LuminaInput
                      type="text"
                      inputMode="decimal"
                      aria-label={`Length in ${unit}`}
                      value={answerInput}
                      placeholder="0"
                      disabled={measureLocked}
                      onChange={(e) => { if (!learnerBlocked()) setAnswerInput(e.target.value.replace(/[^0-9.]/g, '')); }}
                      className="w-20 text-center text-2xl font-bold text-blue-300 tabular-nums px-2"
                    />
                    <LuminaButton
                      className="h-11 w-11 text-slate-200 text-lg font-bold p-0"
                      aria-label={`More, by ${measureStep === 0.5 ? 'a half' : 'one'}`}
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.tick();
                        const cur = parseLength(answerInput) ?? 0;
                        setAnswerInput(String(Math.min(rulerLengthInches, +(cur + measureStep).toFixed(1))));
                      }}
                      disabled={measureLocked}
                    >
                      +
                    </LuminaButton>
                  </div>
                  <LuminaActionButton
                    action="check"
                    className="mt-1"
                    onClick={checkAnswer}
                    disabled={measureLocked || (parseLength(answerInput) ?? 0) <= 0}
                  >
                    Check Answer
                  </LuminaActionButton>
                </div>

                {feedback && (
                  <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'}>
                    {feedback.message}
                  </LuminaFeedbackCard>
                )}

                {showHint && (
                  <LuminaPrompt accent="amber">
                    <p className="text-amber-200 text-sm font-normal">{currentChallenge.hint}</p>
                  </LuminaPrompt>
                )}

                {!feedback?.correct && measureAttempts >= hintThreshold && !showHint && (
                  <div className="flex justify-center">
                    <LuminaButton tone="subtle" onClick={showHintHandler}>
                      Need a Hint?
                    </LuminaButton>
                  </div>
                )}
              </div>
            )}

            {/* CONVERT step (after correct measurement in convert mode) */}
            {convertStep && currentChallenge && (
              <div className="space-y-3">
                <LuminaPrompt accent="amber">
                  <p className="text-amber-200 font-medium mb-1">Convert your measurement!</p>
                  <p className="text-slate-200 mt-1 font-normal">
                    The <span className="text-amber-300 font-medium">{currentChallenge.label}</span> is{' '}
                    <span className="text-blue-300 font-bold">{measuredValue} {unit}</span>.{' '}
                    How many <span className="text-amber-300 font-medium">{effectiveConvertToUnit}</span> is that?
                  </p>
                  {/* Conversion factor = convert mode's keystone scaffold.
                      Withdrawn at the hard tier so the student recalls it. */}
                  {showConversionFactor && (
                    <p className="text-slate-500 text-xs mt-2 font-normal">
                      {unit === 'inches'
                        ? `Hint: 1 inch = ${INCH_TO_CM} centimeters`
                        : `Hint: 1 inch = ${INCH_TO_CM} centimeters (divide to get inches)`}
                    </p>
                  )}
                </LuminaPrompt>

                {leverOn(INCH_MODEL_LEVER) && <InchModel />}

                <div className="flex flex-col items-center gap-2">
                  <span className="text-slate-300 text-sm">How many {effectiveConvertToUnit}?</span>
                  <div className="flex items-center gap-2">
                    <LuminaButton
                      className="h-11 w-11 text-slate-200 text-lg font-bold p-0"
                      aria-label="Less, by a half"
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.tick();
                        const cur = parseLength(convertInput) ?? 0;
                        setConvertInput(String(Math.max(0, +(cur - convertStepSize).toFixed(1))));
                      }}
                      disabled={convertLocked || (parseLength(convertInput) ?? 0) <= 0}
                    >
                      &minus;
                    </LuminaButton>
                    <LuminaInput
                      type="text"
                      inputMode="decimal"
                      aria-label={`Length in ${effectiveConvertToUnit}`}
                      value={convertInput}
                      placeholder="0"
                      disabled={convertLocked}
                      onChange={(e) => { if (!learnerBlocked()) setConvertInput(e.target.value.replace(/[^0-9.]/g, '')); }}
                      className="w-24 text-center text-2xl font-bold text-amber-300 tabular-nums px-2"
                    />
                    <LuminaButton
                      className="h-11 w-11 text-slate-200 text-lg font-bold p-0"
                      aria-label="More, by a half"
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.tick();
                        const cur = parseLength(convertInput) ?? 0;
                        setConvertInput(String(+(cur + convertStepSize).toFixed(1)));
                      }}
                      disabled={convertLocked}
                    >
                      +
                    </LuminaButton>
                  </div>
                  <LuminaActionButton
                    action="check"
                    className="mt-1"
                    onClick={checkConversion}
                    disabled={convertLocked || (parseLength(convertInput) ?? 0) <= 0}
                  >
                    Check Conversion
                  </LuminaActionButton>
                </div>

                {convertFeedback && (
                  <LuminaFeedbackCard status={convertFeedback.correct ? 'correct' : 'incorrect'}>
                    {convertFeedback.message}
                  </LuminaFeedbackCard>
                )}
              </div>
            )}
          </>
        )}

        </div>

        {isFullyComplete && !tutorOwned && (
          <div className="flex justify-center">
            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose auto-advance would compete with the observer.
const MeasurementTools = withWorkspaceController<MeasurementToolsProps, ProgressOptions<MeasurementItem>, Progress>(
  'measurement-tools', MeasurementToolsSurface, useScriptedProgress, useWorkspaceProgressFor('measurement-tools'));

export default MeasurementTools;
