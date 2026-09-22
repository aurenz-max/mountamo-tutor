'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const NAMES = ['ay', 'bee', 'see', 'dee', 'ee', 'eff', 'jee', 'aitch', 'eye', 'jay', 'kay', 'ell', 'em', 'en', 'oh', 'pee', 'cue', 'ar', 'ess', 'tee', 'you', 'vee', 'double you', 'ex', 'why', 'zee'];

export type LetterCueState = 'idle' | 'speaking' | 'ready' | 'error';

/**
 * The Gemini Live tutor speaks the letter name. The target stays `withheld` in
 * the tutor's context; this one private turn is the only place it is named.
 * The capital glyph is what the tutor reads as a letter NAME; the spelled name
 * pins the pronunciation so it never says the letter's sound.
 */
export function letterNameCue(letter: string, letterCase: string): string {
  const glyph = letter.toUpperCase();
  const name = NAMES[letter.toLowerCase().charCodeAt(0) - 97];
  const Case = letterCase.charAt(0).toUpperCase() + letterCase.slice(1);
  return `[SAY_LETTER] Say exactly this and nothing else: "Write the ${letterCase} letter ${glyph}. ${Case} ${glyph}." `
    + `${glyph} is the letter's NAME, pronounced "${name}". Do not say its sound, a word that starts with it, `
    + `or anything about its shape or strokes. This is not an attempt to judge. Then stay silent while the child writes.`;
}

/**
 * Readiness follows the tutor's audio (fed in through `observeAudio`): the first
 * audio after the cue is sent is the cue, and the paper opens once that audio has
 * been quiet for 500 ms (the playback flag can dip between streamed chunks). No
 * audio within 10 s is an error the child can retry; a playback flag stuck on for
 * 20 s opens the paper anyway.
 */
export function useLetterWorkshopCue(challengeId: string, letter: string, letterCase: string) {
  const [state, setState] = useState<LetterCueState>('idle');
  const [plays, setPlays] = useState(0);
  const [stateForId, setStateForId] = useState(challengeId);
  const phaseRef = useRef<'off' | 'awaiting' | 'playing'>('off');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  const cancel = useCallback(() => { phaseRef.current = 'off'; clearTimer(); }, []);
  useEffect(() => { cancel(); setState('idle'); setPlays(0); return cancel; }, [challengeId, cancel]);

  const finish = useCallback(() => {
    phaseRef.current = 'off'; clearTimer();
    setPlays(value => value + 1); setState('ready');
  }, []);

  /** `send` is the live tutor's silent sendText, or null when no tutor holds this block. */
  const play = useCallback((send: ((text: string) => void) | null) => {
    cancel();
    setStateForId(challengeId);
    if (!send) { setState('error'); return; }
    phaseRef.current = 'awaiting';
    setState('speaking');
    send(letterNameCue(letter, letterCase));
    timerRef.current = setTimeout(() => {
      if (phaseRef.current === 'awaiting') { phaseRef.current = 'off'; timerRef.current = null; setState('error'); }
    }, 10000);
  }, [cancel, challengeId, letter, letterCase]);

  const observeAudio = useCallback((audioPlaying: boolean) => {
    if (phaseRef.current === 'awaiting' && audioPlaying) phaseRef.current = 'playing';
    else if (phaseRef.current !== 'playing') return;
    clearTimer();
    timerRef.current = setTimeout(finish, audioPlaying ? 20000 : 500);
  }, [finish]);

  return { state: stateForId === challengeId ? state : 'idle' as const, plays: stateForId === challengeId ? plays : 0, play, cancel, observeAudio };
}
