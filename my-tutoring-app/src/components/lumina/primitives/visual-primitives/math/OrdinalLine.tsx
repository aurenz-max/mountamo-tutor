'use client';

/**
 * The ordinal line, taught on the shared teaching workspace only (the boss: `ordinalLine.card.ts` +
 * `ordinalLine.boss.ts`). The tutor asks and helps; spoken names and place words are judged against the key, and the
 * line checks a build itself. A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - identify: at Kindergarten the child SAYS THE NAME of the one in the place asked for; at Grade 1 the child SAYS
 *    THE PLACE of the character named (one eval mode, band-split: `ordinalLineDomain`).
 *  - match: ONE printed symbol card at a time, READ ALOUD. No word column: the word is the answer.
 *  - relative_position: the child SAYS THE NAME of the one right before or after the marked place.
 *  - sequence_story: the tutor says the story; the child SAYS the place of one character in it. It never prints.
 *  - build_sequence: the child ARRANGES the pictures from spoken clues. The arrangement IS the answer, so this mode
 *    keeps its hands, and the line checks it once the child stops touching.
 *
 * ⭐ THE ORDINAL LABELS ARE AN ANSWER KEY IN PIXELS. A label under each character (`3rd`) is the answer on a spoken
 * line, so every ordinal label on the line is held behind `runner.revealHeld` and paints only once the answer is
 * credited. The SLOT labels on `build_sequence` are the exception: there the answer is WHICH PICTURE goes where, not
 * what the place is called, so the numbered slots are the page rather than the key. They stay on the support tier that
 * governs them (`showSlotLabels`, withdrawn at hard).
 *
 * A BUILD CLOSES ON STILLNESS. A full line waits a beat (a mis-tap is normal); a part-filled line waits longer, and
 * neither close is correctness-gated: a reversed line and a two-of-four line commit as readily as the right one,
 * which is what gives the tutor something to teach. The windows are the runner's (`armStillness`).
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  dropZoneStateClass,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { OrdinalLineMetrics } from '../../../evaluation/types';
import { describeLine, lineMatches, lineMiss, ordinalWordFor, workspaceScene, type OrdinalLineItem } from './ordinalLineDomain';
import { ordinalContextOf, ordinalLineBoss, ordinalLineItems } from './ordinalLine.boss';
import { DOTS_LEVER, FLAG_LEVER, ORDINAL_LEVERS, PLACE_MODEL_LEVER, SIDE_MODEL_LEVER, TAP_LEVER, WORD_MODEL_LEVER,
  castEmoji, placeModel, sideModel } from './ordinalLineLevers';
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

export interface OrdinalLineChallenge {
  id: string;
  type: 'identify' | 'match' | 'relative-position' | 'sequence-story' | 'build-sequence';
  instruction: string;
  characters: Array<{ name: string; emoji: string }>;
  targetPosition?: number;         // 1-indexed ordinal
  targetOrdinalWord?: string;      // "third"
  targetOrdinalSymbol?: string;    // "3rd"
  relativeQuery?: 'before' | 'after';
  storyText?: string;
  clues?: Array<{ character: string; position: number }>;
  correctAnswer: string | number;
  options?: Array<string | number>; // legacy multiple-choice payload — never rendered
  matchPairs?: Array<{ word: string; symbol: string }>;

  // --- Support tier (set only when the manifest pins a difficulty) ---
  supportTier?: 'easy' | 'medium' | 'hard';
  /** ORDINAL LABELS UNDER THE LINE. Post-credit only — the label is the answer (see the module docblock). */
  showPositionLabels?: boolean;
  /** Ordinal labels above the build slots; the page, not the key. Default ON, withdrawn at `hard`. */
  showSlotLabels?: boolean;
  /** Mark the reference place on a relative-position ask. The ask NAMES that place aloud, so it is public; withdrawn
   *  at `hard`. */
  highlightTarget?: boolean;
  orderMatchSymbols?: boolean;     // legacy match-grid lever — the grid is gone
}

export interface OrdinalLineData {
  title: string;
  description?: string;
  challenges: OrdinalLineChallenge[];
  maxPosition: number;
  context: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
  showOrdinalLabels: boolean;
  labelFormat: 'word' | 'symbol' | 'both';
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OrdinalLineMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  identify:          { label: 'Identify', icon: '👆' },
  match:             { label: 'Match',    icon: '🔗' },
  relative_position: { label: 'Position', icon: '↔️' },
  sequence_story:    { label: 'Story',    icon: '📖' },
  build_sequence:    { label: 'Build',    icon: '🧱' },
};

const CONTEXT_THEME: Record<string, { bgEmoji: string; startLabel: string; endLabel: string }> = {
  race:         { bgEmoji: '🏁', startLabel: 'START',     endLabel: 'FINISH' },
  parade:       { bgEmoji: '🎉', startLabel: 'Beginning', endLabel: 'End' },
  'lunch-line': { bgEmoji: '🍽️', startLabel: 'Beginning', endLabel: 'End' },
  train:        { bgEmoji: '🚂', startLabel: 'Engine',    endLabel: 'Caboose' },
  bookshelf:    { bgEmoji: '📚', startLabel: 'Left',      endLabel: 'Right' },
};

/** Mid-build: a five-year-old pauses to think between placements. */
const BUILD_SETTLE_MS = 4000;
/** Every place filled: a terminal shape, but a mis-tap is normal, so it still waits a beat. */
const BUILD_COMPLETE_SETTLE_MS = 1500;

/** The levers whose drawing stays on an easier practice item (the flag, the dots, the taps); the models do not. */
const PRACTICE_DRAWN = [FLAG_LEVER, DOTS_LEVER, TAP_LEVER];

// ============================================================================
// Helpers
// ============================================================================

function getOrdinalLabel(position: number, format: 'word' | 'symbol' | 'both'): string {
  const SYMBOLS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const word = ordinalWordFor(position);
  const symbol = SYMBOLS[position - 1] || `${position}th`;
  if (format === 'word') return word;
  if (format === 'symbol') return symbol;
  return `${symbol} (${word})`;
}

/** Stable per item, so the story cast does not re-shuffle on every render. */
function seededShuffle<T>(values: readonly T[], seed: string): T[] {
  const out = [...values];
  let s = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 42;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ============================================================================
// Props
// ============================================================================

interface OrdinalLineProps {
  data: OrdinalLineData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const OrdinalLineSurface = ({ data, className, runtimePlanItemId }: OrdinalLineProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    labelFormat = 'symbol',
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const isPreReader = gradeBand === 'K';
  const resolvedContext = ordinalContextOf(data);
  const contextTheme = CONTEXT_THEME[resolvedContext];

  // ── The page (the workspace owns progression) ─────────────────────────────
  const [placedOrder, setPlacedOrder] = useState<string[]>([]);
  const [heldPicture, setHeldPicture] = useState<string | null>(null);
  /** Post-credit only (answer-leak rule); `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the line held when it last stopped changing. */
  const pendingOrderRef = useRef<string[]>([]);
  // In-item levers (`ordinalLineLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place. The ref is what event handlers read.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<OrdinalLineItem | null>(null);
  const practiceRef = useRef<OrdinalLineItem | null>(null);
  const displayItemRef = useRef<OrdinalLineItem | null>(null);
  /** tap_marks: the pictures on the line the learner has tapped, keyed by the item on screen. */
  const [tapped, setTapped] = useState<{ item: string; names: string[] }>({ item: '', names: [] });

  const stableInstanceIdRef = useRef(instanceId || `ordinal-line-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<OrdinalLineMetrics>({
    primitiveType: 'ordinal-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // A match grid expands to one judged ask PER SYMBOL; everything else is one item. Unaskable items are DROPPED.
  const items = useMemo(() => ordinalLineItems(data), [data]);

  /** The generated challenge behind an item (emoji, tier render flags). A match item's id is `${challengeId}::p${n}`. */
  const challengeById = useMemo(() => new Map(challenges.map(ch => [ch.id, ch])), [challenges]);
  const challengeFor = useCallback((item: OrdinalLineItem | null) =>
    (item ? challengeById.get(item.id.split('::')[0]) ?? null : null), [challengeById]);

  /** Emoji by character name — the picture a pre-reader actually reads. */
  const emojiByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of challenges) {
      for (const c of ch.characters ?? []) {
        if (c?.name && c?.emoji && !map.has(c.name)) map.set(c.name, c.emoji);
      }
    }
    return map;
  }, [challenges]);

  const resetStage = useCallback(() => {
    setPlacedOrder([]);
    setHeldPicture(null);
    pendingOrderRef.current = [];
  }, []);

  // ── The submission, once, from the scored session ─────────────────────────
  const handleFinished = useCallback((summary: TeachingEvaluationResult) => {
    const scoreById = new Map(summary.outcomes.map((o) => [o.id, o.score]));
    // Per-mode accuracy off the per-item scores — nothing here re-grades what was already judged.
    const accuracyOf = (kind: OrdinalLineItem['kind']): number => {
      const scoped = items.filter((i) => i.kind === kind);
      if (scoped.length === 0) return 0;
      const total = scoped.reduce((sum, i) => sum + (scoreById.get(i.id) ?? 0), 0);
      return Math.round(total / scoped.length);
    };

    const metrics: OrdinalLineMetrics = {
      type: 'ordinal-line',
      accuracy: summary.accuracy,
      identifyAccuracy: accuracyOf('identify'),
      matchAccuracy: accuracyOf('match'),
      relativePositionAccuracy: accuracyOf('relative_position'),
      storyAccuracy: accuracyOf('sequence_story'),
      buildAccuracy: accuracyOf('build_sequence'),
      attemptsCount: summary.attemptsCount,
      maxPositionReached: items.reduce(
        (max, i) => Math.max(max, i.askPosition, i.answerOrder.length),
        0,
      ),
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

  const runner = useWorkspaceRunner<OrdinalLineItem>({
    primitiveId: 'ordinal-line',
    assignment: ordinalLineBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    instanceId: resolvedInstanceId,
    onFinished: handleFinished,
    // A fresh item never carries an easier line over from the last one.
    onItemOpened: () => { practiceRef.current = null; setPractice(null); resetStage(); },
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen, and the reveal is the PAIRING (who, and which place),
      // never the answer text alone: at K the child said "Fox" and learns it was third; at Grade 1 they said "third"
      // and see it attached to the Fox.
      switch (item.kind) {
        case 'identify':
          setReward(`${item.lineNames[item.askPosition - 1]} — ${ordinalWordFor(item.askPosition)}`);
          break;
        case 'relative_position': {
          const place = item.relativeQuery === 'before' ? item.askPosition - 1 : item.askPosition + 1;
          setReward(`${item.answerText} — ${ordinalWordFor(place)}`);
          break;
        }
        case 'match':
        case 'sequence_story':
          setReward(item.answerText);
          break;
        default:
          setReward(item.answerOrder.join('  →  '));
      }
    },
    onCorrectionRetry: (sessionItem) => {
      // Try again on the easier line keeps it: clear ITS board, not the full item's.
      const item = practiceRef.current ?? sessionItem;
      if (item.kind === 'build_sequence') resetStage();
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  displayItemRef.current = currentItem;
  const currentChallenge = challengeFor(sessionItem);
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  /** What is drawn: on a practice item only the flag, the dots and the taps stay. */
  const drawnLevers = practice ? pulledLevers.filter(id => PRACTICE_DRAWN.includes(id)) : pulledLevers;
  const emojiOf = (name: string) => (practice ? castEmoji(name) : undefined) ?? emojiByName.get(name) ?? castEmoji(name) ?? '⬤';
  const tappedNames = tapped.item === currentItem?.id ? tapped.names : [];
  const tapPicture = (name: string) => {
    const id = displayItemRef.current?.id ?? '';
    SoundManager.tap();
    setTapped(prev => {
      const names = prev.item === id ? prev.names : [];
      return { item: id, names: names.includes(name) ? names.filter(n => n !== name) : [...names, name] };
    });
  };
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // ── The build: the line checks its own arrangement ────────────────────────
  const commitLine = useCallback(() => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'build_sequence') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const placed = pendingOrderRef.current;
    // A part-filled line commits too: the miss names what it shows.
    runner.commitGesture({ response: describeLine(item, placed), correct: lineMatches(item, placed),
      miss: lineMiss(item, placed), cue: () => '' });
  }, [runner]);

  /** A hands turn closes on stillness; a full line shortens the window but never commits on the tap. */
  const armBuildSettle = useCallback((order: string[]) => {
    const item = displayItemRef.current;
    // SPARSE, not compacted: an empty place between two filled ones is part of what the child made.
    pendingOrderRef.current = order;
    const filled = order.filter(Boolean).length;
    if (filled === 0) {
      // Starting over is thinking, not an answer — nothing to commit.
      runner.clearStillness();
      return;
    }
    const complete = !!item && filled === item.answerOrder.length;
    runner.armStillness(commitLine, complete ? BUILD_COMPLETE_SETTLE_MS : BUILD_SETTLE_MS);
  }, [runner, commitLine]);

  /** Tap a picture to hold it, tap a place to put it there. */
  const holdPicture = useCallback((name: string) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setHeldPicture((held) => (held === name ? null : name));
  }, [runner]);

  const dropIntoPlace = useCallback((position: number) => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'build_sequence') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    // Computed OUTSIDE the state updater: `armBuildSettle` arms a real timer, and an updater runs twice under
    // StrictMode.
    const next = [...placedOrder];
    while (next.length < item.answerOrder.length) next.push('');
    if (heldPicture) {
      SoundManager.snap();
      // A picture lives in exactly one place.
      for (let i = 0; i < next.length; i++) if (next[i] === heldPicture) next[i] = '';
      next[position - 1] = heldPicture;
    } else if (next[position - 1]) {
      next[position - 1] = '';
    } else {
      return;
    }
    setPlacedOrder(next);
    setHeldPicture(null);
    armBuildSettle(next);
  }, [runner, heldPicture, placedOrder, armBuildSettle]);

  // ── The drawing ───────────────────────────────────────────────────────────

  /** The line itself. The answer is spoken; only the tap_marks lever makes its pictures tappable. */
  const renderCharacterLine = (item: OrdinalLineItem, markPosition?: number) => (
    <div className="flex items-end justify-center gap-1 sm:gap-2 py-4 px-2">
      <div data-pip-object="start" className="flex flex-col items-center mr-2">
        {/* front_flag lever: a flag at the front end, the end the ask names. Never a picture. */}
        {drawnLevers.includes(FLAG_LEVER) && <span data-lever="front-flag" aria-label="the front" className="text-lg leading-none">🚩</span>}
        <span className="text-lg">{contextTheme.bgEmoji}</span>
        <span className="text-[10px] text-slate-500 mt-1">{contextTheme.startLabel}</span>
      </div>

      {item.lineNames.map((name, idx) => {
        const pos = idx + 1;
        const isMarked = markPosition === pos;
        // tap_marks lever: a picture the learner taps gets a ring; no order, no number.
        const tappable = item.kind === 'identify' && drawnLevers.includes(TAP_LEVER);
        const ringed = tappable && tappedNames.includes(name);
        return (
          <div
            key={name}
            data-pip-object={isMarked ? 'marked' : undefined}
            {...(tappable ? { 'data-tap-mark': name, 'data-ringed': ringed, role: 'button', onClick: () => tapPicture(name) } : {})}
            className={`flex flex-col items-center transition-all duration-200 ${isMarked ? 'scale-105' : ''} ${tappable ? 'cursor-pointer' : ''}`}
          >
            {/* ⭐ THE ORDINAL LABEL IS THE ANSWER. Reveal only (module docblock). */}
            <span className="text-[10px] mb-1 text-emerald-300 font-medium h-3">
              {runner.revealHeld ? getOrdinalLabel(pos, labelFormat) : ''}
            </span>

            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-200 ${
              isMarked
                ? 'bg-blue-500/20 border-2 border-blue-400/60 shadow-lg shadow-blue-500/20'
                : 'bg-white/5 border border-white/10'
            } ${ringed ? 'ring-2 ring-amber-300' : ''}`}>
              {emojiOf(name)}
            </div>

            {/* The name prints for a reader; a pre-reader reads the picture. */}
            {!isPreReader && (
              <span className="text-[10px] mt-1 text-slate-500">{name}</span>
            )}
          </div>
        );
      })}

      <div className="flex flex-col items-center ml-2">
        <span className="text-lg">{contextTheme.bgEmoji}</span>
        <span className="text-[10px] text-slate-500 mt-1">{contextTheme.endLabel}</span>
      </div>
    </div>
  );

  /** ONE symbol card. No word column: the word IS the answer. */
  const renderSymbolCard = (item: OrdinalLineItem) => (
    <div className="flex justify-center py-6">
      <div data-pip-object="symbol" className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-500/25 to-indigo-500/25 border-2 border-purple-400/40 shadow-xl flex items-center justify-center">
        <span className="text-4xl font-black text-purple-100">{item.symbol}</span>
      </div>
    </div>
  );

  /** The story's CAST, shuffled — the child hears the order, never reads it. */
  const renderStoryCast = (item: OrdinalLineItem) => (
    <div className="flex flex-wrap justify-center gap-3 py-4">
      {seededShuffle(item.clues.map((c) => c.name), item.id).map((name) => (
        <div key={name} className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
            {emojiOf(name)}
          </div>
          {!isPreReader && <span className="text-[10px] mt-1 text-slate-500">{name}</span>}
        </div>
      ))}
    </div>
  );

  /** Empty places + a tray. The slot ordinals are the PAGE, not the key, so they stay on the tier that governs them. */
  const renderBuildStage = (item: OrdinalLineItem) => {
    const slots = item.answerOrder.length;
    const filled = new Map<number, string>();
    placedOrder.forEach((name, i) => { if (name) filled.set(i + 1, name); });
    const tray = seededShuffle(item.answerOrder, item.id)
      .filter((name) => !Array.from(filled.values()).includes(name));

    return (
      <div className="space-y-4">
        <div data-pip-object="slots" className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: slots }, (_, idx) => {
            const pos = idx + 1;
            const placed = filled.get(pos);
            return (
              <div
                key={pos}
                data-pip-object={`slot-${pos}`}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => dropIntoPlace(pos)}
              >
                {/* front_flag lever: a flag over the first place, the front end the task names. Never a picture. */}
                {pos === 1 && drawnLevers.includes(FLAG_LEVER) && <span data-lever="front-flag" aria-label="the front" className="text-lg leading-none">🚩</span>}
                <span className="text-[10px] text-slate-500 mb-1">
                  {currentChallenge?.showSlotLabels === false ? '·' : getOrdinalLabel(pos, labelFormat)}
                </span>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${dropZoneStateClass((placed ? 'filled' : 'idle') as DropZoneState)}`}>
                  {placed ? emojiOf(placed) : ''}
                </div>
                {/* place_dots lever: one dot under first, two under second; places only, never a picture. */}
                {drawnLevers.includes(DOTS_LEVER) && (
                  <span data-lever="place-dots" data-count={pos} className="mt-1 flex max-w-12 flex-wrap justify-center gap-0.5">
                    {Array.from({ length: pos }, (_, d) => <span key={d} className="block h-1.5 w-1.5 rounded-full bg-amber-300/80" />)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {tray.length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {tray.map((name) => (
              <div
                key={name}
                className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl cursor-pointer transition-all ${
                  heldPicture === name
                    ? 'bg-amber-500/20 border-2 border-amber-400/50 scale-110'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10'
                }`}
                data-pip-object={`picture-${name}`}
                onClick={() => holdPicture(name)}
                title={name}
              >
                {emojiOf(name)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /** A row of plain model circles (word_model, side_model, place_model): never the item's line. */
  const renderModel = (lever: string, count: number, opts: { ringed?: number; glow?: number; symbols?: boolean }) => (
    <div data-lever={lever} data-count={count} className="flex items-end justify-center gap-2 py-2">
      <span className="text-lg leading-none">🚩</span>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="flex flex-col items-center gap-1">
          <span data-model-ringed={opts.ringed === i} data-model-glow={opts.glow === i}
            className={`block h-7 w-7 rounded-full border ${opts.glow === i ? 'bg-amber-300 border-amber-200' : 'bg-slate-500/60 border-white/20'} ${
              opts.ringed === i ? 'ring-2 ring-blue-400' : ''}`} />
          {opts.symbols && <span className="text-[11px] text-slate-300">{getOrdinalLabel(i + 1, 'symbol')}</span>}
        </span>
      ))}
    </div>
  );

  const renderModels = () => {
    if (!currentItem || practice) return null;
    return (
      <>
        {drawnLevers.includes(WORD_MODEL_LEVER) && renderModel('word-model', 3, { symbols: true })}
        {drawnLevers.includes(SIDE_MODEL_LEVER) && currentItem.kind === 'relative_position'
          && renderModel('side-model', 3, sideModel(currentItem.relativeQuery))}
        {drawnLevers.includes(PLACE_MODEL_LEVER) && currentItem.kind === 'match'
          && renderModel('place-model', placeModel(currentItem), { ringed: placeModel(currentItem) - 1 })}
      </>
    );
  };

  /** The reference place on a relative-position ask: the ask names it aloud, so it is public; withdrawn at `hard`. */
  const markedPlace = currentItem?.kind === 'relative_position' && currentChallenge?.highlightTarget !== false
    ? currentItem.askPosition : undefined;

  const renderStage = () => {
    if (!currentItem) return null;
    switch (currentItem.kind) {
      case 'match':
        return renderSymbolCard(currentItem);
      case 'sequence_story':
        return renderStoryCast(currentItem);
      case 'build_sequence':
        return renderBuildStage(currentItem);
      default:
        return renderCharacterLine(currentItem, markedPlace);
    }
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const done = runner.practiceSummary;
    return phaseResultsFromSummary(items, done ?? runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' };
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
    return 'You put every one in its own place!';
  }, [items]);

  // ── The scene and the levers, republished after every render ──────────────
  useLayoutEffect(() => {
    if (!currentItem) return;
    const scene = workspaceScene(currentItem, { placedOrder, markedPlace });
    const levers = practice ? [] : ORDINAL_LEVERS.declare(sessionItem, null, pulledLevers);
    workspace.current = {
      ...leverScene(practice ? { ...scene, facts: { ...scene.facts, practice: 'An easier one, ungraded. The full item comes back after it.' } } : scene, {
        support: practice ? '' : ORDINAL_LEVERS.support(sessionItem, null),
        onScreen: ORDINAL_LEVERS.onScreen(currentItem, null, drawnLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the line changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const easier = ORDINAL_LEVERS.simpler(sessionItem, null, id);
          if (!easier) return 'There is no easier one for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          practiceRef.current = easier; setPractice(easier); resetStage(); runner.clearStillness();
          return { practice: ordinalLineBoss.assignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { practiceRef.current = null; setPractice(null); resetStage(); runner.clearStillness(); },
    };
  });

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No ordinal challenges available.</p>
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
                <LuminaBadge accent="purple" className="text-xs">
                  {contextTheme.bgEmoji} {resolvedContext}
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
              <div className="flex items-center justify-center gap-4">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            <PipDock />
            {/* The stage. The tutor speaks the ask — no printed instruction, because a pre-reader cannot read one and
                a reader would not need to listen. Pip outlines the stage as a whole. */}
            <PipWorkspace>
              <div data-pip-object="stage" className="bg-white/[0.02] rounded-xl border border-white/5 overflow-x-auto">
                {renderStage()}
                {renderModels()}
              </div>
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
                  ? 'Touch a picture, then touch its place — the line checks when you stop.'
                  : 'Listen to the question, then say your answer out loud.'}
              </p>
            )}
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Ordinal Line Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// One path: the tutor teaches on the workspace; a mount with no tutor shows the shared "needs the tutor" card.
const OrdinalLine = withWorkspaceOnly<OrdinalLineProps>('ordinal-line', OrdinalLineSurface, props => props.data.title);

export default OrdinalLine;
