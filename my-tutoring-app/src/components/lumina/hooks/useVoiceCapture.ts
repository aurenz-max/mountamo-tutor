'use client';

/**
 * useVoiceCapture — Lumina's spoken-interaction capture ENGINE.
 *
 * Extracted from the Blend Judge Lab / Voice Studio bench so any primitive
 * (or studio scenario) can plug voice in without re-deriving the timing
 * doctrine. The engine owns the mechanics; the consumer owns the meaning:
 *
 *   ENGINE (here)                         CONSUMER (primitive / scenario)
 *   ─ mic lifecycle, all three modalities ─ what a verdict means (grading)
 *   ─ honest speak-cue timing             ─ which judge to call per pass
 *   ─ endpointing + speculative dispatch  ─ feedback sounds + status copy
 *   ─ pre-roll ring (no clipped onsets)   ─ actuation (boards, submits)
 *   ─ ack earcons + processing pulse      ─ when an activation is "done"
 *   ─ timing instrumentation per clip
 *
 * TIMING DOCTRINE (see qa memory: spoken-cue-timing-doctrine):
 *  - 'opening' state from mic request until the FIRST audio frame; the ready
 *    earcon + 'armed' fire on that frame — never cue "speak now" earlier.
 *  - ~250ms pre-roll kept while waiting for speech so onsets never clip.
 *  - Every utterance records micOpenMs / onsetMs / earlyOnset.
 *
 * MODALITIES (user ruling 2026-07-05: open is the native shape):
 *  - 'open': mic opens once, stays hot; utterances segmented continuously;
 *    judging overlaps listening. Bounds: stop() + 60s walked-away close.
 *  - 'ptt':  one utterance per start() gesture.
 *  - 'turn': LEGACY window loop (arm delay, cooldown, silence strikes,
 *    capture budget) — kept for comparison benches only.
 *  Treat `modality` as fixed for the life of the hook instance — remount the
 *  consumer (React `key`) to switch.
 *
 * JUDGING CONTRACT — generic over verdict V and frozen context C:
 *  - getContext() is snapshotted into each utterance AT CAPTURE TIME, so a
 *    verdict landing after focus/target changed still actuates what the
 *    student was aiming at when they spoke.
 *  - judge(utt, pass) is called with pass:
 *      'spec'     — speculative snapshot at 250ms of silence (fast lane)
 *      'escalate' — same audio, spec pass was unconfident → second opinion
 *      'fresh'    — the full clip IS the utterance (no spec, or speech
 *                   resumed after the snapshot) → enter your ladder at rung 1
 *  - isConfident(v) decides whether a spec verdict is FINAL (skips the full
 *    clip entirely — this is where the ~400ms ack→verdict path comes from).
 *  - onSettle(v, utt) fires exactly once per utterance with the final
 *    verdict (null if every judge call errored).
 *
 * AUTO-START (the no-button experience): pass autoStart:true and the engine
 * opens itself whenever the browser already holds a standing mic grant —
 * never when it would trigger the permission dialog. stop() latches until
 * `activationKey` changes (a new challenge) or start() is called by hand.
 *
 * GLOBAL AUTO-LISTEN SWITCH (utils/voiceMode, navbar LuminaVoiceToggle,
 * Ctrl+M): when the session-level switch is OFF the engine suppresses
 * auto-start AND stops any live open/turn session — hands-free listening
 * dies in one place. Explicit gestures are still honored: ptt taps and a
 * manual start() work regardless, because a click IS the user choosing
 * voice right now.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundManager } from '../utils/SoundManager';
import { encodeWav16kMono, bytesToBase64 } from '../utils/wavEncode';
import { useAutoListenEnabled } from '../utils/voiceMode';

// ── Endpointing (bench-tuned 2026-07-04 in the Voice Studio) ─────
export const SPEECH_RMS_THRESHOLD = 0.015;
export const SPECULATIVE_SILENCE_MS = 250;
export const FULL_SILENCE_MS = 750;
export const MAX_CLIP_MS = 6000;
export const ARM_TIMEOUT_MS = 8000; // ptt/turn window with no speech
// Modality timing
export const DEFAULT_ARM_DELAY_MS = 300;
export const DEFAULT_COOLDOWN_MS = 400;
export const MAX_NO_SPEECH_STREAK = 2;
export const MAX_AUTO_CAPTURES = 8;
export const OPEN_IDLE_CLOSE_MS = 60000; // walked-away bound — never mid-thought
export const PRE_ROLL_FRAMES = 3;        // ~250ms @48k/4096
export const EARLY_ONSET_MS = 120;       // speech this soon after open ⇒ cue was late

export type VoiceModality = 'ptt' | 'turn' | 'open';
export type VoiceCaptureState = 'idle' | 'opening' | 'armed' | 'recording' | 'judging';
export type VoiceJudgePass = 'spec' | 'escalate' | 'fresh';
export type MicPermission = 'granted' | 'prompt' | 'denied' | 'unknown';
export type VoiceDormantReason = 'silence' | 'budget' | 'idle' | null;

export interface VoiceCaptureTiming {
  /** start()/arm → first audio frame. The honest speak-cue latency. */
  micOpenMs: number | null;
  /** First frame → first speech (first utterance after an open only). */
  onsetMs: number | null;
  /** Speech ≤EARLY_ONSET_MS after open ⇒ the student beat the mic. */
  earlyOnset: boolean;
}

const emptyTiming = (): VoiceCaptureTiming => ({ micOpenMs: null, onsetMs: null, earlyOnset: false });

export interface CapturedUtterance<C> {
  base64: string;
  url: string;
  ms: number;
  /** Consumer context frozen at capture time (target word, focused problem…). */
  context: C;
  modality: VoiceModality;
  timing: VoiceCaptureTiming;
}

export interface UseVoiceCaptureOptions<V, C> {
  modality: VoiceModality;
  /** Snapshotted into every utterance at capture time. */
  getContext: () => C;
  /** Run one judge call for the given pass. Return null on error. */
  judge: (utterance: CapturedUtterance<C>, pass: VoiceJudgePass) => Promise<V | null>;
  /** True ⇒ a 'spec' verdict is final and the full clip is never judged. */
  isConfident: (verdict: V) => boolean;
  /** Exactly once per utterance with the FINAL verdict (null = all rungs errored). */
  onSettle: (verdict: V | null, utterance: CapturedUtterance<C>) => void;
  /** A ptt/turn window closed with no speech at all. */
  onNoSpeech?: () => void;
  /** Open the mic without a button whenever a standing grant exists. */
  autoStart?: boolean;
  /** New value = new activation: clears the stop latch, re-fires autoStart. */
  activationKey?: string;
  /** Turn modality only. */
  armDelayMs?: number;
  cooldownMs?: number;
}

export interface VoiceCapture {
  state: VoiceCaptureState;
  /** Live RMS (~0..0.15) for LuminaMicListener. */
  level: number;
  /** Activation running (turn/open loop live or dormant-recoverable). */
  active: boolean;
  /** Loop paused, tap to resume (silence strikes / budget / walked away). */
  dormant: boolean;
  dormantReason: VoiceDormantReason;
  /** Utterances currently in the judge chain (open mode overlaps). */
  inFlight: number;
  /** Last measured start→first-frame latency, for timing readouts. */
  micOpenMs: number | null;
  /** Turn modality: windows used this activation. */
  windowsUsed: number;
  isSupported: boolean;
  micPermission: MicPermission;
  /** Begin an activation (user gesture, or programmatic after grant). */
  start: () => void;
  /** Stop everything; latches against autoStart until a new activationKey. */
  stop: () => void;
  /** Dormancy recovery — a real tap refreshes the loop budget. */
  resume: () => void;
}

/** Track the standing mic grant without ever triggering the prompt. */
export function useMicPermission(): MicPermission {
  const [perm, setPerm] = useState<MicPermission>('unknown');
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.permissions?.query !== 'function') return;
    let disposed = false;
    let status: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((s) => {
        if (disposed) return;
        status = s;
        setPerm(s.state);
        s.onchange = () => setPerm(s.state);
      })
      .catch(() => setPerm('unknown')); // Safari: no query — stay manual
    return () => {
      disposed = true;
      if (status) status.onchange = null;
    };
  }, []);
  return perm;
}

interface MicSession {
  stream: MediaStream;
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
}

export function useVoiceCapture<V, C>(options: UseVoiceCaptureOptions<V, C>): VoiceCapture {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(false);
  const [dormant, setDormant] = useState(false);
  const [dormantReason, setDormantReason] = useState<VoiceDormantReason>(null);
  const [inFlight, setInFlight] = useState(0);
  const [micOpenMs, setMicOpenMs] = useState<number | null>(null);
  const [windowsUsed, setWindowsUsed] = useState(0);

  const micPermission = useMicPermission();

  // Options read through a ref so audio callbacks never see stale values.
  const o = useRef(options);
  o.current = options;

  const sessionRef = useRef<MicSession | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speechStartedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const utteranceStartedAtRef = useRef(0);
  const windowStartedAtRef = useRef(0);
  const specFiredRef = useRef(false);
  const speechAfterSpecRef = useRef(false);
  const specPromiseRef = useRef<Promise<V | null> | null>(null);
  const specUttRef = useRef<CapturedUtterance<C> | null>(null);
  const firstFrameSeenRef = useRef(false);
  const armRequestedAtRef = useRef(0);
  const micOpenAtRef = useRef(0);
  const timingRef = useRef<VoiceCaptureTiming>(emptyTiming());
  const lastActivityAtRef = useRef(0);
  const noSpeechStreakRef = useRef(0);
  const capturesUsedRef = useRef(0);
  const armTimerRef = useRef<number | null>(null);
  const pulseCountRef = useRef(0);
  const cancelledRef = useRef(false);
  const openingRef = useRef(false);
  const activeRef = useRef(false);
  const stopLatchRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.AudioContext && navigator.mediaDevices?.getUserMedia);

  const teardownMic = useCallback(() => {
    // Mic-only teardown — the processing pulse must SURVIVE this (it plays
    // while judges run after the mic is off). Unmount stops it separately.
    const s = sessionRef.current;
    if (s) {
      s.processor.disconnect();
      s.source.disconnect();
      s.stream.getTracks().forEach((t) => t.stop());
      if (s.ctx.state !== 'closed') s.ctx.close().catch(() => {});
      sessionRef.current = null;
    }
    setLevel(0);
  }, []);

  const clearArmTimer = useCallback(() => {
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearArmTimer();
      teardownMic();
      SoundManager.stopProcessing();
    },
    [clearArmTimer, teardownMic],
  );

  /** An utterance enters the judge chain: "heard you" ack + thinking pulse. */
  const ack = useCallback(() => {
    pulseCountRef.current += 1;
    setInFlight(pulseCountRef.current);
    SoundManager.snap();
    SoundManager.startProcessing();
  }, []);

  const goDormant = useCallback((reason: Exclude<VoiceDormantReason, null>) => {
    teardownMic();
    clearArmTimer();
    setState('idle');
    setDormant(true);
    setDormantReason(reason);
    SoundManager.toggle(false);
  }, [teardownMic, clearArmTimer]);
  const goDormantRef = useRef(goDormant);
  goDormantRef.current = goDormant;

  const scheduleArmRef = useRef<(delayMs: number) => void>(() => {});
  const openMicRef = useRef<() => Promise<void>>(async () => {});

  // The FINAL verdict for one utterance. Consumer feedback happens in
  // onSettle; the engine only does pulse bookkeeping + the turn re-arm.
  const settle = useCallback((verdict: V | null, utt: CapturedUtterance<C>, micStillOpen: boolean) => {
    pulseCountRef.current = Math.max(0, pulseCountRef.current - 1);
    setInFlight(pulseCountRef.current);
    if (pulseCountRef.current === 0) SoundManager.stopProcessing();
    if (!micStillOpen) setState('idle');
    if (!cancelledRef.current) o.current.onSettle(verdict, utt);
    // Turn loop: re-arm after the consumer had its say — a consumer that
    // called stop() (activation complete) suppresses the re-arm.
    if (o.current.modality === 'turn' && activeRef.current && !micStillOpen) {
      scheduleArmRef.current(o.current.cooldownMs ?? DEFAULT_COOLDOWN_MS);
    }
  }, []);
  const settleRef = useRef(settle);
  settleRef.current = settle;

  const handleNoSpeech = useCallback(() => {
    setState('idle');
    if (!cancelledRef.current) o.current.onNoSpeech?.();
    if (o.current.modality === 'turn' && activeRef.current) {
      noSpeechStreakRef.current += 1;
      if (noSpeechStreakRef.current >= MAX_NO_SPEECH_STREAK) {
        goDormantRef.current('silence');
      } else {
        scheduleArmRef.current(o.current.cooldownMs ?? DEFAULT_COOLDOWN_MS);
      }
    }
  }, []);
  const handleNoSpeechRef = useRef(handleNoSpeech);
  handleNoSpeechRef.current = handleNoSpeech;

  /** Encode chunks + freeze consumer context into an utterance. */
  const makeUtterance = useCallback((chunks: Float32Array[], sourceRate: number, timing: VoiceCaptureTiming): CapturedUtterance<C> => {
    const { bytes, durationMs } = encodeWav16kMono(chunks, sourceRate);
    return {
      base64: bytesToBase64(bytes),
      url: URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' })),
      ms: durationMs,
      context: o.current.getContext(),
      modality: o.current.modality,
      timing,
    };
  }, []);

  // Speculative first pass at 250ms of silence, while the mic keeps rolling.
  const dispatchSpeculative = useCallback(() => {
    const snapshot = chunksRef.current.slice();
    const rate = sessionRef.current?.ctx.sampleRate ?? 48000;
    ack();
    const utt = makeUtterance(snapshot, rate, { ...timingRef.current });
    specUttRef.current = utt;
    specPromiseRef.current = o.current.judge(utt, 'spec').catch(() => null);
  }, [ack, makeUtterance]);
  const dispatchSpeculativeRef = useRef(dispatchSpeculative);
  dispatchSpeculativeRef.current = dispatchSpeculative;

  // Close one utterance. keepMicOpen=true (open modality) resets utterance
  // state and keeps listening — judging overlaps capture.
  const finalizeUtterance = useCallback((keepMicOpen: boolean) => {
    const chunks = chunksRef.current;
    const sourceRate = sessionRef.current?.ctx.sampleRate ?? 48000;
    const hadSpeech = speechStartedRef.current;
    const superseded = speechAfterSpecRef.current;
    const specPromise = specPromiseRef.current;
    const specUtt = specUttRef.current;
    const timing = { ...timingRef.current };

    chunksRef.current = [];
    speechStartedRef.current = false;
    lastSpeechAtRef.current = 0;
    specFiredRef.current = false;
    speechAfterSpecRef.current = false;
    specPromiseRef.current = null;
    specUttRef.current = null;
    timingRef.current = emptyTiming();

    if (keepMicOpen) {
      lastActivityAtRef.current = Date.now();
      setState('armed');
    } else {
      teardownMic();
    }

    if (!hadSpeech || chunks.length === 0) {
      handleNoSpeechRef.current();
      return;
    }

    const fullUtt = makeUtterance(chunks, sourceRate, timing);
    if (!keepMicOpen) setState('judging');

    void (async () => {
      if (specPromise && specUtt) {
        const specVerdict = await specPromise;
        if (!superseded && specVerdict && o.current.isConfident(specVerdict)) {
          // Fast path: the snapshot verdict is final; full clip never judged.
          settleRef.current(specVerdict, specUtt, keepMicOpen);
          return;
        }
        if (!superseded) {
          // Same audio, first pass unconfident → second opinion on the full clip.
          settleRef.current(await o.current.judge(fullUtt, 'escalate').catch(() => null), fullUtt, keepMicOpen);
          return;
        }
        // Speech resumed after the snapshot — the full clip is the real
        // utterance; the consumer's ladder re-enters at rung 1.
      } else {
        // Spec never fired (hard cap mid-speech) — ack now.
        ack();
      }
      settleRef.current(await o.current.judge(fullUtt, 'fresh').catch(() => null), fullUtt, keepMicOpen);
    })();
  }, [teardownMic, makeUtterance, ack]);
  const finalizeRef = useRef(finalizeUtterance);
  finalizeRef.current = finalizeUtterance;

  // ── Per-frame audio handler ────────────────────────────────────
  const handleFrame = useCallback((event: AudioProcessingEvent) => {
    const now = Date.now();
    const data = event.inputBuffer.getChannelData(0);

    if (!firstFrameSeenRef.current) {
      // THE speak-cue moment: audio is actually flowing. Earcon + 'armed'
      // here — never earlier — is the whole timing doctrine.
      firstFrameSeenRef.current = true;
      micOpenAtRef.current = now;
      windowStartedAtRef.current = now;
      lastActivityAtRef.current = now;
      const openLatency = now - armRequestedAtRef.current;
      timingRef.current.micOpenMs = openLatency;
      setMicOpenMs(openLatency);
      SoundManager.toggle(true);
      setState('armed');
    }

    chunksRef.current.push(new Float32Array(data));
    // Pre-roll trim: while waiting for speech keep only ~250ms so onsets are
    // never clipped but clips carry no long silent head.
    if (!speechStartedRef.current && chunksRef.current.length > PRE_ROLL_FRAMES) {
      chunksRef.current.shift();
    }

    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    setLevel(rms);

    if (rms > SPEECH_RMS_THRESHOLD) {
      if (!speechStartedRef.current) {
        speechStartedRef.current = true;
        utteranceStartedAtRef.current = now;
        if (timingRef.current.micOpenMs !== null && timingRef.current.onsetMs === null) {
          const onset = now - micOpenAtRef.current;
          timingRef.current.onsetMs = onset;
          timingRef.current.earlyOnset = onset <= EARLY_ONSET_MS;
        }
        setState('recording');
      }
      if (specFiredRef.current) speechAfterSpecRef.current = true;
      lastSpeechAtRef.current = now;
      lastActivityAtRef.current = now;
    }

    const silentFor = speechStartedRef.current ? now - lastSpeechAtRef.current : 0;

    if (speechStartedRef.current && !specFiredRef.current && silentFor >= SPECULATIVE_SILENCE_MS) {
      specFiredRef.current = true;
      dispatchSpeculativeRef.current();
    }

    if (o.current.modality === 'open') {
      if (
        speechStartedRef.current &&
        (silentFor >= FULL_SILENCE_MS || now - utteranceStartedAtRef.current >= MAX_CLIP_MS)
      ) {
        finalizeRef.current(true);
      } else if (!speechStartedRef.current && now - lastActivityAtRef.current >= OPEN_IDLE_CLOSE_MS) {
        goDormantRef.current('idle');
      }
    } else {
      const elapsed = now - windowStartedAtRef.current;
      if (
        elapsed >= MAX_CLIP_MS ||
        (speechStartedRef.current && silentFor >= FULL_SILENCE_MS) ||
        (!speechStartedRef.current && elapsed >= ARM_TIMEOUT_MS)
      ) {
        finalizeRef.current(false);
      }
    }
  }, []);
  const handleFrameRef = useRef(handleFrame);
  handleFrameRef.current = handleFrame;

  // ── Open the mic ───────────────────────────────────────────────
  const openMic = useCallback(async () => {
    if (sessionRef.current || openingRef.current) return;
    openingRef.current = true;
    cancelledRef.current = false;
    chunksRef.current = [];
    speechStartedRef.current = false;
    lastSpeechAtRef.current = 0;
    specFiredRef.current = false;
    speechAfterSpecRef.current = false;
    specPromiseRef.current = null;
    specUttRef.current = null;
    firstFrameSeenRef.current = false;
    timingRef.current = emptyTiming();
    armRequestedAtRef.current = Date.now();
    setMicOpenMs(null);
    setState('opening'); // dim orb — the mic canNOT hear yet

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      // A suspended context (autoplay policy / live-tutor contention) never
      // fires onaudioprocess — the mic would look open but hear nothing.
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      sessionRef.current = { stream, ctx, source, processor };
      lastActivityAtRef.current = Date.now();
      processor.onaudioprocess = (e) => handleFrameRef.current(e);
      source.connect(processor);
      processor.connect(ctx.destination);
      // Still 'opening' — 'armed' + the ready earcon fire on the first frame.
    } catch (err) {
      console.warn('[useVoiceCapture] mic unavailable:', err);
      teardownMic();
      setState('idle');
      activeRef.current = false;
      setActive(false);
      if (!cancelledRef.current) o.current.onNoSpeech?.();
    } finally {
      openingRef.current = false;
    }
  }, [teardownMic]);
  openMicRef.current = openMic;

  // Turn loop: delayed re-open with budget enforcement (legacy shape).
  const scheduleArm = useCallback((delayMs: number) => {
    clearArmTimer();
    armTimerRef.current = window.setTimeout(() => {
      armTimerRef.current = null;
      if (o.current.modality !== 'turn' || !activeRef.current) return;
      if (sessionRef.current) return;
      if (capturesUsedRef.current >= MAX_AUTO_CAPTURES) {
        goDormantRef.current('budget');
        return;
      }
      capturesUsedRef.current += 1;
      setWindowsUsed(capturesUsedRef.current);
      void openMicRef.current();
    }, delayMs);
  }, [clearArmTimer]);
  scheduleArmRef.current = scheduleArm;

  // ── Public API ─────────────────────────────────────────────────

  const start = useCallback(() => {
    stopLatchRef.current = false;
    setDormant(false);
    setDormantReason(null);
    if (o.current.modality === 'ptt') {
      if (state !== 'idle') return;
      void openMic();
      return;
    }
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    noSpeechStreakRef.current = 0;
    capturesUsedRef.current = 0;
    setWindowsUsed(0);
    if (o.current.modality === 'turn') {
      scheduleArm(o.current.armDelayMs ?? DEFAULT_ARM_DELAY_MS);
    } else {
      void openMic();
    }
  }, [state, openMic, scheduleArm]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    stopLatchRef.current = true; // beats autoStart until a new activation
    clearArmTimer();
    specPromiseRef.current = null;
    specUttRef.current = null;
    chunksRef.current = [];
    speechStartedRef.current = false;
    pulseCountRef.current = 0;
    setInFlight(0);
    SoundManager.stopProcessing();
    const wasLive = !!sessionRef.current || activeRef.current;
    teardownMic();
    activeRef.current = false;
    setActive(false);
    setDormant(false);
    setDormantReason(null);
    setState('idle');
    if (wasLive) SoundManager.toggle(false);
  }, [clearArmTimer, teardownMic]);

  const resume = useCallback(() => {
    // A real tap refreshes the whole loop budget (dormancy recovery).
    setDormant(false);
    setDormantReason(null);
    noSpeechStreakRef.current = 0;
    if (o.current.modality === 'turn') {
      capturesUsedRef.current = 1;
      setWindowsUsed(1);
    }
    void openMic();
  }, [openMic]);

  // New activation (challenge advanced): clear the stop latch so autoStart
  // may fire again.
  useEffect(() => {
    stopLatchRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.activationKey]);

  // Session-level auto-listen switch: OFF suppresses auto-start and stops
  // any live ambient session. Explicit gestures stay allowed.
  const autoListenEnabled = useAutoListenEnabled();
  useEffect(() => {
    if (autoListenEnabled) return;
    if (o.current.modality === 'ptt') return;
    if (activeRef.current || sessionRef.current) stop();
  }, [autoListenEnabled, stop]);

  // Auto-start: only when the browser already holds a standing grant — the
  // permission dialog must never pop "by itself" — and only while the
  // global auto-listen switch is on.
  useEffect(() => {
    if (!options.autoStart || options.modality === 'ptt' || !autoListenEnabled) return;
    if (micPermission !== 'granted' || dormant || active) return;
    if (stopLatchRef.current) return;
    const t = window.setTimeout(() => {
      if (!stopLatchRef.current && !activeRef.current && !sessionRef.current) start();
    }, 150);
    return () => window.clearTimeout(t);
  }, [options.autoStart, options.modality, options.activationKey, micPermission, dormant, active, start, autoListenEnabled]);

  return {
    state,
    level,
    active,
    dormant,
    dormantReason,
    inFlight,
    micOpenMs,
    windowsUsed,
    isSupported,
    micPermission,
    start,
    stop,
    resume,
  };
}
