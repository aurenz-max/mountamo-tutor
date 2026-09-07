'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const NAMES = ['ay', 'bee', 'see', 'dee', 'ee', 'eff', 'jee', 'aitch', 'eye', 'jay', 'kay', 'ell', 'em', 'en', 'oh', 'pee', 'cue', 'ar', 'ess', 'tee', 'you', 'vee', 'double you', 'ex', 'why', 'zee'];

/** Browser speech is independent of the live tutor and never creates a visible transcript. */
export function useLetterWorkshopCue(challengeId: string, letter: string, letterCase: string) {
  const [state, setState] = useState<'idle' | 'speaking' | 'ready' | 'error'>('idle');
  const [plays, setPlays] = useState(0);
  const [stateForId, setStateForId] = useState(challengeId);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    const owned = utteranceRef.current;
    utteranceRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (owned) {
      owned.onend = null; owned.onerror = null;
      window.speechSynthesis?.cancel();
    }
  }, []);
  useEffect(() => { cancel(); setState('idle'); setPlays(0); return cancel; }, [challengeId, cancel]);

  const play = useCallback(() => {
    cancel();
    setStateForId(challengeId);
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') { setState('error'); return; }
    const name = NAMES[letter.toLowerCase().charCodeAt(0) - 97];
    const utterance = new SpeechSynthesisUtterance(`Write the ${letterCase} letter ${name}.`);
    utterance.lang = 'en-US'; utterance.rate = 0.8;
    utteranceRef.current = utterance;
    setState('speaking');
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPlays(value => value + 1); setState('ready');
    };
    utterance.onerror = () => { if (utteranceRef.current === utterance) { cancel(); setState('error'); } };
    timeoutRef.current = setTimeout(() => { if (utteranceRef.current === utterance) { cancel(); setState('error'); } }, 20000);
    try { window.speechSynthesis.speak(utterance); } catch { cancel(); setState('error'); }
  }, [cancel, challengeId, letter, letterCase]);
  return { state: stateForId === challengeId ? state : 'idle' as const, plays: stateForId === challengeId ? plays : 0, play, cancel };
}
