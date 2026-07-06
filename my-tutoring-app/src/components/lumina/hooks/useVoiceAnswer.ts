'use client';

/**
 * useVoiceAnswer — spoken PRODUCTION controller on the useVoiceCapture
 * engine. The student says a target word; the Azure→Gemini ladder judges it;
 * the primitive gets one asymmetric SpokenJudgeResult per utterance.
 *
 * This is the successor to useSpokenTurn (deprecated window loop): open-mic
 * persistence instead of windowed re-arm — while `active`, the mic is simply
 * hot; utterances are segmented continuously; there are no silence strikes,
 * no re-arm cooldowns, no per-window dormancy taps. The only bounds are the
 * engine's: explicit stop, 60s walked-away close, and the global auto-listen
 * switch (utils/voiceMode — enforced by the engine, honored automatically).
 *
 * Drop-in shape: returns { state, level, isSupported, dormant, startManual,
 * cancel } exactly like useSpokenTurn, so migrating a consumer is mostly
 * swapping the import and deleting `mode`.
 *
 * Stale-verdict guard: the target word is FROZEN into each utterance at
 * capture time. If a verdict lands after the challenge advanced (or after
 * `active` flipped off), it is dropped — a match for word N can never credit
 * word N+1. This is what makes it safe to keep the mic hot across the
 * tail of a challenge.
 *
 * Lifecycle: `active` true → auto-opens (first mic use in a session still
 * needs a real gesture — the engine's permission gate handles that; render
 * the dormant orb as the gesture). `active` false → stops. A new
 * `targetWord` is a new activation.
 *
 * The PROMPT LAW and quiet-tutor discipline from useSpokenTurn carry over
 * unchanged (see .claude/skills/add-spoken-judge — Design Themes).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useVoiceCapture,
  type CapturedUtterance,
  type VoiceCapture,
  type VoiceCaptureState,
  type VoiceJudgePass,
  type VoiceModality,
} from './useVoiceCapture';
import {
  judgeClipOnce,
  judgeSpokenWord,
  verdictToOutcome,
  ESCALATION_MODEL,
  type BlendJudgeVerdict,
  type SpokenJudgeResult,
} from '../utils/spokenWordJudge';

interface AnswerContext {
  word: string;
}

export interface UseVoiceAnswerOptions {
  /** The word the student should say. Read fresh at capture time; a change is a new activation. */
  targetWord: string;
  gradeLevel?: string;
  /** True while the primitive wants a spoken answer for the CURRENT challenge. */
  active: boolean;
  /** Default 'open' (the native shape). 'ptt' for a tap-gated single word. */
  modality?: VoiceModality;
  /** Default true: open the mic without a button once a standing grant exists. */
  autoStart?: boolean;
  onResult: (result: SpokenJudgeResult) => void;
  onNoSpeech?: () => void;
}

export interface VoiceAnswer {
  state: VoiceCaptureState;
  level: number;
  isSupported: boolean;
  /** Engine dormancy (walked-away close) — render the tap-to-talk orb. */
  dormant: boolean;
  /** Manual arm — the recovery gesture, and the first-grant gesture. */
  startManual: () => void;
  /** Stop listening until the next activation or a manual gesture. */
  cancel: () => void;
  /** Full engine handle for anything beyond the drop-in surface. */
  voice: VoiceCapture;
}

export function useVoiceAnswer(options: UseVoiceAnswerOptions): VoiceAnswer {
  const o = useRef(options);
  o.current = options;

  // The student tapped ✕ stop: stay visibly stopped (tap-to-talk orb) until
  // a manual tap or the next activation. Without this the orb would keep its
  // live surface over a closed mic — the exact "looks like it's listening
  // but isn't" lie the timing doctrine forbids.
  const [stopped, setStopped] = useState(false);

  const judge = useCallback(
    async (utt: CapturedUtterance<AnswerContext>, pass: VoiceJudgePass): Promise<BlendJudgeVerdict | null> => {
      const gradeLevel = o.current.gradeLevel;
      try {
        if (pass === 'spec') {
          return await judgeClipOnce(utt.base64, utt.context.word, { gradeLevel });
        }
        if (pass === 'escalate') {
          return await judgeClipOnce(utt.base64, utt.context.word, { gradeLevel, model: ESCALATION_MODEL });
        }
        return (await judgeSpokenWord(utt.base64, utt.context.word, gradeLevel)).verdict;
      } catch (err) {
        console.warn('[useVoiceAnswer] judge failed:', err);
        return null;
      }
    },
    [],
  );

  const onSettle = useCallback((verdict: BlendJudgeVerdict | null, utt: CapturedUtterance<AnswerContext>) => {
    const opts = o.current;
    if (!opts.active) return; // challenge already resolved — drop
    if (utt.context.word !== opts.targetWord.toLowerCase().trim()) return; // stale challenge — drop
    opts.onResult({
      outcome: verdictToOutcome(verdict),
      verdict,
      escalated: verdict ? !verdict.model.startsWith('azure') : true,
    });
  }, []);

  const onNoSpeech = useCallback(() => {
    if (o.current.active) o.current.onNoSpeech?.();
  }, []);

  const voice = useVoiceCapture<BlendJudgeVerdict, AnswerContext>({
    modality: options.modality ?? 'open',
    getContext: () => ({ word: o.current.targetWord.toLowerCase().trim() }),
    judge,
    isConfident: (v) => v.confidence === 'high',
    onSettle,
    onNoSpeech,
    autoStart: (options.autoStart ?? true) && options.active,
    activationKey: `answer:${options.targetWord.toLowerCase().trim()}`,
  });

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // Deactivation closes the mic; the next activation auto-opens it (during
  // the celebration beat, so the reopen is imperceptible).
  useEffect(() => {
    if (!options.active) voiceRef.current.stop();
  }, [options.active]);

  // A new activation (challenge advanced / re-activated) clears a prior stop.
  useEffect(() => {
    if (options.active) setStopped(false);
  }, [options.active, options.targetWord]);

  const startManual = useCallback(() => {
    if (!o.current.active) return;
    setStopped(false);
    if (voiceRef.current.dormant) voiceRef.current.resume();
    else voiceRef.current.start();
  }, []);

  const cancel = useCallback(() => {
    setStopped(true);
    voiceRef.current.stop();
  }, []);

  // Honest dormancy for the orb: show the tap-to-talk button whenever the
  // mic is truly closed and won't imminently self-open — engine dormancy,
  // a student stop, or no standing mic grant yet (the first-ever session:
  // the tap doubles as the permission-prompt gesture, since auto-start
  // never pops the dialog by itself).
  const dormant =
    voice.dormant ||
    stopped ||
    (voice.state === 'idle' && voice.micPermission !== 'granted');

  return {
    state: voice.state,
    level: voice.level,
    isSupported: voice.isSupported,
    dormant,
    startManual,
    cancel,
    voice,
  };
}

export type { SpokenJudgeResult };
