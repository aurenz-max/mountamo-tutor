'use client';

/**
 * Compare objects, taught on the shared teaching workspace only (the boss: `compareObjects.card.ts` +
 * `compareObjects.boss.ts`). The tutor asks and helps; spoken answers are judged against the key, and the board checks
 * an ordering itself. A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - identify_attribute (K + 1): the tutor names the objects and the closed menu aloud; the child SAYS what the
 *    picture lets us measure. No attribute chips: the vocabulary K.MD.1 is about has to leave the child's mouth.
 *  - compare_two (K + 1): the child SAYS the name of the object that is longer / heavier / holds more. No object
 *    buttons: a two-button ask is a coin flip.
 *  - order_three (1): the child ARRANGES the three objects by touching them in order. The arrangement IS the answer,
 *    so this mode keeps its hands, and the board checks it once the child stops touching.
 *  - non_standard (1): the child COUNTS the units along the object and SAYS the number. No keypad.
 *
 * ⭐ THE UNIT NUMBERS ARE AN ANSWER KEY IN PIXELS. Numbering the measuring boxes 1..n puts the spoken answer on the
 * last box, so the numbering is held behind `runner.revealHeld` and paints only once the answer is credited.
 *
 * AN ORDERING CLOSES ON STILLNESS. All three touched waits a beat (a mis-tap is normal); a part-built order waits
 * longer, and neither close is correctness-gated: a reversed order and a two-of-three order commit as readily as the
 * right one, which is what gives the tutor something to teach. The windows are the runner's (`armStillness`).
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CompareObjectsMetrics } from '../../../evaluation/types';
import {
  ATTRIBUTE_CHILD_FORM, compareOrderMiss, describeOrder, orderMatches, workspaceScene,
  type CompareObjectsItem, type ComparisonWord, type MeasurableAttribute,
} from './compareObjectsDomain';
import { compareObjectsBoss, compareObjectsItems } from './compareObjects.boss';
import {
  COMPARE_LEVERS, FEWER_CHOICES_LEVER, FIVE_MARKS_LEVER, GRID_LEVER, MENU_LEVER, MENU_PICTURE, SLOTS_LEVER, STEPS_LEVER,
  TAP_BOXES_LEVER, WORD_MODEL_LEVER, droppedChoice, orderSteps, wordModel,
} from './compareObjectsLevers';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CompareObject {
  name: string;
  visualSize: number; // relative render size (0-100 scale)
  actualValue: number; // hidden true measurement for scoring
}

export interface CompareObjectsChallenge {
  id: string;
  type: 'identify_attribute' | 'compare_two' | 'order_three' | 'non_standard';
  instruction: string;
  attribute: 'length' | 'height' | 'weight' | 'capacity';
  objects: CompareObject[];
  correctAnswer: string; // object name for compare_two, comma-separated ordered names for order_three
  comparisonWord: 'longer' | 'shorter' | 'taller' | 'shorter_height' | 'heavier' | 'lighter' | 'holds_more' | 'holds_less';
  hint: string;
  // identify_attribute fields
  attributeOptions?: string[];
  correctAttribute?: string;
  // non_standard fields
  unitName?: string;
  unitCount?: number;
  // weight order_three: unit shown on each scale readout (e.g. 'lbs', 'kg')
  weightUnit?: string;
  // ── Support-tier scaffolding (set by generator when config.difficulty present) ──
  supportTier?: 'easy' | 'medium' | 'hard';
  /** non_standard: number the unit boxes 1..n. POST-AFFIRMATION ONLY — the last box equals the spoken answer (see
   *  the module docblock). */
  showUnitNumbers?: boolean;
  showScaleReadout?: boolean; // order_three weight: show digital readout (hard → hidden)
}

export interface CompareObjectsData {
  title: string;
  description?: string;
  challenges: CompareObjectsChallenge[];
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CompareObjectsMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  identify_attribute: { label: 'Identify', icon: '🔍' },
  compare_two:        { label: 'Compare',  icon: '⚖️' },
  order_three:        { label: 'Order',    icon: '📊' },
  non_standard:       { label: 'Measure',  icon: '📏' },
};

const ATTRIBUTE_COLORS: Record<string, string> = {
  length: 'from-blue-500/30 to-cyan-500/30',
  height: 'from-emerald-500/30 to-green-500/30',
  weight: 'from-amber-500/30 to-orange-500/30',
  capacity: 'from-purple-500/30 to-pink-500/30',
};

/** Mid-order: a five-year-old pauses to think between objects. Structural, never correctness-gated. */
const ORDER_SETTLE_MS = 4000;
/** All three touched: a terminal shape, but a mis-tap is normal, so it still waits a beat. */
const ORDER_COMPLETE_SETTLE_MS = 1500;

// ============================================================================
// Visual Renderers — the page, unchanged. Nothing here is an answer surface.
// ============================================================================

function renderLengthObject(obj: CompareObject, index: number, maxWidth: number) {
  const width = Math.max(30, (obj.visualSize / 100) * maxWidth);
  const colors = [
    'from-blue-400 to-blue-600',
    'from-rose-400 to-rose-600',
    'from-emerald-400 to-emerald-600',
  ];
  return (
    <div key={index} className="flex items-center gap-3">
      <span className="text-slate-300 text-sm w-24 text-right shrink-0">{obj.name}</span>
      <div
        className={`h-8 rounded-full bg-gradient-to-r ${colors[index % colors.length]} border border-white/20 shadow-lg transition-all duration-500`}
        style={{ width: `${width}px` }}
      />
    </div>
  );
}

function renderHeightObject(obj: CompareObject, index: number, maxHeight: number) {
  const height = Math.max(20, (obj.visualSize / 100) * maxHeight);
  const colors = [
    'from-blue-400 to-blue-600',
    'from-rose-400 to-rose-600',
    'from-emerald-400 to-emerald-600',
  ];
  return (
    <div key={index} className="flex flex-col items-center gap-2">
      <div className="flex-1 flex items-end">
        <div
          className={`w-16 rounded-t-lg bg-gradient-to-t ${colors[index % colors.length]} border border-white/20 border-b-0 shadow-lg transition-all duration-500`}
          style={{ height: `${height}px` }}
        />
      </div>
      <div className="w-16 h-1 bg-slate-500 rounded" />
      <span className="text-slate-300 text-sm text-center">{obj.name}</span>
    </div>
  );
}

function renderWeightObject(objects: CompareObject[]) {
  // Seesaw visualization
  const leftObj = objects[0];
  const rightObj = objects[1];
  if (!leftObj || !rightObj) return null;

  const diff = leftObj.actualValue - rightObj.actualValue;
  const maxDiff = Math.max(leftObj.actualValue, rightObj.actualValue);
  const tiltDeg = maxDiff > 0 ? Math.min(12, (Math.abs(diff) / maxDiff) * 15) : 0;
  // SVG positive rotation = clockwise → left side goes UP. Heavier left needs
  // CCW (negative) so the heavier side sinks. Invert sign of diff.
  const tiltDirection = diff > 0 ? -1 : diff < 0 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <svg viewBox="0 0 300 120" className="w-full max-w-sm">
        <polygon points="150,110 135,85 165,85" fill="rgb(100,116,139)" />
        <g transform={`rotate(${tiltDirection * tiltDeg}, 150, 85)`}>
          <rect x="30" y="80" width="240" height="8" rx="4" fill="rgb(148,163,184)" />
          <rect x="40" y="70" width="50" height="12" rx="3" fill="rgb(96,165,250)" opacity="0.8" />
          <text x="65" y="65" textAnchor="middle" fill="rgb(203,213,225)" fontSize="11">{leftObj.name}</text>
          <circle cx="65" cy="55" r={Math.max(8, (leftObj.visualSize / 100) * 18)} fill="rgb(96,165,250)" opacity="0.6" />
          <rect x="210" y="70" width="50" height="12" rx="3" fill="rgb(244,114,182)" opacity="0.8" />
          <text x="235" y="65" textAnchor="middle" fill="rgb(203,213,225)" fontSize="11">{rightObj.name}</text>
          <circle cx="235" cy="55" r={Math.max(8, (rightObj.visualSize / 100) * 18)} fill="rgb(244,114,182)" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

function renderThreeScaleWeights(objects: CompareObject[], weightUnit: string, showReadout = true) {
  // Three platform scales side-by-side. Each object sinks the platform by
  // visualSize (heavier = bigger drop), and the readout below shows the weight.
  const platformColors = [
    'from-amber-300 to-amber-500',
    'from-rose-300 to-rose-500',
    'from-emerald-300 to-emerald-500',
  ];
  const maxDropPx = 22;

  return (
    <div className="flex items-end justify-center gap-4 w-full pt-6">
      {objects.map((obj, i) => {
        const dropPx = (obj.visualSize / 100) * maxDropPx;
        const displayWeight = Math.max(1, Math.round(obj.visualSize / 10));
        return (
          <div key={obj.name} className="flex flex-col items-center gap-0">
            <div
              className={`px-3 py-1.5 rounded-lg bg-gradient-to-br ${platformColors[i % platformColors.length]} border border-white/30 shadow-md text-slate-900 text-xs font-semibold whitespace-nowrap min-w-[78px] text-center`}
              style={{ transform: `translateY(${dropPx}px)`, transition: 'transform 0.4s' }}
            >
              {obj.name}
            </div>
            <div
              className="w-24 h-2 mt-1 bg-gradient-to-b from-slate-300 to-slate-500 rounded-full shadow-md border border-white/10"
              style={{ transform: `translateY(${dropPx}px)`, transition: 'transform 0.4s' }}
            />
            <div
              className="w-3 bg-slate-500/70 border-x border-slate-400/60"
              style={{ height: `${Math.max(4, 24 - dropPx)}px`, transition: 'height 0.4s' }}
            />
            <div className="w-28 h-12 bg-slate-700 rounded-md border border-slate-500 flex items-center justify-center shadow-md">
              <div className="bg-black/70 px-2 py-0.5 rounded font-mono text-amber-300 text-sm font-bold border border-amber-400/30">
                {showReadout ? `${displayWeight} ${weightUnit}` : '— ?'}
              </div>
            </div>
            <div className="w-28 h-1.5 bg-slate-900 rounded-b shadow" />
          </div>
        );
      })}
    </div>
  );
}

function renderCapacityObject(obj: CompareObject, index: number) {
  const fillPercent = Math.max(10, obj.visualSize);
  const colors = [
    'from-blue-400/60 to-blue-500/80',
    'from-rose-400/60 to-rose-500/80',
    'from-emerald-400/60 to-emerald-500/80',
  ];
  return (
    <div key={index} className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-32 border-2 border-white/30 rounded-b-lg overflow-hidden bg-slate-800/50">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colors[index % colors.length]} transition-all duration-500`}
          style={{ height: `${fillPercent}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
      </div>
      <span className="text-slate-300 text-sm text-center">{obj.name}</span>
    </div>
  );
}

/**
 * The measuring row. `showNumbers` is the REVEAL, not a scaffold: the last box
 * carries the number the child is about to say, so it paints only while the
 * tutor is affirming (answer-leak rule, in pixels).
 */
function renderNonStandardMeasure(
  obj: CompareObject,
  unitName: string,
  unitCount: number,
  showNumbers: boolean,
  levers: { tap?: { tapped: readonly number[]; onTap: (i: number) => void }; fives?: boolean } = {},
) {
  const width = Math.max(60, (obj.visualSize / 100) * 320);
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-3">
        <span className="text-slate-300 text-sm w-20 text-right shrink-0">{obj.name}</span>
        <div
          className="h-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 border border-white/20 shadow-lg"
          style={{ width: `${width}px` }}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm w-20 text-right shrink-0">{unitName}s</span>
        {/* tap_boxes lever: each box fills when the learner taps it; five_marks: a thicker line after every fifth box.
            Neither prints a number. */}
        <div className="flex gap-0.5" {...(levers.tap ? { 'data-lever': 'tap-boxes' } : {})}>
          {Array.from({ length: unitCount }).map((_, i) => {
            const filled = !!levers.tap?.tapped.includes(i);
            const fifth = !!levers.fives && (i + 1) % 5 === 0 && i + 1 < unitCount;
            const className = `h-6 border border-dashed border-cyan-400/50 rounded-sm flex items-center justify-center ${
              filled ? 'bg-cyan-300/60' : 'bg-cyan-500/10'} ${fifth ? 'border-r-4 border-r-amber-300 border-solid' : ''}`;
            const style = { width: `${width / unitCount}px` };
            const mark = fifth ? { 'data-lever': 'five-marks' } : {};
            const number = showNumbers && <span className="text-[10px] text-cyan-300">{i + 1}</span>;
            return levers.tap
              ? <button key={i} type="button" data-unit-box={i} data-filled={filled} aria-label="unit box" {...mark}
                  className={className} style={style} onClick={() => levers.tap!.onTap(i)}>{number}</button>
              // dropzone-triage: decorative measurement unit, out of scope
              : <div key={i} data-unit-box={i} {...mark} className={className} style={style}>{number}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * word_model lever: a model pair of plain shapes, fixed per comparison word (never read from the item), the one the
 * asked word names glowing.
 */
function renderWordModel(attribute: MeasurableAttribute, word: ComparisonWord) {
  const { sizes, glow } = wordModel(word);
  const tone = (i: number) => i === glow ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]' : 'bg-slate-500/70';
  return (
    <div data-lever="word-model" data-glow={glow} aria-label="a model pair"
      className="mx-auto flex max-w-xs items-end justify-center gap-4 rounded-xl border border-amber-300/30 bg-slate-900/40 p-3">
      {attribute === 'length'
        ? <div className="flex w-40 flex-col gap-2">{sizes.map((s, i) =>
            <span key={i} data-model={i} className={`block h-3 rounded-full ${tone(i)}`} style={{ width: `${s}%` }} />)}</div>
        : sizes.map((s, i) => attribute === 'weight'
          ? <span key={i} data-model={i} className={`block rounded-md ${tone(i)}`} style={{ width: s / 2, height: s / 2 }} />
          : <span key={i} data-model={i} className={`block w-6 rounded-t ${tone(i)}`} style={{ height: s * 0.6 }} />)}
    </div>
  );
}

/** menu_pictures / fewer_choices levers: one picture per spoken choice, in ask order; none marked, one maybe greyed. */
function renderMenuPictures(options: readonly MeasurableAttribute[], dropped: MeasurableAttribute | null) {
  return (
    <div data-lever="menu-pictures" className="flex justify-center gap-4">
      {options.map(a => (
        <span key={a} data-option={a} data-dropped={a === dropped} aria-label={ATTRIBUTE_CHILD_FORM[a]}
          className={`flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-3xl ${
            a === dropped ? 'opacity-20 grayscale' : ''}`}>{MENU_PICTURE[a]}</span>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

interface CompareObjectsProps {
  data: CompareObjectsData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const CompareObjectsSurface = ({ data, className, runtimePlanItemId }: CompareObjectsProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  const isPreReader = gradeBand === 'K';

  // ── The page (the workspace owns progression) ─────────────────────────────
  const [placedOrder, setPlacedOrder] = useState<string[]>([]);
  /** Post-answer only (answer-leak rule); `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the board held when it last stopped changing. */
  const pendingOrderRef = useRef<string[]>([]);
  // In-item levers (`compareObjectsLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place. The ref is what event handlers read.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CompareObjectsItem | null>(null);
  /** tap_boxes: the unit boxes the learner has tapped, keyed by the item on screen. */
  const [tappedBoxes, setTappedBoxes] = useState<{ item: string; boxes: number[] }>({ item: '', boxes: [] });
  const displayItemRef = useRef<CompareObjectsItem | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `compare-objects-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<CompareObjectsMetrics>({
    primitiveType: 'compare-objects',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Unaskable items are DROPPED (`compareObjectsDomain`); nothing is backfilled.
  const items = useMemo(() => compareObjectsItems({ challenges, gradeBand }), [challenges, gradeBand]);

  /** The generated challenge behind an item (render tiers: the weight unit, the scale read-out). An easier item
   *  (`<id>~simpler`) reads its parent's. */
  const challengeById = useMemo(() => new Map(challenges.map(ch => [ch.id, ch])), [challenges]);
  const challengeFor = (item: CompareObjectsItem | null) => (item ? challengeById.get(item.id.split('~')[0]) ?? null : null);

  const resetStage = useCallback(() => {
    setPlacedOrder([]);
    pendingOrderRef.current = [];
  }, []);

  // ── The submission, once, from the scored session ─────────────────────────
  const handleFinished = useCallback((summary: TeachingEvaluationResult) => {
    const metrics: CompareObjectsMetrics = {
      type: 'compare-objects',
      accuracy: summary.accuracy,
      attributesTested: Array.from(new Set(items.map((i) => i.attribute))),
      totalAttempts: summary.attemptsCount,
      correctCount: summary.solvedCount,
      totalChallenges: items.length,
    };

    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useWorkspaceRunner<CompareObjectsItem>({
    primitiveId: 'compare-objects',
    assignment: compareObjectsBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    instanceId: resolvedInstanceId,
    onFinished: handleFinished,
    // A fresh item never carries an easier one over from the last one.
    onItemOpened: () => { setPractice(null); resetStage(); },
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen.
      switch (item.kind) {
        case 'identify_attribute':
          setReward(item.attribute);
          break;
        case 'compare_two':
          setReward(item.answerNames[0]);
          break;
        case 'order_three':
          setReward(item.answerNames.join('  →  '));
          break;
        default:
          setReward(`${item.unitCount} ${item.unitName}s`);
      }
    },
    // Try again clears the board for another go.
    onCorrectionRetry: (item) => { if ((displayItemRef.current ?? item).kind === 'order_three') resetStage(); },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  displayItemRef.current = currentItem;
  const kind = currentItem?.kind;
  const currentChallenge = challengeFor(currentItem);
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const gridOn = pulledLevers.includes(GRID_LEVER) && currentItem?.kind === 'order_three';
  const tapped = tappedBoxes.item === currentItem?.id ? tappedBoxes.boxes : [];
  const tapBox = useCallback((i: number) => {
    const id = displayItemRef.current?.id ?? '';
    SoundManager.tap();
    setTappedBoxes(prev => {
      const boxes = prev.item === id ? prev.boxes : [];
      return { item: id, boxes: boxes.includes(i) ? boxes.filter(b => b !== i) : [...boxes, i] };
    });
  }, []);
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // ── The ordering: the board checks its own arrangement ────────────────────
  const commitOrder = useCallback(() => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'order_three') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const placed = pendingOrderRef.current;
    // A part-built order commits too: the miss names what it shows.
    runner.commitGesture({ response: describeOrder(item, placed), correct: orderMatches(item, placed),
      miss: compareOrderMiss(item, placed), cue: () => '' });
  }, [runner]);

  /** A hands turn closes on stillness; all three touched shortens the window but never commits on the tap. */
  const armOrderSettle = useCallback((order: string[]) => {
    const item = displayItemRef.current;
    pendingOrderRef.current = order;
    if (order.length === 0) {
      // Starting over is thinking, not an answer — nothing to commit.
      runner.clearStillness();
      return;
    }
    const complete = !!item && order.length === item.answerNames.length;
    runner.armStillness(commitOrder, complete ? ORDER_COMPLETE_SETTLE_MS : ORDER_SETTLE_MS);
  }, [runner, commitOrder]);

  const toggleOrderPick = useCallback((name: string) => {
    if (!currentItem || currentItem.kind !== 'order_three') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    const next = placedOrder.includes(name) ? placedOrder.filter((n) => n !== name) : [...placedOrder, name];
    setPlacedOrder(next);
    armOrderSettle(next);
  }, [currentItem, runner, placedOrder, armOrderSettle]);

  // ── The drawing ───────────────────────────────────────────────────────────
  const renderObjectVisuals = () => {
    if (!currentItem) return null;
    const { attribute, objects } = currentItem;

    if (currentItem.kind === 'non_standard' && objects[0]) {
      return renderNonStandardMeasure(
        objects[0],
        currentItem.unitName,
        currentItem.unitCount,
        // The count-along numbering IS the answer — reveal only, never a scaffold.
        runner.revealHeld,
        { ...(pulledLevers.includes(TAP_BOXES_LEVER) ? { tap: { tapped, onTap: tapBox } } : {}),
          fives: pulledLevers.includes(FIVE_MARKS_LEVER) },
      );
    }
    if (attribute === 'weight' && objects.length === 2) return renderWeightObject(objects);
    if (attribute === 'weight' && objects.length >= 3) {
      return renderThreeScaleWeights(objects, currentChallenge?.weightUnit ?? 'lbs', currentChallenge?.showScaleReadout ?? true);
    }
    switch (attribute) {
      case 'height':
        return <div className="flex items-end justify-center gap-8">{objects.map((obj, i) => renderHeightObject(obj, i, 160))}</div>;
      case 'capacity':
        return <div className="flex items-end justify-center gap-8">{objects.map((obj, i) => renderCapacityObject(obj, i))}</div>;
      case 'length':
      default:
        return <div className="flex flex-col gap-4 w-full">{objects.map((obj, i) => renderLengthObject(obj, i, 280))}</div>;
    }
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const done = runner.practiceSummary;
    return phaseResultsFromSummary(items, done ?? runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '📐' };
      return done?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = done?.outcomes.find(o => o.id === items[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, runner.summary, runner.practiceSummary, items]);

  const celebrationMessage = useMemo(() => {
    const spoken = items.some((i) => i.answerKind === 'voice');
    const hands = items.some((i) => i.answerKind === 'gesture');
    if (spoken && hands) return 'You worked with your voice and your hands!';
    if (spoken) return 'You said every answer out loud!';
    return 'You put every one in order with your own hands!';
  }, [items]);

  // ── The scene and the levers, republished after every render ──────────────
  useLayoutEffect(() => {
    if (!currentItem) return;
    const scene = workspaceScene(currentItem, { placedOrder });
    const levers = practice ? [] : COMPARE_LEVERS.declare(sessionItem, items, pulledLevers);
    workspace.current = {
      ...leverScene(practice ? { ...scene, facts: { ...scene.facts, practice: 'An easier one, ungraded. The full item comes back after it.' } } : scene, {
        support: practice ? '' : COMPARE_LEVERS.support(sessionItem, items),
        onScreen: COMPARE_LEVERS.onScreen(currentItem, items, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the board changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const easier = COMPARE_LEVERS.simpler(sessionItem, items, id);
          if (!easier) return 'There is no easier one for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(easier); resetStage(); runner.clearStillness();
          return { practice: compareObjectsBoss.assignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); resetStage(); runner.clearStillness(); },
    };
  });

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No comparison challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isGestureItem = currentItem?.answerKind === 'gesture';
  const stageWord = runner.stage === 'affirmed'
    ? 'yes!'
    : runner.stage === 'asking'
      ? (isGestureItem ? 'your turn' : 'say it out loud')
      : 'get ready';

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && currentItem && (
              <div className="flex items-center gap-2">
                <LuminaBadge
                  accent="purple"
                  className={`text-xs bg-gradient-to-r ${ATTRIBUTE_COLORS[currentItem.attribute] ?? ATTRIBUTE_COLORS.length}`}
                >
                  {currentItem.attribute}
                </LuminaBadge>
                <LuminaBadge accent="emerald" className="text-xs">
                  {PHASE_TYPE_CONFIG[currentItem.kind]?.icon} {PHASE_TYPE_CONFIG[currentItem.kind]?.label}
                </LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {isGestureItem ? 'Show me' : 'Say it out loud'}
          </LuminaBadge>
        </div>
        {!isPreReader && description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && currentItem && (
          <>
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            <PipDock />
            {/* The drawing and the ordering board. The tutor speaks the ask — no printed instruction, because a
                pre-reader cannot read one and a reader would not need to listen. Pip outlines the whole surface. */}
            <PipWorkspace className="space-y-4">
              <div className="flex justify-center py-2">
                <LuminaPanel data-pip-object="drawing" className="w-full max-w-md flex justify-center p-6">
                  {/* measure_grid lever: even lines behind the drawing, the same for every object. */}
                  <div className="w-full flex justify-center" {...(gridOn ? { 'data-lever': 'measure-grid', style: {
                    backgroundImage: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.18) 0 1px, transparent 1px 20px),'
                      + ' repeating-linear-gradient(0deg, rgba(148,163,184,0.18) 0 1px, transparent 1px 20px)' } } : {})}>
                    {renderObjectVisuals()}
                  </div>
                </LuminaPanel>
              </div>

              {kind === 'compare_two' && pulledLevers.includes(WORD_MODEL_LEVER)
                && renderWordModel(currentItem.attribute, currentItem.comparisonWord)}
              {kind === 'identify_attribute' && (pulledLevers.includes(MENU_LEVER) || pulledLevers.includes(FEWER_CHOICES_LEVER))
                && renderMenuPictures(currentItem.attributeOptions,
                  pulledLevers.includes(FEWER_CHOICES_LEVER) ? droppedChoice(currentItem) : null)}

              {/* The ordering board — the only interactive surface. */}
              {kind === 'order_three' && (
                <div className="flex flex-col items-center gap-3">
                  {/* order_steps lever: wordless bars that grow the way the order goes; they name no object. */}
                  {pulledLevers.includes(STEPS_LEVER) && (
                    <div data-lever="order-steps" className="flex items-end gap-2" aria-label="the way the order goes">
                      {orderSteps(currentItem).map((h, i) => <span key={i} className="block w-5 rounded-sm bg-purple-400/60" style={{ height: h }} />)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-center">
                    {currentItem.objectNames.map((name) => {
                      const orderIndex = placedOrder.indexOf(name);
                      const isPicked = orderIndex !== -1;
                      return (
                        <LuminaButton
                          key={name}
                          data-pip-object={`pick-${name}`}
                          className={`px-5 py-3 border transition-all relative ${
                            isPicked
                              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                              : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                          }`}
                          onClick={() => toggleOrderPick(name)}
                          disabled={!runner.canAttempt}
                        >
                          {isPicked && (
                            <LuminaBadge accent="emerald" className="absolute -top-2 -right-2 text-[10px] px-1.5">
                              {orderIndex + 1}
                            </LuminaBadge>
                          )}
                          {name}
                        </LuminaButton>
                      );
                    })}
                  </div>
                  {/* touch_slots lever: three dots that fill one per object touched. */}
                  {pulledLevers.includes(SLOTS_LEVER) && (
                    <div data-lever="touch-slots" className="flex gap-2">
                      {currentItem.objectNames.map((_, i) => (
                        <span key={i} data-filled={i < placedOrder.length}
                          className={`block w-4 h-4 rounded-full border-2 border-emerald-300/70 ${i < placedOrder.length ? 'bg-emerald-300/80' : ''}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </PipWorkspace>

            {/* The reward — the first moment an answer may appear, gated on `revealHeld` (18b). */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                  {reward}
                </span>
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {isGestureItem
                  ? 'Touch them in order — the board checks when you stop.'
                  : 'Look at the picture, then say your answer out loud.'}
              </p>
            )}
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Comparison Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// One path: the tutor teaches on the workspace; a mount with no tutor shows the shared "needs the tutor" card.
const CompareObjects = withWorkspaceOnly<CompareObjectsProps>('compare-objects', CompareObjectsSurface, props => props.data.title);

export default CompareObjects;
