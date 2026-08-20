'use client';

/**
 * OrdinalLine — DI modality. The Live tutor owns the clock in every mode
 * (qa/di/BACKLOG.md item 18 P4; the SIXTH math port).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - identify (K + 1): the tutor names the FRONT of the line and asks. At
 *    Kindergarten the child SAYS THE NAME of the one in that place; at Grade 1
 *    the tutor names a character and the child SAYS ITS PLACE. Same eval mode,
 *    band-split — see `ordinalLineScript`'s docblock for why. The tap-to-select
 *    on the character line is deleted: a mode whose own catalog label is
 *    *"Name ordinal position"* had a button for a surface.
 *  - match (K + 1): ONE symbol card at a time, and the child READS IT ALOUD.
 *    The two-column grid is deleted — the word column printed the answer beside
 *    the question, and the column CONSUMED its entries, so the last pair of
 *    every grid needed no reading at all.
 *  - relative_position (K + 1): the child SAYS THE NAME of the one before or
 *    after the marked place. The 3-4 name buttons are deleted.
 *  - sequence_story (K + 1): the tutor READS the story; the child SAYS the place
 *    of one character in it. The story no longer prints — a pre-reader could
 *    never use it and a reader who re-reads it is not listening — and the drag
 *    surface is deleted, because it was byte-for-byte `build_sequence`'s.
 *  - build_sequence (K + 1): the child ARRANGES the pictures from spoken clues.
 *    The arrangement IS the answer — the third unsayable shape — so this mode
 *    keeps its hands, and the screen is the page.
 *
 * WHAT CHANGED. Deleted: `handleCheckAnswer` and all four checkers
 * (`checkIdentify`, `checkMatch`, `checkRelativeOrStory`, `checkBuildSequence`),
 * the Check control, the Next control, the multiple-choice option rows, the
 * match grid, the tap-to-select on the character line, the printed instruction,
 * the printed story, the printed clue list, the feedback strings that named the
 * position out loud (*"That's the ${ordinal} position"* — an answer print), the
 * after-two-attempts hint panel, the old tutor hook with all of its improvised
 * turns, and the per-tier reveal prose that governed them. There is no
 * progression timer and no progression control anywhere in this file —
 * progression has exactly one cause: a tutor verdict.
 *
 * (Named obliquely on purpose: the port census greps this file for the deleted
 * hooks, and a comment that spells them out reads as a live call site.)
 *
 * ⭐ THE ORDINAL LABELS ARE AN ANSWER KEY IN PIXELS. `showPositionLabels`
 * rendered `getOrdinalLabel(pos, labelFormat)` under EVERY character —
 * literally `3rd (third)` at `labelFormat: 'both'`. Harmless while a button
 * graded it; the moment the ask is *"who is third?"* the child reads the answer
 * off the screen, and on the Grade 1 direction the label IS the answer,
 * verbatim. THE THIRD PORT IN A ROW WITH THIS DEFECT (ten-frame's running
 * counter, compare-objects' numbered unit boxes, now this). Every ordinal label
 * on the line is held behind `runner.revealHeld` and paints only while the
 * tutor is affirming; the counting walk survives where it is earned, in the
 * correction, where she counts the line with the child.
 *
 * The SLOT labels on `build_sequence` are the exception and it is a real one:
 * there the answer is WHICH PICTURE goes where, not what the place is called,
 * so the numbered slots are the page rather than the key (the ten-frame R6
 * boundary — it was the ACTION that was the costume, never the paper). They
 * stay on the support tier that already governed them, withdrawn at `hard`.
 *
 * HOW A HANDS-ONLY TURN CLOSES. `build_sequence` has a STRUCTURAL close — every
 * place filled — which still waits a beat rather than committing on the tap,
 * because a mis-tap is normal and re-arranging is thinking. A part-filled line
 * closes on STILLNESS instead, and neither close is correctness-gated: a
 * reversed line and a two-of-four line both commit exactly as readily as the
 * right one, which is what gives the tutor something to teach. Windows are
 * armed through `runner.armStillness`, never a hand-rolled local timer — the
 * runner owns the five cancel sites. The two numbers are compare-objects'
 * calibration, and they are hand-tuned by ear there too.
 *
 * NO TIMED STIMULUS. Nothing on this stage is flashed or revealed on a beat:
 * the line is on screen for the whole item and the story is the tutor's own
 * voice, so there is no `onPresentStimulus` here and no clock to get wrong.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor speaks only scripted lines; no visible timers;
 * tap-to-hear re-speaks the QUESTION (and on the story mode, that is what
 * replaces re-reading it); adult chrome hidden for pre-readers; interaction is
 * gated on `runner.canAttempt`, never on `runner.stage`.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  ordinalLinePackBase,
  ordinalWordFor,
  placementVerdictCue,
  VALID_CONTEXTS,
  type OrdinalContext,
  type OrdinalLineItem,
} from './ordinalLineScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** ORDINAL LABELS UNDER THE LINE. Post-affirmation only now — the label is
   *  the answer (see the module docblock); the flag no longer scaffolds. */
  showPositionLabels?: boolean;
  /** Ordinal labels above the build slots; the page, not the key. Default ON,
   *  withdrawn at `hard`. */
  showSlotLabels?: boolean;
  /** Mark the reference place on a relative-position ask. The tutor NAMES that
   *  place aloud, so it is public; withdrawn at `hard`. */
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

/**
 * HOW LONG THE LINE MAY STAY STILL BEFORE IT COMMITS. The window is the
 * runner's (`armStillness`, 19c); these are the per-shape numbers, carried from
 * compare-objects where they were tuned by ear. Both are STRUCTURAL, never
 * correctness-gated — a reversed line commits through the same window as the
 * right one.
 */
/** Mid-build: a five-year-old pauses to think between placements. */
const BUILD_SETTLE_MS = 4000;
/** Every place filled — a terminal shape, but a mis-tap is normal, so it still
 *  waits a beat rather than committing on the tap. */
const BUILD_COMPLETE_SETTLE_MS = 1500;

// ============================================================================
// Helpers
// ============================================================================

function getOrdinalLabel(position: number, format: 'word' | 'symbol' | 'both'): string {
  const SYMBOLS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const idx = position - 1;
  const word = ordinalWordFor(position);
  const symbol = SYMBOLS[idx] || `${position}th`;
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
}

// ============================================================================
// Component
// ============================================================================

const OrdinalLine: React.FC<OrdinalLineProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    context = 'race',
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
  const resolvedContext: OrdinalContext =
    (VALID_CONTEXTS as readonly string[]).includes(context) ? context : 'race';
  const contextTheme = CONTEXT_THEME[resolvedContext];

  // ── Stage-payload state (the runner owns progression; this is the page) ───
  const [placedOrder, setPlacedOrder] = useState<string[]>([]);
  const [heldPicture, setHeldPicture] = useState<string | null>(null);
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it land in one React batch, so the
   *  reveal would paint on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the line held when it last stopped changing. */
  const pendingOrderRef = useRef<string[]>([]);

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

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // A match grid expands to one judged ask PER SYMBOL; everything else is one
  // item. Unaskable items are DROPPED (a key that disagrees with its target
  // position or with the line, a character name that states a place, a line the
  // judge cannot separate by ear, a story that cannot be spoken verbatim, a clue
  // set longer than a child can hold from speech). Nothing is backfilled.
  const built = useMemo(
    () => itemsFromChallenges(challenges, { band: gradeBand, context: resolvedContext }),
    [challenges, gradeBand, resolvedContext],
  );
  const items = built.items;

  /** The generated challenge behind an item — the page's own data (emoji, tier
   *  render levers), which the judged item deliberately does not carry. A match
   *  item's id is `${challengeId}::p${position}`, so the lookup strips the
   *  suffix rather than assuming one item per challenge. */
  const challengeById = useMemo(() => {
    const map = new Map<string, OrdinalLineChallenge>();
    for (const ch of challenges) map.set(ch.id, ch);
    return map;
  }, [challenges]);

  const challengeFor = useCallback(
    (item: OrdinalLineItem | null) =>
      item ? challengeById.get(item.id.split('::')[0]) ?? null : null,
    [challengeById],
  );

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

  const pack = useMemo<JudgedScriptPack<OrdinalLineItem>>(() => ({
    ...ordinalLinePackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then put them in their places.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go — show me your line.'
        : 'Have another go — say your answer.',
      done: 'Great counting today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.';
      switch (item.kind) {
        case 'identify':
          return {
            challenge: item.direction === 'name_character'
              ? `identify: who is in place ${item.askPosition} of ${item.lineNames.length}.`
              : `identify: what place the ${item.lineNames[item.askPosition - 1]} is in.`,
            expected: item.answerText,
            observed: heard,
          };
        case 'match':
          return {
            challenge: `match: read the symbol ${item.symbol} aloud.`,
            expected: item.answerText,
            observed: heard,
          };
        case 'relative_position':
          return {
            challenge: `relative_position: who is right ${item.relativeQuery} place ${item.askPosition}.`,
            expected: item.answerText,
            observed: heard,
          };
        case 'sequence_story':
          return {
            challenge: `sequence_story: what place the ${item.storyName} has in the spoken story.`,
            expected: item.answerText,
            observed: heard,
          };
        default:
          return {
            challenge: `build_sequence: arrange ${item.answerOrder.length} pictures from spoken clues.`,
            expected: item.answerOrder.join(', '),
            observed: `Made this line: ${
              pendingOrderRef.current.filter(Boolean).length
                ? pendingOrderRef.current.map((n) => n || 'an empty place').join(', ')
                : 'nothing'
            }.`,
          };
      }
    },
  }), [items]);

  // ── Per-item reset — every item owns its starting state ───────────────────
  const resetStageFor = useCallback(() => {
    setPlacedOrder([]);
    setHeldPicture(null);
    pendingOrderRef.current = [];
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const scoreById = new Map(summary.outcomes.map((o) => [o.id, o.score]));
    // Per-mode accuracy off the runner's own per-item scores (100/67/33 by
    // corrections) — nothing here re-grades what the tutor already judged.
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
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useJudgedScriptRunner<OrdinalLineItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetStageFor,
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen — and the reveal is the
      // PAIRING (who, and which place), never the answer text on its own. Both
      // identify directions therefore produce the same reward: at K the child
      // said "Fox" and learns it was third; at Grade 1 they said "third" and see
      // it attached to the Fox. Reading `answerText` here would print
      // "third — third" on the Grade 1 direction, which teaches nothing.
      switch (item.kind) {
        case 'identify':
          setReward(`${item.lineNames[item.askPosition - 1]} — ${ordinalWordFor(item.askPosition)}`);
          break;
        case 'relative_position': {
          const place = item.relativeQuery === 'before'
            ? item.askPosition - 1
            : item.askPosition + 1;
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
    onCorrectionRetry: (item) => {
      // The tutor re-counted the line and re-asked in-band; clear the board for
      // another go. The settle window is re-armed by the runner on this path.
      if (item.kind === 'build_sequence') {
        setPlacedOrder([]);
        setHeldPicture(null);
        pendingOrderRef.current = [];
      }
    },
  });

  const currentItem = runner.currentItem;
  const kind = currentItem?.kind;
  const currentChallenge = challengeFor(currentItem);

  // ── The gesture commit ────────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. The close
  // describes the committed line; THE MATCH IS COMPUTED IN CODE.
  const commitLine = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build_sequence') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    runner.submitGestureAttempt(placementVerdictCue(item, pendingOrderRef.current));
  }, [runner]);

  /** A hands turn closes on stillness; a full line shortens the window but never
   *  commits on the tap (a mis-tap is normal). Further touches re-arm it, and
   *  the runner cancels it at item open, at a correction and at the commit. */
  const armBuildSettle = useCallback((order: string[]) => {
    const item = runner.currentItem;
    // SPARSE, not compacted: an empty place between two filled ones is part of
    // what the child made, and the verdict cue names it (see the script).
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

  /** Tap a picture to hold it, tap a place to put it there. The same two-tap
   *  mechanic the click era had — it is the PAGE, and it survives the port. */
  const holdPicture = useCallback((name: string) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setHeldPicture((held) => (held === name ? null : name));
  }, [runner]);

  const dropIntoPlace = useCallback((position: number) => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build_sequence') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;

    // Computed OUTSIDE the state updater on purpose: `armBuildSettle` arms a
    // real timer, and a side effect inside an updater runs twice under
    // StrictMode's double-invoke — which on a hands turn means two live
    // stillness windows racing to commit the same board.
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

  /** The line itself. NOT interactive in any mode — the answer is spoken. */
  const renderCharacterLine = (item: OrdinalLineItem, markPosition?: number) => (
    <div className="flex items-end justify-center gap-1 sm:gap-2 py-4 px-2">
      <div className="flex flex-col items-center mr-2">
        <span className="text-lg">{contextTheme.bgEmoji}</span>
        <span className="text-[10px] text-slate-500 mt-1">{contextTheme.startLabel}</span>
      </div>

      {item.lineNames.map((name, idx) => {
        const pos = idx + 1;
        const isMarked = markPosition === pos;
        return (
          <div
            key={name}
            className={`flex flex-col items-center transition-all duration-200 ${isMarked ? 'scale-105' : ''}`}
          >
            {/* ⭐ THE ORDINAL LABEL IS THE ANSWER. Reveal only — never a
                scaffold, whatever the tier flag says (module docblock). */}
            <span className="text-[10px] mb-1 text-emerald-300 font-medium h-3">
              {runner.revealHeld ? getOrdinalLabel(pos, labelFormat) : ''}
            </span>

            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-200 ${
              isMarked
                ? 'bg-blue-500/20 border-2 border-blue-400/60 shadow-lg shadow-blue-500/20'
                : 'bg-white/5 border border-white/10'
            }`}>
              {emojiByName.get(name) ?? '⬤'}
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
      <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-500/25 to-indigo-500/25 border-2 border-purple-400/40 shadow-xl flex items-center justify-center">
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
            {emojiByName.get(name) ?? '⬤'}
          </div>
          {!isPreReader && <span className="text-[10px] mt-1 text-slate-500">{name}</span>}
        </div>
      ))}
    </div>
  );

  /** Empty places + a tray. The slot ordinals are the PAGE, not the key — the
   *  answer is which picture goes where — so they stay on the tier that already
   *  governed them (`showSlotLabels`, withdrawn at hard). */
  const renderBuildStage = (item: OrdinalLineItem) => {
    const slots = item.answerOrder.length;
    const filled = new Map<number, string>();
    placedOrder.forEach((name, i) => { if (name) filled.set(i + 1, name); });
    const tray = seededShuffle(item.answerOrder, item.id)
      .filter((name) => !Array.from(filled.values()).includes(name));

    return (
      <div className="space-y-4">
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: slots }, (_, idx) => {
            const pos = idx + 1;
            const placed = filled.get(pos);
            return (
              <div
                key={pos}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => dropIntoPlace(pos)}
              >
                <span className="text-[10px] text-slate-500 mb-1">
                  {currentChallenge?.showSlotLabels === false
                    ? '·'
                    : getOrdinalLabel(pos, labelFormat)}
                </span>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${dropZoneStateClass((placed ? 'filled' : 'idle') as DropZoneState)}`}>
                  {placed ? emojiByName.get(placed) ?? '⬤' : ''}
                </div>
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
                onClick={() => holdPicture(name)}
                title={name}
              >
                {emojiByName.get(name) ?? '⬤'}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStage = () => {
    if (!currentItem) return null;
    switch (currentItem.kind) {
      case 'match':
        return renderSymbolCard(currentItem);
      case 'sequence_story':
        return renderStoryCast(currentItem);
      case 'build_sequence':
        return renderBuildStage(currentItem);
      case 'relative_position':
        return renderCharacterLine(
          currentItem,
          // The ask NAMES this place aloud, so marking it is public. Withdrawn
          // at `hard`, which is the lever that flag always meant.
          currentChallenge?.highlightTarget !== false ? currentItem.askPosition : undefined,
        );
      default:
        return renderCharacterLine(currentItem);
    }
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  const celebrationMessage = useMemo(() => {
    const spoken = items.some((i) => i.answerKind === 'voice');
    const hands = items.some((i) => i.answerKind === 'gesture');
    if (spoken && hands) return 'You worked with your voice and your hands!';
    if (spoken) return 'You said every answer out loud!';
    return 'You put every one in its own place!';
  }, [items]);

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

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : runner.currentSolved
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
        {!evaluation.hasSubmitted && currentItem && (
          <>
            <div className="flex items-center justify-center gap-4">
              {!isPreReader && (
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              )}
              {/* Tap-to-hear — the QUESTION again, never a hint ladder. On the
                  story mode this is what replaces re-reading a printed story. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all ${
                  runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''
                }`}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {/* The stage. The tutor speaks the ask — no printed instruction,
                because a pre-reader cannot read one and a reader would not need
                to listen. */}
            <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-x-auto">
              {renderStage()}
            </div>

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
                  ? 'Touch a picture, then touch its place — the tutor checks when you stop.'
                  : 'Listen to the question, then say your answer out loud.'}
              </p>
            )}

            {/* The orb tells the truth about the turn: a hands item is not
                "I'm listening". */}
            <JudgedMicPanel run={runner} gestureLabel="Put them in their places" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
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

export default OrdinalLine;
