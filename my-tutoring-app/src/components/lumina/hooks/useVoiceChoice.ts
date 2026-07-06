'use client';

/**
 * useVoiceChoice — spoken CHOICE controller on the useVoiceCapture engine.
 *
 * The universal "say an option to select it" layer for MCQ-shaped
 * primitives: give it the answerable units (each = correct answer + on-screen
 * options), and it runs the whole voice-control loop — targeting, judging,
 * actuation policy, grading, focus advance — handing back plain state to
 * paint onto YOUR existing buttons. A primitive's wiring is ~25-40 lines:
 *
 *   const choice = useVoiceChoice({ items, onSubmit });
 *   // per unit i: <LuminaVoiceTarget active={i === choice.focusIdx} …>
 *   // per option w: highlight if choice.highlight matches, submitted state
 *   //   from choice.answers[i], onClick={() => choice.tapOption(i, w)}
 *   // plus a LuminaMicListener fed from choice.voice
 *
 * Doctrine baked in (see .claude/skills/add-spoken-judge — Design Themes):
 *  - the judge identifies WHICH option; grading happens here, client-side —
 *    the correct answer is never sent;
 *  - actuation levers: actOn ('high' | 'any') and voiceAction ('submit' |
 *    'highlight'), with the degrade rule — low confidence under 'high'
 *    degrades submit → highlight ("heard you?" + tap confirms). Voice never
 *    silently no-ops when something was heard (`note` says what WAS heard);
 *  - targeting: voice answers route to the FOCUSED unit, frozen into the
 *    utterance at capture time, so a late verdict never lands on the wrong
 *    board; tap-to-target via focusItem(); correct → focus auto-advances;
 *  - taps and voice actuate the same controls (tapOption submits directly);
 *  - open-mic persistence, honest cue timing, and the global auto-listen
 *    switch all come from the engine.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundManager } from '../utils/SoundManager';
import {
  useVoiceCapture,
  type CapturedUtterance,
  type VoiceCapture,
  type VoiceJudgePass,
  type VoiceModality,
} from './useVoiceCapture';
import {
  judgeChoiceClipOnce,
  judgeSpokenChoice,
  ESCALATION_MODEL,
} from '../utils/spokenWordJudge';

export interface VoiceChoiceItem {
  /** The correct option (grading key — never sent to the judge). */
  answer: string;
  /** The options on screen for this unit. */
  options: string[];
}

/** Minimal verdict the controller needs; judge overrides map onto this. */
export interface SpokenChoiceVerdict {
  heard: string;
  selectedOption: string | null;
  confidence: 'high' | 'low';
}

export interface VoiceChoiceContext {
  idx: number;
  answer: string;
  options: string[];
}

export interface UseVoiceChoiceOptions {
  items: VoiceChoiceItem[];
  /** Default 'open' — the native shape. */
  modality?: VoiceModality;
  /** Actuate only on high-confidence selections (default), or any match. */
  actOn?: 'high' | 'any';
  /** Voice submits the answer (default), or only highlights for a tap-confirm. */
  voiceAction?: 'submit' | 'highlight';
  /** Default true: open the mic without a button once a standing grant exists. */
  autoStart?: boolean;
  /** Default true. False = queue visible but voice/actuation paused. */
  active?: boolean;
  gradeLevel?: string;
  /** Replace the default Azure→Gemini ladder (the studio injects benched models). */
  judge?: (utt: CapturedUtterance<VoiceChoiceContext>, pass: VoiceJudgePass) => Promise<SpokenChoiceVerdict | null>;
  /** After any submission (voice or tap). */
  onSubmit?: (idx: number, word: string, correct: boolean) => void;
  /** Every unit answered correctly. Fires once per queue. */
  onQueueComplete?: () => void;
  /** Raw verdict + utterance, post-actuation — benching/telemetry. */
  onVerdict?: (verdict: SpokenChoiceVerdict | null, utt: CapturedUtterance<VoiceChoiceContext>) => void;
  /** Legacy turn-loop tunables (comparison benches only). */
  armDelayMs?: number;
  cooldownMs?: number;
}

export interface VoiceChoiceController {
  focusIdx: number;
  /** Per-unit submission (null = unanswered). */
  answers: Array<{ word: string; correct: boolean } | null>;
  allSolved: boolean;
  /** Option armed by voice, awaiting tap-confirm. */
  highlight: { idx: number; word: string } | null;
  /** Status copy ("Heard X — tap to confirm", "that isn't an option"…). */
  note: string;
  /** Engine handle — feed LuminaMicListener / CaptureSurface from this. */
  voice: VoiceCapture;
  /** Native tap: submits `word` as the answer to unit `idx`. */
  tapOption: (idx: number, word: string) => void;
  /** Tap-to-target an unsolved unit. */
  focusItem: (idx: number) => void;
  /** Clear submissions + focus (play again / new content). */
  reset: () => void;
}

export function useVoiceChoice(options: UseVoiceChoiceOptions): VoiceChoiceController {
  const o = useRef(options);
  o.current = options;

  const [focusIdx, setFocusIdx] = useState(0);
  const [answers, setAnswers] = useState<Array<{ word: string; correct: boolean } | null>>(
    () => options.items.map(() => null),
  );
  const [highlight, setHighlight] = useState<{ idx: number; word: string } | null>(null);
  const [note, setNote] = useState('');

  const focusIdxRef = useRef(0);
  const answersRef = useRef(answers);
  const allSolvedRef = useRef(false);
  const voiceRef = useRef<VoiceCapture | null>(null);

  const itemsKey = useMemo(
    () => options.items.map((i) => `${i.answer}:${i.options.join(',')}`).join('|'),
    [options.items],
  );

  const reset = useCallback(() => {
    const blank = o.current.items.map(() => null);
    answersRef.current = blank;
    setAnswers(blank);
    allSolvedRef.current = false;
    focusIdxRef.current = 0;
    setFocusIdx(0);
    setHighlight(null);
    setNote('');
  }, []);

  // New content = new queue.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  /** Submit `word` to unit `idx` — the ONE path for voice and tap alike. */
  const submitAt = useCallback((idx: number, word: string): boolean => {
    const item = o.current.items[idx];
    if (!item || answersRef.current[idx]?.correct) return false;
    const correct = word === item.answer;
    const next = answersRef.current.map((a, i) => (i === idx ? { word, correct } : a));
    answersRef.current = next;
    setAnswers(next);
    setHighlight(null);
    if (correct) {
      SoundManager.playCorrect();
      const nextIdx = next.findIndex((a) => !a?.correct);
      if (nextIdx === -1) {
        allSolvedRef.current = true;
        setNote('');
        // Queue cleared completes a turn activation; an open mic stays hot.
        if (o.current.modality === 'turn') voiceRef.current?.stop();
        o.current.onQueueComplete?.();
      } else {
        focusIdxRef.current = nextIdx;
        setFocusIdx(nextIdx);
        setNote('');
      }
    } else {
      SoundManager.playIncorrect();
      focusIdxRef.current = idx;
      setFocusIdx(idx);
    }
    o.current.onSubmit?.(idx, word, correct);
    return correct;
  }, []);

  // Actuation policy — the levers live here. Never a silent no-op when
  // something was heard.
  const actuate = useCallback((verdict: SpokenChoiceVerdict | null, idx: number) => {
    if (!verdict) {
      SoundManager.invalid();
      setNote('Judge error — try again.');
      return;
    }
    if (answersRef.current[idx]?.correct) {
      SoundManager.tick(); // late verdict on an already-solved unit
      return;
    }
    const sel = verdict.selectedOption;
    if (!sel) {
      SoundManager.tick();
      setNote(
        verdict.heard
          ? `Heard “${verdict.heard}” — that isn't one of the options.`
          : 'Could not make that out — say one of the options.',
      );
      return;
    }
    const confident = (o.current.actOn ?? 'high') === 'any' || verdict.confidence === 'high';
    if (!confident || (o.current.voiceAction ?? 'submit') === 'highlight') {
      setHighlight({ idx, word: sel });
      SoundManager.select();
      setNote(
        confident
          ? `Heard “${sel}” — tap it to confirm.`
          : `Maybe “${sel}”? Tap to confirm, or say it again.`,
      );
      return;
    }
    setNote('');
    submitAt(idx, sel);
  }, [submitAt]);

  // Default judge: the production Azure→Gemini choice ladder.
  const defaultJudge = useCallback(
    async (utt: CapturedUtterance<VoiceChoiceContext>, pass: VoiceJudgePass): Promise<SpokenChoiceVerdict | null> => {
      const gradeLevel = o.current.gradeLevel;
      try {
        if (pass === 'spec') {
          return await judgeChoiceClipOnce(utt.base64, utt.context.options, { gradeLevel });
        }
        if (pass === 'escalate') {
          return await judgeChoiceClipOnce(utt.base64, utt.context.options, { gradeLevel, model: ESCALATION_MODEL });
        }
        return await judgeSpokenChoice(utt.base64, utt.context.options, gradeLevel);
      } catch (err) {
        console.warn('[useVoiceChoice] judge failed:', err);
        return null;
      }
    },
    [],
  );

  const judge = useCallback(
    (utt: CapturedUtterance<VoiceChoiceContext>, pass: VoiceJudgePass) =>
      (o.current.judge ?? defaultJudge)(utt, pass),
    [defaultJudge],
  );

  const onSettle = useCallback(
    (verdict: SpokenChoiceVerdict | null, utt: CapturedUtterance<VoiceChoiceContext>) => {
      if (o.current.active !== false) actuate(verdict, utt.context.idx);
      o.current.onVerdict?.(verdict, utt);
    },
    [actuate],
  );

  const voice = useVoiceCapture<SpokenChoiceVerdict, VoiceChoiceContext>({
    modality: options.modality ?? 'open',
    getContext: () => {
      const idx = focusIdxRef.current;
      const item = o.current.items[idx] ?? { answer: '', options: [] };
      return { idx, answer: item.answer, options: item.options };
    },
    judge,
    isConfident: (v) => v.confidence === 'high',
    onSettle,
    autoStart: (options.autoStart ?? true) && options.active !== false && options.items.length > 0,
    activationKey: `choice:${itemsKey}`,
    armDelayMs: options.armDelayMs,
    cooldownMs: options.cooldownMs,
  });
  voiceRef.current = voice;

  useEffect(() => {
    if (options.active === false) voiceRef.current?.stop();
  }, [options.active]);

  const tapOption = useCallback(
    (idx: number, word: string) => {
      submitAt(idx, word);
    },
    [submitAt],
  );

  const focusItem = useCallback((idx: number) => {
    if (answersRef.current[idx]?.correct) return;
    focusIdxRef.current = idx;
    setFocusIdx(idx);
    setHighlight(null);
  }, []);

  const allSolved = answers.length > 0 && answers.every((a) => a?.correct);

  return { focusIdx, answers, allSolved, highlight, note, voice, tapOption, focusItem, reset };
}
