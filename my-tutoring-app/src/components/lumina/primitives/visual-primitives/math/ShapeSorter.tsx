'use client';

/**
 * ShapeSorter — the judged-loop stage (fifth math DI port; qa/di/BACKLOG.md
 * item 18). The tutor asks, the child answers OUT LOUD, the tutor's verdict
 * moves the lesson, and this file only draws what she is talking about.
 *
 * NOTHING ON THIS SURFACE IS TAPPABLE except the mic and tap-to-hear. Deleted
 * with the click era: the select-all identify grid with its per-tap green/red
 * ring, the −/+ side and corner steppers, the "Side 1 / Side 2 / Side 3" tap
 * row, the "Show corners" toggle, the shape tray + bin buttons, Check, Next
 * Challenge, the ≥3-attempt hint panel, every feedback string that named the
 * answer, and the old improvised-tutor hook with all six of its pushed turns.
 *
 * ⭐ THE LEAK THAT WAS PIXELS, NOT STRINGS — and there were three of them, all
 * live in the click era and all harmless only for as long as a button graded
 * the answer:
 *
 *  1. THE "Side 1 … Side N" BUTTON ROW. It printed one labelled, NUMBERED
 *     control per side of the shape, directly under a question asking how many
 *     sides the shape has. Counting the buttons was the answer; the highest
 *     number printed on them WAS the answer. Deleted outright.
 *  2. THE CURVED-SHAPE NOTE. `CountView` rendered *"This shape has curved sides
 *     — no straight sides or corners!"* — the answer to its own question, and
 *     an assertion of one of the two arguable answers the script now refuses to
 *     ask at all (see `isCountable`). Deleted with the ask.
 *  3. THE "Find N" BADGE. `showMatchCount` printed how many shapes matched the
 *     rule — the select-all answer, as a number, at the easy tier. The mode
 *     names shapes now, so the badge has nothing to count and is gone.
 *
 * What SURVIVES is the paper on the table: the drawn shapes, the highlight ring
 * that says which one "this shape" means, the corner dots (a perception aid —
 * it marks what to count without ever stating how many, which is the line the
 * numbered buttons crossed), and the labelled mats. The mats are labelled at
 * EVERY tier now: the click era blanked them at `hard`, which was legal while
 * the answer was a position you could tap, and is an unanswerable question the
 * moment the answer is the label said aloud. That withdrawal moved into the ASK
 * (`namesChoices`) — see the script header.
 *
 * Cue lines, judging contracts, the geometry table and the build gates live in
 * `shapeSorterScript.ts` (hand-authored, DISTAR). Nothing in this file writes a
 * spoken line, and nothing in it decides an answer.
 *
 * NO TIMED STIMULUS, so no `onPresentStimulus`: every shape this pack asks
 * about is on screen for the whole item, and the ask refers to a highlight that
 * is already painted. `tutor-owns-the-clock` still binds progression — the
 * runner owns that — there is simply no presentation beat to gate.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaDropZone,
  LuminaReadAloudGlyph,
  type DropZoneState,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  SHAPE_PROPERTIES,
  itemsFromChallenges,
  shapeSorterPackBase,
  type ShapeSorterItem,
  type ShapeSorterMode,
  type ShapeSorterTier,
} from './shapeSorterScript';

// Re-exported: the geometry table used to live here and the generator kept a
// hand-synced copy of it. It has one home now (the script module, which is not
// a client module, so the server side can import it); this alias keeps existing
// importers of `ShapeSorter`'s table working.
export { SHAPE_PROPERTIES };

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
  type: ShapeSorterMode;
  instruction: string;
  /** The attribute being tested: shape name, color, side count, or curved.
   *  Under the judged loop this is the SORT dimension (sort) or the pool
   *  composition lever (identify/count) — never an answer surface. */
  ruleAttribute: 'shape' | 'color' | 'sides' | 'curved';
  /** identify: the value the pool was composed around. count: the shape to
   *  examine. Never rendered — the tutor's ask is the instruction now. */
  targetValue?: string;
  /** Pool of shapes — all challenge types use this unified array. */
  shapes: ShapeSorterShape[];

  // ── Within-mode support tier (config.difficulty) ────────────────────────
  /** Tier this challenge was generated at ('easy' | 'medium' | 'hard'). */
  supportTier?: ShapeSorterTier;
  /** count: pre-reveal the corner dots so the student counts them directly.
   *  A perception aid, never a readout — it marks what to count and states no
   *  number. easy only. */
  showCornerHints?: boolean;
  /** sort: show each mat's live count of AFFIRMED shapes (progress, not a
   *  self-check — nothing lands on a mat until the tutor says so). */
  showBinCounts?: boolean;
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
// Constants
// ============================================================================

const MODE_META: Record<ShapeSorterMode, { label: string; icon: string; accent: 'purple' | 'emerald' | 'cyan' }> = {
  identify: { label: 'Name It', icon: '🔷', accent: 'purple' },
  count: { label: 'Count', icon: '🔢', accent: 'emerald' },
  sort: { label: 'Sort', icon: '📦', accent: 'cyan' },
};

const SHAPE_COLORS: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4',
};

const SIZE_SCALE: Record<string, number> = { small: 0.6, medium: 1.0, large: 1.4 };

const MAT_COLORS = ['text-cyan-300', 'text-purple-300', 'text-amber-300', 'text-emerald-300'];

// ============================================================================
// SVG Shape Rendering — drawing only; it decides nothing
// ============================================================================

function renderShapeSVG(
  shape: string, cx: number, cy: number, baseSize: number,
  color: string, rotation: number,
  opts?: { dimmed?: boolean; showCorners?: boolean },
): React.ReactNode {
  const fill = SHAPE_COLORS[color] || color || '#94a3b8';
  const opacity = opts?.dimmed ? 0.25 : 1;
  const stroke = 'rgba(255,255,255,0.3)';
  const s = baseSize;
  const transform = `rotate(${rotation} ${cx} ${cy})`;

  let shapeEl: React.ReactNode = null;
  const cornerDots: React.ReactNode[] = [];

  /** Corner dots mark WHERE to count, never HOW MANY — no number is printed,
   *  and the child still has to enumerate them out loud. */
  const addCornerDots = (corners: number[][]) => {
    if (!opts?.showCorners) return;
    corners.forEach(([x, y], i) => {
      cornerDots.push(
        <circle key={`corner-${i}`} cx={x} cy={y} r={4} fill="#fbbf24"
          stroke="#000" strokeWidth={1} transform={transform} />
      );
    });
  };

  switch (shape) {
    case 'circle': {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      break;
    }
    case 'oval': {
      shapeEl = <ellipse cx={cx} cy={cy} rx={s * 0.65} ry={s * 0.4} fill={fill}
        stroke={stroke} strokeWidth={1.5} opacity={opacity} transform={transform} />;
      break;
    }
    case 'square': {
      const half = s / 2;
      const c = [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'triangle': {
      const h = s * 0.866;
      const c = [[cx, cy - h / 2], [cx - s / 2, cy + h / 2], [cx + s / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'rectangle': {
      // Drawn 2:1 on purpose — a rectangle and a square must never both be
      // defensible names for one drawing (the K convention di-shapes states).
      const w = s * 1.4, h = s * 0.7;
      const c = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'diamond':
    case 'rhombus': {
      // ONE branch, so these are the SAME drawing — which is why the script
      // accepts either name for either item rather than judging one wrong.
      const half = s / 2;
      const c = [[cx, cy - half * 1.2], [cx + half, cy], [cx, cy + half * 1.2], [cx - half, cy]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'hexagon': {
      const r = s / 2;
      const c = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'pentagon': {
      const r = s / 2;
      const c = Array.from({ length: 5 }, (_, i) => {
        const a = (2 * Math.PI / 5) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    default: {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
    }
  }

  return <g>{shapeEl}{cornerDots}</g>;
}

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
  const gradeLevel = isPreReader ? 'Kindergarten' : 'Grade 1';

  const stableInstanceIdRef = useRef(instanceId || `shape-sorter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<ShapeSorterItem[]>(
    () => itemsFromChallenges(challenges, { isPreReader }),
    [challenges, isPreReader],
  );

  /**
   * The affirmed item's reveal payload. Set on the affirm and rendered behind
   * `runner.revealHeld` — NOT `currentSolved` and NOT `stage`, and deliberately
   * never cleared in `onItemOpened` (18b): the runner opens the next item in the
   * SAME dispatch as the affirmation, so both of the obvious gates are already
   * false by render time and a payload cleared there paints on the last item
   * and nowhere else.
   */
  const [reveal, setReveal] = useState<{
    itemId: string;
    challengeId: string;
    answer: string;
  } | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<ShapeSorterMetrics>({
    primitiveType: 'shape-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Per-mode accuracy off the runner's own outcome ledger — the only record of
   *  what the child actually produced. */
  const accuracyFor = useCallback((summary: JudgedRunSummary, mode: ShapeSorterMode): number => {
    const ofMode = items.filter((i) => i.mode === mode);
    if (ofMode.length === 0) return 100;
    const total = ofMode.reduce(
      (sum, i) => sum + (summary.outcomes.find((o) => o.id === i.id)?.score ?? 0),
      0,
    );
    return Math.round(total / ofMode.length);
  }, [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: ShapeSorterMetrics = {
      type: 'shape-sorter',
      identifyAccuracy: accuracyFor(summary, 'identify'),
      countAccuracy: accuracyFor(summary, 'count'),
      sortAccuracy: accuracyFor(summary, 'sort'),
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [accuracyFor, evaluation]);

  // ── The pack — wording lives in shapeSorterScript.ts ───────────────────────
  const pack = useMemo<JudgedScriptPack<ShapeSorterItem>>(() => ({
    ...shapeSorterPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to start.',
      ready: () => 'Look at the shape — then say your answer out loud.',
      retry: () => 'Have another go — say your answer out loud.',
      noVerdict: () => 'One more time — say your answer out loud.',
      done: 'Great shape work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard?.trim() ?? '';
      const challenge = item.mode === 'identify'
        ? 'Look at a drawn shape and say its name out loud'
        : item.mode === 'count'
          ? `Look at a drawn shape and say how many ${item.countNoun ?? 'sides'} it has`
          : 'Look at a drawn shape and say which group it belongs with';
      return {
        challenge,
        expected: `"${item.answer}" said out loud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<ShapeSorterItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => setReveal({
      itemId: item.id,
      challengeId: item.challengeId,
      answer: item.answer,
    }),
  });

  const currentItem = runner.currentItem;
  const modeMeta = MODE_META[currentItem?.mode ?? 'identify'];
  const currentChallenge = useMemo(
    () => challenges.find((c) => c.id === currentItem?.challengeId) ?? null,
    [challenges, currentItem],
  );

  /**
   * The mat the tutor is affirming right now, for the reveal ring. Guarded on
   * the challenge as well as the hold: by render time the surface may already
   * point at the next challenge's mats, and lighting one of those would be
   * wrong.
   */
  const revealedChoice =
    runner.revealHeld && reveal && reveal.challengeId === currentItem?.challengeId
      ? reveal.answer
      : null;

  /** The answer, printed — but only while the tutor is saying it. The first
   *  moment it may appear on screen is the affirmation (answer-leak rule). */
  const revealedAnswer = runner.revealHeld && reveal ? reveal.answer : null;

  /**
   * Which shapes of this challenge have already been placed, read off the
   * runner's solved ledger rather than a local map — so the only thing that can
   * put a shape on a mat is a tutor affirmation.
   */
  const placedByChoice = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentItem) return map;
    for (const item of items) {
      if (item.challengeId !== currentItem.challengeId || item.mode !== 'sort') continue;
      if (!runner.solvedIds.has(item.id)) continue;
      map.set(item.answer, (map.get(item.answer) ?? 0) + 1);
    }
    return map;
  }, [items, currentItem, runner.solvedIds]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: MODE_META[item.mode].label,
      icon: MODE_META[item.mode].icon,
      accentColor: MODE_META[item.mode].accent,
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These shape challenges are still being drawn. Try generating them again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /**
   * The pool — printed material, never an answer surface. The current shape is
   * ringed and the rest are dimmed, because the ask says "this shape" and
   * exactly one drawing on screen has to be the one meant.
   */
  const renderPool = (item: ShapeSorterItem, shapes: ShapeSorterShape[]) => {
    const cols = Math.min(Math.max(shapes.length, 1), 4);
    const cellSize = 96;
    const rows = Math.ceil(shapes.length / cols);
    const svgWidth = cols * cellSize;
    const svgHeight = rows * cellSize;

    return (
      <div className="flex justify-center">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="max-w-full h-auto"
          role="img"
          aria-label="Shapes to look at"
        >
          {shapes.map((s, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = col * cellSize + cellSize / 2;
            const cy = row * cellSize + cellSize / 2;
            const baseSize = 40 * (SIZE_SCALE[s.size] || 1);
            const isCurrent = i === item.shapeIndex;
            return (
              <g key={`${s.shape}-${i}`}>
                {isCurrent && (
                  <circle
                    cx={cx} cy={cy} r={cellSize / 2 - 6}
                    fill="none"
                    stroke={revealedAnswer ? '#34d399' : '#fbbf24'}
                    strokeWidth={3}
                  />
                )}
                {renderShapeSVG(s.shape, cx, cy, baseSize, s.color, s.rotation, {
                  dimmed: !isCurrent,
                })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  /** The single shape a counting item examines, drawn large. */
  const renderCountStage = (item: ShapeSorterItem, shape: ShapeSorterShape) => (
    <div className="flex justify-center">
      <svg width={220} height={220} viewBox="0 0 220 220" role="img" aria-label="Shape to count">
        {renderShapeSVG(shape.shape, 110, 110, 110, shape.color, shape.rotation, {
          showCorners: item.showCornerHints,
        })}
      </svg>
    </div>
  );

  /**
   * The mats — printed, LABELLED AT EVERY TIER, and nothing here is clickable:
   * the child says the group out loud. The click era blanked these labels at
   * `hard`; under a spoken answer that is an unanswerable question, so the
   * tier's withdrawal lives in the ask instead (`namesChoices`).
   */
  const renderMats = (item: ShapeSorterItem) => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? 0;
        const isRevealed = revealedChoice === label;
        const zoneState: DropZoneState = isRevealed ? 'correct' : placed > 0 ? 'filled' : 'idle';
        return (
          <div key={label} className="w-full">
            <h3
              className={`mb-2 text-center font-bold ${MAT_COLORS[idx] ?? MAT_COLORS[0]} ${
                isPreReader ? 'text-lg' : 'text-sm'
              }`}
            >
              {label}
            </h3>
            <LuminaDropZone
              state={zoneState}
              className="min-h-[76px] pointer-events-none content-center justify-center"
            >
              {item.showBinCounts && placed > 0 && (
                <LuminaBadge
                  aria-label={`${placed} shapes placed here`}
                  className="bg-white/10 border-white/10 text-slate-200 text-xs"
                >
                  {placed}
                </LuminaBadge>
              )}
            </LuminaDropZone>
          </div>
        );
      })}
    </div>
  );

  const poolShapes = currentChallenge?.shapes ?? [];
  const countShape = currentItem ? poolShapes[currentItem.shapeIndex] : undefined;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && !isPreReader && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — the question again, never a hint ladder, and
                  never withdrawn by band or tier. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {currentItem && (
              <>
                {currentItem.mode === 'count' && countShape
                  ? renderCountStage(currentItem, countShape)
                  : renderPool(currentItem, poolShapes)}

                <div className="flex justify-center">
                  <LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} />
                </div>

                {currentItem.mode === 'sort' && renderMats(currentItem)}

                {/* The answer, on screen for exactly as long as she is saying
                    it. `revealHeld` opens on the affirmation and closes when her
                    cue for the next item is SENT — no tuned constant. */}
                {revealedAnswer && (
                  <p className="text-center text-emerald-300 text-lg font-semibold">
                    {revealedAnswer}
                  </p>
                )}
              </>
            )}

            {/* Open for the whole run — no tutor-busy gate, no push-to-talk. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Shape Work Complete!"
            celebrationMessage="Great shape work — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ShapeSorter;
