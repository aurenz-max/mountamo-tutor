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
 *   - Gesture items (cvc-speller spell-word, the anchor's first caller):
 *     `no-verdict` and `resync` are IGNORED while the item is a build — a
 *     stray voice turn while the child works opens an attempt the tutor was
 *     told not to answer, and re-asking would talk over a working child.
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
import { useJudgedSpeechLoop, type JudgedSpeechLoop } from './useJudgedSpeechLoop';
import {
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

/** Manual voice-activity mode for the whole family: our amplitude detector
 *  brackets every learner turn; Gemini's speech-likeness VAD is unusable for
 *  short spoken responses (DI bench run-3 ruling). Every consumer's catalog
 *  entry must declare the same `audioInput` so the lesson path opens the
 *  shared session identically. */
export const JUDGED_AUDIO_INPUT = { manual_activity: true } as const;

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
  /** Set once the run finishes — render summaries from this. */
  summary: JudgedRunSummary | null;
  /** Mic affordance state for LuminaMicListener. */
  micState: 'idle' | 'opening' | 'armed';
  micLevel: number;
  /** Present only when cancelling is allowed (idle standalone, not running). */
  cancelListening?: () => void;
  /** ONE start gesture: connect (standalone), open the mic, send the opening
   *  cue, arm. A browser will not open a microphone without a gesture. */
  start: () => Promise<void>;
  /** Tap-to-hear the stimulus (never the answer). No-op without pronounceCue. */
  hearStimulus: () => void;
  stimulusTapped: boolean;
  hearTaps: number;
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
  }, [lines]);

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
    optionsRef.current.onItemOpened?.(next, nextIndex);
    return true;
  }, [itemOf]);

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

    // Affirmed — this is the first moment the answer may appear on screen.
    SoundManager.playCorrect();
    closeItem(item, true);
    awaitingGestureRef.current = false;
    optionsRef.current.onAffirmed?.(item);
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
  }, [closeItem, cueOptsFor, currentItem, finish, itemOf, lines, openNext]);

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

  const loop = useJudgedSpeechLoop({ enabled: running, onEmission: handleEmission });
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

  // ── Gesture commit ────────────────────────────────────────────────────────
  const submitGestureAttempt = useCallback((cue: string) => {
    const loop = loopRef.current;
    if (!loop || awaitingGestureRef.current) return;
    awaitingGestureRef.current = true;
    setStage('judging');
    setStatusLine(lines.judging);
    loop.submitGestureAttempt(cue);
  }, [lines]);

  // ── Tap-to-hear — never withdrawn by band or tier ─────────────────────────
  const hearStimulus = useCallback(() => {
    const item = currentItem();
    const pronounce = packRef.current.pronounceCue;
    if (!item || !pronounce) return;
    SoundManager.tap();
    hearTapsRef.current += 1;
    setStimulusTapped(true);
    ctx.sendText(pronounce(item), { silent: true });
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
  }, [itemOf, lines]);

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
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    running,
    preparing,
    stage,
    statusLine,
    currentIndex,
    currentItem: itemOf(currentIndex),
    solvedIds,
    summary,
    micState: preparing ? 'opening' : ctx.isListening ? 'armed' : 'idle',
    micLevel: ctx.micLevel,
    cancelListening: running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening,
    start,
    hearStimulus,
    stimulusTapped,
    hearTaps: hearTapsRef.current,
    submitGestureAttempt,
    isAwaitingGesture: () => awaitingGestureRef.current,
    loop,
  };
}
