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
  /** Closed voice turns above the min-voice bar (mic telemetry). */
  onVoiceTurnClose?: (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => void;
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

  const clearCueTimers = useCallback(() => {
    if (cueTimerRef.current != null) { window.clearTimeout(cueTimerRef.current); cueTimerRef.current = null; }
    if (cueFallbackTimerRef.current != null) { window.clearTimeout(cueFallbackTimerRef.current); cueFallbackTimerRef.current = null; }
  }, []);

  // Declared before the voice hook so its close callback can trigger cue
  // release; reads all gating state through refs, so ordering is safe.
  const voiceActiveRef = useRef<() => boolean>(() => false);

  const schedulePendingCue = useCallback(() => {
    if (cueTimerRef.current != null || pendingCueRef.current == null) return;
    cueTimerRef.current = window.setTimeout(() => {
      cueTimerRef.current = null;
      if (audioPlayingRef.current || voiceActiveRef.current() || loopStateRef.current.attempt != null) return;
      const cue = pendingCueRef.current;
      pendingCueRef.current = null;
      if (cue) ctx.sendText(cue, { silent: true });
    }, VERIFY_BEAT_MS);
  }, [ctx]);

  const dispatch = useCallback((event: LoopEvent) => {
    const step = reduceJudgedLoop(loopStateRef.current, event, configRef.current);
    loopStateRef.current = step.state;
    for (const emission of step.emissions) callbacksRef.current.onEmission?.(emission);
    // A processed verdict may have unblocked a queued (or newly queued) cue.
    if (step.emissions.some((emission) => emission.kind === 'verdict')) schedulePendingCue();
  }, [schedulePendingCue]);

  const voiceTurns = useLiveVoiceTurns({
    enabled,
    config: options.voice?.config,
    onTurnClose: (event) => {
      if (!event.belowMinVoice) {
        callbacksRef.current.onVoiceTurnClose?.(event);
        dispatch({
          type: 'voice-close',
          turn: {
            openedAt: event.startedAt,
            closedAt: event.startedAt + event.durationMs,
            durationMs: event.durationMs,
            peak: event.peak,
            duringTutorAudio: event.duringTutorAudio,
          },
        });
      }
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
        callbacksRef.current.onTutorText?.(message.content);
        dispatch({ type: 'tutor-text', text: message.content, at: now });
      }
    }
  }, [ctx.conversation, enabled, dispatch]);

  // Tutor audio falling edge: the response clock + the off-script gate + a
  // cue release edge.
  useEffect(() => {
    const wasPlaying = previousAudioPlayingRef.current;
    previousAudioPlayingRef.current = ctx.isAudioPlaying;
    if (wasPlaying && !ctx.isAudioPlaying) {
      if (enabled) dispatch({ type: 'tutor-quiet', at: performance.now() });
      schedulePendingCue();
    }
  }, [ctx.isAudioPlaying, enabled, dispatch, schedulePendingCue]);

  // Verdict-timeout scan while an attempt is pending.
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (loopStateRef.current.attempt != null) dispatch({ type: 'tick', at: performance.now() });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, dispatch]);

  // Disable → disarm (the voice hook closes its own turn). A queued cue is
  // deliberately NOT dropped: consumers queue their closing line ("run
  // complete") and then disable, and that line must still fire after the
  // verify audio settles. Consumers that stop abruptly call clearQueuedCue.
  useEffect(() => {
    if (enabled) return;
    dispatch({ type: 'disarm' });
  }, [enabled, dispatch]);

  const clearQueuedCue = useCallback(() => {
    pendingCueRef.current = null;
    clearCueTimers();
  }, [clearCueTimers]);

  const queueCue = useCallback((text: string) => {
    pendingCueRef.current = text;
    if (!audioPlayingRef.current) schedulePendingCue();
    if (cueFallbackTimerRef.current != null) window.clearTimeout(cueFallbackTimerRef.current);
    cueFallbackTimerRef.current = window.setTimeout(() => {
      cueFallbackTimerRef.current = null;
      schedulePendingCue();
    }, PENDING_CUE_MAX_WAIT_MS);
  }, [schedulePendingCue]);

  const sendCueNow = useCallback((text: string) => {
    pendingCueRef.current = null;
    clearCueTimers();
    ctx.sendText(text, { silent: true });
  }, [clearCueTimers, ctx]);

  const arm = useCallback(() => dispatch({ type: 'arm' }), [dispatch]);
  const disarm = useCallback(() => dispatch({ type: 'disarm' }), [dispatch]);

  const reset = useCallback(() => {
    voiceTurns.reset();
    loopStateRef.current = IDLE_JUDGED_LOOP;
    pendingCueRef.current = null;
    clearCueTimers();
    conversationIndexRef.current = ctx.conversation.length;
  // voiceTurns is a fresh object each render but reset/refs are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCueTimers, ctx, voiceTurns.reset]);

  useEffect(() => () => clearCueTimers(), [clearCueTimers]);

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
