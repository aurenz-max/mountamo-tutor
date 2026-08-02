'use client';

/**
 * useDiPostRunDisconnect — (iii-a) of the DI stall slice: in the STANDALONE
 * tester path, close the Live session once the run is truly over, removing the
 * trigger for the post-run GoAway flap (observed 07-27: 4× GoAway → resume →
 * instant re-GoAway on an idle session until the client disconnected).
 *
 * "Truly over" is sequenced, not guessed: submit has fired, the closing cue
 * ([DI_COMPLETE] / final [DI_MOVE_ON]) has actually been SENT (it lands ~3s
 * post-submit), its recap audio has risen and FALLEN, and the disconnect floor
 * has passed the 6s deduped tail re-flush. A ceiling covers the session that
 * is already dead at run end (no recap will ever come).
 *
 * Lesson mode is untouched: there the session outlives any one primitive, and
 * `weConnected` is false so this hook never acts.
 */

import { useEffect, useRef } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { CueLogEvent } from '../../../hooks/useJudgedSpeechLoop';
import { logDiStage } from './diRunLog';

/** Floor: outlives the 6s run-end tail re-flush and the ~3s recap-cue lag. */
const POST_RUN_MIN_MS = 7_000;
/** Ceiling: the recap never came (cue dropped, or the session is dead). */
const POST_RUN_MAX_MS = 20_000;
const POLL_MS = 500;

export interface DiPostRunDisconnect {
  /** Feed every CueLogEvent through this (alongside logDiCue) so the hook can
   *  see the closing cue go out after submit. */
  noteCue: (event: CueLogEvent) => void;
}

export function useDiPostRunDisconnect(options: {
  /** The pack's run-is-over state (phase === 'done'). */
  done: boolean;
  /** The pack's "this component opened the connection" latch — true only on
   *  the standalone tester path. */
  weConnectedRef: React.MutableRefObject<boolean>;
}): DiPostRunDisconnect {
  const ctx = useLuminaAIContext();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const audioRef = useRef(ctx.isAudioPlaying);
  audioRef.current = ctx.isAudioPlaying;
  const doneRef = useRef(options.done);
  doneRef.current = options.done;

  /** The closing cue went out after the run ended. */
  const finalCueSentRef = useRef(false);
  /** …and its audio has been heard rising. */
  const finalAudioRoseRef = useRef(false);

  const noteCue = useRef((event: CueLogEvent) => {
    if (doneRef.current && event.phase === 'sent') finalCueSentRef.current = true;
  }).current;

  useEffect(() => {
    if (!options.done || !options.weConnectedRef.current) return;
    finalCueSentRef.current = false;
    finalAudioRoseRef.current = false;
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      if (finalCueSentRef.current && audioRef.current) finalAudioRoseRef.current = true;
      const elapsed = performance.now() - startedAt;
      const recapDone = finalAudioRoseRef.current && !audioRef.current;
      if (elapsed < POST_RUN_MAX_MS && !(elapsed >= POST_RUN_MIN_MS && recapDone)) return;
      window.clearInterval(interval);
      logDiStage(
        'post-run-disconnect',
        `standalone run complete — closing the Live session (${recapDone ? 'recap played' : 'ceiling reached'})`,
      );
      ctxRef.current.stopListening();
      ctxRef.current.disconnect();
    }, POLL_MS);
    return () => window.clearInterval(interval);
    // Refs cover the rest; the effect keys on the run actually ending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.done]);

  return { noteCue };
}
