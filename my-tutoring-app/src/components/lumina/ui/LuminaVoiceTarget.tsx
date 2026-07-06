'use client';

/**
 * LuminaVoiceTarget — the "current target" frame for voice-controlled work.
 *
 * When several questions/problems share a screen with an always-on mic, the
 * student needs a targeting layer (think MMO target frames): exactly ONE unit
 * of work visibly holds the voice focus at any moment, so "the app is
 * listening" is never ambiguous about WHAT it is listening for. Wrap each
 * unit of work in this frame and drive `active` from your focus state:
 *
 *   <LuminaVoiceTarget label="Problem 1" active={focus === 0}
 *     done={solved[0]} onFocus={() => setFocus(0)} accent="cyan">
 *     …the question UI…
 *   </LuminaVoiceTarget>
 *
 * States:
 *  - active  — accent border + "🎙 label" chip + pulsing hint ("listening…");
 *    this is where spoken answers land.
 *  - done    — emerald "✓ label" chip, content kept visible.
 *  - neither — dimmed, plain border; clicking anywhere re-targets it when
 *    `onFocus` is provided (tap-to-target).
 *
 * The frame is presentation only: the consumer owns focus state, routing of
 * verdicts to the focused unit, and advancing focus when a unit completes.
 */

import React from 'react';
import type { LuminaAccent } from './tokens';

const ACCENT_CLASSES: Record<LuminaAccent, { border: string; chipBg: string; chipText: string }> = {
  orange: { border: 'border-orange-400/60', chipBg: 'bg-orange-500/20', chipText: 'text-orange-200' },
  emerald: { border: 'border-emerald-400/60', chipBg: 'bg-emerald-500/20', chipText: 'text-emerald-200' },
  cyan: { border: 'border-cyan-400/60', chipBg: 'bg-cyan-500/20', chipText: 'text-cyan-200' },
  amber: { border: 'border-amber-400/60', chipBg: 'bg-amber-500/20', chipText: 'text-amber-200' },
  blue: { border: 'border-blue-400/60', chipBg: 'bg-blue-500/20', chipText: 'text-blue-200' },
  purple: { border: 'border-purple-400/60', chipBg: 'bg-purple-500/20', chipText: 'text-purple-200' },
  pink: { border: 'border-pink-400/60', chipBg: 'bg-pink-500/20', chipText: 'text-pink-200' },
  rose: { border: 'border-rose-400/60', chipBg: 'bg-rose-500/20', chipText: 'text-rose-200' },
  indigo: { border: 'border-indigo-400/60', chipBg: 'bg-indigo-500/20', chipText: 'text-indigo-200' },
  teal: { border: 'border-teal-400/60', chipBg: 'bg-teal-500/20', chipText: 'text-teal-200' },
};

export interface LuminaVoiceTargetProps {
  /** This unit currently holds the voice focus. */
  active: boolean;
  /** This unit is completed — check chip, no dimming, no re-target. */
  done?: boolean;
  /** Short unit name shown in the chip, e.g. "Problem 1". */
  label: string;
  /** Pulsing hint next to the chip while active. Default "listening…". */
  activeHint?: string;
  accent?: LuminaAccent;
  /** Tap-to-target: called when a non-active, non-done frame is clicked. */
  onFocus?: () => void;
  className?: string;
  children: React.ReactNode;
}

const LuminaVoiceTarget: React.FC<LuminaVoiceTargetProps> = ({
  active,
  done = false,
  label,
  activeHint = 'listening…',
  accent = 'cyan',
  onFocus,
  className,
  children,
}) => {
  const a = ACCENT_CLASSES[accent];
  const targetable = !active && !done && !!onFocus;

  return (
    <div
      onClick={targetable ? onFocus : undefined}
      className={`relative rounded-2xl border-2 p-4 pt-5 transition-all ${
        active
          ? `${a.border} bg-white/[0.03]`
          : done
            ? 'border-emerald-400/30'
            : 'border-white/10 opacity-60'
      } ${targetable ? 'cursor-pointer hover:opacity-85' : ''} ${className ?? ''}`}
    >
      <div className="absolute -top-3 left-4 flex items-center gap-2">
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
            active
              ? `${a.chipBg} ${a.chipText} ${a.border}`
              : done
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                : 'bg-slate-800 text-slate-400 border-white/10'
          }`}
        >
          {done ? `✓ ${label}` : active ? `🎙 ${label}` : label}
        </span>
        {active && !done && (
          <span className={`text-[11px] ${a.chipText} animate-pulse`}>{activeHint}</span>
        )}
      </div>
      {children}
    </div>
  );
};

export default LuminaVoiceTarget;
