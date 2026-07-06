'use client';

/**
 * useSpokenTurn — conversational spoken-answer orchestration.
 *
 * ⚠ DEPRECATED (user ruling 2026-07-05, memory `open-mic-over-turn-windows`):
 * the windowed re-arm shape below (arm timeouts, silence strikes, dormancy
 * taps) is legacy — it surfaces "tap the orb when ready" friction and pays a
 * cold mic re-open per window, while an open mic costs nothing during
 * silence. DO NOT build new consumers on this hook. New always-listening
 * work uses hooks/useVoiceCapture with modality 'open'. This file survives
 * only until PictureVocabulary (its sole consumer) migrates.
 *
 * Wraps useSpokenWordCapture so a primitive can run the natural
 * parent-child turn shape WITHOUT a per-item button press:
 *
 *   challenge activates → mic opens (visible listening state)
 *     → VAD endpointing captures an utterance → judge ladder → onResult
 *     → not a match → short cooldown → mic re-opens automatically
 *     → nothing said before the arm timeout → onNoSpeech → one more
 *       window, then DORMANT (manual mic button) so an empty room is
 *       never recorded indefinitely
 *
 * The mic is deliberately DECOUPLED from tutor state — isAIResponding /
 * isAudioPlaying are not inputs. A missed student utterance is a worse
 * failure than the tutor bleeding into an open mic, because the safety
 * rails make tutor pickup cheap:
 *   (a) asymmetric grading — a spurious capture can only land as
 *       no-match/unclear, which never scores against the student;
 *   (b) the PROMPT LAW below — the elicitation never contains the target
 *       word, so tutor bleed cannot false-match;
 *   (c) capture uses echoCancellation, so on most devices the tutor's
 *       own output never reaches the clip anyway.
 *
 * Modes:
 *  - 'auto' (voice activity, Discord-style default): always-listening
 *    loop while `active`, bounded by the dormancy policy below.
 *  - 'ptt' (push-to-talk fallback): never auto-arms; the primitive
 *    renders a mic button wired to startManual().
 *
 * PROMPT LAW (non-negotiable for 'auto' consumers): the tutor elicitation
 * for a spoken turn must never contain the target word — the mic is open
 * WHILE the tutor speaks. "What animal is this?" cannot false-match "cat"
 * even if it bleeds into the mic. Beats where the tutor MODELS the target
 * word (echo/blend beats) must use 'ptt'.
 *
 * Dormancy policy (bounds open-mic loops and judge-API spend):
 *  - MAX_NO_SPEECH_STREAK consecutive silent windows → dormant
 *  - MAX_AUTO_CAPTURES judge calls in one activation → dormant
 *  - cancel() → dormant
 * Dormant renders as the manual mic button; startManual() (a real user
 * gesture) resets the budget and resumes the loop. A new activation
 * (active/targetWord change) resets everything.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSpokenWordCapture,
  type SpokenJudgeResult,
  type SpokenCaptureState,
} from './useSpokenWordCapture';

/** Pause after activation before the mic first opens — lets the new challenge render. */
const ACTIVATION_ARM_DELAY_MS = 300;
/** Pause between a settled capture and the automatic re-arm. */
const REARM_COOLDOWN_MS = 400;
/** Consecutive no-speech windows before going dormant (each window is the capture's arm timeout). */
const MAX_NO_SPEECH_STREAK = 2;
/** Judge calls allowed per activation before requiring a manual gesture — noisy-room spend bound. */
const MAX_AUTO_CAPTURES = 8;

export type SpokenTurnMode = 'auto' | 'ptt';

export interface UseSpokenTurnOptions {
  /** The word the student should say. Read fresh at capture time. */
  targetWord: string;
  gradeLevel?: string;
  /**
   * True while the primitive wants a spoken answer for the CURRENT challenge
   * (e.g. challenge visible, not yet answered). Flipping false cancels any
   * live capture.
   */
  active: boolean;
  mode: SpokenTurnMode;
  onResult: (result: SpokenJudgeResult) => void;
  onNoSpeech?: () => void;
}

export interface SpokenTurn {
  /** Capture state passthrough: idle | armed | recording | judging. */
  state: SpokenCaptureState;
  /** Live RMS level for the listening indicator. */
  level: number;
  isSupported: boolean;
  /**
   * True when the auto-listening loop has stopped (silence streak, capture
   * cap, or cancel) and a manual gesture is required to resume. Render the
   * mic button when dormant.
   */
  dormant: boolean;
  /** Manual arm — the PTT path, and the recovery gesture out of dormancy. */
  startManual: () => void;
  /** Stop listening until the next challenge or a manual gesture. */
  cancel: () => void;
}

export function useSpokenTurn(options: UseSpokenTurnOptions): SpokenTurn {
  const [dormant, setDormant] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const noSpeechStreakRef = useRef(0);
  const capturesUsedRef = useRef(0);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearArmTimer = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  // Set after capture is created below; the arm timer and the result
  // wrappers only run post-render, so the ref is always current by then.
  const captureRef = useRef<ReturnType<typeof useSpokenWordCapture> | null>(null);

  const scheduleArm = useCallback((delayMs: number) => {
    clearArmTimer();
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      const opts = optionsRef.current;
      const cap = captureRef.current;
      if (!cap || !opts.active || opts.mode !== 'auto') return;
      if (cap.state !== 'idle') return;
      if (capturesUsedRef.current >= MAX_AUTO_CAPTURES) {
        setDormant(true);
        return;
      }
      capturesUsedRef.current += 1;
      void cap.start();
    }, delayMs);
  }, [clearArmTimer]);

  // Wrap the primitive's callbacks to drive the re-arm loop.
  const handleResult = useCallback((result: SpokenJudgeResult) => {
    optionsRef.current.onResult(result);
    noSpeechStreakRef.current = 0;
    // A match ends the turn (the primitive flips `active` off); anything
    // else keeps the conversation open — listen again after a beat.
    if (result.outcome !== 'match') scheduleArm(REARM_COOLDOWN_MS);
  }, [scheduleArm]);

  const handleNoSpeech = useCallback(() => {
    optionsRef.current.onNoSpeech?.();
    if (optionsRef.current.mode !== 'auto') return;
    noSpeechStreakRef.current += 1;
    if (noSpeechStreakRef.current >= MAX_NO_SPEECH_STREAK) {
      setDormant(true);
    } else {
      scheduleArm(REARM_COOLDOWN_MS);
    }
  }, [scheduleArm]);

  const capture = useSpokenWordCapture({
    targetWord: options.targetWord,
    gradeLevel: options.gradeLevel,
    onResult: handleResult,
    onNoSpeech: handleNoSpeech,
  });
  captureRef.current = capture;

  // (Re)activation: reset the loop budget and open the mic; deactivation
  // cancels any live capture.
  useEffect(() => {
    if (options.active && options.mode === 'auto') {
      noSpeechStreakRef.current = 0;
      capturesUsedRef.current = 0;
      setDormant(false);
      scheduleArm(ACTIVATION_ARM_DELAY_MS);
      return clearArmTimer;
    }
    clearArmTimer();
    captureRef.current?.cancel();
    setDormant(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.active, options.mode, options.targetWord]);

  const startManual = useCallback(() => {
    const cap = captureRef.current;
    if (!optionsRef.current.active || !cap || cap.state !== 'idle') return;
    // A real user gesture refreshes the whole auto budget.
    noSpeechStreakRef.current = 0;
    capturesUsedRef.current = 0;
    setDormant(false);
    clearArmTimer();
    void cap.start();
  }, [clearArmTimer]);

  const cancel = useCallback(() => {
    clearArmTimer();
    captureRef.current?.cancel();
    // In auto mode a cancel means "stop listening to me" — stay quiet until
    // a manual gesture or the next challenge resets the loop.
    setDormant(true);
  }, [clearArmTimer]);

  return {
    state: capture.state,
    level: capture.level,
    isSupported: capture.isSupported,
    dormant,
    startManual,
    cancel,
  };
}

export type { SpokenJudgeResult };
