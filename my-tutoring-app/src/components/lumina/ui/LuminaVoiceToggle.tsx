'use client';

/**
 * LuminaVoiceToggle — the navbar chip for the session-level auto-listen
 * switch (utils/voiceMode). Drop it in any header (lesson, Pulse, studio):
 * one glance says whether mics may open themselves; one click (or Ctrl+M)
 * flips it. Push-to-talk is unaffected — this governs hands-free listening.
 */

import React from 'react';
import { VoiceMode, useAutoListenEnabled } from '../utils/voiceMode';

export interface LuminaVoiceToggleProps {
  /** Show the text label next to the mic glyph (default true). */
  showLabel?: boolean;
  className?: string;
}

const LuminaVoiceToggle: React.FC<LuminaVoiceToggleProps> = ({ showLabel = true, className }) => {
  const on = useAutoListenEnabled();
  return (
    <button
      type="button"
      onClick={() => VoiceMode.toggle()}
      aria-pressed={on}
      title={
        on
          ? 'Auto-listen ON — spoken activities may open the mic themselves. Click or Ctrl+M to turn off.'
          : 'Auto-listen OFF — the mic only opens from an explicit tap. Click or Ctrl+M to turn on.'
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
        on
          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
          : 'bg-slate-800/60 border-white/10 text-slate-400 hover:bg-slate-700/60'
      } ${className ?? ''}`}
    >
      <span className="relative leading-none select-none" aria-hidden>
        🎙️
        {!on && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="block w-[130%] h-[2px] bg-rose-400 rotate-45 rounded-full" />
          </span>
        )}
      </span>
      {showLabel && <span>{on ? 'auto-listen' : 'voice off'}</span>}
    </button>
  );
};

export default LuminaVoiceToggle;
