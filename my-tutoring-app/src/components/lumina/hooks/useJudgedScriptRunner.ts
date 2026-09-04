'use client';

/**
 * useJudgedScriptRunner — the judged-loop COMPONENT half, extracted from the
 * four shipped literacy ports (phonics-blender, sound-swap, word-flip,
 * cvc-speller; qa/di/BACKLOG.md item 16) so a new conversion authors a script
 * and a stage instead of re-rolling ~400 lines of loop wiring.
 *
 * Division of labour:
 *   - `useJudgedSpeechLoop` (engine): attempts, verdicts, cue pacing.
 *   - THIS RUNNER: everything every port repeated — run lifecycle
 *     (connect → mic → opening cue → arm), progression policy (affirm
 *     advances, corrections cap at N then move on), gesture rules, resync
 *     re-cues, context sync, outcome/diagnosis ledgers, tap-to-hear.
 *   - THE PACK (hand-authored, per skill): cue wording, judging contract,
 *     items, status lines. See judgedScriptContract.ts.
 *
 * Behaviour is DERIVED, not invented — every non-obvious rule below names the
 * port that proved it:
 *   - Opening cue has ONE job, then arm (SWAP-1; DI-GREET-1 `owns_opening`).
 *   - The cue for the next item is queued BEFORE the surface re-points at it —
 *     the tutor's line is the advance; the screen only follows (all ports).
 *   - Corrections cap (default 2) then `moveOnCue` — a hard item resurfaces
 *     through distributed review, not by drilling a frustrated five-year-old.
 *   - Gesture items hold the ACTIVITY BRACKET for the whole item (2026-08-13):
 *     the mic stays open and capturing, but no turn is ever committed, so the
 *     tutor cannot be handed something it must answer. The rule used to live in
 *     pack prose ("wait in complete silence") plus the emission filter below,
 *     and neither reaches the tutor's mouth — see `listenForVoice`.
 *   - Gesture items (cvc-speller spell-word, the anchor's first caller):
 *     `no-verdict` and `resync` are IGNORED while the item is a build. This is
 *     now belt-and-braces behind the bracket hold rather than the only guard,
 *     and it still matters on the transition edge, where a turn opened under
 *     the previous item can close after a gesture item has begun.
 *     `unanchored-verdict` is applied when — and only when — a build awaits
 *     judgment, else the lesson wedges on a board that cannot be committed
 *     twice.
 *   - `loop-deaf` re-arms (recovery piloted on DiMathFacts): the loop was
 *     provably ignoring a real answer, and re-arming is safe because the
 *     signal only fires while unarmed.
 *   - Progression state lives in refs mirrored to React state, because
 *     emission handlers fire inside the loop's dispatch (all ports).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { LoopEmission } from './judgedLoopModel';
import { useJudgedSpeechLoop, type CueLogEvent, type JudgedSpeechLoop } from './useJudgedSpeechLoop';
import {
  JUDGED_AUDIO_INPUT,
  validateJudgedScriptPack,
  type JudgedCueOptions,
  type JudgedDiagnosisObservation,
  type JudgedScriptItem,
  type JudgedScriptPack,
  type JudgedStatusLines,
} from './judgedScriptContract';
import { SoundManager } from '../utils/SoundManager';
import type { DiagnosisEvidence } from '../evaluation/diagnosis/types';

/** Corrections the tutor may run on one item before the lesson moves on. */
const DEFAULT_MAX_CORRECTIONS = 2;
const DEFAULT_PASS_THRESHOLD = 60;

/**
 * THE TWO CLOCKS A JUDGED PORT USED TO BUILD FOR ITSELF (19c, 2026-08-15).
 *
 * Both were discovered by drives, both were re-authored per component, and both
 * came with a documented footgun that only bites the SECOND person to write
 * them. `ten-frame` carried ~40 lines of the first; `number-bond` and
 * `addition-subtraction-scene` between them carried NINE hand-tuned constants
 * of the second. They live here now so a port declares a policy instead of
 * re-deriving one.
 *
 * The defaults below are the values three drives converged on. A pack overrides
 * them per call (`armStillness`) or per run (`stimulus`) — the point is that the
 * number is a stated policy in one place, not a magic literal in fifteen.
 */
/** A breath between the tutor finishing her ask and the stimulus appearing. */
const DEFAULT_STIMULUS_PREP_MS = 700;
/** If her audio never arrives at all, the stimulus still has to happen — a
 *  child cannot answer about a frame that never flashed. Long enough that it
 *  never pre-empts a real utterance. */
const DEFAULT_STIMULUS_FALLBACK_MS = 12_000;
/** Stillness that closes a hands-only turn — the gesture analogue of the mic's
 *  silence bracket. Deliberately generous: a five-year-old pauses to think, and
 *  a premature commit spends one of the two corrections. */
const DEFAULT_STILLNESS_MS = 3000;

/** The family audio mode now lives in the contract (so pure di-script tests
 *  can pin the catalog side without importing React); re-exported here because
 *  the runner is where existing consumers found it. */
export { JUDGED_AUDIO_INPUT };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

export type JudgedRunStage = 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';

export interface JudgedRunOutcome {
  id: string;
  solved: boolean;
  corrections: number;
  score: number;
  seconds: number | null;
}

export interface JudgedRunSummary {
  outcomes: JudgedRunOutcome[];
  solvedCount: number;
  firstTryCount: number;
  /** Every elicitation: one per item plus one per correction. */
  attemptsCount: number;
  /** Mean per-item score (100 / 67 / 33 / 0 by corrections). */
  accuracy: number;
  passed: boolean;
  hearTaps: number;
  observations: JudgedDiagnosisObservation[];
  /** Assembled Tier-A evidence when the run failed and evidence exists. */
  diagnosisEvidence?: DiagnosisEvidence;
}

export interface JudgedScriptRunnerOptions<Item extends JudgedScriptItem> {
  pack: JudgedScriptPack<Item>;
  instanceId: string;
  gradeLevel: string;
  exhibitId?: string;
  /**
   * Silence that closes a learner voice turn. Omit for short spoken answers —
   * the engine default (500ms) is tuned for exactly those and is correct in the
   * six packs that shipped before this option existed.
   *
   * CONNECTED TEXT must raise it (di-sentence-reading bench sitting 2026-07-25,
   * finding 2 — that pack's ship-blocking fix): a child reading a whole line
   * pauses BETWEEN WORDS, and at 500ms three of ten probe reads split into two
   * voice turns, which broke the alias cross-check and nulled the timing on the
   * second fragment. A mid-line pause is part of one response, not the end of
   * it. Passed as a number, not an object, so a caller cannot churn the config
   * identity on every render.
   */
  silenceCloseMs?: number;
  /** The run finished (all items closed). The component submits its metrics. */
  onFinished: (summary: JudgedRunSummary) => void;
  /** An item is now on screen (including the first). Reset stage-payload
   *  state — boards, highlights, rewards. */
  onItemOpened?: (item: Item, index: number) => void;
  /** The tutor affirmed this item — reveal the reward (first moment the
   *  answer may appear on screen; answer-leak rule). */
  onAffirmed?: (item: Item) => void;
  /** A correction within the cap: the tutor re-modeled in-band; restore the
   *  stage for another go (cvc clears only the wrong slots here). */
  onCorrectionRetry?: (item: Item, used: number) => void;
  /**
   * PRESENT THE STIMULUS NOW — the tutor has finished her line for this item.
   *
   * Fires at most once per arm, and the runner arms exactly where a stimulus is
   * owed: the run opener, every subsequent item, and every correction retry
   * (a re-flash waits for her CORRECTION to finish, on the same gate as the
   * first ask). Flash, reveal, animation — anything the ask REFERS TO belongs
   * here, and nothing else does: this is presentation, never progression.
   *
   * ⚠️ WHY THIS IS NOT A DELAY MEASURED FROM ITEM-OPEN. The tutor's line takes
   * as long as it takes, so a wall-clock beat lands in the middle of her
   * sentence — ten-frame's flash fired while she was still saying "watch the
   * frame", and the child heard the instruction after the counters had come and
   * gone (drive 3, 2026-08-13). `counting-board` still had the raw 800ms
   * version of that bug when this option was written.
   *
   * ⚠️ AND WHY A "SHE STOPPED SPEAKING" LATCH IS NOT ENOUGH EITHER. On an
   * affirm the runner queues the next item's cue and opens the item in the SAME
   * dispatch, but a queued cue waits for the floor — so the new item is on
   * screen for the whole tail of the PREVIOUS item's affirmation. A bare
   * falling edge fills on that tail and fires the stimulus before this item's
   * ask is ever spoken (drive 5, 2026-08-14, user: *"when i get it wrong, the
   * very next one flashes way too fast"*). The gate below therefore requires
   * `cuedItemId` to name THIS item as well — the tutor's live line has to be
   * about the thing we are about to show.
   */
  onPresentStimulus?: (item: Item, index: number) => void;
  /** Policy for `onPresentStimulus`. Omit for the defaults three drives agreed
   *  on; `when` narrows it to the modes that own a stimulus. */
  stimulus?: {
    /** Which items own a timed stimulus. Omitted = all of them. */
    when?: (item: Item) => boolean;
    /** Quiet beat after her line, before the stimulus. Default 700ms. */
    prepMs?: number;
    /** Fire anyway if her audio never arrives. Default 12s. */
    fallbackMs?: number;
  };
  /** Default window for `armStillness` when a call does not name one. */
  stillnessMs?: number;
  /** Escape hatch: every emission, after the runner has acted on it. */
  onEmission?: (emission: LoopEmission, item: Item | null) => void;
}

export interface JudgedScriptRun<Item extends JudgedScriptItem> {
  running: boolean;
  preparing: boolean;
  stage: JudgedRunStage;
  statusLine: string;
  currentIndex: number;
  currentItem: Item | null;
  solvedIds: Set<string>;
  /**
   * Is the CURRENT item already affirmed? This — not `stage` — is the reveal
   * and interaction gate: `stage` goes to 'affirmed' and the runner opens the
   * next item in the SAME dispatch, and nothing returns it to 'asking' on the
   * happy path, so a stage-gated board ships dead from item 2 on and HEALS the
   * moment the child answers wrong (ten-frame drive 3, 2026-08-13). Also the
   * successor to the per-component `revealed` latch + `onAffirmed`/
   * `onItemOpened` reset pair four ports hand-rolled.
   */
  currentSolved: boolean;
  /**
   * May the child act on the current item right now? True while the run is
   * live, the item is unsolved, and no verdict is pending — a committed
   * gesture sets `stage` to 'judging' in the same dispatch, so the pending
   * window is covered. Gate taps/placements on THIS instead of composing
   * `running`/`stage`/`isAwaitingGesture`/`solvedIds` per component.
   */
  canAttempt: boolean;
  /** Set once the run finishes — render summaries from this. */
  summary: JudgedRunSummary | null;
  /** Mic affordance state for LuminaMicListener. */
  micState: 'idle' | 'opening' | 'armed';
  /**
   * True while the tutor's audio is still audibly playing (the tail outlives
   * `isAIResponding`). Read-only passthrough — it changes nothing in the loop.
   *
   * It exists because THE TUTOR OWNS THE CLOCK applies to a primitive's own
   * stimulus too, not just to progression. A stage that PRESENTS something —
   * a flash, a reveal, an animation the ask refers to — must key it to this
   * signal, never to a delay measured from item-open: the tutor's line takes
   * as long as it takes, so a wall-clock beat lands in the middle of her
   * sentence. ten-frame's subitize flash fired while she was still saying
   * "watch the frame", so the child heard the instruction AFTER the counters
   * had come and gone (drive 3, 2026-08-13).
   *
   * ⚠️ NEVER GATE A STIMULUS ON THIS ALONE — pair it with `cuedItemId` below.
   */
  tutorSpeaking: boolean;
  /**
   * The id of the item the tutor's most recently SENT cue is about — the line
   * she is speaking, or is about to speak, right now. `null` before the first
   * cue goes out.
   *
   * A stimulus stage must gate on `cuedItemId === item.id` AS WELL AS on
   * `tutorSpeaking`, because a falling edge alone catches the WRONG utterance.
   * On an affirm the runner queues the next item's cue and calls `openNext()`
   * in the SAME dispatch, but a queued cue only sends once the floor clears —
   * so for one whole utterance the new item is already on screen while
   * `tutorSpeaking` is still true for the PREVIOUS item's affirmation. A
   * "she spoke, then stopped" latch fills on the tail of that affirm and fires
   * the stimulus in the gap BEFORE this item's ask is ever spoken.
   *
   * That is what ten-frame drive 5 heard (2026-08-14, user): after a wrong
   * answer the next frame flashed *"way too fast, before she finishes her
   * statement"*. Drive 3 had already fixed the wall-clock version of this bug
   * — this is the same defect arriving through the cue QUEUE instead of a
   * timer, which is why the gate belongs to the runner and not to one
   * primitive. A correction needs no special case: no new cue is sent, so
   * `cuedItemId` still names the current item and the latch correctly catches
   * her correction line.
   */
  cuedItemId: string | null;
  /**
   * Should the affirmed item's reveal still be on screen? (18b, ruled
   * 2026-08-15: the reveal holds until her next cue is SENT.)
   *
   * It opens on the affirmation and closes the moment the tutor's cue for the
   * NEXT item actually goes out — so the answer is visible for exactly as long
   * as she is saying it, with no tuned constant anywhere. On the LAST item the
   * complete cue names the same item, so the reveal holds into the summary,
   * which is the one case that worked before this existed.
   *
   * ⚠️ THE BUG THIS REPLACES WAS INVISIBLE AND FAMILY-WIDE. Ports set a reward
   * in `onAffirmed` and cleared it in `onItemOpened`, and the runner fires both
   * IN ONE DISPATCH on the advance path — so the reveal painted on the last
   * item and nowhere else, in all four math ports, for a month. Render on this
   * flag and do NOT clear the payload in `onItemOpened`: the hold is the gate,
   * and the next affirmation overwrites the text.
   */
  revealHeld: boolean;
  /**
   * A HANDS TURN CLOSES ON STILLNESS — arm the window, and `commit` runs when
   * the child stops changing the board. Any further call resets it.
   *
   * The runner clears the window wherever an armed one would be wrong: item
   * open, correction retry, gesture commit, run end, unmount. That list is the
   * reason this is not a `setTimeout` in the component — every port that wrote
   * its own had to keep the same five sites in step by hand, and a missed one
   * commits the previous item's board into this item's turn.
   *
   * `ms` is per call because the window is a property of the SHAPE being built,
   * not of the primitive: a five-tap equation tray waits longer than a two-part
   * split, and a terminal shape (`N op N = N`, a full frame) shortens it. It is
   * never correctness-gated — `4 + 2 = 9` commits exactly as readily as
   * `4 + 2 = 6`, or the close is a Check button wearing a costume.
   */
  armStillness: (commit: () => void, ms?: number) => void;
  /** Cancel an armed stillness window. Starting over is thinking, not an
   *  answer — there is nothing to commit. */
  clearStillness: () => void;
  /** Present only when cancelling is allowed (idle standalone, not running). */
  cancelListening?: () => void;
  /** ONE start gesture: connect (standalone), open the mic, send the opening
   *  cue, arm. A browser will not open a microphone without a gesture. */
  start: () => Promise<void>;
  /** Tap-to-hear the stimulus (never the answer). No-op without pronounceCue.
   *  The tap COUNT rides `summary.hearTaps` — a render-time ref read here
   *  would not update reactively, and no consumer ever read it. */
  hearStimulus: () => void;
  stimulusTapped: boolean;
  /** Commit a manipulation: the pack-built cue describes what was done and
   *  asks for the verdict. Locks until that verdict lands. */
  submitGestureAttempt: (cue: string) => void;
  isAwaitingGesture: () => boolean;
  /** The engine, for anything the runner does not cover. */
  loop: JudgedSpeechLoop;
}

const DEFAULT_STATUS_LINES: JudgedStatusLines<JudgedScriptItem> = {
  idle: 'Tap the microphone to start.',
  ready: () => 'Listen, then answer out loud.',
  listening: 'Listening…',
  judging: 'Let’s see…',
  retry: () => 'Have another go.',
  noVerdict: () => 'One more time — say your answer.',
  affirmedNext: 'Yes! You got it.',
  affirmedLast: 'You did it!',
  moveOn: 'Good try — here comes the next one.',
  retake: 'Let’s take that one again.',
  dead: 'The tutor went quiet — tap the microphone to pick things back up.',
  done: 'Great work today!',
};

export function useJudgedScriptRunner<Item extends JudgedScriptItem>(
  options: JudgedScriptRunnerOptions<Item>,
): JudgedScriptRun<Item> {
  const { pack } = options;
  const ctx = useLuminaAIContext();

  // Pack + callbacks are read through refs everywhere the loop can call back
  // into us, so closures over component state (boards, tiers) stay fresh.
  const packRef = useRef(pack);
  packRef.current = pack;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── State (refs mirror what emission handlers must read live) ─────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<JudgedRunStage>('idle');
  const [statusLine, setStatusLine] = useState(
    pack.statusLines?.idle ?? DEFAULT_STATUS_LINES.idle,
  );
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<JudgedRunSummary | null>(null);
  const [stimulusTapped, setStimulusTapped] = useState(false);
  /** See `cuedItemId` on the returned interface — the item the tutor's live
   *  line is about, which is NOT always the item on screen. */
  const [cuedItemId, setCuedItemId] = useState<string | null>(null);
  /** The affirmed item whose reveal is still on screen (18b). Deliberately NOT
   *  cleared when the next item opens — that is the bug. */
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
  /** The stimulus clock's live arm. `seq` re-triggers the gate when the SAME
   *  item re-arms on a correction retry. */
  const [stimulusArm, setStimulusArm] = useState<{ seq: number; itemId: string } | null>(null);
  /** Has the tutor spoken for the armed item YET? The stimulus waits on her, so
   *  it must tell "she has not started" from "she has finished" — both of which
   *  look exactly like silence. */
  const [tutorHasSpoken, setTutorHasSpoken] = useState(false);

  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<JudgedRunOutcome[]>([]);
  const observationsRef = useRef<JudgedDiagnosisObservation[]>([]);
  const challengeStartRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;
  /** What the child SAID — DATA only, never rendered (a stray write to a
   *  status line in this family gets spoken aloud). */
  const lastHeardRef = useRef<string | null>(null);
  /** A gesture commit awaits its verdict. Gates the auto-commit so one
   *  placement can never fire twice, and gates unanchored-verdict adoption. */
  const awaitingGestureRef = useRef(false);
  const hearTapsRef = useRef(0);
  // Visual-only timer: clears the tap-to-hear highlight. It advances nothing —
  // progression here has exactly one cause: a tutor verdict.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The stillness window and what it will commit. Refs, not state: the window
   *  is re-armed on every touch and must never re-render the board it is
   *  measuring. */
  const stillnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stillnessCommitRef = useRef<(() => void) | null>(null);
  const stimulusSeqRef = useRef(0);

  const lines = useMemo(() => {
    const supplied = packRef.current.statusLines ?? {};
    return { ...DEFAULT_STATUS_LINES, ...supplied } as JudgedStatusLines<Item>;
    // statusLines are static per pack module; pack identity is not stable
    // across renders, its strings are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev-only gate check (standing gates 1 + 2). Never throws in production.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current || process.env.NODE_ENV === 'production') return;
    validatedRef.current = true;
    for (const issue of validateJudgedScriptPack(packRef.current)) {
      // eslint-disable-next-line no-console
      console.error(`[judged-script] ${packRef.current.primitiveType}: ${issue}`);
    }
  }, []);

  const itemOf = useCallback((index: number): Item | null =>
    packRef.current.items[index] ?? null, []);
  const currentItem = useCallback(() => itemOf(idxRef.current), [itemOf]);

  /** Cue options for the item at `index`: how-to-play re-speaks whenever the
   *  ACTION changes between consecutive items (cvc-speller rule; single-action
   *  packs only hear it on the opening cue). */
  const cueOptsFor = useCallback((index: number): JudgedCueOptions => {
    const item = itemOf(index);
    const previous = index > 0 ? itemOf(index - 1) : null;
    return {
      opening: false,
      howToPlay: !!item && (!previous || previous.action !== item.action),
    };
  }, [itemOf]);

  const maxCorrections = pack.maxCorrections ?? DEFAULT_MAX_CORRECTIONS;
  const maxCorrectionsRef = useRef(maxCorrections);
  maxCorrectionsRef.current = maxCorrections;

  // ── The stillness close (19c) ─────────────────────────────────────────────
  // Stable identities (refs inside, no deps), so a component may hold these in
  // a dep array without re-arming its own callbacks every render — the runner
  // object itself is fresh per render and never safe there.
  const clearStillness = useCallback(() => {
    if (stillnessTimerRef.current) {
      clearTimeout(stillnessTimerRef.current);
      stillnessTimerRef.current = null;
    }
    stillnessCommitRef.current = null;
  }, []);

  const armStillness = useCallback((commit: () => void, ms?: number) => {
    clearStillness();
    stillnessCommitRef.current = commit;
    const wait = ms ?? optionsRef.current.stillnessMs ?? DEFAULT_STILLNESS_MS;
    stillnessTimerRef.current = setTimeout(() => {
      stillnessTimerRef.current = null;
      const run = stillnessCommitRef.current;
      stillnessCommitRef.current = null;
      run?.();
    }, wait);
  }, [clearStillness]);

  // ── The stimulus clock (19c) ──────────────────────────────────────────────
  /** Arm the gate for `item`, or disarm if this item owns no stimulus. Called
   *  from the three places a stimulus is owed: run start, item open, and a
   *  correction retry. */
  const armStimulus = useCallback((item: Item | null) => {
    const { onPresentStimulus, stimulus } = optionsRef.current;
    if (!item || !onPresentStimulus || (stimulus?.when && !stimulus.when(item))) {
      setStimulusArm(null);
      return;
    }
    stimulusSeqRef.current += 1;
    setStimulusArm({ seq: stimulusSeqRef.current, itemId: item.id });
    setTutorHasSpoken(false);
  }, []);

  // ── Ledger ────────────────────────────────────────────────────────────────
  const closeItem = useCallback((item: Item, solved: boolean) => {
    const corrections = correctionsRef.current.get(item.id) ?? 0;
    outcomesRef.current.push({
      id: item.id,
      solved,
      corrections,
      score: solved ? scoreForCorrections(corrections) : 0,
      seconds: challengeStartRef.current == null
        ? null
        : Math.round(((performance.now() - challengeStartRef.current) / 1000) * 10) / 10,
    });
    if (solved) setSolvedIds((prev) => new Set(Array.from(prev).concat(item.id)));
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Neither clock outlives the run: a stimulus fired after the summary is a
    // flash nobody asked about, and a settle would commit into a closed loop.
    clearStillness();
    setStimulusArm(null);
    const outcomes = outcomesRef.current;
    const solvedCount = outcomes.filter((o) => o.solved).length;
    const attemptsCount = outcomes.reduce((s, o) => s + 1 + o.corrections, 0);
    const accuracy = outcomes.length
      ? Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length)
      : 0;
    const passed = accuracy >= (packRef.current.passThreshold ?? DEFAULT_PASS_THRESHOLD);

    // Tier-A evidence assembly (cvc-speller shape): prefer the latest
    // judge-backed observation — the correction line NAMES the error — over
    // the merely latest one.
    const observations = observationsRef.current;
    const latest = observations[observations.length - 1];
    const judgeBacked = [...observations].reverse().find((o) => o.judgeFeedback);
    const source = judgeBacked || latest;
    const diagnosisEvidence: DiagnosisEvidence | undefined = !passed && source
      ? {
          challengeSummary: source.challenge,
          expected: source.expected,
          observed: source.observed,
          judgeFeedback: judgeBacked?.judgeFeedback,
          priorAttempts: observations
            .filter((o) => o !== source)
            .slice(-4)
            .map((o) => ({ challenge: o.challenge, observed: o.observed })),
        }
      : undefined;

    const runSummary: JudgedRunSummary = {
      outcomes: [...outcomes],
      solvedCount,
      firstTryCount: outcomes.filter((o) => o.solved && o.corrections === 0).length,
      attemptsCount,
      accuracy,
      passed,
      hearTaps: hearTapsRef.current,
      observations: [...observations],
      diagnosisEvidence,
    };
    setSummary(runSummary);
    setRunning(false);
    setStage('done');
    setStatusLine(lines.done);
    optionsRef.current.onFinished(runSummary);
  }, [clearStillness, lines]);

  // ── Progression ───────────────────────────────────────────────────────────
  const loopRef = useRef<JudgedSpeechLoop | null>(null);

  /** Re-point the surface at the next item. The CUE for it is queued by the
   *  caller FIRST: the tutor's line is what advances the lesson; this only
   *  moves the screen to what that line is about. */
  const openNext = useCallback((): boolean => {
    const nextIndex = idxRef.current + 1;
    const next = itemOf(nextIndex);
    if (!next) return false;
    setCurrentIndex(nextIndex);
    idxRef.current = nextIndex;
    setStimulusTapped(false);
    awaitingGestureRef.current = false;
    challengeStartRef.current = performance.now();
    // The previous item's board must never commit into this one's turn.
    clearStillness();
    armStimulus(next);
    optionsRef.current.onItemOpened?.(next, nextIndex);
    return true;
  }, [armStimulus, clearStillness, itemOf]);

  const applyVerdict = useCallback((judgment: 'affirmed' | 'corrected') => {
    const item = currentItem();
    const loop = loopRef.current;
    if (!item || !loop) return;

    if (judgment === 'corrected') {
      const used = (correctionsRef.current.get(item.id) ?? 0) + 1;
      correctionsRef.current.set(item.id, used);
      SoundManager.playIncorrect();

      if (used <= maxCorrectionsRef.current) {
        // The tutor's correction line already re-modeled and re-asked in-band.
        awaitingGestureRef.current = false;
        // Re-arming the stimulus is what makes a re-flash wait for her
        // CORRECTION to finish — the same gate as the first ask, so there is no
        // hand-tuned "wait for the correction" window to get wrong. No new cue
        // is sent on this path, so `cuedItemId` still names this item and the
        // gate correctly catches her correction line.
        clearStillness();
        armStimulus(item);
        optionsRef.current.onCorrectionRetry?.(item, used);
        setStage('asking');
        setStatusLine(lines.retry(item));
        return;
      }
      // Capped: acknowledge and move the lesson forward.
      closeItem(item, false);
      const nextIndex = idxRef.current + 1;
      loop.queueCue(packRef.current.moveOnCue(item, itemOf(nextIndex), cueOptsFor(nextIndex)));
      if (openNext()) {
        setStage('asking');
        setStatusLine(lines.moveOn);
      } else {
        finish();
      }
      return;
    }

    // Affirmed — this is the first moment the answer may appear on screen, and
    // `revealedItemId` is what keeps it there for the length of her
    // affirmation instead of one un-painted React batch (18b).
    SoundManager.playCorrect();
    closeItem(item, true);
    awaitingGestureRef.current = false;
    optionsRef.current.onAffirmed?.(item);
    setRevealedItemId(item.id);
    setStage('affirmed');

    const nextIndex = idxRef.current + 1;
    const next = itemOf(nextIndex);
    if (next) {
      setStatusLine(lines.affirmedNext);
      loop.queueCue(packRef.current.itemCue(next, cueOptsFor(nextIndex)));
      openNext();
    } else {
      setStatusLine(lines.affirmedLast);
      loop.queueCue(packRef.current.completeCue());
      finish();
    }
  }, [armStimulus, clearStillness, closeItem, cueOptsFor, currentItem, finish, itemOf, lines, openNext]);

  const handleEmission = useCallback((emission: LoopEmission) => {
    const item = currentItem();
    switch (emission.kind) {
      case 'attempt-open':
        lastHeardRef.current = null;
        // Gesture attempts keep their 'judging' status — only a voice turn
        // means the child is being listened to.
        if (emission.attempt.source === 'voice') setStatusLine(lines.listening);
        break;
      case 'attempt-transcript':
        lastHeardRef.current = emission.text;
        break;
      case 'verdict': {
        if (emission.judgment === 'off-script') break;
        if (emission.judgment === 'no-verdict') {
          // On a BUILD item this is routinely the child talking while they
          // work — never re-prompt over a board being filled (cvc rule a).
          if (item && item.answerKind !== 'gesture') setStatusLine(lines.noVerdict(item));
          break;
        }
        if (emission.judgment === 'corrected' && item) {
          const observation = packRef.current.diagnosisObservation?.(item, {
            lastHeard: lastHeardRef.current,
          });
          if (observation) observationsRef.current.push({ ...observation });
        }
        applyVerdict(emission.judgment);
        break;
      }
      case 'verdict-text': {
        // The judge's finished correction NAMES the error — Tier-A evidence.
        if (emission.judgment !== 'corrected') break;
        const observations = observationsRef.current;
        const last = observations[observations.length - 1];
        if (last && !last.judgeFeedback) last.judgeFeedback = emission.text;
        break;
      }
      case 'unanchored-verdict':
        // Applied when — and only when — a build awaits judgment (cvc rule b):
        // the child spoke while building, that voice attempt timed out, and
        // the gesture attempt never opened behind it. Dropping the verdict
        // would wedge the lesson on a board that cannot be committed twice.
        if (awaitingGestureRef.current) applyVerdict(emission.judgment);
        break;
      case 'session-resumed':
      case 'resync': {
        // The session survived but the item in flight did not: re-ask it
        // verbatim — except a resync mid-build, where the board is still on
        // screen and re-asking would talk over a child working.
        const loop = loopRef.current;
        if (!item || !loop) break;
        if (emission.kind === 'resync' && item.answerKind === 'gesture') break;
        setStage('asking');
        setStatusLine(lines.retake);
        loop.queueCue(packRef.current.itemCue(item, cueOptsFor(idxRef.current)));
        break;
      }
      case 'loop-deaf':
        // The learner answered into a surface that could not record them.
        // Re-arm (safe: the signal only fires while unarmed) — recovery
        // piloted on DiMathFacts. One of these in a log is a bug to chase.
        loopRef.current?.arm();
        break;
      case 'session-dead':
        // Visible state, never a silent "Listening…".
        setStatusLine(lines.dead);
        break;
      default:
        break;
    }
    optionsRef.current.onEmission?.(emission, item);
  }, [applyVerdict, cueOptsFor, currentItem, lines]);

  const { silenceCloseMs } = options;
  const voiceConfig = useMemo(
    () => (silenceCloseMs == null ? undefined : { config: { silenceCloseMs } }),
    [silenceCloseMs],
  );

  /**
   * A gesture item hands the tutor NOTHING to listen to, so the bracket is held
   * for its duration — mic open, capture running, no turn ever committed.
   *
   * This replaces a rule the family previously tried to enforce with prose. Two
   * places used to carry it and neither could: the pack's tap contract asked the
   * model to "WAIT in complete silence", and the emission switch below drops
   * `no-verdict` on gesture items. The first is unenforceable (a closed turn
   * owes a reply, and on 2026-08-13 letter-spotter's tutor answered one by
   * inventing a `[LSP_TAP]` message and reading it aloud); the second only stops
   * US reacting. Holding the bracket is the one lever that reaches the tutor's
   * mouth, and it is not a mute — see `listenForVoice`.
   */
  const listenForVoice = itemOf(currentIndex)?.answerKind !== 'gesture';

  // Which item is the tutor's live line about? Set when a cue is actually SENT
  // — never when it is queued, because the gap between the two is precisely the
  // window in which a stimulus can fire against the previous item's audio.
  // `sendCueNow` reports 'sent' too, so the run opener lands here as well.
  const handleCue = useCallback((event: CueLogEvent) => {
    if (event.phase !== 'sent') return;
    const id = currentItem()?.id ?? null;
    setCuedItemId(id);
    // 18b: her line has moved on, so the previous item's reveal is over. The
    // LAST item's complete cue names the same id, so that reveal holds into the
    // summary — which is the one case that painted before this existed.
    setRevealedItemId((held) => (held != null && held !== id ? null : held));
  }, [currentItem]);

  // Item 31 (qa/di/BACKLOG.md, 2026-09-04): in a lesson only the block the
  // lesson is pointed at owns the floor. `activePrimitiveId` is the viewport's
  // choice, set synchronously on the switch, and it IS the manifest instanceId
  // OrderedSection injects into `data` — the same string every consumer hands
  // this runner. Null = tracking has not started; fail open, never deafen a
  // pack because the first switch has not landed.
  const activeInLesson = ctx.sessionMode !== 'lesson'
    || ctx.activePrimitiveId == null
    || ctx.activePrimitiveId === options.instanceId;

  const loop = useJudgedSpeechLoop({
    enabled: running,
    listenForVoice,
    active: activeInLesson,
    voice: voiceConfig,
    onEmission: handleEmission,
    onCue: handleCue,
  });
  loopRef.current = loop;

  // ── Keep the tutor's RUNTIME STATE truthful as items advance ──────────────
  useEffect(() => {
    if (!ctx.isConnected) return;
    const item = itemOf(currentIndex);
    if (!item) return;
    ctx.updateContext(packRef.current.contextFor(item));
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentIndex]);

  // ── THE STIMULUS GATE: THE TUTOR'S VOICE OWNS THE STIMULUS ────────────────
  // She says "Watch the frame — the counters show for just a moment… How many
  // counters did you see?" and THEN the counters appear. Three effects, and
  // each one exists because a drive heard what happens without it — see
  // `onPresentStimulus` above for the two failure modes.
  //
  // ⚠️ EVERY DEP HERE IS A PRIMITIVE, ON PURPOSE. A timer effect keyed on an
  // identity that churns tears down and re-arms faster than the timer can ever
  // fire — the standing Lumina context-churn footgun, and the reason the
  // callback is read through `optionsRef` rather than taken as a dep.
  const stimulusPrepMs = options.stimulus?.prepMs ?? DEFAULT_STIMULUS_PREP_MS;
  const stimulusFallbackMs = options.stimulus?.fallbackMs ?? DEFAULT_STIMULUS_FALLBACK_MS;
  const armedItemId = stimulusArm?.itemId ?? null;
  const armedSeq = stimulusArm?.seq ?? 0;
  const tutorSpeaking = ctx.isAudioPlaying;

  // (1) The rising edge — her line for THIS item has started. `cuedItemId` is
  //     what makes it THIS item's line and not the tail of the last affirm.
  useEffect(() => {
    if (armedItemId == null || tutorHasSpoken) return;
    if (cuedItemId !== armedItemId || !tutorSpeaking) return;
    setTutorHasSpoken(true);
  }, [armedItemId, armedSeq, tutorHasSpoken, cuedItemId, tutorSpeaking]);

  // (2) The safety net — if her audio never arrives, the stimulus still has to
  //     happen. A child cannot answer about a frame that never flashed.
  useEffect(() => {
    if (armedItemId == null || tutorHasSpoken) return;
    const timer = setTimeout(() => setTutorHasSpoken(true), stimulusFallbackMs);
    return () => clearTimeout(timer);
  }, [armedItemId, armedSeq, tutorHasSpoken, stimulusFallbackMs]);

  // (3) The falling edge — she spoke for this item, and stopped. A breath, then
  //     present it. Firing DISARMS, which is what makes it once-per-arm.
  useEffect(() => {
    if (armedItemId == null || !tutorHasSpoken || tutorSpeaking) return;
    const timer = setTimeout(() => {
      const index = packRef.current.items.findIndex((i) => i.id === armedItemId);
      const item = index < 0 ? null : (packRef.current.items[index] as Item);
      setStimulusArm(null);
      if (item) optionsRef.current.onPresentStimulus?.(item, index);
    }, stimulusPrepMs);
    return () => clearTimeout(timer);
  }, [armedItemId, armedSeq, tutorHasSpoken, tutorSpeaking, stimulusPrepMs]);

  // ── Gesture commit ────────────────────────────────────────────────────────
  /** Stable identity — safe in effect/callback dep arrays (the returned runner
   *  object itself is fresh per render; see the timer-effect footgun note). */
  const isAwaitingGesture = useCallback(() => awaitingGestureRef.current, []);

  const submitGestureAttempt = useCallback((cue: string) => {
    const loop = loopRef.current;
    if (!loop || awaitingGestureRef.current) return;
    awaitingGestureRef.current = true;
    // The board is in the tutor's hands now; a window still counting down would
    // commit it a second time the moment the child fidgets.
    clearStillness();
    setStage('judging');
    setStatusLine(lines.judging);
    loop.submitGestureAttempt(cue);
  }, [clearStillness, lines]);

  // ── Tap-to-hear — never withdrawn by band or tier ─────────────────────────
  const hearStimulus = useCallback(() => {
    const item = currentItem();
    const pronounce = packRef.current.pronounceCue;
    if (!item || !pronounce) return;
    SoundManager.tap();
    hearTapsRef.current += 1;
    setStimulusTapped(true);
    ctx.sendText(pronounce(item), { silent: true, scripted: true });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setStimulusTapped(false), 1200);
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startRun = useCallback(() => {
    const first = itemOf(0);
    const activeLoop = loopRef.current;
    if (!first || !activeLoop) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    observationsRef.current = [];
    lastHeardRef.current = null;
    hearTapsRef.current = 0;
    finishedRef.current = false;
    awaitingGestureRef.current = false;
    setSummary(null);
    setSolvedIds(new Set());
    setCurrentIndex(0);
    idxRef.current = 0;
    setStimulusTapped(false);
    // A re-run must not inherit the last run's cued item — a stimulus gate
    // comparing ids would open before the new opener is spoken.
    setCuedItemId(null);
    setRevealedItemId(null);
    clearStillness();
    armStimulus(first);
    optionsRef.current.onItemOpened?.(first, 0);
    activeLoop.reset();
    setRunning(true);
    setStage('asking');
    setStatusLine(lines.ready(first));
    challengeStartRef.current = performance.now();
    // ONE cue with ONE job: speak this. The how-to-play is inside the quoted
    // line, never a second catalog directive on the same turn (SWAP-1).
    activeLoop.sendCueNow(packRef.current.itemCue(first, { opening: true, howToPlay: true }));
    activeLoop.arm();
  }, [armStimulus, clearStillness, itemOf, lines]);

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  const start = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        const first = itemOf(0);
        await ctx.connect({
          primitive_type: packRef.current.primitiveType,
          instance_id: optionsRef.current.instanceId,
          primitive_data: {
            activity: packRef.current.activityLine,
            ...(first ? packRef.current.contextFor(first) : {}),
          },
          grade_level: optionsRef.current.gradeLevel || 'kindergarten',
          exhibit_id: optionsRef.current.exhibitId,
          audio_input: JUDGED_AUDIO_INPUT,
          // DI-GREET-1: the pack's first cue is its opening line — the tutor
          // must not improvise a greeting turn before it arrives.
          owns_opening: true,
        });
        const started = performance.now();
        while (!connectedRef.current && performance.now() - started < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The tutor did not connect.');
      }

      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not open.');

      startRunRef.current();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setStage('idle');
    } finally {
      setPreparing(false);
    }
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOf, preparing]);

  // Unmount: never leave Live holding the mic, never leave a timer running.
  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (stillnessTimerRef.current) clearTimeout(stillnessTimerRef.current);
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = itemOf(currentIndex);
  const currentSolved = current != null && solvedIds.has(current.id);

  return {
    running,
    preparing,
    stage,
    statusLine,
    currentIndex,
    currentItem: current,
    solvedIds,
    currentSolved,
    canAttempt: running && current != null && !currentSolved && stage !== 'judging',
    summary,
    // No `micLevel` here BY DESIGN (19b): a per-audio-frame value on the run
    // object re-renders every consumer of the run — the whole primitive — at
    // 30-100Hz. JudgedMicPanel subscribes for the orb it paints.
    //
    // ⚠️ GATED ON `running`, NOT ON `ctx.isListening` ALONE — that conflation
    // made every judged port UNSTARTABLE IN A LESSON (found live 2026-08-14 on
    // the 19b drive, `ten-frame` and `counting-board`). A lesson opens ONE
    // shared microphone at connect, so `isListening` is true before the child
    // has done anything; the orb therefore painted 'armed', and `armed` is
    // exactly the state in which `LuminaMicListener` renders the live surface
    // INSTEAD of the tap-to-start button. There was no start affordance left to
    // press, `start()` was unreachable, `running` stayed false, and `canAttempt`
    // held every tap on the board dead — under an orb captioned "I'm listening"
    // and a status line reading "Tap the microphone to start."
    //
    // `isListening` answers "is the microphone hardware open", which in a lesson
    // is not the question. The orb asks "is this RUN listening for an answer",
    // and only `running` answers that. Standalone is unaffected: `isListening`
    // there only goes true inside `start()`, so the two agree.
    micState: preparing ? 'opening' : running && ctx.isListening ? 'armed' : 'idle',
    tutorSpeaking,
    cuedItemId,
    revealHeld: revealedItemId != null,
    armStillness,
    clearStillness,
    cancelListening: running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening,
    start,
    hearStimulus,
    stimulusTapped,
    submitGestureAttempt,
    isAwaitingGesture,
    loop,
  };
}
