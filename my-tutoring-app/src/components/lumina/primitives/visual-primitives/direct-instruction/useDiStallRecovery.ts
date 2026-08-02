'use client';

/**
 * useDiStallRecovery — the pack-side half of the DI session-liveness ladder
 * (BACKLOG item 5). The ENGINE detects (dead cues → 'session-dead' emission);
 * this hook owns the pack's RESPONSE, shared by all four packs:
 *
 *  - Level 2: first 'session-dead' on an item → warm transport reconnect via
 *    `ctx.reconnect()` (the stashed Gemini handle resumes the conversation;
 *    the mic and audio service are kept — `disconnect()` would destroy them,
 *    and recovery must never force-mute). The server's `session_resumed` then
 *    bumps `sessionResumeCount`, the engine emits 'session-resumed', and the
 *    pack's resync branch re-cues the current item: the ladder CONVERGES on
 *    the resume path.
 *  - Level 3: recovery failed — a second 'session-dead' on the same item, no
 *    resume signal inside the grace window (covers the backend's cold retry,
 *    which never sends session_resumed), or `sessionEnded` while running —
 *    `stalled` flips true. The pack renders DiStallCard (visible state, never
 *    a silent "Listening…") and `flushDiRunLog('stall')` uploads the run
 *    artifact AT the failure, not only at teardown.
 *
 * Nothing here touches the mic (open-mic doctrine: no force-mutes from the
 * primitive) and nothing here sends cue text (cues are hand-authored DI
 * pedagogy owned by the pack; re-cueing runs through the pack's own
 * resync/session-resumed branch).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { flushDiRunLog, logDiStage } from './diRunLog';

/** How long after a level-2 reconnect the resume signal may take before the
 *  recovery is declared failed. Generous: WS connect + Gemini connect +
 *  session_resumed is normally ~2-4s. */
const RECONNECT_GRACE_MS = 12_000;

export interface DiStallRecoveryOptions {
  /** The pack's run-active state — recovery only acts mid-run. */
  running: boolean;
  /** Stable getter for the current item id (episode scoping: two dead
   *  sessions on ONE item = the reconnect did not recover). */
  currentItemId: () => string | null;
  /** The pack's child-facing status line writer. Never spoken — status lines
   *  are display-only in this family. */
  onStatus: (line: string) => void;
}

export interface DiStallRecovery {
  /** Level 3 is showing — render DiStallCard in place of the stage. */
  stalled: boolean;
  /** Call from the 'session-dead' emission case. */
  noteDead: () => void;
  /** Call from the 'session-resumed' emission case (before re-cueing). */
  noteResumed: () => void;
  /** DiStallCard tap: reconnect-and-re-cue, back through the same ladder. */
  retry: () => void;
  /** New-run reset — call from startRun with the other per-run latches. */
  reset: () => void;
}

export function useDiStallRecovery(options: DiStallRecoveryOptions): DiStallRecovery {
  const ctx = useLuminaAIContext();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [stalled, setStalled] = useState(false);
  const stalledRef = useRef(false);
  stalledRef.current = stalled;

  /** One recovery episode per item: a second death on the same item escalates. */
  const episodeRef = useRef<{ itemId: string | null; reconnects: number }>({
    itemId: null,
    reconnects: 0,
  });
  const graceTimerRef = useRef<number | null>(null);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current != null) {
      window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const enterStall = useCallback((why: string) => {
    if (stalledRef.current) return;
    clearGraceTimer();
    setStalled(true);
    optionsRef.current.onStatus('Tap the button to keep going.');
    logDiStage('stall', `session dead and recovery failed (${why}) — showing recovery card`, {}, 'session-dead');
    // The artifact must exist at the moment of failure, not only at teardown —
    // a stalled tab is exactly the tab most likely to be closed on the spot.
    void flushDiRunLog('stall');
  }, [clearGraceTimer]);

  /** Level 2: warm reconnect, with a deadline for the resume signal. */
  const reconnectAndWatch = useCallback(() => {
    clearGraceTimer();
    optionsRef.current.onStatus('One moment—getting your tutor back…');
    void ctxRef.current.reconnect();
    graceTimerRef.current = window.setTimeout(() => {
      graceTimerRef.current = null;
      enterStall('no resume signal within the grace window');
    }, RECONNECT_GRACE_MS);
  }, [clearGraceTimer, enterStall]);

  const noteDead = useCallback(() => {
    if (!optionsRef.current.running || stalledRef.current) return;
    const itemId = optionsRef.current.currentItemId();
    const episode = episodeRef.current;
    if (episode.itemId === itemId && episode.reconnects >= 1) {
      // The session died AGAIN on the same item after a reconnect: level 3.
      enterStall('second session-dead within one item');
      return;
    }
    episodeRef.current = { itemId, reconnects: 1 };
    logDiStage('stall-reconnect', 'session dead — reconnecting warm (ladder level 2)', { itemId }, 'session-dead');
    reconnectAndWatch();
  }, [enterStall, reconnectAndWatch]);

  const noteResumed = useCallback(() => {
    // The resume landed — recovery is on the resume path now; the re-cue the
    // pack sends re-arms the engine's dead-cue watch, which re-escalates if
    // the resumed session is dead too.
    clearGraceTimer();
  }, [clearGraceTimer]);

  const retry = useCallback(() => {
    // Card tap: a human gesture resets the episode, so the ladder gets a full
    // level-2 attempt again instead of bouncing straight back to the card.
    episodeRef.current = { itemId: null, reconnects: 0 };
    setStalled(false);
    logDiStage('stall-retry', 'recovery card tapped — reconnect and re-cue');
    reconnectAndWatch();
  }, [reconnectAndWatch]);

  const reset = useCallback(() => {
    clearGraceTimer();
    episodeRef.current = { itemId: null, reconnects: 0 };
    setStalled(false);
  }, [clearGraceTimer]);

  // Level 3 via the transport's own verdict: the server exhausted its resumes
  // (session_ended) or the socket dropped for good mid-run. Route through the
  // same episode logic so the first occurrence still gets a level-2 reconnect.
  useEffect(() => {
    if (!options.running || !ctx.sessionEnded || stalled) return;
    noteDead();
  }, [ctx.sessionEnded, options.running, stalled, noteDead]);

  useEffect(() => () => clearGraceTimer(), [clearGraceTimer]);

  return { stalled, noteDead, noteResumed, retry, reset };
}
