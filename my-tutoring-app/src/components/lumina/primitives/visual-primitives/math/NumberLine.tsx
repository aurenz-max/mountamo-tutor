'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaModeTabs,
  LuminaChoiceChip,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberLineMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { isFindBetweenAnswerCorrect, isPlotPlacementCorrect, isSnappedPlacementExact } from './numberLineGrading';
import { buildJumpDiagnosisEvidence, jumpFirstResponseScore, jumpResponseFor, type JumpResponse } from './numberLineEvidence';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { buildHopsScene, describeLine, workspaceScene, type NumberLineView } from './numberLineWorkspace';
import { HOPS_LEVER, NUMBER_LINE_LEVERS, WAY_LEVER, WAYS_LEVER, learnerHops, modelHop, wayArrow, type Hop,
  type NumberLineLeverContext } from './numberLineLevers';
import { ARROW_LEVER, COUNT_LEVER, ENDS_LEVER, LAST_TRY_LEVER, lastTry, countModelHop, countStart, countTarget, endMarks,
  helpStartsShown, lineMiss } from './numberLineLevers';
import { autoView, getSnapPrecision, lineTicks, settledView } from './numberLineView';
import { BUILD_HOPS, MAX_HOP, buildHopsFeedback, buildHopsMiss, describeHops, hopsTaskOf, landingOf, waysModel } from './numberLineBuildHops';
import { hopBuildResponseFor, type HopBuildResponse } from './numberLineEvidence';
import { numberLineBoss } from './numberLine.boss';
import { useBuildWatcher } from '../../build-layer/buildLayer';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberLineOperation {
  type: 'add' | 'subtract';
  startValue: number;
  changeValue: number;
  showJumpArc: boolean;
}

export interface NumberLineChallenge {
  id: string;
  /** `build_hops` is the open build (`numberLineBuildHops.ts`): the learner chooses the hops. */
  type: 'plot_point' | 'show_jump' | 'order_values' | 'find_between' | 'build_hops';
  instruction: string;
  /** build_hops: how many hops the ask names (2, or 3 at the hard tier). The target is `targetValues[0]`. */
  hopCount?: number;
  targetValues: number[];
  /**
   * Optional stronger answer contract for find_between. When present, the two
   * targetValues are visible neighboring bounds and this is the one missing
   * value the student must place. Absent preserves legacy any-interior grading.
   */
  exactTargetValue?: number;
  hint: string;
  /** Starting position for show_jump challenges */
  startValue?: number;
  /** Per-challenge operations for show_jump challenges */
  operations?: NumberLineOperation[];
  /** show_jump picked from an item space (service/itemSpace): strand, structure, predicted beta. For
   *  calibration only; never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
  /**
   * Per-challenge benchmark anchor marks (support-tier scaffold, set by the
   * generator at the 'easy' tier). Rendered + auto-zoomed for THIS challenge only,
   * so an anchor for one target never widens another challenge's view. NEVER
   * equal to a target value (leak guard). Falls back to data-level `highlights`.
   */
  highlights?: { label: string; value: number }[];
  /** The support tier the generator applied, stamped on each challenge: when the build's model lever comes. */
  supportTier?: 'easy' | 'medium' | 'hard';
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface NumberLineData {
  title: string;
  description?: string;
  range: { min: number; max: number };
  highlights?: { label: string; value: number }[];

  // Interactive mode fields (optional — display-only if omitted)
  interactionMode?: 'plot' | 'jump' | 'compare' | 'order';
  numberType?: 'integer' | 'fraction' | 'decimal' | 'mixed';
  operations?: NumberLineOperation[];
  challenges?: NumberLineChallenge[];
  gradeBand?: 'K-2' | '3-5';
  tickInterval?: number;

  /** Within-mode support tier ('easy' | 'medium' | 'hard') the generator applied: where the levers start. */
  supportTier?: 'easy' | 'medium' | 'hard';

  /** Safe generation metadata: which teaching move shaped the jumps and whether it landed. Never rendered. */
  learningAdaptation?: LearningAdaptation<'contrast_start_positions'>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberLineMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SVG_WIDTH = 760;
const SVG_HEIGHT = 240;
const SVG_PADDING = 60;
const LINE_Y = 140;
const LINE_WIDTH = SVG_WIDTH - 2 * SVG_PADDING;
const POINT_RADIUS = 10;
const TICK_HEIGHT = 12;
const MAJOR_TICK_HEIGHT = 18;

type InteractionPhase = 'explore' | 'plot' | 'operate' | 'compare';

const PHASE_LABELS: Record<InteractionPhase, string> = {
  explore: 'Explore',
  plot: 'Plot',
  operate: 'Operate',
  compare: 'Compare',
};

const PHASE_TABS = (['explore', 'plot', 'operate', 'compare'] as InteractionPhase[]).map(
  (phase) => ({ value: phase, label: PHASE_LABELS[phase] })
);

const NUMBER_TYPE_TABS = (['integer', 'fraction', 'decimal', 'mixed'] as const).map((nt) => ({
  value: nt,
  label: nt,
}));

const CHALLENGE_PHASE_CONFIG: Record<string, PhaseConfig> = {
  plot_point: { label: 'Plot', icon: '📍', accentColor: 'blue' },
  show_jump: { label: 'Operate', icon: '🦘', accentColor: 'orange' },
  order_values: { label: 'Compare', icon: '📊', accentColor: 'purple' },
  find_between: { label: 'Find Between', icon: '🔍', accentColor: 'emerald' },
  build_hops: { label: 'Build Hops', icon: '🐸', accentColor: 'orange' },
};

// ============================================================================
// Utilities
// ============================================================================

function formatValue(value: number, numberType: string): string {
  if (numberType === 'integer') return String(Math.round(value));
  if (numberType === 'decimal') {
    const rounded = Math.round(value * 100) / 100;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(rounded * 10 % 1 === 0 ? 1 : 2);
  }
  if (numberType === 'fraction' || numberType === 'mixed') {
    return toFractionString(value);
  }
  return String(value);
}

function toFractionString(value: number): string {
  if (Number.isInteger(value)) return String(value);

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const frac = abs - whole;

  for (const denom of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const numer = Math.round(frac * denom);
    if (Math.abs(frac - numer / denom) < 0.001) {
      if (numer === 0) return `${sign}${whole}`;
      if (numer === denom) return `${sign}${whole + 1}`;
      if (whole > 0) return `${sign}${whole} ${numer}/${denom}`;
      return `${sign}${numer}/${denom}`;
    }
  }
  return abs.toFixed(2);
}

// Snap precision is fixed per number type (`getSnapPrecision`, numberLineView.ts); zoom only controls what's visible.
function snapToValue(raw: number, numberType: string, min: number, max: number): number {
  const precision = getSnapPrecision(numberType);
  const snapped = Math.round(raw / precision) * precision;
  return Math.max(min, Math.min(max, Math.round(snapped * 1000) / 1000));
}

function challengeTypeToPhase(type: string): InteractionPhase {
  if (type === 'plot_point' || type === 'find_between') return 'plot';
  if (type === 'show_jump' || type === 'build_hops') return 'operate';
  if (type === 'order_values') return 'compare';
  return 'explore';
}

// ============================================================================
// Component
// ============================================================================

/**
 * The line's sandbox controls (`onControlsReady`): its state, which the journey drivers read to place a point at a
 * value on the visible window. Progression is the workspace observer's, so `advance` always refuses.
 */
export interface NumberLineControls {
  advance: (expectedIndex: number) => 'advanced' | 'complete' | 'rejected';
  getState: () => Record<string, unknown>;
}

interface NumberLineProps {
  data: NumberLineData;
  className?: string;
  onControlsReady?: (controls: NumberLineControls | null) => void;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useNumberLineProgress = useWorkspaceProgressFor('number-line');

const NumberLineSurface = ({ data, className, onControlsReady, runtimePlanItemId }: NumberLineProps) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const componentMounted = useRef(true);
  useLayoutEffect(() => { componentMounted.current = true; return () => { componentMounted.current = false; }; }, []);
  const inputBlocked = () => !componentMounted.current || !!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status);
  /** A checked answer stays closed until Try again or the next item. */
  const workspaceClosed = useRef(false);
  const learnerBlocked = () => inputBlocked() || workspaceClosed.current;
  const {
    title,
    description,
    range: dataRange,
    highlights = [],
    interactionMode = 'plot',
    numberType: defaultNumberType = 'integer',
    operations = [],
    challenges = [],
    gradeBand = 'K-2',
    tickInterval: customTickInterval,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const { min: rangeMin = 0, max: rangeMax = 10 } = dataRange || {};
  const isK2 = gradeBand === 'K-2';
  const isInteractive = challenges.length > 0;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [activeNumberType, setActiveNumberType] = useState(defaultNumberType);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewCenter, setViewCenter] = useState((rangeMin + rangeMax) / 2);

  // Points placed by the student
  const [placedPoints, setPlacedPoints] = useState<number[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Order mode
  const [selectedOrderValue, setSelectedOrderValue] = useState<number | null>(null);
  const [orderedPlacements, setOrderedPlacements] = useState<Map<number, number>>(new Map());

  // Jump mode
  const [jumpEndPoints, setJumpEndPoints] = useState<number[]>([]);
  // In-item levers (`NUMBER_LINE_LEVERS`), keyed by the session item they were pulled on, and the
  // easier practice item a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<NumberLineChallenge | null>(null);
  // The learner's last checked wrong point on a plot item (the `last_try` lever's ring); kept across Try again.
  const [tried, setTried] = useState<{ item: string; value: number } | null>(null);
  // Every Check on a jump, including tries later corrected. Evidence only; grading is unchanged.
  const jumpResponsesRef = useRef<JumpResponse[]>([]);
  // build_hops (open build): the hop sizes on the line now, the first way once it was checked right (keyed by the
  // item on screen; a practice build has its own), and every "I'm done!" as made.
  const [hops, setHops] = useState<number[]>([]);
  const [firstWay, setFirstWay] = useState<{ item: string; hops: number[] } | null>(null);
  const hopBuildsRef = useRef<HopBuildResponse[]>([]);
  const donePressesRef = useRef<{ item: string; count: number }>({ item: '', count: 0 });

  // Challenge tracking: the teaching workspace owns the index.
  const stableInstanceIdRef = useRef(instanceId || `number-line-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const progress = useNumberLineProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: numberLineBoss.assignment!,
    // A fresh challenge and Try again both start from an empty line. Try again on the easier
    // practice item keeps it; only a fresh challenge or the workspace's endPractice removes it.
    onItemOpened: (_index, retry) => {
      // Try again keeps the learner's hops (the build); a fresh item opens an empty line.
      if (!retry) { setPractice(null); setHops([]); setTried(null); }
      // On a build the verdict's words stay on screen until the next "I'm done!".
      if (!(retry && challenges[_index]?.type === BUILD_HOPS)) { setFeedback(''); setFeedbackType(''); }
      setPlacedPoints([]); setJumpEndPoints([]); setOrderedPlacements(new Map()); setSelectedOrderValue(null);
    },
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  workspaceClosed.current = progress.canAttempt === false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_PHASE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  // Feedback state
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Refs
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] || null;
  const currentChallenge = practice ?? sessionChallenge;
  // easy starts with the hops lever pulled (the generator's `showJumpArc`); a pull adds to that.
  // On plot, order and between, easy starts with the item's help lever shown (`helpStartsShown`).
  // A jump of 1 has no model hop, so easy also starts with its which-way arrow shown.
  const startPulled = sessionChallenge?.operations?.[0]?.showJumpArc
    ? [HOPS_LEVER, ...(wayArrow(sessionChallenge.operations[0]) ? [WAY_LEVER] : [])] : helpStartsShown(supportTier, sessionChallenge);
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : startPulled;
  /** Levers the tutor pulled on this item at runtime; the starting position is not a pull. */
  const runtimeLevers = pulledLevers.filter(l => !startPulled.includes(l));
  const hopsOn = currentChallenge?.type === 'show_jump' && pulledLevers.includes(HOPS_LEVER);
  // Plot, identify, order and between levers read the line the payload settles on, so the journey row and this
  // component build the same practice item; only integer lines carry them.
  const lineSettled = useMemo(() => currentChallenge && activeNumberType === 'integer' ? settledView(data, currentChallenge) : null,
    [data, currentChallenge, activeNumberType]);
  const sessionSettled = useMemo(() => sessionChallenge && activeNumberType === 'integer' ? settledView(data, sessionChallenge) : null,
    [data, sessionChallenge, activeNumberType]);
  const countFor = countTarget(currentChallenge);
  const countFrom = pulledLevers.includes(COUNT_LEVER) && countFor !== null && lineSettled ? countStart(countFor, lineSettled.labels) : null;
  const arrowOn = currentChallenge?.type === 'order_values' && pulledLevers.includes(ARROW_LEVER);
  const ringsAt = pulledLevers.includes(ENDS_LEVER) ? endMarks(currentChallenge) : null;
  const triedNow = tried && tried.item === sessionChallenge?.id ? tried.value : null;
  const lastTryAt = !practice && pulledLevers.includes(LAST_TRY_LEVER) && sessionSettled ? lastTry(sessionChallenge, sessionSettled, triedNow) : null;
  const wayOn = !practice && currentChallenge?.type === 'show_jump' && pulledLevers.includes(WAY_LEVER) ? wayArrow(currentChallenge.operations?.[0]) : null;
  // build_hops (open build)
  const hopsTask = hopsTaskOf(currentChallenge);
  const isBuild = !!hopsTask;
  const firstWayNow = isBuild && firstWay && firstWay.item === currentChallenge?.id ? firstWay.hops : null;
  const buildHopsNumbered = isBuild && pulledLevers.includes(HOPS_LEVER);
  const waysModelOn = isBuild && pulledLevers.includes(WAYS_LEVER);
  const currentPhase: InteractionPhase = currentChallenge
    ? challengeTypeToPhase(currentChallenge.type)
    : 'explore';

  // Per-challenge operations take priority over global operations
  const activeOperations: NumberLineOperation[] = currentChallenge?.operations?.length
    ? currentChallenge.operations
    : operations;

  // Per-challenge benchmark anchors (support-tier scaffold) take priority over
  // the data-level highlights, so an anchor for one target never bleeds into (or
  // widens the auto-zoom of) another challenge.
  const activeHighlights = currentChallenge?.highlights ?? highlights;

  // -------------------------------------------------------------------------
  // Coordinate Conversion
  // -------------------------------------------------------------------------
  const visibleRange = useMemo(() => (rangeMax - rangeMin) / zoomLevel, [rangeMin, rangeMax, zoomLevel]);
  const visibleMin = useMemo(() => {
    const raw = viewCenter - visibleRange / 2;
    return Math.max(rangeMin, Math.min(raw, rangeMax - visibleRange));
  }, [viewCenter, visibleRange, rangeMin, rangeMax]);
  const visibleMax = useMemo(() => Math.min(rangeMax, visibleMin + visibleRange), [visibleMin, visibleRange, rangeMax]);

  const valueToX = useCallback((value: number) => {
    const range = visibleMax - visibleMin;
    if (range === 0) return SVG_PADDING;
    return SVG_PADDING + ((value - visibleMin) / range) * LINE_WIDTH;
  }, [visibleMin, visibleMax]);

  const xToValue = useCallback((clientX: number) => {
    if (!svgRef.current) return visibleMin;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    const range = visibleMax - visibleMin;
    return visibleMin + ((svgX - SVG_PADDING) / LINE_WIDTH) * range;
  }, [visibleMin, visibleMax]);

  // -------------------------------------------------------------------------
  // Tick Marks
  // -------------------------------------------------------------------------
  const ticks = useMemo(() => lineTicks(visibleMin, visibleMax, activeNumberType, customTickInterval),
    [activeNumberType, visibleMin, visibleMax, customTickInterval]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NumberLineMetrics>({
    primitiveType: 'number-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------

  const handleLineClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (learnerBlocked() || hasSubmittedEvaluation || !isInteractive || challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct)) return;
    if (draggingIndex !== null) return;

    const rawValue = xToValue(e.clientX);
    const snappedValue = snapToValue(rawValue, activeNumberType, visibleMin, visibleMax);

    // Order mode: place the selected value
    if (currentChallenge?.type === 'order_values' && selectedOrderValue !== null) {
      SoundManager.tap();
      setOrderedPlacements(prev => {
        const next = new Map(prev);
        next.set(selectedOrderValue, snappedValue);
        return next;
      });
      setSelectedOrderValue(null);
      return;
    }

    // Jump mode: set endpoint
    if (currentChallenge?.type === 'show_jump') {
      SoundManager.tap();
      setJumpEndPoints(prev => {
        if (prev.length >= activeOperations.length) {
          // Replace last endpoint when all steps already placed
          const next = [...prev];
          next[next.length - 1] = snappedValue;
          return next;
        }
        return [...prev, snappedValue];
      });
      return;
    }

    // Plot / find_between: add a point
    // find_between: student places 1 point anywhere between the two bounds (targetValues are the bounds, not the answer)
    if (currentChallenge?.type === 'plot_point' || currentChallenge?.type === 'find_between') {
      SoundManager.tap();
      const maxPoints = currentChallenge.type === 'find_between' ? 1 : currentChallenge.targetValues.length;
      setPlacedPoints(prev => {
        if (prev.length >= maxPoints) {
          // Replace the last point
          const next = [...prev];
          next[next.length - 1] = snappedValue;
          return next;
        }
        return [...prev, snappedValue];
      });
    }
  }, [hasSubmittedEvaluation, isInteractive, draggingIndex, xToValue, activeNumberType,
      zoomLevel, visibleMin, visibleMax, currentChallenge, selectedOrderValue, challengeResults, liveRuntime]);

  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    if (learnerBlocked() || challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct)) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingIndex(index);
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [challengeResults, currentChallenge, liveRuntime]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (learnerBlocked() || draggingIndex === null || challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct)) return;
    const rawValue = xToValue(e.clientX);
    const snappedValue = snapToValue(rawValue, activeNumberType, visibleMin, visibleMax);
    setPlacedPoints(prev => {
      const next = [...prev];
      next[draggingIndex] = snappedValue;
      return next;
    });
  }, [draggingIndex, xToValue, activeNumberType, zoomLevel, visibleMin, visibleMax, challengeResults, currentChallenge, liveRuntime]);

  const handlePointerUp = useCallback(() => {
    if (draggingIndex !== null) SoundManager.snap();
    setDraggingIndex(null);
  }, [draggingIndex]);

  // Auto-zoom + auto-center when a challenge starts.
  // Zoom is purely about visibility — it fits all relevant values (targets, highlights,
  // operation endpoints) into the viewport with comfortable padding.
  // Snap precision is now independent of zoom (always 0.01 for decimal, 1/8 for fractions).
  useEffect(() => {
    if (!currentChallenge) return;
    // A build shows the whole line: the learner's hops can go anywhere on it, so no window fitted to the target.
    if (currentChallenge.type === BUILD_HOPS) {
      setZoomLevel(1);
      setViewCenter((rangeMin + rangeMax) / 2);
      return;
    }

    // `autoView`: a jump or order item is fitted to itself; plot and between to every item of their kind, so the
    // target (or an exact missing number) is not the centre of the line.
    const fit = autoView(data, currentChallenge);
    if (!fit) return;
    setZoomLevel(fit.zoom);
    setViewCenter(fit.center);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id, activeNumberType]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkAnswer = useCallback(() => {
    if (learnerBlocked() || !currentChallenge || challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)) return;

    const targets = currentChallenge.targetValues;
    let correct = false;
    let accuracy = 0;

    switch (currentChallenge.type) {
      case 'plot_point': {
        const tolerance = getSnapPrecision(activeNumberType);
        // One tick off is a different number, not tolerance (NL-2).
        const matched = targets.every(target =>
          placedPoints.some(p => isPlotPlacementCorrect(p, target, tolerance))
        );
        correct = matched;
        if (!matched && !practice && placedPoints.length > 0) setTried({ item: currentChallenge.id, value: placedPoints[placedPoints.length - 1] });
        if (matched && placedPoints.length > 0) {
          const errors = targets.map(target => {
            const closest = placedPoints.reduce((best, p) =>
              Math.abs(p - target) < Math.abs(best - target) ? p : best
            , placedPoints[0]);
            return Math.abs(closest - target);
          });
          const avgError = errors.reduce((s, e) => s + e, 0) / errors.length;
          accuracy = Math.max(0, 100 - (avgError / Math.max(rangeMax - rangeMin, 1)) * 200);
        }
        break;
      }
      case 'show_jump': {
        if (activeOperations.length > 0 && jumpEndPoints.length === activeOperations.length) {
          const tolerance = getSnapPrecision(activeNumberType);
          let totalError = 0;
          let allCorrect = true;
          for (let i = 0; i < activeOperations.length; i++) {
            const op = activeOperations[i];
            const expected = op.type === 'add'
              ? op.startValue + op.changeValue
              : op.startValue - op.changeValue;
            const error = Math.abs(jumpEndPoints[i] - expected);
            // A landing one hop short or past is wrong, not within tolerance.
            if (!isSnappedPlacementExact(jumpEndPoints[i], expected, tolerance)) allCorrect = false;
            totalError += error;
          }
          correct = allCorrect;
          if (!practice) jumpResponsesRef.current.push(jumpResponseFor(currentChallenge.id, currentAttempts + 1,
            activeOperations, jumpEndPoints, tolerance, pulledLevers, runtimeLevers));
          const avgError = totalError / activeOperations.length;
          accuracy = correct ? Math.max(0, 100 - (avgError / Math.max(rangeMax - rangeMin, 1)) * 100) : 0;
        }
        break;
      }
      case 'order_values': {
        if (orderedPlacements.size === targets.length) {
          const placedOrder = Array.from(orderedPlacements.entries())
            .sort((a, b) => a[1] - b[1])
            .map(e => e[0]);
          const targetOrder = [...targets].sort((a, b) => a - b);
          correct = placedOrder.every((v, i) => v === targetOrder[i]);
          accuracy = correct ? 100 : 0;
        }
        break;
      }
      case 'find_between': {
        if (placedPoints.length > 0 && targets.length >= 2) {
          const point = placedPoints[placedPoints.length - 1];
          correct = isFindBetweenAnswerCorrect(
            point,
            targets,
            currentChallenge.exactTargetValue,
            activeNumberType,
          );
          accuracy = correct ? 100 : 0;
        }
        break;
      }
    }

    // The line's own check is the workspace's checked gesture.
    progress.commitCheck(describeLine(currentChallenge, { rangeMin, rangeMax, numberType: activeNumberType,
      operations: activeOperations, points: placedPoints, endpoints: jumpEndPoints, ordered: orderedPlacements }), correct,
      correct ? undefined : lineMiss(currentChallenge, { points: placedPoints, endpoints: jumpEndPoints, ordered: orderedPlacements,
        grid: getSnapPrecision(activeNumberType) }));
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(isK2 ? 'Great job!' : 'Correct!');
      setFeedbackType('success');
      if (!practice) recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: Math.round(accuracy),
        accuracy: Math.round(accuracy),
      });
    } else {
      SoundManager.playIncorrect();
      setFeedback(currentChallenge.hint || 'Not quite. Try again!');
      setFeedbackType('error');
    }
  }, [currentChallenge, placedPoints, jumpEndPoints, orderedPlacements, activeOperations, practice, pulledLevers, runtimeLevers,
      activeNumberType, zoomLevel, rangeMin, rangeMax, isK2, currentAttempts,
      recordResult, challengeResults, liveRuntime, progress]);

  // -------------------------------------------------------------------------
  // Submit the evaluation once, when every challenge is complete (only under an evaluation provider)
  // -------------------------------------------------------------------------
  const submitSession = useCallback(() => {
    if (inputBlocked() || !challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct)) return;
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const avgAccuracy = challengeResults.length > 0
      ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / challengeResults.length)
      : 0;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const score = Math.round((totalCorrect / challenges.length) * 100);

    const lastTarget = currentChallenge?.exactTargetValue
      ?? currentChallenge?.targetValues?.[0]
      ?? 0;
    const lastPlaced = placedPoints[0] ?? jumpEndPoints[jumpEndPoints.length - 1] ?? 0;

    const metrics: NumberLineMetrics = {
      type: 'number-line',
      evalMode: interactionMode ?? 'default',
      targetValue: lastTarget,
      placedValue: lastPlaced,
      error: Math.abs(lastPlaced - lastTarget),
      accuracy: avgAccuracy,
      scaleMin: rangeMin,
      scaleMax: rangeMax,
      scaleType: activeNumberType === 'fraction' ? 'fraction' : activeNumberType === 'decimal' ? 'decimal' : 'integer',
      challengesCompleted: totalCorrect,
      totalChallenges: challenges.length,
      averageAccuracy: avgAccuracy,
      totalAttempts,
      interactionMode,
      gradeBand,
    };

    const jumpResponses = jumpResponsesRef.current;
    const diagnosisEvidence = buildJumpDiagnosisEvidence(jumpResponses, { min: rangeMin, max: rangeMax });
    submitEvaluation(
      totalCorrect === challenges.length,
      score,
      metrics,
      { challengeResults, jumpResponses, ...(hopBuildsRef.current.length ? { hopBuilds: hopBuildsRef.current } : {}) },
      undefined,
      // Challenges advance only when correct, so the submitted score cannot
      // show a wrong first try; the first-response score lets the shared gate see it.
      diagnosisEvidence ? { ...diagnosisEvidence, firstResponseScore: jumpFirstResponseScore(jumpResponses) } : undefined,
    );
  }, [challenges, challengeResults, hasSubmittedEvaluation, placedPoints, jumpEndPoints, currentChallenge,
      rangeMin, rangeMax, activeNumberType, interactionMode, gradeBand, submitEvaluation, progress.recordsEvaluation, liveRuntime]);

  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitSession();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, submitSession]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  /** Every learner mark back to empty: a practice item and the full item it stands in for share no work. */
  const clearWork = () => {
    setPlacedPoints([]); setJumpEndPoints([]); setOrderedPlacements(new Map()); setSelectedOrderValue(null);
    setHops([]); setFeedback(''); setFeedbackType('');
  };
  const clearResponse = () => {
    if (learnerBlocked() || isCurrentChallengeComplete) return;
    setPlacedPoints([]); setJumpEndPoints([]); setOrderedPlacements(new Map());
    setSelectedOrderValue(null); setFeedback(''); setFeedbackType('');
  };

  // ── Open build (build_hops): the learner picks each hop; "I'm done!" checks the build ──
  const buildOpen = isBuild && !isCurrentChallengeComplete && !hasSubmittedEvaluation;
  const hopsLanding = hopsTask ? landingOf(hopsTask.start, hops) : 0;
  /** A hop button is off once the asked hops are on, or when that hop would leave the line. */
  const hopDisabled = (size: number) => !buildOpen || workspaceClosed.current || !hopsTask
    || hops.length >= hopsTask.hopCount || hopsLanding + size > rangeMax;
  const addHop = (size: number) => {
    if (learnerBlocked() || hopDisabled(size)) return;
    SoundManager.tap();
    setHops(prev => [...prev, size]);
  };
  /** Tapping a landing takes that hop off; the hops after it move back with it. */
  const removeHop = (index: number) => {
    if (learnerBlocked() || !buildOpen) return;
    SoundManager.tap();
    setHops(prev => prev.filter((_, i) => i !== index));
  };
  const startOver = () => {
    if (learnerBlocked() || !buildOpen) return;
    setHops([]);
  };
  // A right first way is not a commit: it is kept and listed, the line clears, and the second way begins. Every other
  // "I'm done!" commits, so a miss reaches the tutor and the levers, and Try again keeps the build.
  const doneBuilding = () => {
    if (learnerBlocked() || !buildOpen || !currentChallenge || !hopsTask || !hops.length) return;
    const miss = buildHopsMiss(currentChallenge, hops, firstWayNow);
    const presses = donePressesRef.current.item === currentChallenge.id ? donePressesRef.current.count + 1 : 1;
    donePressesRef.current = { item: currentChallenge.id, count: presses };
    if (!practice) hopBuildsRef.current.push(hopBuildResponseFor(currentChallenge.id, presses, firstWayNow ? 2 : 1,
      hopsTask, hops, miss, runtimeLevers));
    setFeedback(buildHopsFeedback(hopsTask, hops, miss, firstWayNow));
    if (!firstWayNow && !miss) {
      SoundManager.snap();
      setFirstWay({ item: currentChallenge.id, hops: [...hops] });
      setHops([]);
      setFeedbackType('success');
      return;
    }
    progress.commitCheck(describeHops(hopsTask, hops, firstWayNow), !miss, miss);
    if (!miss) {
      SoundManager.playCorrect();
      setFeedbackType('success');
      if (!practice) recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, score: 100, accuracy: 100 });
      return;
    }
    SoundManager.playIncorrect();
    setFeedbackType('error');
  };
  // The live line (shared build layer): what the hops look like so far, NEVER a number: adding them is the skill.
  const buildSeeing = useBuildWatcher({
    buildKey: `${currentChallenge?.id}:${firstWayNow ? 2 : 1}:${hops.join(',')}`,
    enabled: buildOpen && hops.length > 0 && progress.canAttempt !== false,
    svg: svgRef,
    request: {
      task: currentChallenge?.instruction ?? '', numbers: 'never',
      sceneNote: 'A number line with tick marks and numbers under it. The blue dot is the start. Orange arcs are the hops '
        + 'the child made, each from where the last one landed; a yellow dot marks where each hop lands.',
      made: hops.map((h, i) => `${i === 0 ? 'a' : 'then a'} ${h <= 3 ? 'short' : h <= 6 ? 'middle-sized' : 'long'} hop`).join(', '),
    },
  });

  // The line's state for the sandbox controls and the journey drivers (`onControlsReady`), read at the call.
  const lineState = useRef<Record<string, unknown>>({});
  lineState.current = {
    rangeMin, rangeMax, visibleMin, visibleMax, numberType: activeNumberType, gradeBand,
    totalChallenges: challenges.length, currentChallengeIndex, isCurrentChallengeComplete, allChallengesComplete,
    instruction: currentChallenge?.instruction ?? '', challengeType: currentChallenge?.type ?? interactionMode,
    placedPoints, jumpEndPoints, orderedPlacements: Array.from(orderedPlacements.entries()),
  };
  useEffect(() => {
    if (!onControlsReady) return;
    // The workspace observer advances; the tool-lab advance command has no say here.
    onControlsReady({ getState: () => lineState.current, advance: () => 'rejected' });
    return () => onControlsReady(null);
  }, [onControlsReady]);

  // What the tutor and the observer are shown, republished every render. The levers are the session item's
  // (`NUMBER_LINE_LEVERS`); while an easier practice item is on screen none are offered, and the help already
  // drawn stays drawn on it (the lever set's `onScreen`, read on the item on screen).
  const leverCtx: NumberLineLeverContext = { range: { min: rangeMin, max: rangeMax }, settled: sessionSettled,
    pulled: pulledLevers, points: placedPoints, endpoints: jumpEndPoints, tried: triedNow, hops };
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const view: NumberLineView = { rangeMin, rangeMax, numberType: activeNumberType,
      operations: isBuild ? [] : activeOperations, points: isBuild ? [] : placedPoints, endpoints: isBuild ? [] : jumpEndPoints,
      ordered: orderedPlacements, hops: hopsOn, practice: !!practice, countFrom: countFrom ?? undefined,
      // The window the line settles on for this item, from the payload: the zoom state catches up an effect later, and
      // a scene that changed with it would supersede the advance's visible receipt.
      window: isBuild ? undefined : settledView(data, currentChallenge).window };
    const scene = isBuild ? buildHopsScene(currentChallenge, view, { hops, first: firstWayNow }) : workspaceScene(currentChallenge, view);
    const levers = practice ? [] : NUMBER_LINE_LEVERS.declare(sessionChallenge, leverCtx, pulledLevers);
    // The which-way arrow and the last-try ring are drawn on the session item only.
    const shown = practice ? pulledLevers.filter(id => id !== WAY_LEVER && id !== LAST_TRY_LEVER) : pulledLevers;
    const published = leverScene(scene, {
      support: practice ? '' : NUMBER_LINE_LEVERS.support(sessionChallenge, leverCtx),
      onScreen: NUMBER_LINE_LEVERS.onScreen(currentChallenge, practice ? { ...leverCtx, settled: lineSettled, tried: null } : leverCtx, shown),
    });
    workspace.current = {
      ...published,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the line changes before this returns.
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = NUMBER_LINE_LEVERS.simpler(sessionChallenge, leverCtx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next); setPractice(easier); clearWork();
          return { practice: numberLineBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice item is not the learner's work on it.
      endPractice: () => { setPractice(null); clearWork(); },
    };
  });

  const canCheck = (() => {
    if (!currentChallenge || hasSubmittedEvaluation || isCurrentChallengeComplete) return false;
    if (currentChallenge.type === 'plot_point' || currentChallenge.type === 'find_between') return placedPoints.length > 0;
    if (currentChallenge.type === 'show_jump') return jumpEndPoints.length === activeOperations.length;
    if (currentChallenge.type === 'order_values') return orderedPlacements.size >= currentChallenge.targetValues.length;
    return false;
  })();

  // -------------------------------------------------------------------------
  // Jump Arc Rendering
  // -------------------------------------------------------------------------
  const renderJumpArc = useCallback((startVal: number, endVal: number, color: string, label?: string) => {
    const startX = valueToX(startVal);
    const endX = valueToX(endVal);
    const midX = (startX + endX) / 2;
    const arcHeight = Math.min(Math.abs(endX - startX) * 0.5, 80);
    const controlY = LINE_Y - arcHeight;
    const direction = endVal > startVal;

    return (
      <g key={`jump-${startVal}-${endVal}-${color}`}>
        <path
          d={`M ${startX} ${LINE_Y} Q ${midX} ${controlY} ${endX} ${LINE_Y}`}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray="6 3"
          opacity={0.8}
        />
        <polygon
          points={`${endX},${LINE_Y} ${endX + (direction ? -8 : 8)},${LINE_Y - 6} ${endX + (direction ? -8 : 8)},${LINE_Y + 6}`}
          fill={color}
        />
        <text
          x={midX}
          y={controlY - 8}
          textAnchor="middle"
          fill={color}
          fontSize={14}
          fontWeight="bold"
        >
          {label ?? `${direction ? '+' : '-'}${Math.abs(Math.round((endVal - startVal) * 100) / 100)}`}
        </text>
      </g>
    );
  }, [valueToX]);

  /** One numbered unit hop, appearing one after another. */
  const renderHop = (h: Hop, color: string, order: number) => {
    const a = valueToX(h.from), b = valueToX(h.to), mid = (a + b) / 2;
    const lift = Math.min(36, 12 + Math.abs(b - a) * 0.5);
    return (
      <g key={`hop-${h.from}-${h.to}`} style={{ animation: `nl-hop-in 0.25s ease-out ${order * 0.2}s both` }}>
        <path d={`M ${a} ${LINE_Y - 3} Q ${mid} ${LINE_Y - lift * 2} ${b} ${LINE_Y - 3}`} fill="none" stroke={color} strokeWidth={2.5} />
        <text x={mid} y={LINE_Y - lift - 8} textAnchor="middle" fill={color} fontSize={isK2 ? 16 : 13} fontWeight="bold">{h.label}</text>
      </g>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Display-only fallback (backward compatibility with old data)
  if (!isInteractive) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader className="pb-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
        </LuminaCardHeader>
        <LuminaCardContent>
          <div className="flex justify-center">
            <svg
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="max-w-full h-auto rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <rect x={1} y={1} width={SVG_WIDTH - 2} height={SVG_HEIGHT - 2}
                rx={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <line
                x1={SVG_PADDING} y1={LINE_Y}
                x2={SVG_WIDTH - SVG_PADDING} y2={LINE_Y}
                stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} strokeLinecap="round"
              />
              {ticks.map((tick, i) => {
                const x = valueToX(tick.value);
                if (x < SVG_PADDING - 5 || x > SVG_WIDTH - SVG_PADDING + 5) return null;
                const h = tick.isMajor ? MAJOR_TICK_HEIGHT : TICK_HEIGHT;
                return (
                  <g key={i}>
                    <line x1={x} y1={LINE_Y - h / 2} x2={x} y2={LINE_Y + h / 2}
                      stroke={tick.isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'}
                      strokeWidth={tick.isMajor ? 1.5 : 1} />
                    {tick.isMajor && (
                      <text x={x} y={LINE_Y + h / 2 + 16} textAnchor="middle"
                        fill="rgba(255,255,255,0.5)" fontSize={14} fontFamily="monospace">
                        {formatValue(tick.value, activeNumberType)}
                      </text>
                    )}
                  </g>
                );
              })}
              {highlights.map((hl, i) => {
                const x = valueToX(hl.value);
                if (x < SVG_PADDING || x > SVG_WIDTH - SVG_PADDING) return null;
                return (
                  <g key={`hl-${i}`}>
                    <circle cx={x} cy={LINE_Y} r={7} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
                    <text x={x} y={LINE_Y - 16} textAnchor="middle" fill="#93c5fd" fontSize={12} fontWeight="600">
                      {hl.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // -------------------------------------------------------------------------
  // Interactive Mode Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {gradeBand}
            </LuminaBadge>
            <LuminaBadge accent="blue" className="text-xs">
              {activeNumberType}
            </LuminaBadge>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase + Progress */}
        <div className="flex items-center justify-between">
          <LuminaModeTabs tabs={PHASE_TABS} active={currentPhase} accent="orange" />
          {challenges.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {challenges.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      challengeResults.some(r => r.challengeId === challenges[i].id && r.correct)
                        ? 'bg-emerald-400'
                        : i === currentChallengeIndex
                          ? 'bg-orange-400 animate-pulse'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-slate-500 text-xs">
                {Math.min(currentChallengeIndex + 1, challenges.length)}/{challenges.length}
              </span>
            </div>
          )}
        </div>

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt aria-label="Current instruction">
            <p className="text-sm font-medium">{currentChallenge.instruction}</p>
            {currentChallenge.type === 'show_jump' && activeOperations.length > 1 && (
              <p className="text-slate-400 text-xs mt-1 font-normal">
                {jumpEndPoints.length < activeOperations.length
                  ? `Click to place jump ${jumpEndPoints.length + 1} of ${activeOperations.length}`
                  : `All ${activeOperations.length} jumps placed — check your answer!`}
              </p>
            )}
          </LuminaPrompt>
        )}

        {practice && (
          <div className="flex justify-center" data-practice><LuminaBadge accent="amber" className="text-xs">Practice</LuminaBadge></div>
        )}

        {/* Pip's dock sits above the answer surface: the chips and the line below it. */}
        {currentChallenge && !allChallengesComplete && <PipDock />}
        <PipWorkspace className="space-y-4">
        {/* Order Mode: Value Chips */}
        {currentChallenge?.type === 'order_values' && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-slate-400 text-xs mr-2">Tap a value, then tap the line:</span>
            {currentChallenge.targetValues.map((val) => {
              const isPlaced = orderedPlacements.has(val);
              const isSelected = selectedOrderValue === val;
              return (
                <LuminaChoiceChip
                  key={val}
                  accent={isPlaced ? 'emerald' : 'orange'}
                  selected={isPlaced || isSelected}
                  label={formatValue(val, activeNumberType)}
                  className="px-3 py-1.5"
                  onClick={() => { if (!isPlaced) { SoundManager.select(); setSelectedOrderValue(val); } }}
                  disabled={isPlaced}
                />
              );
            })}
          </div>
        )}

        {/* Number Line SVG */}
        <div className="flex justify-center">
          <svg
            ref={svgRef}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="max-w-full h-auto rounded-xl cursor-crosshair select-none"
            style={{ background: 'rgba(255,255,255,0.02)' }}
            onClick={handleLineClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Border */}
            <rect x={1} y={1} width={SVG_WIDTH - 2} height={SVG_HEIGHT - 2}
              rx={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <style>{'@keyframes nl-hop-in { from { opacity: 0 } to { opacity: 1 } }'}</style>

            {/* Main Number Line */}
            <line
              x1={SVG_PADDING} y1={LINE_Y}
              x2={SVG_WIDTH - SVG_PADDING} y2={LINE_Y}
              stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} strokeLinecap="round"
            />

            {/* End Arrows */}
            <polygon points={`${SVG_PADDING - 8},${LINE_Y} ${SVG_PADDING + 2},${LINE_Y - 5} ${SVG_PADDING + 2},${LINE_Y + 5}`}
              fill="rgba(255,255,255,0.3)" />
            <polygon points={`${SVG_WIDTH - SVG_PADDING + 8},${LINE_Y} ${SVG_WIDTH - SVG_PADDING - 2},${LINE_Y - 5} ${SVG_WIDTH - SVG_PADDING - 2},${LINE_Y + 5}`}
              fill="rgba(255,255,255,0.3)" />

            {/* Tick Marks */}
            {ticks.map((tick, i) => {
              const x = valueToX(tick.value);
              if (x < SVG_PADDING - 5 || x > SVG_WIDTH - SVG_PADDING + 5) return null;
              const h = tick.isMajor ? MAJOR_TICK_HEIGHT : TICK_HEIGHT;
              return (
                <g key={i}>
                  <line
                    x1={x} y1={LINE_Y - h / 2}
                    x2={x} y2={LINE_Y + h / 2}
                    stroke={tick.isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'}
                    strokeWidth={tick.isMajor ? 1.5 : 1}
                  />
                  {tick.isMajor && (
                    <text
                      x={x} y={LINE_Y + h / 2 + 16}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize={isK2 ? 16 : 12}
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {formatValue(tick.value, activeNumberType)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Pre-placed Highlights (benchmark anchors — per-challenge at easy tier) */}
            {activeHighlights.map((hl, i) => {
              const x = valueToX(hl.value);
              if (x < SVG_PADDING || x > SVG_WIDTH - SVG_PADDING) return null;
              return (
                <g key={`hl-${i}`}>
                  <circle cx={x} cy={LINE_Y} r={6} fill="#3b82f6" opacity={0.6} />
                  <text x={x} y={LINE_Y - 16} textAnchor="middle" fill="#93c5fd" fontSize={11}>
                    {hl.label}
                  </text>
                </g>
              );
            })}

            {/* Numbered-hops lever: hop 1 from the start as a model. It never reaches the landing
                (modelHop is null for a jump of 1); the whole worked arc used to, and stated the answer. */}
            {hopsOn && jumpEndPoints.length === 0 && (() => {
              const model = modelHop(activeOperations[0]);
              return model ? <g data-lever="model-hop">{renderHop(model, '#93c5fd', 0)}</g> : null;
            })()}

            {/* Jump Mode: Start Point */}
            {currentChallenge?.type === 'show_jump' && activeOperations.length > 0 && (
              <g data-start>
                <circle
                  cx={valueToX(activeOperations[0].startValue)}
                  cy={LINE_Y}
                  r={POINT_RADIUS}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={valueToX(activeOperations[0].startValue)}
                  y={LINE_Y + POINT_RADIUS + 20}
                  textAnchor="middle"
                  fill="#93c5fd"
                  fontSize={12}
                  fontWeight="bold"
                >
                  Start: {formatValue(activeOperations[0].startValue, activeNumberType)}
                </text>
              </g>
            )}

            {/* Open build (build_hops): the start, then the learner's own hops, each from where the last one landed.
                No landing is labelled (where the hops land is the learner's to read off the line) and the target is
                not marked. The numbered-hops lever's unit hops are an aid (data-aid), outside the watcher's picture. */}
            {isBuild && hopsTask && (
              <g data-start>
                <circle cx={valueToX(hopsTask.start)} cy={LINE_Y} r={POINT_RADIUS} fill="#3b82f6" stroke="white" strokeWidth={2} />
                <text x={valueToX(hopsTask.start)} y={LINE_Y + POINT_RADIUS + 34} textAnchor="middle" fill="#93c5fd"
                  fontSize={12} fontWeight="bold">Start</text>
              </g>
            )}
            {isBuild && hopsTask && hops.map((size, i) => {
              const from = landingOf(hopsTask.start, hops.slice(0, i)), to = from + size;
              // Green only once the item is solved: a right first way's "Yes!" must not colour the second way's hops.
              const color = isCurrentChallengeComplete ? '#34d399' : feedbackType === 'error' ? '#f87171' : '#fb923c';
              return (
                <g key={`build-hop-${i}-${from}-${to}`} data-build-hop={i}>
                  {renderJumpArc(from, to, color, `+${size}`)}
                  {buildHopsNumbered && (
                    <g data-lever="learner-hops" data-aid>{learnerHops(from, to).map((h, k) => renderHop(h, '#93c5fd', k))}</g>
                  )}
                  <g role="button" aria-label={`Take off hop ${i + 1}`} className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); removeHop(i); }}>
                    <circle cx={valueToX(to)} cy={LINE_Y} r={22} fill="transparent" />
                    <circle cx={valueToX(to)} cy={LINE_Y} r={POINT_RADIUS} fill="#fbbf24" stroke="white" strokeWidth={2} />
                  </g>
                </g>
              );
            })}

            {/* Jump Mode: Student's Jump Arcs, each from where the learner's previous jump landed
                (never from the item's own intermediate landing). With the hops lever, numbered unit hops. */}
            {currentChallenge?.type === 'show_jump' && activeOperations.length > 0 && jumpEndPoints.map((endPt, i) => {
              const from = i === 0 ? activeOperations[0].startValue : jumpEndPoints[i - 1];
              const color = feedbackType === 'success' ? '#34d399' : feedbackType === 'error' ? '#f87171' : '#fbbf24';
              const hops = hopsOn ? learnerHops(from, endPt) : [];
              return hops.length
                ? <g key={`hops-${i}-${from}-${endPt}`} data-lever="learner-hops">{hops.map((h, k) => renderHop(h, color, k))}</g>
                : renderJumpArc(from, endPt, color);
            })}

            {/* Jump Mode: Student's Endpoints */}
            {currentChallenge?.type === 'show_jump' && jumpEndPoints.map((endPt, i) => (
              <g key={`jump-pt-${i}`}>
                <circle
                  cx={valueToX(endPt)}
                  cy={LINE_Y}
                  r={POINT_RADIUS}
                  fill="#fbbf24"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={valueToX(endPt)}
                  y={LINE_Y + POINT_RADIUS + 20}
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize={12}
                  fontWeight="bold"
                >
                  {formatValue(endPt, activeNumberType)}
                </text>
              </g>
            ))}

            {/* Count-hops lever (plot, identify, exact between): the learner's point counted in numbered hops from a
                labelled number; before they place it, hop 1 as a model, which never reaches the target. */}
            {countFrom !== null && countFor !== null && (() => {
              const last = placedPoints[placedPoints.length - 1];
              const own = last !== undefined ? learnerHops(countFrom, last) : [];
              if (own.length) return <g data-lever="count-hops">{own.map((h, k) => renderHop(h, '#fbbf24', k))}</g>;
              const model = placedPoints.length === 0 ? countModelHop(countFrom, countFor) : null;
              return model ? <g data-lever="count-model-hop">{renderHop(model, '#93c5fd', 0)}</g> : null;
            })()}

            {/* Bigger-arrow lever (order): which way the numbers grow. It marks no number. */}
            {arrowOn && (
              <g data-lever="bigger-arrow">
                <line x1={SVG_PADDING + 20} y1={205} x2={SVG_WIDTH - SVG_PADDING - 20} y2={205} stroke="#a78bfa" strokeWidth={2.5} />
                <polygon points={`${SVG_WIDTH - SVG_PADDING - 8},205 ${SVG_WIDTH - SVG_PADDING - 20},199 ${SVG_WIDTH - SVG_PADDING - 20},211`} fill="#a78bfa" />
                <text x={SVG_PADDING + 20} y={226} textAnchor="start" fill="#c4b5fd" fontSize={isK2 ? 15 : 12} fontWeight="600">smaller</text>
                <text x={SVG_WIDTH - SVG_PADDING - 20} y={226} textAnchor="end" fill="#c4b5fd" fontSize={isK2 ? 15 : 12} fontWeight="600">bigger</text>
              </g>
            )}

            {/* End-marks lever (between): rings on the two given numbers; nothing between them. */}
            {ringsAt && (
              <g data-lever="end-marks">
                {ringsAt.map(v => (
                  <g key={`ring-${v}`}>
                    <circle cx={valueToX(v)} cy={LINE_Y} r={POINT_RADIUS + 3} fill="none" stroke="#34d399" strokeWidth={2.5} />
                    <text x={valueToX(v)} y={LINE_Y - POINT_RADIUS - 12} textAnchor="middle" fill="#6ee7b7" fontSize={isK2 ? 15 : 12} fontWeight="bold">
                      {formatValue(v, activeNumberType)}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Last-try lever (plot/identify, a target with no label to count from below it): a dashed ring on the
                learner's own last wrong point, kept after Try again. It marks no other number. */}
            {lastTryAt !== null && (
              <g data-lever="last-try" data-value={lastTryAt}>
                <circle cx={valueToX(lastTryAt)} cy={LINE_Y} r={POINT_RADIUS + 6} fill="none" stroke="#f472b6" strokeWidth={2.5} strokeDasharray="5 4" />
              </g>
            )}

            {/* Which-way lever (a jump of 1): a short arrow at the start, shorter than one hop. */}
            {wayOn && (() => {
              const x1 = valueToX(wayOn.from), x2 = valueToX(wayOn.to), y = LINE_Y - 30, d = Math.sign(x2 - x1);
              return (
                <g data-lever="which-way" data-dir={wayOn.dir}>
                  <line x1={x1} y1={y} x2={x2 - d * 8} y2={y} stroke="#a78bfa" strokeWidth={3} />
                  <polygon points={`${x2},${y} ${x2 - d * 10},${y - 6} ${x2 - d * 10},${y + 6}`} fill="#a78bfa" />
                </g>
              );
            })()}

            {/* Student-placed Points (draggable) */}
            {placedPoints.map((val, i) => {
              const x = valueToX(val);
              return (
                <g
                  key={`pt-${i}`}
                  onPointerDown={(e) => handlePointerDown(i, e)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle cx={x} cy={LINE_Y} r={POINT_RADIUS + 5} fill="transparent" />
                  <circle
                    cx={x} cy={LINE_Y} r={POINT_RADIUS}
                    fill="#f59e0b" stroke="white" strokeWidth={2}
                    className="transition-all"
                  />
                  <text
                    x={x} y={LINE_Y - POINT_RADIUS - 8}
                    textAnchor="middle" fill="#fbbf24"
                    fontSize={13} fontWeight="bold"
                  >
                    {formatValue(val, activeNumberType)}
                  </text>
                </g>
              );
            })}

            {/* Order Mode: Placed Values */}
            {currentChallenge?.type === 'order_values' && Array.from(orderedPlacements.entries()).map(([val, pos]) => {
              const x = valueToX(pos);
              return (
                <g key={`ord-${val}`}>
                  <circle cx={x} cy={LINE_Y} r={POINT_RADIUS}
                    fill="#34d399" stroke="white" strokeWidth={2} />
                  <text x={x} y={LINE_Y - POINT_RADIUS - 8}
                    textAnchor="middle" fill="#6ee7b7" fontSize={13} fontWeight="bold">
                    {formatValue(val, activeNumberType)}
                  </text>
                </g>
              );
            })}

          </svg>
        </div>

        {/* Open build (build_hops): the first way once it was right, the ways lever's example, the hop buttons,
            the live line (never a number), and the commit. */}
        {isBuild && hopsTask && !allChallengesComplete && (
          <div className="flex flex-col items-center gap-3" data-build-hops>
            {firstWayNow && (
              <div className="flex items-center gap-2 text-sm text-slate-300" data-first-way>
                <span>Your first way:</span>
                {firstWayNow.map((h, i) => (
                  <span key={i} className="rounded-full bg-emerald-500/20 px-3 py-1 font-bold text-emerald-200">hop {h}</span>
                ))}
              </div>
            )}
            {waysModelOn && (() => {
              const model = waysModel(hopsTask);
              return (
                <div className="rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-300" data-lever="ways-model">
                  Two ways to land on {model.target} from 0: {model.ways.map(w => w.join(' then ')).join(', or ')}.
                </div>
              );
            })()}
            <div className="flex max-w-md flex-wrap items-center justify-center gap-2" role="group" aria-label="Hop size">
              {Array.from({ length: MAX_HOP }, (_, i) => i + 1).map(size => (
                <button key={size} type="button" aria-label={`Hop ${size}`} disabled={hopDisabled(size)}
                  onClick={() => addHop(size)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-300/50 bg-orange-500/15 text-lg font-bold text-orange-100 transition-transform hover:scale-105 disabled:opacity-30">
                  {size}
                </button>
              ))}
            </div>
            <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
              {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
            </div>
            {buildOpen && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <LuminaButton tone="primary" onClick={doneBuilding}
                  disabled={!hops.length || progress.canAttempt === false}>
                  I&apos;m done!
                </LuminaButton>
                <LuminaButton tone="subtle" onClick={() => removeHop(hops.length - 1)}
                  disabled={!hops.length || progress.canAttempt === false}>
                  Take back a hop
                </LuminaButton>
                <LuminaButton tone="subtle" onClick={startOver} disabled={progress.canAttempt === false}>
                  Start over
                </LuminaButton>
              </div>
            )}
            <p className="text-center text-xs text-slate-500">
              Tap a hop size to hop. Tap a yellow dot to take that hop off. Press I&apos;m done! when you have landed.
            </p>
          </div>
        )}
        </PipWorkspace>

        {/* Number Type Toggle (3-5 mode only; a build is whole hops) */}
        {!isK2 && !isBuild && (
          <LuminaModeTabs
            tabs={NUMBER_TYPE_TABS}
            active={activeNumberType}
            accent="blue"
            onSelect={(nt) => setActiveNumberType(nt as typeof activeNumberType)}
          />
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isBuild && !isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                <LuminaActionButton
                  action="check"
                  onClick={checkAnswer}
                  disabled={!canCheck || progress.canAttempt === false}
                />
                {(placedPoints.length > 0 || jumpEndPoints.length > 0 || orderedPlacements.size > 0) && (
                  <LuminaButton
                    tone="subtle"
                    onClick={clearResponse}
                  >
                    Clear
                  </LuminaButton>
                )}
              </>
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

        {/* Hint after 2 failed attempts */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {/* Phase Summary Panel — shown when all challenges complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score}
            durationMs={elapsedMs}
            heading="Number Line Complete!"
            celebrationMessage={`You completed all ${challenges.length} challenges!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace is the only teaching path: an unbound mount shows the shared "needs the tutor" card.
const NumberLine = withWorkspaceOnly<NumberLineProps>('number-line', NumberLineSurface, props => props.data.title);

export default NumberLine;
