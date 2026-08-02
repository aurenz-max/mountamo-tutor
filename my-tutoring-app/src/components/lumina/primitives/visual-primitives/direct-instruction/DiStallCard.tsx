'use client';

/**
 * DiStallCard — the DI family's level-3 recovery state (BACKLOG item 5):
 * rendered by a pack in place of its stage when the Live session died and
 * automatic recovery failed. VISIBLE state, never a silent "Listening…".
 *
 * PRE-friendly by necessity, not preference: the tutor voice is dead and
 * cannot read anything aloud, so the card is picture-primary — one big 🔄
 * tap target, minimal words. The tap re-runs connect-and-re-cue (the pack's
 * `retry` from useDiStallRecovery).
 *
 * No mic affordance here — the mic stays open (open-mic doctrine); only the
 * tutor side needs restarting.
 */

import React from 'react';

export const DiStallCard: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="mb-6 flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-slate-900/50 p-8 text-center">
    <button
      type="button"
      onClick={onRetry}
      aria-label="Get the tutor back"
      className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-amber-400/50 bg-amber-500/15 text-6xl leading-none transition-transform hover:scale-105 active:scale-95 motion-safe:animate-pulse"
    >
      <span aria-hidden="true">🔄</span>
    </button>
    <div className="text-lg font-semibold text-amber-100">Tap to keep going</div>
  </div>
);

export default DiStallCard;
