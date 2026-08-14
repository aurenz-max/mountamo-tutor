'use client';

/**
 * TenFrame — DI modality. The Live tutor owns the clock in every mode.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - subitize: counters flash, then HIDE, and the child SAYS how many they saw
 *    into an open mic. The tutor asks, waits, judges the audio in-band,
 *    corrects contrastively, and its own affirmation is what moves the lesson.
 *  - make_ten @ Grades 1-2: the frame shows some counters; the child SAYS how
 *    many more make ten.
 *  - add / subtract: the frame is the working surface — the child places or
 *    removes counters — and the SUM or DIFFERENCE is spoken.
 *  - build: the child PLACES counters. The placement is the answer.
 *  - make_ten @ K: the child TAPS EMPTY CELLS to fill the frame; the counters
 *    they placed are the enacted complement (contract R6, untouched).
 *
 * WHY TWO MODES KEPT THEIR HANDS. Apply the costume test — can a child who
 * cannot do the skill still perform this action correctly? A stepper: yes,
 * anyone can operate one, so the steppers died. Placing counters: no — placing
 * five counters IS building the quantity five. In literacy the clicking almost
 * always stood in for a mouth; IN MATH THE MANIPULATIVE IS OFTEN THE SKILL, so
 * `build` and K make-ten keep their surface and gain a JUDGE. The full fork and
 * its evidence live in `tenFrameScript.ts`.
 *
 * WHAT CHANGED (first math consumer of useJudgedScriptRunner; qa/di/BACKLOG.md
 * item 18). Deleted: the subitize -/+ numeral stepper, the Grades 1-2 make-ten
 * stepper, the Check control, the Next control, the printed hint ladder, the
 * feedback card that named the target, and every improvised tutor turn. There
 * is no progression timer and no progression control anywhere in this file —
 * progression here has exactly one cause: a tutor verdict.
 *
 * HOW A HANDS-ONLY TURN CLOSES. A voice turn closes on SILENCE (the mic's
 * amplitude bracket). A hands turn closes on STILLNESS: when the frame stops
 * changing for `PLACEMENT_SETTLE_MS` the placement is described to the tutor
 * and judged. K make-ten additionally commits the moment the frame is full,
 * which is R6's literal rule — but stillness is what makes the item JUDGEABLE,
 * because stopping early is now a wrong answer the tutor corrects. Neither
 * commit is correctness-gated: a wrong placement commits exactly as readily as
 * a right one, which is the property a Check button used to fake.
 *
 * ANSWER-LEAK RULE — AND HERE THE LEAK IS PIXELS, NOT STRINGS.
 *  - R4 holds: subitize counters hide BEFORE the answer is asked for, and the
 *    frame cannot be tapped while hidden. If the loop left them on screen,
 *    subitizing would become counting and the mode would be destroyed.
 *  - R5 holds harder than before: the empty-space readout is not rendered at
 *    all — on a make-ten item it IS the answer.
 *  - The running count readout is withdrawn for add/subtract: it equals the
 *    number the child is about to say. It survives for build and make-ten as
 *    the child's own trace of what they placed (R3/R7, tier-governed).
 *  - The number only appears on screen AFTER the tutor has affirmed.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines); no
 * visible timers (the subitize flash is stimulus presentation — when it ends,
 * nothing moves forward); "Show again" re-shows the STIMULUS and never the
 * answer; adult chrome is hidden for pre-readers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaPrompt,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TenFrameMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  frameVerdictCue,
  itemFromChallenge,
  stimulusFor,
  tenFramePackBase,
  type TenFrameBand,
  type TenFrameItem,
} from './tenFrameScript';
import { numberWordFor } from './countingBoardScript';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface TenFrameChallenge {
  id: string;
  type: 'build' | 'subitize' | 'make_ten' | 'add' | 'subtract';
  /** Student-facing prompt. Synthesized deterministically by the generator from
   *  the numeric fields below — never authored by the LLM (see SP-17). Shown to
   *  readers only; the tutor SPEAKS the problem for everyone. */
  instruction: string;
  targetCount: number;
  startCount?: number; // for subtract: how many counters are on the frame before removal
  addend1?: number; // for add: first addend (addend1 + addend2 = targetCount)
  addend2?: number; // for add: second addend
  flashDuration?: number | null; // ms, for subitize mode
  hint: string;
  narration: string;
}

export interface TenFrameData {
  title: string;
  description?: string;
  mode: 'single' | 'double';
  counters: {
    count: number;
    color: string;
    positions: number[];
  };
  twoColorMode?: {
    enabled: boolean;
    color1Count: number;
    color2Count: number;
    color1: string;
    color2: string;
  };
  challenges: TenFrameChallenge[];
  showOptions?: {
    showCount?: boolean;
    showEquation?: boolean;
    /** Retained so the generator contract is unchanged. NEVER rendered: on a
     *  make-ten item the empty-space count is the answer (R5). */
    showEmptyCount?: boolean;
    allowFlip?: boolean;
  };
  imagePrompt?: string | null;
  gradeBand?: TenFrameBand;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TenFrameMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  build: { label: 'Build', icon: '🧱' },
  subitize: { label: 'Subitize', icon: '👁️' },
  make_ten: { label: 'Make Ten', icon: '🎯' },
  add: { label: 'Add', icon: '➕' },
  subtract: { label: 'Subtract', icon: '➖' },
};

const COUNTER_COLORS: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#3b82f6',
  green: '#22c55e',
};

const CELL_SIZE = 56;
const CELL_GAP = 4;
const CELL_RADIUS = 8;
const COUNTER_RADIUS = 18;
const FRAME_COLS = 5;
const FRAME_ROWS = 2;
const FRAME_PADDING = 8;

/** Stillness that closes a hands-only turn — the gesture analogue of the mic's
 *  silence bracket. Deliberately generous: a five-year-old placing counters
 *  pauses to think, and a premature commit spends one of the two corrections. */
const PLACEMENT_SETTLE_MS = 3000;

/** Subitize flash lifecycle. The flash is STIMULUS PRESENTATION, not a
 *  progression clock — when it ends nothing advances; the tutor is still
 *  waiting for the child's answer. */
const SUBITIZE_FLASH_MS = 1500;   // default; per-challenge `flashDuration` wins (R7 tier lever)
/** A short "get ready" beat AFTER the tutor stops talking — a breath between
 *  "How many counters did you see?" and the counters appearing, not a race
 *  against her sentence. See the flash gate below for why that distinction is
 *  the whole design. */
const SUBITIZE_PREP_MS = 700;
/** If the tutor's audio never arrives at all, the stimulus still has to happen
 *  — a child cannot answer a question about a frame that never flashed. Long
 *  enough that it never pre-empts a real utterance. */
const TUTOR_SILENCE_FALLBACK_MS = 12_000;

// ============================================================================
// Props
// ============================================================================

interface TenFrameProps {
  data: TenFrameData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const TenFrame: React.FC<TenFrameProps> = ({ data, className }) => {
  const {
    title,
    description,
    mode = 'single',
    counters: initialCounters,
    twoColorMode,
    challenges = [],
    showOptions = {},
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const { showCount = true, showEquation = false } = showOptions;

  const totalCells = mode === 'double' ? 20 : 10;
  const isPreReader = gradeBand === 'K';
  const counterColor = initialCounters?.color || 'red';

  // ── Stage-payload state (the runner owns progression; this is the frame) ──
  const [filledCells, setFilledCells] = useState<Set<number>>(new Set());
  const [countersVisible, setCountersVisible] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashAnswerReady, setFlashAnswerReady] = useState(false);
  /** Has the tutor spoken for THIS item yet? The flash waits on her, so it has
   *  to know the difference between "she has not started" and "she has
   *  finished" — both look like silence. Reset on every item and on every
   *  correction retry. */
  const [tutorHasSpoken, setTutorHasSpoken] = useState(false);
  /** The number JUST affirmed — post-answer only (answer-leak rule), cleared
   *  the moment the next item opens. */
  const [reward, setReward] = useState<string | null>(null);

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the frame held when it last stopped changing. */
  const pendingPlacementRef = useRef(0);
  const placementChangesRef = useRef(0);
  const fullFrameEverRef = useRef(false);

  const stableInstanceIdRef = useRef(instanceId || `ten-frame-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<TenFrameMetrics>({
    primitiveType: 'ten-frame',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable items are DROPPED here (zero answers, out-of-bench counts,
  // incoherent operations). Nothing is backfilled: a placeholder in a judged
  // loop becomes a spoken ask the tutor has to judge.
  const items = useMemo<TenFrameItem[]>(() =>
    challenges
      .map((ch) => itemFromChallenge(ch, { capacity: totalCells, band: gradeBand }))
      .filter((item): item is TenFrameItem => item !== null),
    [challenges, totalCells, gradeBand],
  );

  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  // The cue surface (everything the tutor is ever sent) comes from the script
  // module, so the headless judged-loop harness drives the SAME cues this
  // screen does. Below it: what only a mounted component can own.
  const pack = useMemo<JudgedScriptPack<TenFrameItem>>(() => ({
    ...tenFramePackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then use the frame.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go on the frame.'
        : 'Have another go — say your answer.',
      done: 'Great number work today!',
    },
    diagnosisObservation: (item, { lastHeard }) =>
      item.answerKind === 'gesture'
        ? {
            challenge: item.kind === 'build'
              ? `Put ${item.answer} counters on the ten frame.`
              : `Fill the frame from ${item.shown} to ${item.capacity}.`,
            expected: `${item.answer} counters placed.`,
            observed: `Placed ${pendingPlacementRef.current - (item.kind === 'make_ten' ? item.shown : 0)}.`,
          }
        : {
            challenge: `${item.kind} on a frame of ${item.capacity} (${stimulusFor(item)}).`,
            expected: `${numberWordFor(item.answer)} (${item.answer})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          },
  }), [items]);

  // ── Per-item frame reset — every item owns its starting state (R6) ────────
  const resetFrameFor = useCallback((item: TenFrameItem) => {
    clearSettle();
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setReward(null);
    setIsFlashing(false);
    setFlashAnswerReady(false);
    setTutorHasSpoken(false);

    // A completed frame never carries into the next challenge: build and add
    // start empty, make-ten seeds its shown group, subtract seeds its start.
    const seeded = item.kind === 'subitize' ? 0 : item.shown;
    setFilledCells(new Set(Array.from({ length: seeded }, (_, i) => i)));
    pendingPlacementRef.current = seeded;
    // Subitize hides its counters until the flash runs; every other mode shows
    // whatever is on the frame.
    setCountersVisible(item.kind !== 'subitize');
  }, [clearSettle]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const kindOf = (id: string) => items.find((i) => i.id === id)?.kind;
    const subitizeOutcomes = summary.outcomes.filter((o) => kindOf(o.id) === 'subitize');
    const makeTenOutcomes = summary.outcomes.filter((o) => kindOf(o.id) === 'make_ten');
    const targetSum = items.reduce((sum, item) => sum + item.answer, 0);

    const metrics: TenFrameMetrics = {
      type: 'ten-frame',
      evalMode: items[0]?.kind ?? 'default',
      challengesCompleted: summary.solvedCount,
      challengesTotal: items.length,
      subitizeAccuracy: subitizeOutcomes.length > 0
        ? Math.round((subitizeOutcomes.filter((o) => o.solved).length / subitizeOutcomes.length) * 100)
        : 0,
      subitizeAverageTime: subitizeOutcomes.length > 0
        ? Math.round(
            subitizeOutcomes.reduce((s, o) => s + (o.seconds ?? 0) * 1000, 0) / subitizeOutcomes.length,
          )
        : 0,
      makeTenCorrect: makeTenOutcomes.filter((o) => o.solved).length,
      makeTenTotal: makeTenOutcomes.length,
      usedMakeTenStrategy: fullFrameEverRef.current,
      counterPlacementEfficiency: placementChangesRef.current <= targetSum,
      twoColorDecompositionsExplored: 0,
      attemptsCount: summary.attemptsCount,
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

  const runner = useJudgedScriptRunner<TenFrameItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1-2',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetFrameFor,
    onAffirmed: (item) => {
      // The first moment a number may appear on screen — and, for subitize, the
      // moment R4's "a correct response restores the counters" now hangs off
      // (it used to hang off a Check click that no longer exists).
      if (item.kind === 'subitize') setCountersVisible(true);
      setReward(
        item.kind === 'subitize'
          ? `${item.answer} — ${numberWordFor(item.answer)} ${item.answer === 1 ? 'counter' : 'counters'}!`
          : item.kind === 'make_ten'
            ? `${item.shown} + ${item.answer} = ${item.capacity}`
            : item.kind === 'add'
              ? `${item.addend1} + ${item.addend2} = ${item.answer}`
              : item.kind === 'subtract'
                ? `${item.shown} − ${item.removed} = ${item.answer}`
                : `${item.answer} ${item.answer === 1 ? 'counter' : 'counters'}!`,
      );
    },
    onCorrectionRetry: (item) => {
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go.
      clearSettle();
      if (item.kind === 'subitize') {
        // Re-arm the flash. Clearing `tutorHasSpoken` is what makes the
        // re-flash wait for her CORRECTION to finish — the same gate as the
        // first ask, so there is no hand-tuned window to get wrong.
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
        setIsFlashing(false);
        setFlashAnswerReady(false);
        setTutorHasSpoken(false);
        setCountersVisible(false);
        return;
      }
      // Gesture items clear back to their opening state: the counters are
      // indistinguishable, so there is no "wrong slot" to clear the way
      // cvc-speller does. Voice items keep whatever the child built.
      if (item.answerKind === 'gesture') {
        setFilledCells(new Set(Array.from({ length: item.shown }, (_, i) => i)));
        pendingPlacementRef.current = item.shown;
      }
    },
  });

  const currentItem = runner.currentItem;
  const currentChallenge = currentItem ? challengeById.get(currentItem.id) ?? null : null;

  // ── The gesture commit ────────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. The cue
  // goes out through `submitGestureAttempt`, which opens the attempt when the
  // cue is actually SENT — an attempt opened at commit time would block the
  // very cue meant to provoke its verdict (cvc-speller's finding).
  const commitPlacement = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.answerKind !== 'gesture') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const onFrame = pendingPlacementRef.current;
    const enacted = item.kind === 'make_ten' ? Math.max(0, onFrame - item.shown) : onFrame;
    runner.submitGestureAttempt(frameVerdictCue(item, enacted));
  }, [runner]);

  /** A hands turn closes on stillness. Any further tap resets the window. */
  const armSettle = useCallback((onFrame: number) => {
    pendingPlacementRef.current = onFrame;
    clearSettle();
    settleTimerRef.current = setTimeout(() => { commitPlacement(); }, PLACEMENT_SETTLE_MS);
  }, [clearSettle, commitPlacement]);

  // ── Frame taps ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((cellIndex: number) => {
    const item = runner.currentItem;
    // NEVER gate interaction on the stage word — the runner sets `affirmed` and
    // opens the next item in the same dispatch, so a stage-gated frame ships
    // dead from item 2 on. `canAttempt` is the runner's own answer to the live
    // question ("is THIS item still open?"); it reads the solved ledger, not
    // the stage word. See its docblock for the drive that proved it.
    if (!item || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture()) return;
    // R4: subitizing is perceptual recognition, never tap-counting, and hidden
    // counters can never be manipulated.
    if (item.kind === 'subitize') return;

    // K make-ten: only the EMPTY cells are the answer surface. The seeded
    // counters are fixed and placed ones stay placed (R6); filling the frame
    // commits immediately, which is R6's own rule.
    if (item.kind === 'make_ten' && item.answerKind === 'gesture') {
      if (filledCells.has(cellIndex)) return;
      SoundManager.tap();
      const placed = new Set(filledCells);
      placed.add(cellIndex);
      setFilledCells(placed);
      placementChangesRef.current += 1;
      if (placed.size >= totalCells) fullFrameEverRef.current = true;
      if (placed.size >= (item.commitAt ?? item.capacity)) {
        clearSettle();
        pendingPlacementRef.current = placed.size;
        commitPlacement();
      } else {
        armSettle(placed.size);
      }
      return;
    }

    SoundManager.tap();
    const placed = new Set(filledCells);
    if (placed.has(cellIndex)) placed.delete(cellIndex);
    else placed.add(cellIndex);
    setFilledCells(placed);
    placementChangesRef.current += 1;
    if (placed.size >= totalCells) fullFrameEverRef.current = true;

    // `build` closes on stillness; add/subtract are voice items whose turn the
    // child closes by answering, so the frame there is a working surface only.
    if (item.answerKind === 'gesture') armSettle(placed.size);
    else pendingPlacementRef.current = placed.size;
  }, [
    runner, evaluation.hasSubmitted, filledCells, totalCells,
    armSettle, clearSettle, commitPlacement,
  ]);

  // ── Subitize flash-then-hide ──────────────────────────────────────────────
  // ⚠️ DEPENDS ON `currentItem`, NEVER ON `runner`. The runner returns a fresh
  // object every render, so a callback that closes over `runner` changes
  // identity continuously — and the effect below, which depends on this
  // callback, would then tear down and re-arm its prep timer faster than the
  // timer could ever fire. That is the standing Lumina context-churn footgun:
  // a timer effect keyed on churning identity never fires. It used to be at
  // its worst with the MIC OPEN, because `ctx.micLevel` was a context field
  // that ticked once per audio frame; 19b removed that amplifier, and the rule
  // stands without it. `currentItem` is a stable object out of the `items` memo.
  const startFlash = useCallback(() => {
    const item = currentItem;
    if (!item || item.kind !== 'subitize') return;
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setFilledCells(new Set(Array.from({ length: Math.min(item.answer, totalCells) }, (_, i) => i)));
    setFlashAnswerReady(false);
    setCountersVisible(true);
    setIsFlashing(true);
    const duration = currentChallenge?.flashDuration || SUBITIZE_FLASH_MS;
    flashTimeoutRef.current = setTimeout(() => {
      setCountersVisible(false);
      setIsFlashing(false);
      setFlashAnswerReady(true);
      flashTimeoutRef.current = null;
    }, duration);
  }, [currentItem, totalCells, currentChallenge?.flashDuration]);

  const isSubitize = currentItem?.kind === 'subitize';

  // ── THE FLASH GATE: THE TUTOR'S VOICE OWNS THE STIMULUS ───────────────────
  // She says "Watch the frame — the counters show for just a moment… How many
  // counters did you see?" and THEN the counters appear. Keying the flash to a
  // beat measured from item-open raced her instead: the flash landed mid-
  // sentence, so the child heard "watch the frame" after the counters had
  // already come and gone, and the ask arrived about a frame they never saw
  // (drive 3, 2026-08-13 — "this would be confusing for the child").
  //
  // "Not speaking" is ambiguous on its own — it is also true in the gap before
  // her audio starts — so the gate is a FALLING EDGE: she must have spoken for
  // this item, and then stopped. Same gate on the first ask, on every
  // subsequent challenge, and on a correction's re-flash; `tutorHasSpoken` is
  // cleared in all three places. This is what retired the hand-tuned
  // "wait 3s for the correction to finish" window — there is no window now.
  //
  // ⚠️ A FALLING EDGE ALONE WAS NOT ENOUGH, and drive 5 (2026-08-14, user)
  // heard why: *"when i get it wrong, the very next one flashes way too fast
  // before she finishes her statement."* On an affirm the runner QUEUES the
  // next item's cue and opens the item in the same dispatch, and a queued cue
  // waits for the floor — so the new item is on screen for the whole tail of
  // the PREVIOUS item's affirmation. `tutorHasSpoken` latched on that tail,
  // her affirm drained, and the flash fired in the silence before this item's
  // ask was ever sent. `runner.cuedItemId` is the runner's answer: the id of
  // the item her live line is ACTUALLY about. Requiring it to match closes the
  // hole without a single tuned millisecond, and a correction still works
  // untouched (no new cue is sent, so the id keeps naming this item).
  const tutorSpeaking = runner.tutorSpeaking;
  const askIsForThisItem = currentItem != null && runner.cuedItemId === currentItem.id;
  const flashPending = runner.running && isSubitize && !isFlashing && !flashAnswerReady;

  useEffect(() => {
    if (flashPending && askIsForThisItem && tutorSpeaking) setTutorHasSpoken(true);
  }, [flashPending, askIsForThisItem, tutorSpeaking]);

  // Safety net: if her audio never arrives, the stimulus still has to happen.
  useEffect(() => {
    if (!flashPending || tutorHasSpoken) return;
    const timer = setTimeout(() => setTutorHasSpoken(true), TUTOR_SILENCE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [flashPending, tutorHasSpoken]);

  useEffect(() => {
    if (!flashPending || !tutorHasSpoken || tutorSpeaking) return;
    const timer = setTimeout(() => startFlash(), SUBITIZE_PREP_MS);
    return () => clearTimeout(timer);
  }, [flashPending, tutorHasSpoken, tutorSpeaking, startFlash]);

  // Cancel timers on unmount.
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const colorForCell = useCallback((index: number): string => {
    if (twoColorMode?.enabled) {
      return index < (twoColorMode.color1Count || 5)
        ? (twoColorMode.color1 || 'red')
        : (twoColorMode.color2 || 'yellow');
    }
    return counterColor;
  }, [twoColorMode, counterColor]);

  const frameCount = mode === 'double' ? 2 : 1;
  const svgWidth = frameCount * (FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2)
    + (frameCount - 1) * 24;
  const svgHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;

  const renderFrame = useCallback((frameIndex: number) => {
    const offsetX = frameIndex * (FRAME_COLS * (CELL_SIZE + CELL_GAP) + FRAME_PADDING * 2 + 24);
    const cells: React.ReactNode[] = [];

    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        const cellIndex = frameIndex * 10 + row * FRAME_COLS + col;
        const x = offsetX + FRAME_PADDING + col * (CELL_SIZE + CELL_GAP);
        const y = FRAME_PADDING + row * (CELL_SIZE + CELL_GAP);
        const isFilled = filledCells.has(cellIndex);
        const shouldShowCounter = isFilled && countersVisible;

        cells.push(
          <g key={cellIndex}>
            <rect
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              className="cursor-pointer transition-colors duration-150"
              fill={shouldShowCounter ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              onClick={() => handleCellClick(cellIndex)}
            />
            {shouldShowCounter && (
              <circle
                cx={x + CELL_SIZE / 2}
                cy={y + CELL_SIZE / 2}
                r={COUNTER_RADIUS}
                fill={COUNTER_COLORS[colorForCell(cellIndex)] || colorForCell(cellIndex)}
                className="transition-all duration-200"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                onClick={() => handleCellClick(cellIndex)}
              />
            )}
          </g>
        );
      }
    }

    const frameWidth = FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;
    const frameHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;
    const thisFrameFull = countersVisible
      && Array.from(filledCells).filter(c => c >= frameIndex * 10 && c < (frameIndex + 1) * 10).length === 10;

    return (
      <g key={`frame-${frameIndex}`}>
        <rect
          x={offsetX}
          y={0}
          width={frameWidth}
          height={frameHeight}
          rx={12}
          ry={12}
          fill="none"
          stroke={thisFrameFull ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.2)'}
          strokeWidth={thisFrameFull ? 3 : 2}
          className="transition-colors duration-300"
        />
        {cells}
      </g>
    );
  }, [filledCells, countersVisible, colorForCell, handleCellClick]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** `build` runs never speak an answer and `subitize` runs never place one —
   *  only a mixed set earned the old "voice and hands" line. */
  const celebrationMessage = useMemo(() => {
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return 'You worked the ten frame with your own hands!';
      case 'mixed':
        return 'You worked the ten frame with your voice and your hands!';
      default:
        return 'You read the ten frame out loud!';
    }
  }, [items]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      CHALLENGE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No ten frame challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const kind = currentItem?.kind;
  const isGestureItem = currentItem?.answerKind === 'gesture';
  /** Is the item ON SCREEN closed? The runner's `stage` cannot answer this — it
   *  stays 'affirmed' across the advance — so everything that means "this item
   *  is finished" reads the solved ledger instead. */
  const currentSolved = runner.currentSolved;
  // The running count is the child's own trace of what they placed (R3/R7,
  // tier-governed) — but on add/subtract it EQUALS the number they are about to
  // say, so it is withdrawn there.
  const showTrace = showCount && countersVisible
    && (kind === 'build' || kind === 'make_ten') && filledCells.size > 0;

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : currentSolved
      ? 'yes!'
      : runner.running
        ? (isGestureItem ? 'your hands' : 'how many?')
        : 'get ready';

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="orange" className="text-xs">Grade 1-2</LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {CHALLENGE_TYPE_CONFIG[kind]?.icon} {CHALLENGE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {isGestureItem ? 'Use the frame' : 'Say it out loud'}
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

            {/* Readers get the printed problem; the tutor SPEAKS it for everyone. */}
            {!isPreReader && currentChallenge?.instruction && (
              <LuminaPrompt>
                <span className="text-sm">{currentChallenge.instruction}</span>
              </LuminaPrompt>
            )}

            <div className="flex justify-center">
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="max-w-full h-auto"
              >
                {Array.from({ length: frameCount }, (_, i) => renderFrame(i))}
              </svg>
            </div>

            {/* The child's own placement trace. Never an empty-space readout —
                on a make-ten item that number IS the answer (R5). */}
            {showTrace && (
              <div className="flex items-center justify-center text-sm">
                <span className="text-slate-300">
                  Counters: <span className="text-orange-300 font-bold text-lg">{filledCells.size}</span>
                </span>
              </div>
            )}

            {/* The FACT, for readers — the same thing the tutor says aloud. It
                is the question side; the answer stays off the screen. */}
            {showEquation && !isPreReader && kind === 'add' && (
              <p className="text-center text-sm text-slate-300 font-mono">
                {currentItem.addend1} + {currentItem.addend2} = ?
              </p>
            )}
            {showEquation && !isPreReader && kind === 'subtract' && (
              <p className="text-center text-sm text-slate-300 font-mono">
                {currentItem.shown} − {currentItem.removed} = ?
              </p>
            )}

            {/* Subitize flash prompt + re-show. "Show again" re-shows the
                STIMULUS and is never withdrawn; the tutor's matching
                tap-to-hear re-asks the QUESTION and never narrates the count. */}
            {isSubitize && (
              <div className="flex flex-col items-center gap-2">
                {!flashAnswerReady && (
                  <span className="text-orange-300 text-sm font-medium">
                    👀 {isFlashing ? 'Look quick!' : 'Get ready to look…'}
                  </span>
                )}
                {flashAnswerReady && runner.running && !currentSolved && (
                  <LuminaButton
                    tone="subtle"
                    className="text-xs"
                    onClick={() => {
                      // Counted via hearStimulus → summary.hearTaps (the
                      // contract's successor to the old reflash penalty).
                      runner.hearStimulus();
                      startFlash();
                    }}
                  >
                    Show again
                  </LuminaButton>
                )}
              </div>
            )}

            {/* The reward — the first moment a number may appear on screen. */}
            {reward && currentSolved && (
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
                  ? 'Tap the frame to place your counters — the tutor checks when you stop.'
                  : 'Work it out on the frame, then say your answer out loud.'}
              </p>
            )}

            {/* "I’m listening" over an item whose answer is a placement is a lie
                in the UI (add-di-loop step 3) — the hands items hold the
                bracket, so the orb says what the turn actually is. */}
            <JudgedMicPanel run={runner} gestureLabel="Show me on the frame" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default TenFrame;
