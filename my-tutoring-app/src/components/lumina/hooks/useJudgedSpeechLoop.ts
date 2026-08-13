'use client';

/**
 * useJudgedSpeechLoop — the live-judged call-response engine over one Gemini
 * Live session (extraction step 2 from the DI bench).
 *
 * Composition: useLiveVoiceTurns (open-mic turn authority, DI-2 dual
 * threshold) feeds voice turns into the pure judgedLoopModel reducer
 * (voice-anchored attempts DI-1, sentence-scoped sentinel verdicts, arming
 * DI-3, resync-on-misses). This hook adds what only the runtime can own:
 * the conversation feed, the tutor-quiet clock, the verdict-timeout tick,
 * and the cue queue.
 *
 * Cue pacing contract (from the bench's verify-beat work): a queued cue
 * fires only into silence — tutor quiet, learner not mid-utterance, no
 * attempt awaiting judgment — after a short beat, so the affirmation the
 * student earned always plays out whole. Blocked cues stay queued and
 * re-fire on the falling edge of whichever state blocked them (audio fall,
 * voice close, verdict processed).
 *
 * The consumer owns pedagogy and progression: it maps verdict emissions to
 * advance/retry/move-on, supplies cue text, and on a resync emission re-cues
 * the current item. The engine never invents lesson content.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  DEFAULT_JUDGED_LOOP_CONFIG,
  IDLE_JUDGED_LOOP,
  normalizeSpeech,
  reduceJudgedLoop,
  type JudgedLoopConfig,
  type LoopEmission,
  type LoopEvent,
} from './judgedLoopModel';
import { useLiveVoiceTurns, type LiveVoiceTurns } from './useLiveVoiceTurns';
import type { VoiceTurnConfig, VoiceTurnEvent } from './voiceTurnMachine';

/** Beat between the tutor's line finishing and a queued cue being sent. */
const VERIFY_BEAT_MS = 400;
/** Failsafe: retry a queued cue even if no release edge ever registers. */
const PENDING_CUE_MAX_WAIT_MS = 5000;
/** Verdict-timeout scan cadence. */
const TICK_MS = 1000;
/**
 * Session-liveness ladder, level 2 (DI BACKLOG item 5). After a cue is SENT,
 * the tutor always speaks — model line, guide line, or a test lead-in (even
 * `hard` cold reads say "Your turn. Read it."). So the liveness signal is
 * cue→tutor-AUDIO (or output transcription), never cue→verdict: child
 * think-time is unbounded (35.9s observed, benign) and a cue→verdict watchdog
 * would false-trigger on every long think. If nothing from the tutor arrives
 * within this window the cue is counted DEAD. Hook-level const by design —
 * promote to config only if a pack ever needs to differ.
 */
const CUE_DEAD_MS = 10_000;
/** Consecutive dead cues (~20s of proven tutor silence while cues go out) that
 *  make the session DEAD → `session-dead` emission. */
const SESSION_DEAD_CUES = 2;

/**
 * A cue's journey through the verify beat. DIAGNOSTICS ONLY — nothing in the
 * engine reads this back.
 *
 * WHY IT EXISTS (2026-07-26). A cue that is queued but never sent looks exactly
 * like a verdict that was never emitted: the tutor goes quiet, the surface never
 * advances, and no record distinguishes them. That ambiguity is what made the
 * sustained-miss sitting undiagnosable from logs alone. `blocked` is NORMAL on
 * its own — the cue stays queued and re-fires on the next release edge — so the
 * signal is a `queued` with no matching `sent`, not a `blocked` by itself.
 */
export interface CueLogEvent {
  /** 'dead' = the cue was sent and the tutor produced NOTHING (no audio rise,
   *  no transcription) within CUE_DEAD_MS — one rung of the session-liveness
   *  ladder. Diagnostics like the rest: it does not consume a 'queued', so the
   *  `queued − sent − dropped` ledger arithmetic is unaffected. */
  phase: 'queued' | 'sent' | 'blocked' | 'dropped' | 'dead';
  /** 'sent' only: the cue shipped with interrupt because the tutor was holding
   *  the floor OFF-SCRIPT (see the off-script cut-in note at the send path). */
  cutIn?: boolean;
  /** The cue text, verbatim. Consumers are expected to truncate for display. */
  text: string;
  /** On 'blocked': which gate held it. */
  reason?: 'audio' | 'voice' | 'attempt';
}

export interface JudgedSpeechLoopOptions {
  /** Master switch — typically "a run/challenge is active". Disabling
   *  disarms the loop and closes any open voice turn. */
  enabled: boolean;
  config?: Partial<JudgedLoopConfig>;
  voice?: { config?: Partial<VoiceTurnConfig> };
  /** Every model emission, in order. Progression decisions happen here. */
  onEmission?: (emission: LoopEmission) => void;
  /** Raw tutor output-transcription fragments (display/diagnostics). */
  onTutorText?: (text: string) => void;
  /**
   * EVERY closed voice turn, including `belowMinVoice` blips — check the flag
   * before anchoring anything to one.
   *
   * It reports the blips deliberately. `useLiveVoiceTurns` has already sent
   * `activityEnd` for them (the bracket has to go out immediately to interrupt),
   * so a blip is a turn Gemini WILL hear and judge while this hook refuses to
   * open an attempt for it — i.e. the client hands over a complete turn and then
   * declines to own it, and the judge's verdict lands as `unanchored-verdict`.
   * Filtering blips out here (which this hook did until 2026-07-26) made the one
   * desync channel that ORIGINATES on our side the only one with no trace.
   */
  onVoiceTurnClose?: (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => void;
  /** Cue lifecycle through the verify beat (diagnostics). */
  onCue?: (event: CueLogEvent) => void;
}

export interface JudgedSpeechLoop {
  /** The underlying turn authority (floors telemetry, isVoiceActive, config). */
  voiceTurns: LiveVoiceTurns;
  /** Queue a cue to send after the current speech settles (verify beat). */
  queueCue: (text: string) => void;
  /** Commit a manipulation as a judged attempt — `cue` describes what the
   *  learner did and asks the tutor to speak its verdict. The attempt opens
   *  when the cue is actually sent. See the implementation for why. */
  submitGestureAttempt: (cue: string) => void;
  /** Send a cue immediately (run openers), dropping any queued cue. */
  sendCueNow: (text: string) => void;
  /** Drop any queued cue without sending it (abrupt stop). */
  clearQueuedCue: () => void;
  /** Start recording attempts. Call when the first cue goes out (DI-3). */
  arm: () => void;
  disarm: () => void;
  /** Full reset for a new run: disarms, closes voice turns, drops cues. */
  reset: () => void;
  /** An attempt is awaiting the Live judge's verdict. */
  isAwaitingJudgment: () => boolean;
  /** The resolved loop config in effect. */
  config: JudgedLoopConfig;
}

export function useJudgedSpeechLoop(options: JudgedSpeechLoopOptions): JudgedSpeechLoop {
  const ctx = useLuminaAIContext();
  const { enabled } = options;

  const config: JudgedLoopConfig = { ...DEFAULT_JUDGED_LOOP_CONFIG, ...options.config };
  const configRef = useRef(config);
  configRef.current = config;
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const loopStateRef = useRef(IDLE_JUDGED_LOOP);
  const conversationIndexRef = useRef(ctx.conversation.length);
  const audioPlayingRef = useRef(ctx.isAudioPlaying);
  audioPlayingRef.current = ctx.isAudioPlaying;
  const previousAudioPlayingRef = useRef(ctx.isAudioPlaying);
  const pendingCueRef = useRef<string | null>(null);
  /**
   * Has the tutor line DURING which the pending cue was queued finished
   * playing? Stamped at queue time, raised on the audio falling edge. While
   * false, playing audio is that scripted line (a verdict, a correction) and
   * the cue waits for it. Once true, the model has nothing scripted left to
   * say — any audio that rises again is an OFF-SCRIPT turn, and the pending
   * cue cuts it rather than waiting behind it (run f634f61b2b42: a stray noise
   * after "Yes, six." drew an improvised turn that held item 2's cue hostage
   * for 40 seconds while the tutor recited an invented item, cue format and
   * all — the engine's own audio block was the hostage-taker's shield).
   */
  const pendingCueQuietEdgeRef = useRef(false);
  /**
   * The queued cue (if any) that is ALSO a gesture attempt's ask — see
   * `submitGestureAttempt`. Held until that exact cue is sent, then converted
   * into the attempt. Cleared if the cue is dropped instead of sent, so a
   * replaced ask can never open an attempt nobody was asked to judge.
   */
  const pendingGestureCueRef = useRef<string | null>(null);
  const cueTimerRef = useRef<number | null>(null);
  const cueFallbackTimerRef = useRef<number | null>(null);
  // ── Session-liveness ladder state (DI BACKLOG item 5) ─────────────────────
  const deadCueTimerRef = useRef<number | null>(null);
  const deadCueCountRef = useRef(0);
  const lastSentCueRef = useRef<string | null>(null);
  /** Baseline for the resume signal; null until the mount effect seeds it so a
   *  resume that predates this run never re-fires into it. */
  const lastResumeCountRef = useRef<number | null>(null);

  // ── The tutor's judging line, captured whole ───────────────────────────────
  // The reducer classifies a verdict from the sentinel OPENER, so it fires on
  // the streaming chunk that completes "Yes" / "My turn" — by design, so
  // progression is never delayed. But for a contrastive correction the opener
  // is the one part that carries no diagnosis; "not one — two plus one is
  // three" arrives after it. So we keep accumulating the tutor's chunks past
  // the verdict and emit the finished line as its own emission when the turn
  // ends. Purely additive: the verdict emission and cue pacing are untouched,
  // and consumers that don't handle 'verdict-text' fall through their default.
  const pendingJudgeRef = useRef<{ judgment: 'affirmed' | 'corrected'; text: string } | null>(null);

  /** Emit the accumulated judging line, if one is open. Idempotent. */
  const flushJudgeText = useCallback(() => {
    const pending = pendingJudgeRef.current;
    if (!pending) return;
    pendingJudgeRef.current = null;
    const text = normalizeSpeech(pending.text);
    if (text) {
      callbacksRef.current.onEmission?.({
        kind: 'verdict-text',
        judgment: pending.judgment,
        text,
      });
    }
  }, []);

  const clearCueTimers = useCallback(() => {
    if (cueTimerRef.current != null) { window.clearTimeout(cueTimerRef.current); cueTimerRef.current = null; }
    if (cueFallbackTimerRef.current != null) { window.clearTimeout(cueFallbackTimerRef.current); cueFallbackTimerRef.current = null; }
  }, []);

  /** Stop the dead-cue watch. Called on every tutor-liveness signal (audio
   *  rise, output transcription), on resume, and on disable/reset. */
  const clearDeadCueWatch = useCallback((resetCount: boolean) => {
    if (deadCueTimerRef.current != null) {
      window.clearTimeout(deadCueTimerRef.current);
      deadCueTimerRef.current = null;
    }
    if (resetCount) deadCueCountRef.current = 0;
  }, []);

  /**
   * Start (or restart) the dead-cue watch after a cue is SENT. If the tutor
   * shows no life within CUE_DEAD_MS the cue is counted dead (reported through
   * the cue channel as phase 'dead'); at SESSION_DEAD_CUES consecutive dead
   * cues a `session-dead` emission fires and the count restarts, so continued
   * silence — i.e. a recovery that didn't recover — produces a SECOND emission
   * for the consumer to escalate on. The timer self-restarts because the dead
   * scenario is precisely the one where no further cue may ever be sent (a
   * child waiting on a tutor that will never speak sends nothing).
   */
  const armDeadCueWatch = useCallback((cueText: string) => {
    // No enabled gate HERE: a run's OPENER is sent in the same synchronous
    // frame as setRunning(true), before that render commits, so an
    // enabled-check at arm time reads stale `false` and skips the one cue a
    // from-birth-dead session ever sends (found live 2026-07-31 — the fault
    // drive stalled and the ladder slept). The deadline callback below checks
    // `enabled` at FIRE time (≥10s later, long since committed), which also
    // keeps the run-end closing cue from counting dead after disable.
    lastSentCueRef.current = cueText;
    if (deadCueTimerRef.current != null) window.clearTimeout(deadCueTimerRef.current);
    const onDeadline = () => {
      deadCueTimerRef.current = null;
      if (!callbacksRef.current.enabled) return;
      deadCueCountRef.current += 1;
      callbacksRef.current.onCue?.({ phase: 'dead', text: lastSentCueRef.current ?? '' });
      if (deadCueCountRef.current >= SESSION_DEAD_CUES) {
        const deadCues = deadCueCountRef.current;
        deadCueCountRef.current = 0;
        callbacksRef.current.onEmission?.({ kind: 'session-dead', deadCues });
      }
      deadCueTimerRef.current = window.setTimeout(onDeadline, CUE_DEAD_MS);
    };
    deadCueTimerRef.current = window.setTimeout(onDeadline, CUE_DEAD_MS);
  }, []);

  // Declared before the voice hook so its close callback can trigger cue
  // release; reads all gating state through refs, so ordering is safe.
  const voiceActiveRef = useRef<() => boolean>(() => false);

  /** `dispatch` is defined below (it depends on `schedulePendingCue`), and the
   *  cue-send path has to reach it to open a gesture attempt. Ref, not
   *  reordering: the cycle is real, and the send path only ever runs from a
   *  timer, long after both are assigned. */
  const dispatchRef = useRef<(event: LoopEvent) => void>(() => {});

  /** A cue has just gone out. If it was a gesture attempt's ask, open the
   *  attempt NOW — the tutor has been asked, so its next sentinel is the
   *  verdict, and the verdict clock starts here rather than at commit time. */
  const noteCueSent = useCallback((cue: string) => {
    if (pendingGestureCueRef.current !== cue) return;
    pendingGestureCueRef.current = null;
    dispatchRef.current({ type: 'gesture-close', at: performance.now() });
  }, []);

  /** A queued cue is being discarded. Drop any gesture claim riding on it. */
  const noteCueDropped = useCallback((cue: string | null) => {
    if (cue != null && pendingGestureCueRef.current === cue) pendingGestureCueRef.current = null;
  }, []);

  const schedulePendingCue = useCallback(() => {
    if (cueTimerRef.current != null || pendingCueRef.current == null) return;
    cueTimerRef.current = window.setTimeout(() => {
      cueTimerRef.current = null;
      // OFF-SCRIPT CUT-IN: audio playing after the queue-time line already
      // finished is a turn nobody cued — after a verdict the model has nothing
      // scripted left to say, so the script does not wait behind it. The cue
      // ships WITH interrupt (the floor is the caller's call —
      // TextQueueEntry.interrupt) instead of blocking on 'audio'. A stray
      // pre-cue attempt opened by the same noise stops blocking too: judging
      // an item whose ask was never spoken is not a state worth waiting on.
      // The child's own voice still always blocks — we cut the tutor, never
      // the learner.
      const offScript = audioPlayingRef.current && pendingCueQuietEdgeRef.current;
      // Blocked: the cue STAYS queued and re-fires on the next release edge.
      // Reported so a run that ends on a block is distinguishable from a run
      // where no cue was ever queued — the two look identical from outside.
      const blockedBy = audioPlayingRef.current && !offScript ? 'audio'
        : voiceActiveRef.current() ? 'voice'
        : loopStateRef.current.attempt != null && !offScript ? 'attempt'
        : null;
      if (blockedBy) {
        callbacksRef.current.onCue?.({
          phase: 'blocked',
          text: pendingCueRef.current ?? '',
          reason: blockedBy,
        });
        return;
      }
      const cue = pendingCueRef.current;
      pendingCueRef.current = null;
      if (cue) {
        ctx.sendText(cue, { silent: true, interrupt: offScript });
        callbacksRef.current.onCue?.({ phase: 'sent', text: cue, cutIn: offScript || undefined });
        armDeadCueWatch(cue);
        noteCueSent(cue);
      }
    }, VERIFY_BEAT_MS);
  }, [armDeadCueWatch, ctx, noteCueSent]);

  const dispatch = useCallback((event: LoopEvent) => {
    const step = reduceJudgedLoop(loopStateRef.current, event, configRef.current);
    loopStateRef.current = step.state;
    for (const emission of step.emissions) callbacksRef.current.onEmission?.(emission);
    // Open a judging-line accumulator, seeded with what the tutor had said when
    // the sentinel classified it. Any earlier line still open is flushed first
    // so two judgments can never merge into one string.
    for (const emission of step.emissions) {
      if (emission.kind !== 'verdict' || !emission.verdictText) continue;
      if (emission.judgment !== 'affirmed' && emission.judgment !== 'corrected') continue;
      flushJudgeText();
      pendingJudgeRef.current = { judgment: emission.judgment, text: emission.verdictText };
    }
    // A cue queued by this dispatch's own emission handlers (affirm → next
    // item cue) was stamped before the judge line above was seeded. It rides
    // BEHIND that line — if its audio has not played yet, audio-off at queue
    // time said nothing about quiet, so the off-script stamp is demoted and
    // the falling edge of the verdict line raises it instead.
    if (pendingJudgeRef.current != null) pendingCueQuietEdgeRef.current = false;
    // A processed verdict may have unblocked a queued (or newly queued) cue.
    if (step.emissions.some((emission) => emission.kind === 'verdict')) schedulePendingCue();
  }, [flushJudgeText, schedulePendingCue]);
  dispatchRef.current = dispatch;

  const handleVoiceTurnClose = useCallback((event: Extract<VoiceTurnEvent, { kind: 'close' }>) => {
    flushJudgeText();
    callbacksRef.current.onVoiceTurnClose?.(event);
    const turn = {
      openedAt: event.startedAt,
      closedAt: event.startedAt + event.durationMs,
      durationMs: event.durationMs,
      peak: event.peak,
      duringTutorAudio: event.duringTutorAudio,
    };
    // Deaf-loop detection. A turn only reaches this handler while the run is
    // enabled (both turn paths are gated on it), so a REAL turn closing against
    // an unarmed loop means the learner is speaking into a surface that cannot
    // record them — and the reducer, correctly inert when disarmed (DI-3),
    // leaves no trace of it. Read BEFORE dispatch, which is what would arm.
    const wasArmed = loopStateRef.current.armed;
    dispatch(event.belowMinVoice ? { type: 'voice-blip', turn } : { type: 'voice-close', turn });
    if (!wasArmed && !event.belowMinVoice) {
      callbacksRef.current.onEmission?.({ kind: 'loop-deaf', turn });
    }
    schedulePendingCue();
  }, [dispatch, flushJudgeText, schedulePendingCue]);

  // Standalone DI remains self-contained. In a lesson, the provider is the one
  // activity-bracket owner and this judged loop only consumes its turn stream.
  const usesSharedVoiceTurns = ctx.sessionMode === 'lesson' && !!ctx.sharedVoiceTurns;
  const localVoiceTurns = useLiveVoiceTurns({
    enabled: enabled && !usesSharedVoiceTurns,
    config: options.voice?.config,
    onTurnClose: handleVoiceTurnClose,
  });
  useEffect(() => {
    if (!enabled || !usesSharedVoiceTurns) return;
    return ctx.sharedVoiceTurns.subscribe({ onTurnClose: handleVoiceTurnClose });
  }, [ctx.sharedVoiceTurns?.subscribe, enabled, handleVoiceTurnClose, usesSharedVoiceTurns]);

  const preserveSharedTransport = useCallback(() => {
    // A judged-run reset must not close conversation or discard calibration.
  }, []);
  const voiceTurns: LiveVoiceTurns = usesSharedVoiceTurns
    ? { ...ctx.sharedVoiceTurns, reset: preserveSharedTransport }
    : localVoiceTurns;
  voiceActiveRef.current = voiceTurns.isVoiceActive;

  // Conversation feed: user messages are transcripts, assistant messages are
  // tutor output. Index advances even while disabled so a run never replays
  // pre-run chatter.
  useEffect(() => {
    const next = ctx.conversation.slice(conversationIndexRef.current);
    conversationIndexRef.current = ctx.conversation.length;
    if (!enabled) return;
    const now = performance.now();
    for (const message of next) {
      if (message.role === 'user') {
        dispatch({ type: 'transcript', text: message.content, at: now });
      } else {
        // Tutor output of any kind is session liveness — the dead-cue watch
        // asks "did the tutor react to the cue at all", not "did it judge".
        clearDeadCueWatch(true);
        callbacksRef.current.onTutorText?.(message.content);
        // Extend an open judging line BEFORE dispatching, so the chunk that
        // triggered the verdict isn't counted twice: at that point nothing is
        // open yet, and the reducer seeds the accumulator with it a line below.
        //
        // Concatenated WITHOUT a separator: transcription chunks carry their
        // own leading whitespace and split mid-token (": not one —", ", three."),
        // so inserting a space fabricates one — "My turn : not one". The
        // reducer joins with a space instead, which is harmless to it because
        // `tokenize` strips punctuation, but this string is quoted verbatim
        // into evidence.
        if (pendingJudgeRef.current) {
          pendingJudgeRef.current.text += message.content;
        }
        dispatch({ type: 'tutor-text', text: message.content, at: now });
      }
    }
  }, [ctx.conversation, enabled, dispatch, clearDeadCueWatch]);

  // Tutor audio falling edge: the response clock + the off-script gate + a
  // cue release edge. The RISING edge is the primary liveness signal for the
  // dead-cue watch: the tutor started saying something, so the session behind
  // the socket is alive.
  useEffect(() => {
    const wasPlaying = previousAudioPlayingRef.current;
    previousAudioPlayingRef.current = ctx.isAudioPlaying;
    if (!wasPlaying && ctx.isAudioPlaying) {
      clearDeadCueWatch(true);
      // Audio rising while a cue is pending AND its queue-time line already
      // ended: an off-script turn just started. Schedule now so the cut-in
      // fires one beat in, instead of waiting for the 5s fallback while the
      // improvisation runs (run f634f61b2b42 lost 40 seconds to exactly this).
      if (pendingCueRef.current != null && pendingCueQuietEdgeRef.current) schedulePendingCue();
    }
    if (wasPlaying && !ctx.isAudioPlaying) {
      // The tutor stopped talking: its judging line is complete. Emit it
      // BEFORE the quiet dispatch, so the order a consumer sees is always
      // judgment → that judgment's full text → whatever quiet triggers.
      if (enabled) flushJudgeText();
      if (enabled) dispatch({ type: 'tutor-quiet', at: performance.now() });
      // The line a pending cue was queued behind has finished — from here on
      // the model is off-script if it speaks again.
      if (pendingCueRef.current != null) pendingCueQuietEdgeRef.current = true;
      schedulePendingCue();
    }
  }, [ctx.isAudioPlaying, enabled, dispatch, flushJudgeText, schedulePendingCue, clearDeadCueWatch]);

  // Verdict-timeout scan while an attempt is pending.
  //
  // ⚠️ DEPENDS ON `enabled` ALONE, AND THAT IS THE WHOLE POINT — it used to also
  // depend on `dispatch`, and that made `verdictTimeoutMs` DEAD ANY TIME THE MIC
  // WAS OPEN (found live 2026-08-10 on cvc-speller's first build item).
  // `dispatch` → `schedulePendingCue` → `ctx`, and `LuminaAIContext` builds its
  // value as a plain object literal (no useMemo) while `setMicLevel` fires on
  // EVERY audio frame — so the provider re-renders every ~10-40ms, `dispatch`
  // takes a new identity every time, and this effect tore down and recreated a
  // 1000ms interval faster than it could ever fire. Not once, for a whole run.
  //
  // Nothing noticed for four ports because their tutor always speaks: verdicts
  // arrive through `tutor-text` and off-script through `tutor-quiet`, so the
  // tick is the one path they never need. `spell-word` is the first shape where
  // the tutor is DELIBERATELY SILENT, and there the tick is the only thing that
  // can ever close a stray voice attempt — and `schedulePendingCue` blocks every
  // queued cue while an attempt is open, so one word said aloud mid-build jammed
  // the lesson permanently.
  //
  // The interval reads `dispatchRef`, which is reassigned on every render, so it
  // always calls the current dispatch without being rebound to it.
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (loopStateRef.current.attempt != null) {
        dispatchRef.current({ type: 'tick', at: performance.now() });
      }
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled]);

  // Resume signal (DI BACKLOG item 5, fix (i)): the context bumps
  // sessionResumeCount for every transparent server-side resume AND every warm
  // client-socket reconnect (both end in the server's session_resumed). The
  // resume restored the conversation, not the item in flight — surface it so
  // the consumer can re-cue. The baseline seeds silently (a resume that
  // happened before this run started is not this run's business) and keeps
  // tracking while disabled so enabling never replays a stale resume.
  const resumeCount = ctx.sessionResumeCount ?? 0;
  useEffect(() => {
    if (lastResumeCountRef.current === null || resumeCount === lastResumeCountRef.current) {
      lastResumeCountRef.current = resumeCount;
      return;
    }
    lastResumeCountRef.current = resumeCount;
    if (!callbacksRef.current.enabled) return;
    // Fresh connection, fresh liveness slate: the re-cue this triggers re-arms
    // the dead-cue watch, which is what catches a resume into a dead session.
    clearDeadCueWatch(true);
    callbacksRef.current.onEmission?.({ kind: 'session-resumed' });
  }, [resumeCount, clearDeadCueWatch]);

  // Disable → disarm (the voice hook closes its own turn). A queued cue is
  // deliberately NOT dropped: consumers queue their closing line ("run
  // complete") and then disable, and that line must still fire after the
  // verify audio settles. Consumers that stop abruptly call clearQueuedCue.
  //
  // FALLING EDGE ONLY — never "while disabled" (first lesson-integrated DI
  // sitting, run 967e2399f310, 2026-08-06: the pack armed, then answered
  // nothing for a whole run; 9 voice turns, `attempts: 0`).
  //
  // A pack arms inside its startRun, which calls `setRunning(true)` and `arm()`
  // in one synchronous block — so the ref write lands BEFORE React commits
  // `enabled: true`. This effect's other deps (`dispatch` → `schedulePendingCue`
  // → `ctx`) change identity on EVERY render, and the lesson provider rebuilds
  // its context value on every mic-level frame, so the effect re-runs constantly.
  // Level-triggered, any of those passes that still carried the pre-run
  // `enabled === false` — one racing the arm, or the previous render's deferred
  // passive effects flushing late — wiped the arm, and nothing re-armed it. An
  // unarmed loop returns `voice-close`, `transcript` and `tutor-text` untouched,
  // so the child speaks, the tutor judges, and the surface never hears either.
  const previousEnabledRef = useRef(enabled);
  useEffect(() => {
    const wasEnabled = previousEnabledRef.current;
    previousEnabledRef.current = enabled;
    if (enabled || !wasEnabled) return;
    dispatch({ type: 'disarm' });
    clearDeadCueWatch(true);
  }, [enabled, dispatch, clearDeadCueWatch]);

  const clearQueuedCue = useCallback(() => {
    if (pendingCueRef.current != null) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
    }
    noteCueDropped(pendingCueRef.current);
    pendingCueRef.current = null;
    clearCueTimers();
  }, [clearCueTimers, noteCueDropped]);

  const queueCue = useCallback((text: string) => {
    // A queue that overwrites an unsent cue is a real (if usually benign)
    // event — the replaced cue is never spoken. Reported as dropped so the
    // timeline shows one 'sent' per 'queued' when the run is coherent.
    if (pendingCueRef.current != null && pendingCueRef.current !== text) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
      noteCueDropped(pendingCueRef.current);
    }
    pendingCueRef.current = text;
    // Queued while the tutor speaks — or while a verdict line is owed but its
    // audio has not started (transcript can beat playback) — the cue rides
    // BEHIND that scripted line; it finishes before the cue may go. Queued in
    // true quiet = nothing scripted is left, and any audio from here on is
    // off-script. (The affirm-path queue runs inside the verdict dispatch
    // BEFORE the judge line is seeded; the dispatch demotes this stamp right
    // after seeding, closing that ordering gap.)
    pendingCueQuietEdgeRef.current = !audioPlayingRef.current && pendingJudgeRef.current == null;
    callbacksRef.current.onCue?.({ phase: 'queued', text });
    if (!audioPlayingRef.current) schedulePendingCue();
    if (cueFallbackTimerRef.current != null) window.clearTimeout(cueFallbackTimerRef.current);
    cueFallbackTimerRef.current = window.setTimeout(() => {
      cueFallbackTimerRef.current = null;
      schedulePendingCue();
    }, PENDING_CUE_MAX_WAIT_MS);
  }, [noteCueDropped, schedulePendingCue]);

  /**
   * Commit a MANIPULATION as a judged attempt: the learner finished a build /
   * sort / placement, and `cue` is the ask that tells the tutor what they did
   * and which line to speak about it.
   *
   * The cue is paced exactly like any other (it waits for the tutor to finish
   * talking), and the attempt opens the instant it actually goes out — so the
   * verdict clock measures the tutor's thinking, not our own queueing, and the
   * cue is never blocked by the attempt it is meant to provoke.
   *
   * The tutor's verdict then binds through the ordinary sentinel scan, which is
   * the whole point: a child who arranges tiles gets the same waiting teacher,
   * the same contrastive correction, and the same tutor-owned advance as a child
   * who says a word — instead of a Check button and a timer.
   */
  const submitGestureAttempt = useCallback((cue: string) => {
    pendingGestureCueRef.current = cue;
    queueCue(cue);
  }, [queueCue]);

  const sendCueNow = useCallback((text: string) => {
    if (pendingCueRef.current != null) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
      noteCueDropped(pendingCueRef.current);
    }
    pendingCueRef.current = null;
    clearCueTimers();
    ctx.sendText(text, { silent: true });
    // 'queued' then 'sent' even though nothing waited, so the ledger balances:
    // every 'sent' and every 'dropped' consumes exactly one 'queued', which
    // makes `queued − sent − dropped > 0` a clean read of "a cue stalled".
    callbacksRef.current.onCue?.({ phase: 'queued', text });
    callbacksRef.current.onCue?.({ phase: 'sent', text });
    armDeadCueWatch(text);
    noteCueSent(text);
  }, [armDeadCueWatch, clearCueTimers, ctx, noteCueDropped, noteCueSent]);

  const arm = useCallback(() => dispatch({ type: 'arm' }), [dispatch]);
  const disarm = useCallback(() => dispatch({ type: 'disarm' }), [dispatch]);

  const reset = useCallback(() => {
    voiceTurns.reset();
    loopStateRef.current = IDLE_JUDGED_LOOP;
    // Dropped, not flushed: a new run must not inherit the last run's judge.
    pendingJudgeRef.current = null;
    pendingCueRef.current = null;
    pendingGestureCueRef.current = null;
    clearCueTimers();
    clearDeadCueWatch(true);
    conversationIndexRef.current = ctx.conversation.length;
  // voiceTurns is a fresh object each render but reset/refs are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCueTimers, clearDeadCueWatch, ctx, voiceTurns.reset]);

  useEffect(() => () => {
    clearCueTimers();
    clearDeadCueWatch(true);
  }, [clearCueTimers, clearDeadCueWatch]);

  return {
    voiceTurns,
    queueCue,
    submitGestureAttempt,
    sendCueNow,
    clearQueuedCue,
    arm,
    disarm,
    reset,
    isAwaitingJudgment: () => loopStateRef.current.attempt != null,
    config,
  };
}
