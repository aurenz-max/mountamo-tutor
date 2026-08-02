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

  const schedulePendingCue = useCallback(() => {
    if (cueTimerRef.current != null || pendingCueRef.current == null) return;
    cueTimerRef.current = window.setTimeout(() => {
      cueTimerRef.current = null;
      // Blocked: the cue STAYS queued and re-fires on the next release edge.
      // Reported so a run that ends on a block is distinguishable from a run
      // where no cue was ever queued — the two look identical from outside.
      const blockedBy = audioPlayingRef.current ? 'audio'
        : voiceActiveRef.current() ? 'voice'
        : loopStateRef.current.attempt != null ? 'attempt'
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
        ctx.sendText(cue, { silent: true });
        callbacksRef.current.onCue?.({ phase: 'sent', text: cue });
        armDeadCueWatch(cue);
      }
    }, VERIFY_BEAT_MS);
  }, [armDeadCueWatch, ctx]);

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
    // A processed verdict may have unblocked a queued (or newly queued) cue.
    if (step.emissions.some((emission) => emission.kind === 'verdict')) schedulePendingCue();
  }, [flushJudgeText, schedulePendingCue]);

  const voiceTurns = useLiveVoiceTurns({
    enabled,
    config: options.voice?.config,
    onTurnClose: (event) => {
      // The learner answered over the tutor's line — it is as finished as it
      // is going to get. Flush BEFORE the attempt opens, so a consumer that
      // closes its evidence window on 'attempt-open' still sees the upgrade.
      flushJudgeText();
      // Reported ABOVE the min-voice gate: a blip whose activityEnd already
      // went to Gemini is precisely the turn we decline to anchor, so it must
      // be visible to the consumer's run log even though nothing anchors to it.
      callbacksRef.current.onVoiceTurnClose?.(event);
      const turn = {
        openedAt: event.startedAt,
        closedAt: event.startedAt + event.durationMs,
        durationMs: event.durationMs,
        peak: event.peak,
        duringTutorAudio: event.duringTutorAudio,
      };
      // A blip opens no attempt — but its activityEnd has already gone out, so
      // the reducer keeps it as a retro-anchor rather than forgetting the
      // learner spoke at all.
      dispatch(event.belowMinVoice ? { type: 'voice-blip', turn } : { type: 'voice-close', turn });
      schedulePendingCue();
    },
  });
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
    if (!wasPlaying && ctx.isAudioPlaying) clearDeadCueWatch(true);
    if (wasPlaying && !ctx.isAudioPlaying) {
      // The tutor stopped talking: its judging line is complete. Emit it
      // BEFORE the quiet dispatch, so the order a consumer sees is always
      // judgment → that judgment's full text → whatever quiet triggers.
      if (enabled) flushJudgeText();
      if (enabled) dispatch({ type: 'tutor-quiet', at: performance.now() });
      schedulePendingCue();
    }
  }, [ctx.isAudioPlaying, enabled, dispatch, flushJudgeText, schedulePendingCue, clearDeadCueWatch]);

  // Verdict-timeout scan while an attempt is pending.
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (loopStateRef.current.attempt != null) dispatch({ type: 'tick', at: performance.now() });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, dispatch]);

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
  useEffect(() => {
    if (enabled) return;
    dispatch({ type: 'disarm' });
    clearDeadCueWatch(true);
  }, [enabled, dispatch, clearDeadCueWatch]);

  const clearQueuedCue = useCallback(() => {
    if (pendingCueRef.current != null) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
    }
    pendingCueRef.current = null;
    clearCueTimers();
  }, [clearCueTimers]);

  const queueCue = useCallback((text: string) => {
    // A queue that overwrites an unsent cue is a real (if usually benign)
    // event — the replaced cue is never spoken. Reported as dropped so the
    // timeline shows one 'sent' per 'queued' when the run is coherent.
    if (pendingCueRef.current != null && pendingCueRef.current !== text) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
    }
    pendingCueRef.current = text;
    callbacksRef.current.onCue?.({ phase: 'queued', text });
    if (!audioPlayingRef.current) schedulePendingCue();
    if (cueFallbackTimerRef.current != null) window.clearTimeout(cueFallbackTimerRef.current);
    cueFallbackTimerRef.current = window.setTimeout(() => {
      cueFallbackTimerRef.current = null;
      schedulePendingCue();
    }, PENDING_CUE_MAX_WAIT_MS);
  }, [schedulePendingCue]);

  const sendCueNow = useCallback((text: string) => {
    if (pendingCueRef.current != null) {
      callbacksRef.current.onCue?.({ phase: 'dropped', text: pendingCueRef.current });
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
  }, [armDeadCueWatch, clearCueTimers, ctx]);

  const arm = useCallback(() => dispatch({ type: 'arm' }), [dispatch]);
  const disarm = useCallback(() => dispatch({ type: 'disarm' }), [dispatch]);

  const reset = useCallback(() => {
    voiceTurns.reset();
    loopStateRef.current = IDLE_JUDGED_LOOP;
    // Dropped, not flushed: a new run must not inherit the last run's judge.
    pendingJudgeRef.current = null;
    pendingCueRef.current = null;
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
    sendCueNow,
    clearQueuedCue,
    arm,
    disarm,
    reset,
    isAwaitingJudgment: () => loopStateRef.current.attempt != null,
    config,
  };
}
