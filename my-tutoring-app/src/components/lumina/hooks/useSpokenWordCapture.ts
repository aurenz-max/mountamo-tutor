'use client';

/**
 * useSpokenWordCapture — spoken-production beat for literacy primitives.
 *
 * The student says a target word aloud; the hook captures a bounded clip
 * (RMS endpointing with speculative dispatch), runs the judge ladder
 * (Azure dual-signal → gemini-flash-latest, see utils/spokenWordJudge.ts),
 * and hands the primitive one SpokenJudgeResult.
 *
 * What the hook owns:
 *  - mic lifecycle + two-tier silence endpointing (250ms speculative
 *    snapshot while recording continues, 750ms full stop)
 *  - mechanical audio: snap() "heard you" ack + the sustained processing
 *    pulse until the FINAL verdict (both via SoundManager)
 *  - the ladder + asymmetric outcome mapping
 *
 * What the PRIMITIVE owns (see .claude/skills/add-spoken-judge):
 *  - when the beat is offered (push-to-talk button — never auto-listen)
 *  - verdict handling: 'match' → credit + playCorrect(); 'no-match' →
 *    tutor coaching, NO penalty; 'unclear' → silent fallback to the
 *    deterministic interaction. Never render a red X from this hook.
 *
 * Wiring: ~5 lines. const spoken = useSpokenWordCapture({ targetWord,
 * gradeLevel, onResult }); render a mic button on spoken.start when
 * spoken.isSupported, a level meter from spoken.level while listening.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundManager } from '../utils/SoundManager';
import { encodeWav16kMono, bytesToBase64 } from '../utils/wavEncode';
import {
  judgeSpokenWord,
  judgeClipOnce,
  ESCALATION_MODEL,
  type SpokenJudgeResult,
  type BlendJudgeVerdict,
} from '../utils/spokenWordJudge';

// Endpointing (bench-tuned in Blend Judge Lab, 2026-07-04)
const SPEECH_RMS_THRESHOLD = 0.015;
const SPECULATIVE_SILENCE_MS = 250;
const FULL_SILENCE_MS = 750;
const MAX_CLIP_MS = 6000;
const ARM_TIMEOUT_MS = 8000;

export type SpokenCaptureState = 'idle' | 'armed' | 'recording' | 'judging';

export interface UseSpokenWordCaptureOptions {
  /** The word the student should say. Read fresh at capture time. */
  targetWord: string;
  gradeLevel?: string;
  /** Fired exactly once per capture with the FINAL arbitrated result. */
  onResult: (result: SpokenJudgeResult) => void;
  /** Fired when no speech was detected before the arm timeout. */
  onNoSpeech?: () => void;
}

export interface SpokenWordCapture {
  state: SpokenCaptureState;
  /** Live RMS level (0..~0.15) for a mic meter while armed/recording. */
  level: number;
  /** False when the browser has no mic support — hide the beat entirely. */
  isSupported: boolean;
  /** Begin listening (call from a user gesture — push-to-talk). */
  start: () => Promise<void>;
  /** Abort listening/judging with no result callback. */
  cancel: () => void;
}

export function useSpokenWordCapture(options: UseSpokenWordCaptureOptions): SpokenWordCapture {
  const [state, setState] = useState<SpokenCaptureState>('idle');
  const [level, setLevel] = useState(0);

  // Options read through a ref so audio callbacks never see stale values.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speechStartedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const specFiredRef = useRef(false);
  const speechAfterSpecRef = useRef(false);
  const specPromiseRef = useRef<Promise<SpokenJudgeResult> | null>(null);
  const cancelledRef = useRef(false);

  const teardownMic = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      teardownMic();
      SoundManager.stopProcessing();
    },
    [teardownMic],
  );

  const encodeClip = useCallback((chunks: Float32Array[], sourceRate: number): string => {
    const { bytes } = encodeWav16kMono(chunks, sourceRate);
    return bytesToBase64(bytes);
  }, []);

  // Speculative first pass: Azure on the snapshot while the mic keeps rolling.
  const dispatchSpeculative = useCallback(() => {
    const snapshot = chunksRef.current.slice();
    const rate = audioCtxRef.current?.sampleRate ?? 48000;
    SoundManager.snap();
    SoundManager.startProcessing();
    const { targetWord, gradeLevel } = optionsRef.current;
    specPromiseRef.current = judgeSpokenWord(encodeClip(snapshot, rate), targetWord, gradeLevel)
      // judgeSpokenWord never throws, but keep the promise chain airtight.
      .catch(() => ({ outcome: 'unclear' as const, verdict: null, escalated: true }));
  }, [encodeClip]);

  const settle = useCallback((result: SpokenJudgeResult) => {
    SoundManager.stopProcessing();
    setState('idle');
    if (!cancelledRef.current) optionsRef.current.onResult(result);
  }, []);

  const finishRecording = useCallback(() => {
    const chunks = chunksRef.current;
    const sourceRate = audioCtxRef.current?.sampleRate ?? 48000;
    const hadSpeech = speechStartedRef.current;
    teardownMic();
    chunksRef.current = [];

    if (!hadSpeech || chunks.length === 0) {
      SoundManager.stopProcessing();
      setState('idle');
      if (!cancelledRef.current) optionsRef.current.onNoSpeech?.();
      return;
    }

    setState('judging');
    const { targetWord, gradeLevel } = optionsRef.current;

    void (async () => {
      const superseded = speechAfterSpecRef.current;
      if (specPromiseRef.current && !superseded) {
        // Same audio as the snapshot: the speculative ladder result IS the
        // answer (it already escalated internally if Azure was unsure).
        const spec = await specPromiseRef.current;
        specPromiseRef.current = null;
        settle(spec);
        return;
      }
      // Speech resumed after the snapshot (or spec never fired): the full
      // clip is the real utterance — run the ladder on it and ignore spec.
      specPromiseRef.current = null;
      if (!specFiredRef.current) {
        SoundManager.snap();
        SoundManager.startProcessing();
      }
      settle(await judgeSpokenWord(encodeClip(chunks, sourceRate), targetWord, gradeLevel));
    })();
  }, [teardownMic, encodeClip, settle]);

  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;
  const dispatchRef = useRef(dispatchSpeculative);
  dispatchRef.current = dispatchSpeculative;

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    cancelledRef.current = false;
    chunksRef.current = [];
    speechStartedRef.current = false;
    lastSpeechAtRef.current = 0;
    startedAtRef.current = Date.now();
    specFiredRef.current = false;
    speechAfterSpecRef.current = false;
    specPromiseRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      streamRef.current = stream;
      audioCtxRef.current = ctx;
      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));

        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms);

        const now = Date.now();
        if (rms > SPEECH_RMS_THRESHOLD) {
          if (!speechStartedRef.current) {
            speechStartedRef.current = true;
            setState('recording');
          }
          if (specFiredRef.current) speechAfterSpecRef.current = true;
          lastSpeechAtRef.current = now;
        }

        const elapsed = now - startedAtRef.current;
        const silentFor = speechStartedRef.current ? now - lastSpeechAtRef.current : 0;

        if (speechStartedRef.current && !specFiredRef.current && silentFor >= SPECULATIVE_SILENCE_MS) {
          specFiredRef.current = true;
          dispatchRef.current();
        }
        if (
          elapsed >= MAX_CLIP_MS ||
          (speechStartedRef.current && silentFor >= FULL_SILENCE_MS) ||
          (!speechStartedRef.current && elapsed >= ARM_TIMEOUT_MS)
        ) {
          finishRef.current();
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setState('armed');
    } catch (err) {
      console.warn('[useSpokenWordCapture] mic unavailable:', err);
      teardownMic();
      setState('idle');
      if (!cancelledRef.current) optionsRef.current.onNoSpeech?.();
    }
  }, [state, teardownMic]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    chunksRef.current = [];
    speechStartedRef.current = false;
    specPromiseRef.current = null;
    SoundManager.stopProcessing();
    teardownMic();
    setState('idle');
  }, [teardownMic]);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.AudioContext && navigator.mediaDevices?.getUserMedia);

  return { state, level, isSupported, start, cancel };
}

// Re-exports so primitives import everything from one place.
export type { SpokenJudgeResult, BlendJudgeVerdict };
export { judgeClipOnce, ESCALATION_MODEL };
