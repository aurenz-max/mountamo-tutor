'use client';

/**
 * CompareObjects — DI modality. The Live tutor owns the clock in every mode
 * (qa/di/BACKLOG.md item 18 P4; the FOURTH math port).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - identify_attribute (K + 1): the tutor names the objects and the closed
 *    menu aloud; the child SAYS what the picture lets us measure. The four
 *    attribute chips are deleted — a child who cannot read a drawing can still
 *    tap one of three, and the vocabulary K.MD.1 is ABOUT never left their
 *    mouth.
 *  - compare_two (K + 1): the child SAYS the name of the object that is
 *    longer / heavier / holds more. The two object buttons are deleted (a
 *    two-button ask is a coin flip, and it is the shape the user has struck
 *    down three times).
 *  - order_three (1): the child ARRANGES the three objects by touching them in
 *    order. The arrangement IS the answer — the third unsayable shape — so
 *    this mode keeps its hands, and the screen is the page.
 *  - non_standard (1): the child COUNTS the units along the object and SAYS
 *    the number. The numeric keypad is deleted.
 *
 * WHAT CHANGED. Deleted: every Check control and the answer-checking handler
 * with its four per-mode checkers, the Next control, the numeric keypad, the attribute
 * chips, the object buttons, the feedback card that printed the answer, the
 * 3-attempt reveal ladder, the old tutor hook and all of its improvised turns,
 * and `tutorRevealClause` (the per-tier prose that governed them). Render-side
 * tier levers survive: `showScaleReadout` still hides the weight read-out at
 * the hard tier. There is no progression timer and no progression control
 * anywhere in this file — progression has exactly one cause: a tutor verdict.
 *
 * ⭐ THE UNIT NUMBERS ARE AN ANSWER LEAK IN PIXELS. `showUnitNumbers` numbers
 * the measuring boxes 1..n as a count-along aid, so the last box shows exactly
 * the number the child is about to say aloud — harmless for as long as a Check
 * button graded it, an answer key the moment the answer is spoken (ten-frame's
 * running counter, one primitive later). The numbering is held behind
 * `runner.revealHeld` and paints only while the tutor is affirming; the
 * count-along survives where it is earned, in the correction, where the tutor
 * counts them with the child.
 *
 * HOW A HANDS-ONLY TURN CLOSES. `order_three` has a STRUCTURAL close — all
 * three touched — which still waits a beat rather than committing on the tap,
 * because a mis-tap is normal and re-ordering is thinking. An incomplete order
 * closes on STILLNESS instead, and neither close is correctness-gated: a
 * reversed order and a two-of-three order both commit exactly as readily as
 * the right one, which is what gives the tutor something to teach. Windows are
 * armed through `runner.armStillness`, never a hand-rolled local timer —
 * the runner owns the five cancel sites.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor speaks only scripted lines; no visible timers;
 * tap-to-hear re-speaks the QUESTION; adult chrome hidden for pre-readers;
 * interaction is gated on `runner.canAttempt`, never on `runner.stage`.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  buildCompareItems,
  orderVerdictCue,
  compareObjectsPackBase,
  type CompareObjectsItem,
} from './compareObjectsScript';
import { numberWordFor } from './countingBoardScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** non_standard: number the unit boxes 1..n. POST-AFFIRMATION ONLY now — the
   *  last box equals the spoken answer (see the module docblock). */
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

/**
 * HOW LONG THE ORDERING BOARD MAY STAY STILL BEFORE IT COMMITS. The window is
 * the runner's (`armStillness`, 19c); these are the per-shape numbers.
 * Both are STRUCTURAL, never correctness-gated — a reversed order commits
 * through the same window as the right one.
 */
/** Mid-order: a five-year-old pauses to think between objects. */
const ORDER_SETTLE_MS = 4000;
/** All three touched — a terminal shape, but a mis-tap is normal, so it still
 *  waits a beat rather than committing on the tap. */
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
        <div className="flex gap-0.5">
          {Array.from({ length: unitCount }).map((_, i) => (
            // dropzone-triage: decorative measurement unit, out of scope
            <div
              key={i}
              className="h-6 border border-dashed border-cyan-400/50 bg-cyan-500/10 rounded-sm flex items-center justify-center"
              style={{ width: `${width / unitCount}px` }}
            >
              {showNumbers && <span className="text-[10px] text-cyan-300">{i + 1}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

interface CompareObjectsProps {
  data: CompareObjectsData;
  className?: string;
}

const CompareObjects: React.FC<CompareObjectsProps> = ({ data, className }) => {
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

  // ── Stage-payload state (the runner owns progression; this is the page) ───
  const [placedOrder, setPlacedOrder] = useState<string[]>([]);
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it land in one React batch, so the
   *  reveal would paint on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the board held when it last stopped changing. */
  const pendingOrderRef = useRef<string[]>([]);

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

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable items are DROPPED (a key that disagrees with the measurements, a
  // drawing that disagrees with the key, an ambiguous attribute menu, names the
  // judge cannot separate by ear, a G1 mode at K). Nothing is backfilled.
  const built = useMemo(
    () => buildCompareItems(challenges, { band: gradeBand }),
    [challenges, gradeBand],
  );
  const items = built.items;

  /** The generated challenge behind an item — the page's own data (drawings,
   *  read-out tiers), which the judged item deliberately does not carry. */
  const challengeById = useMemo(() => {
    const map = new Map<string, CompareObjectsChallenge>();
    for (const ch of challenges) map.set(ch.id, ch);
    return map;
  }, [challenges]);

  const pack = useMemo<JudgedScriptPack<CompareObjectsItem>>(() => ({
    ...compareObjectsPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then put them in order.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go — show me your order.'
        : 'Have another go — say your answer.',
      done: 'Great measuring today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      switch (item.kind) {
        case 'identify_attribute':
          return {
            challenge: `identify_attribute: which attribute the picture of ${item.objectNames.join(' and ')} shows.`,
            expected: item.attribute,
            observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
          };
        case 'compare_two':
          return {
            challenge: `compare_two: which of ${item.objectNames.join(', ')} is ${item.comparisonWord} (${item.attribute}).`,
            expected: item.answerNames[0],
            observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
          };
        case 'order_three':
          return {
            challenge: `order_three: order ${item.objectNames.join(', ')} by ${item.attribute}.`,
            expected: item.answerNames.join(', '),
            observed: `Put them in this order: ${pendingOrderRef.current.join(', ') || 'nothing'}.`,
          };
        default:
          return {
            challenge: `non_standard: measure the ${item.objectNames[0]} in ${item.unitName}s.`,
            expected: `${numberWordFor(item.unitCount)} (${item.unitCount})`,
            observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
          };
      }
    },
  }), [items]);

  // ── Per-item reset — every item owns its starting state ───────────────────
  const resetStageFor = useCallback(() => {
    setPlacedOrder([]);
    pendingOrderRef.current = [];
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useJudgedScriptRunner<CompareObjectsItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetStageFor,
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
    onCorrectionRetry: (item) => {
      // The tutor re-modeled the strategy and re-asked in-band; clear the board
      // for another go. The settle window is re-armed by the runner on this path.
      if (item.kind === 'order_three') {
        setPlacedOrder([]);
        pendingOrderRef.current = [];
      }
    },
  });

  const currentItem = runner.currentItem;
  const currentSolved = runner.currentSolved;
  const kind = currentItem?.kind;
  const currentChallenge = currentItem ? challengeById.get(currentItem.id) ?? null : null;

  // ── The gesture commit ────────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. The close
  // describes the committed order; THE MATCH IS COMPUTED IN CODE.
  const commitOrder = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'order_three') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    runner.submitGestureAttempt(orderVerdictCue(item, pendingOrderRef.current));
  }, [runner]);

  /** A hands turn closes on stillness; a complete order shortens the window but
   *  never commits on the tap (a mis-tap is normal). Further touches re-arm it,
   *  and the runner cancels it at item open, at a correction and at the commit. */
  const armOrderSettle = useCallback((order: string[]) => {
    const item = runner.currentItem;
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
    const next = placedOrder.includes(name)
      ? placedOrder.filter((n) => n !== name)
      : [...placedOrder, name];
    setPlacedOrder(next);
    armOrderSettle(next);
  }, [currentItem, runner, placedOrder, armOrderSettle]);

  // ── The drawing ───────────────────────────────────────────────────────────
  const renderObjectVisuals = useCallback(() => {
    if (!currentItem || !currentChallenge) return null;
    const { attribute } = currentItem;
    const objects = currentChallenge.objects ?? [];

    if (currentItem.kind === 'non_standard' && objects[0]) {
      return renderNonStandardMeasure(
        objects[0],
        currentItem.unitName,
        currentItem.unitCount,
        // The count-along numbering IS the answer — reveal only, never a scaffold.
        runner.revealHeld,
      );
    }

    if (attribute === 'weight' && objects.length === 2) {
      return renderWeightObject(objects);
    }
    if (attribute === 'weight' && objects.length >= 3) {
      return renderThreeScaleWeights(
        objects,
        currentChallenge.weightUnit ?? 'lbs',
        currentChallenge.showScaleReadout ?? true,
      );
    }

    switch (attribute) {
      case 'height':
        return (
          <div className="flex items-end justify-center gap-8">
            {objects.map((obj, i) => renderHeightObject(obj, i, 160))}
          </div>
        );
      case 'capacity':
        return (
          <div className="flex items-end justify-center gap-8">
            {objects.map((obj, i) => renderCapacityObject(obj, i))}
          </div>
        );
      case 'length':
      default:
        return (
          <div className="flex flex-col gap-4 w-full">
            {objects.map((obj, i) => renderLengthObject(obj, i, 280))}
          </div>
        );
    }
  }, [currentItem, currentChallenge, runner.revealHeld]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '📐' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  const celebrationMessage = useMemo(() => {
    const spoken = items.some((i) => i.answerKind === 'voice');
    const hands = items.some((i) => i.answerKind === 'gesture');
    if (spoken && hands) return 'You worked with your voice and your hands!';
    if (spoken) return 'You said every answer out loud!';
    return 'You put every one in order with your own hands!';
  }, [items]);

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

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : currentSolved
      ? 'yes!'
      : runner.running
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
        {!evaluation.hasSubmitted && currentItem && (
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

            {/* The drawing. The tutor speaks the ask — no printed instruction,
                because a pre-reader cannot read one and a reader would not need
                to listen. */}
            <div className="flex justify-center py-2">
              <LuminaPanel className="w-full max-w-md flex justify-center p-6">
                {renderObjectVisuals()}
              </LuminaPanel>
            </div>

            {/* === Ordering workspace — the ONLY interactive surface left === */}
            {kind === 'order_three' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap gap-3 justify-center">
                  {currentItem.objectNames.map((name) => {
                    const orderIndex = placedOrder.indexOf(name);
                    const isPicked = orderIndex !== -1;
                    return (
                      <LuminaButton
                        key={name}
                        className={`px-5 py-3 border transition-all relative ${
                          isPicked
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                            : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                        }`}
                        onClick={() => toggleOrderPick(name)}
                        disabled={!runner.canAttempt}
                      >
                        {isPicked && (
                          <LuminaBadge
                            accent="emerald"
                            className="absolute -top-2 -right-2 text-[10px] px-1.5"
                          >
                            {orderIndex + 1}
                          </LuminaBadge>
                        )}
                        {name}
                      </LuminaButton>
                    );
                  })}
                </div>
              </div>
            )}

            {/* The reward — the first moment an answer may appear. */}
            {/* Gated on `revealHeld`, never on `currentSolved`: the runner opens
                the next item in the same dispatch, so by the time this renders
                the current item is the NEXT one and is not solved (18b). */}
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
                  ? 'Touch them in order — the tutor checks when you stop.'
                  : 'Look at the picture, then say your answer out loud.'}
              </p>
            )}

            {/* The orb tells the truth about the turn: a hands item is not
                "I'm listening". */}
            <JudgedMicPanel run={runner} gestureLabel="Touch them in order" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
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

export default CompareObjects;
